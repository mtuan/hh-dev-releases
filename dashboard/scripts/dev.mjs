import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { buildRenderer } from './build-renderer.mjs';

const require = createRequire(import.meta.url);
const electronmon = require('electronmon');
const watchboy = require('watchboy');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockFile = path.join(root, '.dev-update-lock');
const readyFile = path.join(root, '.dev-update-ready');
const instanceFile = path.join(root, '.dev-instance.json');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
let monitor;
let timer;
let building = false;
let dirty = false;
let restartRequired = false;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function processDetails(pid) {
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return undefined;
    const command = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).stdout?.trim();
    if (!command || !/(?:^|\s)(?:node|[^\s]*\/node)\s+scripts\/dev\.mjs(?:\s|$)/.test(command)) return undefined;
    const cwdOutput = spawnSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).stdout ?? '';
    const cwd = cwdOutput.split('\n').find((line) => line.startsWith('n'))?.slice(1);
    return cwd && path.resolve(cwd) === root ? { pid, command } : undefined;
}

function legacyDevProcesses() {
    const output = spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).stdout ?? '';
    return output.split('\n').flatMap((line) => {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (!match || !/(?:^|\s)(?:node|[^\s]*\/node)\s+scripts\/dev\.mjs(?:\s|$)/.test(match[2])) return [];
        const details = processDetails(Number(match[1]));
        return details ? [details] : [];
    });
}

async function terminateDevProcess(pid) {
    const details = processDetails(pid);
    if (!details) return;
    console.log(`[dev] Stopping previous dashboard watcher ${pid}…`);
    try { process.kill(pid, 'SIGTERM'); } catch { return; }
    for (let attempt = 0; attempt < 50; attempt += 1) {
        await delay(100);
        if (!processDetails(pid)) return;
    }
    console.warn(`[dev] Previous watcher ${pid} did not stop cleanly; terminating it.`);
    try { process.kill(pid, 'SIGKILL'); } catch { /* It exited between checks. */ }
}

function readInstancePid() {
    try {
        const instance = JSON.parse(fs.readFileSync(instanceFile, 'utf8'));
        return instance.root === root ? Number(instance.pid) : undefined;
    } catch { return undefined; }
}

function releaseInstance() {
    if (readInstancePid() === process.pid) fs.rmSync(instanceFile, { force: true });
}

async function acquireInstance() {
    const candidates = new Set([readInstancePid(), ...legacyDevProcesses().map(({ pid }) => pid)]);
    candidates.delete(undefined);
    candidates.delete(process.pid);
    for (const pid of candidates) await terminateDevProcess(pid);
    fs.rmSync(instanceFile, { force: true });
    fs.writeFileSync(instanceFile, `${JSON.stringify({ pid: process.pid, root, startedAt: new Date().toISOString() }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    process.once('exit', releaseInstance);
}

function cleanStaleRuntimeArtifacts() {
    fs.rmSync(`${path.join(root, 'dist')}.dev-previous`, { recursive: true, force: true });
    fs.rmSync(`${path.join(root, 'resources/loading-kit/web/loading-graph.js')}.next`, { force: true });
    fs.rmSync(readyFile, { force: true });
}

function runTypeScript(args) {
    const result = spawnSync(process.execPath, [tsc, ...args], { cwd: root, encoding: 'utf8' });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) throw new Error(`TypeScript exited with code ${result.status ?? 'unknown'}.`);
}

function promoteDirectory(source, destination) {
    const previous = `${destination}.dev-previous`;
    fs.rmSync(previous, { recursive: true, force: true });
    if (fs.existsSync(destination)) fs.renameSync(destination, previous);
    try {
        fs.renameSync(source, destination);
        fs.rmSync(previous, { recursive: true, force: true });
    } catch (error) {
        fs.rmSync(destination, { recursive: true, force: true });
        if (fs.existsSync(previous)) fs.renameSync(previous, destination);
        throw error;
    }
}

async function buildTransaction() {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-dashboard-dev-'));
    const stageDist = path.join(stage, 'dist');
    const stagedLoadingRuntime = path.join(stage, 'loading-graph.js');
    try {
        console.log('[dev] Validating complete update…');
        runTypeScript(['-p', 'tsconfig.renderer.json', '--noEmit']);
        runTypeScript(['-p', 'tsconfig.json', '--outDir', stageDist]);
        await buildRenderer(path.join(stageDist, 'src'));
        await esbuild({ entryPoints: [path.join(root, 'resources/loading-kit/web/loading-graph-entry.js')], bundle: true, platform: 'browser', format: 'iife', outfile: stagedLoadingRuntime });
        promoteDirectory(stageDist, path.join(root, 'dist'));
        const runtimeDestination = path.join(root, 'resources/loading-kit/web/loading-graph.js');
        fs.copyFileSync(stagedLoadingRuntime, `${runtimeDestination}.next`);
        fs.renameSync(`${runtimeDestination}.next`, runtimeDestination);
        console.log('[dev] Complete update promoted.');
        return true;
    } catch (error) {
        console.error(`[dev] Update rejected; the running app keeps the last working code.\n${error instanceof Error ? error.stack ?? error.message : String(error)}`);
        return false;
    } finally {
        fs.rmSync(stage, { recursive: true, force: true });
    }
}

async function flush() {
    timer = undefined;
    if (building || fs.existsSync(lockFile)) return;
    building = true;
    const shouldRestart = restartRequired;
    restartRequired = false;
    dirty = false;
    const successful = await buildTransaction();
    if (successful && monitor) {
        if (shouldRestart) { console.log('[dev] Restarting Electron after main-process update.'); await monitor.restart(); }
        else { console.log('[dev] Reloading renderer after complete update.'); await monitor.reload(); }
    }
    building = false;
    if (dirty && !fs.existsSync(lockFile)) schedule();
}

function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 600);
}

function changed(file) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative === '.dev-update-lock') return;
    if (relative === '.dev-update-ready') {
        fs.rmSync(readyFile, { force: true });
        dirty = true;
        schedule();
        return;
    }
    dirty = true;
    if (relative.startsWith('electron/') || relative.startsWith('cli/') || relative === 'package.json' || relative === 'tsconfig.json') restartRequired = true;
    if (!fs.existsSync(lockFile)) schedule();
}

await acquireInstance();
cleanStaleRuntimeArtifacts();

let initial = true;
if (fs.existsSync(lockFile)) {
    if (!fs.existsSync(path.join(root, 'dist/electron/main.js'))) {
        console.error('[dev] An update transaction is open and no last working build exists. Finish or restore the update before starting development mode.');
        process.exit(1);
    }
    console.log('[dev] Update transaction is open; launching the last working build without rebuilding.');
} else {
    initial = await buildTransaction();
}
if (!initial) process.exit(1);
fs.rmSync(readyFile, { force: true });
delete process.env.ELECTRON_RUN_AS_NODE;
monitor = await electronmon({ cwd: root, args: ['.'], patterns: ['!**/*'] });
const watcher = watchboy([
    'src/**/*', 'electron/**/*.ts', 'cli/**/*.ts', 'resources/loading-kit/**/*',
    'package.json', 'tsconfig.json', 'tsconfig.renderer.json', '.dev-update-lock', '.dev-update-ready',
    '!resources/loading-kit/web/loading-graph.js', '!resources/loading-kit/web/loading-graph.js.next',
], { cwd: root });
let watcherReady = false;
for (const event of ['add', 'change', 'unlink']) watcher.on(event, ({ path: file }) => { if (watcherReady) changed(file); });
watcher.on('error', (error) => console.error('[dev] Watch error:', error));
watcher.once('ready', () => { watcherReady = true; console.log('[dev] Transactional watcher ready.'); });

let stopping = false;
async function stop() { if (stopping) return; stopping = true; clearTimeout(timer); watcher.close(); if (monitor) await monitor.destroy(); releaseInstance(); process.exit(0); }
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());

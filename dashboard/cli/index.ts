import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import AdmZip from 'adm-zip';
import { creatorInfo, inspectTooling, syncTooling } from '../electron/tool-packages';

function option(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(): never {
    console.error('Usage: cocos-build-dashboard <doctor|sync|build|version> --project <path> [--profile <id>] [--creator <executable>]');
    process.exit(2);
}

const command = process.argv[2];
const projectPath = path.resolve(option('--project') ?? process.cwd());
const resourcesRoot = path.resolve(__dirname, '..', '..', 'resources');

function findCreator(version: string): string {
    const explicit = option('--creator');
    const candidates = explicit ? [explicit] : process.platform === 'darwin' ? [
        `/Applications/Cocos/Creator/${version}/CocosCreator.app/Contents/MacOS/CocosCreator`,
        path.join(os.homedir(), 'Applications', 'Cocos', 'Creator', version, 'CocosCreator.app', 'Contents', 'MacOS', 'CocosCreator'),
    ] : process.platform === 'win32' ? [
        path.join(process.env.ProgramFiles ?? '', 'Cocos', 'Creator', version, 'CocosCreator.exe'),
        path.join(process.env.LOCALAPPDATA ?? '', 'CocosDashboard', 'resources', '.editors', 'Creator', version, 'CocosCreator.exe'),
    ] : [path.join(os.homedir(), 'Cocos', 'Creator', version, 'CocosCreator'), `/opt/Cocos/Creator/${version}/CocosCreator`];
    const executable = candidates.find((candidate) => candidate && fs.existsSync(candidate));
    if (!executable) throw new Error(`Cannot find Cocos Creator ${version}; pass --creator <executable>`);
    return executable;
}

function filesUnder(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? filesUnder(fullPath) : [fullPath];
    });
}

function restoreFacebookTemplateAssets(output: string): void {
    const indexPath = path.join(output, 'index.html');
    if (!fs.existsSync(indexPath)) return;
    const html = fs.readFileSync(indexPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const roots = [path.join(projectPath, 'build-templates', 'fb-instant-games'), path.join(projectPath, 'build-templates')];
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
        const reference = match[1].split(/[?#]/)[0];
        if (!reference || /^(?:[a-z]+:|\/\/|#|data:)/i.test(reference)) continue;
        const destination = path.resolve(output, reference);
        const relative = path.relative(output, destination);
        if (relative.startsWith('..') || path.isAbsolute(relative) || fs.existsSync(destination)) continue;
        const source = roots.map((root) => path.resolve(root, reference)).find((candidate, index) => {
            const sourceRelative = path.relative(roots[index], candidate);
            return !sourceRelative.startsWith('..') && !path.isAbsolute(sourceRelative) && fs.statSync(candidate, { throwIfNoEntry: false })?.isFile();
        });
        if (source) {
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.copyFileSync(source, destination);
        }
    }
}

function normalizeCreator2Output(output: string, platform: string): void {
    const nested = path.join(output, platform);
    if (!fs.existsSync(nested)) return;
    const temporary = `${output}.cocos2-output-${Date.now()}`;
    fs.renameSync(nested, temporary); fs.rmSync(output, { recursive: true, force: true }); fs.renameSync(temporary, output);
    if (platform !== 'fb-instant-games') return;
    restoreFacebookTemplateAssets(output);
    for (const file of filesUnder(output)) if (file.toLowerCase().endsWith('.zip')) fs.rmSync(file, { force: true });
    const archive = new AdmZip(); const excluded = new Set(['cert.pem', 'key.pem', '.DS_Store']);
    for (const file of filesUnder(output)) {
        const relative = path.relative(output, file); if (excluded.has(path.basename(file))) continue;
        archive.addLocalFile(file, path.dirname(relative) === '.' ? '' : path.dirname(relative));
    }
    archive.writeZip(path.join(output, 'facebook-upload.zip'));
}

try {
    if (command === 'doctor') {
        const status = inspectTooling(projectPath);
        console.log(JSON.stringify(status, null, 2));
        process.exitCode = status.needsSync ? 1 : 0;
    } else if (command === 'sync') {
        console.log(JSON.stringify(syncTooling(projectPath, resourcesRoot), null, 2));
    } else if (command === 'version') {
        console.log(JSON.stringify(creatorInfo(projectPath), null, 2));
    } else if (command === 'build') {
        const profileId = option('--profile');
        if (!profileId) throw new Error('build requires --profile <id> from cocos-build-dashboard.json');
        const projectConfig = JSON.parse(fs.readFileSync(path.join(projectPath, 'cocos-build-dashboard.json'), 'utf8')) as {
            profiles?: Array<{ id: string; platform: string; debug: boolean; buildPath: string; environment?: string }>;
        };
        const profile = projectConfig.profiles?.find((candidate) => candidate.id === profileId);
        if (!profile) throw new Error(`Unknown build profile: ${profileId}`);
        const info = creatorInfo(projectPath);
        const executable = findCreator(info.version);
        const output = path.resolve(projectPath, profile.buildPath);
        const buildPath = info.family === '2.x' ? output : path.dirname(output);
        const args = `platform=${profile.platform};debug=${profile.debug};buildPath=${buildPath};outputName=${path.basename(output)}`;
        const environment: NodeJS.ProcessEnv = { ...process.env, COCOS_BUILD_ENV: profile.environment ?? profile.id };
        delete environment.ELECTRON_RUN_AS_NODE;
        const result = spawnSync(executable, [info.family === '2.x' ? '--path' : '--project', projectPath, '--build', args], {
            stdio: 'inherit',
            env: environment,
        });
        const successCodes = info.family === '3.x' ? new Set([0, 36]) : new Set([0, 36]);
        if (result.error) throw result.error;
        if (!successCodes.has(result.status ?? -1)) process.exitCode = result.status ?? 1;
        else if (info.family === '2.x') normalizeCreator2Output(output, profile.platform);
    } else {
        usage();
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type CreatorFamily = '2.x' | '3.x';

export interface ToolLock {
    version: 1;
    creator: { family: CreatorFamily; testedVersion: string };
    packages: { dashboardBridge: string; loadingKit: string; previewSimulator: string };
}

export interface ManagedInstallation {
    version: 1;
    package: string;
    packageVersion: string;
    creatorFamily: CreatorFamily;
    managedFiles: Record<string, string>;
    previewSimulator?: { path: string; hash: string; indexPath: string };
}

export interface ToolingStatus {
    creatorVersion: string;
    creatorFamily: CreatorFamily;
    lockExists: boolean;
    loadingConfigExists: boolean;
    loadingThemeExists: boolean;
    bridgeInstalled: boolean;
    previewSimulatorInstalled: boolean;
    previewSimulatorCustomized: boolean;
    managedInstallationExists: boolean;
    conflicts: string[];
    needsSync: boolean;
}

interface ResourceManifest {
    version: number;
    packages: { dashboardBridge: string; loadingKit: string; previewSimulator: string };
}

const LOCK_FILE = 'cocos-tools.lock.json';
const LOADING_CONFIG_FILE = 'cocos-loading.config.json';
const INSTALLATION_FILE = path.join('.cocos-build-tools', 'installation.json');
const PREVIEW_SIMULATOR_FILE = path.join('preview-templates', 'hayhay-platform-simulator.js');
const PREVIEW_INDEX_FILE = path.join('preview-templates', 'index.html');
const PREVIEW_SCRIPT = '<script type="text/javascript" charset="utf-8" src="hayhay-platform-simulator.js"></script>';
const PREVIEW_MARKER_START = '<!-- hayhay-platform-simulator:start -->';
const PREVIEW_MARKER_END = '<!-- hayhay-platform-simulator:end -->';
const PREVIEW_VIEWPORT_MARKER_START = '<!-- hayhay-preview-viewport:start -->';
const PREVIEW_VIEWPORT_MARKER_END = '<!-- hayhay-preview-viewport:end -->';
const PREVIEW_VIEWPORT_HEAD = `${PREVIEW_VIEWPORT_MARKER_START}
<script>(function(){var m=localStorage.getItem('hayhay-preview-viewport')||'full';if(['full','portrait','landscape'].indexOf(m)<0)m='full';document.documentElement.setAttribute('data-hh-preview-mode',m);var d={mode:m,viewport:[window.innerWidth,window.innerHeight],readyState:document.readyState};window.__hayhayPreviewLogs=window.__hayhayPreviewLogs||[];window.__hayhayPreviewLogs.push(['preboot',d]);console.info('[HayHay Preview] preboot '+JSON.stringify(d))})();</script>
<style>html,body{overflow:hidden!important}.toolbar{box-sizing:border-box!important;min-height:56px!important}#content{box-sizing:border-box!important;min-height:0!important;overflow:hidden!important}#content .contentWrap{width:100%!important;height:100%!important;overflow:hidden!important;justify-content:center!important}#GameDiv{position:relative!important;inset:auto!important;flex:0 0 auto!important}html[data-hh-preview-mode="full"] #content{padding:0!important}html[data-hh-preview-mode="full"] #GameDiv{width:100%!important;height:100%!important}html[data-hh-preview-mode="portrait"] #content,html[data-hh-preview-mode="landscape"] #content{padding:16px!important}html[data-hh-preview-mode="portrait"] #GameDiv{width:min(calc((100vh - 88px)*9/16),calc(100vw - 32px))!important;height:min(calc(100vh - 88px),calc((100vw - 32px)*16/9))!important}html[data-hh-preview-mode="landscape"] #GameDiv{width:min(calc((100vh - 88px)*16/9),calc(100vw - 32px))!important;height:min(calc(100vh - 88px),calc((100vw - 32px)*9/16))!important}</style>
${PREVIEW_VIEWPORT_MARKER_END}`;

function bridgeInstallRoot(projectPath: string, family: CreatorFamily): string {
    return path.join(projectPath, family === '2.x' ? 'packages' : 'extensions', 'cocos-build-dashboard-bridge');
}

function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function creatorInfo(projectPath: string): { version: string; family: CreatorFamily } {
    const packageFile = path.join(projectPath, 'package.json');
    const legacyProjectFile = path.join(projectPath, 'project.json');
    let version = '';
    if (fs.existsSync(packageFile)) {
        const pkg = readJson<{ creator?: { version?: string } }>(packageFile);
        version = pkg.creator?.version?.trim() ?? '';
    }
    if (!version && fs.existsSync(legacyProjectFile)) {
        const legacy = readJson<{ engine?: string; version?: string }>(legacyProjectFile);
        if (legacy.engine === 'cocos-creator-js') version = legacy.version?.trim() ?? '';
    }
    if (!version) throw new Error(`Missing Cocos Creator version metadata. Expected creator.version in ${packageFile} or version in ${legacyProjectFile}`);
    const major = Number.parseInt(version.split('.')[0], 10);
    if (major !== 2 && major !== 3) throw new Error(`Unsupported Cocos Creator version: ${version}`);
    return { version, family: major === 2 ? '2.x' : '3.x' };
}

function hashFile(file: string): string {
    return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function listFiles(root: string, current = root): string[] {
    if (!fs.existsSync(current)) return [];
    return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(current, entry.name);
        return entry.isDirectory() ? listFiles(root, full) : [path.relative(root, full).split(path.sep).join('/')];
    });
}

function copyManagedTree(source: string, destination: string, previous: ManagedInstallation | null, conflicts: string[]): Record<string, string> {
    const hashes: Record<string, string> = {};
    for (const relative of listFiles(source)) {
        const sourceFile = path.join(source, ...relative.split('/'));
        const destinationFile = path.join(destination, ...relative.split('/'));
        if (fs.existsSync(destinationFile)) {
            const oldHash = previous?.managedFiles[relative];
            const destinationHash = hashFile(destinationFile);
            if ((!oldHash && destinationHash !== hashFile(sourceFile)) || (oldHash && destinationHash !== oldHash)) {
                conflicts.push(relative);
                continue;
            }
        }
        fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
        fs.copyFileSync(sourceFile, destinationFile);
        hashes[relative] = hashFile(destinationFile);
    }
    return hashes;
}

export function inspectTooling(projectPath: string): ToolingStatus {
    const creator = creatorInfo(projectPath);
    const installationPath = path.join(projectPath, INSTALLATION_FILE);
    const installation = fs.existsSync(installationPath) ? readJson<ManagedInstallation>(installationPath) : null;
    const conflicts: string[] = [];
    if (installation) {
        const installedRoot = bridgeInstallRoot(projectPath, creator.family);
        for (const [relative, expected] of Object.entries(installation.managedFiles)) {
            const file = path.join(installedRoot, ...relative.split('/'));
            if (!fs.existsSync(file) || hashFile(file) !== expected) conflicts.push(relative);
        }
        if (installation.previewSimulator) {
            const runtime = path.join(projectPath, installation.previewSimulator.path);
            if (!fs.existsSync(runtime) || hashFile(runtime) !== installation.previewSimulator.hash) conflicts.push(installation.previewSimulator.path);
        }
    }
    const lockExists = fs.existsSync(path.join(projectPath, LOCK_FILE));
    const loadingConfigExists = fs.existsSync(path.join(projectPath, LOADING_CONFIG_FILE));
    const loadingThemeExists = fs.existsSync(path.join(projectPath, 'loading', 'theme.json'));
    const bridgeInstalled = fs.existsSync(path.join(bridgeInstallRoot(projectPath, creator.family), 'package.json'));
    const previewRuntime = path.join(projectPath, PREVIEW_SIMULATOR_FILE);
    const previewIndex = path.join(projectPath, PREVIEW_INDEX_FILE);
    const previewSimulatorInstalled = creator.family === '2.x'
        && Boolean(installation?.previewSimulator)
        && fs.existsSync(previewRuntime)
        && fs.existsSync(previewIndex)
        && fs.readFileSync(previewIndex, 'utf8').includes('hayhay-platform-simulator.js');
    const previewSimulatorCustomized = previewSimulatorInstalled
        && hashFile(previewRuntime) !== installation?.previewSimulator?.hash;
    const toolingConflicts = conflicts.filter((item) => item !== PREVIEW_SIMULATOR_FILE);
    return {
        creatorVersion: creator.version,
        creatorFamily: creator.family,
        lockExists,
        loadingConfigExists,
        loadingThemeExists,
        bridgeInstalled,
        previewSimulatorInstalled,
        previewSimulatorCustomized,
        managedInstallationExists: Boolean(installation),
        conflicts: toolingConflicts,
        needsSync: !lockExists || !loadingConfigExists || !loadingThemeExists || !bridgeInstalled || toolingConflicts.length > 0,
    };
}

export function syncTooling(projectPath: string, resourcesRoot: string): ToolingStatus {
    const creator = creatorInfo(projectPath);
    const manifest = readJson<ResourceManifest>(path.join(resourcesRoot, 'manifest.json'));
    const installationPath = path.join(projectPath, INSTALLATION_FILE);
    const previous = fs.existsSync(installationPath) ? readJson<ManagedInstallation>(installationPath) : null;
    const conflicts: string[] = [];
    let managedFiles: Record<string, string> = {};
    const bridgeSource = path.join(resourcesRoot, 'bridges', creator.family === '2.x' ? 'creator-2' : 'creator-3');
    if (!fs.existsSync(bridgeSource)) throw new Error(`Cocos Creator ${creator.family} bridge package is missing`);
    managedFiles = copyManagedTree(bridgeSource, bridgeInstallRoot(projectPath, creator.family), previous, conflicts);
    if (conflicts.length) throw new Error(`Managed files were modified; resolve before updating: ${conflicts.join(', ')}`);

    const lock: ToolLock = {
        version: 1,
        creator: { family: creator.family, testedVersion: creator.version },
        packages: manifest.packages,
    };
    writeJson(path.join(projectPath, LOCK_FILE), lock);

    const loadingKit = path.join(resourcesRoot, 'loading-kit');
    const configDestination = path.join(projectPath, LOADING_CONFIG_FILE);
    if (!fs.existsSync(configDestination)) fs.copyFileSync(path.join(loadingKit, 'defaults', 'cocos-loading.config.json'), configDestination);
    const themeDestination = path.join(projectPath, 'loading', 'theme.json');
    if (!fs.existsSync(themeDestination)) {
        fs.mkdirSync(path.dirname(themeDestination), { recursive: true });
        fs.copyFileSync(path.join(loadingKit, 'defaults', 'theme.json'), themeDestination);
    }
    const schemaDestination = path.join(projectPath, 'loading', 'loading-config.schema.json');
    fs.copyFileSync(path.join(loadingKit, 'schema', 'loading-config.schema.json'), schemaDestination);

    writeJson(installationPath, {
        version: 1,
        package: 'cocos-build-dashboard-bridge',
        packageVersion: manifest.packages.dashboardBridge,
        creatorFamily: creator.family,
        managedFiles,
        ...(previous?.previewSimulator ? { previewSimulator: previous.previewSimulator } : {}),
    } satisfies ManagedInstallation);
    return inspectTooling(projectPath);
}

export function syncPreviewSimulator(projectPath: string, resourcesRoot: string): ToolingStatus {
    const creator = creatorInfo(projectPath);
    if (creator.family !== '2.x') throw new Error('The managed local preview simulator currently supports Cocos Creator 2.x projects.');
    const previewIndex = path.join(projectPath, PREVIEW_INDEX_FILE);
    if (!fs.existsSync(previewIndex)) throw new Error(`Cocos Creator preview template is missing: ${previewIndex}`);
    const runtimeSource = path.join(resourcesRoot, 'preview-simulator', 'runtime.js');
    const runtimeDestination = path.join(projectPath, PREVIEW_SIMULATOR_FILE);
    fs.mkdirSync(path.dirname(runtimeDestination), { recursive: true });
    fs.copyFileSync(runtimeSource, runtimeDestination);

    let html = fs.readFileSync(previewIndex, 'utf8');
    html = html.replace(new RegExp(`${PREVIEW_MARKER_START}[\\s\\S]*?${PREVIEW_MARKER_END}\\s*`, 'g'), '');
    html = html.replace(/\s*<script[^>]+src=["']hayhay-platform-simulator\.js["'][^>]*><\/script>\s*/g, '\n');
    html = html.replace(new RegExp(`${PREVIEW_VIEWPORT_MARKER_START}[\\s\\S]*?${PREVIEW_VIEWPORT_MARKER_END}\\s*`, 'g'), '');
    if (!/<\/head>/i.test(html)) throw new Error(`Could not find the closing head tag in ${previewIndex}.`);
    html = html.replace(/<\/head>/i, `${PREVIEW_VIEWPORT_HEAD}\n</head>`);
    const settingsScript = /([ \t]*<script[^>]+src=["']settings\.js["'][^>]*><\/script>)/;
    if (!settingsScript.test(html)) throw new Error(`Could not find the settings.js script in ${previewIndex}.`);
    html = html.replace(settingsScript, `        ${PREVIEW_MARKER_START}\n        ${PREVIEW_SCRIPT}\n        ${PREVIEW_MARKER_END}\n$1`);
    fs.writeFileSync(previewIndex, html, 'utf8');

    const installationPath = path.join(projectPath, INSTALLATION_FILE);
    const manifest = readJson<ResourceManifest>(path.join(resourcesRoot, 'manifest.json'));
    const previous = fs.existsSync(installationPath) ? readJson<ManagedInstallation>(installationPath) : null;
    writeJson(installationPath, {
        version: 1,
        package: previous?.package ?? 'cocos-build-dashboard-bridge',
        packageVersion: previous?.packageVersion ?? manifest.packages.dashboardBridge,
        creatorFamily: creator.family,
        managedFiles: previous?.managedFiles ?? {},
        previewSimulator: { path: PREVIEW_SIMULATOR_FILE, hash: hashFile(runtimeDestination), indexPath: PREVIEW_INDEX_FILE },
    } satisfies ManagedInstallation);
    return inspectTooling(projectPath);
}

export function resetPreviewSimulator(projectPath: string): ToolingStatus {
    const installationPath = path.join(projectPath, INSTALLATION_FILE);
    const installation = fs.existsSync(installationPath) ? readJson<ManagedInstallation>(installationPath) : null;
    fs.rmSync(path.join(projectPath, PREVIEW_SIMULATOR_FILE), { force: true });
    const previewIndex = path.join(projectPath, PREVIEW_INDEX_FILE);
    if (fs.existsSync(previewIndex)) {
        let html = fs.readFileSync(previewIndex, 'utf8');
        html = html.replace(new RegExp(`${PREVIEW_MARKER_START}[\\s\\S]*?${PREVIEW_MARKER_END}\\s*`, 'g'), '');
        html = html.replace(/\s*<script[^>]+src=["']hayhay-platform-simulator\.js["'][^>]*><\/script>\s*/g, '\n');
        html = html.replace(new RegExp(`${PREVIEW_VIEWPORT_MARKER_START}[\\s\\S]*?${PREVIEW_VIEWPORT_MARKER_END}\\s*`, 'g'), '');
        fs.writeFileSync(previewIndex, html, 'utf8');
    }
    if (installation) {
        const { previewSimulator: _removed, ...remaining } = installation;
        writeJson(installationPath, remaining);
    }
    return inspectTooling(projectPath);
}

export function resetTooling(projectPath: string): ToolingStatus {
    const installationPath = path.join(projectPath, INSTALLATION_FILE);
    const installation = fs.existsSync(installationPath) ? readJson<ManagedInstallation>(installationPath) : null;
    if (installation) {
        const installedRoot = bridgeInstallRoot(projectPath, installation.creatorFamily);
        for (const [relative, expected] of Object.entries(installation.managedFiles)) {
            const file = path.join(installedRoot, ...relative.split('/'));
            if (fs.existsSync(file) && hashFile(file) === expected) fs.unlinkSync(file);
        }
    }
    for (const relative of [LOCK_FILE, LOADING_CONFIG_FILE, path.join('loading', 'theme.json'), path.join('loading', 'loading-config.schema.json')]) {
        const file = path.join(projectPath, relative);
        if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    }
    if (installation?.previewSimulator) {
        writeJson(installationPath, { ...installation, managedFiles: {}, previewSimulator: installation.previewSimulator });
    } else if (fs.existsSync(installationPath)) {
        fs.rmSync(installationPath, { force: true });
    }
    return inspectTooling(projectPath);
}


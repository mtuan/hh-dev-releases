import { app, BrowserWindow, dialog, ipcMain, nativeImage, safeStorage, screen, session, shell, WebContentsView } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import AdmZip from 'adm-zip';
import sodium from 'libsodium-wrappers';
import { execFileSync, execSync, spawn, spawnSync, ChildProcessWithoutNullStreams } from 'node:child_process';
import { seededFakePlayers } from './fake-player-seeds';
import {
    BuildJob,
    BuildRecord,
    BuildJobStatus,
    BuildProfile,
    AndroidToolchainPaths,
    AndroidToolchainStatus,
    AndroidToolchainComponent,
    AndroidDeployRequest,
    AndroidDevice,
    FacebookDeployRequest,
    FacebookConsoleRequest,
    FacebookConsoleStatus,
    FacebookConsoleBrowserAction,
    FacebookConsoleBrowserBounds,
    FacebookConsoleBrowserState,
    FacebookConsoleAssetExtraction,
    FacebookConsoleAssetFile,
    FakePlayerAvatarKind,
    FakePlayerGender,
    FakePlayersLibrary,
    BridgeStatus,
    CocosAccountStatus,
    DetectedProject,
    IosDeployRequest,
    IosDevice,
    ProjectConfig,
    ProjectInfoUpdate,
    ProjectsFile,
    LocalWebServerInfo,
    LocalWebServerProtocol,
    ManagedJob,
    ManagedJobType,
    ReleaseBuild,
    ReleaseDeploymentConfig,
    DeveloperIdIdentity,
    MacSigningPreparation,
    MacSigningProgress,
    ReleasePlatform,
    CreateReleaseBuildRequest,
    StartBuildRequest,
} from './types';
import { creatorInfo, inspectTooling, resetPreviewSimulator, resetTooling, syncPreviewSimulator, syncTooling } from './tool-packages';
import { applyWebLoadingScreen, clearLoadingAsset, createLoadingWebPreview, getLoadingScreen, saveLoadingScreen, setLoadingAsset, setLoadingComponentAsset } from './loading-screen';
import { DashboardUpdater } from './app-updater';

/** Cocos Creator CLI build exit codes (docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html) */
const EXIT_CODE_SUCCESS = 36;
const EXIT_CODE_INVALID_PARAMS = 32;
const EXIT_CODE_BUILD_ERROR = 34;

// Packaged apps ship inside a read-only asar archive, so project data can't
// live next to the source like it does in dev — use Electron's standard
// per-user writable data dir instead. Dev mode keeps the old path so
// existing local test data under data/projects.json still works.
const PROJECTS_FILE = app.isPackaged
    ? path.join(app.getPath('userData'), 'projects.json')
    : path.join(__dirname, '..', '..', 'data', 'projects.json');
const PROJECT_TOOL_DATA_DIRNAME = '.cocos-build-dashboard';
const PROJECT_SETTINGS_FILENAME = path.join(PROJECT_TOOL_DATA_DIRNAME, 'project.json');
const LEGACY_PROJECT_SETTINGS_FILENAME = 'cocos-build-dashboard.json';
const BUILD_HISTORY_FILE = path.join(app.getPath('userData'), 'build-history.json');
const JOBS_FILE = path.join(app.getPath('userData'), 'jobs.json');
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const RELEASE_DEPLOYMENT_FILE = path.join(app.getPath('userData'), 'release-deployment.json');
const MAC_SIGNING_LOG_FILE = path.join(app.getPath('userData'), 'mac-signing-export.log');
const FAKE_PLAYERS_DIRECTORY = path.join(path.dirname(PROJECTS_FILE), 'fake-players');
const FAKE_PLAYERS_FILE = path.join(FAKE_PLAYERS_DIRECTORY, 'library.json');
const FAKE_PLAYER_AVATARS_DIRECTORY = path.join(FAKE_PLAYERS_DIRECTORY, 'avatars');

// Shared local library of reusable build-template files, kept in the
// dashboard tool's own project (not any particular game project) so it's
// available regardless of which project/platform you're adding files for.
// Organize it as build-templates/<platform>/... — same convention as Cocos's
// own per-project build-templates folder.
const TOOL_RESOURCES_DIR = app.isPackaged
    ? path.join(process.resourcesPath, 'dashboard-resources')
    : path.join(__dirname, '..', '..', 'resources');
const TOOL_BUILD_TEMPLATES_DIR = path.join(TOOL_RESOURCES_DIR, 'build-templates');

// Shared library of reusable gameplay scripts, copied into <project>/assets/scripts/.
// The source root is codebase/scripts/, mirroring the destination assets/scripts/
// (so codebase/scripts/core/X.ts -> <project>/assets/scripts/core/X.ts).
// Cocos .meta files live next to their sources but are hidden from the picker
// and copied along automatically (see codebase:import).
const TOOL_CODEBASE_DIR = path.join(TOOL_RESOURCES_DIR, 'codebase', 'scripts');
const TOOL_CODEBASE_CREATOR2_DIR = path.join(TOOL_RESOURCES_DIR, 'codebase', 'creator-2', 'scripts');
const PROJECT_SCRIPTS_SUBDIR = path.join('assets', 'scripts');
function editorBridgeDestination(projectPath: string): string {
    return path.join(projectPath, creatorInfo(projectPath).family === '2.x' ? 'packages' : 'extensions', 'cocos-build-dashboard-bridge');
}

function codebaseDirectory(projectPath: string): string {
    return creatorInfo(projectPath).family === '2.x' ? TOOL_CODEBASE_CREATOR2_DIR : TOOL_CODEBASE_DIR;
}

function editorBridgeSource(projectPath: string): string {
    const creator = creatorInfo(projectPath);
    return path.join(TOOL_RESOURCES_DIR, 'bridges', creator.family === '2.x' ? 'creator-2' : 'creator-3');
}

let mainWindow: BrowserWindow | null = null;
let facebookConsoleWindow: BrowserWindow | null = null;
let facebookConsoleEmbeddedView: WebContentsView | null = null;
let facebookConsoleEmbeddedAttached = false;
let facebookConsoleEmbeddedProjectId: string | null = null;
let facebookConsoleNetworkReady = false;
const facebookConsoleRequests: FacebookConsoleRequest[] = [];
const facebookConsoleRequestStarts = new Map<number, number>();
interface WindowState { x?: number; y?: number; width: number; height: number; maximized: boolean; }
let windowStateSaveTimer: ReturnType<typeof setTimeout> | undefined;
const jobQueue: BuildJob[] = [];
let currentChild: ChildProcessWithoutNullStreams | null = null;
let currentJob: BuildJob | null = null;
const jobRegistry = new Map<string, BuildJob>();
const androidToolchainTasks = new Map<string, { child: ChildProcessWithoutNullStreams | null; canceled: boolean }>();
const deploymentProcesses = new Map<string, { cancel(): void }>();
const localWebServers = new Map<string, { server: http.Server | https.Server; info: LocalWebServerInfo; output: string }>();
const loadingPreviewServers = new Map<string, http.Server>();
const canceledDeployments = new Set<string>();
const jobLogs = new Map<string, string[]>();
let managedJobsCache: ManagedJob[] | null = null;
let managedJobsWriteTimer: ReturnType<typeof setTimeout> | undefined;
let dashboardUpdater: DashboardUpdater | undefined;

function readManagedJobs(): ManagedJob[] {
    if (managedJobsCache) return managedJobsCache;
    if (!fs.existsSync(JOBS_FILE)) return [];
    try { managedJobsCache = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8')) as ManagedJob[]; } catch { managedJobsCache = []; }
    return managedJobsCache;
}

function writeManagedJobs(jobs: ManagedJob[]): void {
    managedJobsCache = jobs.slice(0, 500);
    fs.mkdirSync(path.dirname(JOBS_FILE), { recursive: true });
    fs.writeFileSync(JOBS_FILE, JSON.stringify(managedJobsCache, null, 2) + '\n', 'utf-8');
    mainWindow?.webContents.send('jobs:changed');
}

function scheduleManagedJobsWrite(): void {
    if (managedJobsWriteTimer) return;
    managedJobsWriteTimer = setTimeout(() => { managedJobsWriteTimer = undefined; writeManagedJobs(readManagedJobs()); }, 150);
}

function upsertManagedJob(job: ManagedJob): void {
    const jobs = readManagedJobs(); const index = jobs.findIndex((candidate) => candidate.id === job.id);
    if (index >= 0) jobs[index] = job; else jobs.unshift(job); writeManagedJobs(jobs);
}

interface ManagedJobCreationMetadata { action?: string; sourceUrl?: string; projectPath?: string; }

function managedJobSourceUrl(project: ProjectConfig | undefined, profileId: string | undefined, type: ManagedJobType): string {
    if (!project) return '/jobs';
    const root = `/projects/${encodeURIComponent(project.id)}`; const profile = profileId ? project.profiles.find((candidate) => candidate.id === profileId) : undefined;
    if (profile) return `${root}/${encodeURIComponent(profile.platform)}/build`;
    return type === 'config' || type === 'install' ? `${root}/configs` : root;
}

function createManagedJob(id: string, type: ManagedJobType, name: string, projectId?: string, profileId?: string, tasks: string[] = [], metadata: ManagedJobCreationMetadata = {}): ManagedJob {
    const existing = readManagedJobs().find((job) => job.id === id); if (existing) return existing;
    const project = readProjects().projects.find((candidate) => candidate.id === projectId || (metadata.projectPath && path.resolve(candidate.projectPath) === path.resolve(metadata.projectPath)));
    const resolvedProjectId = projectId ?? project?.id;
    const job: ManagedJob = { id, type, name, status: 'pending', progress: 0, projectId: resolvedProjectId, profileId, project: project ? { id: project.id, name: project.name, projectPath: project.projectPath, orientation: project.orientation, creatorExecutable: project.creatorExecutable } : undefined, action: metadata.action ?? type, sourceUrl: metadata.sourceUrl ?? managedJobSourceUrl(project, profileId, type), startedAt: new Date().toISOString(), tasks: tasks.map((task, index) => ({ id: `${id}:${index}`, name: task, status: 'pending', progress: 0 })), logs: [], errorLogs: [] };
    upsertManagedJob(job); return job;
}

function updateManagedJob(id: string, changes: Partial<ManagedJob>): void {
    const job = readManagedJobs().find((candidate) => candidate.id === id); if (!job) return;
    Object.assign(job, changes);
    if (changes.status && ['success', 'failed', 'canceled'].includes(changes.status)) {
        job.finishedAt ??= new Date().toISOString(); job.durationMs = new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime();
        if (changes.status === 'success') for (const task of job.tasks) { task.status = 'success'; task.progress = 100; task.startedAt ??= job.startedAt; task.finishedAt ??= job.finishedAt; task.durationMs ??= new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime(); }
        else { const task = job.tasks.find((candidate) => candidate.status === 'running') ?? job.tasks.find((candidate) => candidate.status === 'pending'); if (task) { task.status = changes.status; task.finishedAt = job.finishedAt; task.durationMs = new Date(task.finishedAt).getTime() - new Date(task.startedAt ?? job.startedAt).getTime(); task.error = changes.status === 'failed' ? job.errorLogs.join('\n') : undefined; } }
    }
    upsertManagedJob(job);
    dashboardUpdater?.resumeDeferredInstall();
}

function updateManagedTask(jobId: string, index: number, status: BuildJobStatus, progress: number, error?: string): void {
    const job = readManagedJobs().find((candidate) => candidate.id === jobId); const task = job?.tasks[index]; if (!job || !task) return;
    task.status = status; task.progress = progress; if (status === 'running') task.startedAt ??= new Date().toISOString();
    if (['success', 'failed', 'canceled'].includes(status)) { task.finishedAt ??= new Date().toISOString(); task.durationMs = new Date(task.finishedAt).getTime() - new Date(task.startedAt ?? job.startedAt).getTime(); }
    if (error) task.error = error; upsertManagedJob(job);
}

function appendManagedLog(id: string, line: string): void {
    const job = readManagedJobs().find((candidate) => candidate.id === id); if (!job) return;
    job.logs.push(line); if (job.logs.length > 5_000) job.logs.splice(0, job.logs.length - 5_000);
    if (/\b(error|failed|failure|exception|fatal)\b/i.test(line)) { job.errorLogs.push(line); if (job.errorLogs.length > 500) job.errorLogs.splice(0, job.errorLogs.length - 500); }
    scheduleManagedJobsWrite();
}

function recordCompletedJob(type: ManagedJobType, name: string, log: string, metadata: ManagedJobCreationMetadata = {}): void {
    const id = `job-${crypto.randomUUID()}`; createManagedJob(id, type, name, undefined, undefined, ['Apply changes'], metadata); appendManagedLog(id, log); updateManagedJob(id, { status: 'success', progress: 100 });
}

async function runManagedOperation<T>(type: ManagedJobType, name: string, taskName: string, operation: (jobId: string) => T | Promise<T>, metadata: ManagedJobCreationMetadata = {}): Promise<T> {
    const id = `job-${crypto.randomUUID()}`;
    createManagedJob(id, type, name, undefined, undefined, [taskName], metadata);
    updateManagedJob(id, { status: 'running', progress: 5 });
    updateManagedTask(id, 0, 'running', 5);
    appendManagedLog(id, `[build-dashboard] ${name} started.`);
    try {
        const result = await operation(id);
        updateManagedTask(id, 0, 'success', 100);
        appendManagedLog(id, `[build-dashboard] ${name} completed.`);
        updateManagedJob(id, { status: 'success', progress: 100 });
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        appendManagedLog(id, `[build-dashboard] ${name} failed.\n${message}`);
        updateManagedTask(id, 0, 'failed', 100, message);
        updateManagedJob(id, { status: 'failed', progress: 100 });
        throw error;
    }
}

for (const interrupted of readManagedJobs().filter((job) => job.status === 'pending' || job.status === 'running')) {
    appendManagedLog(interrupted.id, '[build-dashboard] Job was interrupted when the dashboard stopped.');
    updateManagedJob(interrupted.id, { status: 'canceled' });
}

function buildRecordKey(projectId: string, profileId: string): string {
    return `${projectId}:${profileId}`;
}

function readBuildHistory(): Record<string, BuildRecord> {
    if (!fs.existsSync(BUILD_HISTORY_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(BUILD_HISTORY_FILE, 'utf-8')) as Record<string, BuildRecord>;
    } catch {
        return {};
    }
}

function writeBuildHistory(history: Record<string, BuildRecord>): void {
    fs.mkdirSync(path.dirname(BUILD_HISTORY_FILE), { recursive: true });
    fs.writeFileSync(BUILD_HISTORY_FILE, JSON.stringify(history, null, 2) + '\n', 'utf-8');
}

function projectVersion(projectPath: string): string {
    const pkg = readCocosProjectPackage(projectPath);
    const explicitVersion = pkg && (pkg as CocosProjectPackage & { version?: string }).version;
    if (explicitVersion?.trim()) return explicitVersion.trim();
    try {
        const commit = execSync('git rev-parse --short HEAD', { cwd: projectPath, encoding: 'utf-8' }).trim();
        const dirty = execSync('git status --porcelain', { cwd: projectPath, encoding: 'utf-8' }).trim();
        return `git ${commit}${dirty ? ' + changes' : ''}`;
    } catch {
        return 'Not configured';
    }
}

function updateBuildRecord(job: BuildJob, changes: Partial<BuildRecord>): void {
    const resolved = findProjectAndProfile(job.projectId, job.profileId);
    const history = readBuildHistory();
    const key = buildRecordKey(job.projectId, job.profileId);
    const previous = history[key];
    history[key] = {
        ...previous,
        projectId: job.projectId,
        profileId: job.profileId,
        status: job.status,
        version: previous?.version ?? (resolved ? projectVersion(resolved.project.projectPath) : 'Unknown'),
        progress: previous?.progress ?? 0,
        outputExists: resolved ? fs.existsSync(resolved.buildOutputDir) : false,
        ...changes,
    };
    writeBuildHistory(history);
}

function updateDeploymentRecord(projectId: string, profileId: string, changes: Partial<BuildRecord>): void {
    const history = readBuildHistory();
    const key = buildRecordKey(projectId, profileId);
    const previous = history[key];
    const resolved = findProjectAndProfile(projectId, profileId);
    history[key] = {
        ...previous, projectId, profileId,
        status: previous?.status ?? 'not-built',
        version: previous?.version ?? (resolved ? projectVersion(resolved.project.projectPath) : 'Unknown'),
        progress: previous?.progress ?? 0,
        outputExists: Boolean(resolved && fs.existsSync(resolved.buildOutputDir)),
        ...changes,
    };
    writeBuildHistory(history);
    mainWindow?.webContents.send('deployment:status', { projectId, profileId });
}

interface CocosProjectPackage {
    name?: string;
    creator?: { version?: string };
}

function readCocosProjectPackage(directory: string): CocosProjectPackage | null {
    const packageFile = path.join(directory, 'package.json');
    const legacyProjectFile = path.join(directory, 'project.json');
    let packageData: CocosProjectPackage = {};
    try {
        if (fs.existsSync(packageFile)) packageData = JSON.parse(fs.readFileSync(packageFile, 'utf-8')) as CocosProjectPackage;
        if (typeof packageData.creator?.version === 'string' && packageData.creator.version.trim()) return packageData;
        if (!fs.existsSync(legacyProjectFile)) return null;
        const legacy = JSON.parse(fs.readFileSync(legacyProjectFile, 'utf-8')) as { engine?: string; version?: string };
        if (legacy.engine !== 'cocos-creator-js' || typeof legacy.version !== 'string' || !legacy.version.trim()) return null;
        return { name: packageData.name, creator: { version: legacy.version.trim() } };
    } catch { return null; }
}

function findCocosProjectFrom(startDirectory: string): { projectPath: string; pkg: CocosProjectPackage } | null {
    let current = path.resolve(startDirectory);
    while (true) {
        const pkg = readCocosProjectPackage(current);
        if (pkg) {
            return { projectPath: current, pkg };
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

function creatorExecutableCandidates(version: string): string[] {
    if (process.platform === 'darwin') {
        return [
            path.join('/Applications/Cocos/Creator', version, 'CocosCreator.app', 'Contents', 'MacOS', 'CocosCreator'),
            path.join(os.homedir(), 'Applications', 'Cocos', 'Creator', version, 'CocosCreator.app', 'Contents', 'MacOS', 'CocosCreator'),
        ];
    }
    if (process.platform === 'win32') {
        const roots = [
            process.env.ProgramFiles,
            process.env['ProgramFiles(x86)'],
            process.env.ProgramData,
            process.env.LOCALAPPDATA,
        ].filter((value): value is string => Boolean(value));
        return roots.flatMap((root) => [
            path.join(root, 'Cocos', 'Creator', version, 'CocosCreator.exe'),
            path.join(root, 'CocosDashboard', 'resources', '.editors', 'Creator', version, 'CocosCreator.exe'),
            path.join(root, 'cocos', 'editors', 'Creator', version, 'CocosCreator.exe'),
        ]);
    }
    return [
        path.join(os.homedir(), 'Cocos', 'Creator', version, 'CocosCreator'),
        path.join('/opt/Cocos/Creator', version, 'CocosCreator'),
    ];
}

function detectCurrentProject(): DetectedProject | null {
    // INIT_CWD preserves the directory where npm was invoked. process.cwd()
    // covers direct Electron launches and the common `cd tool && npm start` case.
    const startDirectories = [process.env.INIT_CWD, process.cwd()].filter(
        (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index,
    );
    for (const startDirectory of startDirectories) {
        const found = findCocosProjectFrom(startDirectory);
        if (!found) {
            continue;
        }
        const creatorVersion = found.pkg.creator!.version!.trim();
        const creatorExecutable = creatorExecutableCandidates(creatorVersion).find((candidate) => fs.existsSync(candidate)) ?? null;
        return {
            projectPath: found.projectPath,
            name: found.pkg.name?.trim() || path.basename(found.projectPath),
            creatorVersion,
            creatorExecutable,
        };
    }
    return null;
}

function inspectProjectFolder(projectPath: string): DetectedProject {
    const resolvedPath = path.resolve(projectPath);
    const packageFile = path.join(resolvedPath, 'package.json');
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
        throw new Error(`Selected path is not a directory.\nPath: ${resolvedPath}`);
    }
    let packageData: CocosProjectPackage = {};
    if (fs.existsSync(packageFile)) {
        try { packageData = JSON.parse(fs.readFileSync(packageFile, 'utf8')) as CocosProjectPackage; }
        catch (error) { throw new Error(`package.json is not valid JSON.\nPath: ${packageFile}\nCause: ${error instanceof Error ? error.message : String(error)}`); }
    }
    let creatorVersion = packageData.creator?.version?.trim() ?? '';
    if (!creatorVersion) {
        const legacyProjectFile = path.join(resolvedPath, 'project.json');
        if (!fs.existsSync(legacyProjectFile)) throw new Error(`Cocos Creator version metadata was not found.\nExpected creator.version in: ${packageFile}\nOr a Cocos Creator 2.x project file at: ${legacyProjectFile}`);
        try {
            const legacy = JSON.parse(fs.readFileSync(legacyProjectFile, 'utf8')) as { engine?: string; version?: string };
            if (legacy.engine !== 'cocos-creator-js' || !legacy.version?.trim()) throw new Error('Expected engine "cocos-creator-js" and a non-empty version.');
            creatorVersion = legacy.version.trim();
        } catch (error) { throw new Error(`Cocos Creator 2.x project.json is invalid.\nPath: ${legacyProjectFile}\nCause: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (!/^[23]\./.test(creatorVersion)) throw new Error(`Unsupported Cocos Creator version: ${creatorVersion}.\nSupported major versions: 2.x and 3.x.\nPath: ${packageFile}`);
    const assetsPath = path.join(resolvedPath, 'assets');
    if (!fs.existsSync(assetsPath) || !fs.statSync(assetsPath).isDirectory()) throw new Error(`Missing the required assets directory.\nExpected: ${assetsPath}`);
    const creatorExecutable = creatorExecutableCandidates(creatorVersion).find((candidate) => fs.existsSync(candidate)) ?? null;
    if (!creatorExecutable) {
        throw new Error(`The project structure is valid, but Cocos Creator ${creatorVersion} was not found.\nProject: ${resolvedPath}\nChecked:\n${creatorExecutableCandidates(creatorVersion).join('\n')}`);
    }
    const name = packageData.name?.trim() || path.basename(resolvedPath);
    const settingsFile = projectSettingsPath(resolvedPath);
    let profiles: BuildProfile[] = [];
    if (fs.existsSync(settingsFile)) {
        try { const settings = syncDetectedAndroidPackageName(resolvedPath, JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as ProjectSettingsFile); profiles = Array.isArray(settings.profiles) ? settings.profiles : []; }
        catch (error) { throw new Error(`Project dashboard settings are invalid.\nPath: ${settingsFile}\nCause: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return { projectPath: resolvedPath, name, creatorVersion, creatorExecutable, profiles };
}

interface ProjectSettingsFile {
    version: 1;
    id?: string;
    name?: string;
    orientation?: ProjectConfig['orientation'];
    icon?: string | null;
    profiles: BuildProfile[];
}

type LocalProjectConfig = Omit<ProjectConfig, 'profiles' | 'orientation'> & { profiles?: BuildProfile[] };
interface LocalProjectsFile {
    projects: LocalProjectConfig[];
}

function projectSettingsPath(projectPath: string): string {
    return path.join(projectPath, PROJECT_SETTINGS_FILENAME);
}

function projectToolDataPath(projectPath: string, ...segments: string[]): string {
    return path.join(projectPath, PROJECT_TOOL_DATA_DIRNAME, ...segments);
}

function ensureProjectToolDataFile(projectPath: string, relativePath: string, legacyPath?: string): string {
    const destination = projectToolDataPath(projectPath, relativePath); fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (!fs.existsSync(destination) && legacyPath && fs.existsSync(legacyPath)) fs.copyFileSync(legacyPath, destination);
    return destination;
}

function readProjectSettings(projectPath: string): ProjectSettingsFile | null {
    const file = ensureProjectToolDataFile(projectPath, 'project.json', path.join(projectPath, LEGACY_PROJECT_SETTINGS_FILENAME));
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ProjectSettingsFile;
}

function resolvedProjectIcon(projectPath: string, icon: string | undefined): string | undefined {
    if (!icon) return undefined;
    const resolved = path.resolve(projectPath, icon);
    return fs.existsSync(resolved) ? resolved : undefined;
}

function detectedFacebookInstantAppIcon(projectPath: string): string | undefined {
    const directory = projectToolDataPath(projectPath, 'fb-instant-games', 'console-assets');
    const manifestFile = path.join(directory, 'manifest.json');
    if (!fs.existsSync(manifestFile)) return undefined;
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { files?: FacebookConsoleAssetFile[] };
        const candidates = (manifest.files ?? []).filter((file) =>
            file.sourceKind === 'original'
            && (/^app\s*icon\b/i.test(file.label.trim()) || file.fileName.toLowerCase() === 'app-icon.png' || file.fileName.toLowerCase() === 'app-icon.jpg')
        );
        for (const candidate of candidates) {
            const filePath = path.join(directory, candidate.fileName);
            if (!fs.existsSync(filePath)) continue;
            const image = nativeImage.createFromPath(filePath);
            const size = image.getSize();
            if (!image.isEmpty() && size.width === 1024 && size.height === 1024) return filePath;
        }
    } catch {
        return undefined;
    }
    return undefined;
}

function creator2PackageName(projectPath: string, platform: 'android' | 'ios'): string | undefined {
    const file = path.join(projectPath, 'settings', 'builder.json');
    if (!fs.existsSync(file)) return undefined;
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        const options = data[platform] as Record<string, unknown> | undefined;
        const packageName = typeof options?.packageName === 'string' ? options.packageName.trim() : '';
        return packageName || undefined;
    } catch { return undefined; }
}

function environmentAndroidPackageName(basePackageName: string, profile: BuildProfile): string {
    const productionBase = basePackageName.replace(/\.dev$/i, '');
    return profile.debug || profile.environment === 'dev' ? `${productionBase}.dev` : productionBase;
}

function syncDetectedAndroidPackageName(projectPath: string, settings: ProjectSettingsFile): ProjectSettingsFile {
    const detected = creator2PackageName(projectPath, 'android');
    if (!detected) return settings;
    let changed = false;
    const profiles = settings.profiles.map((profile) => {
        if (profile.platform !== 'android') return profile;
        const packageName = environmentAndroidPackageName(detected, profile);
        if (profile.packageName === packageName) return profile;
        changed = true;
        return { ...profile, packageName };
    });
    if (!changed) return settings;
    const synchronized = { ...settings, profiles };
    const settingsFile = projectSettingsPath(projectPath); fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify(synchronized, null, 2) + '\n', 'utf-8');
    return synchronized;
}

function readProjectProfiles(project: LocalProjectConfig): BuildProfile[] {
    const settingsFile = projectSettingsPath(project.projectPath);
    if (fs.existsSync(settingsFile)) {
        const settings = syncDetectedAndroidPackageName(project.projectPath, readProjectSettings(project.projectPath)!);
        return Array.isArray(settings.profiles) ? settings.profiles : [];
    }
    // Compatibility with the original format, where profiles lived in the
    // machine-local projects.json. Materialize the project-owned file as soon
    // as it is read so even an empty profile list has a Git-manageable home.
    const profiles = Array.isArray(project.profiles) ? project.profiles : [];
    const settings = syncDetectedAndroidPackageName(project.projectPath, { version: 1, id: project.id, name: project.name, orientation: 'landscape', profiles });
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    return settings.profiles;
}

function readProjects(): ProjectsFile {
    if (!fs.existsSync(PROJECTS_FILE)) {
        return { projects: [] };
    }
    const localData = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8')) as LocalProjectsFile;
    const result: ProjectsFile = {
        projects: localData.projects.map((project) => {
            const settings = readProjectSettings(project.projectPath);
            return {
                id: settings?.id?.trim() || project.id,
                name: settings?.name?.trim() || project.name,
                orientation: settings?.orientation === 'portrait' ? 'portrait' : 'landscape',
                iconPath: resolvedProjectIcon(project.projectPath, settings?.icon ?? undefined) ?? (settings?.icon === null ? undefined : detectedFacebookInstantAppIcon(project.projectPath)),
                projectPath: project.projectPath,
                creatorExecutable: project.creatorExecutable,
                profiles: readProjectProfiles(project),
            };
        }),
    };
    if (localData.projects.some((project) => Object.prototype.hasOwnProperty.call(project, 'profiles'))) {
        const migratedLocalData: LocalProjectsFile = {
            projects: result.projects.map(({ profiles: _profiles, iconPath: _iconPath, orientation: _orientation, ...localProject }) => localProject),
        };
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(migratedLocalData, null, 2) + '\n', 'utf-8');
    }
    return result;
}

function writeProjects(data: ProjectsFile): void {
    for (const project of data.projects) {
        const previous = readProjectSettings(project.projectPath);
        const settings: ProjectSettingsFile = {
            version: 1,
            id: project.id,
            name: project.name,
            orientation: project.orientation,
            ...(previous && Object.prototype.hasOwnProperty.call(previous, 'icon') ? { icon: previous.icon } : {}),
            profiles: project.profiles,
        };
        const settingsFile = projectSettingsPath(project.projectPath); fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    }
    const localData: LocalProjectsFile = {
        projects: data.projects.map(({ profiles: _profiles, iconPath: _iconPath, orientation: _orientation, ...localProject }) => localProject),
    };
    fs.mkdirSync(path.dirname(PROJECTS_FILE), { recursive: true });
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(localData, null, 2) + '\n', 'utf-8');
}

function readFakePlayers(): FakePlayersLibrary {
    try {
        const stored = JSON.parse(fs.readFileSync(FAKE_PLAYERS_FILE, 'utf8')) as FakePlayersLibrary;
        const obsolete = new Set((stored.avatars ?? []).filter((avatar) => avatar.generated && !avatar.kind).map((avatar) => avatar.id));
        for (const avatar of stored.avatars ?? []) if (obsolete.has(avatar.id)) { try { fs.unlinkSync(path.join(FAKE_PLAYER_AVATARS_DIRECTORY, avatar.fileName)); } catch { /* Already absent. */ } }
        const avatars = Array.isArray(stored.avatars) ? stored.avatars.filter((avatar) => !obsolete.has(avatar.id)).map((avatar) => ({ ...avatar, previewUrl: pathToFileURL(path.join(FAKE_PLAYER_AVATARS_DIRECTORY, avatar.fileName)).toString() })) : [];
        const seededById = new Map(seededFakePlayers().map((item) => [item.id, item]));
        let aliasesMigrated = false;
        const names = Array.isArray(stored.names) ? stored.names.map((item) => {
            const existingAliases = Array.isArray(item.aliases) ? item.aliases : [];
            const canonical = seededById.get(item.id);
            const aliases = canonical ? [...new Set([...existingAliases, ...canonical.aliases])] : existingAliases;
            if (aliases.length !== existingAliases.length) aliasesMigrated = true;
            return { ...item, age: Number(item.age) || 21, aliases, avatarId: item.avatarId && !obsolete.has(item.avatarId) ? item.avatarId : undefined };
        }) : [];
        if (obsolete.size || aliasesMigrated) fs.writeFileSync(FAKE_PLAYERS_FILE, JSON.stringify({ avatars: avatars.map(({ previewUrl: _previewUrl, ...avatar }) => avatar), names }, null, 2));
        return { avatars, names };
    } catch {
        return { avatars: [], names: [] };
    }
}

function writeFakePlayers(data: FakePlayersLibrary): void {
    fs.mkdirSync(FAKE_PLAYER_AVATARS_DIRECTORY, { recursive: true });
    const persisted = { ...data, avatars: data.avatars.map(({ previewUrl: _previewUrl, ...avatar }) => avatar) };
    fs.writeFileSync(FAKE_PLAYERS_FILE, JSON.stringify(persisted, null, 2));
}

function findProjectAndProfile(projectId: string, profileId: string): { project: ProjectConfig; profile: BuildProfile; buildOutputDir: string; profileArgs: string } | null {
    const { projects } = readProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
        return null;
    }
    const profile = project.profiles.find((p) => p.id === profileId);
    if (!profile) {
        return null;
    }
    const buildOutputDir = path.resolve(project.projectPath, profile.buildPath);
    const buildRootDir = path.dirname(buildOutputDir);
    const outputName = path.basename(buildOutputDir);
    const isCreator2 = creatorInfo(project.projectPath).family === '2.x';
    // Creator 2.x ignores outputName and always appends the platform name to
    // buildPath. Give every environment its own root, then normalize the
    // nested output after the process exits.
    const creatorBuildPath = isCreator2 ? buildOutputDir : buildRootDir;
    const profileArgs =
        `platform=${profile.platform};debug=${profile.debug};buildPath=${creatorBuildPath};outputName=${outputName}`;
    return { project, profile, buildOutputDir, profileArgs };
}

function cleanBuildOutput(project: ProjectConfig, buildOutputDir: string): void {
    const allowedRoot = path.resolve(project.projectPath, 'build');
    const relative = path.relative(allowedRoot, buildOutputDir);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Refusing to clean unsafe build output path: ${buildOutputDir}`);
    }
    fs.rmSync(buildOutputDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(buildOutputDir), { recursive: true });
}

function listFilesRecursiveAbsolute(directory: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFilesRecursiveAbsolute(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

function restoreFacebookTemplateAssets(projectPath: string, buildOutputDir: string): string[] {
    const indexPath = path.join(buildOutputDir, 'index.html');
    if (!fs.existsSync(indexPath)) return [];

    const restored: string[] = [];
    const html = fs.readFileSync(indexPath, 'utf-8').replace(/<!--[\s\S]*?-->/g, '');
    const templateRoots = [
        path.join(projectPath, 'build-templates', 'fb-instant-games'),
        path.join(projectPath, 'build-templates'),
    ];
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
        const reference = match[1].split(/[?#]/)[0];
        if (!reference || /^(?:[a-z]+:|\/\/|#|data:)/i.test(reference)) continue;

        const destination = path.resolve(buildOutputDir, reference);
        const relativeDestination = path.relative(buildOutputDir, destination);
        if (relativeDestination.startsWith('..') || path.isAbsolute(relativeDestination) || fs.existsSync(destination)) continue;

        const source = templateRoots
            .map((root) => path.resolve(root, reference))
            .find((candidate, index) => {
                const relativeSource = path.relative(templateRoots[index], candidate);
                return !relativeSource.startsWith('..') && !path.isAbsolute(relativeSource) && fs.statSync(candidate, { throwIfNoEntry: false })?.isFile();
            });
        if (!source) continue;

        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
        restored.push(reference);
    }
    return restored;
}

function validateFacebookBuild(buildOutputDir: string, creatorFamily: '2.x' | '3.x'): void {
    const required = creatorFamily === '2.x'
        ? ['index.html', 'main.js', 'src/settings.js', 'fbapp-config.json']
        : ['index.html', 'index.js', 'application.js', 'src/settings.json', 'fbapp-config.json'];
    const errors: string[] = [];
    for (const relativePath of required) {
        if (!fs.existsSync(path.join(buildOutputDir, ...relativePath.split('/')))) {
            errors.push(`missing required file: ${relativePath}`);
        }
    }
    if (!fs.existsSync(buildOutputDir)) {
        throw new Error(`Facebook build output was not created: ${buildOutputDir}`);
    }

    const files = listFilesRecursiveAbsolute(buildOutputDir);
    const forbiddenNames = new Set(['key.pem', 'cert.pem', '.DS_Store']);
    for (const file of files) {
        if (creatorFamily === '3.x' && forbiddenNames.has(path.basename(file))) {
            errors.push(`forbidden publish file: ${path.relative(buildOutputDir, file)}`);
        }
    }

    const indexPath = path.join(buildOutputDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
        for (const match of withoutComments.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
            const reference = match[1].split(/[?#]/)[0];
            if (!reference || /^(?:[a-z]+:|\/\/|#|data:)/i.test(reference)) {
                continue;
            }
            if (!fs.existsSync(path.resolve(buildOutputDir, reference))) {
                errors.push(`index.html references missing file: ${reference}`);
            }
        }
    }

    const legacyPatterns: Array<{ label: string; pattern: RegExp }> = [
        { label: 'src/settings.js', pattern: /src\/settings\.js(?:["'?#]|$)/ },
        { label: 'cocos2d-js.js', pattern: /cocos2d-js(?:-min)?\.js/ },
        { label: 'physics.js', pattern: /physics(?:-min)?\.js/ },
        { label: 'window._CCSettings', pattern: /window\._CCSettings/ },
    ];
    const entryFiles = files.filter((candidate) =>
        ['index.html', 'index.js', 'main.js', 'application.js'].includes(path.basename(candidate)),
    );
    if (creatorFamily === '2.x') {
        const incompatibleBundle = files.find((file) => file.endsWith('.js') && /require\(["']cc["']\)/.test(fs.readFileSync(file, 'utf-8')));
        if (incompatibleBundle) {
            errors.push(`Cocos 2.x bundle contains Cocos 3.x module imports in ${path.relative(buildOutputDir, incompatibleBundle)}; rebuild after removing the incompatible shared codebase`);
        }
    }
    for (const file of creatorFamily === '2.x' ? [] : entryFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const legacy of legacyPatterns) {
            if (legacy.pattern.test(content)) {
                errors.push(`legacy Cocos bootstrap reference "${legacy.label}" in ${path.relative(buildOutputDir, file)}`);
            }
        }
    }

    for (const jsonPath of ['fbapp-config.json', 'src/settings.json']) {
        const fullPath = path.join(buildOutputDir, ...jsonPath.split('/'));
        if (fs.existsSync(fullPath)) {
            try {
                JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            } catch (error) {
                errors.push(`invalid JSON in ${jsonPath}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    const archives = files.filter((file) => file.toLowerCase().endsWith('.zip'));
    if (archives.length === 0) {
        errors.push('missing Facebook upload ZIP');
    }
    for (const archivePath of archives) {
        const entries = new AdmZip(archivePath).getEntries();
        const fileEntries = entries.filter((entry) => !entry.isDirectory);
        if (fileEntries.length > 500) {
            errors.push(`${path.basename(archivePath)} contains ${fileEntries.length} files (Facebook limit: 500)`);
        }
        for (const entry of fileEntries) {
            if (forbiddenNames.has(path.posix.basename(entry.entryName))) {
                errors.push(`${path.basename(archivePath)} contains forbidden file: ${entry.entryName}`);
            }
        }
        for (const relativePath of required) {
            if (!fileEntries.some((entry) => entry.entryName === relativePath || entry.entryName.endsWith(`/${relativePath}`))) {
                errors.push(`${path.basename(archivePath)} is missing: ${relativePath}`);
            }
        }
    }

    if (errors.length > 0) {
        throw new Error(`Facebook build validation failed:\n- ${errors.join('\n- ')}`);
    }
}

function validateBuild(profile: BuildProfile, buildOutputDir: string, creatorFamily: '2.x' | '3.x' = '3.x'): void {
    if (profile.platform === 'fb-instant-games') {
        validateFacebookBuild(buildOutputDir, creatorFamily);
    }
}

/**
 * Cocos Creator's CLI --build string can't set nested per-platform options
 * (verified: "packages.android.packageName=..." is parsed as a literal flat
 * key, not merged into the platform's saved build options). The real place
 * the builder reads packageName from is the project's own saved profile at
 * profiles/v2/packages/<platform>.json -> builder.options.<platform>.packageName
 * (confirmed by diffing that file before/after a real Editor build). We
 * merge into it (not overwrite) so any other settings saved via the Editor
 * (keystore path, NDK path, etc.) are preserved.
 */
function ensurePackageNameConfigured(project: ProjectConfig, profile: BuildProfile): void {
    if (!profile.packageName) {
        return;
    }
    const creator2BuilderPath = path.join(project.projectPath, 'settings', 'builder.json');
    if (fs.existsSync(creator2BuilderPath)) {
        const detectedBase = profile.platform === 'android' ? creator2PackageName(project.projectPath, 'android') : undefined;
        if (detectedBase && profile.packageName === environmentAndroidPackageName(detectedBase, profile) && (profile.debug || profile.environment === 'dev')) return;
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(fs.readFileSync(creator2BuilderPath, 'utf-8')) as Record<string, unknown>; } catch { /* create the missing Android section below */ }
        const platformOptions = (data[profile.platform] ??= {}) as Record<string, unknown>;
        platformOptions.packageName = profile.packageName;
        fs.writeFileSync(creator2BuilderPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        return;
    }
    const profileConfigPath = path.join(project.projectPath, 'profiles', 'v2', 'packages', `${profile.platform}.json`);
    let data: Record<string, unknown> = {};
    if (fs.existsSync(profileConfigPath)) {
        try {
            data = JSON.parse(fs.readFileSync(profileConfigPath, 'utf-8'));
        } catch {
            data = {};
        }
    }
    const builder = (data.builder ??= {}) as Record<string, unknown>;
    const options = (builder.options ??= {}) as Record<string, unknown>;
    const platformOptions = (options[profile.platform] ??= {}) as Record<string, unknown>;
    platformOptions.packageName = profile.packageName;

    fs.mkdirSync(path.dirname(profileConfigPath), { recursive: true });
    fs.writeFileSync(profileConfigPath, JSON.stringify(data, null, 2), 'utf-8');
}

function applyGeneratedAndroidApplicationId(profile: BuildProfile, buildOutputDir: string): boolean {
    if (profile.platform !== 'android' || !profile.packageName) return false;
    const gradleRoot = androidGradleRoot(buildOutputDir);
    if (!gradleRoot) return false;
    const buildFile = path.join(gradleRoot, 'app', 'build.gradle');
    if (!fs.existsSync(buildFile)) return false;
    const source = fs.readFileSync(buildFile, 'utf-8');
    const updated = source
        .replace(/(^\s*applicationId\s+)["'][^"']+["']/m, `$1"${profile.packageName}"`)
        .replace(/(^\s*applicationId\s*=\s*)["'][^"']+["']/m, `$1"${profile.packageName}"`);
    if (updated === source) return false;
    fs.writeFileSync(buildFile, updated, 'utf-8');
    return true;
}

function xmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function applyGeneratedAndroidBranding(project: ProjectConfig, profile: BuildProfile, buildOutputDir: string): string[] {
    if (profile.platform !== 'android') return [];
    const gradleRoot = androidGradleRoot(buildOutputDir);
    if (!gradleRoot) return [];
    const changes: string[] = [];
    const displayName = profile.debug || profile.environment === 'dev' ? `${project.name} (Dev)` : project.name;
    const resourceRoots = [path.join(gradleRoot, 'res'), path.join(gradleRoot, 'app', 'src', 'main', 'res')].filter(fs.existsSync);
    for (const resourceRoot of resourceRoots) {
        const stringsFile = path.join(resourceRoot, 'values', 'strings.xml');
        if (fs.existsSync(stringsFile)) {
            const source = fs.readFileSync(stringsFile, 'utf-8');
            const updated = source.replace(/(<string\s+name=["']app_name["'][^>]*>)[\s\S]*?(<\/string>)/, `$1${xmlText(displayName)}$2`);
            if (updated !== source) {
                fs.writeFileSync(stringsFile, updated, 'utf-8');
                if (!changes.includes('name')) changes.push('name');
            }
        }
        if (project.iconPath && fs.existsSync(project.iconPath)) {
            const sourceIcon = nativeImage.createFromPath(project.iconPath);
            if (!sourceIcon.isEmpty()) {
                const sizes: Record<string, number> = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
                for (const [density, size] of Object.entries(sizes)) {
                    const directory = path.join(resourceRoot, `mipmap-${density}`);
                    if (!fs.existsSync(directory)) continue;
                    fs.writeFileSync(path.join(directory, 'ic_launcher.png'), sourceIcon.resize({ width: size, height: size, quality: 'best' }).toPNG());
                    if (!changes.includes('icon')) changes.push('icon');
                }
            }
        }
    }
    return changes;
}

function applyGeneratedIosBundleIdentifier(profile: BuildProfile, buildOutputDir: string): boolean {
    if (profile.platform !== 'ios' || !profile.packageName) return false;
    const projectFile = findFirst(buildOutputDir, '.xcodeproj');
    if (!projectFile) return false;
    const pbxProject = path.join(projectFile, 'project.pbxproj');
    if (!fs.existsSync(pbxProject)) return false;
    const source = fs.readFileSync(pbxProject, 'utf-8');
    const updated = source.replace(
        /(PRODUCT_BUNDLE_IDENTIFIER\s*=\s*)(?:"[^"]*"|[^;\n]+)(;)/g,
        `$1${profile.packageName}$2`,
    );
    if (updated === source) return false;
    fs.writeFileSync(pbxProject, updated, 'utf-8');
    return true;
}

function androidProfilePath(projectPath: string): string {
    return path.join(projectPath, 'profiles', 'v2', 'packages', 'android.json');
}

function readAndroidOptions(projectPath: string): Record<string, unknown> {
    const file = androidProfilePath(projectPath);
    let configured: Record<string, unknown> = {};
    if (fs.existsSync(file)) {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
            const builder = data.builder as Record<string, unknown> | undefined;
            const options = builder?.options as Record<string, unknown> | undefined;
            configured = (options?.android as Record<string, unknown> | undefined) ?? {};
        } catch { /* use Creator 2 settings or detected defaults below */ }
    }
    const creator2Builder = path.join(projectPath, 'settings', 'builder.json');
    if (fs.existsSync(creator2Builder)) {
        try {
            const data = JSON.parse(fs.readFileSync(creator2Builder, 'utf-8')) as Record<string, unknown>;
            configured = { ...configured, ...((data.android as Record<string, unknown> | undefined) ?? {}) };
        } catch { /* retain other detected settings */ }
    }
    const detectedPackageName = creator2PackageName(projectPath, 'android');
    return detectedPackageName ? { ...configured, packageName: detectedPackageName } : configured;
}

function validSdk(candidate: string): boolean {
    return Boolean(candidate && fs.existsSync(path.join(candidate, 'platforms')) && fs.existsSync(path.join(candidate, 'build-tools')));
}

function validNdk(candidate: string): boolean {
    return Boolean(candidate && fs.existsSync(path.join(candidate, 'source.properties')));
}

function jdkMajor(candidate: string): number | null {
    if (!candidate) return null;
    try {
        const release = fs.readFileSync(path.join(candidate, 'release'), 'utf-8');
        const match = release.match(/JAVA_VERSION="(\d+)/);
        return match ? Number(match[1]) : null;
    } catch {
        return null;
    }
}

function requiredAndroidJdkMajor(projectPath: string): 11 | 17 {
    const info = creatorInfo(projectPath);
    if (info.family === '2.x') return 11;
    const [major = 3, minor = 0] = info.version.split('.').map((part) => Number.parseInt(part, 10));
    // Creator 3.7 moved its Android toolchain to Gradle 8/AGP 8 and JDK 17.
    // Earlier Creator 3 releases still use the JDK 11 generation of Gradle.
    return major > 3 || (major === 3 && minor >= 7) ? 17 : 11;
}

function firstValid(candidates: string[], validate: (candidate: string) => boolean): string {
    return candidates.find((candidate) => validate(candidate)) ?? '';
}

function executable(candidates: string[]): string {
    return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? '';
}

function detectAndroidToolchain(projectPath: string): AndroidToolchainStatus {
    const requiredJdkMajor = requiredAndroidJdkMajor(projectPath);
    const options = readAndroidOptions(projectPath);
    const configured: AndroidToolchainPaths = {
        sdkPath: typeof options.sdkPath === 'string' ? options.sdkPath : '',
        ndkPath: typeof options.ndkPath === 'string' ? options.ndkPath : '',
        javaHome: typeof options.javaHome === 'string' ? options.javaHome : '',
    };
    const sdkPath = firstValid([
        configured.sdkPath,
        process.env.ANDROID_SDK_ROOT ?? '', process.env.ANDROID_HOME ?? '',
        path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    ], validSdk);
    const ndkRoots = [configured.ndkPath, process.env.NDK_ROOT ?? '', sdkPath ? path.join(sdkPath, 'ndk-bundle') : ''];
    if (sdkPath) {
        const ndkParent = path.join(sdkPath, 'ndk');
        if (fs.existsSync(ndkParent)) {
            ndkRoots.push(...fs.readdirSync(ndkParent).sort().reverse().map((name) => path.join(ndkParent, name)));
        }
    }
    const javaCandidates = [configured.javaHome, process.env.JAVA_HOME ?? ''];
    javaCandidates.push(
        `/opt/homebrew/opt/openjdk@${requiredJdkMajor}/libexec/openjdk.jdk/Contents/Home`,
        `/usr/local/opt/openjdk@${requiredJdkMajor}/libexec/openjdk.jdk/Contents/Home`,
        '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
        '/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
    );
    for (const root of [path.join(os.homedir(), 'Library', 'Java', 'JavaVirtualMachines'), '/Library/Java/JavaVirtualMachines']) {
        if (fs.existsSync(root)) javaCandidates.push(...fs.readdirSync(root).map((name) => path.join(root, name, 'Contents', 'Home')));
    }
    const ndkPath = firstValid(ndkRoots, validNdk);
    const javaHome = javaCandidates.find((candidate) => jdkMajor(candidate) === requiredJdkMajor) ?? '';
    const issues: string[] = [];
    if (!validSdk(configured.sdkPath)) issues.push('Android SDK is not configured in this project’s Cocos settings.');
    if (!validNdk(configured.ndkPath)) issues.push('Android NDK is not configured in this project’s Cocos settings.');
    if (jdkMajor(configured.javaHome) !== requiredJdkMajor) issues.push(`JDK ${requiredJdkMajor} is not configured in this project’s Cocos settings.`);
    return {
        requiredJdkMajor,
        configured,
        detected: { sdkPath, ndkPath, javaHome },
        ready: validSdk(configured.sdkPath) && validNdk(configured.ndkPath) && jdkMajor(configured.javaHome) === requiredJdkMajor,
        canApplyDetected: validSdk(sdkPath) && validNdk(ndkPath) && jdkMajor(javaHome) === requiredJdkMajor,
        issues,
    };
}

function runInstaller(command: string, args: string[], input = '', taskId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const task = taskId ? androidToolchainTasks.get(taskId) : undefined;
        if (task?.canceled) { reject(new Error('Canceled.')); return; }
        const child = spawn(command, args, { shell: false, detached: true, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}` } });
        if (task) task.child = child;
        let output = '';
        child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString('utf-8'); });
        child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString('utf-8'); });
        child.on('error', reject);
        child.on('close', (code) => {
            if (task) task.child = null;
            if (task?.canceled) reject(new Error('Canceled.'));
            else if (code === 0) resolve();
            else reject(new Error(`${path.basename(command)} exited with code ${code}.\n${output.trim()}`));
        });
        if (input) child.stdin.end(input); else child.stdin.end();
    });
}

async function ensureModernSdkManager(taskId?: string): Promise<string> {
    const existing = executable([
        '/opt/homebrew/bin/sdkmanager',
        '/usr/local/bin/sdkmanager',
        path.join(os.homedir(), 'Library', 'Android', 'sdk', 'cmdline-tools', 'latest', 'bin', 'sdkmanager'),
    ]);
    if (existing) return existing;
    const brew = executable(['/opt/homebrew/bin/brew', '/usr/local/bin/brew']);
    if (!brew) throw new Error('Homebrew is required to install Android command-line tools automatically. Install Homebrew or configure the SDK manually in Cocos Creator.');
    await runInstaller(brew, ['install', '--cask', 'android-commandlinetools'], '', taskId);
    const installed = executable(['/opt/homebrew/bin/sdkmanager', '/usr/local/bin/sdkmanager']);
    if (!installed) throw new Error('Android command-line tools were installed, but sdkmanager could not be found.');
    return installed;
}

async function resolveAndroidToolchain(projectPath: string): Promise<AndroidToolchainStatus> {
    let status = detectAndroidToolchain(projectPath);
    const sdkRoot = status.detected.sdkPath || path.join(os.homedir(), 'Library', 'Android', 'sdk');
    if (!status.detected.javaHome) {
        const brew = executable(['/opt/homebrew/bin/brew', '/usr/local/bin/brew']);
        if (!brew) throw new Error(`Homebrew is required to install JDK ${status.requiredJdkMajor} automatically. Install it manually, then refresh Setup.`);
        await runInstaller(brew, ['install', `openjdk@${status.requiredJdkMajor}`]);
    }
    status = detectAndroidToolchain(projectPath);
    if (!status.detected.sdkPath || !status.detected.ndkPath) {
        const sdkManager = await ensureModernSdkManager();
        await runInstaller(sdkManager, [
            `--sdk_root=${sdkRoot}`,
            'platform-tools',
            'platforms;android-35',
            'build-tools;35.0.0',
            'ndk;23.2.8568313',
        ], 'y\n'.repeat(100));
    }
    status = detectAndroidToolchain(projectPath);
    if (!status.canApplyDetected) throw new Error(`Android tooling installation finished, but setup is still incomplete: ${status.issues.join(' ')}`);
    return applyDetectedAndroidToolchain(projectPath);
}

function applyDetectedAndroidToolchain(projectPath: string): AndroidToolchainStatus {
    const status = detectAndroidToolchain(projectPath);
    if (!status.canApplyDetected) throw new Error(`A complete Android SDK, NDK, and JDK ${status.requiredJdkMajor} installation could not be detected.`);
    saveAndroidToolchainComponent(projectPath, 'sdk', status.detected.sdkPath);
    saveAndroidToolchainComponent(projectPath, 'ndk', status.detected.ndkPath);
    saveAndroidToolchainComponent(projectPath, 'jdk', status.detected.javaHome);
    return detectAndroidToolchain(projectPath);
}

function saveAndroidToolchainComponent(projectPath: string, component: AndroidToolchainComponent, value: string): void {
    const creator2 = creatorInfo(projectPath).family === '2.x';
    const file = creator2 ? path.join(projectPath, 'settings', 'builder.json') : androidProfilePath(projectPath);
    let data: Record<string, unknown> = {};
    if (fs.existsSync(file)) {
        try { data = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>; } catch { data = {}; }
    }
    let android: Record<string, unknown>;
    if (creator2) {
        android = (data.android ??= {}) as Record<string, unknown>;
    } else {
        const builder = (data.builder ??= {}) as Record<string, unknown>;
        const options = (builder.options ??= {}) as Record<string, unknown>;
        android = (options.android ??= {}) as Record<string, unknown>;
    }
    if (component === 'sdk') android.sdkPath = value;
    if (component === 'ndk') android.ndkPath = value;
    if (component === 'jdk') {
        android.javaHome = value;
        android.javaPath = path.join(value, 'bin', 'java');
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function setAndroidToolchainComponent(projectPath: string, component: AndroidToolchainComponent, selectedPath: string): AndroidToolchainStatus {
    const requiredJdkMajor = requiredAndroidJdkMajor(projectPath);
    const valid = component === 'sdk' ? validSdk(selectedPath) : component === 'ndk' ? validNdk(selectedPath) : jdkMajor(selectedPath) === requiredJdkMajor;
    if (!valid) {
        const expectation = component === 'sdk' ? 'an Android SDK folder containing platforms and build-tools' : component === 'ndk' ? 'an Android NDK folder containing source.properties' : `a JDK ${requiredJdkMajor} home folder`;
        throw new Error(`The selected folder is not ${expectation}: ${selectedPath}`);
    }
    saveAndroidToolchainComponent(projectPath, component, selectedPath);
    return detectAndroidToolchain(projectPath);
}

async function resolveAndroidToolchainComponent(projectPath: string, component: AndroidToolchainComponent, taskId: string): Promise<AndroidToolchainStatus> {
    let status = detectAndroidToolchain(projectPath);
    if (component === 'jdk' && !status.detected.javaHome) {
        const brew = executable(['/opt/homebrew/bin/brew', '/usr/local/bin/brew']);
        if (!brew) throw new Error(`Homebrew is required to install JDK ${status.requiredJdkMajor} automatically.`);
        await runInstaller(brew, ['install', `openjdk@${status.requiredJdkMajor}`], '', taskId);
    }
    if (component === 'sdk' && !status.detected.sdkPath) {
        const sdkManager = await ensureModernSdkManager(taskId);
        const sdkRoot = path.join(os.homedir(), 'Library', 'Android', 'sdk');
        await runInstaller(sdkManager, [`--sdk_root=${sdkRoot}`, 'platform-tools', 'platforms;android-35', 'build-tools;35.0.0'], 'y\n'.repeat(100), taskId);
    }
    if (component === 'ndk' && !status.detected.ndkPath) {
        const sdkManager = await ensureModernSdkManager(taskId);
        const sdkRoot = status.detected.sdkPath || path.join(os.homedir(), 'Library', 'Android', 'sdk');
        await runInstaller(sdkManager, [`--sdk_root=${sdkRoot}`, 'ndk;23.2.8568313'], 'y\n'.repeat(100), taskId);
    }
    status = detectAndroidToolchain(projectPath);
    const value = component === 'sdk' ? status.detected.sdkPath : component === 'ndk' ? status.detected.ndkPath : status.detected.javaHome;
    if (!value) throw new Error(`${component.toUpperCase()} installation completed, but a valid path could not be detected.`);
    saveAndroidToolchainComponent(projectPath, component, value);
    return detectAndroidToolchain(projectPath);
}

/**
 * Cocos Creator enforces a single instance per project. If the Editor GUI is
 * already open for a project, a second headless `--build` invocation on that
 * same project exits almost instantly with no output and no normal exit code
 * (confirmed by reproducing it directly) — the job just shows as "failed"
 * with no explanation. Detect that case up front so we can tell the user
 * exactly what's wrong instead of a bare "failed".
 *
 * Distinguishes the Editor GUI from our own past headless builds by checking
 * for a `--project <path>` (Creator 3.x) or `--path <path>` (Creator 2.x)
 * process that does NOT also have `--build` in its
 * argv, and returns its PID so we can offer to close it. Uses `ps` on
 * macOS/Linux; on Windows, `tasklist` doesn't expose command-line args, so we
 * shell out to PowerShell's CIM process query instead (via a temp .ps1 file
 * to avoid quoting hell). If neither is available this silently skips the
 * check rather than blocking the build.
 */
function findEditorPidForProject(projectPath: string): number | null {
    try {
        if (process.platform === 'win32') {
            return findEditorPidWindows(projectPath);
        }
        const output = execSync('ps -axo pid,command', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        for (const line of output.split('\n')) {
            const hasProjectPath = line.includes(`--project ${projectPath}`) || line.includes(`--path ${projectPath}`);
            if (line.includes('CocosCreator') && hasProjectPath && !line.includes('--build')) {
                const pid = parseInt(line.trim().split(/\s+/)[0], 10);
                if (!Number.isNaN(pid)) {
                    return pid;
                }
            }
        }
    } catch {
        // ps not available or failed — skip the check rather than block the build
    }
    return null;
}

function findEditorPidWindows(projectPath: string): number | null {
    const scriptPath = path.join(os.tmpdir(), `cocos-build-dashboard-find-editor-${Date.now()}.ps1`);
    fs.writeFileSync(
        scriptPath,
        "Get-CimInstance Win32_Process -Filter \"Name='CocosCreator.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
        'utf-8',
    );
    try {
        const output = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
            encoding: 'utf-8',
        }).trim();
        if (!output) {
            return null;
        }
        const parsed: unknown = JSON.parse(output);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const proc of list as { ProcessId?: number; CommandLine?: string }[]) {
            const cmd = proc.CommandLine ?? '';
            const hasProjectPath = cmd.includes(`--project ${projectPath}`) || cmd.includes(`--path ${projectPath}`);
            if (hasProjectPath && !cmd.includes('--build') && proc.ProcessId) {
                return proc.ProcessId;
            }
        }
    } finally {
        fs.unlinkSync(scriptPath);
    }
    return null;
}

function editorBridgePort(projectPath: string): number {
    let hash = 2166136261;
    for (let i = 0; i < projectPath.length; i += 1) {
        hash ^= projectPath.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return 47800 + ((hash >>> 0) % 1000);
}

interface EditorBridgeBuildResult {
    exitCode?: number;
    error?: string;
}

function creatorEditorLogPath(): string | null {
    if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Logs', 'CocosCreator', 'CocosCreator.log');
    if (process.platform === 'win32') return path.join(process.env.APPDATA ?? '', 'CocosCreator', 'logs', 'CocosCreator.log');
    return null;
}

function creatorBuildErrorSince(offset: number): string | null {
    const logPath = creatorEditorLogPath();
    if (!logPath || !fs.existsSync(logPath)) return null;
    try {
        const content = fs.readFileSync(logPath).subarray(offset).toString('utf-8');
        const matches = content.split(/\r?\n/).filter((line) => /Build Failed:|\berror:\s/i.test(line));
        return matches.length > 0 ? matches.slice(-4).join('\n') : null;
    } catch {
        return null;
    }
}

function requestEditorBuild(project: ProjectConfig, profile: BuildProfile, buildOutputDir: string): Promise<EditorBridgeBuildResult> {
    const creatorFamily = creatorInfo(project.projectPath).family;
    const savedPlatformOptions = profile.platform === 'android' ? readAndroidOptions(project.projectPath) : {};
    const androidToolchain = profile.platform === 'android'
        ? {
            ...detectAndroidToolchain(project.projectPath).configured,
            pythonPath: fs.existsSync(path.join(os.homedir(), '.cocos-creator', 'python2', 'bin', 'python'))
                ? path.join(os.homedir(), '.cocos-creator', 'python2', 'bin', 'python')
                : '',
        }
        : undefined;
    const packages = Object.keys(savedPlatformOptions).length || profile.packageName
        ? { [profile.platform]: { ...savedPlatformOptions, ...(profile.packageName ? { packageName: profile.packageName } : {}) } }
        : {};
    const payload = JSON.stringify({
        platform: profile.platform,
        debug: profile.debug,
        // Creator 2.x always appends the platform name to the supplied build
        // path. Point it at the environment directory, then normalize the
        // resulting <env>/<platform> folder after completion. Creator 3.x uses
        // taskName/outputName under the shared platform directory.
        buildPath: creatorFamily === '2.x' ? buildOutputDir : path.dirname(buildOutputDir),
        environment: profile.environment ?? profile.id,
        taskName: path.basename(buildOutputDir),
        outputName: path.basename(buildOutputDir),
        packages,
        ...(androidToolchain ? { androidToolchain } : {}),
    });

    return new Promise((resolve, reject) => {
        const request = http.request({
            hostname: '127.0.0.1',
            port: editorBridgePort(project.projectPath),
            path: '/build',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => { body += chunk; });
            response.on('end', () => {
                try {
                    const result = JSON.parse(body) as EditorBridgeBuildResult;
                    response.statusCode === 200 ? resolve(result) : reject(new Error(result.error ?? `HTTP ${response.statusCode}`));
                } catch {
                    reject(new Error(`Invalid response from Cocos Editor bridge: ${body}`));
                }
            });
        });
        request.on('error', reject);
        request.write(payload);
        request.end();
    });
}

function isEditorBridgeRunning(projectPath: string): Promise<boolean> {
    return new Promise((resolve) => {
        const request = http.get({
            hostname: '127.0.0.1',
            port: editorBridgePort(projectPath),
            path: '/health',
            timeout: 800,
        }, (response) => {
            response.resume();
            resolve(response.statusCode === 200);
        });
        request.on('timeout', () => request.destroy());
        request.on('error', () => resolve(false));
    });
}

async function getBridgeStatus(projectPath: string): Promise<BridgeStatus> {
    return {
        supported: true,
        installed: fs.existsSync(path.join(editorBridgeDestination(projectPath), 'package.json')),
        running: await isEditorBridgeRunning(projectPath),
        editorOpen: findEditorPidForProject(projectPath) !== null,
    };
}

/**
 * Closes the Editor gracefully instead of force-killing it, so if there are
 * unsaved changes the app gets a chance to show its own save-prompt rather
 * than silently discarding work.
 *
 * - Windows: `taskkill /PID <pid>` without `/F` sends a WM_CLOSE to the
 *   app's window(s) — the same signal a normal window-close click sends.
 * - macOS: there's no PID-targeted "close" equivalent, so we focus the
 *   process and send Cmd+Q like the user would — but only after confirming
 *   it actually became frontmost, since a global keystroke sent to the
 *   wrong focused window would quit the wrong app instead.
 *
 * Either way, this only requests the close; it then polls for the process to
 * actually exit (it won't, if the user is sitting at a save-prompt) and
 * gives up after ~30s rather than waiting forever.
 */
async function closeEditorForProject(pid: number): Promise<boolean> {
    try {
        if (process.platform === 'win32') {
            try {
                execSync(`taskkill /PID ${pid}`);
            } catch {
                // taskkill can exit non-zero even when the close request was
                // sent (e.g. app still shutting down) — the poll loop below
                // is the real source of truth, so don't bail out here.
            }
        } else {
            const frontPid = execSync(
                `osascript -e 'tell application "System Events"
                    set frontmost of first process whose unix id is ${pid} to true
                    delay 0.3
                    return unix id of first process whose frontmost is true
                end tell'`,
                { encoding: 'utf-8' },
            ).trim();
            if (frontPid !== String(pid)) {
                return false;
            }
            execSync('osascript -e \'tell application "System Events" to keystroke "q" using command down\'');
        }
    } catch {
        return false;
    }
    for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
            process.kill(pid, 0);
        } catch {
            return true;
        }
    }
    return false;
}

function sendLog(jobId: string, line: string): void {
    const lines = jobLogs.get(jobId) ?? [];
    lines.push(line);
    if (lines.length > 300) lines.shift();
    jobLogs.set(jobId, lines);
    appendManagedLog(jobId, line);
    mainWindow?.webContents.send('build:log', { jobId, line });
}

function sendStatus(jobId: string, status: BuildJobStatus, exitCode?: number): void {
    const job = jobRegistry.get(jobId);
    if (job) {
        job.status = status;
        const terminal = status === 'success' || status === 'failed' || status === 'canceled';
        updateBuildRecord(job, {
            status,
            ...(status === 'pending' ? { progress: 0 } : {}),
            ...(status === 'running' ? { startedAt: new Date().toISOString(), finishedAt: undefined } : {}),
            ...(terminal ? {
                progress: status === 'success' ? 100 : readBuildHistory()[buildRecordKey(job.projectId, job.profileId)]?.progress ?? 0,
                finishedAt: new Date().toISOString(),
                errorDetails: status === 'failed' ? (jobLogs.get(jobId) ?? []).join('\n') : undefined,
            } : {}),
        });
    }
    const managed = readManagedJobs().find((candidate) => candidate.id === jobId);
    if (managed) {
        const terminal = status === 'success' || status === 'failed' || status === 'canceled';
        updateManagedJob(jobId, { status, ...(status === 'running' ? { progress: Math.max(1, managed.progress) } : {}), ...(status === 'success' ? { progress: 100 } : {}) });
        if (terminal) {
            const active = managed.tasks.findIndex((task) => task.status === 'running' || task.status === 'pending');
            if (active >= 0) updateManagedTask(jobId, active, status, status === 'success' ? 100 : managed.tasks[active].progress, status === 'failed' ? managed.errorLogs.join('\n') : undefined);
            if (status === 'success') for (let index = 0; index < managed.tasks.length; index += 1) updateManagedTask(jobId, index, 'success', 100);
        }
    }
    mainWindow?.webContents.send('build:status', { jobId, status, exitCode });
}

function sendProgress(job: BuildJob, percent: number): void {
    const requested = Math.max(0, Math.min(100, Math.round(percent)));
    const existing = readBuildHistory()[buildRecordKey(job.projectId, job.profileId)]?.progress ?? 0;
    const normalized = Math.max(existing, requested);
    updateBuildRecord(job, { progress: normalized });
    updateManagedJob(job.id, { progress: normalized });
    const taskIndex = normalized < 10 ? 0 : normalized < 90 ? 1 : 2;
    const managed = readManagedJobs().find((candidate) => candidate.id === job.id);
    if (managed) {
        for (let index = 0; index < taskIndex; index += 1) updateManagedTask(job.id, index, 'success', 100);
        updateManagedTask(job.id, taskIndex, 'running', taskIndex === 0 ? normalized * 10 : taskIndex === 1 ? Math.round((normalized - 10) / .8) : (normalized - 90) * 10);
    }
    mainWindow?.webContents.send('build:progress', { jobId: job.id, percent: normalized });
}

function progressFromOutput(output: string): number | null {
    const matches = Array.from(output.matchAll(/(?:^|\s)(\d{1,3})\s*%/g));
    if (!matches.length) return null;
    const value = Number(matches[matches.length - 1][1]);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function progressFromCreatorLog(output: string): number | null {
    const stages: Array<[RegExp, number]> = [
        [/Start spawn build-worker/i, 15],
        [/Checked Python Version/i, 20],
        [/Creating native cocos project/i, 30],
        [/Building 3D physics modules/i, 40],
        [/building engine|start engine/i, 50],
        [/\bCompiling\b|Build state: compile/i, 65],
        [/build-finished|Build Finished|Build success/i, 90],
    ];
    let progress: number | null = null;
    for (const [pattern, value] of stages) if (pattern.test(output)) progress = Math.max(progress ?? 0, value);
    return progress;
}

function exitCodeToStatus(code: number | null, creatorFamily: '2.x' | '3.x' = '3.x'): BuildJobStatus {
    if (creatorFamily === '2.x' && code === 0) {
        return 'success';
    }
    if (code === EXIT_CODE_SUCCESS) {
        return 'success';
    }
    if (code === EXIT_CODE_INVALID_PARAMS || code === EXIT_CODE_BUILD_ERROR) {
        return 'failed';
    }
    return 'failed';
}

let queueBusy = false;

function creatorProjectArgument(projectPath: string): '--path' | '--project' {
    return creatorInfo(projectPath).family === '2.x' ? '--path' : '--project';
}

function creatorEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    const environment = { ...process.env, ...overrides };
    // The dashboard itself may be started by Electron with this flag. Passing
    // it to another Electron application makes Creator boot as a Node process.
    delete environment.ELECTRON_RUN_AS_NODE;
    return environment;
}

function normalizeCreator2Output(profile: BuildProfile, buildOutputDir: string): void {
    const nestedOutput = path.join(buildOutputDir, profile.platform);
    if (!fs.existsSync(nestedOutput)) return;
    const temporaryOutput = `${buildOutputDir}.cocos2-output-${crypto.randomUUID()}`;
    fs.renameSync(nestedOutput, temporaryOutput);
    fs.rmSync(buildOutputDir, { recursive: true, force: true });
    fs.renameSync(temporaryOutput, buildOutputDir);
}

function createCreator2FacebookUploadArchive(buildOutputDir: string): void {
    for (const file of listFilesRecursiveAbsolute(buildOutputDir)) {
        if (file.toLowerCase().endsWith('.zip')) fs.rmSync(file, { force: true });
    }
    const archive = new AdmZip();
    const excluded = new Set(['cert.pem', 'key.pem', '.DS_Store']);
    for (const file of listFilesRecursiveAbsolute(buildOutputDir)) {
        const relative = path.relative(buildOutputDir, file);
        if (excluded.has(path.basename(file))) continue;
        archive.addLocalFile(file, path.dirname(relative) === '.' ? '' : path.dirname(relative));
    }
    archive.writeZip(path.join(buildOutputDir, 'facebook-upload.zip'));
}

function failJob(job: BuildJob, message: string): void {
    sendLog(job.id, message);
    sendStatus(job.id, 'failed');
    queueBusy = false;
    processQueue();
}

function processQueue(): void {
    if (queueBusy || currentChild || jobQueue.length === 0) {
        return;
    }

    const job = jobQueue.shift()!;
    const resolved = findProjectAndProfile(job.projectId, job.profileId);
    if (!resolved) {
        sendLog(job.id, `[build-dashboard] Project/profile not found for job ${job.id}`);
        sendStatus(job.id, 'failed');
        processQueue();
        return;
    }

    const { project, profile, buildOutputDir, profileArgs } = resolved;
    queueBusy = true;

    const editorPid = findEditorPidForProject(project.projectPath);
    if (editorPid) {
        void runEditorBuildJob(job, project, profile, buildOutputDir);
        return;
    }

    runBuildJob(job, project, profile, buildOutputDir, profileArgs);
}

async function runEditorBuildJob(
    job: BuildJob,
    project: ProjectConfig,
    profile: BuildProfile,
    buildOutputDir: string,
): Promise<void> {
    const editorLogPath = creatorEditorLogPath();
    const editorLogOffset = editorLogPath && fs.existsSync(editorLogPath) ? fs.statSync(editorLogPath).size : 0;
    try {
        cleanBuildOutput(project, buildOutputDir);
        ensurePackageNameConfigured(project, profile);
    } catch (error) {
        failJob(job, `[build-dashboard] Build preparation failed: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }
    currentJob = job;
    job.status = 'running';
    sendStatus(job.id, 'running');
    sendProgress(job, 10);
    sendLog(job.id, '[build-dashboard] Editor is open; queuing this build in the running Cocos Editor.');
    sendLog(job.id, `[build-dashboard] Environment: ${profile.environment ?? profile.id}`);

    try {
        const result = await requestEditorBuild(project, profile, buildOutputDir);
        if (result.error) {
            throw new Error(result.error);
        }
        const exitCode = result.exitCode ?? null;
        sendProgress(job, 90);
        const creatorFamily = creatorInfo(project.projectPath).family;
        let status = exitCodeToStatus(exitCode, creatorFamily);
        if (status === 'success') {
            try {
                if (creatorFamily === '2.x') normalizeCreator2Output(profile, buildOutputDir);
                if (applyGeneratedAndroidApplicationId(profile, buildOutputDir)) sendLog(job.id, `[build-dashboard] Android application ID set to ${profile.packageName}.`);
                const androidBranding = applyGeneratedAndroidBranding(project, profile, buildOutputDir);
                if (androidBranding.length) sendLog(job.id, `[build-dashboard] Android ${androidBranding.join(' and ')} branding synchronized.`);
                if (applyGeneratedIosBundleIdentifier(profile, buildOutputDir)) sendLog(job.id, `[build-dashboard] iOS bundle identifier set to ${profile.packageName}.`);
                if (profile.platform === 'fb-instant-games') {
                    const restored = restoreFacebookTemplateAssets(project.projectPath, buildOutputDir);
                    if (restored.length > 0) sendLog(job.id, `[build-dashboard] Restored template assets: ${restored.join(', ')}`);
                }
                applyWebLoadingScreen(project.projectPath, profile.platform, buildOutputDir, TOOL_RESOURCES_DIR);
                if (creatorFamily === '2.x' && profile.platform === 'fb-instant-games') createCreator2FacebookUploadArchive(buildOutputDir);
                validateBuild(profile, buildOutputDir, creatorFamily);
                sendLog(job.id, '[build-dashboard] Output validation passed.');
            } catch (error) {
                status = 'failed';
                sendLog(job.id, `[build-dashboard] ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        job.status = status;
        sendStatus(job.id, status, exitCode ?? undefined);
        sendLog(job.id, `[build-dashboard] Cocos Editor build finished with exit code ${exitCode ?? 'unknown'}.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const creatorFamily = creatorInfo(project.projectPath).family;
        const creatorError = creatorBuildErrorSince(editorLogOffset);
        job.status = 'failed';
        sendStatus(job.id, 'failed');
        if (creatorError) sendLog(job.id, `[Cocos Creator]\n${creatorError}`);
        sendLog(
            job.id,
            '[build-dashboard] Cocos Editor build failed. ' +
                (creatorFamily === '2.x'
                    ? 'If the bridge is unavailable, reload packages or restart Cocos Creator 2.x and retry. '
                    : 'If the bridge is unavailable, refresh and enable "Cocos Build Dashboard Bridge" in Extension Manager, then retry. ') +
                `Details: ${message}`,
        );
    } finally {
        currentJob = null;
        queueBusy = false;
        processQueue();
    }
}

function runBuildJob(
    job: BuildJob,
    project: ProjectConfig,
    profile: BuildProfile,
    buildOutputDir: string,
    profileArgs: string,
): void {
    try {
        cleanBuildOutput(project, buildOutputDir);
        ensurePackageNameConfigured(project, profile);
    } catch (error) {
        failJob(job, `[build-dashboard] Build preparation failed: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }

    currentJob = job;
    job.status = 'running';
    sendStatus(job.id, 'running');
    sendProgress(job, 10);
    sendLog(job.id, `[build-dashboard] Environment: ${profile.environment ?? profile.id}`);
    const projectArgument = creatorProjectArgument(project.projectPath);
    sendLog(job.id, `$ ${project.creatorExecutable} ${projectArgument} ${project.projectPath} --build "${profileArgs}"`);

    const androidOptions = profile.platform === 'android' ? readAndroidOptions(project.projectPath) : {};
    const sdkPath = typeof androidOptions.sdkPath === 'string' ? androidOptions.sdkPath : '';
    const ndkPath = typeof androidOptions.ndkPath === 'string' ? androidOptions.ndkPath : '';
    const javaHome = typeof androidOptions.javaHome === 'string' ? androidOptions.javaHome : '';
    const legacyPythonDirectory = path.join(os.homedir(), '.cocos-creator', 'python2', 'bin');
    const legacyPythonPath = path.join(legacyPythonDirectory, process.platform === 'win32' ? 'python.exe' : 'python');
    const creatorLogPath = creatorEditorLogPath();
    let creatorLogOffset = creatorLogPath && fs.existsSync(creatorLogPath) ? fs.statSync(creatorLogPath).size : 0;
    const child = spawn(
        project.creatorExecutable,
        [projectArgument, project.projectPath, '--build', profileArgs],
        {
            shell: false,
            detached: process.platform !== 'win32',
            env: creatorEnvironment({
                COCOS_BUILD_ENV: profile.environment ?? profile.id,
                ...(sdkPath ? { ANDROID_SDK_ROOT: sdkPath, ANDROID_HOME: sdkPath } : {}),
                ...(ndkPath ? { NDK_ROOT: ndkPath } : {}),
                ...(javaHome ? { JAVA_HOME: javaHome } : {}),
                ...(creatorInfo(project.projectPath).family === '2.x' && fs.existsSync(legacyPythonPath)
                    ? { PATH: `${legacyPythonDirectory}${path.delimiter}${process.env.PATH ?? ''}` }
                    : {}),
            }),
        },
    );
    currentChild = child;
    const creatorLogTimer = creatorLogPath ? setInterval(() => {
        try {
            if (!fs.existsSync(creatorLogPath)) return;
            const size = fs.statSync(creatorLogPath).size;
            if (size <= creatorLogOffset) return;
            const descriptor = fs.openSync(creatorLogPath, 'r');
            const buffer = Buffer.alloc(size - creatorLogOffset);
            fs.readSync(descriptor, buffer, 0, buffer.length, creatorLogOffset);
            fs.closeSync(descriptor);
            creatorLogOffset = size;
            const output = buffer.toString('utf-8');
            const progress = progressFromCreatorLog(output);
            if (progress !== null) sendProgress(job, progress);
            for (const line of output.split(/\r?\n/)) {
                if (/Build Failed:|Checked Python Version|Creating native cocos project/i.test(line)) sendLog(job.id, `[Cocos Creator] ${line}`);
            }
        } catch {
            // Creator can rotate or briefly lock its log while a build starts.
        }
    }, 500) : null;

    child.stdout.on('data', (chunk: Buffer) => {
        const output = chunk.toString('utf-8');
        const progress = progressFromOutput(output);
        if (progress !== null) sendProgress(job, Math.max(10, Math.min(90, progress)));
        for (const line of output.split('\n')) {
            if (line.trim().length > 0) {
                sendLog(job.id, line);
            }
        }
    });
    child.stderr.on('data', (chunk: Buffer) => {
        const output = chunk.toString('utf-8');
        const progress = progressFromOutput(output);
        if (progress !== null) sendProgress(job, Math.max(10, Math.min(90, progress)));
        for (const line of output.split('\n')) {
            if (line.trim().length > 0) {
                sendLog(job.id, line);
            }
        }
    });

    child.on('close', (code) => {
        if (creatorLogTimer) clearInterval(creatorLogTimer);
        const creatorFamily = creatorInfo(project.projectPath).family;
        let status = job.status === 'canceled' ? 'canceled' : exitCodeToStatus(code, creatorFamily);
        if (status === 'success') {
            sendProgress(job, 95);
            try {
                if (creatorFamily === '2.x') normalizeCreator2Output(profile, buildOutputDir);
                if (applyGeneratedAndroidApplicationId(profile, buildOutputDir)) sendLog(job.id, `[build-dashboard] Android application ID set to ${profile.packageName}.`);
                const androidBranding = applyGeneratedAndroidBranding(project, profile, buildOutputDir);
                if (androidBranding.length) sendLog(job.id, `[build-dashboard] Android ${androidBranding.join(' and ')} branding synchronized.`);
                if (applyGeneratedIosBundleIdentifier(profile, buildOutputDir)) sendLog(job.id, `[build-dashboard] iOS bundle identifier set to ${profile.packageName}.`);
                if (profile.platform === 'fb-instant-games') {
                    const restored = restoreFacebookTemplateAssets(project.projectPath, buildOutputDir);
                    if (restored.length > 0) sendLog(job.id, `[build-dashboard] Restored template assets: ${restored.join(', ')}`);
                }
                applyWebLoadingScreen(project.projectPath, profile.platform, buildOutputDir, TOOL_RESOURCES_DIR);
                if (creatorFamily === '2.x' && profile.platform === 'fb-instant-games') createCreator2FacebookUploadArchive(buildOutputDir);
                validateBuild(profile, buildOutputDir, creatorFamily);
                sendLog(job.id, '[build-dashboard] Output validation passed.');
            } catch (error) {
                status = 'failed';
                sendLog(job.id, `[build-dashboard] ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        job.status = status;
        sendStatus(job.id, status, code ?? undefined);
        currentChild = null;
        currentJob = null;
        queueBusy = false;
        processQueue();
    });

    child.on('error', (error) => {
        sendLog(job.id, `[build-dashboard] Failed to start build: ${error.message}`);
        job.status = 'failed';
        sendStatus(job.id, 'failed');
        currentChild = null;
        currentJob = null;
        queueBusy = false;
        processQueue();
    });
}

ipcMain.handle('projects:get', () => readProjects());
ipcMain.handle('fake-players:get', () => readFakePlayers());
ipcMain.handle('fake-players:add-avatar', (_event, sourcePath: string, gender: FakePlayerGender) => {
    const library = readFakePlayers();
    const id = crypto.randomUUID();
    const extension = path.extname(sourcePath).toLowerCase() || '.png';
    const fileName = `${id}${extension}`;
    fs.mkdirSync(FAKE_PLAYER_AVATARS_DIRECTORY, { recursive: true });
    fs.copyFileSync(sourcePath, path.join(FAKE_PLAYER_AVATARS_DIRECTORY, fileName));
    library.avatars.push({ id, gender, fileName, previewUrl: pathToFileURL(path.join(FAKE_PLAYER_AVATARS_DIRECTORY, fileName)).toString() });
    writeFakePlayers(library);
    return readFakePlayers();
});
ipcMain.handle('fake-players:remove-avatar', (_event, id: string) => {
    const library = readFakePlayers(); const avatar = library.avatars.find((item) => item.id === id);
    if (avatar) { try { fs.unlinkSync(path.join(FAKE_PLAYER_AVATARS_DIRECTORY, avatar.fileName)); } catch { /* Missing files are already removed. */ } }
    library.avatars = library.avatars.filter((item) => item.id !== id); library.names.forEach((item) => { if (item.avatarId === id) delete item.avatarId; }); writeFakePlayers(library); return readFakePlayers();
});
ipcMain.handle('fake-players:add-name', (_event, name: string, age: number, gender: FakePlayerGender, country: string, aliases: string[]) => {
    const library = readFakePlayers(); library.names.push({ id: crypto.randomUUID(), name: name.trim(), age, gender, country: country.trim(), aliases }); writeFakePlayers(library); return readFakePlayers();
});
ipcMain.handle('fake-players:seed-names', () => { const library = readFakePlayers(); const custom = library.names.filter((item) => !item.id.startsWith('seed-')); const previous = new Map(library.names.map((item) => [item.id, item])); library.names = [...custom, ...seededFakePlayers().map((item) => ({ ...item, avatarId: previous.get(item.id)?.avatarId }))]; writeFakePlayers(library); return readFakePlayers(); });
ipcMain.handle('fake-players:generate-avatars', async () => runManagedOperation('config', 'Generate fake player avatars', 'Generate and link avatars', async (jobId) => {
    const library = readFakePlayers(); fs.mkdirSync(FAKE_PLAYER_AVATARS_DIRECTORY, { recursive: true });
    for (const avatar of library.avatars.filter((item) => item.generated)) { try { fs.unlinkSync(path.join(FAKE_PLAYER_AVATARS_DIRECTORY, avatar.fileName)); } catch { /* Already absent. */ } }
    library.avatars = library.avatars.filter((item) => !item.generated); library.names.forEach((item) => { delete item.avatarId; });
    const variants: Array<{ kind: FakePlayerAvatarKind; style: string }> = [
        { kind: 'realistic', style: 'random-user' }, { kind: 'realistic', style: 'random-user' }, { kind: 'illustrated', style: 'personas' }, { kind: 'illustrated', style: 'lorelei' }, { kind: 'anime', style: 'adventurer' }, { kind: 'anime', style: 'toon-head' }, { kind: 'animal', style: 'critters' }, { kind: 'robot', style: 'bottts' }, { kind: 'robot', style: 'pixelbot' }, { kind: 'landscape', style: 'landscape' }, { kind: 'abstract', style: 'shapes' }, { kind: 'abstract', style: 'rings' },
    ];
    const assignments = new Map(library.names.map((player) => [player.id, variants[crypto.randomInt(variants.length)]]));
    const sources = new Map<string, string>();
    appendManagedLog(jobId, `[build-dashboard] Preparing randomized avatar sources for ${library.names.length} fake players.`);
    {
        const nationality: Record<string, string> = { Brazil: 'br', France: 'fr', Spain: 'es', 'United States': 'us' };
        const groups = new Map<string, typeof library.names>(); for (const player of library.names.filter((item) => assignments.get(item.id)?.kind === 'realistic')) { const key = `${player.country}|${player.gender}`; const group = groups.get(key) ?? []; group.push(player); groups.set(key, group); }
        await Promise.all([...groups.entries()].map(async ([key, players]) => { const [country, gender] = key.split('|'); const url = new URL('https://randomuser.me/api/'); url.searchParams.set('gender', gender); url.searchParams.set('seed', `hayhay-${country}-${gender}`); url.searchParams.set('results', String(players.length)); url.searchParams.set('inc', 'picture'); const nat = nationality[country]; if (nat) url.searchParams.set('nat', nat); const response = await fetch(url); if (!response.ok) throw new Error(`Random User returned ${response.status}.`); const data = await response.json() as { results?: Array<{ picture?: { large?: string } }> }; players.forEach((player, index) => { const source = data.results?.[index]?.picture?.large; if (source) sources.set(player.id, source); }); }));
        for (const player of library.names.filter((item) => assignments.get(item.id)?.kind !== 'realistic')) { const variant = assignments.get(player.id)!; const query = new URLSearchParams({ seed: `${player.id}-${crypto.randomUUID()}`, size: '256' }); if (variant.kind === 'illustrated' || variant.kind === 'anime') query.set('facialHairProbability', player.gender === 'female' ? '0' : player.age >= 24 ? '35' : '5'); sources.set(player.id, `https://api.dicebear.com/10.x/${encodeURIComponent(variant.style)}/svg?${query}`); }
    }
    updateManagedTask(jobId, 0, 'running', 20); updateManagedJob(jobId, { progress: 20 });
    const players = library.names.filter((item) => sources.has(item.id));
    for (let offset = 0; offset < players.length; offset += 12) {
        await Promise.all(players.slice(offset, offset + 12).map(async (player) => {
            const variant = assignments.get(player.id)!; const extension = variant.kind === 'realistic' ? '.jpg' : '.svg'; const fileName = `generated-${player.id}${extension}`; const response = await fetch(sources.get(player.id)!); if (!response.ok) throw new Error(`Avatar download returned ${response.status}.`); fs.writeFileSync(path.join(FAKE_PLAYER_AVATARS_DIRECTORY, fileName), Buffer.from(await response.arrayBuffer()));
            const avatar = { id: crypto.randomUUID(), gender: player.gender, fileName, previewUrl: pathToFileURL(path.join(FAKE_PLAYER_AVATARS_DIRECTORY, fileName)).toString(), playerId: player.id, generated: true, kind: variant.kind, style: variant.style }; library.avatars.push(avatar); player.avatarId = avatar.id;
        }));
        const complete = Math.min(players.length, offset + 12); const progress = 20 + Math.round((complete / Math.max(1, players.length)) * 75); updateManagedTask(jobId, 0, 'running', progress); updateManagedJob(jobId, { progress }); appendManagedLog(jobId, `[build-dashboard] Generated ${complete}/${players.length} avatars.`);
    }
    writeFakePlayers(library); return readFakePlayers();
}, { action: 'Generate avatars', sourceUrl: '/fake-players/avatars' }));
ipcMain.handle('fake-players:remove-name', (_event, id: string) => {
    const library = readFakePlayers(); library.names = library.names.filter((item) => item.id !== id); writeFakePlayers(library); return readFakePlayers();
});

ipcMain.handle('projects:detect-current', () => detectCurrentProject());
ipcMain.handle('projects:inspect-folder', (_event, projectPath: string) => inspectProjectFolder(projectPath));

ipcMain.handle('projects:update-info', (_event, update: ProjectInfoUpdate): ProjectsFile => {
    const id = update.id.trim();
    const name = update.name.trim();
    const orientation = update.orientation;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Project ID must use lowercase letters, numbers, and single hyphens only.');
    if (!name) throw new Error('Project name is required.');
    if (orientation !== 'portrait' && orientation !== 'landscape') throw new Error('Project orientation must be portrait or landscape.');
    const data = readProjects();
    const project = data.projects.find((candidate) => candidate.id === update.currentId && candidate.projectPath === update.projectPath)
        ?? data.projects.find((candidate) => candidate.projectPath === update.projectPath);
    if (!project) throw new Error(`Project is not registered: ${update.projectPath}`);
    if (data.projects.some((candidate) => candidate !== project && candidate.id === id)) throw new Error(`Project ID "${id}" is already in use.`);

    let icon = readProjectSettings(project.projectPath)?.icon;
    if (update.clearIcon) icon = null;
    if (update.iconSourcePath) {
        if (path.extname(update.iconSourcePath).toLowerCase() !== '.png') throw new Error('Project icon must be a PNG image.');
        const image = nativeImage.createFromPath(update.iconSourcePath);
        const size = image.getSize();
        if (image.isEmpty() || size.width !== 1024 || size.height !== 1024) {
            throw new Error(`Project icon must be exactly 1024 × 1024 pixels. Selected image is ${size.width} × ${size.height}.`);
        }
        const iconDirectory = path.join(project.projectPath, '.cocos-build-tools');
        fs.mkdirSync(iconDirectory, { recursive: true });
        const destination = path.join(iconDirectory, 'project-icon.png');
        if (path.resolve(update.iconSourcePath) !== destination) fs.copyFileSync(update.iconSourcePath, destination);
        icon = '.cocos-build-tools/project-icon.png';
    }

    project.id = id;
    project.name = name;
    project.orientation = orientation;
    project.iconPath = resolvedProjectIcon(project.projectPath, icon ?? undefined);
    writeProjects(data);
    const settings = readProjectSettings(project.projectPath)!;
    settings.id = id;
    settings.name = name;
    settings.orientation = orientation;
    if (icon !== undefined) settings.icon = icon;
    fs.writeFileSync(projectSettingsPath(project.projectPath), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
    return readProjects();
});

ipcMain.handle('bridge:status', (_event, projectPath: string) => getBridgeStatus(projectPath));

ipcMain.handle('cocos-account:status', (): CocosAccountStatus => {
    const sessionFile = path.join(os.homedir(), '.CocosCreator', 'profiles', 'user_token.json');
    if (!fs.existsSync(sessionFile)) return { sessionFile, sessionExists: false };
    try {
        const saved = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as Record<string, unknown>;
        const hasSession = typeof saved.session_id === 'string' && saved.session_id.length > 0
            && typeof saved.session_key === 'string' && saved.session_key.length > 0;
        const stat = fs.statSync(sessionFile);
        return {
            sessionFile,
            sessionExists: hasSession,
            email: typeof saved.email === 'string' ? saved.email : undefined,
            nickname: typeof saved.nickname === 'string' ? saved.nickname : undefined,
            updatedAt: stat.mtime.toISOString(),
        };
    } catch {
        return { sessionFile, sessionExists: false };
    }
});

ipcMain.handle('bridge:install', async (_event, projectPath: string) => {
    return runManagedOperation('install', 'Install Cocos Editor bridge', 'Copy bridge files', async () => {
        if (!readCocosProjectPackage(projectPath)) throw new Error(`Not a Cocos Creator project: ${projectPath}`);
        const source = editorBridgeSource(projectPath);
        if (!fs.existsSync(source)) throw new Error(`Bridge template is missing: ${source}`);
        const destination = editorBridgeDestination(projectPath);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.cpSync(source, destination, { recursive: true, force: true });
        await new Promise((resolve) => setTimeout(resolve, 400));
        return getBridgeStatus(projectPath);
    }, { action: 'Install editor bridge', projectPath });
});

ipcMain.handle('tooling:status', (_event, projectPath: string) => inspectTooling(projectPath));

ipcMain.handle('tooling:sync', (_event, projectPath: string) => runManagedOperation('install', 'Sync project tooling', 'Sync tooling files', () => syncTooling(projectPath, TOOL_RESOURCES_DIR), { action: 'Sync tooling', projectPath }));
ipcMain.handle('preview-simulator:sync', (_event, projectPath: string) => runManagedOperation('config', 'Sync preview simulator', 'Sync simulator files', () => syncPreviewSimulator(projectPath, TOOL_RESOURCES_DIR), { action: 'Sync preview simulator', projectPath }));
ipcMain.handle('preview-simulator:reset', (_event, projectPath: string) => runManagedOperation('config', 'Reset preview simulator', 'Reset simulator files', () => resetPreviewSimulator(projectPath), { action: 'Reset preview simulator', projectPath }));

ipcMain.handle('setup:reset', (_event, projectPath: string, component: 'codebase' | 'bridge' | 'tooling') => {
    if (component === 'bridge') {
        fs.rmSync(editorBridgeDestination(projectPath), { recursive: true, force: true });
        return;
    }
    if (component === 'tooling') {
        resetTooling(projectPath);
        return;
    }
    const destination = path.join(projectPath, PROJECT_SCRIPTS_SUBDIR);
    const sourceRoots = new Set([codebaseDirectory(projectPath), TOOL_CODEBASE_DIR]);
    for (const sourceRoot of sourceRoots) {
        for (const relative of listFilesRecursive(sourceRoot, sourceRoot).filter((file) => !file.endsWith('.meta'))) {
            const file = path.join(destination, ...relative.split('/'));
            fs.rmSync(file, { force: true });
            fs.rmSync(`${file}.meta`, { force: true });
        }
    }
});

ipcMain.handle('android-toolchain:status', (_event, projectPath: string) => detectAndroidToolchain(projectPath));

ipcMain.handle('android-toolchain:apply-detected', (_event, projectPath: string) => applyDetectedAndroidToolchain(projectPath));

ipcMain.handle('android-toolchain:resolve', (_event, projectPath: string) => resolveAndroidToolchain(projectPath));

ipcMain.handle('android-toolchain:resolve-component', async (_event, projectPath: string, component: AndroidToolchainComponent, taskId: string) => {
    androidToolchainTasks.set(taskId, { child: null, canceled: false });
    createManagedJob(taskId, 'install', `Resolve Android ${component.toUpperCase()}`, undefined, undefined, ['Detect', 'Install', 'Configure'], { action: `Resolve Android ${component.toUpperCase()}`, projectPath });
    updateManagedJob(taskId, { status: 'running', progress: 5 }); updateManagedTask(taskId, 0, 'running', 10);
    try {
        const result = await resolveAndroidToolchainComponent(projectPath, component, taskId);
        updateManagedTask(taskId, 0, 'success', 100); updateManagedTask(taskId, 1, 'success', 100); updateManagedTask(taskId, 2, 'success', 100); updateManagedJob(taskId, { status: 'success', progress: 100 }); return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error); appendManagedLog(taskId, message); updateManagedJob(taskId, { status: message === 'Canceled.' ? 'canceled' : 'failed' }); throw error;
    } finally { androidToolchainTasks.delete(taskId); }
});

ipcMain.handle('android-toolchain:cancel-task', (_event, taskId: string) => {
    const task = androidToolchainTasks.get(taskId);
    if (!task) return;
    task.canceled = true;
    if (task.child?.pid) {
        try { process.kill(-task.child.pid, 'SIGTERM'); } catch { task.child.kill('SIGTERM'); }
    }
});

ipcMain.handle('android-toolchain:set-component', (_event, projectPath: string, component: AndroidToolchainComponent, selectedPath: string) => setAndroidToolchainComponent(projectPath, component, selectedPath));

ipcMain.handle('android-toolchain:clear-component', (_event, projectPath: string, component: AndroidToolchainComponent) => {
    const file = androidProfilePath(projectPath);
    if (!fs.existsSync(file)) return detectAndroidToolchain(projectPath);
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    const android = ((data.builder as Record<string, unknown> | undefined)?.options as Record<string, unknown> | undefined)?.android as Record<string, unknown> | undefined;
    if (android) {
        if (component === 'sdk') delete android.sdkPath;
        if (component === 'ndk') delete android.ndkPath;
        if (component === 'jdk') { delete android.javaHome; delete android.javaPath; }
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    }
    return detectAndroidToolchain(projectPath);
});

ipcMain.handle('creator:open', (_event, projectPath: string, creatorExecutable: string) => {
    if (!fs.existsSync(creatorExecutable)) throw new Error(`Cocos Creator executable not found: ${creatorExecutable}`);
    if (findEditorPidForProject(projectPath) !== null) return;
    const child = spawn(creatorExecutable, [creatorProjectArgument(projectPath), projectPath], { detached: true, stdio: 'ignore', env: creatorEnvironment() });
    child.unref();
});

function previewPort(projectPath: string): number {
    const settingsPath = path.join(projectPath, 'settings', 'project.json');
    try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as { 'preview-port'?: number };
        const port = settings['preview-port'];
        if (Number.isInteger(port) && port! > 0 && port! < 65_536) return port!;
    } catch { /* Creator 3 projects normally use the default port. */ }
    return 7456;
}

function previewServerReady(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const request = http.get({ hostname: '127.0.0.1', port, path: '/', timeout: 800 }, (response) => {
            response.resume(); resolve(true);
        });
        request.on('timeout', () => request.destroy());
        request.on('error', () => resolve(false));
    });
}

ipcMain.handle('preview:open', async (_event, projectPath: string, creatorExecutable: string) => {
    if (!fs.existsSync(creatorExecutable)) throw new Error(`Cocos Creator executable not found: ${creatorExecutable}`);
    if (findEditorPidForProject(projectPath) === null) {
        const child = spawn(creatorExecutable, [creatorProjectArgument(projectPath), projectPath], { detached: true, stdio: 'ignore', env: creatorEnvironment() });
        child.unref();
    }
    const port = previewPort(projectPath);
    const url = `http://localhost:${port}/`;
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await previewServerReady(port)) {
            await shell.openExternal(url);
            return url;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Cocos Creator was opened, but its preview server did not become available at ${url}. Run Preview in Cocos Creator, then try again.`);
});

ipcMain.handle('projects:save', (_event, data: ProjectsFile) => {
    writeProjects(data);
    recordCompletedJob('config', 'Save project configuration', `Saved configuration for ${data.projects.length} project(s).`, { action: 'Save project configuration', sourceUrl: '/projects' });
});

ipcMain.handle('build:start', (_event, request: StartBuildRequest) => {
    const createdIds: string[] = [];
    for (const profileId of request.profileIds) {
        const job: BuildJob = {
            id: `job-${crypto.randomUUID()}`,
            projectId: request.projectId,
            profileId,
            status: 'pending',
        };
        jobRegistry.set(job.id, job);
        const project = readProjects().projects.find((candidate) => candidate.id === request.projectId); const profile = project?.profiles.find((candidate) => candidate.id === profileId);
        createManagedJob(job.id, 'build', `Build ${project?.name ?? request.projectId} · ${profile?.label ?? profileId}`, request.projectId, profileId, ['Prepare output', 'Cocos build', 'Validate output'], { action: 'Build' });
        jobLogs.set(job.id, []);
        jobQueue.push(job);
        createdIds.push(job.id);
        sendStatus(job.id, 'pending');
    }
    processQueue();
    return createdIds;
});

ipcMain.handle('build:records', (_event, projectId: string) => {
    const project = readProjects().projects.find((candidate) => candidate.id === projectId);
    if (!project) return [];
    const history = readBuildHistory();
    return project.profiles.map((profile): BuildRecord => {
        const resolved = findProjectAndProfile(projectId, profile.id);
        const stored = history[buildRecordKey(projectId, profile.id)];
        return {
            projectId,
            profileId: profile.id,
            status: stored?.status ?? 'not-built',
            version: stored?.version ?? projectVersion(project.projectPath),
            progress: stored?.progress ?? 0,
            startedAt: stored?.startedAt,
            finishedAt: stored?.finishedAt,
            outputExists: Boolean(resolved && (
                profile.platform === 'android'
                    ? androidGradleRoot(resolved.buildOutputDir)
                    : fs.existsSync(resolved.buildOutputDir)
            )),
            errorDetails: stored?.errorDetails,
            deploymentStatus: stored?.deploymentStatus,
            deploymentTaskId: stored?.deploymentTaskId,
            deploymentFinishedAt: stored?.deploymentFinishedAt,
            deploymentErrorDetails: stored?.deploymentErrorDetails,
        };
    });
});

ipcMain.handle('build:open-output', async (_event, projectId: string, profileId: string) => {
    const resolved = findProjectAndProfile(projectId, profileId);
    if (!resolved) throw new Error('Build environment not found.');
    if (!fs.existsSync(resolved.buildOutputDir)) throw new Error('This environment has no build output yet.');
    const error = await shell.openPath(resolved.buildOutputDir);
    if (error) throw new Error(error);
});

const WEB_MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.ttf': 'font/ttf', '.bin': 'application/octet-stream',
};

function localCertificate(): { key: Buffer; cert: Buffer } {
    const directory = path.join(app.getPath('userData'), 'local-web-server');
    const keyFile = path.join(directory, 'localhost-key.pem'); const certFile = path.join(directory, 'localhost-cert.pem');
    if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
        fs.mkdirSync(directory, { recursive: true });
        try {
            execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '3650', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
        } catch { throw new Error('Could not generate the localhost HTTPS certificate. Install OpenSSL and try again.'); }
    }
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function localWebHarness(title: string, initialMode: 'portrait' | 'landscape', storageKey: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Local test</title><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#15171b;color:#e7e9ed;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.local-preview{height:100%;display:flex;flex-direction:column}.local-preview-header{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:16px;padding:8px 16px;border-bottom:1px solid #343840;background:#202329}.local-preview-title{min-width:0;flex:1}.local-preview-title strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.local-preview-title span{display:block;margin-top:2px;color:#979da8;font-size:12px}.local-preview-modes{position:relative;display:grid;grid-template-columns:repeat(3,1fr);width:390px;height:40px;padding:3px;border:1px solid #424751;border-radius:8px;background:#17191d}.local-preview-indicator{position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/3);border-radius:6px;background:#3f78b2;transition:transform .2s ease}.local-preview-modes[data-mode=portrait] .local-preview-indicator{transform:translateX(100%)}.local-preview-modes[data-mode=landscape] .local-preview-indicator{transform:translateX(200%)}.local-preview-modes button{position:relative;z-index:1;border:0;background:transparent;color:#aeb4bf;font:inherit;cursor:pointer}.local-preview-modes button[aria-pressed=true]{color:#fff}.local-preview-content{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:16px;background:#111317}.local-preview-frame{position:relative;overflow:hidden;background:#000;border:1px solid #343840;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.35)}.local-preview-frame iframe{display:block;width:100%;height:100%;border:0;background:#000}.local-preview[data-mode=full] .local-preview-content{padding:0}.local-preview[data-mode=full] .local-preview-frame{width:100%;height:100%;border:0;border-radius:0}.local-preview[data-mode=portrait] .local-preview-frame{width:min(calc((100vh - 88px)*9/16),calc(100vw - 32px));height:min(calc(100vh - 88px),calc((100vw - 32px)*16/9))}.local-preview[data-mode=landscape] .local-preview-frame{width:min(calc((100vh - 88px)*16/9),calc(100vw - 32px));height:min(calc(100vh - 88px),calc((100vw - 32px)*9/16))}@media(max-width:700px){.local-preview-title span{display:none}.local-preview-modes{width:min(390px,65vw)}}
    </style></head><body><main class="local-preview" data-mode="${initialMode}"><header class="local-preview-header"><div class="local-preview-title"><strong>${escapeHtml(title)}</strong><span>Local web build</span></div><div class="local-preview-modes" data-mode="${initialMode}"><span class="local-preview-indicator"></span><button data-mode="full">Fullscreen</button><button data-mode="portrait">Portrait</button><button data-mode="landscape">Landscape</button></div></header><section class="local-preview-content"><div class="local-preview-frame"><iframe src="/__build__/index.html" allow="autoplay; fullscreen; gamepad" title="${escapeHtml(title)}"></iframe></div></section></main><script>
(function(){var key=${JSON.stringify(storageKey)},fallback=${JSON.stringify(initialMode)},root=document.querySelector('.local-preview'),modes=document.querySelector('.local-preview-modes'),frame=document.querySelector('iframe'),buttons=[].slice.call(modes.querySelectorAll('button'));function notifyResize(){try{frame.contentWindow.dispatchEvent(new Event('resize'))}catch(error){}}function select(mode){if(['full','portrait','landscape'].indexOf(mode)<0)mode=fallback;root.dataset.mode=mode;modes.dataset.mode=mode;buttons.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.mode===mode))});localStorage.setItem(key,mode);requestAnimationFrame(function(){requestAnimationFrame(notifyResize)})}frame.addEventListener('load',notifyResize);buttons.forEach(function(button){button.addEventListener('click',function(){select(button.dataset.mode)})});select(localStorage.getItem(key)||fallback)})();
    </script></body></html>`;
}

function buildIndexForHarness(file: string): string {
    const style = '<style id="hayhay-local-web-overrides">html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important}body>h1,body>.footer{display:none!important}#GameDiv{width:100%!important;height:100%!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important}#GameCanvas{display:block}</style>';
    const html = fs.readFileSync(file, 'utf8');
    return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : `${style}${html}`;
}

function serveBuildOutput(root: string, title: string, orientation: 'portrait' | 'landscape', storageKey: string): http.RequestListener {
    const normalizedRoot = path.resolve(root);
    return (request, response) => {
        try {
            const requestUrl = new URL(request.url ?? '/', 'http://localhost');
            if (requestUrl.pathname === '/') {
                response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(localWebHarness(title, orientation, storageKey)); return;
            }
            if (!requestUrl.pathname.startsWith('/__build__/')) { response.writeHead(404).end('Not found'); return; }
            const relative = decodeURIComponent(requestUrl.pathname.slice('/__build__/'.length));
            let file = path.resolve(normalizedRoot, relative || 'index.html');
            if (file !== normalizedRoot && !file.startsWith(`${normalizedRoot}${path.sep}`)) { response.writeHead(403).end('Forbidden'); return; }
            if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
            if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end('Not found'); return; }
            const extension = path.extname(file).toLowerCase(); response.setHeader('Content-Type', WEB_MIME_TYPES[extension] ?? 'application/octet-stream');
            response.setHeader('Cache-Control', 'no-store'); response.setHeader('Access-Control-Allow-Origin', '*'); response.writeHead(200);
            if (request.method === 'HEAD') response.end(); else if (extension === '.html' && path.basename(file) === 'index.html') response.end(buildIndexForHarness(file)); else fs.createReadStream(file).pipe(response);
        } catch (error) { response.writeHead(500).end(error instanceof Error ? error.message : String(error)); }
    };
}

ipcMain.handle('web-server:start', async (_event, projectId: string, profileId: string, protocol: LocalWebServerProtocol): Promise<LocalWebServerInfo> => {
    if (protocol !== 'http' && protocol !== 'https') throw new Error('Unsupported local server protocol.');
    const resolved = findProjectAndProfile(projectId, profileId);
    if (!resolved) throw new Error('Build environment not found.');
    if (!['web-desktop', 'web-mobile'].includes(resolved.profile.platform)) throw new Error('Local servers are available only for web builds.');
    if (!fs.existsSync(path.join(resolved.buildOutputDir, 'index.html'))) throw new Error('Build output does not contain index.html. Build this environment first.');
    const key = `${projectId}:${profileId}:${protocol}`; const existing = localWebServers.get(key);
    if (existing && existing.output === resolved.buildOutputDir && existing.server.listening) { await shell.openExternal(existing.info.url); return existing.info; }
    if (existing) { existing.server.close(); localWebServers.delete(key); }
    const listener = serveBuildOutput(resolved.buildOutputDir, `${resolved.project.name} · ${resolved.profile.label}`, resolved.project.orientation, `hayhay-local-web-mode:${projectId}:${profileId}`);
    const server = protocol === 'https' ? https.createServer(localCertificate(), listener) : http.createServer(listener);
    const info = await new Promise<LocalWebServerInfo>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') { reject(new Error('Could not resolve the local server port.')); return; }
            resolve({ protocol, port: address.port, url: `${protocol}://localhost:${address.port}/` });
        });
    });
    localWebServers.set(key, { server, info, output: resolved.buildOutputDir });
    await shell.openExternal(info.url); return info;
});

ipcMain.handle('external:open', async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Only secure web links can be opened.');
    await shell.openExternal(parsed.toString());
});

function runCapture(command: string, args: string[], env: NodeJS.ProcessEnv = process.env, taskId?: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        if (taskId && canceledDeployments.has(taskId)) { reject(new Error('Deployment canceled.')); return; }
        const child = spawn(command, args, { shell: false, env, cwd, detached: process.platform !== 'win32' });
        const cancelHandle = { cancel: () => {
            if (process.platform === 'win32' && child.pid) {
                try { spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }); } catch { child.kill('SIGTERM'); }
                return;
            }
            if (child.pid) {
                try {
                    const processGroup = -child.pid;
                    process.kill(processGroup, 'SIGTERM');
                    setTimeout(() => { if (child.exitCode === null) try { process.kill(processGroup, 'SIGKILL'); } catch { /* already exited */ } }, 2_000).unref();
                    return;
                } catch { /* fall back to the direct child */ }
            }
            child.kill('SIGTERM');
        } };
        if (taskId) deploymentProcesses.set(taskId, cancelHandle);
        let output = '';
        child.stdout.on('data', (chunk: Buffer) => { const value = chunk.toString('utf8'); output += value; if (taskId) appendManagedLog(taskId, value); });
        child.stderr.on('data', (chunk: Buffer) => { const value = chunk.toString('utf8'); output += value; if (taskId) appendManagedLog(taskId, value); });
        child.on('error', reject);
        child.on('close', (code) => {
            if (taskId && deploymentProcesses.get(taskId) === cancelHandle) deploymentProcesses.delete(taskId);
            if (taskId && canceledDeployments.has(taskId)) { reject(new Error('Deployment canceled.')); return; }
            code === 0 ? resolve(output) : reject(new Error(output.trim() || `${path.basename(command)} exited with code ${code}`));
        });
    });
}

ipcMain.handle('deployment:cancel', (_event, taskId: string) => {
    canceledDeployments.add(taskId);
    const active = deploymentProcesses.get(taskId);
    active?.cancel();
    deploymentProcesses.delete(taskId);
    const history = readBuildHistory();
    let changed = false;
    for (const [key, record] of Object.entries(history)) {
        if (record.deploymentTaskId !== taskId) continue;
        history[key] = { ...record, deploymentStatus: 'canceled', deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: 'Deployment canceled.' };
        changed = true;
    }
    if (changed) writeBuildHistory(history);
    appendManagedLog(taskId, '[build-dashboard] Deployment canceled by the user.');
    updateManagedJob(taskId, { status: 'canceled' });
    mainWindow?.webContents.send('deployment:status', { taskId });
});

function findFirst(root: string, suffix: string): string {
    if (!fs.existsSync(root)) return '';
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const full = path.join(root, entry.name);
        if (entry.name.endsWith(suffix)) return full;
        if (entry.isDirectory()) { const found = findFirst(full, suffix); if (found) return found; }
    }
    return '';
}

function findNewest(root: string, suffix: string): string {
    if (!fs.existsSync(root)) return '';
    let newest = { file: '', modified: -1 };
    const visit = (directory: string): void => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(full);
            else if (entry.name.endsWith(suffix)) {
                const modified = fs.statSync(full).mtimeMs;
                if (modified > newest.modified) newest = { file: full, modified };
            }
        }
    };
    visit(root);
    return newest.file;
}

/** Resolve the generated Gradle project without assuming one Cocos output layout.
 * Creator versions and native-template settings may put the wrapper in `proj`,
 * `proj.android-studio`, or another nested directory inside the environment.
 */
function androidGradleRoot(buildOutputDir: string): string | null {
    const wrapperName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    const commonRoots = [
        path.join(buildOutputDir, 'proj'),
        path.join(buildOutputDir, 'proj.android-studio'),
        path.join(buildOutputDir, 'frameworks', 'runtime-src', 'proj.android-studio'),
        buildOutputDir,
    ];
    for (const candidate of commonRoots) {
        if (fs.existsSync(path.join(candidate, wrapperName))) return candidate;
    }
    const wrapper = findFirst(buildOutputDir, wrapperName);
    return wrapper ? path.dirname(wrapper) : null;
}

function ensureAndroidGradleSdkVersions(gradleRoot: string, sdkPath: string): void {
    const propertiesFile = path.join(gradleRoot, 'gradle.properties');
    if (!fs.existsSync(propertiesFile)) return;
    let properties = fs.readFileSync(propertiesFile, 'utf-8');
    if (!/^PROP_(?:COMPILE|TARGET)_SDK_VERSION=-1$/m.test(properties)) return;
    const platformsRoot = path.join(sdkPath, 'platforms');
    const installed = fs.existsSync(platformsRoot)
        ? fs.readdirSync(platformsRoot).flatMap((name) => {
            const match = name.match(/^android-(\d+)$/); return match ? [Number(match[1])] : [];
        }).sort((a, b) => b - a)
        : [];
    // AGP 4.2 (Creator 2.x) officially supports API 30 and below. Prefer the
    // newest compatible installed platform; newer Creator projects preserve
    // their generated, valid SDK values and never enter this fallback.
    const api = installed.find((value) => value <= 30) ?? installed[0];
    if (!api) throw new Error(`No Android platform SDK is installed under ${platformsRoot}.`);
    properties = properties
        .replace(/^PROP_COMPILE_SDK_VERSION=-1$/m, `PROP_COMPILE_SDK_VERSION=${api}`)
        .replace(/^PROP_TARGET_SDK_VERSION=-1$/m, `PROP_TARGET_SDK_VERSION=${api}`);
    fs.writeFileSync(propertiesFile, properties, 'utf-8');
}

const COCOS_ANDROID_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86'];

async function ensureAndroidTargetAbi(gradleRoot: string, adb: string, deviceId: string, taskId: string): Promise<string[]> {
    const deviceAbis = (await runCapture(adb, ['-s', deviceId, 'shell', 'getprop', 'ro.product.cpu.abilist'], process.env, taskId))
        .trim().split(',').map((value) => value.trim()).filter(Boolean);
    if (!deviceAbis.length) throw new Error(`Could not detect the CPU architecture for Android target ${deviceId}.`);
    const propertiesFile = path.join(gradleRoot, 'gradle.properties');
    if (!fs.existsSync(propertiesFile)) throw new Error(`Generated Android project is missing ${propertiesFile}.`);
    let properties = fs.readFileSync(propertiesFile, 'utf-8');
    const configured = properties.match(/^PROP_APP_ABI=(.+)$/m)?.[1].split(':').map((value) => value.trim()).filter(Boolean) ?? [];
    if (configured.some((abi) => deviceAbis.includes(abi))) return deviceAbis;
    const compatible = deviceAbis.find((abi) => COCOS_ANDROID_ABIS.includes(abi));
    if (!compatible) throw new Error(`The target supports ${deviceAbis.join(', ')}, but this Cocos Android project can build only ${COCOS_ANDROID_ABIS.join(', ')}.`);
    properties = /^PROP_APP_ABI=.+$/m.test(properties)
        ? properties.replace(/^PROP_APP_ABI=.+$/m, `PROP_APP_ABI=${compatible}`)
        : `${properties.trimEnd()}\nPROP_APP_ABI=${compatible}\n`;
    fs.writeFileSync(propertiesFile, properties, 'utf-8');
    appendManagedLog(taskId, `[build-dashboard] Target ABIs: ${deviceAbis.join(', ')}. Rebuilding generated Android project for ${compatible}.`);
    return deviceAbis;
}

async function verifyApkAbi(apk: string, deviceAbis: string[], taskId: string): Promise<void> {
    const entries = await runCapture('unzip', ['-Z1', apk], process.env, taskId);
    const apkAbis = Array.from(new Set(entries.split(/\r?\n/).flatMap((entry) => entry.match(/^lib\/([^/]+)\//)?.[1] ?? [])));
    if (apkAbis.some((abi) => deviceAbis.includes(abi))) return;
    throw new Error(`APK architecture mismatch: the APK contains ${apkAbis.join(', ') || 'no native libraries'}, but the target accepts ${deviceAbis.join(', ')}. Rebuild the Cocos project with a matching Android ABI.`);
}

async function inspectAndroidApk(apk: string, sdkPath: string, taskId: string): Promise<{ packageName: string; launchActivity: string }> {
    const buildTools = path.join(sdkPath, 'build-tools');
    const executableName = process.platform === 'win32' ? 'aapt.exe' : 'aapt';
    const versions = fs.existsSync(buildTools)
        ? fs.readdirSync(buildTools).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
        : [];
    const aapt = versions.map((version) => path.join(buildTools, version, executableName)).find(fs.existsSync);
    if (!aapt) throw new Error(`Android aapt was not found under ${buildTools}. Install Android SDK Build Tools, then retry.`);
    const badging = await runCapture(aapt, ['dump', 'badging', apk], process.env, taskId);
    const packageName = badging.match(/^package:\s+name='([^']+)'/m)?.[1];
    const launchActivity = badging.match(/^launchable-activity:\s+name='([^']+)'/m)?.[1];
    if (!packageName) throw new Error(`Could not read the application ID from ${path.basename(apk)}.`);
    if (!launchActivity) throw new Error(`The installed APK (${packageName}) does not declare a launchable Android activity.`);
    return { packageName, launchActivity };
}

function androidAdb(projectPath: string): string {
    const status = detectAndroidToolchain(projectPath);
    const executable = path.join(status.configured.sdkPath || status.detected.sdkPath, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (!fs.existsSync(executable)) throw new Error('Android platform tools are not configured. Open Android Configurations and resolve the SDK first.');
    return executable;
}

function parseAndroidDevices(output: string): AndroidDevice[] {
    return output.split('\n').slice(1).flatMap((line) => {
        const match = line.trim().match(/^(\S+)\s+device\s+(.*)$/);
        if (!match) return [];
        const details = match[2];
        const model = details.match(/(?:^|\s)model:(\S+)/)?.[1]?.replaceAll('_', ' ') ?? 'Android device';
        const name = details.match(/(?:^|\s)device:(\S+)/)?.[1]?.replaceAll('_', ' ') ?? model;
        return [{ id: match[1], name, model }];
    });
}

async function ensureAndroidEmulator(projectPath: string, taskId: string): Promise<string> {
    const adb = androidAdb(projectPath);
    const running = parseAndroidDevices(await runCapture(adb, ['devices', '-l'])).find((device) => device.id.startsWith('emulator-'));
    if (running) return running.id;
    const toolchain = detectAndroidToolchain(projectPath);
    const emulator = path.join(toolchain.configured.sdkPath || toolchain.detected.sdkPath, 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator');
    if (!fs.existsSync(emulator)) throw new Error('Android Emulator is not installed in the configured SDK. Install it from Android Studio SDK Manager.');
    const avds = (await runCapture(emulator, ['-list-avds'])).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!avds.length) throw new Error('No Android Virtual Device is configured. Create one in Android Studio Device Manager.');
    const child = spawn(emulator, ['-avd', avds[0]], { detached: true, stdio: 'ignore', env: process.env });
    child.unref();
    for (let attempt = 0; attempt < 120; attempt += 1) {
        if (canceledDeployments.has(taskId)) throw new Error('Deployment canceled.');
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        const device = parseAndroidDevices(await runCapture(adb, ['devices', '-l'])).find((candidate) => candidate.id.startsWith('emulator-'));
        if (!device) continue;
        const ready = (await runCapture(adb, ['-s', device.id, 'shell', 'getprop', 'sys.boot_completed'])).trim();
        if (ready === '1') return device.id;
    }
    throw new Error('Android Emulator did not finish booting within two minutes.');
}

ipcMain.handle('android:list-devices', async (_event, projectId: string) => {
    const project = readProjects().projects.find((candidate) => candidate.id === projectId);
    if (!project) throw new Error('Project not found.');
    return parseAndroidDevices(await runCapture(androidAdb(project.projectPath), ['devices', '-l']))
        .filter((device) => !device.id.startsWith('emulator-'));
});

ipcMain.handle('android:deploy', async (_event, request: AndroidDeployRequest) => {
    const resolved = findProjectAndProfile(request.projectId, request.profileId);
    if (!resolved || resolved.profile.platform !== 'android') throw new Error('Android build environment not found.');
    createManagedJob(request.taskId, 'deploy', `${request.target === 'simulator' ? 'Run Android simulator' : request.target === 'device' ? 'Deploy Android device' : 'Upload Google Play'} · ${resolved.profile.label}`, request.projectId, request.profileId, ['Prepare target', 'Build package', 'Install or upload', 'Launch'], { action: request.target === 'simulator' ? 'Run Android simulator' : request.target === 'device' ? 'Deploy Android device' : 'Upload Google Play' });
    updateManagedJob(request.taskId, { status: 'running', progress: 5 }); updateManagedTask(request.taskId, 0, 'running', 10);
    updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: 'uploading', deploymentTaskId: request.taskId, deploymentFinishedAt: undefined, deploymentErrorDetails: undefined });
    try {
    const { project, profile, buildOutputDir } = resolved;
    if (!profile.packageName) throw new Error('Package name is required.');
    const gradleRoot = androidGradleRoot(buildOutputDir);
    if (!gradleRoot) {
        throw new Error(`No generated Android Gradle project was found in ${buildOutputDir}. Build this environment successfully, then retry.`);
    }
    const gradlew = path.join(gradleRoot, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    applyGeneratedAndroidApplicationId(profile, buildOutputDir);
    const androidBranding = applyGeneratedAndroidBranding(project, profile, buildOutputDir);
    if (androidBranding.length) appendManagedLog(request.taskId, `[build-dashboard] Android ${androidBranding.join(' and ')} branding synchronized.`);
    const toolchain = detectAndroidToolchain(project.projectPath);
    if (!toolchain.ready) throw new Error(`Android SDK, NDK, and JDK ${toolchain.requiredJdkMajor} must be configured before deployment.`);
    ensureAndroidGradleSdkVersions(gradleRoot, toolchain.configured.sdkPath);
    const env = { ...process.env, ANDROID_HOME: toolchain.configured.sdkPath, ANDROID_SDK_ROOT: toolchain.configured.sdkPath, JAVA_HOME: toolchain.configured.javaHome };
    if (request.target === 'device' || request.target === 'simulator') {
        const targetDeviceId = request.target === 'simulator' ? await ensureAndroidEmulator(project.projectPath, request.taskId) : request.deviceId;
        if (!targetDeviceId) throw new Error('Select a connected Android device.');
        const adb = androidAdb(project.projectPath);
        const deviceAbis = await ensureAndroidTargetAbi(gradleRoot, adb, targetDeviceId, request.taskId);
        updateManagedTask(request.taskId, 0, 'success', 100); updateManagedTask(request.taskId, 1, 'running', 10); updateManagedJob(request.taskId, { progress: 25 });
        await runCapture(gradlew, ['assembleDebug', '--no-daemon'], env, request.taskId, gradleRoot);
        const apk = findNewest(path.join(gradleRoot, 'app'), '.apk') || findNewest(gradleRoot, '.apk');
        if (!apk) throw new Error('Gradle succeeded but no APK was produced.');
        await verifyApkAbi(apk, deviceAbis, request.taskId);
        const apkIdentity = await inspectAndroidApk(apk, toolchain.configured.sdkPath, request.taskId);
        if (apkIdentity.packageName !== profile.packageName) appendManagedLog(request.taskId, `[build-dashboard] Warning: configured package ${profile.packageName} differs from APK package ${apkIdentity.packageName}; launching the APK manifest package.`);
        updateManagedTask(request.taskId, 1, 'success', 100); updateManagedTask(request.taskId, 2, 'running', 20); updateManagedJob(request.taskId, { progress: 65 });
        await runCapture(adb, ['-s', targetDeviceId, 'install', '-r', apk], process.env, request.taskId);
        updateManagedTask(request.taskId, 2, 'success', 100); updateManagedTask(request.taskId, 3, 'running', 20); updateManagedJob(request.taskId, { progress: 90 });
        await runCapture(adb, ['-s', targetDeviceId, 'shell', 'am', 'start', '-W', '-n', `${apkIdentity.packageName}/${apkIdentity.launchActivity}`], process.env, request.taskId);
        const message = `Installed and launched ${apkIdentity.packageName}${request.target === 'simulator' ? ' in Android Emulator' : ''}.`;
        updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: 'success', deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: undefined });
        updateManagedTask(request.taskId, 3, 'success', 100); updateManagedJob(request.taskId, { status: 'success', progress: 100 });
        return message;
    }
    if (!profile.androidKeystorePath || !profile.androidKeystorePassword || !profile.androidKeyAlias || !profile.androidKeyPassword) throw new Error('Release keystore and key credentials are required.');
    if (!profile.androidPlayServiceAccountPath) throw new Error('Google Play service-account JSON is required.');
    for (const file of [profile.androidKeystorePath, profile.androidPlayServiceAccountPath]) if (!fs.existsSync(file)) throw new Error(`Configured file was not found: ${file}`);
    await runCapture(gradlew, ['bundleRelease', '--no-daemon'], {
        ...env,
        ORG_GRADLE_PROJECT_RELEASE_STORE_FILE: profile.androidKeystorePath,
        ORG_GRADLE_PROJECT_RELEASE_STORE_PASSWORD: profile.androidKeystorePassword,
        ORG_GRADLE_PROJECT_RELEASE_KEY_ALIAS: profile.androidKeyAlias,
        ORG_GRADLE_PROJECT_RELEASE_KEY_PASSWORD: profile.androidKeyPassword,
    }, request.taskId, gradleRoot);
    const aab = findNewest(gradleRoot, '.aab');
    if (!aab) throw new Error('Gradle succeeded but no Android App Bundle was produced.');
    const fastlane = ['/opt/homebrew/bin/fastlane', '/usr/local/bin/fastlane'].find(fs.existsSync) ?? 'fastlane';
    try {
        await runCapture(fastlane, ['supply', '--aab', aab, '--package_name', profile.packageName, '--json_key', profile.androidPlayServiceAccountPath, '--track', profile.androidPlayTrack || 'internal', '--skip_upload_metadata', 'true', '--skip_upload_images', 'true', '--skip_upload_screenshots', 'true'], process.env, request.taskId);
    } catch (error) {
        if (error instanceof Error && error.message.includes('ENOENT')) throw new Error('Fastlane is required for Google Play uploads. Install it with `brew install fastlane`, then retry.');
        throw error;
    }
    const message = `Uploaded ${path.basename(aab)} to the ${profile.androidPlayTrack || 'internal'} Google Play track.`;
    updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: 'success', deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: undefined });
    updateManagedJob(request.taskId, { status: 'success', progress: 100 });
    return message;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: message === 'Deployment canceled.' ? 'canceled' : 'failed', deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: message });
        appendManagedLog(request.taskId, message); updateManagedJob(request.taskId, { status: message === 'Deployment canceled.' ? 'canceled' : 'failed' });
        throw error;
    }
});

function uploadFacebookBundle(appId: string, accessToken: string, archivePath: string, comment: string, taskId: string): Promise<void> {
    const boundary = `----HayHayTools${crypto.randomBytes(12).toString('hex')}`;
    const field = (name: string, value: string): Buffer => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
    const prefix = Buffer.concat([
        field('type', 'BUNDLE'),
        field('comment', comment),
        field('access_token', accessToken),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="asset"; filename="${path.basename(archivePath)}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    ]);
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    const contentLength = prefix.length + fs.statSync(archivePath).size + suffix.length;
    return new Promise((resolve, reject) => {
        if (canceledDeployments.has(taskId)) { reject(new Error('Deployment canceled.')); return; }
        const request = https.request({
            hostname: 'graph-video.facebook.com',
            path: `/${encodeURIComponent(appId)}/assets`,
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': contentLength },
        }, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => { body += chunk; });
            response.on('end', () => {
                deploymentProcesses.delete(taskId);
                if (canceledDeployments.has(taskId)) { reject(new Error('Deployment canceled.')); return; }
                if ((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300) { resolve(); return; }
                let detail = body;
                try { detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body; } catch { /* use response body */ }
                reject(new Error(`Facebook upload failed (${response.statusCode ?? 'unknown'}): ${detail || 'No response details.'}`));
            });
        });
        deploymentProcesses.set(taskId, { cancel: () => request.destroy(new Error('Deployment canceled.')) });
        request.on('error', reject);
        request.setTimeout(10 * 60 * 1000, () => request.destroy(new Error('Facebook upload timed out after 10 minutes.')));
        request.write(prefix);
        const stream = fs.createReadStream(archivePath);
        stream.on('error', reject);
        stream.on('end', () => request.end(suffix));
        stream.pipe(request, { end: false });
    });
}

function requestFacebookAppAccessToken(appId: string, appSecret: string): Promise<string> {
    const body = new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: 'client_credentials' }).toString();
    return new Promise((resolve, reject) => {
        const request = https.request({
            hostname: 'graph.facebook.com', path: '/oauth/access_token', method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
        }, (response) => {
            let responseBody = '';
            response.setEncoding('utf8'); response.on('data', (chunk: string) => { responseBody += chunk; });
            response.on('end', () => {
                try {
                    const payload = JSON.parse(responseBody) as { access_token?: string; error?: { message?: string } };
                    if ((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300 && payload.access_token) { resolve(payload.access_token); return; }
                    reject(new Error(payload.error?.message ?? 'Meta did not return an app access token.'));
                } catch { reject(new Error(`Meta returned an invalid token response (${response.statusCode ?? 'unknown'}).`)); }
            });
        });
        request.on('error', reject); request.setTimeout(30_000, () => request.destroy(new Error('Meta token request timed out.')));
        request.end(body);
    });
}

ipcMain.handle('facebook:get-app-access-token', async (_event, appId: string, appSecret: string) => {
    const normalizedAppId = appId.trim(); const normalizedSecret = appSecret.trim();
    if (!normalizedAppId) throw new Error('Enter the Facebook App ID first.');
    if (!normalizedSecret) throw new Error('App Secret is required.');
    return requestFacebookAppAccessToken(normalizedAppId, normalizedSecret);
});

const FACEBOOK_CONSOLE_PARTITION = 'persist:meta-developer';

function facebookConsoleProfile(projectId: string): { appId?: string; businessId?: string } {
    const project = readProjects().projects.find((candidate) => candidate.id === projectId);
    const profile = project?.profiles.find((candidate) => candidate.platform === 'fb-instant-games');
    return { appId: profile?.facebookAppId, businessId: profile?.facebookBusinessId };
}

function facebookConsoleUrl(projectId: string): string {
    const { appId, businessId } = facebookConsoleProfile(projectId);
    if (!appId) return 'https://developers.facebook.com/apps/';
    const url = new URL(`https://developers.facebook.com/apps/${encodeURIComponent(appId)}/instant-games/details/`);
    if (businessId) url.searchParams.set('business_id', businessId);
    return url.toString();
}

function ensureFacebookConsoleNetworkInspection(): void {
    if (facebookConsoleNetworkReady) return;
    facebookConsoleNetworkReady = true;
    const metaSession = session.fromPartition(FACEBOOK_CONSOLE_PARTITION);
    const filter = { urls: ['*://*.facebook.com/*', '*://facebook.com/*', '*://*.facebook.net/*', '*://*.fbcdn.net/*'] };
    metaSession.webRequest.onBeforeRequest(filter, (details, callback) => {
        facebookConsoleRequestStarts.set(details.id, Date.now());
        callback({});
    });
    metaSession.webRequest.onCompleted(filter, (details) => {
        let parsed: URL;
        try { parsed = new URL(details.url); } catch { return; }
        const started = facebookConsoleRequestStarts.get(details.id) ?? Date.now();
        facebookConsoleRequestStarts.delete(details.id);
        facebookConsoleRequests.unshift({ id: `${details.id}-${started}`, method: details.method, host: parsed.host, path: parsed.pathname, resourceType: details.resourceType, statusCode: details.statusCode, startedAt: new Date(started).toISOString(), durationMs: Math.max(0, Date.now() - started) });
        facebookConsoleRequests.splice(200);
    });
}

async function facebookConsoleStatus(projectId: string): Promise<FacebookConsoleStatus> {
    const metaSession = session.fromPartition(FACEBOOK_CONSOLE_PARTITION);
    const accountCookie = (await metaSession.cookies.get({ name: 'c_user' })).find((cookie) => cookie.domain?.endsWith('facebook.com'));
    const profile = facebookConsoleProfile(projectId);
    return { persistent: metaSession.isPersistent(), signedIn: Boolean(accountCookie?.value), accountId: accountCookie?.value, browserOpen: Boolean(facebookConsoleWindow && !facebookConsoleWindow.isDestroyed()), appId: profile.appId, businessId: profile.businessId, requestCount: facebookConsoleRequests.length };
}

function facebookConsoleBrowserState(): FacebookConsoleBrowserState {
    const contents = facebookConsoleEmbeddedView?.webContents;
    if (!contents || contents.isDestroyed()) return { url: '', title: '', canGoBack: false, canGoForward: false, loading: false };
    return { url: contents.getURL(), title: contents.getTitle(), canGoBack: contents.navigationHistory.canGoBack(), canGoForward: contents.navigationHistory.canGoForward(), loading: contents.isLoading() };
}

function notifyFacebookConsoleBrowserChanged(): void {
    mainWindow?.webContents.send('facebook-console:browser-changed', facebookConsoleBrowserState());
}

function ensureFacebookConsoleEmbeddedView(): WebContentsView {
    if (facebookConsoleEmbeddedView && !facebookConsoleEmbeddedView.webContents.isDestroyed()) return facebookConsoleEmbeddedView;
    const view = new WebContentsView({ webPreferences: { partition: FACEBOOK_CONSOLE_PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true } });
    view.webContents.setBackgroundThrottling(false);
    view.setBackgroundColor('#ffffff');
    view.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\/(?:[^/]+\.)?(?:facebook\.com|facebook\.net)\//i.test(url)) { void view.webContents.loadURL(url); return { action: 'deny' }; }
        void shell.openExternal(url); return { action: 'deny' };
    });
    view.webContents.on('did-navigate', notifyFacebookConsoleBrowserChanged);
    view.webContents.on('did-navigate-in-page', notifyFacebookConsoleBrowserChanged);
    view.webContents.on('did-start-loading', notifyFacebookConsoleBrowserChanged);
    view.webContents.on('did-stop-loading', notifyFacebookConsoleBrowserChanged);
    view.webContents.on('page-title-updated', notifyFacebookConsoleBrowserChanged);
    facebookConsoleEmbeddedView = view;
    return view;
}

async function waitForFacebookConsoleAssets(timeoutMs = 60_000): Promise<boolean> {
    const contents = facebookConsoleEmbeddedView?.webContents; if (!contents || contents.isDestroyed()) return false;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const ready = await contents.executeJavaScript(`(() => { const text = (document.body?.innerText || '').toLowerCase(); const html = document.body?.innerHTML || ''; const hasLabels = text.includes('app icon (1024') || text.includes('banner (1200') || text.includes('game preview videos') || text.includes('screenshots'); const media = html.includes('.fbcdn.net/v/t39.208') || html.includes('.fbcdn.net/v/t15.5256'); if (hasLabels && media) return true; const scrollables = [document.scrollingElement, ...document.querySelectorAll('main,section,div')].filter((element) => element && element.scrollHeight > element.clientHeight + 80); for (const element of scrollables) element.scrollTop = Math.min(element.scrollHeight, element.scrollTop + Math.max(500, element.clientHeight * .8)); return false; })()`) as boolean;
        if (ready) { await contents.executeJavaScript(`(() => { for (const element of [document.scrollingElement, ...document.querySelectorAll('main,section,div')]) if (element && element.scrollHeight > element.clientHeight + 80) element.scrollTop = element.scrollHeight; })()`); await new Promise((resolve) => setTimeout(resolve, 1_500)); return true; } await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
}

function normalizedBrowserBounds(bounds: FacebookConsoleBrowserBounds): FacebookConsoleBrowserBounds {
    return { x: Math.max(0, Math.round(bounds.x)), y: Math.max(0, Math.round(bounds.y)), width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)) };
}

interface FacebookConsoleAssetCandidate { url: string; label: string; width: number; height: number; kind: 'original' | 'video' | 'preview' | 'background'; }
interface FacebookConsoleOriginalDiscovery {
    candidates: FacebookConsoleAssetCandidate[];
    diagnostics: Array<{
        label: string;
        sourceKind: 'image' | 'background' | 'video-preview';
        sourceUrl: string;
        triggerTag: string;
        triggerRole: string;
        triggerText: string;
        clicked: boolean;
        originalUrls: string[];
        error?: string;
    }>;
}

function consoleAssetExtension(contentType: string, sourceUrl: string): string {
    const byType: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
    const normalized = contentType.split(';')[0].trim().toLowerCase(); if (byType[normalized]) return byType[normalized];
    try { const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase(); if (/^\.(?:png|jpe?g|webp|gif|svg|avif|mp4|webm|mov)$/.test(extension)) return extension === '.jpeg' ? '.jpg' : extension; } catch { /* use fallback */ }
    return '.img';
}

function consoleAssetName(label: string, index: number): string {
    const normalized = label.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
    return normalized || `page-asset-${index + 1}`;
}

function facebookConsoleAssetsDirectory(project: ProjectConfig): string {
    const destination = projectToolDataPath(project.projectPath, 'fb-instant-games', 'console-assets');
    const legacy = path.join(project.projectPath, 'resources', 'fb-instant-games', 'console-assets');
    if (!fs.existsSync(destination) && fs.existsSync(legacy)) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.cpSync(legacy, destination, { recursive: true }); }
    fs.mkdirSync(destination, { recursive: true }); return destination;
}

function inspectFacebookConsoleAsset(filePath: string, sourceKind: FacebookConsoleAssetFile['sourceKind']): Pick<FacebookConsoleAssetFile, 'width' | 'height' | 'validationStatus' | 'validationMessage'> {
    if (sourceKind !== 'video') {
        const image = nativeImage.createFromPath(filePath);
        if (image.isEmpty()) return { width: 0, height: 0, validationStatus: 'corrupt', validationMessage: 'The file cannot be decoded as an image.' };
        const size = image.getSize();
        return { width: size.width, height: size.height, validationStatus: size.width > 0 && size.height > 0 ? 'valid' : 'corrupt', validationMessage: size.width > 0 && size.height > 0 ? undefined : 'The decoded image has no dimensions.' };
    }
    try {
        const output = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_type', '-of', 'json', filePath], { encoding: 'utf8', timeout: 10_000 });
        const stream = (JSON.parse(output) as { streams?: Array<{ width?: number; height?: number; codec_type?: string }> }).streams?.[0];
        if (!stream || stream.codec_type !== 'video') return { width: 0, height: 0, validationStatus: 'corrupt', validationMessage: 'No decodable video stream was found.' };
        return { width: stream.width ?? 0, height: stream.height ?? 0, validationStatus: 'valid' };
    } catch (error) {
        const message = error instanceof Error && /ENOENT/.test(error.message) ? 'ffprobe is required to validate video files.' : 'The file cannot be decoded as a video.';
        return { width: 0, height: 0, validationStatus: 'corrupt', validationMessage: message };
    }
}

function listFacebookConsoleAssets(projectId: string): FacebookConsoleAssetExtraction {
    const project = readProjects().projects.find((candidate) => candidate.id === projectId); if (!project) throw new Error('Project not found.');
    const directory = facebookConsoleAssetsDirectory(project); const manifestFile = path.join(directory, 'manifest.json');
    if (!fs.existsSync(manifestFile)) return { directory, files: [], skipped: 0 };
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { files?: FacebookConsoleAssetFile[]; skipped?: number };
    const files = (manifest.files ?? []).filter((file) => fs.existsSync(path.join(directory, file.fileName))).map((file) => {
        const filePath = path.join(directory, file.fileName); return { ...file, ...inspectFacebookConsoleAsset(filePath, file.sourceKind), previewUrl: pathToFileURL(filePath).toString() };
    });
    return { directory, files, skipped: manifest.skipped ?? 0 };
}

async function collectFacebookConsoleAssetCandidates(): Promise<FacebookConsoleAssetCandidate[]> {
    const contents = facebookConsoleEmbeddedView?.webContents;
    if (!contents || contents.isDestroyed() || !contents.getURL()) throw new Error('Open the Meta console Browser page before extracting assets.');
    const script = `(() => {
        const output = []; const seen = new Set();
        const labelFor = (element) => { let current = element; for (let depth = 0; current && depth < 6; depth++, current = current.parentElement) { const lines = (current.innerText || '').split('\\n').map((line) => line.trim()).filter(Boolean); const match = lines.find((line) => !/^original\\s+image$/i.test(line) && /(?:app\\s*icon|banner|image)/i.test(line) && line.length < 120); if (match) return match; } return element.alt || element.getAttribute('aria-label') || 'Page asset'; };
        const add = (url, label, width, height, kind) => { if (!url || seen.has(url) || /(?:static\\.[^/]*facebook\\.com|static\\.[^/]*fbcdn\\.net)\\/rsrc\\.php/i.test(url)) return; if (!/^(?:https?:|data:|blob:)/i.test(url)) return; seen.add(url); output.push({ url, label, width: Math.round(width || 0), height: Math.round(height || 0), kind }); };
        for (const link of document.querySelectorAll('a[href]')) { if (!/original\\s+image/i.test(link.textContent || link.getAttribute('aria-label') || '')) continue; const label = labelFor(link); const dimensions = label.match(/(\\d{2,5})\\s*[x×]\\s*(\\d{2,5})/i); add(link.href, label, dimensions ? Number(dimensions[1]) : 0, dimensions ? Number(dimensions[2]) : 0, 'original'); }
        for (const image of document.images) { const rect = image.getBoundingClientRect(); if (rect.width < 8 || rect.height < 8) continue; let url = image.currentSrc || image.src; if (image.srcset) { const candidates = image.srcset.split(',').map((entry) => entry.trim().split(/\\s+/)[0]).filter(Boolean); if (candidates.length) url = candidates[candidates.length - 1]; } add(url, labelFor(image), image.naturalWidth || rect.width, image.naturalHeight || rect.height, 'preview'); }
        for (const element of document.querySelectorAll('*')) { const value = getComputedStyle(element).backgroundImage; if (!value || value === 'none') continue; const rect = element.getBoundingClientRect(); if (rect.width < 8 || rect.height < 8) continue; for (const match of value.matchAll(/url\\(["']?([^"')]+)["']?\\)/g)) add(match[1], labelFor(element), rect.width, rect.height, 'background'); }
        return output;
    })()`;
    return await contents.executeJavaScript(script) as FacebookConsoleAssetCandidate[];
}

async function discoverFacebookConsoleOriginalAssets(): Promise<FacebookConsoleOriginalDiscovery> {
    const contents = facebookConsoleEmbeddedView?.webContents;
    if (!contents || contents.isDestroyed()) return { candidates: [], diagnostics: [] };
    await contents.executeJavaScript(`(() => { for (const element of [document.scrollingElement, ...document.querySelectorAll('main,section,div')]) if (element && element.scrollHeight > element.clientHeight + 80) element.scrollTop = 0; })()`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const diagnostics: FacebookConsoleOriginalDiscovery['diagnostics'] = [];
    const candidates: FacebookConsoleAssetCandidate[] = [];
    const targets = await contents.executeJavaScript(`(() => {
        const output = []; const seen = new Set();
        const visible = (element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 8 && rect.height > 8 && style.visibility !== 'hidden' && style.display !== 'none'; };
        const labelFor = (element) => { let current = element; for (let depth = 0; current && depth < 7; depth++, current = current.parentElement) { const match = (current.innerText || '').split('\\n').map((line) => line.trim()).find((line) => /(?:app\\s*icon|banner|cover\\s*image|splash\\s*image|screenshots?|(?:gameplay|preview)\\s+video)/i.test(line) && line.length < 120); if (match) return match; } return ''; };
        for (const element of document.querySelectorAll('*')) {
            if (!visible(element)) continue;
            const value = getComputedStyle(element).backgroundImage; const match = value?.match(/url\\(["']?([^"')]+)["']?\\)/); if (!match) continue;
            const sourceUrl = match[1]; if (!/scontent\\.[^/]+\\.fbcdn\\.net\\/v\\/t39\\.208[12]-[06]\\//i.test(sourceUrl) || seen.has(sourceUrl)) continue;
            const label = labelFor(element); if (!label) continue;
            const trigger = element.closest('a,button,[role="button"],[data-interactable]'); if (!trigger || !visible(trigger)) continue;
            const id = 'hayhay-meta-asset-' + output.length; trigger.setAttribute('data-hayhay-meta-asset', id); seen.add(sourceUrl);
            output.push({ id, label, sourceUrl, sourceKind: 'background', assetKind: 'image', triggerTag: trigger.tagName.toLowerCase(), triggerRole: trigger.getAttribute('role') || '', triggerText: (trigger.textContent || '').trim().slice(0, 160) });
        }
        for (const image of document.images) {
            if (!visible(image)) continue; const sourceUrl = image.currentSrc || image.src || '';
            if (!/scontent\\.[^/]+\\.fbcdn\\.net\\/v\\/t15\\.5256-10\\//i.test(sourceUrl) || seen.has(sourceUrl)) continue;
            const label = labelFor(image); if (!/video/i.test(label)) continue;
            const trigger = image.closest('a,button,[role="button"],[data-interactable]'); if (!trigger || !visible(trigger)) continue;
            const id = 'hayhay-meta-asset-' + output.length; trigger.setAttribute('data-hayhay-meta-asset', id); seen.add(sourceUrl);
            output.push({ id, label, sourceUrl, sourceKind: 'video-preview', assetKind: 'video', triggerTag: trigger.tagName.toLowerCase(), triggerRole: trigger.getAttribute('role') || '', triggerText: (trigger.textContent || '').trim().slice(0, 160) });
        }
        return output;
    })()`) as Array<{ id: string; label: string; sourceUrl: string; sourceKind: 'background' | 'video-preview'; assetKind: 'image' | 'video'; triggerTag: string; triggerRole: string; triggerText: string }>;
    console.info(`[facebook-console:extract-assets] Found ${targets.length} exact Meta asset thumbnail targets.`);
    for (const target of targets) {
        const diagnostic: FacebookConsoleOriginalDiscovery['diagnostics'][number] = { ...target, clicked: false, originalUrls: [] };
        try {
            const mediaBaseline = target.assetKind === 'video' ? await contents.executeJavaScript(`performance.getEntriesByType('resource').map((entry) => entry.name)`) as string[] : [];
            const rect = await contents.executeJavaScript(`(() => { const target = document.querySelector('[data-hayhay-meta-asset="${target.id}"]'); if (!target) return null; target.scrollIntoView({ block: 'center', inline: 'center' }); const rect = target.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height }; })()`) as { x: number; y: number; width: number; height: number } | null;
            if (!rect || rect.width < 8 || rect.height < 8) throw new Error('The exact asset thumbnail is no longer visible.');
            await new Promise((resolve) => setTimeout(resolve, 120));
            console.info(`[facebook-console:extract-assets] Clicking "${target.label}" at ${Math.round(rect.x)},${Math.round(rect.y)} (${Math.round(rect.width)}x${Math.round(rect.height)}).`);
            diagnostic.clicked = await contents.executeJavaScript(`(() => { const target = document.querySelector('[data-hayhay-meta-asset="TARGET_ID"]'); if (!target) return false; target.click(); return true; })()`.replace('TARGET_ID', target.id)) as boolean;
            if (!diagnostic.clicked) throw new Error('The exact asset trigger disappeared before it could be activated.');
            for (let attempt = 0; attempt < 30; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 150));
                diagnostic.originalUrls = await contents.executeJavaScript(target.assetKind === 'image'
                    ? `(() => { const visible = (element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 8 && rect.height > 8 && style.visibility !== 'hidden' && style.display !== 'none'; }; return [...document.querySelectorAll('a[href]')].filter((link) => visible(link) && /^original\\s+image$/i.test((link.textContent || link.getAttribute('aria-label') || '').trim())).map((link) => link.href); })()`
                    : `(() => { const urls = new Set(); const baseline = new Set(${JSON.stringify(mediaBaseline)}); const add = (url) => { if (url && !url.startsWith('blob:') && !/\\.(?:jpe?g|png|webp)(?:[?&]|$)/i.test(url)) urls.add(url); }; for (const video of document.querySelectorAll('video')) { add(video.currentSrc); add(video.src); for (const source of video.querySelectorAll('source[src]')) add(source.src); } for (const link of document.querySelectorAll('a[href]')) if (/\\.(?:mp4|webm|mov)(?:[?&]|$)/i.test(link.href)) add(link.href); for (const entry of performance.getEntriesByType('resource')) if (!baseline.has(entry.name) && /(?:\\.(?:mp4|webm|mov)(?:[?&]|$)|video[^/]*\\.fbcdn\\.net|\\/v\\/t(?:42|66)\\.)/i.test(entry.name)) add(entry.name); return [...urls]; })()`) as string[];
                if (diagnostic.originalUrls.length) break;
            }
            const originalUrl = diagnostic.originalUrls[0];
            if (originalUrl) {
                const dimensions = target.label.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);
                candidates.push({ url: originalUrl, label: target.label, width: dimensions ? Number(dimensions[1]) : 0, height: dimensions ? Number(dimensions[2]) : 0, kind: target.assetKind === 'video' ? 'video' : 'original' });
                console.info(`[facebook-console:extract-assets] Captured ${target.assetKind} for "${target.label}": ${originalUrl}`);
            } else console.warn(`[facebook-console:extract-assets] No ${target.assetKind === 'video' ? 'video source' : 'Original Image link'} appeared for "${target.label}" after 4.5 seconds.`);
            await contents.executeJavaScript(`(() => { const visible = (element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; }; const close = [...document.querySelectorAll('button,[role="button"]')].find((element) => visible(element) && /^(?:close|dismiss)$/i.test((element.textContent || element.getAttribute('aria-label') || '').trim())); if (close) { close.click(); return true; } document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return false; })()`);
            await new Promise((resolve) => setTimeout(resolve, 180));
        } catch (error) {
            diagnostic.error = error instanceof Error ? error.message : String(error);
            console.error(`[facebook-console:extract-assets] Failed to inspect "${target.label}": ${diagnostic.error}`);
        }
        diagnostics.push(diagnostic);
    }
    return { candidates, diagnostics };
}

async function extractFacebookConsoleAssets(projectId: string, jobId?: string): Promise<FacebookConsoleAssetExtraction> {
    const project = readProjects().projects.find((candidate) => candidate.id === projectId); if (!project) throw new Error('Project not found.');
    const destination = facebookConsoleAssetsDirectory(project);
    const contents = facebookConsoleEmbeddedView?.webContents; if (!contents || contents.isDestroyed()) throw new Error('Open the Meta console Browser page before extracting assets.');
    if (jobId) appendManagedLog(jobId, '[build-dashboard] Waiting for the Meta asset section and lazy-loaded media.');
    const ready = await waitForFacebookConsoleAssets();
    const pageUrl = contents.getURL(); const beforeDom = await contents.executeJavaScript('document.documentElement.outerHTML') as string; fs.writeFileSync(path.join(destination, 'page-dom-before.html'), beforeDom, 'utf8');
    if (!ready) throw new Error('The Meta Instant Games asset section did not finish rendering within 60 seconds. The page DOM was saved for investigation.');
    const previous = listFacebookConsoleAssets(projectId).files.filter((file) => file.sourceKind === 'original' || file.sourceKind === 'video');
    const discovery = await discoverFacebookConsoleOriginalAssets();
    const originalLabels = new Set([...discovery.candidates.map((candidate) => candidate.label.toLowerCase()), ...previous.map((file) => file.label.toLowerCase())]);
    const renderedCandidates = await collectFacebookConsoleAssetCandidates();
    const rendered = renderedCandidates.filter((candidate) =>
        (candidate.kind === 'background' || candidate.kind === 'preview')
        && /scontent\.[^/]+\.fbcdn\.net\/v\/t39\.208[12]-0\//i.test(candidate.url)
        && /(?:app\s*icon|banner|cover\s*image|splash\s*image|screenshots?)/i.test(candidate.label)
        && !originalLabels.has(candidate.label.toLowerCase())).map((candidate) => { const dimensions = candidate.label.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i); return { ...candidate, kind: 'preview' as const, width: dimensions ? Number(dimensions[1]) : candidate.width, height: dimensions ? Number(dimensions[2]) : candidate.height }; });
    const seenUrls = new Set<string>();
    const candidates = [...discovery.candidates, ...rendered].filter((candidate) => { if (seenUrls.has(candidate.url)) return false; seenUrls.add(candidate.url); return true; });
    const summary = `[build-dashboard] Meta discovery found ${discovery.candidates.length} original/video popover assets, ${rendered.length} downloadable preview fallbacks, and ${renderedCandidates.length} rendered media candidates.`;
    console.info(summary); if (jobId) appendManagedLog(jobId, summary);
    const afterDom = await contents.executeJavaScript('document.documentElement.outerHTML') as string; fs.writeFileSync(path.join(destination, 'page-dom-after.html'), afterDom, 'utf8');
    fs.writeFileSync(path.join(destination, 'original-discovery.json'), `${JSON.stringify({ sourcePage: pageUrl, capturedAt: new Date().toISOString(), ...discovery }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(destination, 'original-urls.json'), `${JSON.stringify({
        sourcePage: pageUrl,
        capturedAt: new Date().toISOString(),
        originals: discovery.candidates.filter((candidate) => candidate.kind === 'original').map(({ label, url, width, height }) => ({ label, url, width, height })),
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(destination, 'asset-urls.json'), `${JSON.stringify({
        sourcePage: pageUrl,
        capturedAt: new Date().toISOString(),
        assets: discovery.candidates.map(({ label, url, width, height, kind }) => ({ label, kind, url, width, height })),
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(destination, 'asset-candidates.json'), `${JSON.stringify({ sourcePage: pageUrl, capturedAt: new Date().toISOString(), candidates }, null, 2)}\n`, 'utf8');
    if (!candidates.length) throw new Error('No extractable images were found on the current Meta page. The page DOM was saved for investigation.');
    const metaSession = session.fromPartition(FACEBOOK_CONSOLE_PARTITION);
    const files: FacebookConsoleAssetFile[] = []; let skipped = 0; const names = new Map<string, number>(); const hashes = new Set<string>();
    for (const [index, candidate] of candidates.entries()) {
        try {
            let buffer: Buffer; let contentType = '';
            if (candidate.url.startsWith('data:')) { const comma = candidate.url.indexOf(','); const header = candidate.url.slice(5, comma); contentType = header.split(';')[0]; buffer = Buffer.from(candidate.url.slice(comma + 1), header.includes(';base64') ? 'base64' : 'utf8'); }
            else if (candidate.url.startsWith('blob:')) { skipped++; continue; }
            else { const response = await metaSession.fetch(candidate.url); if (!response.ok) { skipped++; continue; } contentType = response.headers.get('content-type') ?? ''; buffer = Buffer.from(await response.arrayBuffer()); }
            const hash = crypto.createHash('sha256').update(buffer).digest('hex'); if (hashes.has(hash)) continue; hashes.add(hash);
            const base = consoleAssetName(candidate.label, index); const occurrence = names.get(base) ?? 0; names.set(base, occurrence + 1); const fileName = `${base}${occurrence ? `-${occurrence + 1}` : ''}${consoleAssetExtension(contentType, candidate.url)}`;
            const filePath = path.join(destination, fileName); fs.writeFileSync(filePath, buffer); files.push({ fileName, label: candidate.label, sourceUrl: candidate.url, previewUrl: pathToFileURL(filePath).toString(), status: 'extracted', sourceKind: candidate.kind, ...inspectFacebookConsoleAsset(filePath, candidate.kind) });
        } catch { skipped++; }
    }
    const refreshedLabels = new Set(files.filter((file) => file.sourceKind === 'original' || file.sourceKind === 'video').map((file) => file.label.toLowerCase()));
    for (const file of previous) {
        if (refreshedLabels.has(file.label.toLowerCase()) || !fs.existsSync(path.join(destination, file.fileName))) continue;
        files.push({ ...file, previewUrl: pathToFileURL(path.join(destination, file.fileName)).toString() });
    }
    if (!files.length) throw new Error('Images were detected, but Meta did not allow any of them to be downloaded from the current session.');
    fs.writeFileSync(path.join(destination, 'manifest.json'), `${JSON.stringify({ sourcePage: pageUrl, extractedAt: new Date().toISOString(), files, skipped }, null, 2)}\n`, 'utf8');
    if (jobId) appendManagedLog(jobId, `[build-dashboard] Saved ${files.length} Meta console assets to ${destination}${skipped ? `; skipped ${skipped} inaccessible candidates` : ''}.`);
    return { directory: destination, files, skipped };
}

async function prepareFacebookConsoleBackgroundBrowser(projectId: string): Promise<void> {
    if (!mainWindow) throw new Error('Dashboard window is not available.');
    ensureFacebookConsoleNetworkInspection(); const view = ensureFacebookConsoleEmbeddedView();
    if (!facebookConsoleEmbeddedAttached) { mainWindow.contentView.addChildView(view); facebookConsoleEmbeddedAttached = true; }
    const windowBounds = mainWindow.getContentBounds();
    // Keep one physical pixel inside the host window. A fully off-window view is
    // treated as non-visible by Chromium and Meta never mounts its lazy asset UI.
    view.setBounds({ x: Math.max(0, windowBounds.width - 1), y: Math.max(0, windowBounds.height - 1), width: 1280, height: 900 }); view.setVisible(true);
    facebookConsoleEmbeddedProjectId = projectId; await view.webContents.loadURL(facebookConsoleUrl(projectId));
}

ipcMain.handle('facebook-console:status', (_event, projectId: string) => facebookConsoleStatus(projectId));
ipcMain.handle('facebook-console:requests', () => facebookConsoleRequests.slice());
ipcMain.handle('facebook-console:clear-session', async () => {
    facebookConsoleWindow?.close();
    const metaSession = session.fromPartition(FACEBOOK_CONSOLE_PARTITION);
    await metaSession.clearData({ dataTypes: ['cookies', 'localStorage', 'indexedDB', 'cache', 'serviceWorkers'] });
    facebookConsoleRequests.length = 0;
    facebookConsoleRequestStarts.clear();
});
ipcMain.handle('facebook-console:open', async (_event, projectId: string) => {
    ensureFacebookConsoleNetworkInspection();
    if (facebookConsoleWindow && !facebookConsoleWindow.isDestroyed()) {
        await facebookConsoleWindow.loadURL(facebookConsoleUrl(projectId));
        facebookConsoleWindow.show(); facebookConsoleWindow.focus(); return;
    }
    facebookConsoleWindow = new BrowserWindow({ width: 1320, height: 900, minWidth: 900, minHeight: 640, title: 'Meta Developer Console', webPreferences: { partition: FACEBOOK_CONSOLE_PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true } });
    facebookConsoleWindow.on('closed', () => { facebookConsoleWindow = null; });
    facebookConsoleWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\/(?:[^/]+\.)?(?:facebook\.com|facebook\.net)\//i.test(url)) return { action: 'allow' };
        void shell.openExternal(url); return { action: 'deny' };
    });
    await facebookConsoleWindow.loadURL(facebookConsoleUrl(projectId));
});
ipcMain.handle('facebook-console:browser-show', async (_event, projectId: string, bounds: FacebookConsoleBrowserBounds) => {
    if (!mainWindow) throw new Error('Dashboard window is not available.');
    ensureFacebookConsoleNetworkInspection();
    const view = ensureFacebookConsoleEmbeddedView();
    if (!facebookConsoleEmbeddedAttached) { mainWindow.contentView.addChildView(view); facebookConsoleEmbeddedAttached = true; }
    view.setBounds(normalizedBrowserBounds(bounds)); view.setVisible(true);
    if (facebookConsoleEmbeddedProjectId !== projectId || !view.webContents.getURL()) { facebookConsoleEmbeddedProjectId = projectId; await view.webContents.loadURL(facebookConsoleUrl(projectId)); }
    notifyFacebookConsoleBrowserChanged(); return facebookConsoleBrowserState();
});
ipcMain.handle('facebook-console:browser-resize', (_event, bounds: FacebookConsoleBrowserBounds) => { facebookConsoleEmbeddedView?.setBounds(normalizedBrowserBounds(bounds)); });
ipcMain.handle('facebook-console:browser-hide', () => { facebookConsoleEmbeddedView?.setVisible(false); });
ipcMain.handle('facebook-console:browser-state', () => facebookConsoleBrowserState());
ipcMain.handle('facebook-console:extract-assets', (_event, projectId: string) => extractFacebookConsoleAssets(projectId));
ipcMain.handle('facebook-console:list-assets', (_event, projectId: string) => listFacebookConsoleAssets(projectId));
ipcMain.handle('facebook-console:reparse-assets', (_event, projectId: string) => {
    const project = readProjects().projects.find((candidate) => candidate.id === projectId); if (!project) throw new Error('Project not found.');
    const jobId = `job-${crypto.randomUUID()}`; createManagedJob(jobId, 'config', `Reparse Meta console assets · ${project.name}`, projectId, undefined, ['Prepare authenticated console', 'Discover and download assets', 'Save project asset manifest'], { action: 'Reparse Meta console assets', sourceUrl: `/projects/${encodeURIComponent(projectId)}/fb-instant-games/console/assets` });
    void (async () => {
        updateManagedJob(jobId, { status: 'running', progress: 5 }); updateManagedTask(jobId, 0, 'running', 10); appendManagedLog(jobId, `[build-dashboard] Preparing the authenticated Meta console for ${project.name}.`);
        try {
            await prepareFacebookConsoleBackgroundBrowser(projectId); updateManagedTask(jobId, 0, 'success', 100); updateManagedTask(jobId, 1, 'running', 10); updateManagedJob(jobId, { progress: 25 });
            const result = await extractFacebookConsoleAssets(projectId, jobId); updateManagedTask(jobId, 1, 'success', 100); updateManagedTask(jobId, 2, 'running', 50); updateManagedJob(jobId, { progress: 90 });
            appendManagedLog(jobId, `[build-dashboard] Manifest contains ${result.files.length} assets.`); updateManagedTask(jobId, 2, 'success', 100); updateManagedJob(jobId, { status: 'success', progress: 100 });
        } catch (error) {
            const message = error instanceof Error ? error.stack || error.message : String(error); appendManagedLog(jobId, message); updateManagedJob(jobId, { status: 'failed' });
        } finally { if (facebookConsoleEmbeddedProjectId === projectId) facebookConsoleEmbeddedView?.setVisible(false); }
    })();
    return jobId;
});
ipcMain.handle('facebook-console:open-assets-folder', async (_event, projectId: string) => {
    const project = readProjects().projects.find((candidate) => candidate.id === projectId); if (!project) throw new Error('Project not found.');
    await shell.openPath(facebookConsoleAssetsDirectory(project));
});
ipcMain.handle('facebook-console:browser-navigate', async (_event, action: FacebookConsoleBrowserAction, rawUrl?: string) => {
    const view = facebookConsoleEmbeddedView; if (!view) throw new Error('Open the embedded Meta browser first.');
    const history = view.webContents.navigationHistory;
    if (rawUrl) { const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`; await view.webContents.loadURL(url); }
    else if (action === 'back' && history.canGoBack()) history.goBack();
    else if (action === 'forward' && history.canGoForward()) history.goForward();
    else if (action === 'reload') view.webContents.reload();
    else if (action === 'home' && facebookConsoleEmbeddedProjectId) await view.webContents.loadURL(facebookConsoleUrl(facebookConsoleEmbeddedProjectId));
    return facebookConsoleBrowserState();
});

ipcMain.handle('facebook:deploy', async (_event, request: FacebookDeployRequest) => {
    const resolved = findProjectAndProfile(request.projectId, request.profileId);
    if (!resolved || resolved.profile.platform !== 'fb-instant-games') throw new Error('Facebook Instant Games build environment not found.');
    createManagedJob(request.taskId, 'deploy', `Deploy Facebook hosting · ${resolved.profile.label}`, request.projectId, request.profileId, ['Validate bundle', 'Upload bundle'], { action: 'Deploy Facebook hosting' }); updateManagedJob(request.taskId, { status: 'running', progress: 5 }); updateManagedTask(request.taskId, 0, 'running', 10);
    const { project, profile, buildOutputDir } = resolved;
    if (!profile.facebookAppId) throw new Error('Facebook App ID is required.');
    if (!profile.facebookAppAccessToken) throw new Error('Facebook app access token is required.');
    const creatorFamily = creatorInfo(project.projectPath).family;
    restoreFacebookTemplateAssets(project.projectPath, buildOutputDir);
    if (creatorFamily === '2.x') createCreator2FacebookUploadArchive(buildOutputDir);
    validateFacebookBuild(buildOutputDir, creatorFamily);
    const archive = findFirst(buildOutputDir, '.zip');
    if (!archive) throw new Error('No Facebook upload ZIP was found. Build this environment first.');
    updateDeploymentRecord(request.projectId, request.profileId, {
        deploymentStatus: 'uploading', deploymentTaskId: request.taskId,
        deploymentFinishedAt: undefined, deploymentErrorDetails: undefined,
    });
    try {
        await uploadFacebookBundle(profile.facebookAppId, profile.facebookAppAccessToken, archive, `${profile.label} · ${new Date().toISOString()}`, request.taskId);
        updateDeploymentRecord(request.projectId, request.profileId, {
            deploymentStatus: 'success', deploymentTaskId: undefined,
            deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: undefined,
        });
        updateManagedJob(request.taskId, { status: 'success', progress: 100 });
        return `Uploaded ${path.basename(archive)} to Facebook Instant Games Web Hosting.`;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateDeploymentRecord(request.projectId, request.profileId, {
            deploymentStatus: message === 'Deployment canceled.' ? 'canceled' : 'failed', deploymentTaskId: undefined,
            deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: message,
        });
        appendManagedLog(request.taskId, message); updateManagedJob(request.taskId, { status: message === 'Deployment canceled.' ? 'canceled' : 'failed' });
        throw error;
    }
});

interface DeviceCtlDevice {
    deviceProperties?: { name?: string };
    hardwareProperties?: { platform?: string; productType?: string; reality?: string; udid?: string };
    properties?: {
        device?: { name?: string };
        hardware?: { platform?: string; productType?: string; reality?: string; udid?: string };
    };
}

async function listPhysicalIosDevices(): Promise<IosDevice[]> {
    const outputFile = path.join(os.tmpdir(), `cocos-ios-devices-${crypto.randomUUID()}.json`);
    try {
        await runCapture('xcrun', ['devicectl', 'list', 'devices', '--json-output', outputFile]);
        const payload = JSON.parse(fs.readFileSync(outputFile, 'utf8')) as { result?: { devices?: DeviceCtlDevice[] } };
        return (payload.result?.devices ?? []).flatMap((device) => {
            const hardware = device.properties?.hardware ?? device.hardwareProperties;
            const name = device.properties?.device?.name ?? device.deviceProperties?.name;
            const id = hardware?.udid;
            const isSimulator = hardware?.reality === 'simulated' || id?.split('-').length === 5;
            if (!name || !id || hardware?.platform !== 'iOS' || isSimulator) return [];
            return [{ id, name, model: hardware.productType ?? 'iOS device' }];
        });
    } finally {
        fs.rmSync(outputFile, { force: true });
    }
}

ipcMain.handle('ios:list-devices', async () => listPhysicalIosDevices());

interface SimctlDevice { udid: string; name: string; state: string; isAvailable?: boolean; }

async function ensureIosSimulator(taskId: string): Promise<SimctlDevice> {
    const payload = JSON.parse(await runCapture('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])) as { devices?: Record<string, SimctlDevice[]> };
    const devices = Object.values(payload.devices ?? {}).flat().filter((device) => device.isAvailable !== false);
    const simulator = devices.find((device) => device.state === 'Booted') ?? devices[0];
    if (!simulator) throw new Error('No available iOS Simulator runtime was found. Install one from Xcode Settings > Platforms.');
    if (simulator.state !== 'Booted') await runCapture('xcrun', ['simctl', 'boot', simulator.udid], process.env, taskId);
    if (process.platform === 'darwin') await runCapture('open', ['-a', 'Simulator'], process.env, taskId);
    await runCapture('xcrun', ['simctl', 'bootstatus', simulator.udid, '-b'], process.env, taskId);
    return simulator;
}

async function iosAppBundleIdentifier(appBundle: string, taskId: string): Promise<string> {
    const infoPlist = path.join(appBundle, 'Info.plist');
    if (!fs.existsSync(infoPlist)) throw new Error(`Built app has no Info.plist: ${appBundle}`);
    const identifier = (await runCapture(
        '/usr/bin/plutil',
        ['-extract', 'CFBundleIdentifier', 'raw', infoPlist],
        process.env,
        taskId,
    )).trim();
    if (!identifier) throw new Error(`Built app has no CFBundleIdentifier: ${appBundle}`);
    return identifier;
}

ipcMain.handle('ios:deploy', async (_event, request: IosDeployRequest) => {
    const resolved = findProjectAndProfile(request.projectId, request.profileId);
    if (!resolved || resolved.profile.platform !== 'ios') throw new Error('iOS build environment not found.');
    createManagedJob(request.taskId, 'deploy', `${request.target === 'simulator' ? 'Run iOS Simulator' : request.target === 'device' ? 'Deploy iOS device' : 'Upload TestFlight'} · ${resolved.profile.label}`, request.projectId, request.profileId, ['Prepare target', 'Build package', 'Install or upload', 'Launch'], { action: request.target === 'simulator' ? 'Run iOS Simulator' : request.target === 'device' ? 'Deploy iOS device' : 'Upload TestFlight' });
    updateManagedJob(request.taskId, { status: 'running', progress: 5 }); updateManagedTask(request.taskId, 0, 'running', 10);
    updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: 'uploading', deploymentTaskId: request.taskId, deploymentFinishedAt: undefined, deploymentErrorDetails: undefined });
    try {
    const { profile, buildOutputDir } = resolved;
    if (!profile.packageName) throw new Error('Bundle identifier is required.');
    if (request.target !== 'simulator' && !profile.iosTeamId) throw new Error('Apple Team ID is required.');
    const projectFile = findFirst(buildOutputDir, '.xcodeproj');
    if (!projectFile) throw new Error('No generated Xcode project was found. Build this environment first.');
    const projectInfo = JSON.parse(await runCapture('xcodebuild', ['-project', projectFile, '-list', '-json'], process.env, request.taskId)) as { project?: { schemes?: string[] } };
    const scheme = projectInfo.project?.schemes?.find((value) => value.endsWith('-mobile')) ?? projectInfo.project?.schemes?.[0];
    if (!scheme) throw new Error('No buildable Xcode scheme was found.');
    const deployRoot = path.join(buildOutputDir, '.deploy');
    fs.mkdirSync(deployRoot, { recursive: true });
    if (request.target === 'simulator') {
        const simulator = await ensureIosSimulator(request.taskId);
        const derived = path.join(deployRoot, 'simulator-derived');
        await runCapture('xcodebuild', ['-project', projectFile, '-scheme', scheme, '-configuration', 'Debug', '-sdk', 'iphonesimulator', '-destination', `id=${simulator.udid}`, '-derivedDataPath', derived, 'CODE_SIGNING_ALLOWED=NO', `PRODUCT_BUNDLE_IDENTIFIER=${profile.packageName}`, 'build'], process.env, request.taskId);
        const appBundle = findFirst(path.join(derived, 'Build', 'Products'), '.app');
        if (!appBundle) throw new Error('Xcode succeeded but no simulator .app bundle was found.');
        const bundleIdentifier = await iosAppBundleIdentifier(appBundle, request.taskId);
        if (bundleIdentifier !== profile.packageName) appendManagedLog(request.taskId, `[build-dashboard] Built bundle identifier is ${bundleIdentifier}; using the built app identity.`);
        await runCapture('xcrun', ['simctl', 'install', simulator.udid, appBundle], process.env, request.taskId);
        await runCapture('xcrun', ['simctl', 'launch', simulator.udid, bundleIdentifier], process.env, request.taskId);
        const message = `Installed and launched ${bundleIdentifier} in ${simulator.name}.`;
        updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: 'success', deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: undefined });
        updateManagedJob(request.taskId, { status: 'success', progress: 100 });
        return message;
    }
    if (request.target === 'device') {
        if (!request.deviceId) throw new Error('Select a connected iOS device.');
        const derived = path.join(deployRoot, 'device-derived');
        await runCapture('xcodebuild', ['-project', projectFile, '-scheme', scheme, '-configuration', 'Debug', '-destination', `id=${request.deviceId}`, '-derivedDataPath', derived, '-allowProvisioningUpdates', `DEVELOPMENT_TEAM=${profile.iosTeamId}`, `PRODUCT_BUNDLE_IDENTIFIER=${profile.packageName}`, 'build'], process.env, request.taskId);
        const appBundle = findFirst(path.join(derived, 'Build', 'Products'), '.app');
        if (!appBundle) throw new Error('Xcode succeeded but no .app bundle was found.');
        const bundleIdentifier = await iosAppBundleIdentifier(appBundle, request.taskId);
        if (bundleIdentifier !== profile.packageName) appendManagedLog(request.taskId, `[build-dashboard] Built bundle identifier is ${bundleIdentifier}; using the built app identity.`);
        await runCapture('xcrun', ['devicectl', 'device', 'install', 'app', '--device', request.deviceId, appBundle], process.env, request.taskId);
        await runCapture('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', request.deviceId, bundleIdentifier], process.env, request.taskId);
        const message = `Installed and launched ${bundleIdentifier}.`;
        updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: 'success', deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: undefined });
        updateManagedJob(request.taskId, { status: 'success', progress: 100 });
        return message;
    }
    if (!profile.iosApiKeyId || !profile.iosApiIssuerId || !profile.iosApiKeyPath) throw new Error('App Store Connect Key ID, Issuer ID, and .p8 key are required.');
    const archive = path.join(deployRoot, `${profile.id}.xcarchive`);
    const exportDir = path.join(deployRoot, 'testflight');
    await runCapture('xcodebuild', ['-project', projectFile, '-scheme', scheme, '-configuration', 'Release', '-archivePath', archive, '-allowProvisioningUpdates', `DEVELOPMENT_TEAM=${profile.iosTeamId}`, `PRODUCT_BUNDLE_IDENTIFIER=${profile.packageName}`, 'archive'], process.env, request.taskId);
    const exportOptions = path.join(deployRoot, 'ExportOptions.plist');
    fs.writeFileSync(exportOptions, `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>method</key><string>app-store-connect</string><key>signingStyle</key><string>automatic</string><key>teamID</key><string>${profile.iosTeamId}</string></dict></plist>`);
    await runCapture('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', exportDir, '-exportOptionsPlist', exportOptions, '-allowProvisioningUpdates'], process.env, request.taskId);
    const ipa = findFirst(exportDir, '.ipa'); if (!ipa) throw new Error('No IPA was produced.');
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-testflight-'));
    const keysDir = path.join(tempHome, '.appstoreconnect', 'private_keys'); fs.mkdirSync(keysDir, { recursive: true });
    fs.copyFileSync(profile.iosApiKeyPath, path.join(keysDir, `AuthKey_${profile.iosApiKeyId}.p8`));
    const transporter = ['/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter', '/usr/local/itms/bin/iTMSTransporter'].find(fs.existsSync);
    try {
        if (transporter) {
            await runCapture(transporter, ['-m', 'upload', '-assetFile', ipa, '-apiKey', profile.iosApiKeyId, '-apiIssuer', profile.iosApiIssuerId], { ...process.env, HOME: tempHome }, request.taskId);
        } else {
            await runCapture('xcrun', ['altool', '--upload-app', '--file', ipa, '--type', 'ios', '--apiKey', profile.iosApiKeyId, '--apiIssuer', profile.iosApiIssuerId], { ...process.env, HOME: tempHome }, request.taskId);
        }
    }
    finally { fs.rmSync(tempHome, { recursive: true, force: true }); }
    const message = `Uploaded ${path.basename(ipa)} to TestFlight.`;
    updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: 'success', deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: undefined });
    updateManagedJob(request.taskId, { status: 'success', progress: 100 });
    return message;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateDeploymentRecord(request.projectId, request.profileId, { deploymentStatus: message === 'Deployment canceled.' ? 'canceled' : 'failed', deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: message });
        appendManagedLog(request.taskId, message); updateManagedJob(request.taskId, { status: message === 'Deployment canceled.' ? 'canceled' : 'failed' });
        throw error;
    }
});

ipcMain.handle('jobs:list', () => readManagedJobs());
ipcMain.handle('jobs:get', (_event, jobId: string) => readManagedJobs().find((job) => job.id === jobId) ?? null);
ipcMain.handle('jobs:clear-finished', () => {
    const jobs = readManagedJobs(); const remaining = jobs.filter((job) => job.status === 'pending' || job.status === 'running'); const removed = jobs.length - remaining.length;
    if (removed) writeManagedJobs(remaining); return removed;
});

ipcMain.handle('updates:get-state', () => dashboardUpdater?.getState());
ipcMain.handle('updates:save-preferences', (_event, preferences) => dashboardUpdater?.savePreferences(preferences));
ipcMain.handle('updates:check', () => dashboardUpdater?.check());
ipcMain.handle('updates:download', () => dashboardUpdater?.download());
ipcMain.handle('updates:install', () => dashboardUpdater?.install());

const EMPTY_RELEASE_CONFIG: ReleaseDeploymentConfig = {
    releaseRepositoryPath: '', repository: '', branch: 'main', workflowFile: 'release.yml', githubToken: '', githubAuthStatus: '', updateBaseUrl: '', r2Endpoint: '', r2Bucket: '', r2AccessKeyId: '', r2SecretAccessKey: '', macCertificate: '', macCertificatePassword: '', appleId: '', appleAppPassword: '', appleTeamId: '', windowsCertificate: '', windowsCertificatePassword: '', windowsPublisherName: '',
};

function readReleaseDeploymentConfig(): ReleaseDeploymentConfig {
    const hydrate = (config: ReleaseDeploymentConfig): ReleaseDeploymentConfig => {
        try {
            if (!config.releaseRepositoryPath) return { ...config, githubAuthStatus: githubAuthenticationStatus(config) };
            const remote = git(config.releaseRepositoryPath, ['remote', 'get-url', 'origin']); const repository = githubSlug(remote);
            const branch = config.branch.trim() || git(config.releaseRepositoryPath, ['branch', '--show-current']) || 'main';
            return { ...config, repository, branch, githubAuthStatus: githubAuthenticationStatus(config), updateBaseUrl: repository ? `https://github.com/${repository}/releases` : '' };
        } catch { return { ...config, githubAuthStatus: githubAuthenticationStatus(config) }; }
    };
    try { const stored = JSON.parse(fs.readFileSync(RELEASE_DEPLOYMENT_FILE, 'utf8')) as Partial<ReleaseDeploymentConfig> & { encrypted?: string }; const value = stored.encrypted && safeStorage.isEncryptionAvailable() ? JSON.parse(safeStorage.decryptString(Buffer.from(stored.encrypted, 'base64'))) as Partial<ReleaseDeploymentConfig> : stored; return hydrate({ ...EMPTY_RELEASE_CONFIG, ...value, releaseRepositoryPath: value.releaseRepositoryPath || detectReleaseRepositoryPath() }); }
    catch { return hydrate({ ...EMPTY_RELEASE_CONFIG, releaseRepositoryPath: detectReleaseRepositoryPath() }); }
}

function writeReleaseDeploymentConfig(config: ReleaseDeploymentConfig): void {
    fs.mkdirSync(path.dirname(RELEASE_DEPLOYMENT_FILE), { recursive: true }); const payload = safeStorage.isEncryptionAvailable() ? { encrypted: safeStorage.encryptString(JSON.stringify(config)).toString('base64') } : config;
    fs.writeFileSync(RELEASE_DEPLOYMENT_FILE, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function githubRequest<T>(config: ReleaseDeploymentConfig, endpoint: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://api.github.com${endpoint}`, { ...init, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${config.githubToken}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...init.headers } });
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${(await response.text()).trim() || response.statusText}`);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
}

async function setGithubSecret(config: ReleaseDeploymentConfig, name: string, value: string): Promise<void> {
    const key = await githubRequest<{ key_id: string; key: string }>(config, `/repos/${config.repository}/actions/secrets/public-key`); await sodium.ready;
    const encrypted = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL));
    await githubRequest(config, `/repos/${config.repository}/actions/secrets/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ encrypted_value: sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL), key_id: key.key_id }) });
}

function githubAutomationConfig(config: ReleaseDeploymentConfig): { config?: ReleaseDeploymentConfig; source?: 'token' | 'gh' } {
    if (config.githubToken.trim()) return { config, source: 'token' };
    const result = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const token = result.status === 0 ? result.stdout.trim() : '';
    return token ? { config: { ...config, githubToken: token }, source: 'gh' } : {};
}

function githubAuthenticationStatus(config: ReleaseDeploymentConfig): string {
    if (config.githubToken.trim()) return 'Configured token';
    return githubAutomationConfig(config).source === 'gh' ? 'Authenticated GitHub CLI session' : 'Not authenticated';
}

async function configureGithubAutomation(config: ReleaseDeploymentConfig, secrets: Record<string, string>, jobId: string): Promise<'token' | 'gh' | undefined> {
    const auth = githubAutomationConfig(config);
    if (!auth.config || !auth.source) {
        appendManagedLog(jobId, '[build-dashboard] GitHub API automation skipped: enter a GitHub token or sign in with `gh auth login`. Verify Actions permissions, workflow permissions, and Actions secrets manually.');
        return undefined;
    }
    await Promise.all([
        githubRequest(auth.config, `/repos/${config.repository}`, { method: 'PATCH', body: JSON.stringify({ visibility: 'public' }) }),
        githubRequest(auth.config, `/repos/${config.repository}/actions/permissions`, { method: 'PUT', body: JSON.stringify({ enabled: true, allowed_actions: 'all', sha_pinning_required: false }) }),
        githubRequest(auth.config, `/repos/${config.repository}/actions/permissions/workflow`, { method: 'PUT', body: JSON.stringify({ default_workflow_permissions: 'write', can_approve_pull_request_reviews: false }) }),
    ]);
    const populatedSecrets = Object.entries(secrets).filter(([, value]) => Boolean(value));
    await Promise.all(populatedSecrets.map(([name, value]) => setGithubSecret(auth.config!, name, value)));
    appendManagedLog(jobId, `[build-dashboard] Made the release repository public, enabled GitHub Actions, set workflow permissions to read/write, disabled pull-request approvals, and synchronized ${populatedSecrets.length} Actions secrets using ${auth.source === 'gh' ? 'the authenticated GitHub CLI session' : 'the configured GitHub token'}.`);
    return auth.source;
}

function appendMacSigningLog(event: string, details: Record<string, unknown> = {}): void {
    try {
        fs.mkdirSync(path.dirname(MAC_SIGNING_LOG_FILE), { recursive: true });
        if (fs.existsSync(MAC_SIGNING_LOG_FILE) && fs.statSync(MAC_SIGNING_LOG_FILE).size > 1_000_000) fs.renameSync(MAC_SIGNING_LOG_FILE, `${MAC_SIGNING_LOG_FILE}.previous`);
        fs.appendFileSync(MAC_SIGNING_LOG_FILE, `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...details })}\n`, { encoding: 'utf8', mode: 0o600 });
    } catch { /* Diagnostics must never replace the original signing error. */ }
}

function runSecurity(args: string[], step: string, sensitiveValues: string[] = []): string {
    const redacted = new Set(sensitiveValues.filter(Boolean));
    appendMacSigningLog('security-command-start', { step, args: args.map((value) => redacted.has(value) ? '<redacted>' : value) });
    const startedAt = Date.now();
    const result = spawnSync('security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const stderr = result.stderr?.trim() ?? '';
    appendMacSigningLog('security-command-finish', { step, status: result.status, signal: result.signal, durationMs: Date.now() - startedAt, stdoutBytes: result.stdout?.length ?? 0, stderr });
    if (result.error || result.status !== 0) {
        const reason = stderr || result.error?.message || `security exited with status ${result.status ?? 'unknown'}`;
        throw new Error(`${step} failed: ${reason}. Diagnostic log: ${MAC_SIGNING_LOG_FILE}`);
    }
    return result.stdout ?? '';
}

function developerIdIdentities(): DeveloperIdIdentity[] {
    if (process.platform !== 'darwin') return [];
    const output = runSecurity(['find-identity', '-v', '-p', 'codesigning'], 'Inspect login Keychain identities');
    const identities: DeveloperIdIdentity[] = [];
    for (const line of output.split('\n')) {
        const match = line.match(/^\s*\d+\)\s+([0-9A-F]{40})\s+"(Developer ID Application: (.+) \(([A-Z0-9]{10})\))"/i);
        if (match) identities.push({ hash: match[1], name: match[2], teamId: match[4].toUpperCase() });
    }
    appendMacSigningLog('developer-id-identities-detected', { count: identities.length, identities: identities.map(({ name, teamId }) => ({ name, teamId })) });
    return identities;
}

function validateExportedIdentity(p12Path: string, password: string, identity: DeveloperIdIdentity): void {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-developer-id-'));
    const keychain = path.join(temporaryDirectory, 'validation.keychain-db');
    const keychainPassword = crypto.randomBytes(24).toString('base64url');
    try {
        runSecurity(['create-keychain', '-p', keychainPassword, keychain], 'Create validation Keychain', [keychainPassword]);
        runSecurity(['unlock-keychain', '-p', keychainPassword, keychain], 'Unlock validation Keychain', [keychainPassword]);
        runSecurity(['import', p12Path, '-k', keychain, '-P', password, '-f', 'pkcs12'], 'Import archive for validation', [password]);
        const output = runSecurity(['find-identity', '-v', '-p', 'codesigning', keychain], 'Verify exported signing identity');
        if (!output.includes(identity.hash) && !output.includes(`(${identity.teamId})`)) throw new Error(`The exported archive does not contain the selected ${identity.name} identity.`);
        appendMacSigningLog('export-validation-succeeded', { identity: identity.name, teamId: identity.teamId });
    } finally {
        spawnSync('security', ['delete-keychain', keychain], { stdio: 'ignore' });
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

function macSigningExporter(): string {
    const source = path.join(TOOL_RESOURCES_DIR, 'mac-signing', 'export-identity.m');
    const directory = path.join(app.getPath('userData'), 'native-tools');
    const executable = path.join(directory, 'export-identity');
    if (!fs.existsSync(source)) throw new Error(`The macOS signing exporter source is missing: ${source}`);
    if (!fs.existsSync(executable) || fs.statSync(executable).mtimeMs < fs.statSync(source).mtimeMs) {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        const result = spawnSync('xcrun', ['clang', '-fobjc-arc', '-framework', 'Foundation', '-framework', 'Security', source, '-o', executable], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        appendMacSigningLog('native-exporter-build', { status: result.status, stderr: result.stderr.trim() });
        if (result.status !== 0) throw new Error(`Could not build the selected-identity exporter: ${result.stderr.trim() || 'xcrun clang failed.'}`);
        fs.chmodSync(executable, 0o700);
    }
    return executable;
}

function exportSelectedIdentity(outputPath: string, password: string, identity: DeveloperIdIdentity): void {
    const executable = macSigningExporter();
    appendMacSigningLog('selected-identity-export-start', { identity: identity.name, teamId: identity.teamId });
    const result = spawnSync(executable, [identity.name, outputPath], { input: password, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    appendMacSigningLog('selected-identity-export-finish', { identity: identity.name, teamId: identity.teamId, status: result.status, signal: result.signal, stderr: result.stderr.trim() });
    if (result.status !== 0) throw new Error(`${result.stderr.trim() || 'The selected identity export failed.'} Diagnostic log: ${MAC_SIGNING_LOG_FILE}`);
    fs.chmodSync(outputPath, 0o600);
}

async function prepareMacSigning(config: ReleaseDeploymentConfig, requestedTeamId = '', keychainAuthorizationConfirmed = false, report: (progress: MacSigningProgress) => void = () => {}): Promise<MacSigningPreparation> {
    if (process.platform !== 'darwin') throw new Error('Developer ID identities can only be exported from macOS.');
    appendMacSigningLog('preparation-started', { requestedTeamId: requestedTeamId || undefined, configuredTeamId: config.appleTeamId || undefined });
    report({ phase: 'identity', status: 'active', detail: 'Inspecting the login Keychain.' });
    const identities = developerIdIdentities();
    if (!identities.length) return { status: 'manual-required', identities };
    const teamId = requestedTeamId.trim().toUpperCase() || config.appleTeamId.trim().toUpperCase();
    const identity = teamId ? identities.find((candidate) => candidate.teamId === teamId) : identities.length === 1 ? identities[0] : undefined;
    if (!identity) return { status: 'choose-team', identities };
    report({ phase: 'identity', status: 'complete', detail: `${identity.name} selected.` });
    if (!keychainAuthorizationConfirmed) return { status: 'authorization-required', identities, authorizationIdentityNames: [identity.name], appleTeamId: identity.teamId };
    const signingDirectory = path.join(app.getPath('userData'), 'signing');
    fs.mkdirSync(signingDirectory, { recursive: true, mode: 0o700 });
    const certificatePath = path.join(signingDirectory, `DeveloperIDApplication-${identity.teamId}.p12`);
    const password = crypto.randomBytes(32).toString('base64url');
    try {
        report({ phase: 'authorization', status: 'active', detail: `Approve export of ${identity.name} in the macOS prompt.` });
        exportSelectedIdentity(certificatePath, password, identity);
        report({ phase: 'authorization', status: 'complete', detail: 'Private-key export approved.' });
        report({ phase: 'validation', status: 'active', detail: 'Validating the encrypted archive in an isolated Keychain.' });
        validateExportedIdentity(certificatePath, password, identity);
        report({ phase: 'validation', status: 'complete', detail: 'Certificate and private key validated.' });
    } catch (error) {
        fs.rmSync(certificatePath, { force: true });
        const details = error instanceof Error ? error.message : String(error);
        appendMacSigningLog('preparation-failed', { identity: identity.name, teamId: identity.teamId, error: details });
        throw new Error(`Could not export and validate the Developer ID identity. ${details}`);
    }
    let githubSecretsUploaded = false;
    const resolvedConfig = { ...config, repository: config.repository.trim() };
    const auth = githubAutomationConfig(resolvedConfig);
    if (resolvedConfig.repository && auth.config) {
        report({ phase: 'github', status: 'active', detail: 'Uploading the encrypted certificate and password to GitHub Actions.' });
        await Promise.all([
            setGithubSecret(auth.config, 'MAC_CSC_LINK', fs.readFileSync(certificatePath).toString('base64')),
            setGithubSecret(auth.config, 'MAC_CSC_KEY_PASSWORD', password),
        ]);
        githubSecretsUploaded = true;
        report({ phase: 'github', status: 'complete', detail: 'GitHub Actions secrets synchronized.' });
    } else report({ phase: 'github', status: 'skipped', detail: 'Will synchronize when repository authentication is available.' });
    appendMacSigningLog('preparation-succeeded', { identity: identity.name, teamId: identity.teamId, certificatePath, githubSecretsUploaded });
    return { status: 'ready', identities, macCertificate: certificatePath, macCertificatePassword: password, appleTeamId: identity.teamId, githubSecretsUploaded };
}

interface WranglerResult { status: number | null; stdout: string; stderr: string; error?: Error; }

function runWrangler(args: string[]): WranglerResult | undefined {
    const direct = spawnSync('wrangler', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
    if (!direct.error || (direct.error as NodeJS.ErrnoException).code !== 'ENOENT') return direct as WranglerResult;
    const local = spawnSync('npx', ['--no-install', 'wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
    return local.status === 1 && /could not determine executable|canceled|not found/i.test(`${local.stderr}\n${local.stdout}`) ? undefined : local;
}

function ensureR2Bucket(config: ReleaseDeploymentConfig, jobId: string): void {
    const listed = runWrangler(['r2', 'bucket', 'list', '--json']);
    if (!listed) {
        appendManagedLog(jobId, '[build-dashboard] R2 bucket automation skipped because Wrangler is not installed. The configured bucket must already exist.');
        return;
    }
    if (listed.status !== 0) {
        appendManagedLog(jobId, '[build-dashboard] R2 bucket automation skipped because Wrangler is not authenticated. Run `wrangler login`, or create the bucket in Cloudflare.');
        return;
    }
    try {
        const buckets = JSON.parse(listed.stdout) as Array<{ name?: string }> | { buckets?: Array<{ name?: string }> };
        const values = Array.isArray(buckets) ? buckets : buckets.buckets ?? [];
        if (values.some((bucket) => bucket.name === config.r2Bucket)) {
            appendManagedLog(jobId, `[build-dashboard] Verified R2 bucket ${config.r2Bucket} through Wrangler.`);
            return;
        }
    } catch { /* Wrangler output formats differ; creation below remains authoritative. */ }
    const created = runWrangler(['r2', 'bucket', 'create', config.r2Bucket]);
    if (created?.status === 0) appendManagedLog(jobId, `[build-dashboard] Created R2 bucket ${config.r2Bucket} through the authenticated Wrangler session.`);
    else appendManagedLog(jobId, `[build-dashboard] Could not create R2 bucket ${config.r2Bucket} automatically. Verify the Wrangler login and Cloudflare account, then create the bucket manually if needed.`);
}

const RELEASE_REPOSITORY_MARKER = '.cocos-build-dashboard-release.json';
const RELEASE_COMMAND_FILE = '.release-command.json';

function git(repositoryPath: string, args: string[]): string {
    return execFileSync('git', args, { cwd: repositoryPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function githubSlug(remote: string): string {
    return remote.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/i)?.[1] ?? '';
}

function detectReleaseRepositoryPath(): string {
    const sourceRoot = path.join(__dirname, '..', '..');
    let projectRoot = sourceRoot;
    try { projectRoot = git(sourceRoot, ['rev-parse', '--show-toplevel']); } catch { /* Source may not be in Git. */ }
    const parent = path.dirname(projectRoot);
    const directories = fs.existsSync(parent) ? fs.readdirSync(parent, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(parent, entry.name)) : [];
    const marked = directories.find((candidate) => fs.existsSync(path.join(candidate, '.git')) && fs.existsSync(path.join(candidate, RELEASE_REPOSITORY_MARKER)));
    if (marked) return marked;
    const likely = directories.filter((candidate) => candidate !== projectRoot && fs.existsSync(path.join(candidate, '.git')) && /(?:dashboard|release)/i.test(path.basename(candidate)));
    return likely.length === 1 ? likely[0] : '';
}

function resolveReleaseRepository(config: ReleaseDeploymentConfig): { repositoryPath: string; repository: string; branch: string; remote: string } {
    const repositoryPath = path.resolve(config.releaseRepositoryPath || detectReleaseRepositoryPath());
    if (!config.releaseRepositoryPath && !detectReleaseRepositoryPath()) throw new Error('Choose the cloned release-control repository first.');
    if (!fs.existsSync(path.join(repositoryPath, '.git'))) throw new Error(`${repositoryPath} is not a Git repository. Clone the release repository, then choose its folder.`);
    const remote = git(repositoryPath, ['remote', 'get-url', 'origin']);
    const repository = githubSlug(remote);
    if (!repository) throw new Error('The release-control repository origin must point to a GitHub repository.');
    const branch = config.branch.trim() || git(repositoryPath, ['branch', '--show-current']) || 'main';
    return { repositoryPath, repository, branch, remote };
}

function writeJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function copyReleaseWorkflow(repositoryPath: string): void {
    const template = path.join(TOOL_RESOURCES_DIR, 'release-control', 'release.yml');
    if (!fs.existsSync(template)) throw new Error(`Release workflow template is missing: ${template}`);
    const target = path.join(repositoryPath, '.github', 'workflows', 'release.yml');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(template, target);
}

function commitAndPush(repositoryPath: string, branch: string, message: string, paths: string[], jobId?: string): void {
    const forced = paths.filter((entry) => entry === 'dashboard');
    const regular = paths.filter((entry) => entry !== 'dashboard');
    if (forced.length) git(repositoryPath, ['add', '--force', '--', ...forced]);
    if (regular.length) git(repositoryPath, ['add', '--', ...regular]);
    const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: repositoryPath }).status !== 0;
    if (!staged) return;
    git(repositoryPath, ['commit', '-m', message]);
    if (jobId) appendManagedLog(jobId, `[build-dashboard] ${message}`);
    git(repositoryPath, ['push', 'origin', `HEAD:${branch}`]);
}

function pullReleaseRepository(repositoryPath: string, branch: string): void {
    const hasCommit = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: repositoryPath }).status === 0;
    if (hasCommit) git(repositoryPath, ['pull', '--ff-only', 'origin', branch]);
}

function prepareReleaseRepository(config: ReleaseDeploymentConfig): ReleaseDeploymentConfig {
    const resolved = resolveReleaseRepository(config);
    pullReleaseRepository(resolved.repositoryPath, resolved.branch);
    writeJson(path.join(resolved.repositoryPath, RELEASE_REPOSITORY_MARKER), { schemaVersion: 1, type: 'cocos-build-dashboard-release' });
    copyReleaseWorkflow(resolved.repositoryPath);
    for (const file of ['requests/builds/.gitkeep', 'channels/.gitkeep']) {
        const target = path.join(resolved.repositoryPath, file); fs.mkdirSync(path.dirname(target), { recursive: true }); if (!fs.existsSync(target)) fs.writeFileSync(target, '');
    }
    commitAndPush(resolved.repositoryPath, resolved.branch, 'chore: configure dashboard release control', [RELEASE_REPOSITORY_MARKER, '.github/workflows/release.yml', 'requests/builds/.gitkeep', 'channels/.gitkeep']);
    return { ...config, releaseRepositoryPath: resolved.repositoryPath, repository: resolved.repository, branch: resolved.branch, workflowFile: 'release.yml' };
}

function releasePlatforms(config: ReleaseDeploymentConfig): Array<'macos' | 'windows'> {
    const configured = (...values: string[]): boolean => values.every((value) => Boolean(value.trim()));
    return [
        ...(configured(config.macCertificate, config.macCertificatePassword, config.appleId, config.appleAppPassword, config.appleTeamId) ? ['macos' as const] : []),
        ...(configured(config.windowsCertificate, config.windowsCertificatePassword, config.windowsPublisherName) ? ['windows' as const] : []),
    ];
}

function releaseDeploymentConfigComplete(config: ReleaseDeploymentConfig): boolean {
    const baseConfigured = [config.releaseRepositoryPath, config.repository, config.updateBaseUrl].every((value) => Boolean(value.trim()));
    return baseConfigured && releasePlatforms(config).length > 0;
}

async function verifyReleaseDeployment(config: ReleaseDeploymentConfig, jobId: string): Promise<ReleaseDeploymentConfig> {
    const normalized = prepareReleaseRepository(config);
    const certificateValue = (value: string): string => value && fs.existsSync(value) && fs.statSync(value).isFile() ? fs.readFileSync(value).toString('base64') : value;
    const secrets: Record<string, string> = { MAC_CSC_LINK: certificateValue(normalized.macCertificate), MAC_CSC_KEY_PASSWORD: normalized.macCertificatePassword, APPLE_ID: normalized.appleId, APPLE_APP_SPECIFIC_PASSWORD: normalized.appleAppPassword, APPLE_TEAM_ID: normalized.appleTeamId, WIN_CSC_LINK: certificateValue(normalized.windowsCertificate), WIN_CSC_KEY_PASSWORD: normalized.windowsCertificatePassword, WINDOWS_PUBLISHER_NAME: normalized.windowsPublisherName };
    const githubAutomation = await configureGithubAutomation(normalized, secrets, jobId);
    normalized.configuredAt = new Date().toISOString(); writeReleaseDeploymentConfig(normalized);
    appendManagedLog(jobId, githubAutomation ? '[build-dashboard] Verified the Git release repository and synchronized available platform secrets.' : '[build-dashboard] Verified the Git release repository. GitHub API-managed settings still require manual verification.');
    return normalized;
}

function syncDashboardSource(repositoryPath: string): void {
    if (!fs.existsSync(path.join(repositoryPath, RELEASE_REPOSITORY_MARKER))) throw new Error('The selected repository is not configured as a dashboard release-control repository.');
    const source = path.join(__dirname, '..', '..');
    const target = path.join(repositoryPath, 'dashboard');
    if (path.resolve(source) === path.resolve(target)) throw new Error('The release repository must be separate from the dashboard source repository.');
    fs.rmSync(target, { recursive: true, force: true });
    const excluded = new Set(['.git', 'node_modules', 'dist', 'release', 'data', '.codex', '.DS_Store']);
    const sensitive = /^(?:\.env(?:\..*)?|.*\.(?:p12|pfx|pem|key))$/i;
    fs.cpSync(source, target, { recursive: true, filter: (candidate) => !excluded.has(path.basename(candidate)) && !sensitive.test(path.basename(candidate)) });
}

function releaseDeploymentInfo(): import('./types').ReleaseDeploymentInfo {
    const root = path.join(__dirname, '..', '..');
    const config = readReleaseDeploymentConfig();
    const exists = (relative: string): boolean => fs.existsSync(path.join(root, relative));
    const configured = (...values: string[]): boolean => values.every((value) => Boolean(value.trim()));
    let gitRemote: string | undefined;
    try { gitRemote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* No registered remote. */ }
    const githubMatch = gitRemote?.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/i);
    const requirement = (id: string, category: import('./types').ReleaseRequirement['category'], name: string, description: string, configuration: string, status: import('./types').ReleaseRequirementStatus): import('./types').ReleaseRequirement => ({ id, category, name, description, configuration, status });
    return {
        development: !app.isPackaged,
        version: app.getVersion(),
        gitRemote,
        githubRepository: githubMatch?.[1],
        requirements: [
            requirement('builder', 'Distribution', 'Installer configuration', 'DMG/ZIP for Intel and Apple Silicon, plus a Windows NSIS installer.', 'electron-builder.config.cjs', exists('electron-builder.config.cjs') ? 'ready' : 'missing'),
            requirement('workflow', 'Distribution', 'Release workflow', 'Builds immutable versions and promotes only the selected version to production.', 'Release-control repository workflow', config.releaseRepositoryPath && fs.existsSync(path.join(config.releaseRepositoryPath, '.github', 'workflows', 'release.yml')) ? 'ready' : 'missing'),
            requirement('github', 'Distribution', 'Git release-control repository', 'Stores release requests and runs the release workflow after every pushed request.', 'Cloned sibling repository', configured(config.releaseRepositoryPath, config.repository) ? 'ready' : 'missing'),
            requirement('update-url', 'Update hosting', 'Public GitHub Releases', 'Hosts installers and automatic updates in the release-control repository.', 'GitHub Releases URL', configured(config.updateBaseUrl) ? 'ready' : 'missing'),
            requirement('mac-cert', 'macOS signing', 'Developer ID certificate', 'Signs the application so Gatekeeper and the updater trust future versions.', 'macOS certificate and password', configured(config.macCertificate, config.macCertificatePassword) ? 'ready' : 'missing'),
            requirement('mac-notary', 'macOS signing', 'Apple notarization', 'Notarizes direct-download builds for macOS 10.15 and later.', 'Apple ID, app password, and team ID', configured(config.appleId, config.appleAppPassword, config.appleTeamId) ? 'ready' : 'missing'),
            requirement('win-cert', 'Windows signing', 'Authenticode certificate', 'Signs the executable and NSIS installer for publisher verification and trusted updates.', 'Windows certificate, password, and publisher', configured(config.windowsCertificate, config.windowsCertificatePassword, config.windowsPublisherName) ? 'ready' : 'missing'),
        ],
    };
}

ipcMain.handle('release:get-info', () => releaseDeploymentInfo());
ipcMain.handle('release:open-guide', () => shell.openPath(path.join(__dirname, '..', '..', 'docs', 'releases.md')));
ipcMain.handle('release:get-config', () => readReleaseDeploymentConfig());
ipcMain.handle('release:inspect-repository', (_event, repositoryPath: string) => {
    const config = { ...readReleaseDeploymentConfig(), releaseRepositoryPath: repositoryPath };
    const resolved = resolveReleaseRepository(config);
    return { releaseRepositoryPath: resolved.repositoryPath, repository: resolved.repository, branch: resolved.branch, githubAuthStatus: githubAuthenticationStatus(config), updateBaseUrl: `https://github.com/${resolved.repository}/releases` };
});
ipcMain.handle('release:prepare-mac-signing', (event, config: ReleaseDeploymentConfig, teamId?: string, keychainAuthorizationConfirmed?: boolean) => prepareMacSigning(config, teamId, keychainAuthorizationConfirmed, (progress) => event.sender.send('release:mac-signing-progress', progress)));
ipcMain.handle('release:open-xcode', () => {
    const result = spawnSync('open', ['-a', 'Xcode'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Could not open Xcode. Install Xcode, then try again.');
});
ipcMain.handle('release:save-config', async (_event, config: ReleaseDeploymentConfig) => {
    let normalized: ReleaseDeploymentConfig = { ...EMPTY_RELEASE_CONFIG, ...config, branch: config.branch.trim() || 'main', workflowFile: 'release.yml', githubAuthStatus: githubAuthenticationStatus(config), updateBaseUrl: config.repository ? `https://github.com/${config.repository}/releases` : '', configuredAt: undefined };
    const complete = releaseDeploymentConfigComplete(normalized);
    return runManagedOperation('config', complete ? 'Configure dashboard releases' : 'Save deployment configuration draft', complete ? 'Configure Git release control and synchronize CI secrets' : 'Save incomplete release settings for later', async (jobId) => {
        writeReleaseDeploymentConfig(normalized);
        if (!complete) {
            appendManagedLog(jobId, '[build-dashboard] Saved an encrypted deployment configuration draft. Complete the remaining required fields before creating a release build.');
            return normalized;
        }
        return verifyReleaseDeployment(normalized, jobId);
    }, { action: complete ? 'Configure dashboard releases' : 'Save deployment configuration draft', sourceUrl: '/deploy/configurations' });
});
ipcMain.handle('release:list-builds', async () => {
    const config = readReleaseDeploymentConfig(); if (!config.releaseRepositoryPath) return [];
    const resolved = resolveReleaseRepository(config); try { pullReleaseRepository(resolved.repositoryPath, resolved.branch); git(resolved.repositoryPath, ['fetch', '--tags', '--prune', 'origin']); } catch { /* Show locally known completed builds while offline. */ }
    const requestsDirectory = path.join(resolved.repositoryPath, 'requests', 'builds');
    const requests = (['macos', 'windows'] as ReleasePlatform[]).flatMap((platform) => {
        const directory = path.join(requestsDirectory, platform); if (!fs.existsSync(directory)) return [];
        return fs.readdirSync(directory).filter((file) => file.endsWith('.json')).map((file) => ({ ...JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')) as { version: string; channel: import('./types').UpdateChannel; tag: string; createdAt: string }, platform }));
    });
    const releasesByTag = new Map<string, { assets: string[]; publishedAt?: string }>();
    await Promise.all([...new Set(requests.map((request) => request.tag))].map(async (tag) => {
        try {
            const response = await fetch(`https://api.github.com/repos/${resolved.repository}/releases/tags/${encodeURIComponent(tag)}`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
            if (!response.ok) return;
            const release = await response.json() as { assets?: Array<{ name?: string }>; published_at?: string };
            releasesByTag.set(tag, { assets: (release.assets ?? []).map((asset) => asset.name ?? ''), publishedAt: release.published_at });
        } catch { /* A missing or unreachable release is not a completed platform build. */ }
    }));
    type WorkflowRun = { status?: string; conclusion?: string | null; html_url?: string; head_commit?: { message?: string } };
    let workflowRuns: WorkflowRun[] = [];
    try {
        const endpoint = `/repos/${resolved.repository}/actions/workflows/${encodeURIComponent(config.workflowFile || 'release.yml')}/runs?branch=${encodeURIComponent(resolved.branch)}&event=push&per_page=100`;
        const auth = githubAutomationConfig(config).config;
        if (auth) workflowRuns = (await githubRequest<{ workflow_runs?: WorkflowRun[] }>(auth, endpoint)).workflow_runs ?? [];
        else {
            const response = await fetch(`https://api.github.com${endpoint}`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
            if (response.ok) workflowRuns = ((await response.json()) as { workflow_runs?: WorkflowRun[] }).workflow_runs ?? [];
        }
    } catch { /* Requests still remain visible if workflow status cannot be loaded. */ }
    return requests.map((request): ReleaseBuild => {
        const release = releasesByTag.get(request.tag); const assets = release?.assets ?? [];
        const platformAssets = assets.filter((name) => request.platform === 'macos' ? /\.(?:dmg|zip)$/i.test(name) : /\.exe$/i.test(name));
        const expectedMessage = `release: build dashboard ${request.platform} v${request.version}`;
        const run = workflowRuns.find((candidate) => candidate.head_commit?.message?.split('\n')[0] === expectedMessage);
        const failed = run?.status === 'completed' && Boolean(run.conclusion && run.conclusion !== 'success');
        return { id: `${request.tag}-${request.platform}`, tag: request.tag, version: request.version, name: `Dashboard v${request.version}`, platform: request.platform, channel: request.channel, createdAt: request.createdAt, publishedAt: release?.publishedAt, url: `https://github.com/${resolved.repository}/releases/tag/${request.tag}`, production: request.tag === config.productionTag, assets: platformAssets.length, status: platformAssets.length ? 'ready' : failed ? 'failed' : 'building', workflowUrl: run?.html_url };
    });
});
ipcMain.handle('release:create-build', (_event, request: CreateReleaseBuildRequest) => runManagedOperation('build', `Build dashboard v${request.version}`, 'Queue signed release build', async (jobId) => {
    let config = readReleaseDeploymentConfig(); if (!releaseDeploymentConfigComplete(config)) throw new Error('Configure the release repository and at least one complete platform before creating a build.');
    const platforms = releasePlatforms(config); if (!platforms.includes(request.platform)) throw new Error(`${request.platform === 'macos' ? 'macOS' : 'Windows'} signing is not completely configured.`);
    if (!config.configuredAt) config = await verifyReleaseDeployment(config, jobId);
    const resolved = resolveReleaseRepository(config); pullReleaseRepository(resolved.repositoryPath, resolved.branch); const version = request.version;
    updateManagedJob(jobId, { progress: 20 }); syncDashboardSource(resolved.repositoryPath); updateManagedJob(jobId, { progress: 65 });
    const command = { action: 'build', version, channel: request.channel, tag: `dashboard-v${version}`, platform: request.platform, createdAt: new Date().toISOString() };
    const requestFile = `requests/builds/${request.platform}/${version}.json`;
    writeJson(path.join(resolved.repositoryPath, requestFile), command); writeJson(path.join(resolved.repositoryPath, RELEASE_COMMAND_FILE), command);
    commitAndPush(resolved.repositoryPath, resolved.branch, `release: build dashboard ${request.platform} v${version}`, ['dashboard', requestFile, RELEASE_COMMAND_FILE], jobId);
    appendManagedLog(jobId, `[build-dashboard] Pushed ${request.platform} v${version} (${request.channel}) to ${config.repository}. GitHub Actions will build and upload only that platform.`); return jobId;
}, { action: 'Build dashboard release', sourceUrl: '/deploy/builds' }));
ipcMain.handle('release:promote-build', (_event, tag: string) => runManagedOperation('deploy', `Roll ${tag} to production`, 'Publish selected build to update feed', async (jobId) => {
    const config = readReleaseDeploymentConfig(); if (!config.releaseRepositoryPath || !config.configuredAt) throw new Error('Deployment configuration has not been verified. Open Deploy → Configurations and save it successfully first.');
    const resolved = resolveReleaseRepository(config); pullReleaseRepository(resolved.repositoryPath, resolved.branch); const command = { action: 'promote', tag, createdAt: new Date().toISOString() };
    writeJson(path.join(resolved.repositoryPath, 'channels', 'production.json'), command); writeJson(path.join(resolved.repositoryPath, RELEASE_COMMAND_FILE), command);
    commitAndPush(resolved.repositoryPath, resolved.branch, `release: promote ${tag}`, ['channels/production.json', RELEASE_COMMAND_FILE], jobId);
    config.productionTag = tag; writeReleaseDeploymentConfig(config); appendManagedLog(jobId, `[build-dashboard] Pushed the production pointer for ${tag}. GitHub Actions will publish it to the update feed.`); return jobId;
}, { action: 'Roll dashboard build to production', sourceUrl: '/deploy/builds' }));

ipcMain.handle('dialog:pick-folder', async () => {
    if (!mainWindow) {
        return null;
    }
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('dialog:pick-file', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('dialog:pick-executable', async () => {
    if (!mainWindow) {
        return null;
    }
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'treatPackageAsDirectory'],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('dialog:pick-image', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('dialog:pick-project-icon', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Choose a 1024 × 1024 project icon',
        properties: ['openFile'],
        filters: [{ name: 'PNG image', extensions: ['png'] }],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('loading-screen:get', (_event, projectPath: string, platforms: string[]) => getLoadingScreen(projectPath, platforms));
ipcMain.handle('loading-screen:save', (_event, projectPath: string, document, platforms: string[]) => { const result = saveLoadingScreen(projectPath, document, platforms, TOOL_RESOURCES_DIR); recordCompletedJob('config', 'Save loading screen configuration', `Saved loading configuration for ${projectPath}.`); return result; });
ipcMain.handle('loading-screen:open-web-preview', async (_event, projectPath: string, platform: string | null, progress: number) => {
    const key = `${path.resolve(projectPath)}:${platform ?? 'project'}`; const existing = loadingPreviewServers.get(key); if (existing) { existing.close(); loadingPreviewServers.delete(key); }
    const target = path.join(app.getPath('temp'), 'cocos-build-dashboard-loading-preview', crypto.createHash('sha1').update(key).digest('hex'));
    createLoadingWebPreview(projectPath, platform, target, TOOL_RESOURCES_DIR, progress);
    const server = http.createServer((request, response) => { try { const requestUrl = new URL(request.url ?? '/', 'http://localhost'); const relative = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, '')) || 'index.html'; const file = path.resolve(target, relative); if (file !== target && !file.startsWith(`${target}${path.sep}`)) { response.writeHead(403).end('Forbidden'); return; } if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end('Not found'); return; } response.setHeader('Content-Type', WEB_MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'); response.setHeader('Cache-Control', 'no-store'); response.writeHead(200); fs.createReadStream(file).pipe(response); } catch (error) { response.writeHead(500).end(error instanceof Error ? error.message : String(error)); } });
    const url = await new Promise<string>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); if (!address || typeof address === 'string') { reject(new Error('Could not start the loading preview server.')); return; } resolve(`http://localhost:${address.port}/`); }); });
    loadingPreviewServers.set(key, server); await shell.openExternal(url); return url;
});
ipcMain.handle('loading-screen:set-asset', (_event, projectPath: string, platform: string | null, kind, source: string) => {
    setLoadingAsset(projectPath, platform, kind, source);
    const project = readProjects().projects.find((item) => item.projectPath === projectPath);
    return getLoadingScreen(projectPath, Array.from(new Set(project?.profiles.map((profile) => profile.platform) ?? [])));
});
ipcMain.handle('loading-screen:clear-asset', (_event, projectPath: string, platform: string | null, kind) => {
    clearLoadingAsset(projectPath, platform, kind);
    const project = readProjects().projects.find((item) => item.projectPath === projectPath);
    return getLoadingScreen(projectPath, Array.from(new Set(project?.profiles.map((profile) => profile.platform) ?? [])));
});
ipcMain.handle('loading-screen:set-component-asset', (_event, projectPath: string, platform: string | null, componentId: string, source: string) => {
    setLoadingComponentAsset(projectPath, platform, componentId, source);
    const project = readProjects().projects.find((item) => item.projectPath === projectPath);
    return getLoadingScreen(projectPath, Array.from(new Set(project?.profiles.map((profile) => profile.platform) ?? [])));
});

// TOOL_BUILD_TEMPLATES_DIR is organized as build-templates/<platform>/...
// (matching Cocos's own per-project convention). Fall back to the root
// itself if there's no <platform> subfolder, for anyone who just dumps
// platform-agnostic files straight in build-templates/.
function resolveTemplateSourceForPlatform(platform: string): string {
    const platformSubfolder = path.join(TOOL_BUILD_TEMPLATES_DIR, platform);
    return fs.existsSync(platformSubfolder) && fs.statSync(platformSubfolder).isDirectory()
        ? platformSubfolder
        : TOOL_BUILD_TEMPLATES_DIR;
}

function listFilesRecursive(dir: string, baseDir: string): string[] {
    const result: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.DS_Store') {
            continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...listFilesRecursive(full, baseDir));
        } else {
            result.push(path.relative(baseDir, full).split(path.sep).join('/'));
        }
    }
    return result;
}

ipcMain.handle('template:status', (_event, projectPath: string, platform: string) => {
    const source = resolveTemplateSourceForPlatform(platform);
    const destination = path.join(projectPath, 'build-templates', platform);
    const sourceFiles = fs.existsSync(source) ? listFilesRecursive(source, source) : [];
    const destinationFiles = fs.existsSync(destination) ? listFilesRecursive(destination, destination) : [];
    const destinationSet = new Set(destinationFiles);
    const unchanged: string[] = [];
    const modified: string[] = [];
    const missing: string[] = [];
    for (const relative of sourceFiles) {
        if (!destinationSet.has(relative)) {
            missing.push(relative);
            continue;
        }
        const sourceFile = path.join(source, ...relative.split('/'));
        const destinationFile = path.join(destination, ...relative.split('/'));
        fs.readFileSync(sourceFile).equals(fs.readFileSync(destinationFile)) ? unchanged.push(relative) : modified.push(relative);
    }
    const sourceSet = new Set(sourceFiles);
    const projectOnly = destinationFiles.filter((relative) => !sourceSet.has(relative));
    const state = sourceFiles.length === 0
        ? 'unavailable'
        : destinationFiles.length === 0
            ? 'not-installed'
            : missing.length > 0
                ? 'partial'
                : modified.length > 0 || projectOnly.length > 0
                    ? 'customized'
                    : 'installed';
    return {
        state,
        sourceFileCount: sourceFiles.length,
        installedFileCount: destinationFiles.length,
        unchanged,
        modified,
        missing,
        projectOnly,
        destination: `build-templates/${platform}/`,
    };
});

ipcMain.handle('template:import', (_event, projectPath: string, platform: string, relativePaths: string[]) => {
    return runManagedOperation('install', `Import ${platform} build template`, 'Copy template files', () => {
        const actualSource = resolveTemplateSourceForPlatform(platform);
        const destFolder = path.join(projectPath, 'build-templates', platform);
        for (const relPath of relativePaths) {
            const relOsPath = relPath.split('/').join(path.sep);
            const srcFile = path.join(actualSource, relOsPath);
            const destFile = path.join(destFolder, relOsPath);
            try {
                fs.mkdirSync(path.dirname(destFile), { recursive: true });
                fs.copyFileSync(srcFile, destFile);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Copy "${relPath}" failed: ${message}`);
            }
        }
    }, { action: `Import ${platform} build template`, projectPath, sourceUrl: `/projects/${encodeURIComponent(readProjects().projects.find((project) => path.resolve(project.projectPath) === path.resolve(projectPath))?.id ?? '')}/${encodeURIComponent(platform)}/templates` });
});

ipcMain.handle('codebase:list', (_event, projectPath: string) => {
    const sourceRoot = codebaseDirectory(projectPath);
    if (!fs.existsSync(sourceRoot)) {
        return [];
    }
    return listFilesRecursive(sourceRoot, sourceRoot).filter((p) => !p.endsWith('.meta') && path.basename(p) !== '.gitkeep');
});

ipcMain.handle('codebase:find-conflicts', (_event, projectPath: string, relativePaths: string[]) => {
    const destRoot = path.join(projectPath, PROJECT_SCRIPTS_SUBDIR);
    return relativePaths.filter((rel) => fs.existsSync(path.join(destRoot, ...rel.split('/'))));
});

ipcMain.handle('codebase:import', (_event, projectPath: string, relativePaths: string[]) => {
    return runManagedOperation('install', 'Import shared codebase', 'Copy codebase files', () => {
        const sourceRoot = codebaseDirectory(projectPath);
        const destRoot = path.join(projectPath, PROJECT_SCRIPTS_SUBDIR);
        const copyIfSourceExists = (relOsPath: string, overwrite: boolean): void => {
            const src = path.join(sourceRoot, relOsPath);
            const dest = path.join(destRoot, relOsPath);
            if (!fs.existsSync(src) || (!overwrite && fs.existsSync(dest))) return;
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
        };
        for (const relPath of relativePaths) {
            const parts = relPath.split('/');
            try {
                // Folder .meta first, never overwritten: keeps the project's existing folder UUIDs.
                for (let i = 1; i < parts.length; i++) copyIfSourceExists(parts.slice(0, i).join(path.sep) + '.meta', false);
                const relOsPath = parts.join(path.sep);
                copyIfSourceExists(relOsPath, true);
                // File .meta also kept if the project already has one, so the script's UUID stays stable.
                copyIfSourceExists(relOsPath + '.meta', false);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Copy "${relPath}" failed: ${message}`);
            }
        }
    }, { action: 'Import shared codebase', projectPath });
});

ipcMain.handle('build:cancel',(_event, jobId: string) => {
    if (currentJob?.id === jobId && currentChild) {
        currentJob.status = 'canceled';
        sendStatus(jobId, 'canceled');
        if (process.platform !== 'win32' && currentChild.pid) {
            try { process.kill(-currentChild.pid, 'SIGTERM'); } catch { currentChild.kill('SIGTERM'); }
        } else currentChild.kill('SIGTERM');
        return;
    }
    const pendingIndex = jobQueue.findIndex((j) => j.id === jobId);
    if (pendingIndex >= 0) {
        jobQueue.splice(pendingIndex, 1);
        sendStatus(jobId, 'canceled');
    }
});

function markProfileCanceled(projectId: string, profileId: string): void {
    const history = readBuildHistory(); const key = buildRecordKey(projectId, profileId); const record = history[key];
    if (!record) return;
    history[key] = { ...record, status: 'canceled', finishedAt: new Date().toISOString() };
    writeBuildHistory(history);
}

function stopOrphanedCreatorBuild(projectPath: string): boolean {
    if (process.platform === 'win32') return false;
    let stopped = false;
    try {
        const output = execSync('ps -axo pid,command', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        for (const line of output.split('\n')) {
            const targetsProject = line.includes(`--project ${projectPath}`) || line.includes(`--path ${projectPath}`);
            if (!line.includes('CocosCreator') || !targetsProject || !line.includes('--build')) continue;
            const pid = Number(line.trim().split(/\s+/)[0]); if (!Number.isInteger(pid) || pid <= 1) continue;
            try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { continue; } }
            stopped = true;
        }
    } catch { /* process inspection is best-effort */ }
    return stopped;
}

ipcMain.handle('build:cancel-profile', (_event, projectId: string, profileId: string) => {
    const active = currentJob?.projectId === projectId && currentJob.profileId === profileId ? currentJob : undefined;
    if (active) {
        if (currentChild) {
            active.status = 'canceled';
            sendStatus(active.id, 'canceled');
            if (process.platform !== 'win32' && currentChild.pid) {
                try { process.kill(-currentChild.pid, 'SIGTERM'); } catch { currentChild.kill('SIGTERM'); }
            } else currentChild.kill('SIGTERM');
        }
        return;
    }
    const pending = jobQueue.findIndex((job) => job.projectId === projectId && job.profileId === profileId);
    if (pending >= 0) { const [job] = jobQueue.splice(pending, 1); sendStatus(job.id, 'canceled'); return; }
    const project = readProjects().projects.find((candidate) => candidate.id === projectId);
    if (project) stopOrphanedCreatorBuild(project.projectPath);
    markProfileCanceled(projectId, profileId);
});

function reconcileInterruptedBuilds(): void {
    const history = readBuildHistory(); const projects = readProjects().projects; let changed = false;
    const stoppedProjects = new Set<string>();
    for (const [key, record] of Object.entries(history)) {
        const buildInterrupted = record.status === 'pending' || record.status === 'running';
        const deploymentInterrupted = record.deploymentStatus === 'uploading';
        if (!buildInterrupted && !deploymentInterrupted) continue;
        if (buildInterrupted) {
            const project = projects.find((candidate) => candidate.id === record.projectId);
            if (project && !stoppedProjects.has(project.id)) { stopOrphanedCreatorBuild(project.projectPath); stoppedProjects.add(project.id); }
        }
        history[key] = {
            ...record,
            ...(buildInterrupted ? { status: 'canceled' as const, finishedAt: new Date().toISOString() } : {}),
            ...(deploymentInterrupted ? { deploymentStatus: 'canceled' as const, deploymentTaskId: undefined, deploymentFinishedAt: new Date().toISOString(), deploymentErrorDetails: 'Deployment was interrupted when the dashboard stopped.' } : {}),
        };
        changed = true;
    }
    if (changed) writeBuildHistory(history);
}

function readWindowState(): WindowState {
    const fallback: WindowState = { width: 1000, height: 700, maximized: false };
    try {
        const saved = JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, 'utf8')) as Partial<WindowState>;
        const width = Math.max(800, Number(saved.width) || fallback.width); const height = Math.max(600, Number(saved.height) || fallback.height);
        const candidate = { x: Number(saved.x), y: Number(saved.y), width, height };
        const visible = Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && screen.getAllDisplays().some((display) => {
            const area = display.workArea; return candidate.x < area.x + area.width - 80 && candidate.x + width > area.x + 80 && candidate.y < area.y + area.height - 48 && candidate.y + height > area.y + 48;
        });
        return { ...(visible ? { x: candidate.x, y: candidate.y } : {}), width, height, maximized: saved.maximized === true };
    } catch { return fallback; }
}

function writeWindowState(window: BrowserWindow): void {
    if (window.isDestroyed()) return;
    const bounds = window.getNormalBounds(); const state: WindowState = { ...bounds, maximized: window.isMaximized() };
    fs.mkdirSync(path.dirname(WINDOW_STATE_FILE), { recursive: true });
    fs.writeFileSync(WINDOW_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function scheduleWindowStateSave(window: BrowserWindow): void {
    if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = setTimeout(() => { windowStateSaveTimer = undefined; writeWindowState(window); }, 180);
}

function createWindow(): void {
    const state = readWindowState();
    mainWindow = new BrowserWindow({
        ...state,
        show: false,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#111318',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    const window = mainWindow;
    if (state.maximized) window.maximize();
    window.on('resize', () => scheduleWindowStateSave(window)); window.on('move', () => scheduleWindowStateSave(window));
    window.on('maximize', () => scheduleWindowStateSave(window)); window.on('unmaximize', () => scheduleWindowStateSave(window));
    window.on('close', () => { if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer); windowStateSaveTimer = undefined; writeWindowState(window); });
    window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
    void window.loadFile(path.join(__dirname, '..', '..', 'src', 'index.html'));
    const fallbackShow = setTimeout(() => { if (!window.isDestroyed() && !window.isVisible()) window.show(); }, 10000);
    window.once('closed', () => clearTimeout(fallbackShow));
}

ipcMain.handle('app:renderer-ready', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed() && !window.isVisible()) window.show();
});

app.whenReady().then(() => {
    reconcileInterruptedBuilds(); createWindow();
    dashboardUpdater = new DashboardUpdater({
        hasActiveWork: () => readManagedJobs().some((job) => job.type !== 'update' && (job.status === 'pending' || job.status === 'running')),
        onState: (state) => mainWindow?.webContents.send('updates:state', state),
        onDownloadStarted: (version) => {
            const id = `job-${crypto.randomUUID()}`;
            createManagedJob(id, 'update', `Download Cocos Build Dashboard ${version}`, undefined, undefined, ['Download update'], { action: 'Update', sourceUrl: '/settings' });
            updateManagedJob(id, { status: 'running', progress: 0 }); updateManagedTask(id, 0, 'running', 0);
            appendManagedLog(id, `[build-dashboard] Downloading update ${version}.`); return id;
        },
        onDownloadProgress: (id, progress) => { updateManagedJob(id, { progress }); updateManagedTask(id, 0, 'running', progress); },
        onDownloadFinished: (id, error) => {
            if (error) { appendManagedLog(id, error); updateManagedTask(id, 0, 'failed', 100, error); updateManagedJob(id, { status: 'failed', progress: 100 }); }
            else { appendManagedLog(id, '[build-dashboard] Update downloaded and ready to install.'); updateManagedTask(id, 0, 'success', 100); updateManagedJob(id, { status: 'success', progress: 100 }); }
        },
    });
    dashboardUpdater.start();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppUpdatePreferences, AppUpdateState } from './types';

interface AppUpdaterOptions {
    hasActiveWork(): boolean;
    onState(state: AppUpdateState): void;
    onDownloadStarted(version: string): string;
    onDownloadProgress(jobId: string, progress: number): void;
    onDownloadFinished(jobId: string, error?: string): void;
}

const DEFAULTS: AppUpdatePreferences = { channel: 'stable', autoCheck: true, autoDownload: true };

export class DashboardUpdater {
    private readonly preferencesFile = path.join(app.getPath('userData'), 'update-preferences.json');
    private preferences = this.readPreferences();
    private readonly feedConfigured = app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
    private state: AppUpdateState = {
        ...this.preferences,
        currentVersion: app.getVersion(),
        stage: this.feedConfigured ? 'idle' : 'unsupported',
        progress: 0,
        packaged: app.isPackaged,
        feedConfigured: this.feedConfigured,
    };
    private downloadJobId?: string;
    private deferredInstall = false;
    private timer?: ReturnType<typeof setInterval>;

    constructor(private readonly options: AppUpdaterOptions) {
        autoUpdater.autoInstallOnAppQuit = false;
        this.configure();
        autoUpdater.on('checking-for-update', () => this.patch({ stage: 'checking', error: undefined, progress: 0 }));
        autoUpdater.on('update-available', (info) => {
            this.patch({ stage: 'available', availableVersion: info.version, checkedAt: new Date().toISOString() });
            if (this.preferences.autoDownload) void this.download();
        });
        autoUpdater.on('update-not-available', () => this.patch({ stage: 'not-available', availableVersion: undefined, checkedAt: new Date().toISOString(), progress: 0 }));
        autoUpdater.on('download-progress', (progress) => {
            const value = Math.max(0, Math.min(100, Math.round(progress.percent)));
            this.patch({ stage: 'downloading', progress: value });
            if (this.downloadJobId) this.options.onDownloadProgress(this.downloadJobId, value);
        });
        autoUpdater.on('update-downloaded', (info) => {
            this.patch({ stage: 'downloaded', availableVersion: info.version, progress: 100 });
            if (this.downloadJobId) this.options.onDownloadFinished(this.downloadJobId);
            this.downloadJobId = undefined;
        });
        autoUpdater.on('error', (error) => {
            const message = error instanceof Error ? error.message : String(error);
            this.patch({ stage: 'error', error: message });
            if (this.downloadJobId) this.options.onDownloadFinished(this.downloadJobId, message);
            this.downloadJobId = undefined;
        });
    }

    start(): void {
        if (!this.feedConfigured || !this.preferences.autoCheck) return;
        setTimeout(() => void this.check(), 15_000);
        this.timer = setInterval(() => void this.check(), 4 * 60 * 60 * 1000);
    }

    getState(): AppUpdateState { return { ...this.state }; }

    savePreferences(preferences: AppUpdatePreferences): AppUpdateState {
        this.preferences = { channel: preferences.channel === 'beta' ? 'beta' : 'stable', autoCheck: Boolean(preferences.autoCheck), autoDownload: Boolean(preferences.autoDownload) };
        fs.mkdirSync(path.dirname(this.preferencesFile), { recursive: true });
        fs.writeFileSync(this.preferencesFile, `${JSON.stringify(this.preferences, null, 2)}\n`, 'utf8');
        this.configure();
        this.patch(this.preferences);
        return this.getState();
    }

    async check(): Promise<AppUpdateState> {
        if (!this.feedConfigured) return this.getState();
        try { await autoUpdater.checkForUpdates(); } catch { /* The updater error event owns state. */ }
        return this.getState();
    }

    async download(): Promise<AppUpdateState> {
        if (!this.feedConfigured || !this.state.availableVersion || this.state.stage === 'downloading' || this.state.stage === 'downloaded') return this.getState();
        this.downloadJobId = this.options.onDownloadStarted(this.state.availableVersion);
        this.patch({ stage: 'downloading', progress: 0, error: undefined });
        try { await autoUpdater.downloadUpdate(); } catch { /* The updater error event owns state. */ }
        return this.getState();
    }

    install(): AppUpdateState {
        if (this.state.stage !== 'downloaded' && this.state.stage !== 'deferred') return this.getState();
        if (this.options.hasActiveWork()) {
            this.deferredInstall = true;
            this.patch({ stage: 'deferred' });
            return this.getState();
        }
        this.deferredInstall = false;
        setImmediate(() => autoUpdater.quitAndInstall(false, true));
        return this.getState();
    }

    resumeDeferredInstall(): void {
        if (this.deferredInstall && !this.options.hasActiveWork()) this.install();
    }

    private configure(): void {
        autoUpdater.allowPrerelease = this.preferences.channel === 'beta';
        autoUpdater.allowDowngrade = true;
        autoUpdater.channel = this.preferences.channel === 'beta' ? 'beta' : 'latest';
        autoUpdater.autoDownload = false;
    }

    private patch(changes: Partial<AppUpdateState>): void {
        this.state = { ...this.state, ...changes, ...this.preferences };
        this.options.onState(this.getState());
    }

    private readPreferences(): AppUpdatePreferences {
        try { return { ...DEFAULTS, ...(JSON.parse(fs.readFileSync(this.preferencesFile, 'utf8')) as Partial<AppUpdatePreferences>) }; }
        catch { return { ...DEFAULTS }; }
    }
}

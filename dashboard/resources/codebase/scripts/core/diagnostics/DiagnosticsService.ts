import { Game, game } from 'cc';
import { AppLifecycle } from '../app/types';
import { AnalyticsFacade } from '../analytics/AnalyticsFacade';

export interface DiagnosticsSession {
    sessionId: string;
    appVersion: string;
    startedAt: number;
}

const MAX_CRASH_REPORTS_PER_SESSION = 10;

/**
 * Bundles 3 always-on, non-gameplay concerns per COCOS_V3_TEMPLATE_PLAN.md:
 * crash/error reporting (fans out through AnalyticsFacade, rate-limited),
 * local app version, and session/foreground-background tracking. Comparing
 * the version against a remote minimum belongs to Phase 2 (needs
 * IRemoteConfig, which doesn't exist yet) — this only reports the local
 * version, it doesn't decide whether an update is required.
 */
export class DiagnosticsService implements AppLifecycle {
    private readonly analytics: AnalyticsFacade;
    private appVersion = '0.0.0';
    private session: DiagnosticsSession | null = null;
    private crashReportCount = 0;
    private pausedAt = 0;
    private backgroundDurationMs = 0;

    private readonly onWindowError = (event: ErrorEvent): void => {
        this.reportCrash(event.error instanceof Error ? event.error : new Error(event.message));
    };

    public constructor(analytics: AnalyticsFacade) {
        this.analytics = analytics;
    }

    public init(): void {
        this.startSession();

        if (typeof window !== 'undefined') {
            window.addEventListener('error', this.onWindowError);
        }

        game.on(Game.EVENT_HIDE, this.onGameHide, this);
        game.on(Game.EVENT_SHOW, this.onGameShow, this);
    }

    public destroy(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('error', this.onWindowError);
        }

        game.off(Game.EVENT_HIDE, this.onGameHide, this);
        game.off(Game.EVENT_SHOW, this.onGameShow, this);
    }

    public setAppVersion(version: string): void {
        this.appVersion = version;
        if (this.session) {
            this.session.appVersion = version;
        }
    }

    public getAppVersion(): string {
        return this.appVersion;
    }

    public startSession(): DiagnosticsSession {
        this.session = {
            sessionId: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            appVersion: this.appVersion,
            startedAt: Date.now(),
        };
        this.crashReportCount = 0;
        this.backgroundDurationMs = 0;
        this.pausedAt = 0;
        return this.session;
    }

    public getSession(): DiagnosticsSession | null {
        return this.session;
    }

    /** Wall-clock session time minus time spent backgrounded (tab hidden / app minimized). */
    public getSessionDurationMs(): number {
        if (!this.session) {
            return 0;
        }

        return Date.now() - this.session.startedAt - this.backgroundDurationMs;
    }

    public reportCrash(error: Error): void {
        if (this.crashReportCount >= MAX_CRASH_REPORTS_PER_SESSION) {
            return;
        }

        this.crashReportCount += 1;
        this.analytics.logEvent('crash', {
            message: error.message,
            stack: error.stack,
            sessionId: this.session?.sessionId,
        });
    }

    private onGameHide(): void {
        this.pausedAt = Date.now();
    }

    private onGameShow(): void {
        if (this.pausedAt > 0) {
            this.backgroundDurationMs += Date.now() - this.pausedAt;
            this.pausedAt = 0;
        }
    }
}

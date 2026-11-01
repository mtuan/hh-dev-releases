export enum AppState {
    Loading = 'Loading',
    Home = 'Home',
    Game = 'Game',
    Result = 'Result',
}

export interface GameAppConfig {
    name: string;
    initialScene: string;
    startingState?: AppState;
    debugMode?: boolean;
    loadingMinDurationMs?: number;
    services?: string[];
    platform?: {
        web?: boolean;
        android?: boolean;
        ios?: boolean;
    };
}

export const CoreServiceKey = {
    Asset: 'asset',
    Audio: 'audio',
    Input: 'input',
    Fx: 'fx',
    Data: 'data',
    I18n: 'i18n',
    Analytics: 'analytics',
    Diagnostics: 'diagnostics',
} as const;

export interface AppLifecycle {
    init?(): void | Promise<void>;
    start?(): void | Promise<void>;
    pause?(): void | Promise<void>;
    resume?(): void | Promise<void>;
    destroy?(): void | Promise<void>;
}

export type AppEventHandler<T = unknown> = (payload: T) => void;

export interface BootstrapContext {
    config: GameAppConfig;
    state: AppState;
    startedAt: number;
}

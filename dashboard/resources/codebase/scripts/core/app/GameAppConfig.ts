import { AppState, GameAppConfig as GameConfig } from './types';

export class GameAppConfig implements GameConfig {
    public name: string;
    public initialScene: string;
    public startingState: AppState;
    public debugMode: boolean;
    public loadingMinDurationMs: number;
    public services: string[];
    public platform: { web?: boolean; android?: boolean; ios?: boolean; };

    public constructor(config: Partial<GameConfig> = {}) {
        this.name = config.name ?? 'MyGame';
        this.initialScene = config.initialScene ?? 'intro';
        this.startingState = config.startingState ?? AppState.Loading;
        this.debugMode = config.debugMode ?? false;
        this.loadingMinDurationMs = config.loadingMinDurationMs ?? 500;
        this.services = config.services ?? [];
        this.platform = config.platform ?? {
            web: true,
            android: false,
            ios: false,
        };
    }
}

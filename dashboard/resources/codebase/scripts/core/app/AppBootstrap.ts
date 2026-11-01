import { EventBus } from '../event/EventBus';
import { GameAppConfig } from './GameAppConfig';
import { ServiceRegistry } from './ServiceRegistry';
import { AppStateMachine } from './AppStateMachine';
import { AppLifecycle, AppState, BootstrapContext, CoreServiceKey, GameAppConfig as GameConfig } from './types';
import { AssetBundleManager } from '../asset/AssetBundleManager';
import { AudioManager } from '../audio/AudioManager';
import { InputManager } from '../input/InputManager';
import { FxManager } from '../fx/FxManager';
import { DataLayer } from '../data/DataLayer';
import { LocalizationManager } from '../i18n/LocalizationManager';
import { AnalyticsFacade } from '../analytics/AnalyticsFacade';
import { DiagnosticsService } from '../diagnostics/DiagnosticsService';

export class AppBootstrap {
    private static current: AppBootstrap | null = null;

    private readonly registry: ServiceRegistry;
    private readonly eventBus: EventBus;
    private readonly stateMachine: AppStateMachine;
    private readonly config: GameAppConfig;
    private readonly lifecycleServices: AppLifecycle[];
    private startedAt: number;

    public constructor(config: GameConfig | GameAppConfig) {
        this.config = config instanceof GameAppConfig ? config : new GameAppConfig(config);
        this.registry = new ServiceRegistry();
        this.eventBus = new EventBus();
        this.stateMachine = new AppStateMachine(this.config.startingState ?? AppState.Loading);
        this.startedAt = Date.now();
        AppBootstrap.current = this;

        const asset = this.registry.register(CoreServiceKey.Asset, new AssetBundleManager());
        const audio = this.registry.register(CoreServiceKey.Audio, new AudioManager());
        const input = this.registry.register(CoreServiceKey.Input, new InputManager(this.eventBus));
        const fx = this.registry.register(CoreServiceKey.Fx, new FxManager());
        this.registry.register(CoreServiceKey.Data, new DataLayer());
        this.registry.register(CoreServiceKey.I18n, new LocalizationManager());
        const analytics = this.registry.register(CoreServiceKey.Analytics, new AnalyticsFacade());
        const diagnostics = this.registry.register(CoreServiceKey.Diagnostics, new DiagnosticsService(analytics));

        this.lifecycleServices = [asset, audio, input, fx, diagnostics];
    }

    /**
     * Service Locator access for Cocos Components, which the engine instantiates
     * without constructor arguments and so cannot receive this via DI.
     */
    public static getCurrent(): AppBootstrap {
        if (!AppBootstrap.current) {
            throw new Error('AppBootstrap.getCurrent(): no AppBootstrap instance has been created yet.');
        }

        return AppBootstrap.current;
    }

    public getConfig(): GameAppConfig {
        return this.config;
    }

    public getRegistry(): ServiceRegistry {
        return this.registry;
    }

    public getEventBus(): EventBus {
        return this.eventBus;
    }

    public getStateMachine(): AppStateMachine {
        return this.stateMachine;
    }

    public registerService<T>(key: string, service: T): T {
        return this.registry.register(key, service);
    }

    public getService<T>(key: string): T {
        return this.registry.get<T>(key);
    }

    public getContext(): BootstrapContext {
        return {
            config: this.config,
            state: this.stateMachine.getState(),
            startedAt: this.startedAt,
        };
    }

    public async bootstrap(): Promise<BootstrapContext> {
        if (!this.config.initialScene) {
            throw new Error('GameAppConfig.initialScene is required.');
        }

        if (this.config.services && this.config.services.length > 0) {
            for (const serviceName of this.config.services) {
                if (!this.registry.has(serviceName)) {
                    throw new Error(`Required service "${serviceName}" is missing. Boot failed.`);
                }
            }
        }

        await ServiceRegistry.runLifecycle(this.lifecycleServices);

        this.startedAt = Date.now();
        this.stateMachine.reset(this.config.startingState ?? AppState.Loading);
        this.eventBus.emit('bootstrap:started', this.getContext());

        return this.getContext();
    }

    public async transitionTo(state: AppState): Promise<AppState> {
        const previousState = this.stateMachine.getState();
        const nextState = this.stateMachine.transitionTo(state);

        this.eventBus.emit('app:state-changed', {
            from: previousState,
            to: nextState,
        });

        return nextState;
    }
}

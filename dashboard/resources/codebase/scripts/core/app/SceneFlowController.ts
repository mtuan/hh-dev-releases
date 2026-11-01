import { director } from 'cc';
import { AppBootstrap } from './AppBootstrap';
import { AppState } from './types';

export interface SceneTransitionRequest {
    targetState: AppState;
    sceneName?: string;
    payload?: Record<string, unknown>;
    onProgress?: (ratio: number) => void;
}

export class SceneFlowController {
    private static current: SceneFlowController | null = null;

    private readonly app: AppBootstrap;
    private readonly sceneMap: Partial<Record<AppState, string>>;
    private readonly transitionHandlers: Map<AppState, () => Promise<void>>;
    private isTransitioning = false;

    /**
     * Loading has no dedicated scene (the entry scene already runs it) and Result
     * is a popup overlaid on the Game scene, so neither is mapped by default.
     */
    public constructor(app: AppBootstrap, sceneMap: Partial<Record<AppState, string>> = {}) {
        this.app = app;
        this.sceneMap = {
            [AppState.Home]: 'home',
            [AppState.Game]: 'game',
            ...sceneMap,
        };
        this.transitionHandlers = new Map();
        SceneFlowController.current = this;
    }

    public static getCurrent(): SceneFlowController {
        if (!SceneFlowController.current) {
            throw new Error('SceneFlowController.getCurrent(): no SceneFlowController instance has been created yet.');
        }

        return SceneFlowController.current;
    }

    public setTransitionHandler(state: AppState, handler: () => Promise<void>): void {
        this.transitionHandlers.set(state, handler);
    }

    public async requestTransition(request: SceneTransitionRequest): Promise<AppState> {
        if (this.isTransitioning) {
            throw new Error('SceneFlowController: a transition is already in progress.');
        }

        const currentState = this.app.getStateMachine().getState();
        if (!this.app.getStateMachine().canTransition(request.targetState)) {
            throw new Error(`Invalid state transition from ${currentState} to ${request.targetState}`);
        }

        const sceneName = request.sceneName ?? this.getSceneNameForState(request.targetState);
        this.isTransitioning = true;

        try {
            const customHandler = this.transitionHandlers.get(request.targetState);
            if (customHandler) {
                await customHandler();
            }

            if (sceneName) {
                await this.loadScene(sceneName, request.onProgress);
            }

            return await this.app.transitionTo(request.targetState);
        } catch (error) {
            this.app.getEventBus().emit('scene:load-failed', {
                sceneName,
                targetState: request.targetState,
                error,
            });
            throw error;
        } finally {
            this.isTransitioning = false;
        }
    }

    public getSceneNameForState(state: AppState): string | undefined {
        return this.sceneMap[state];
    }

    private loadScene(sceneName: string, onProgress?: (ratio: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            director.preloadScene(
                sceneName,
                (completedCount, totalCount) => {
                    onProgress?.(totalCount > 0 ? completedCount / totalCount : 0);
                },
                (preloadError) => {
                    if (preloadError) {
                        reject(preloadError);
                        return;
                    }

                    director.loadScene(sceneName, (loadError) => {
                        if (loadError) {
                            reject(loadError);
                            return;
                        }

                        resolve();
                    });
                },
            );
        });
    }
}

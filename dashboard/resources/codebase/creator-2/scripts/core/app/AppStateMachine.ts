import { AppState } from './types';

export class AppStateMachine {
    private currentState: AppState;
    private readonly transitions: Record<AppState, AppState[]> = {
        [AppState.Loading]: [AppState.Home, AppState.Game],
        [AppState.Home]: [AppState.Game, AppState.Result],
        [AppState.Game]: [AppState.Result],
        [AppState.Result]: [AppState.Home, AppState.Game],
    };

    public constructor(initialState: AppState = AppState.Loading) {
        this.currentState = initialState;
    }

    public getState(): AppState {
        return this.currentState;
    }

    public canTransition(nextState: AppState): boolean {
        return this.transitions[this.currentState]?.includes(nextState) ?? false;
    }

    public transitionTo(nextState: AppState): AppState {
        if (!this.canTransition(nextState)) {
            throw new Error(`Invalid state transition: ${this.currentState} -> ${nextState}`);
        }

        this.currentState = nextState;
        return this.currentState;
    }

    public reset(initialState: AppState = AppState.Loading): AppState {
        this.currentState = initialState;
        return this.currentState;
    }
}

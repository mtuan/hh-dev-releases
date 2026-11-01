import { _decorator, Button, Component } from 'cc';
import { AppBootstrap } from '../core/app/AppBootstrap';
import { SceneFlowController } from '../core/app/SceneFlowController';
import { AppState } from '../core/app/types';

const { ccclass, property } = _decorator;

@ccclass('IntroSceneController')
export class IntroSceneController extends Component {
    @property(Button)
    public startButton: Button | null = null;

    private flow: SceneFlowController | null = null;

    protected onLoad(): void {
        if (this.startButton) {
            this.startButton.interactable = false;
        }

        const app = new AppBootstrap({
            name: 'Hayhay Template',
            initialScene: 'intro',
            startingState: AppState.Loading,
            debugMode: true,
        });

        this.flow = new SceneFlowController(app);

        void app.bootstrap().then(() => {
            if (this.startButton) {
                this.startButton.interactable = true;
            }
        });
    }

    private onStartClicked(): void {
        void this.flow?.requestTransition({ targetState: AppState.Home })
            .catch((error) => console.error('[IntroSceneController] Failed to go Home', error));
    }
}

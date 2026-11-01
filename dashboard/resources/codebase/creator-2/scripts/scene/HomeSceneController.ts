import { SceneFlowController } from '../core/app/SceneFlowController';
import { AppState } from '../core/app/types';
import { BaseScreen } from '../core/ui/BaseScreen';

const { ccclass, property } = cc._decorator;

@ccclass('HomeSceneController')
export class HomeSceneController extends BaseScreen {
    @property(cc.Button)
    public playButton: cc.Button | null = null;

    private onPlayClicked(): void {
        void SceneFlowController.getCurrent()
            .requestTransition({ targetState: AppState.Game })
            .catch((error) => console.error('[HomeSceneController] Failed to start game', error));
    }
}

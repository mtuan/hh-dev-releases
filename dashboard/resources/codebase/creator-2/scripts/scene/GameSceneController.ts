import { BaseScreen } from '../core/ui/BaseScreen';
import UIDefine from '../core/asset/UIDefine';
import { WinPopup } from '../demo/WinPopup';
import { SceneFlowController } from '../core/app/SceneFlowController';
import { AppState } from '../core/app/types';

const { ccclass, property } = cc._decorator;

@ccclass('GameSceneController')
export class GameSceneController extends BaseScreen {
    @property(cc.Button)
    public endGameButton: cc.Button | null = null;

    protected onLoad(): void {
        this.endGameButton?.node.on(cc.Button.EventType.CLICK, this.onEndGameClicked, this);
    }

    private onEndGameClicked(): void {
        SceneFlowController.getCurrent()
            .requestTransition({ targetState: AppState.Result })
            .then(() => this.openPopup(UIDefine.POPUP_WIN, WinPopup))
            .then((popup) => {
                if (popup) {
                    popup.appear();
                }
            })
            .catch((error) => console.error('[GameSceneController] Failed to show result', error));
    }
}

import { _decorator, Button, Component } from 'cc';
import { BaseScreen } from '../core/ui/BaseScreen';
import UIDefine from '../core/asset/UIDefine';
import { WinPopup } from '../demo/WinPopup';
import { SceneFlowController } from '../core/app/SceneFlowController';
import { AppState } from '../core/app/types';

const { ccclass, property } = _decorator;

@ccclass('GameSceneController')
export class GameSceneController extends BaseScreen {
    @property(Button)
    public endGameButton: Button | null = null;

    protected onLoad(): void {
        this.endGameButton?.node.on(Button.EventType.CLICK, this.onEndGameClicked, this);
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

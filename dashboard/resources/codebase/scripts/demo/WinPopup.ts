import { _decorator, Component, Node } from 'cc';
import { BasePopup, POPUP_APPEAR } from '../core/ui/BasePopup';
import { SceneFlowController } from '../core/app/SceneFlowController';
import { AppState } from '../core/app/types';
const { ccclass, property } = _decorator;

@ccclass('WinPopup')
export class WinPopup extends BasePopup {

    appear(option?: POPUP_APPEAR): void {
        super.appear(option);
    }

    private onHomeClicked(): void {
        void SceneFlowController.getCurrent()
            .requestTransition({ targetState: AppState.Home })
            .catch((error) => console.error('[WinPopup] Failed to return home', error));
    }

    private onReplayClicked(): void {
        void SceneFlowController.getCurrent()
            .requestTransition({ targetState: AppState.Game })
            .catch((error) => console.error('[WinPopup] Failed to replay', error));
    }
}


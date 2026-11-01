import { AppBootstrap } from '../core/app/AppBootstrap';
import { AppState } from '../core/app/types';
import { BaseScreen } from '../core/ui/BaseScreen';

const { ccclass } = cc._decorator;

@ccclass('LoadingSceneController')
export class LoadingSceneController extends BaseScreen {
    private bootstrap: AppBootstrap | null = null;
    private progress = 0;

    protected onLoad(): void {
        this.bootstrap = AppBootstrap.getCurrent();
        this.setState(AppState.Loading);
        this.show();
        this.updateProgress(0);
    }

    public updateProgress(value: number): void {
        this.progress = Math.max(0, Math.min(1, value));
        const label = this.node.getChildByName('ProgressLabel');
        const labelComponent = label?.getComponent(cc.Label);
        if (labelComponent) {
            labelComponent.string = `${Math.round(this.progress * 100)}%`;
        }
    }

    public async complete(): Promise<void> {
        this.updateProgress(1);
        await this.bootstrap?.transitionTo(AppState.Home);
    }
}

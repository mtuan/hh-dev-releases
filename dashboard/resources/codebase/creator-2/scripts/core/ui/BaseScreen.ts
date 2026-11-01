import { AppBootstrap } from '../app/AppBootstrap';
import { AppState, CoreServiceKey } from '../app/types';
import { Stack } from "./Stack";
import { AssetBundleManager, AssetConfig } from "../asset/AssetBundleManager";
import { BasePopup } from "./BasePopup";
const { ccclass, property } = cc._decorator;
export const POPUP_INDEX = 999;

@ccclass("BaseScene")
export class BaseScreen extends cc.Component {
    @property(cc.Canvas)
    protected canvas: cc.Canvas = null;
    protected currentPopups: Stack<cc.Node> = new Stack();

    protected appState: AppState = AppState.Loading;

    public setState(state: AppState): void {
        this.appState = state;
        this.onStateEnter();
    }

    protected onStateEnter(): void {
        // override in subclasses
    }

    protected show(): void {
        this.node.active = true;
    }

    protected hide(): void {
        this.node.active = false;
    }

    public async openPopup<T extends typeof cc.Component>(
        config: AssetConfig,
        component: T,
        option?: {
            darkenBackground?: boolean;
            parent?: cc.Node;
            isShowLoading?: boolean;
            loadingDelay?: number;
            zIndex?: number;
        }
    ): Promise<InstanceType<T> | null> {
        try {
            if (!config) {
                return null;
            }
            let arr = config.path.split("/");
            let name = arr.pop();

            let parent = null;
            if (option && option.parent) {
                parent = option.parent;
            } else {
                parent = this.canvas.node;
            }

            if (parent == null || parent.getChildByName(name) != null) {
                return null;
            }

            let isShowLoading = true;
            if (option && option.isShowLoading !== undefined) {
                isShowLoading = option.isShowLoading;
            }

            if (isShowLoading) this.showLoading();
            let prefab: cc.Prefab = null;
            try {
                const assetManager = AppBootstrap.getCurrent().getService<AssetBundleManager>(CoreServiceKey.Asset);
                prefab = await assetManager.loadAsset(config, cc.Prefab);
                this.hideLoading();
            } catch (error) {
                console.log("error : ", error);
                this.hideLoading();
                return null;
            }

            if (
                parent == null ||
                prefab == null ||
                parent.getChildByName(name) != null
            ) {
                return null;
            }

            let node = cc.instantiate(prefab);
            node.parent = parent;
            if (option && option.zIndex) {
                node.setSiblingIndex(option.zIndex);
            } else {
                node.setSiblingIndex(POPUP_INDEX);
            }

            const popup = node.getComponent(BasePopup);
            if (popup) popup.parentScene = this;
            return node.getComponent(component) as InstanceType<T>;
        } catch (error) {
            return null;
        }
    }

    public closePopup() {
        var topmostPopup = this.currentPopups.pop();
        if (topmostPopup == null) return;
    }

    showLoading() {
        let node = cc.director.getScene().getChildByName("Loading");
        if (!node) return;
        node.active = true;
    }

    hideLoading() {
        let node = cc.director.getScene().getChildByName("Loading");
        if (!node) return;
        node.active = false;
    }
}

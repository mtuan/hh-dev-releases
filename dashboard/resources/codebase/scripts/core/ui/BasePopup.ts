import {
    _decorator,
    BlockInputEvents,
    Component,
    Node,
    tween,
    UITransform,
    Vec3,
    view,
    Enum,
    isValid,
    Sprite,
    UIOpacity
} from "cc";
import { BaseScreen } from "./BaseScreen";
const { ccclass, property } = _decorator;

const DARK_OPACITY = 213;

export enum POPUP_ANIM {
    NONE,
    MOVE_UP,
    MOVE_DOWN,
    POP,
    FADE_IN,
    SLIDE_TO_LEFT,
    SLIDE_TO_RIGHT,
}

export type POPUP_APPEAR = {
    isNoAnim?: boolean;
    isNoSound?: boolean;
    isNoDark?: boolean;
    type?: any;
    callback?: Function;
};

@ccclass("BasePopup")
export class BasePopup extends Component {
    @property({ type: Enum(POPUP_ANIM) })
    popupAnim: POPUP_ANIM = POPUP_ANIM.NONE;
    @property
    disableTouchOutside: boolean = false;

    public parentScene: BaseScreen = null;
    private _callback: Function = null;
    private _isNoAnim = false;
    private _animType = POPUP_ANIM.NONE;
    private enableClickOutside = false;
    private _timeToAppear = 0.35;
    private _timeToDisappear = 0.35;

    onLoad() {
        this.setType(this.popupAnim);
        this.node.addComponent(BlockInputEvents);
        if (this.dark) {
            let uiOpacity = this.dark.getComponent(UIOpacity);
            if (uiOpacity) {
                uiOpacity.opacity = 0;
            } else {
                console.warn("missing uiOpacity")
            }
        }
    }

    get dark(): Node {
        if (this.node["dark"] == null) {
            this.node["dark"] = this.node.getChildByName("dark");
        }
        return this.node["dark"];
    }

    get content(): Node {
        if (!this.node["content"])
            this.node["content"] = this.node.getChildByName("content");
        return this.node["content"];
    }

    appear(option?: POPUP_APPEAR) {
        if (!this.disableTouchOutside) {
            this.node.on(
                Node.EventType.TOUCH_START,
                this.handleTouch.bind(this)
            );
        }

        if (option) {
            if (option.callback) this._callback = option.callback;
            if (option.isNoAnim) this._isNoAnim = option.isNoAnim;
            if (this._isNoAnim) {
                this.show();
                return;
            }
            if (option.type !== undefined) this.setType(option.type);
        }

        this.appearAnim();
    }

    handleTouch(event: any) {
        if (!this.enableClickOutside) return;
        if (this._animType == POPUP_ANIM.NONE) return;
        let location = event.touch.getLocation();
        location = this.node
            .getComponent(UITransform)
            .convertToNodeSpaceAR(location);
        let newRect = this.content.getComponent(UITransform).getBoundingBox();
        if (!newRect.contains(location)) {
            this.disappear();
        }
    }

    setType(type: POPUP_ANIM) {
        if (type == this._animType) return;
        this._animType = type;
        switch (type) {
            case POPUP_ANIM.POP:
                break;
            case POPUP_ANIM.MOVE_UP:
                break;
            case POPUP_ANIM.MOVE_DOWN:
                break;
            case POPUP_ANIM.SLIDE_TO_LEFT:
                this.content.getComponent(UITransform).width =
                    view.getVisibleSize().width;
                break;
            default:
                break;
        }
    }

    private show(callback?: Function) {
        // let position = this.content.getPosition();
        // position.y = 0;
        // this.content.position = position;
        this.enableClickOutside = true;
        callback && callback();
    }

    appearAnim(callback?: Function) {
        if (this.dark) {
            let uiOpacity = this.dark.getComponent(UIOpacity);
            if (uiOpacity) {
                uiOpacity.opacity = 0;
                tween(uiOpacity)
                    .to(this._timeToAppear, { opacity: DARK_OPACITY })
                    .start();
            } else {
                console.warn("missing uiOpacity")
            }

        }

        switch (this._animType) {
            case POPUP_ANIM.POP:
                this.appearAnimPop(callback);
                break;
            case POPUP_ANIM.MOVE_UP:
            case POPUP_ANIM.MOVE_DOWN:
            case POPUP_ANIM.SLIDE_TO_LEFT:
                this.show(callback);
                break;
            default:
                this.show(callback);
                break;
        }

    }

    appearAnimPop(callback?: Function) {
        this._animType = POPUP_ANIM.POP;
        let uiOpacity = this.content.getComponent(UIOpacity);
        if (uiOpacity) uiOpacity.opacity = 255;
        let scale = new Vec3(0.01, 0.01, 1);
        this.content.setScale(scale);
        tween(this.content)
            .to(
                this._timeToAppear,
                { scale: new Vec3(1, 1, 1) },
                { easing: "backOut" }
            )
            .call(() => {
                this.enableClickOutside = true;
                callback && callback();
            })
            .start();
    }

    disappear() {
        if (this._isNoAnim) {
            this.close();
            return;
        }
        this.disappearAnim();
    }

    close() {
        if (isValid(this.node)) this.node.destroy();
    }

    disappearAnim(callback?: Function, hasCloseAction: boolean = true) {
        if (this.dark) {
            let uiOpacity = this.dark.getComponent(UIOpacity);
            if (uiOpacity)
                tween(uiOpacity).to(this._timeToDisappear, { opacity: 0 }).start();
        }
        switch (this._animType) {
            case POPUP_ANIM.POP:
                this.disappearAnimPop(callback, hasCloseAction);
                break;
            case POPUP_ANIM.MOVE_UP:
            case POPUP_ANIM.MOVE_DOWN:
            case POPUP_ANIM.SLIDE_TO_LEFT:
                if (hasCloseAction) this.close();
                break;
        }
    }

    disappearAnimPop(callback?: Function, hasCloseAction: boolean = true) {
        let uiOpacity = this.content.getComponent(UIOpacity);
        if (uiOpacity) {
            tween(uiOpacity).to(this._timeToDisappear, { opacity: 0 }, { easing: "backIn" }).start();
        }
        tween(this.content)
            .to(
                this._timeToDisappear,
                { scale: new Vec3(0.01, 0.01, 0.01) },
                { easing: "backIn" }
            )
            .call(() => {
                try {
                    callback && callback();
                    if (hasCloseAction) this.close();
                } catch (error) { }
            })
            .start();
    }
}
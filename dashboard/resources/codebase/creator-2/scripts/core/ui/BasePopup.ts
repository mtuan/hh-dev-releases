import { BaseScreen } from "./BaseScreen";
const { ccclass, property } = cc._decorator;

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
export class BasePopup extends cc.Component {
    @property({ type: cc.Enum(POPUP_ANIM) })
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
        this.node.addComponent(cc.BlockInputEvents);
        if (this.dark) {
            this.dark.opacity = 0;
        }
    }

    get dark(): cc.Node {
        if (this.node["dark"] == null) {
            this.node["dark"] = this.node.getChildByName("dark");
        }
        return this.node["dark"];
    }

    get content(): cc.Node {
        if (!this.node["content"])
            this.node["content"] = this.node.getChildByName("content");
        return this.node["content"];
    }

    appear(option?: POPUP_APPEAR) {
        if (!this.disableTouchOutside) {
            this.node.on(
                cc.Node.EventType.TOUCH_START,
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
        location = this.node.convertToNodeSpaceAR(location);
        let newRect = this.content.getBoundingBox();
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
                this.content.width = cc.view.getVisibleSize().width;
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
            this.dark.opacity = 0;
                cc.tween(this.dark)
                    .to(this._timeToAppear, { opacity: DARK_OPACITY })
                    .start();

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
        this.content.opacity = 255;
        this.content.scale = 0.01;
        cc.tween(this.content)
            .to(
                this._timeToAppear,
                { scale: 1 },
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
        if (cc.isValid(this.node)) this.node.destroy();
    }

    disappearAnim(callback?: Function, hasCloseAction: boolean = true) {
        if (this.dark) {
            cc.tween(this.dark).to(this._timeToDisappear, { opacity: 0 }).start();
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
        cc.tween(this.content).to(this._timeToDisappear, { opacity: 0 }, { easing: "backIn" }).start();
        cc.tween(this.content)
            .to(
                this._timeToDisappear,
                { scale: 0.01 },
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

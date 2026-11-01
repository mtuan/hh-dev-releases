import { AppLifecycle } from '../app/types';
import { EventBus } from '../event/EventBus';

const MOUSE_POINTER_ID = -1;

export interface PointerEventPayload {
    id: number;
    x: number;
    y: number;
}

/**
 * Unifies touch (mobile) and mouse (desktop-web) input into a single set of
 * pointer events on the shared EventBus, so downstream code (UI, gameplay)
 * doesn't need to care which input device is active.
 */
export class InputManager implements AppLifecycle {
    private readonly eventBus: EventBus;

    public constructor(eventBus: EventBus) {
        this.eventBus = eventBus;
    }

    public init(): void {
        cc.systemEvent.on(cc.SystemEvent.EventType.TOUCH_START, this.onTouchStart, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.TOUCH_MOVE, this.onTouchMove, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.TOUCH_END, this.onTouchEnd, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_DOWN, this.onMouseDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_MOVE, this.onMouseMove, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    public destroy(): void {
        cc.systemEvent.off(cc.SystemEvent.EventType.TOUCH_START, this.onTouchStart, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.TOUCH_MOVE, this.onTouchMove, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.TOUCH_END, this.onTouchEnd, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.MOUSE_DOWN, this.onMouseDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.MOUSE_MOVE, this.onMouseMove, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    private onTouchStart(event: cc.Event.EventTouch): void {
        this.emitTouch('input:pointer-down', event);
    }

    private onTouchMove(event: cc.Event.EventTouch): void {
        this.emitTouch('input:pointer-move', event);
    }

    private onTouchEnd(event: cc.Event.EventTouch): void {
        this.emitTouch('input:pointer-up', event);
    }

    private onTouchCancel(event: cc.Event.EventTouch): void {
        this.emitTouch('input:pointer-cancel', event);
    }

    private emitTouch(eventName: string, event: cc.Event.EventTouch): void {
        const location = event.getLocation();
        this.eventBus.emit<PointerEventPayload>(eventName, {
            id: event.getID() ?? 0,
            x: location.x,
            y: location.y,
        });
    }

    private onMouseDown(event: cc.Event.EventMouse): void {
        this.emitMouse('input:pointer-down', event);
    }

    private onMouseMove(event: cc.Event.EventMouse): void {
        this.emitMouse('input:pointer-move', event);
    }

    private onMouseUp(event: cc.Event.EventMouse): void {
        this.emitMouse('input:pointer-up', event);
    }

    private emitMouse(eventName: string, event: cc.Event.EventMouse): void {
        const location = event.getLocation();
        this.eventBus.emit<PointerEventPayload>(eventName, {
            id: MOUSE_POINTER_ID,
            x: location.x,
            y: location.y,
        });
    }
}

import { EventMouse, EventTouch, Input, input } from 'cc';
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
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    public destroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    private onTouchStart(event: EventTouch): void {
        this.emitTouch('input:pointer-down', event);
    }

    private onTouchMove(event: EventTouch): void {
        this.emitTouch('input:pointer-move', event);
    }

    private onTouchEnd(event: EventTouch): void {
        this.emitTouch('input:pointer-up', event);
    }

    private onTouchCancel(event: EventTouch): void {
        this.emitTouch('input:pointer-cancel', event);
    }

    private emitTouch(eventName: string, event: EventTouch): void {
        const location = event.getLocation();
        this.eventBus.emit<PointerEventPayload>(eventName, {
            id: event.getID() ?? 0,
            x: location.x,
            y: location.y,
        });
    }

    private onMouseDown(event: EventMouse): void {
        this.emitMouse('input:pointer-down', event);
    }

    private onMouseMove(event: EventMouse): void {
        this.emitMouse('input:pointer-move', event);
    }

    private onMouseUp(event: EventMouse): void {
        this.emitMouse('input:pointer-up', event);
    }

    private emitMouse(eventName: string, event: EventMouse): void {
        const location = event.getLocation();
        this.eventBus.emit<PointerEventPayload>(eventName, {
            id: MOUSE_POINTER_ID,
            x: location.x,
            y: location.y,
        });
    }
}

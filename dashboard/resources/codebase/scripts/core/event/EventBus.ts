import { AppEventHandler } from '../app/types';

export type EventListenerMap = Map<string, Set<AppEventHandler<any>>>;

export class EventBus {
    private readonly listeners: EventListenerMap = new Map();

    public on<T>(eventName: string, handler: AppEventHandler<T>): () => void {
        if (!eventName) {
            throw new Error('Event name is required.');
        }

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }

        const handlers = this.listeners.get(eventName)!;
        handlers.add(handler);

        return () => this.off(eventName, handler);
    }

    public off<T>(eventName: string, handler: AppEventHandler<T>): void {
        const handlers = this.listeners.get(eventName);
        if (!handlers) {
            return;
        }

        handlers.delete(handler);
        if (handlers.size === 0) {
            this.listeners.delete(eventName);
        }
    }

    public emit<T>(eventName: string, payload?: T): void {
        const handlers = this.listeners.get(eventName);
        if (!handlers) {
            return;
        }

        for (const handler of Array.from(handlers)) {
            handler(payload as T);
        }
    }

    public clear(eventName?: string): void {
        if (eventName) {
            this.listeners.delete(eventName);
            return;
        }

        this.listeners.clear();
    }
}

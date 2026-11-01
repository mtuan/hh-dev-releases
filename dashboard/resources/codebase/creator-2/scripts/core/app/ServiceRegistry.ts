import { AppLifecycle } from './types';

export class ServiceRegistry {
    private readonly services = new Map<string, unknown>();

    public register<T>(key: string, service: T): T {
        if (!key || !key.trim()) {
            throw new Error('Service key is required.');
        }

        if (this.services.has(key)) {
            throw new Error(`Service "${key}" is already registered.`);
        }

        this.services.set(key, service);
        return service;
    }

    public get<T>(key: string): T {
        if (!this.services.has(key)) {
            throw new Error(`Service "${key}" is not registered.`);
        }

        return this.services.get(key) as T;
    }

    public has(key: string): boolean {
        return this.services.has(key);
    }

    public remove(key: string): boolean {
        return this.services.delete(key);
    }

    public clear(): void {
        this.services.clear();
    }

    public static async runLifecycle(services: AppLifecycle[]): Promise<void> {
        for (const service of services) {
            if (typeof service.init === 'function') {
                await service.init();
            }
        }

        for (const service of services) {
            if (typeof service.start === 'function') {
                await service.start();
            }
        }
    }
}

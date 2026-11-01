/**
 * One adapter per analytics destination (Firebase, internal server, FB Instant
 * analytics...). Concrete adapters belong to the platform layer (Phase 2) —
 * this file only defines the contract the facade fans out to.
 */
export interface IAnalyticsAdapter {
    logEvent(name: string, params?: Record<string, unknown>): void;
    setUserProperty(key: string, value: string): void;
}

/**
 * Single logging API (logEvent/setUserProperty) that fans out to every
 * registered adapter. Game code calls only this facade, never a concrete
 * adapter directly — which adapters are active is decided at bootstrap time.
 */
export class AnalyticsFacade {
    private readonly adapters: IAnalyticsAdapter[] = [];

    public registerAdapter(adapter: IAnalyticsAdapter): void {
        this.adapters.push(adapter);
    }

    public unregisterAdapter(adapter: IAnalyticsAdapter): void {
        const index = this.adapters.indexOf(adapter);
        if (index >= 0) {
            this.adapters.splice(index, 1);
        }
    }

    public logEvent(name: string, params?: Record<string, unknown>): void {
        for (const adapter of this.adapters) {
            try {
                adapter.logEvent(name, params);
            } catch (error) {
                console.error(`AnalyticsFacade.logEvent(): adapter failed for event "${name}"`, error);
            }
        }
    }

    public setUserProperty(key: string, value: string): void {
        for (const adapter of this.adapters) {
            try {
                adapter.setUserProperty(key, value);
            } catch (error) {
                console.error(`AnalyticsFacade.setUserProperty(): adapter failed for key "${key}"`, error);
            }
        }
    }
}

const PREFIX = 'hayhay-tools:preferences:';

/** Persistent renderer preferences. Keep keys stable and scoped to the owning feature/view. */
export function getPreference<T>(key: string, fallback: T, legacyKey?: string): T {
    try {
        const stored = localStorage.getItem(`${PREFIX}${key}`);
        if (stored !== null) return JSON.parse(stored) as T;
        if (legacyKey) {
            const legacy = localStorage.getItem(legacyKey);
            if (legacy !== null) {
                const value = legacy === 'true' ? true : legacy === 'false' ? false : legacy;
                setPreference(key, value);
                return value as T;
            }
        }
    } catch { /* Storage is optional. */ }
    return fallback;
}

export function setPreference<T>(key: string, value: T): void {
    try { localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

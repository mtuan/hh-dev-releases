export type LocaleDictionary = Record<string, string>;

const DEFAULT_LOCALE = 'en';

/**
 * Key-based text lookup, data-driven via addDictionary() — no hardcoded
 * strings in code/scene. Locale-specific assets and platform locale
 * detection (FBInstant.getLocale()...) are platform-layer concerns, not
 * part of this minimal core version.
 */
export class LocalizationManager {
    private locale: string = DEFAULT_LOCALE;
    private readonly defaultLocale: string = DEFAULT_LOCALE;
    private readonly dictionaries: Map<string, LocaleDictionary> = new Map();

    public setLocale(locale: string): void {
        this.locale = locale;
    }

    public getLocale(): string {
        return this.locale;
    }

    public addDictionary(locale: string, dictionary: LocaleDictionary): void {
        const existing = this.dictionaries.get(locale) ?? {};
        this.dictionaries.set(locale, { ...existing, ...dictionary });
    }

    public translate(key: string): string {
        const current = this.dictionaries.get(this.locale);
        if (current && key in current) {
            return current[key];
        }

        const fallback = this.dictionaries.get(this.defaultLocale);
        if (fallback && key in fallback) {
            return fallback[key];
        }

        console.warn(`LocalizationManager.translate(): missing key "${key}" for locale "${this.locale}"`);
        return key;
    }
}

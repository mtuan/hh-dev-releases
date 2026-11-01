export type ThemeMode = 'dark' | 'light';
import { setIconButtonIcon } from './ui/icon-button';

const STORAGE_KEY = 'hayhay-tools:theme';
function storedTheme(): ThemeMode {
    const saved = localStorage.getItem(STORAGE_KEY); if (saved === 'light' || saved === 'dark') return saved;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(mode: ThemeMode): void {
    document.documentElement.dataset.theme = mode; document.documentElement.style.colorScheme = mode; localStorage.setItem(STORAGE_KEY, mode);
}

export function initializeThemeToggle(button: HTMLButtonElement): void {
    const render = (): void => { const mode = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; const target = mode === 'dark' ? 'light' : 'dark'; setIconButtonIcon(button, target === 'light' ? 'sun' : 'moon'); button.title = `Use ${target} mode`; button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(mode === 'light')); };
    applyTheme(storedTheme()); render(); button.addEventListener('click', () => { applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); render(); });
}

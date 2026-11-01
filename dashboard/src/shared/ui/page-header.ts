import { createButton, type ButtonSymbol } from './fields';

export interface PageHeaderAction {
    id: string;
    label: string;
    className?: string;
    icon?: string;
    symbol?: ButtonSymbol;
    title?: string;
    disabled?: boolean;
    shortcut?: 'save' | false;
}

export interface PageHeaderOptions {
    title: string;
    description: string;
    titleId?: string;
    descriptionId?: string;
    actions?: PageHeaderAction[];
    controls?: HTMLElement[];
}

const saveShortcuts = new Map<HTMLElement, HTMLButtonElement>();
let shortcutsReady = false;

function registerShortcuts(): void {
    if (shortcutsReady) return; shortcutsReady = true;
    document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() !== 's' || (!event.metaKey && !event.ctrlKey) || event.altKey) return;
        for (const [header, button] of saveShortcuts) {
            const page = header.closest<HTMLElement>('[data-page]');
            if (!button.isConnected || page?.hidden || header.getClientRects().length === 0) continue;
            event.preventDefault(); if (!button.disabled) button.click(); return;
        }
    });
}

export function renderPageHeader(header: HTMLElement, options: PageHeaderOptions): void {
    saveShortcuts.delete(header);
    header.className = 'page-content-header';
    header.innerHTML = '';

    const titleRow = document.createElement('div');
    titleRow.className = 'page-header-title-row';
    const title = document.createElement('h1');
    title.textContent = options.title;
    if (options.titleId) title.id = options.titleId;
    const description = document.createElement('p');
    description.textContent = options.description;
    if (options.descriptionId) description.id = options.descriptionId;

    const actions = document.createElement('div');
    actions.className = 'header-actions';
    for (const control of options.controls ?? []) actions.appendChild(control);
    for (const action of options.actions ?? []) {
        const button = createButton({ id: action.id, label: action.label, className: action.className, disabled: action.disabled, title: action.title, symbol: action.symbol ?? (action.icon === 'folder' ? 'folder' : undefined) });
        const usesSaveShortcut = action.shortcut === 'save' || (action.shortcut !== false && action.label.trim().toLowerCase() === 'save');
        if (usesSaveShortcut) {
            const shortcutLabel = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘S' : 'Ctrl+S';
            button.setAttribute('aria-keyshortcuts', 'Meta+S Control+S'); button.title = action.title ? `${action.title} (${shortcutLabel})` : `Save (${shortcutLabel})`;
            saveShortcuts.set(header, button); registerShortcuts();
        }
        actions.appendChild(button);
    }
    titleRow.append(title, actions);
    header.append(titleRow, description);
}

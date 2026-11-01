import { iconMarkup, type IconName } from '../icon';
import { applyFieldSize, type FieldSize } from './size';

export type ButtonSymbol = Extract<IconName, 'save' | 'check' | 'add' | 'trash' | 'close' | 'download' | 'folder' | 'play' | 'copy' | 'refresh' | 'globe' | 'lock' | 'help' | 'action'>;

export interface ButtonOptions {
    label: string;
    symbol?: ButtonSymbol | false;
    className?: string;
    id?: string;
    title?: string;
    disabled?: boolean;
    ariaLabel?: string;
    size?: FieldSize;
}

const ACTION_SYMBOLS: Array<[RegExp, ButtonSymbol]> = [
    [/\bsave\b/i, 'save'],
    [/\b(apply|confirm|done|ok)\b/i, 'check'],
    [/\b(add|create|new|enable)\b/i, 'add'],
    [/\b(delete|remove|clear)\b/i, 'trash'],
    [/\b(reset|retry|refresh|update)\b/i, 'refresh'],
    [/\b(cancel|close|disable)\b/i, 'close'],
    [/\b(install|import|download)\b/i, 'download'],
    [/\b(open|browse|choose|view)\b/i, 'folder'],
    [/\b(build|deploy|run|launch|preview)\b/i, 'play'],
    [/\bcopy\b/i, 'copy'],
    [/\b(help|guide)\b/i, 'help'],
];

export function actionSymbol(label: string): ButtonSymbol | undefined {
    return ACTION_SYMBOLS.find(([pattern]) => pattern.test(label))?.[1];
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.className = `ui-button ${options.className ?? ''}`.trim();
    applyFieldSize(button, options.size);
    if (options.id) button.id = options.id;
    if (options.title) button.title = options.title;
    if (options.ariaLabel) button.setAttribute('aria-label', options.ariaLabel);
    button.disabled = Boolean(options.disabled);
    const label = document.createElement('span'); label.className = 'ui-button-label'; label.textContent = options.label;
    const symbol = options.symbol === false ? undefined : options.symbol ?? actionSymbol(options.label);
    if (!symbol) button.append(label);
    else { const icon = document.createElement('span'); icon.className = 'ui-button-icon'; icon.setAttribute('aria-hidden', 'true'); icon.innerHTML = iconMarkup(symbol); button.append(icon, label); }
    return button;
}

export function setButtonLabel(button: HTMLButtonElement, label: string): void {
    const target = button.querySelector<HTMLElement>('.ui-button-label');
    if (target) target.textContent = label; else button.textContent = label;
}

export function setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
    button.classList.toggle('is-loading', loading); button.setAttribute('aria-busy', String(loading));
}

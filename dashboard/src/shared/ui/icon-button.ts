import { createIcon, type IconName } from './icon';
import { applyFieldSize, type FieldSize } from './fields/size';

export interface IconButtonOptions { icon: IconName; label: string; id?: string; title?: string; className?: string; disabled?: boolean; variant?: 'action' | 'control' | 'ghost'; size?: FieldSize; }

export function createIconButton(options: IconButtonOptions): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.className = `${options.variant === 'control' ? 'ui-control-button ui-icon-control' : `ui-icon-button${options.variant === 'ghost' ? ' ui-icon-button-ghost' : ''}`} ${options.className ?? ''}`.trim();
    applyFieldSize(button, options.size);
    if (options.id) button.id = options.id; button.title = options.title ?? options.label; button.setAttribute('aria-label', options.label); button.disabled = Boolean(options.disabled); button.appendChild(createIcon(options.icon)); return button;
}

export function setIconButtonIcon(button: HTMLButtonElement, icon: IconName): void { button.replaceChildren(createIcon(icon)); }

export function hydrateIconButton(button: HTMLButtonElement, icon: IconName): void {
    button.type = 'button'; button.classList.add('ui-icon-button'); button.replaceChildren(createIcon(icon)); if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', button.title || icon);
}

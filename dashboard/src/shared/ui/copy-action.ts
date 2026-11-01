import { createIcon } from './icon';

export interface CopyActionOptions {
    copiedDurationMs?: number;
    copiedLabel?: string;
    failedLabel?: string;
}

const boundButtons = new WeakSet<HTMLButtonElement>();

function setCopyIcon(button: HTMLButtonElement, copied: boolean): void {
    const buttonIcon = button.querySelector<HTMLElement>('.ui-button-icon');
    if (buttonIcon) {
        buttonIcon.replaceChildren(createIcon(copied ? 'check' : 'copy'));
        return;
    }
    button.replaceChildren(createIcon(copied ? 'check' : 'copy'));
}

/** Adds consistent copy/check feedback to icon-only and labelled copy buttons. */
export function bindCopyAction(
    button: HTMLButtonElement,
    value: string | (() => string | Promise<string>),
    options: CopyActionOptions = {},
): HTMLButtonElement {
    if (boundButtons.has(button)) return button;
    boundButtons.add(button);
    const originalTitle = button.title;
    const originalAriaLabel = button.getAttribute('aria-label');
    const duration = options.copiedDurationMs ?? 2200;
    let resetTimer: number | undefined;
    const reset = (): void => {
        setCopyIcon(button, false);
        button.classList.remove('is-copied');
        button.title = originalTitle;
        if (originalAriaLabel === null) button.removeAttribute('aria-label');
        else button.setAttribute('aria-label', originalAriaLabel);
    };
    button.addEventListener('click', () => {
        if (resetTimer !== undefined) window.clearTimeout(resetTimer);
        void Promise.resolve()
            .then(() => typeof value === 'function' ? value() : value)
            .then((text) => navigator.clipboard.writeText(text))
            .then(() => {
                const label = options.copiedLabel ?? 'Copied';
                setCopyIcon(button, true);
                button.classList.add('is-copied');
                button.title = label;
                button.setAttribute('aria-label', label);
                resetTimer = window.setTimeout(reset, duration);
            })
            .catch(() => {
                button.title = options.failedLabel ?? 'Copy failed';
                resetTimer = window.setTimeout(reset, duration);
            });
    });
    return button;
}

import { createButton } from './fields';
import { createIconButton } from './icon-button';
import { createActionList, createActionListItem } from './action-list';
import { bindCopyAction } from './copy-action';

export interface ModalAction {
    label: string;
    className?: string;
    run?(close: () => void): void;
    copyValue?: string | (() => string | Promise<string>);
}
interface ModalOptions {
    title: string;
    icon?: 'warning' | 'info' | 'settings';
    content: HTMLElement;
    actions?: ModalAction[];
    closeOnBackdrop?: boolean;
    onClose?: () => void;
}

const icons: Record<NonNullable<ModalOptions['icon']>, string> = {
    warning: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.4 2.8 1.7 14.4A1.8 1.8 0 0 0 3.3 17h13.4a1.8 1.8 0 0 0 1.6-2.6L11.6 2.8a1.8 1.8 0 0 0-3.2 0Z"/><path d="M10 7v4M10 14h.01"/></svg>',
    info: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6h.01"/></svg>',
    settings: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="2.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4"/></svg>',
};

export function showModal(options: ModalOptions): { close(): void } {
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay modal-overlay-animated';
    const dialog = document.createElement('section'); dialog.className = 'app-modal'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    const header = document.createElement('header'); header.className = 'app-modal-header';
    const titleGroup = document.createElement('div'); titleGroup.className = 'app-modal-title-group';
    if (options.icon) { const icon = document.createElement('span'); icon.className = `app-modal-symbol app-modal-symbol-${options.icon}`; icon.innerHTML = icons[options.icon]; titleGroup.appendChild(icon); }
    const title = document.createElement('h2'); title.textContent = options.title; titleGroup.appendChild(title);
    const closeButton = createIconButton({ icon: 'close', label: 'Close', className: 'app-modal-close inline-icon-button' });
    header.append(titleGroup, closeButton);
    const body = document.createElement('div'); body.className = 'app-modal-content'; body.appendChild(options.content);
    dialog.append(header, body);
    let closed = false;
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') close(); };
    const close = (): void => {
        if (closed) return; closed = true; document.removeEventListener('keydown', onKeyDown);
        overlay.classList.remove('is-open'); overlay.classList.add('is-closing');
        window.setTimeout(() => { overlay.remove(); options.onClose?.(); }, 170);
    };
    if (options.actions?.length) {
        const footer = document.createElement('footer'); footer.className = 'app-modal-footer';
        for (const action of options.actions) {
            const button = createButton({ label: action.label, className: action.className ?? 'btn-secondary' });
            if (action.copyValue !== undefined) bindCopyAction(button, action.copyValue);
            else button.addEventListener('click', () => action.run?.(close));
            footer.appendChild(button);
        }
        dialog.appendChild(footer);
    }
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay && options.closeOnBackdrop !== false) close(); });
    document.addEventListener('keydown', onKeyDown); overlay.appendChild(dialog); document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open')); closeButton.focus();
    return { close };
}

function messageContent(message: string): HTMLDivElement {
    const content = document.createElement('div'); content.className = 'app-modal-message'; content.textContent = message; return content;
}

export function showAlert(message: string, title = 'Notice', icon: NonNullable<ModalOptions['icon']> = 'info'): void {
    showModal({ title, icon, content: messageContent(message), actions: [{ label: 'OK', className: 'btn-primary', run: (close) => close() }] });
}

export interface ChoiceModalItem<T> { value: T; title: string; meta?: string; disabled?: boolean }

/** Standard single-choice modal. Uses the shared action-list row instead of route-owned choice buttons. */
export function showChoiceModal<T>(title: string, items: ChoiceModalItem<T>[], icon: NonNullable<ModalOptions['icon']> = 'settings'): Promise<T | null> {
    return new Promise((resolve) => {
        let settled = false; const list = createActionList('ui-choice-modal-list'); let modal: { close(): void };
        const finish = (value: T | null): void => { if (settled) return; settled = true; resolve(value); modal.close(); };
        for (const choice of items) { const item = createActionListItem({ title: choice.title, meta: choice.meta, onActivate: () => finish(choice.value) }); item.button.disabled = Boolean(choice.disabled); list.appendChild(item.element); }
        modal = showModal({ title, icon, content: list, onClose: () => { if (!settled) { settled = true; resolve(null); } } });
    });
}

export function showTechnicalError(title: string, message: string, details: string): void {
    const content = document.createElement('div'); content.className = 'technical-error-content';
    const summary = document.createElement('p'); summary.textContent = message;
    const technical = document.createElement('pre'); technical.className = 'technical-error-details'; technical.textContent = details;
    content.append(summary, technical);
    showModal({
        title, icon: 'warning', content,
        actions: [
            { label: 'Close', run: (close) => close() },
            { label: 'Copy details', className: 'btn-primary', copyValue: details },
        ],
    });
}

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    icon?: NonNullable<ModalOptions['icon']>;
}

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value: boolean, close: () => void): void => { if (settled) return; settled = true; resolve(value); close(); };
        showModal({
            title: options.title,
            icon: options.icon ?? (options.danger ? 'warning' : 'info'),
            content: messageContent(options.message),
            onClose: () => { if (!settled) { settled = true; resolve(false); } },
            actions: [
                { label: options.cancelLabel ?? 'Cancel', run: (close) => finish(false, close) },
                { label: options.confirmLabel ?? 'Confirm', className: options.danger ? 'btn-danger' : 'btn-primary', run: (close) => finish(true, close) },
            ],
        });
    });
}

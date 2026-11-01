import { bindCopyAction } from './copy-action';
import { createIcon } from './icon';
import { createIconButton } from './icon-button';
import { createButton } from './fields';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastOptions {
    kind: ToastKind;
    title: string;
    message?: string;
    details?: string;
    durationMs?: number;
}

export interface ToastControl { close(): void; }

let region: HTMLDivElement | undefined;

function toastRegion(): HTMLDivElement {
    if (region?.isConnected) return region;
    region = document.createElement('div');
    region.className = 'ui-toast-region';
    region.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(region);
    return region;
}

export function showToast(options: ToastOptions): ToastControl {
    const host = toastRegion();
    const toast = document.createElement('section');
    toast.className = `ui-toast ui-toast-${options.kind}`;
    toast.setAttribute('role', options.kind === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-atomic', 'true');

    const icon = createIcon(options.kind === 'success' ? 'check' : 'info', 'ui-toast-symbol');
    const copy = document.createElement('div'); copy.className = 'ui-toast-copy';
    const title = document.createElement('strong'); title.className = 'ui-toast-title'; title.textContent = options.title;
    copy.appendChild(title);
    if (options.message) { const message = document.createElement('p'); message.className = 'ui-toast-message'; message.textContent = options.message; copy.appendChild(message); }
    const closeButton = createIconButton({ icon: 'close', label: 'Close notification', variant: 'ghost', size: 'sm', className: 'ui-toast-close' });
    const header = document.createElement('div'); header.className = 'ui-toast-header'; header.append(icon, copy, closeButton);
    toast.appendChild(header);

    if (options.details) {
        const actions = document.createElement('div'); actions.className = 'ui-toast-actions';
        const copyButton = createButton({ label: 'Copy details', className: 'btn-secondary', symbol: 'copy', size: 'sm' });
        bindCopyAction(copyButton, options.details, { copiedLabel: 'Details copied' });
        actions.appendChild(copyButton); toast.appendChild(actions);
    }

    let closed = false;
    let timer: number | undefined;
    const close = (): void => {
        if (closed) return; closed = true;
        if (timer !== undefined) window.clearTimeout(timer);
        toast.classList.remove('is-open'); toast.classList.add('is-closing');
        window.setTimeout(() => { toast.remove(); if (!host.childElementCount) { host.remove(); if (region === host) region = undefined; } }, 180);
    };
    closeButton.addEventListener('click', close);
    host.appendChild(toast); requestAnimationFrame(() => toast.classList.add('is-open'));

    if (options.kind !== 'error') {
        const duration = options.durationMs ?? 4200;
        const stopTimer = (): void => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
        const startTimer = (): void => { stopTimer(); timer = window.setTimeout(close, duration); };
        toast.addEventListener('mouseenter', stopTimer); toast.addEventListener('mouseleave', startTimer);
        toast.addEventListener('focusin', stopTimer); toast.addEventListener('focusout', startTimer);
        startTimer();
    }
    return { close };
}

export function showSuccessToast(title: string, message?: string): ToastControl {
    return showToast({ kind: 'success', title, message });
}

export function showErrorToast(title: string, message: string, details: string): ToastControl {
    return showToast({ kind: 'error', title, message, details });
}

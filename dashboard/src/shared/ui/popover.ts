export interface PopoverOptions {
    trigger: HTMLElement;
    content: HTMLElement;
    className?: string;
    align?: 'start' | 'end';
    placement?: 'bottom' | 'right';
    triggerOnClick?: boolean;
    onOpen?(): void;
    onClose?(): void;
}

export interface PopoverControl {
    panel: HTMLDivElement;
    readonly open: boolean;
    show(): void;
    hide(): void;
    toggle(): void;
    destroy(): void;
}

const popoverParents = new WeakMap<HTMLElement, HTMLElement | null>();

function belongsTo(panel: HTMLElement, target: Node): boolean {
    if (panel.contains(target)) return true;
    return Array.from(document.querySelectorAll<HTMLElement>('.ui-popover')).some((candidate) => {
        if (!candidate.contains(target)) return false; let parent = popoverParents.get(candidate) ?? null;
        while (parent) { if (parent === panel) return true; parent = popoverParents.get(parent) ?? null; }
        return false;
    });
}

function hasOpenChild(panel: HTMLElement): boolean {
    return Array.from(document.querySelectorAll<HTMLElement>('.ui-popover.is-open')).some((candidate) => { let parent = popoverParents.get(candidate) ?? null; while (parent) { if (parent === panel) return true; parent = popoverParents.get(parent) ?? null; } return false; });
}

export function createPopover(options: PopoverOptions): PopoverControl {
    let parentPanel: HTMLElement | null = null; const panel = document.createElement('div'); panel.className = `ui-popover ${options.className ?? ''}`.trim(); panel.setAttribute('aria-hidden', 'true'); panel.appendChild(options.content); document.body.appendChild(panel); popoverParents.set(panel, null);
    requestAnimationFrame(() => { if (panel.isConnected) void panel.offsetWidth; });
    let open = false;
    const position = (): void => {
        if (!open) return;
        const anchor = options.trigger.getBoundingClientRect(); const gutter = 6; const viewportGutter = 8; const viewportHeight = window.innerHeight - viewportGutter * 2; panel.style.maxHeight = `${Math.max(120, viewportHeight)}px`; panel.style.overflowY = 'auto'; const panelRect = panel.getBoundingClientRect(); const height = Math.min(panelRect.height, viewportHeight);
        let top: number; let left: number;
        if (options.placement === 'right') { top = anchor.top; left = anchor.right + gutter; if (left + panelRect.width > window.innerWidth - viewportGutter) left = anchor.left - panelRect.width - gutter; }
        else { top = anchor.bottom + gutter; if (top + height > window.innerHeight - viewportGutter) top = anchor.top - height - gutter; left = options.align === 'end' ? anchor.right - panelRect.width : anchor.left; }
        if (top < viewportGutter || top + height > window.innerHeight - viewportGutter) top = anchor.top + anchor.height / 2 - height / 2; top = Math.max(viewportGutter, Math.min(top, window.innerHeight - height - viewportGutter)); panel.style.maxHeight = `${height}px`;
        left = Math.max(viewportGutter, Math.min(left, window.innerWidth - panelRect.width - viewportGutter));
        panel.style.left = `${left}px`; panel.style.top = `${top}px`; panel.style.minWidth = `${Math.min(anchor.width, window.innerWidth - viewportGutter * 2)}px`;
    };
    const outside = (event: PointerEvent): void => { const target = event.target as Node; if (!belongsTo(panel, target) && !options.trigger.contains(target)) api.hide(); };
    const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape' && open && !hasOpenChild(panel)) { event.stopImmediatePropagation(); api.hide(); options.trigger.focus(); } };
    const api: PopoverControl = { panel, get open() { return open; }, show() { if (open || !panel.isConnected) return; parentPanel = options.trigger.closest<HTMLElement>('.ui-popover'); popoverParents.set(panel, parentPanel); let depth = 0; let ancestor = parentPanel; while (ancestor) { depth += 1; ancestor = popoverParents.get(ancestor) ?? null; } panel.style.zIndex = String(140 + depth * 10); document.querySelectorAll<HTMLElement>('.ui-popover.is-open').forEach((item) => { if (item !== panel && item !== parentPanel && !belongsTo(item, options.trigger)) item.dispatchEvent(new CustomEvent('popover-close')); }); open = true; panel.classList.add('is-open'); panel.setAttribute('aria-hidden', 'false'); options.trigger.setAttribute('aria-expanded', 'true'); position(); window.addEventListener('resize', position); window.addEventListener('scroll', position, true); document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape); options.onOpen?.(); }, hide() { if (!open) return; open = false; document.querySelectorAll<HTMLElement>('.ui-popover.is-open').forEach((item) => { if (popoverParents.get(item) === panel) item.dispatchEvent(new CustomEvent('popover-close')); }); panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); options.trigger.setAttribute('aria-expanded', 'false'); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape); options.onClose?.(); }, toggle() { if (open) api.hide(); else api.show(); }, destroy() { api.hide(); observer.disconnect(); panel.remove(); popoverParents.delete(panel); } };
    let wasConnected = options.trigger.isConnected; const observer = new MutationObserver(() => { wasConnected ||= options.trigger.isConnected; if (wasConnected && !options.trigger.isConnected) { api.hide(); panel.remove(); observer.disconnect(); } }); observer.observe(document.body, { childList: true, subtree: true });
    panel.addEventListener('popover-close', () => api.hide()); options.trigger.setAttribute('aria-expanded', 'false'); if (options.triggerOnClick !== false) options.trigger.addEventListener('click', () => api.toggle()); return api;
}

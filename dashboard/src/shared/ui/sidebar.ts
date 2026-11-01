import { createIconButton } from './icon-button';
import { getPreference, setPreference } from '../preferences';
import { createActionList, createActionListItem } from './action-list';
import { createIcon } from './icon';
import { createPopover, type PopoverControl } from './popover';

export interface CollapsibleSidebarOptions { element: HTMLElement; label?: string; storageKey?: string; collapsible?: boolean; collapsed?: boolean; }
export interface CollapsibleSidebar { readonly collapsed: boolean; setCollapsed(collapsed: boolean): void; toggle(): void; }

/** Adds the standard persisted collapse behavior to a dashboard sidebar. Collapsible by default. */
export function createCollapsibleSidebar(options: CollapsibleSidebarOptions): CollapsibleSidebar {
    const collapsible = options.collapsible ?? true; const element = options.element; element.classList.add('ui-sidebar');
    // Normalize legacy/direct-text navigation items so every sidebar follows the same icon-rail behavior.
    element.querySelectorAll<HTMLElement>('.nav-item,.settings-nav-item').forEach((item) => {
        for (const node of Array.from(item.childNodes)) {
            if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
            const text = document.createElement('span'); text.className = 'ui-sidebar-item-label'; text.textContent = node.textContent.trim(); item.replaceChild(text, node);
        }
    });
    let header = element.querySelector<HTMLElement>(':scope > .ui-sidebar-header');
    if (!header) { header = document.createElement('div'); header.className = 'ui-sidebar-header'; element.prepend(header); }
    let label = header.querySelector<HTMLElement>('.ui-sidebar-label');
    if (!label && options.label) { label = document.createElement('span'); label.className = 'ui-sidebar-label'; label.textContent = options.label; header.prepend(label); }
    let collapsed = false; let toggleButton: HTMLButtonElement | null = null;
    const parentPopovers = new Map<HTMLElement, PopoverControl>();
    const closeParentPopovers = (): void => { parentPopovers.forEach((popover) => popover.hide()); };
    const directChild = <T extends Element>(parent: Element, selector: string): T | undefined => Array.from(parent.children).find((child): child is T => child.matches(selector));
    const buildCollapsedMenu = (source: HTMLElement, closeAll: () => void): HTMLElement => {
        const list = createActionList('ui-sidebar-collapsed-menu');
        for (const child of Array.from(source.children)) {
            if (child instanceof HTMLButtonElement && child.matches('.nav-item,.settings-nav-item')) {
                if (child.hidden) continue;
                const label = child.querySelector<HTMLElement>('.ui-sidebar-item-label')?.textContent?.trim() || child.textContent?.trim() || 'Open';
                const item = createActionListItem({ title: label, selected: child.classList.contains('active'), onActivate: () => { closeAll(); child.click(); } }); item.button.disabled = child.disabled; list.appendChild(item.element); continue;
            }
            if (!(child instanceof HTMLElement) || !child.matches('.platform-tool-group') || child.hidden) continue;
            const parent = directChild<HTMLElement>(child, '.nav-tool-parent'); const nested = directChild<HTMLElement>(child, '.nav-submenu'); if (!parent || !nested) continue;
            const label = parent.querySelector<HTMLElement>('.ui-sidebar-item-label')?.textContent?.trim() || parent.textContent?.trim() || 'More'; const trailing = createIcon('chevron', 'ui-sidebar-submenu-chevron');
            const item = createActionListItem({ title: label, trailing }); const nestedMenu = buildCollapsedMenu(nested, closeAll); const nestedPopover = createPopover({ trigger: item.button, content: nestedMenu, className: 'ui-sidebar-collapsed-popover', placement: 'right', triggerOnClick: false });
            item.button.setAttribute('aria-haspopup', 'menu'); item.button.addEventListener('click', (event) => { event.stopPropagation(); nestedPopover.toggle(); }); item.button.addEventListener('pointerenter', () => nestedPopover.show()); list.appendChild(item.element);
        }
        return list;
    };
    const setCollapsed = (next: boolean): void => {
        if (!collapsible) return; collapsed = next; if (!collapsed) closeParentPopovers(); element.classList.toggle('is-collapsed', collapsed); toggleButton?.setAttribute('aria-expanded', String(!collapsed));
        if (toggleButton) { const action = collapsed ? 'Expand' : 'Collapse'; toggleButton.title = `${action} ${options.label ?? 'sidebar'}`; toggleButton.setAttribute('aria-label', toggleButton.title); }
        if (options.storageKey) setPreference(`sidebar.${options.storageKey}`, collapsed);
    };
    if (collapsible) { toggleButton = createIconButton({ icon: 'sidebar', label: `Collapse ${options.label ?? 'sidebar'}`, variant: 'ghost', size: 'md', className: 'ui-sidebar-toggle' }); toggleButton.setAttribute('aria-expanded', 'true'); header.appendChild(toggleButton); toggleButton.addEventListener('click', () => setCollapsed(!collapsed)); }
    element.querySelectorAll<HTMLElement>('.nav-tool-parent').forEach((parent) => {
        parent.tabIndex = 0; parent.setAttribute('role', 'button'); parent.setAttribute('aria-haspopup', 'menu');
        const openMenu = (event: Event): void => {
            if (!collapsed) return; event.preventDefault(); event.stopPropagation(); parentPopovers.get(parent)?.destroy();
            const group = parent.closest<HTMLElement>('.platform-tool-group'); const nested = group ? directChild<HTMLElement>(group, '.nav-submenu') : undefined; if (!nested) return;
            let popover: PopoverControl; const menu = buildCollapsedMenu(nested, () => { closeParentPopovers(); }); popover = createPopover({ trigger: parent, content: menu, className: 'ui-sidebar-collapsed-popover', placement: 'right', triggerOnClick: false }); parentPopovers.set(parent, popover); popover.show();
        };
        parent.addEventListener('click', openMenu); parent.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') openMenu(event); });
    });
    const stored = options.storageKey ? getPreference(`sidebar.${options.storageKey}`, Boolean(options.collapsed), options.storageKey) : Boolean(options.collapsed); setCollapsed(stored);
    return { get collapsed() { return collapsed; }, setCollapsed, toggle() { setCollapsed(!collapsed); } };
}

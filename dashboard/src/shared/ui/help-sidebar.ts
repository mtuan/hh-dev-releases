import { createIconButton } from './icon-button';
import { createPanel } from './panel';

export interface HelpSidebarContent {
    key: string;
    title: string;
    description?: string;
    content: HTMLElement;
}

export interface HelpSidebar {
    element: HTMLElement;
    readonly open: boolean;
    readonly activeKey?: string;
    show(value: HelpSidebarContent): void;
    toggle(value: HelpSidebarContent): void;
    close(): void;
}

/** Shared right-side contextual help surface. Its parent owns the page layout and width. */
export function createHelpSidebar(): HelpSidebar {
    const element = document.createElement('aside');
    element.className = 'ui-help-sidebar';
    element.hidden = true;
    const content = document.createElement('div');
    content.className = 'ui-help-sidebar-content';
    const closeButton = createIconButton({ icon: 'close', label: 'Close help', variant: 'ghost', size: 'sm' });
    const panel = createPanel({ title: 'Help', content, actions: closeButton, collapsible: false, className: 'ui-help-sidebar-panel' });
    const title = panel.titleRow.querySelector<HTMLElement>('.ui-panel-title')!;
    element.appendChild(panel.element);
    let activeKey: string | undefined;

    const api: HelpSidebar = {
        element,
        get open() { return !element.hidden; },
        get activeKey() { return activeKey; },
        show(value) {
            activeKey = value.key;
            title.textContent = value.title;
            panel.heading.querySelector('.ui-panel-description')?.remove();
            if (value.description) {
                const description = document.createElement('p');
                description.className = 'ui-panel-description';
                description.textContent = value.description;
                panel.heading.appendChild(description);
            }
            content.replaceChildren(value.content);
            panel.body.scrollTop = 0;
            element.hidden = false;
        },
        toggle(value) {
            if (!element.hidden && activeKey === value.key) api.close();
            else api.show(value);
        },
        close() {
            element.hidden = true;
            activeKey = undefined;
        },
    };
    closeButton.addEventListener('click', () => api.close());
    return api;
}

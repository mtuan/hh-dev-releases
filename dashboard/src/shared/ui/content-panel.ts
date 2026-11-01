import { createPanel } from './panel';

export interface ContentPanelOptions {
    title?: string;
    status?: string;
    statusClass?: string;
    description?: string;
    content: HTMLElement;
    actions?: HTMLElement;
    className?: string;
    collapsible?: boolean;
    collapsed?: boolean;
    flush?: boolean;
    compactHeader?: boolean;
}

export function createContentPanel(options: ContentPanelOptions): HTMLElement {
    return createPanel({
        title: options.title,
        status: options.status,
        statusClass: options.statusClass,
        description: options.description,
        content: options.content,
        actions: options.actions,
        collapsible: options.collapsible,
        collapsed: options.collapsed,
        compactHeader: options.compactHeader,
        className: `ui-content-panel${options.flush ? ' is-flush' : ''} ${options.className ?? ''}`.trim(),
    }).element;
}

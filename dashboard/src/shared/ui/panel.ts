import { createIconButton } from './icon-button';
import type { IconName } from './icon';

/** Standard icon-only action used in panel headers. */
export function createPanelHeaderAction(icon: IconName, label: string, className = ''): HTMLButtonElement { return createIconButton({ icon, label, variant: 'control', className: `ui-panel-header-action ${className}`.trim() }); }

export interface PanelOptions {
    title?: string;
    /** Short state badge rendered immediately after the panel title. */
    status?: string;
    statusClass?: string;
    description?: string;
    content?: HTMLElement;
    actions?: HTMLElement;
    className?: string;
    tagName?: 'section' | 'li';
    collapsible?: boolean;
    collapsed?: boolean;
    /** Compact is the dashboard default. Set false only for an intentional hierarchy exception. */
    compactHeader?: boolean;
}

export interface Panel {
    element: HTMLElement;
    header: HTMLElement;
    heading: HTMLDivElement;
    titleRow: HTMLDivElement;
    body: HTMLDivElement;
    collapseButton?: HTMLButtonElement;
    readonly collapsed: boolean;
    setCollapsed(collapsed: boolean): void;
    toggle(): void;
}

let panelSequence = 0;

/**
 * The single visual shell for titled dashboard panels.
 * Specialized panel helpers compose this primitive instead of recreating it.
 */
export function createPanel(options: PanelOptions): Panel {
    const collapsible = options.collapsible ?? true;
    const element = document.createElement(options.tagName ?? 'section');
    element.className = `ui-panel ${options.className ?? ''}`.trim();

    const header = document.createElement('header');
    header.className = 'ui-panel-header';
    header.classList.toggle('is-compact', options.compactHeader ?? true);

    const heading = document.createElement('div');
    heading.className = 'ui-panel-heading';
    const titleRow = document.createElement('div');
    titleRow.className = 'ui-panel-title-row';
    if (options.title) { const title = document.createElement('h2'); title.className = 'ui-panel-title'; title.textContent = options.title; titleRow.appendChild(title); }
    if (options.status) { const badge = document.createElement('span'); badge.className = `badge ${options.statusClass ?? ''}`.trim(); badge.textContent = options.status; titleRow.appendChild(badge); }
    heading.appendChild(titleRow);
    if (options.description) {
        const description = document.createElement('p');
        description.className = 'ui-panel-description';
        description.textContent = options.description;
        heading.appendChild(description);
    }
    const hasHeading = Boolean(options.title || options.status || options.description);
    if (!hasHeading) header.classList.add('is-actions-only');

    const body = document.createElement('div');
    body.className = 'ui-panel-body';
    body.id = `ui-panel-body-${++panelSequence}`;
    if (options.content) body.appendChild(options.content);
    let collapsed = false; let collapseButton: HTMLButtonElement | undefined;
    const controls = document.createElement('div'); controls.className = 'ui-panel-controls';
    if (options.actions) controls.appendChild(options.actions);
    const setCollapsed = (next: boolean): void => { if (!collapsible) return; collapsed = next; element.classList.toggle('is-collapsed', collapsed); body.hidden = collapsed; collapseButton?.setAttribute('aria-expanded', String(!collapsed)); if (collapseButton) { const label = `${collapsed ? 'Expand' : 'Collapse'} ${options.title ?? 'panel'}`; collapseButton.title = label; collapseButton.setAttribute('aria-label', label); } };
    if (collapsible) {
        header.classList.add('is-collapsible'); collapseButton = createPanelHeaderAction('chevron', `Collapse ${options.title ?? 'panel'}`, 'ui-panel-collapse'); collapseButton.setAttribute('aria-controls', body.id);
        collapseButton.addEventListener('click', () => setCollapsed(!collapsed));
        heading.addEventListener('click', () => setCollapsed(!collapsed));
    }
    if (hasHeading || collapseButton) {
        const leading = document.createElement('div');
        leading.className = 'ui-panel-leading';
        if (collapseButton) leading.appendChild(collapseButton);
        if (hasHeading) leading.appendChild(heading);
        header.appendChild(leading);
    }
    if (controls.childElementCount) header.appendChild(controls);
    element.append(header, body);
    const panel: Panel = { element, header, heading, titleRow, body, collapseButton, get collapsed() { return collapsed; }, setCollapsed, toggle() { setCollapsed(!collapsed); } };
    setCollapsed(Boolean(options.collapsed)); return panel;
}

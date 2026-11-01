import { createPanel } from './panel';

export interface SettingsPanelRow {
    title?: string;
    fields?: [{ title: string; actions: HTMLElement }] | [{ title: string; actions: HTMLElement }, { title: string; actions: HTMLElement }];
    status?: string;
    statusClass?: string;
    description?: string;
    fullWidthDescription?: boolean;
    content?: HTMLElement;
    actions?: HTMLElement;
    working?: boolean;
}

export interface SettingsPanelOptions {
    title: string;
    status?: string;
    statusClass?: string;
    description?: string;
    actions?: HTMLElement;
    rows?: SettingsPanelRow[];
    collapsible?: boolean;
    collapsed?: boolean;
    compactHeader?: boolean;
    /** Stacked is the dashboard convention. Use inline only for a deliberate compact exception. */
    layout?: 'stacked' | 'inline';
}

export type SettingsControl = HTMLElement | { element: HTMLElement };

export function createSettingsControl(control: SettingsControl): HTMLDivElement {
    const wrapper = document.createElement('div'); wrapper.className = 'config-value-controls';
    wrapper.appendChild(control instanceof HTMLElement ? control : control.element);
    return wrapper;
}

function copyBlock(titleText: string, status?: string, statusClass = '', description?: string): HTMLDivElement {
    const copy = document.createElement('div'); copy.className = 'settings-panel-copy';
    const heading = document.createElement('div'); heading.className = 'settings-panel-heading';
    const title = document.createElement('strong'); title.textContent = titleText; heading.appendChild(title);
    if (status) { const badge = document.createElement('span'); badge.className = `badge ${statusClass}`; badge.textContent = status; heading.appendChild(badge); }
    copy.appendChild(heading);
    if (description) { const text = document.createElement('p'); text.textContent = description; copy.appendChild(text); }
    return copy;
}

export function createSettingsPanel(options: SettingsPanelOptions): HTMLLIElement {
    const shell = createPanel({
        title: options.title,
        status: options.status,
        statusClass: options.statusClass,
        description: options.description,
        actions: options.actions,
        className: 'settings-panel',
        tagName: 'li',
        collapsible: options.collapsible,
        collapsed: options.collapsed,
        compactHeader: options.compactHeader,
    });
    const panel = shell.element as HTMLLIElement;
    shell.header.classList.add('settings-panel-header');
    shell.heading.classList.add('settings-panel-copy');
    shell.titleRow.classList.add('settings-panel-heading');
    shell.body.classList.add('settings-panel-rows', `settings-panel-layout-${options.layout ?? 'stacked'}`);
    if (options.rows?.length) {
        for (const row of options.rows) {
            const item = document.createElement('div'); item.className = `settings-panel-row${row.fields ? ' has-split-fields' : ''}${row.working ? ' is-working' : ''}${row.fullWidthDescription ? ' has-full-description' : ''}`;
            if (row.fields) {
                for (const field of row.fields) { const group = document.createElement('div'); group.className = 'settings-panel-split-field'; group.append(copyBlock(field.title), field.actions); item.appendChild(group); }
                shell.body.appendChild(item); continue;
            }
            const copy = copyBlock(row.title ?? '', row.status, row.statusClass, row.fullWidthDescription ? undefined : row.description);
            if (row.content) copy.appendChild(row.content);
            item.appendChild(copy); if (row.actions) item.appendChild(row.actions);
            if (row.fullWidthDescription && row.description) {
                const description = document.createElement('p'); description.className = 'settings-panel-row-description'; description.textContent = row.description; item.appendChild(description);
            }
            shell.body.appendChild(item);
        }
    }
    return panel;
}

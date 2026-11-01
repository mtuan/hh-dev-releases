import { ProjectConfig } from '../../../../../electron/types';
import { platformDescription, platformName, SUPPORTED_PLATFORMS } from '../../../../shared/platforms';
import { createIconButton } from '../../../../shared/ui/icon-button';
import { createActionList, createActionListItem } from '../../../../shared/ui/action-list';
import { createDataTable } from '../../../../shared/ui/data-table';
import { createPopover } from '../../../../shared/ui/popover';
import type { PopoverControl } from '../../../../shared/ui/popover';
import { setButtonLabel } from '../../../../shared/ui/fields';

const platformMenus = new WeakMap<HTMLButtonElement, PopoverControl>();

export interface PlatformsRouteOptions {
    list: HTMLElement;
    addButton: HTMLButtonElement;
    project: ProjectConfig;
    onAdd(platform: string): Promise<void>;
    onOpen(platform: string): void;
    onRemove(platform: string): Promise<void>;
}

export function projectPlatforms(project: ProjectConfig): string[] {
    return Array.from(new Set(project.profiles.map((profile) => profile.platform)));
}

export function renderPlatformsRoute(options: PlatformsRouteOptions): void {
    platformMenus.get(options.addButton)?.destroy(); platformMenus.delete(options.addButton);
    const configured = new Set(projectPlatforms(options.project));
    const available = SUPPORTED_PLATFORMS.filter((platform) => !configured.has(platform));
    options.addButton.disabled = available.length === 0;
    setButtonLabel(options.addButton, available.length ? 'Add platform' : 'All platforms added');
    options.addButton.setAttribute('aria-haspopup', 'menu');
    options.addButton.setAttribute('aria-expanded', 'false');
    const menu = createActionList('platform-menu-list'); menu.setAttribute('role', 'menu');
    const popover = createPopover({ trigger: options.addButton, content: menu, align: 'end', triggerOnClick: false }); platformMenus.set(options.addButton, popover);
    for (const platform of available) { const item = createActionListItem({ title: platformName(platform), onActivate: () => { item.button.disabled = true; popover.hide(); void options.onAdd(platform); } }); item.button.setAttribute('role', 'menuitem'); menu.appendChild(item.element); }
    options.addButton.onclick = (event): void => { event.stopPropagation(); if (available.length) popover.toggle(); };
    const platforms = projectPlatforms(options.project);
    const table = createDataTable<string>({
        items: platforms,
        keyOf: (platform) => platform,
        emptyMessage: 'No platforms configured. Add the first platform for this project.',
        className: 'platforms-table',
        columns: [
            { id: 'platform', label: 'Platform', width: '220px', render: platformName },
            { id: 'description', label: 'Description', render: platformDescription },
            {
                id: 'actions', label: '', width: '72px', align: 'end', render: (platform) => {
                    const remove = createIconButton({ icon: 'trash', label: `Remove ${platformName(platform)}`, className: 'btn-danger', size: 'sm' });
                    remove.addEventListener('click', () => void options.onRemove(platform));
                    return remove;
                },
            },
        ],
        onSelect: options.onOpen,
    });
    options.list.replaceChildren(table.element);
}

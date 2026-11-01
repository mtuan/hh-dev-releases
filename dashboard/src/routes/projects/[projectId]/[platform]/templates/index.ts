import type { BuildTemplateStatus } from '../../../../../../electron/types';
import { createDataTable } from '../../../../../shared/ui/data-table';
import { createButton, setButtonLoading } from '../../../../../shared/ui/fields';
import { createPanel } from '../../../../../shared/ui/panel';

interface TemplateFileRow {
    path: string;
    status: string;
    badgeClass: string;
}

export function renderBuildTemplateFiles(target: HTMLElement, status: BuildTemplateStatus): void {
    const groups: Array<[string, string[], string]> = [
        ['Missing', status.missing, 'badge-failed'],
        ['Customized', status.modified, 'badge-running'],
        ['Project only', status.projectOnly, 'badge'],
        ['Installed', status.unchanged, 'badge-success'],
    ];
    const items: TemplateFileRow[] = groups.flatMap(([name, files, badgeClass]) => files.map((path) => ({ path, status: name, badgeClass })));
    const table = createDataTable<TemplateFileRow>({
        items,
        keyOf: (item) => `${item.status}:${item.path}`,
        emptyMessage: 'No template files were found.',
        className: 'template-files-table',
        columns: [
            { id: 'path', label: 'File', render: (item) => item.path },
            { id: 'status', label: 'Status', width: '130px', render: (item) => { const badge = document.createElement('span'); badge.className = `badge ${item.badgeClass}`; badge.textContent = item.status; return badge; } },
        ],
    });
    target.replaceChildren(table.element);
}

const statusCopy: Record<BuildTemplateStatus['state'], [string, string, string]> = {
    unavailable: ['Unavailable', 'The dashboard does not ship shared files for this platform yet.', 'badge-failed'],
    'not-installed': ['Not installed', 'Shared platform files are available, but none have been added to this project.', 'badge-running'],
    partial: ['Partially installed', 'Some shared files are missing from the project. Existing custom files are preserved.', 'badge-running'],
    installed: ['Installed', 'All shared files are present and still match the dashboard defaults.', 'badge-success'],
    customized: ['Customized', 'Required files are present and this project contains customized or additional files.', 'badge-running'],
};

export function createBuildTemplatesPanel(status: BuildTemplateStatus, onInstall: (missing: string[]) => Promise<void>): HTMLElement {
    const [label, description, badgeClass] = statusCopy[status.state];
    const content = document.createElement('div');
    content.className = 'template-status-section';
    const destination = document.createElement('div');
    const destinationLabel = document.createElement('span'); destinationLabel.className = 'panel-label'; destinationLabel.textContent = 'Project destination';
    const destinationPath = document.createElement('code'); destinationPath.className = 'template-path'; destinationPath.textContent = status.destination;
    destination.append(destinationLabel, destinationPath);
    const files = document.createElement('div'); renderBuildTemplateFiles(files, status);
    content.append(destination, files);

    const actions = document.createElement('div');
    if (status.missing.length) {
        const install = createButton({ label: `Install ${status.missing.length} missing file${status.missing.length === 1 ? '' : 's'}`, className: 'btn-primary', symbol: 'folder', size: 'sm' });
        install.addEventListener('click', () => {
            install.disabled = true; setButtonLoading(install, true);
            void onInstall(status.missing).finally(() => { setButtonLoading(install, false); install.disabled = false; });
        });
        actions.appendChild(install);
    }
    return createPanel({ title: 'Build templates', status: label, statusClass: badgeClass, description, content, actions, tagName: 'li', className: 'ui-content-panel build-templates-panel' }).element;
}

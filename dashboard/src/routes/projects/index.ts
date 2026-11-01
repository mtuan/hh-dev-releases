import { ProjectConfig } from '../../../electron/types';
import { createIconButton } from '../../shared/ui/icon-button';
import { createDataTable } from '../../shared/ui/data-table';

export interface ProjectsRouteOptions {
    list: HTMLElement;
    projects: ProjectConfig[];
    selectedProjectId: string | null;
    onOpen(project: ProjectConfig): void;
    onRemove(project: ProjectConfig): Promise<void>;
}

export function renderProjectsRoute(options: ProjectsRouteOptions): void {
    const table = createDataTable<ProjectConfig>({
        items: options.projects,
        keyOf: (project) => project.id,
        selectedKey: options.selectedProjectId ?? undefined,
        emptyMessage: 'No projects configured.',
        className: 'projects-table',
        columns: [
            { id: 'project', label: 'Project', width: '32%', render: (project) => project.name },
            { id: 'path', label: 'Location', render: (project) => project.projectPath },
            {
                id: 'actions', label: 'Actions', width: '72px', align: 'end', render: (project) => {
                    const remove = createIconButton({ icon: 'trash', label: `Remove ${project.name}`, className: 'btn-danger', size: 'sm' });
                    remove.addEventListener('click', (event) => { event.stopPropagation(); void options.onRemove(project); });
                    return remove;
                },
            },
        ],
        onSelect: options.onOpen,
    });
    options.list.replaceChildren(table.element);
}

import { ProjectConfig } from '../../../../electron/types';
import { renderPageHeader } from '../../../shared/ui/page-header';
import { showAlert } from '../../../shared/ui/modal';
import { createFileField, type FieldControl } from '../../../shared/ui/fields';
import { createFormController } from '../../../shared/ui/form-state';
import { createDynamicForm } from '../../../shared/ui/dynamic-form';
import { createContentPanel } from '../../../shared/ui/content-panel';

interface Options {
    header: HTMLElement;
    container: HTMLElement;
    project: ProjectConfig;
    onSaved(projects: import('../../../../electron/types').ProjectsFile, projectId: string): void;
}

export function renderProjectInfoRoute({ header, container, project, onSaved }: Options): void {
    const detectedFacebookIcon = project.iconPath?.replaceAll('\\', '/').includes('/.cocos-build-dashboard/fb-instant-games/console-assets/') ?? false;
    const iconName = project.iconPath?.split(/[\\/]/).pop() ?? '';
    let pendingIcon: string | undefined;
    let clearIcon = false;
    renderPageHeader(header, {
        title: 'Info',
        description: 'Manage the project identity shared with everyone who uses this repository.',
        actions: [{ id: 'save-project-info-btn', label: 'Save', className: 'btn-primary' }],
    });
    container.innerHTML = '';
    const dynamic = createDynamicForm({
        initialValues: { id: project.id, name: project.name, orientation: project.orientation, iconPath: project.iconPath ?? '' },
        layout: [['id', 'name'], ['orientation'], ['iconPath']],
        fields: [
            { key: 'id', type: 'text', label: 'ID', description: 'Used in routes and tool configuration.', placeholder: 'project-id', required: true, validate: (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value).trim()) ? undefined : 'Project ID must use lowercase letters, numbers, and single hyphens only.' },
            { key: 'name', type: 'text', label: 'Name', placeholder: 'Project name', required: true },
            { key: 'orientation', type: 'segmented', label: 'Orientation', description: 'The default display orientation shared by the project.', options: [{ value: 'landscape', label: 'Landscape' }, { value: 'portrait', label: 'Portrait' }] },
            { key: 'iconPath', type: 'custom', label: 'Icon', description: detectedFacebookIcon ? 'Automatically using the valid 1024 × 1024 App icon extracted from FB Instant assets. Browse to override it or clear it to disable automatic selection.' : 'Choose a PNG image that is exactly 1024 × 1024 pixels. If unset, a valid extracted FB Instant App icon is used automatically.', create: (value) => createFileField({ value: String(value ?? ''), placeholder: 'Auto-detect or choose a PNG image', accept: 'image/png', preview: 'image', formatValue: (source) => source === project.iconPath && detectedFacebookIcon ? `${iconName} · Auto-detected from FB Instant` : source.split(/[\\/]/).pop() ?? source, choose: () => window.buildApi.pickProjectIcon() }), onChange: (value) => { const next = String(value ?? ''); pendingIcon = next && next !== project.iconPath ? next : undefined; clearIcon = !next; } },
        ],
    });
    const idInput = dynamic.getControl('id') as FieldControl<string>;
    const nameInput = dynamic.getControl('name') as FieldControl<string>;
    container.appendChild(createContentPanel({ title: 'Basic Settings', content: dynamic.element }));

    const save = header.querySelector<HTMLButtonElement>('#save-project-info-btn')!;
    const read = () => ({ id: String(dynamic.values.id), name: String(dynamic.values.name), orientation: dynamic.values.orientation as ProjectConfig['orientation'], iconSourcePath: pendingIcon, clearIcon });
    const form = createFormController({
        read, saveButton: save,
        validate: (value) => [
            ...(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id.trim()) ? [{ element: idInput.input, message: 'Project ID must use lowercase letters, numbers, and single hyphens only.' }] : []),
            ...(!value.name.trim() ? [{ element: nameInput.input, message: 'Project name is required.' }] : []),
        ],
        save: async (value) => {
            try {
            const projects = await window.buildApi.updateProjectInfo({
                currentId: project.id,
                id: value.id,
                name: value.name,
                orientation: value.orientation,
                projectPath: project.projectPath,
                iconSourcePath: value.iconSourcePath,
                clearIcon: value.clearIcon,
            });
            const saved = projects.projects.find((candidate) => candidate.projectPath === project.projectPath);
            onSaved(projects, saved?.id ?? idInput.value.trim());
            } catch (error) { showAlert(error instanceof Error ? error.message : String(error), 'Could not save project info', 'warning'); throw error; }
        },
    });
    dynamic.onChange(() => form.changed());
}

interface TemplateTreeNode {
    name: string;
    isFolder: boolean;
    relPath?: string;
    children: TemplateTreeNode[];
    parent: TemplateTreeNode | null;
}

function buildTemplateFileTree(paths: string[]): TemplateTreeNode {
    const root: TemplateTreeNode = { name: '', isFolder: true, children: [], parent: null };
    for (const relPath of paths) {
        const parts = relPath.split('/');
        let current = root;
        parts.forEach((part, i) => {
            const isFile = i === parts.length - 1;
            if (isFile) {
                current.children.push({ name: part, isFolder: false, relPath, children: [], parent: current });
                return;
            }
            let folder = current.children.find((c) => c.isFolder && c.name === part);
            if (!folder) {
                folder = { name: part, isFolder: true, children: [], parent: current };
                current.children.push(folder);
            }
            current = folder;
        });
    }
    const sortNode = (node: TemplateTreeNode): void => {
        node.children.sort((a, b) => (a.isFolder !== b.isFolder ? (a.isFolder ? -1 : 1) : a.name.localeCompare(b.name)));
        node.children.forEach(sortNode);
    };
    sortNode(root);
    return root;
}

export async function showCodebaseImportDialog(project: ProjectConfig, onImported?: () => void): Promise<void> {
    let files: string[];
    try {
        files = (await window.buildApi.listCodebaseFiles(project.projectPath)).sort();
    } catch (error) {
        showAlert(`Lỗi khi đọc thư mục codebase:\n${error instanceof Error ? error.message : String(error)}`, 'Không thể đọc codebase', 'warning');
        return;
    }
    if (files.length === 0) {
        showAlert('Chưa có file nào trong "codebase/" của tool cocos-build-dashboard.\n\nHãy thêm file vào thư mục đó rồi thử lại.', 'Codebase trống', 'warning');
        return;
    }
    showFileTreeDialog({
        title: 'Add Code base vào assets/scripts/',
        files,
        onConfirm: async (selected) => {
            const conflicts = await window.buildApi.findCodebaseConflicts(project.projectPath, selected);
            let toImport = selected;
            if (conflicts.length > 0) {
                const overwrite = await showOverwriteDialog(conflicts);
                if (overwrite === null) {
                    return null;
                }
                const skipped = new Set(conflicts.filter((c) => !overwrite.includes(c)));
                toImport = selected.filter((p) => !skipped.has(p));
            }
            if (toImport.length === 0) {
                return 'Không có file nào được add (đã bỏ qua toàn bộ file trùng).';
            }
            await window.buildApi.importCodebase(project.projectPath, toImport);
            onImported?.();
            const skippedCount = selected.length - toImport.length;
            return `Đã add ${toImport.length} file vào assets/scripts/` + (skippedCount > 0 ? ` (bỏ qua ${skippedCount} file trùng)` : '');
        },
    });
}

/** Lists files that already exist in the project; resolves with the ones ticked for overwrite, or null if cancelled. */
function showOverwriteDialog(conflicts: string[]): Promise<string[] | null> {
    return new Promise((resolve) => {
        const content = document.createElement('div'); content.className = 'inline-form modal-box-wide'; const picker = appendFileTreePicker(content, conflicts); let settled = false;
        const finish = (value: string[] | null, close: () => void): void => { if (settled) return; settled = true; resolve(value); close(); };
        showModal({ title: `${conflicts.length} file đã tồn tại — chọn file muốn ghi đè`, icon: 'warning', content, onClose: () => { if (!settled) { settled = true; resolve(null); } }, actions: [{ label: 'Cancel', run: (close) => finish(null, close) }, { label: 'Tiếp tục', className: 'btn-primary', run: (close) => finish(picker.getSelected(), close) }] });
    });
}

/** Renders a toolbar + checkbox tree of `files` into `box`; returns a getter for the checked file paths. */
function appendFileTreePicker(box: HTMLElement, files: string[]): { getSelected: () => string[] } {
    const toolbarRow = document.createElement('div');
    toolbarRow.className = 'modal-actions';
    const toggleAllBtn = createButton({ label: 'Bỏ chọn tất cả', className: 'btn-secondary', size: 'sm', symbol: 'check' });
    toolbarRow.appendChild(toggleAllBtn);
    box.appendChild(toolbarRow);

    const listEl = document.createElement('div');
    listEl.className = 'template-file-list';
    box.appendChild(listEl);

    const tree = buildTemplateFileTree(files);
    const nodeCheckbox = new Map<TemplateTreeNode, HTMLInputElement>();
    const leafNodes: TemplateTreeNode[] = [];

    const setDescendantsChecked = (node: TemplateTreeNode, checked: boolean): void => {
        for (const child of node.children) {
            const childCb = nodeCheckbox.get(child)!;
            childCb.checked = checked;
            childCb.indeterminate = false;
            if (child.isFolder) {
                setDescendantsChecked(child, checked);
            }
        }
    };

    const updateAncestors = (node: TemplateTreeNode | null): void => {
        while (node) {
            const cb = nodeCheckbox.get(node)!;
            const childCbs = node.children.map((c) => nodeCheckbox.get(c)!);
            const checkedCount = childCbs.filter((c) => c.checked && !c.indeterminate).length;
            const hasIndeterminate = childCbs.some((c) => c.indeterminate);
            if (hasIndeterminate || (checkedCount > 0 && checkedCount < childCbs.length)) {
                cb.checked = false;
                cb.indeterminate = true;
            } else {
                cb.checked = checkedCount === childCbs.length;
                cb.indeterminate = false;
            }
            node = node.parent;
        }
    };

    const renderNode = (node: TemplateTreeNode, container: HTMLElement, depth: number): void => {
        const hasChildren = node.isFolder && node.children.length > 0;

        const row = document.createElement('label');
        row.className = 'template-file-row';
        row.style.paddingLeft = `${depth * 18}px`;

        const toggle = document.createElement('span');
        toggle.className = 'template-tree-toggle';
        if (hasChildren) {
            toggle.textContent = '▼';
            toggle.addEventListener('click', (event) => {
                event.preventDefault();
                const collapsed = childrenContainer!.style.display === 'none';
                childrenContainer!.style.display = collapsed ? '' : 'none';
                toggle.textContent = collapsed ? '▼' : '▶';
            });
        }
        row.appendChild(toggle);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        nodeCheckbox.set(node, cb);
        row.appendChild(cb);
        row.appendChild(node.isFolder ? createIcon('folder', 'icon-folder') : createIcon('file'));
        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;
        row.appendChild(nameSpan);
        container.appendChild(row);

        if (!node.isFolder) {
            leafNodes.push(node);
        }

        cb.addEventListener('change', () => {
            cb.indeterminate = false;
            if (node.isFolder) {
                setDescendantsChecked(node, cb.checked);
            }
            updateAncestors(node.parent);
        });

        let childrenContainer: HTMLDivElement | null = null;
        if (hasChildren) {
            childrenContainer = document.createElement('div');
            childrenContainer.className = 'template-tree-children';
            container.appendChild(childrenContainer);
            for (const child of node.children) {
                renderNode(child, childrenContainer, depth + 1);
            }
        }
    };

    for (const child of tree.children) {
        renderNode(child, listEl, 0);
    }

    let allSelected = true;
    toggleAllBtn.addEventListener('click', () => {
        allSelected = !allSelected;
        for (const cb of nodeCheckbox.values()) {
            cb.checked = allSelected;
            cb.indeterminate = false;
        }
        setButtonLabel(toggleAllBtn, allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả');
    });

    return { getSelected: () => leafNodes.filter((n) => nodeCheckbox.get(n)!.checked).map((n) => n.relPath!) };
}

interface FileTreeDialogOptions {
    title: string;
    files: string[];
    /** Resolve to a success message, or null to keep the dialog open (e.g. user declined a confirm). */
    onConfirm: (selected: string[]) => Promise<string | null>;
}

function showFileTreeDialog({ title: titleText, files, onConfirm }: FileTreeDialogOptions): void {
    const content = document.createElement('div'); content.className = 'inline-form modal-box-wide'; const picker = appendFileTreePicker(content, files);
    showModal({ title: titleText, content, actions: [{ label: 'Cancel', run: (close) => close() }, { label: 'Add', className: 'btn-primary', run: (close) => {
        void (async () => {
            const selected = picker.getSelected();
            if (selected.length === 0) {
                return;
            }
            let message: string | null;
            try {
                message = await onConfirm(selected);
            } catch (error) {
                showAlert(`Add thất bại:\n${error instanceof Error ? error.message : String(error)}`, 'Không thể thêm file', 'warning');
                return;
            }
            if (message === null) {
                return;
            }
            close();
            showAlert(message, 'Hoàn tất');
        })();
    } }] });
}

import { DetectedProject, ProjectConfig, ProjectsFile } from '../../../electron/types';
import { createIcon } from './icon';

export interface DialogHost {
    projectsFile: ProjectsFile;
    detectedProject: DetectedProject | null;
    getSelectedProject(): ProjectConfig | undefined;
    selectProject(id: string): void;
    selectPlatform(platform: string): void;
    renderProjects(): void;
    renderBuild(): void;
    renderPlatforms(): void;
    showPlatforms(): void;
}

let dialogHost: DialogHost;
export function configureDialogs(host: DialogHost): void { dialogHost = host; }

import { showAlert, showModal } from './modal';
import { createButton, setButtonLabel } from './fields';

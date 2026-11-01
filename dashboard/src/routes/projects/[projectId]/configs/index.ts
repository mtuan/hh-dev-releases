import { ProjectConfig } from '../../../../../electron/types';
import { createButton, setButtonLabel, setButtonLoading } from '../../../../shared/ui/fields';
import { createDataTable, type DataTableControl } from '../../../../shared/ui/data-table';
import { showConfirm } from '../../../../shared/ui/modal';
import { runWithLoadingState } from '../../../../shared/ui/loading-state';

interface SetupRouteOptions {
    list: HTMLElement;
    project: ProjectConfig;
    onInstallCodebase(): void;
    onInstallBridge(): Promise<void>;
    onSyncTooling(): Promise<void>;
    onSyncPreviewSimulator(): Promise<void>;
    onResetPreviewSimulator(): Promise<void>;
    isCurrent(): boolean;
}

interface SetupAction { label: string; run(): void | Promise<void>; primary?: boolean; danger?: boolean; pendingLabel?: string; refresh?: boolean }
interface SetupRecord { id: string; component: string; description: string; status: string; statusClass: string; actions: SetupAction[] }

function showResetConfirmation(title: string, detail: string, reset: () => Promise<void>): Promise<void> {
    return showConfirm({ title: `Reset ${title}?`, message: detail, confirmLabel: 'Reset', danger: true }).then(async (confirmed) => { if (confirmed) await reset(); });
}

async function loadSetupRecords(options: SetupRouteOptions): Promise<SetupRecord[]> {
    const [files, bridge, tooling, cocosAccount] = await Promise.all([
        window.buildApi.listCodebaseFiles(options.project.projectPath),
        window.buildApi.getBridgeStatus(options.project.projectPath),
        window.buildApi.getToolingStatus(options.project.projectPath),
        window.buildApi.getCocosAccountStatus(),
    ]);
    const existing = await window.buildApi.findCodebaseConflicts(options.project.projectPath, files);
    const codebaseInstalled = files.length > 0 && existing.length === files.length;
    const codebasePartial = existing.length > 0 && !codebaseInstalled;
    const codebaseSupported = files.length > 0;
    const reset = (component: 'codebase' | 'bridge' | 'tooling', title: string, detail: string): Promise<void> => showResetConfirmation(title, detail, () => window.buildApi.resetSetupComponent(options.project.projectPath, component));
    const records: SetupRecord[] = [];
    const identity = cocosAccount.nickname || cocosAccount.email;
    records.push({ id: 'cocos-account', component: 'Cocos account', description: cocosAccount.sessionExists ? (identity ? `Saved for ${identity}.` : 'A saved Creator session was detected.') : 'No Creator session was detected. This is informational and does not block builds.', status: cocosAccount.sessionExists ? 'Session detected' : 'Not detected', statusClass: cocosAccount.sessionExists ? 'badge-success' : 'badge-neutral', actions: [{ label: 'Open Cocos Creator', run: () => window.buildApi.openCreator(options.project.projectPath, options.project.creatorExecutable), pendingLabel: 'Opening…', refresh: false }] });
    if (codebaseSupported || existing.length > 0) records.push({
        id: 'shared-codebase', component: 'Shared codebase', description: codebaseSupported ? 'Reusable project-wide TypeScript infrastructure installed under assets/scripts/ and committed with the project.' : 'Cocos Creator 3.x shared-code files were found in this Cocos Creator 2.x project.',
        status: codebaseSupported ? (codebaseInstalled ? 'Installed' : codebasePartial ? 'Partial' : 'Not installed') : 'Incompatible files', statusClass: codebaseSupported && codebaseInstalled ? 'badge-success' : 'badge-running',
        actions: [...(codebaseSupported ? [{ label: codebaseInstalled ? 'Manage' : codebasePartial ? 'Review files' : 'Install', run: options.onInstallCodebase, primary: !codebaseInstalled, refresh: false }] : []), ...(existing.length ? [{ label: codebaseSupported ? 'Reset' : 'Remove incompatible files', danger: true, run: () => reset('codebase', 'shared codebase', 'Remove dashboard-provided scripts and their file metadata from this project. Project-specific scripts are left untouched.') }] : [])],
    });
    records.push({
        id: 'editor-build-bridge', component: 'Editor build bridge', description: bridge.supported ? 'Allows the dashboard to queue builds through an already-open Cocos Creator Editor.' : 'Cocos Creator 2.x uses the dashboard command-line build flow and does not require an Editor bridge.',
        status: !bridge.supported ? 'Not required' : bridge.running ? 'Connected' : bridge.installed ? 'Installed' : 'Not installed', statusClass: !bridge.supported || bridge.running || bridge.installed ? 'badge-success' : 'badge-running',
        actions: [{ label: 'Open Cocos Creator', run: () => window.buildApi.openCreator(options.project.projectPath, options.project.creatorExecutable), pendingLabel: 'Opening…', refresh: false }, ...(bridge.supported ? (!bridge.installed ? [{ label: 'Install', run: options.onInstallBridge, primary: true, pendingLabel: 'Installing…' }] : [{ label: 'Reset', danger: true, run: () => reset('bridge', 'Editor build bridge', 'Remove the dashboard bridge extension from this project. You can install it again at any time.') }]) : [])],
    });
    records.push({
        id: 'managed-tooling', component: 'Managed project tooling', description: 'Version-matched loading configuration and dashboard support files for this Cocos Creator project.', status: tooling.conflicts.length ? 'Customized' : tooling.needsSync ? 'Update available' : 'Up to date', statusClass: tooling.conflicts.length || tooling.needsSync ? 'badge-running' : 'badge-success',
        actions: [...(tooling.needsSync && !tooling.conflicts.length ? [{ label: tooling.managedInstallationExists ? 'Update' : 'Install', run: options.onSyncTooling, primary: true, pendingLabel: tooling.managedInstallationExists ? 'Updating…' : 'Installing…' }] : []), ...(tooling.managedInstallationExists || tooling.lockExists || tooling.loadingConfigExists || tooling.loadingThemeExists ? [{ label: 'Reset', danger: true, run: () => reset('tooling', 'managed project tooling', 'Remove managed tooling metadata, loading configuration, loading theme, schema, and unchanged managed bridge files.') }] : [])],
    });
    if (tooling.creatorFamily === '2.x') records.push({
        id: 'preview-simulator', component: 'Local preview simulator', description: 'Adds the managed preview toolbar, platform API simulation, and Full, Portrait, and Landscape viewport modes to this project.', status: tooling.previewSimulatorInstalled ? (tooling.previewSimulatorCustomized ? 'Update available' : 'Integrated') : 'Not integrated', statusClass: tooling.previewSimulatorInstalled && !tooling.previewSimulatorCustomized ? 'badge-success' : 'badge-running',
        actions: tooling.previewSimulatorInstalled ? [{ label: 'Update', run: options.onSyncPreviewSimulator, pendingLabel: 'Updating…' }, { label: 'Remove', danger: true, run: () => showResetConfirmation('local preview simulator', 'Remove the managed simulator and restore this project’s original Cocos preview template behavior.', options.onResetPreviewSimulator) }] : [{ label: 'Integrate', primary: true, run: options.onSyncPreviewSimulator, pendingLabel: 'Integrating…' }],
    });
    return records;
}

export async function renderProjectSetupRoute(options: SetupRouteOptions): Promise<void> {
    let table: DataTableControl<SetupRecord>;
    const refresh = async (): Promise<void> => { const records = await loadSetupRecords(options); if (options.isCurrent()) table.setItems(records); };
    const actionsCell = (record: SetupRecord): HTMLElement => {
        const group = document.createElement('div'); group.className = 'setup-table-actions';
        for (const action of record.actions) {
            const button = createButton({ label: action.label, className: action.danger ? 'btn-danger' : action.primary ? 'btn-primary' : 'btn-secondary', size: 'sm' });
            button.addEventListener('click', () => {
                const buttons = Array.from(group.querySelectorAll('button')); buttons.forEach((item) => { item.disabled = true; }); setButtonLabel(button, action.pendingLabel ?? `${action.label.replace(/e$/, '')}ing…`); setButtonLoading(button, true);
                void Promise.resolve(action.run()).then(async () => { if (action.refresh !== false) await refresh(); else { setButtonLoading(button, false); setButtonLabel(button, action.label); buttons.forEach((item) => { item.disabled = false; }); } }).catch((error) => { setButtonLoading(button, false); setButtonLabel(button, 'Retry'); button.title = error instanceof Error ? error.message : String(error); buttons.forEach((item) => { item.disabled = false; }); });
            }); group.appendChild(button);
        }
        return group;
    };
    table = createDataTable<SetupRecord>({
        items: [], keyOf: (record) => record.id, emptyMessage: 'No project configurations are available.', className: 'project-configurations-table',
        columns: [
            { id: 'component', label: 'Component', width: '210px', render: (record) => record.component },
            { id: 'description', label: 'Description', render: (record) => { const value = document.createElement('span'); value.textContent = record.description; value.title = record.description; return value; } },
            { id: 'status', label: 'Status', width: '140px', render: (record) => { const badge = document.createElement('span'); badge.className = `badge ${record.statusClass}`; badge.textContent = record.status; return badge; } },
            { id: 'actions', label: '', width: '300px', align: 'end', render: actionsCell },
        ],
    });
    options.list.replaceChildren(table.element);
    await runWithLoadingState(options.list, async () => {
        const records = await loadSetupRecords(options);
        if (options.isCurrent()) table.setItems(records);
    }, { label: 'Loading project configurations…', overlay: true });
}

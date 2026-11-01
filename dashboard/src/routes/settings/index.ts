import type { AppUpdatePreferences, AppUpdateState } from '../../../electron/types';
import { createButton, createCheckboxField, createSegmentedField } from '../../shared/ui/fields';
import { createFormController } from '../../shared/ui/form-state';
import { renderPageHeader } from '../../shared/ui/page-header';
import { createSettingsControl, createSettingsPanel } from '../../shared/ui/settings-panel';

export interface SettingsRouteControl { update(state: AppUpdateState): void; }

function stageLabel(state: AppUpdateState): string {
    const labels: Record<AppUpdateState['stage'], string> = {
        unsupported: state.packaged ? 'Update feed unavailable' : 'Available in installed builds', idle: 'Ready', checking: 'Checking…', available: `Version ${state.availableVersion} available`,
        'not-available': 'Up to date', downloading: `Downloading ${state.progress}%`, downloaded: 'Ready to install', deferred: 'Install waiting for active jobs', error: 'Update failed',
    };
    return labels[state.stage];
}

export function renderSettingsRoute(options: {
    header: HTMLElement;
    content: HTMLElement;
    state: AppUpdateState;
    save(preferences: AppUpdatePreferences): Promise<AppUpdateState>;
    check(): Promise<AppUpdateState>;
    download(): Promise<AppUpdateState>;
    install(): Promise<AppUpdateState>;
}): SettingsRouteControl {
    renderPageHeader(options.header, { title: 'Settings', description: 'Manage HayHay Dev Tools updates and release preferences.', actions: [
        { id: 'settings-save-btn', label: 'Save', className: 'btn-primary' },
        { id: 'settings-check-update-btn', label: 'Check for updates', className: 'btn-secondary', symbol: 'refresh', shortcut: false },
    ] });
    options.content.replaceChildren();
    const saveButton = options.header.querySelector<HTMLButtonElement>('#settings-save-btn')!;
    const checkButton = options.header.querySelector<HTMLButtonElement>('#settings-check-update-btn')!;
    const updateAction = createButton({ label: 'Download update', className: 'btn-primary', symbol: 'download' });
    options.header.querySelector('.header-actions')?.appendChild(updateAction);

    const channel = createSegmentedField([{ value: 'stable', label: 'Stable' }, { value: 'beta', label: 'Beta' }]);
    const autoCheck = createCheckboxField('Check for updates automatically');
    const autoDownload = createCheckboxField('Download available updates automatically');
    const version = document.createElement('span'); version.className = 'settings-value';
    const status = document.createElement('span'); status.className = 'settings-value';
    const checked = document.createElement('span'); checked.className = 'settings-value';
    const error = document.createElement('p'); error.className = 'settings-update-error'; error.hidden = true;
    const list = document.createElement('ul'); list.className = 'settings-panel-list';
    list.append(
        createSettingsPanel({ title: 'Application update', collapsible: false, rows: [
            { fields: [{ title: 'Current version', actions: createSettingsControl(version) }, { title: 'Status', actions: createSettingsControl(status) }] },
            { title: 'Last checked', actions: createSettingsControl(checked) },
            { title: 'Release channel', actions: createSettingsControl(channel) },
            { title: 'Automatic checks', actions: createSettingsControl(autoCheck.element) },
            { title: 'Automatic downloads', actions: createSettingsControl(autoDownload.element) },
            { title: 'Update error', content: error },
        ] }),
    );
    options.content.appendChild(list);

    const read = (): AppUpdatePreferences => ({ channel: channel.value as AppUpdatePreferences['channel'], autoCheck: autoCheck.value, autoDownload: autoDownload.value });
    const form = createFormController({ read, saveButton, save: async (preferences) => { control.update(await options.save(preferences)); } });
    channel.onChange(() => form.changed()); autoCheck.onChange(() => form.changed()); autoDownload.onChange(() => form.changed());

    checkButton.addEventListener('click', () => void options.check().then((state) => control.update(state)));
    updateAction.addEventListener('click', () => {
        const action = updateAction.dataset.action;
        void (action === 'install' ? options.install() : options.download()).then((state) => control.update(state));
    });
    const control: SettingsRouteControl = { update(state) {
        const preserveDraft = form.state.dirty;
        version.textContent = state.currentVersion;
        status.textContent = stageLabel(state);
        checked.textContent = state.checkedAt ? new Date(state.checkedAt).toLocaleString() : 'Never';
        error.textContent = state.error ?? ''; error.hidden = !state.error;
        if (!preserveDraft) { channel.setValue(state.channel); autoCheck.setValue(state.autoCheck); autoDownload.setValue(state.autoDownload); }
        checkButton.disabled = !state.feedConfigured || state.stage === 'checking' || state.stage === 'downloading';
        updateAction.hidden = state.stage !== 'available' && state.stage !== 'downloaded' && state.stage !== 'deferred';
        updateAction.dataset.action = state.stage === 'downloaded' || state.stage === 'deferred' ? 'install' : 'download';
        const label = updateAction.querySelector<HTMLElement>('.ui-button-label'); if (label) label.textContent = state.stage === 'deferred' ? 'Install when jobs finish' : state.stage === 'downloaded' ? 'Restart and install' : 'Download update';
        updateAction.disabled = state.stage === 'deferred';
        if (!preserveDraft) form.acceptCurrent();
    } };
    control.update(options.state);
    return control;
}

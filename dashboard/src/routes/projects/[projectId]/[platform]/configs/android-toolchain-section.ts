import { AndroidToolchainComponent, AndroidToolchainStatus, ProjectConfig } from '../../../../../../electron/types';
import { createSettingsPanel, SettingsPanelRow } from '../../../../../shared/ui/settings-panel';
import { createButton } from '../../../../../shared/ui/fields';

interface ComponentView { id: AndroidToolchainComponent; title: string; configured: string; detected: string; configuredValid: boolean; missingText: string }

function componentViews(status: AndroidToolchainStatus): ComponentView[] {
    return [
        { id: 'sdk', title: 'Android SDK', configured: status.configured.sdkPath, detected: status.detected.sdkPath, configuredValid: !status.issues.some((issue) => issue.startsWith('Android SDK')), missingText: 'Install Android command-line tools, platform tools, API 35, and build tools.' },
        { id: 'ndk', title: 'Android NDK', configured: status.configured.ndkPath, detected: status.detected.ndkPath, configuredValid: !status.issues.some((issue) => issue.startsWith('Android NDK')), missingText: 'Install Cocos-compatible Android NDK 23.2.8568313.' },
        { id: 'jdk', title: `JDK ${status.requiredJdkMajor}`, configured: status.configured.javaHome, detected: status.detected.javaHome, configuredValid: !status.issues.some((issue) => issue.startsWith('JDK ')), missingText: `Install OpenJDK ${status.requiredJdkMajor} with Homebrew.` },
    ];
}

export function createAndroidToolchainSection(project: ProjectConfig, initialStatus: AndroidToolchainStatus): HTMLLIElement {
    let status = initialStatus;
    const tasks = new Map<AndroidToolchainComponent, string>();
    const errors = new Map<AndroidToolchainComponent, string>();
    let section: HTMLLIElement | undefined;

    const refresh = async (): Promise<void> => { status = await window.buildApi.getAndroidToolchainStatus(project.projectPath); };
    const run = async (component: AndroidToolchainComponent): Promise<void> => {
        if (tasks.has(component)) return;
        const taskId = `android-${component}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        tasks.set(component, taskId); errors.delete(component); render();
        try { await window.buildApi.resolveAndroidToolchainComponent(project.projectPath, component, taskId); }
        catch (error) { errors.set(component, error instanceof Error ? error.message : String(error)); }
        finally { tasks.delete(component); await refresh(); render(); }
    };
    const cancel = async (component: AndroidToolchainComponent): Promise<void> => {
        const taskId = tasks.get(component); if (!taskId) return;
        await window.buildApi.cancelAndroidToolchainTask(taskId);
    };
    const choosePath = async (component: AndroidToolchainComponent): Promise<void> => {
        const selected = await window.buildApi.pickFolder(); if (!selected) return;
        errors.delete(component);
        try { status = await window.buildApi.setAndroidToolchainComponent(project.projectPath, component, selected); }
        catch (error) { errors.set(component, error instanceof Error ? error.message : String(error)); }
        render();
    };
    const clearPath = async (component: AndroidToolchainComponent): Promise<void> => {
        errors.delete(component); status = await window.buildApi.clearAndroidToolchainComponent(project.projectPath, component); render();
    };
    const applyAll = (): void => {
        for (const component of componentViews(status)) if (!component.configuredValid && !tasks.has(component.id)) void run(component.id);
    };

    const render = (): void => {
        const headerActions = document.createElement('div'); headerActions.className = 'setup-item-actions';
        const creator = createButton({ label: 'Open Cocos Creator', className: 'btn-secondary', symbol: 'folder' });
        creator.addEventListener('click', () => void window.buildApi.openCreator(project.projectPath, project.creatorExecutable)); headerActions.appendChild(creator);
        if (!status.ready) {
            const unresolved = componentViews(status).some((component) => !component.configuredValid && !tasks.has(component.id));
            const all = createButton({ label: 'Apply all', className: 'btn-primary', disabled: !unresolved });
            all.addEventListener('click', applyAll); headerActions.appendChild(all);
        }
        const rows: SettingsPanelRow[] = [];
        for (const component of componentViews(status)) {
            const configured = component.configuredValid; const hasConfiguredPath = Boolean(component.configured); const detected = Boolean(component.detected); const working = tasks.has(component.id);
            let content: HTMLElement | undefined;
            if (working) { content = document.createElement('div'); content.className = 'android-resolver-progress'; content.appendChild(document.createElement('span')); }
            const error = errors.get(component.id);
            if (error) { const wrapper = document.createElement('div'); if (content) wrapper.appendChild(content); const message = document.createElement('p'); message.className = 'android-resolver-error'; message.textContent = error; wrapper.appendChild(message); content = wrapper; }
            const actions = document.createElement('div'); actions.className = 'setup-item-actions';
            const browse = createButton({ label: 'Browse', className: 'btn-secondary', disabled: working });
            browse.addEventListener('click', () => void choosePath(component.id)); actions.appendChild(browse);
            if (working) {
                const cancelButton = createButton({ label: 'Cancel', className: 'btn-danger' }); cancelButton.addEventListener('click', () => void cancel(component.id)); actions.appendChild(cancelButton);
            } else if (configured) {
                const clear = createButton({ label: 'Clear', className: 'btn-danger' }); clear.addEventListener('click', () => void clearPath(component.id)); actions.appendChild(clear);
            } else {
                const action = createButton({ label: detected ? 'Use detected' : 'Install', className: 'btn-primary' });
                action.addEventListener('click', () => void run(component.id)); actions.appendChild(action);
                if (hasConfiguredPath) { const clear = createButton({ label: 'Clear', className: 'btn-danger' }); clear.addEventListener('click', () => void clearPath(component.id)); actions.appendChild(clear); }
            }
            rows.push({
                title: component.title,
                status: working ? 'Working' : configured ? 'Configured' : hasConfiguredPath ? 'Wrong version' : detected ? 'Detected' : 'Missing',
                statusClass: configured ? 'badge-success' : 'badge-running',
                description: configured ? component.configured : hasConfiguredPath ? `${component.configured} does not satisfy ${component.title}.` : detected ? `${component.detected} is available but not configured for this project.` : component.missingText,
                content,
                actions,
                working,
            });
        }
        const panel = createSettingsPanel({
            title: 'Android toolchain',
            status: status.ready ? 'Configured' : 'Missing components',
            statusClass: status.ready ? 'badge-success' : 'badge-running',
            description: status.ready ? `SDK, NDK, and JDK ${status.requiredJdkMajor} are configured for this project.` : 'Configure the Android build requirements below. Each component can be resolved independently.',
            actions: headerActions,
            rows,
        });
        if (section?.isConnected) section.replaceWith(panel); section = panel;
    };
    render(); return section!;
}

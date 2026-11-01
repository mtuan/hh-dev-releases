import { CocosAccountStatus, ProjectConfig } from '../../../electron/types';
import { createSettingsPanel } from './settings-panel';
import { createButton } from './fields';

export function createCocosAccountPanel(project: ProjectConfig, status: CocosAccountStatus): HTMLLIElement {
    const identity = status.nickname || status.email;
    const description = status.sessionExists
        ? `${identity ? `Saved for ${identity}.` : 'A saved Creator session was detected.'}`
        : 'No Creator session was detected in the legacy profile. This status is informational and does not block builds; sign in manually only if Creator asks you to.';
    const actions = document.createElement('div'); actions.className = 'setup-item-actions';
    const open = createButton({ label: 'Open Cocos Creator', className: 'btn-secondary', symbol: 'folder' });
    open.addEventListener('click', () => void window.buildApi.openCreator(project.projectPath, project.creatorExecutable));
    actions.appendChild(open);
    return createSettingsPanel({
        title: 'Cocos account',
        description,
        status: status.sessionExists ? 'Session detected' : 'Not detected',
        statusClass: status.sessionExists ? 'badge-success' : 'badge-neutral',
        actions,
    });
}

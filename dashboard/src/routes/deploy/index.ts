import type { ReleaseDeploymentConfig } from '../../../electron/types';
import { renderDeployBuilds } from './builds';
import { renderDeployConfigurations } from './configurations';

export type DeployView = 'configurations' | 'builds';

export async function renderDeployRoute(options: { header: HTMLElement; content: HTMLElement; view: DeployView; onOpenConfigurations(): void }): Promise<void> {
    if (options.view === 'configurations') {
        const config: ReleaseDeploymentConfig = await window.buildApi.getReleaseDeploymentConfig();
        renderDeployConfigurations({ header: options.header, content: options.content, config });
        return;
    }
    await renderDeployBuilds({ header: options.header, content: options.content, onOpenConfigurations: options.onOpenConfigurations });
}

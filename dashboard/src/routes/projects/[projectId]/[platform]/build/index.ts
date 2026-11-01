import { BuildProfile, BuildRecord } from '../../../../../../electron/types';
import { createButton, setButtonLoading } from '../../../../../shared/ui/fields';
import { createIconButton } from '../../../../../shared/ui/icon-button';
import { formatRelativeTime } from '../../../../../shared/time';
import { createPanel } from '../../../../../shared/ui/panel';
import { bindCopyAction } from '../../../../../shared/ui/copy-action';

export interface BuildRouteOptions {
    list: HTMLUListElement;
    profiles: BuildProfile[];
    records: BuildRecord[];
    onBuild(profile: BuildProfile, rebuild: boolean): void;
    onOpenOutput(profile: BuildProfile): void;
    onServe(profile: BuildProfile, protocol: 'http' | 'https'): Promise<void>;
    onCancel(profile: BuildProfile): void;
    onCancelDeployment(record: BuildRecord): void;
    onDeploy(profile: BuildProfile, target: 'device' | 'simulator' | 'testflight' | 'google-play' | 'facebook-hosting'): void;
}

function environmentDescription(profile: BuildProfile): string {
    const environment = profile.environment ?? profile.id;
    const webDistribution = profile.platform === 'fb-instant-games' || profile.platform.includes('tiktok');
    const nativeDistribution = profile.platform === 'android' || profile.platform === 'ios';
    if (environment === 'dev') {
        if (webDistribution) return 'Development hosting build · diagnostics and verbose logging';
        if (nativeDistribution) return 'Development device build · USB install and team testing';
        return 'Development build · diagnostics and verbose logging';
    }
    if (environment === 'prod') {
        if (webDistribution) return 'Production hosting build · release settings';
        if (nativeDistribution) return profile.platform === 'ios'
            ? 'Release build · device, TestFlight, or App Store distribution'
            : 'Release build · device, testing track, or store distribution';
        return 'Production build · release settings';
    }
    return `${profile.label} build`;
}

function displayDate(value?: string): string {
    return value ? formatRelativeTime(value) : 'Never built';
}

export function renderBuildRoute(options: BuildRouteOptions): void {
    options.list.innerHTML = '';
    if (!options.profiles.length) {
        const empty = document.createElement('li'); empty.className = 'empty-state';
        empty.textContent = 'This platform has no build environments.';
        options.list.appendChild(empty);
        return;
    }
    for (const profile of options.profiles) {
        const record = options.records.find((candidate) => candidate.profileId === profile.id);
        const isBuilding = record?.status === 'pending' || record?.status === 'running';
        const isDeploying = record?.deploymentStatus === 'uploading';
        const hasPreviousBuild = Boolean(record?.finishedAt || record?.outputExists);
        const body = document.createElement('div'); body.className = 'build-environment-body';
        const metadata = document.createElement('div'); metadata.className = 'build-environment-metadata';
        const values: Array<[string, string, boolean?]> = [
            ['Version', record?.status === 'failed' ? 'Failed' : record?.finishedAt ? record.version : '—', record?.status === 'failed'],
            ['Last built', displayDate(record?.finishedAt)],
            ['Output', profile.buildPath],
        ];
        for (const [label, value, isFailure] of values) {
            const cell = document.createElement('div');
            const term = document.createElement('span'); term.textContent = label;
            if (isFailure) {
                const failure = document.createElement('div'); failure.className = 'build-failure-value build-metadata-value';
                const text = document.createElement('strong'); text.textContent = value;
                const copy = createIconButton({ icon: 'copy', label: 'Copy error details', className: 'build-copy-error-button inline-icon-button' });
                bindCopyAction(copy, () => record?.errorDetails ?? 'No error details were recorded.');
                failure.append(text, copy);
                cell.append(term, failure); metadata.appendChild(cell);
                continue;
            }
            const detail = document.createElement(label === 'Output' ? 'code' : 'strong'); detail.className = 'build-metadata-value'; detail.textContent = value;
            cell.append(term, detail); metadata.appendChild(cell);
        }
        if (['fb-instant-games', 'android', 'ios'].includes(profile.platform)) {
            const cell = document.createElement('div');
            const term = document.createElement('span'); term.textContent = 'Last deployment';
            const deployment = document.createElement('div'); deployment.className = 'build-metadata-value';
            const state = record?.deploymentStatus;
            const label = state === 'uploading' ? 'Processing…' : state === 'success'
                ? `Completed ${displayDate(record?.deploymentFinishedAt)}` : state === 'failed' ? 'Failed' : state === 'canceled' ? 'Canceled' : 'Not deployed';
            const text = document.createElement('strong'); text.textContent = label;
            deployment.appendChild(text);
            if (state === 'failed') {
                deployment.classList.add('build-failure-value');
                const copy = createIconButton({ icon: 'copy', label: 'Copy deployment error', className: 'build-copy-error-button inline-icon-button' });
                bindCopyAction(copy, () => record?.deploymentErrorDetails ?? 'No deployment error details were recorded.');
                deployment.appendChild(copy);
            }
            cell.append(term, deployment); metadata.appendChild(cell);
        }
        body.append(metadata);
        if (isBuilding || isDeploying) {
            const progressRow = document.createElement('div'); progressRow.className = 'build-progress-row';
            const progress = document.createElement('progress'); progress.max = 100; if (isBuilding) progress.value = record?.progress ?? 0;
            const percent = document.createElement('span'); percent.textContent = isDeploying ? 'Processing…' : `${record?.progress ?? 0}%`; if (isDeploying) percent.className = 'deployment-progress-label';
            progressRow.append(progress, percent); body.appendChild(progressRow);
        }
        const actions = document.createElement('div'); actions.className = 'build-environment-actions';
        if (record?.outputExists) {
            const openButton = createIconButton({ icon: 'folder', label: 'Open output folder', className: 'build-folder-button', size: 'sm' });
            openButton.addEventListener('click', () => options.onOpenOutput(profile)); actions.appendChild(openButton);
            if (profile.platform === 'web-desktop' || profile.platform === 'web-mobile') {
                const httpButton = createButton({ label: 'HTTP', symbol: 'globe', className: 'btn-secondary ui-button-sm', title: 'Serve this build locally over HTTP' });
                const httpsButton = createButton({ label: 'HTTPS', symbol: 'lock', className: 'btn-secondary ui-button-sm', title: 'Serve this build locally over HTTPS' });
                const serve = async (button: HTMLButtonElement, protocol: 'http' | 'https') => { button.disabled = true; setButtonLoading(button, true); try { await options.onServe(profile, protocol); } finally { setButtonLoading(button, false); button.disabled = false; } };
                httpButton.addEventListener('click', () => void serve(httpButton, 'http'));
                httpsButton.addEventListener('click', () => void serve(httpsButton, 'https'));
                actions.append(httpButton, httpsButton);
            }
        }
        if (isBuilding || isDeploying) {
            const cancel = createButton({ label: 'Cancel', className: 'btn-danger', size: 'sm' });
            cancel.addEventListener('click', () => isDeploying ? options.onCancelDeployment(record!) : options.onCancel(profile)); actions.appendChild(cancel);
        } else {
            if (profile.platform === 'ios' && record?.outputExists) {
                const simulator = createButton({ label: 'Simulator', className: 'btn-secondary', size: 'sm', title: 'Build, install, and launch in iOS Simulator' });
                simulator.addEventListener('click', () => options.onDeploy(profile, 'simulator')); actions.appendChild(simulator);
                const device = createButton({ label: 'Device', className: 'btn-secondary', size: 'sm', title: 'Build, install, and launch on a connected iOS device' });
                device.addEventListener('click', () => options.onDeploy(profile, 'device')); actions.appendChild(device);
                const testflight = createButton({ label: 'TestFlight', className: 'btn-secondary', size: 'sm', symbol: 'play' });
                testflight.addEventListener('click', () => options.onDeploy(profile, 'testflight')); actions.appendChild(testflight);
            }
            if (profile.platform === 'android' && record?.outputExists) {
                const simulator = createButton({ label: 'Simulator', className: 'btn-secondary', size: 'sm', title: 'Build, install, and launch in an Android emulator' });
                simulator.addEventListener('click', () => options.onDeploy(profile, 'simulator')); actions.appendChild(simulator);
                const device = createButton({ label: 'Device', className: 'btn-secondary', size: 'sm', title: 'Build, install, and launch on a connected Android device' });
                device.addEventListener('click', () => options.onDeploy(profile, 'device')); actions.appendChild(device);
                if (!profile.debug) {
                    const play = createButton({ label: 'Google Play', className: 'btn-secondary', size: 'sm', symbol: 'play' });
                    play.addEventListener('click', () => options.onDeploy(profile, 'google-play')); actions.appendChild(play);
                }
            }
            if (profile.platform === 'fb-instant-games' && record?.outputExists) {
                const deploy = createButton({ label: 'Deploy', className: 'btn-secondary', size: 'sm', title: 'Upload this build to Facebook Instant Games Web Hosting' });
                deploy.addEventListener('click', () => options.onDeploy(profile, 'facebook-hosting')); actions.appendChild(deploy);
            }
            const buildButton = createButton({ label: hasPreviousBuild ? 'Rebuild' : 'Build', className: 'btn-primary', size: 'sm' });
            buildButton.addEventListener('click', () => options.onBuild(profile, hasPreviousBuild)); actions.appendChild(buildButton);
        }
        const panel = createPanel({
            title: profile.label,
            description: environmentDescription(profile),
            content: body,
            actions,
            tagName: 'li',
            className: 'ui-content-panel build-environment-card',
        });
        options.list.appendChild(panel.element);
    }
}

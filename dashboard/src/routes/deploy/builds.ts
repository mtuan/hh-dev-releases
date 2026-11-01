import type { ReleaseBuild, ReleasePlatform, UpdateChannel } from '../../../electron/types';
import { createDataTable } from '../../shared/ui/data-table';
import { createDynamicForm } from '../../shared/ui/dynamic-form';
import { createButton } from '../../shared/ui/fields';
import { createContentPanel } from '../../shared/ui/content-panel';
import { runWithLoadingState } from '../../shared/ui/loading-state';
import { showConfirm, showModal, showTechnicalError } from '../../shared/ui/modal';
import { renderPageHeader } from '../../shared/ui/page-header';
import { createHelpSidebar } from '../../shared/ui/help-sidebar';
import { createSetupGuide } from '../../shared/ui/setup-guide';

function createBuildGuide(repository: string, platforms: string[]): import('../../shared/ui/help-sidebar').HelpSidebarContent {
    const content = createSetupGuide([
        { title: 'Create a platform build', description: 'Choose New build, select one configured platform, and select the version change.', values: [
            { label: 'Patch', value: 'Compatible bug fix' },
            { label: 'Minor', value: 'Backward-compatible feature' },
            { label: 'Major', value: 'Breaking change' },
            { label: 'Production candidate', value: 'stable' },
            { label: 'Developer testing', value: 'beta' },
        ], note: 'Creating or rebuilding one platform does not rebuild or replace the other platform’s artifacts.' },
        { title: 'Available platforms', description: 'Each build request targets exactly one platform. Complete another platform’s signing configuration to make it selectable.', values: [
            { label: 'Configured choices', value: platforms.join(' and ') },
        ], note: 'macOS and Windows builds for the same version upload into one GitHub Release independently.' },
        { title: 'Track GitHub Actions', link: { label: 'Release workflow runs', url: `https://github.com/${repository}/actions` }, values: [
            { label: 'Release tag', value: 'dashboard-v<version>' },
        ], note: 'Open Jobs first to confirm the release-control push succeeded, then follow signing and packaging in GitHub Actions.' },
        { title: 'Refresh completed builds', description: 'Return here and choose Refresh after the GitHub workflow succeeds.' },
        { title: 'Promote a tested version', description: 'Choose Roll to production on the exact version you tested.', values: [
            { label: 'Production pointer', value: 'channels/production.json' },
            { label: 'Update folder', value: 'cocos-build-dashboard' },
        ] },
        { title: 'Roll back if needed', description: 'Choose Roll to production on an older immutable version. No rebuild is required.' },
        { title: 'Install on developer machines', link: { label: 'GitHub Releases guide', url: 'https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases' }, note: 'Share the DMG or EXE from the selected release. Later updates come from the public update URL.' },
    ]);
    return { key: 'build-release-guide', title: 'Build and release', description: 'Complete each step in order.', content };
}

function badge(build: ReleaseBuild): HTMLElement { const value = document.createElement('span'); value.className = `badge ${build.status === 'failed' ? 'badge-failed' : build.status === 'building' ? 'badge-running' : build.production ? 'badge-success' : build.channel === 'beta' ? 'badge-warning' : 'badge-neutral'}`; value.textContent = build.status === 'failed' ? 'Failed' : build.status === 'building' ? 'Building' : build.production ? 'Production' : build.channel === 'beta' ? 'Beta' : 'Ready'; return value; }
function versionParts(value: string): number[] { return value.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0); }
function compareVersions(left: string, right: string): number { const a = versionParts(left); const b = versionParts(right); for (let index = 0; index < Math.max(a.length, b.length); index += 1) { const difference = (a[index] ?? 0) - (b[index] ?? 0); if (difference) return difference; } return 0; }
type VersionIncrement = 'patch' | 'minor' | 'major';
interface ParsedVersion { major: number; minor: number; patch: number; beta?: number; }
function parseVersion(value: string): ParsedVersion | undefined { const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/); return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), ...(match[4] ? { beta: Number(match[4]) } : {}) } : undefined; }
function core(version: ParsedVersion): string { return `${version.major}.${version.minor}.${version.patch}`; }
function nextVersion(builds: ReleaseBuild[], currentVersion: string, increment: VersionIncrement, channel: UpdateChannel, platform: ReleasePlatform): string {
    const counterpart = builds.filter((build) => build.channel === channel && build.platform !== platform && !builds.some((candidate) => candidate.platform === platform && candidate.version === build.version)).sort((left, right) => compareVersions(right.version, left.version))[0];
    if (counterpart) return counterpart.version;
    const stable = [currentVersion, ...builds.filter((build) => build.channel === 'stable').map((build) => build.version)].map(parseVersion).filter((value): value is ParsedVersion => Boolean(value)).sort((left, right) => compareVersions(core(right), core(left)))[0] ?? { major: 0, minor: 0, patch: 0 };
    const target: ParsedVersion = increment === 'major' ? { major: stable.major + 1, minor: 0, patch: 0 } : increment === 'minor' ? { major: stable.major, minor: stable.minor + 1, patch: 0 } : { major: stable.major, minor: stable.minor, patch: stable.patch + 1 };
    if (channel === 'stable') return core(target);
    const beta = builds.map((build) => parseVersion(build.version)).filter((value): value is ParsedVersion => Boolean(value) && core(value!) === core(target) && value!.beta !== undefined).reduce((maximum, value) => Math.max(maximum, value.beta ?? 0), 0) + 1;
    return `${core(target)}-beta.${beta}`;
}

export async function renderDeployBuilds(options: { header: HTMLElement; content: HTMLElement; onOpenConfigurations(): void }): Promise<void> {
    const config = await window.buildApi.getReleaseDeploymentConfig();
    const complete = (...values: string[]): boolean => values.every((value) => Boolean(value.trim()));
    const platforms: Array<{ value: ReleasePlatform; label: string }> = [
        ...(complete(config.macCertificate, config.macCertificatePassword, config.appleId, config.appleAppPassword, config.appleTeamId) ? [{ value: 'macos' as const, label: 'macOS' }] : []),
        ...(complete(config.windowsCertificate, config.windowsCertificatePassword, config.windowsPublisherName) ? [{ value: 'windows' as const, label: 'Windows' }] : []),
    ];
    const required: Array<[keyof typeof config, string]> = [['releaseRepositoryPath', 'Local release-control repository'], ['repository', 'GitHub repository'], ['updateBaseUrl', 'GitHub Releases hosting']];
    const missing = required.filter(([key]) => !String(config[key] ?? '').trim()).map(([, label]) => label);
    if (!platforms.length) missing.push('At least one complete platform configuration: macOS or Windows');
    if (missing.length) {
        renderPageHeader(options.header, { title: 'Dashboard builds', description: 'Complete release configuration before creating or promoting dashboard builds.', actions: [{ id: 'deploy-configure-builds', label: 'Configure deployment', className: 'btn-primary', symbol: 'action' }] });
        options.header.querySelector<HTMLButtonElement>('#deploy-configure-builds')?.addEventListener('click', options.onOpenConfigurations);
        const list = document.createElement('ul'); list.className = 'deploy-requirement-list'; for (const label of missing) { const item = document.createElement('li'); item.textContent = label; list.appendChild(item); }
        options.content.replaceChildren(createContentPanel({ title: 'Configuration required', status: `${missing.length} missing`, statusClass: 'badge-warning', description: 'Repository settings and at least one complete platform signing configuration are required. Unconfigured platforms do not block builds.', content: list, collapsible: false }));
        return;
    }
    const platformLabels = platforms.map((platform) => platform.label);
    renderPageHeader(options.header, { title: 'Dashboard builds', description: `Create independent ${platformLabels.join(' and ')} builds, choose which version is in production, or roll back to a known working version.`, actions: [{ id: 'deploy-build-guide', label: 'Guide', className: 'btn-secondary', symbol: 'help' }, { id: 'deploy-refresh-builds', label: 'Refresh', className: 'btn-secondary', symbol: 'refresh' }, { id: 'deploy-create-build', label: 'New build', className: 'btn-primary', symbol: 'add' }] });
    let builds: ReleaseBuild[] = [];
    const table = createDataTable<ReleaseBuild>({ keyOf: (build) => build.id, items: [], emptyMessage: 'No dashboard builds yet.', pageSize: 10, pageSizeOptions: [10, 25, 50], preferenceKey: 'deploy-builds', columns: [
        { id: 'version', label: 'Version', width: '150px', render: (build) => `v${build.version}` }, { id: 'platform', label: 'Platform', width: '120px', render: (build) => build.platform === 'macos' ? 'macOS' : 'Windows' }, { id: 'name', label: 'Build', render: (build) => build.name },
        { id: 'created', label: 'Created', width: '210px', render: (build) => new Date(build.publishedAt ?? build.createdAt).toLocaleString() },
        { id: 'status', label: 'Status', width: '120px', render: badge }, { id: 'action', label: '', width: '190px', align: 'end', render: (build) => productionAction(build, builds, () => void load()) },
    ] });
    const layout = document.createElement('div'); layout.className = 'deploy-config-layout';
    const stack = document.createElement('div'); stack.className = 'deploy-panel-stack'; stack.appendChild(table.element);
    const helpSidebar = createHelpSidebar(); layout.append(stack, helpSidebar.element); options.content.replaceChildren(layout);
    const load = async (): Promise<void> => runWithLoadingState(options.content, async () => { builds = await window.buildApi.listReleaseBuilds(); table.setItems(builds); }, { label: 'Loading dashboard builds' });
    options.header.querySelector<HTMLButtonElement>('#deploy-refresh-builds')?.addEventListener('click', () => void load().catch(showError));
    options.header.querySelector<HTMLButtonElement>('#deploy-build-guide')?.addEventListener('click', () => helpSidebar.toggle(createBuildGuide(config.repository, platformLabels)));
    options.header.querySelector<HTMLButtonElement>('#deploy-create-build')?.addEventListener('click', () => void window.buildApi.getReleaseDeploymentInfo().then((info) => openCreateBuild(builds, info.version, platforms, () => void load().catch(showError))).catch(showError));
    await load().catch(showError);
}

function productionAction(build: ReleaseBuild, builds: ReleaseBuild[], refresh: () => void): HTMLElement {
    if (build.status === 'failed') {
        const button = createButton({ label: 'Open workflow', className: 'btn-secondary', size: 'sm', symbol: 'action', disabled: !build.workflowUrl });
        button.addEventListener('click', () => { if (build.workflowUrl) void window.buildApi.openExternalUrl(build.workflowUrl); });
        return button;
    }
    const unavailable = build.status === 'building';
    const button = createButton({ label: unavailable ? 'Building' : build.production ? 'Production' : 'Roll to production', className: build.production || unavailable ? 'btn-secondary' : 'btn-primary', size: 'sm', symbol: build.production ? 'check' : unavailable ? 'action' : 'play', disabled: build.production || unavailable });
    button.addEventListener('click', async () => {
        const config = await window.buildApi.getReleaseDeploymentConfig(); const production = builds.find((candidate) => candidate.production); const rollback = Boolean(production && compareVersions(build.version, production.version) < 0);
        const accepted = await showConfirm({ title: rollback ? `Roll back to v${build.version}?` : `Roll v${build.version} to production?`, message: rollback ? `This replaces v${production?.version} in the automatic-update feed with v${build.version}.` : `This publishes v${build.version} to ${config.updateBaseUrl || 'the configured production update feed'}.`, confirmLabel: rollback ? 'Roll back' : 'Roll to production', danger: rollback });
        if (!accepted) return; button.disabled = true;
        try { await window.buildApi.promoteReleaseBuild(build.tag); refresh(); } catch (error) { showError(error); button.disabled = false; }
    }); return button;
}

function openCreateBuild(builds: ReleaseBuild[], currentVersion: string, platforms: Array<{ value: ReleasePlatform; label: string }>, onCreated: () => void): void {
    type BuildForm = { increment: VersionIncrement; channel: UpdateChannel; version: string; platform: ReleasePlatform };
    const calculate = (values: Pick<BuildForm, 'increment' | 'channel' | 'platform'>): string => nextVersion(builds, currentVersion, values.increment, values.channel, values.platform);
    const initialPlatform = platforms[0].value;
    const form = createDynamicForm<BuildForm>({ initialValues: { increment: 'patch', channel: 'stable', platform: initialPlatform, version: nextVersion(builds, currentVersion, 'patch', 'stable', initialPlatform) }, fields: [
        { key: 'platform', type: 'segmented', label: 'Platform', options: platforms, onChange: (_value, context) => context.setValue('version', calculate(context.values)) },
        { key: 'increment', type: 'segmented', label: 'Version change', options: [{ value: 'patch', label: 'Patch' }, { value: 'minor', label: 'Minor' }, { value: 'major', label: 'Major' }], onChange: (_value, context) => context.setValue('version', calculate(context.values)) },
        { key: 'channel', type: 'segmented', label: 'Channel', options: [{ value: 'stable', label: 'Stable' }, { value: 'beta', label: 'Beta' }], onChange: (_value, context) => context.setValue('version', calculate(context.values)) },
        { key: 'version', type: 'text', label: 'Next version', readOnly: true, description: 'If the other platform already has an unmatched version, this platform uses that same version. Otherwise the next version is calculated normally.' },
    ], layout: [['platform'], ['increment'], ['channel'], ['version']] });
    showModal({ title: 'Create dashboard build', content: form.element, actions: [{ label: 'Cancel', run: (close) => close() }, { label: 'Create build', className: 'btn-primary', run: (close) => { if (!form.validate()) return; const { version, channel, platform } = form.values; close(); void window.buildApi.createReleaseBuild({ version, channel, platform }).then(onCreated).catch(showError); } }] });
}

function showError(error: unknown): void { showTechnicalError('Release operation failed', 'The dashboard could not complete the release operation.', error instanceof Error ? error.stack ?? error.message : String(error)); }

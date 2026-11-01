type BuildJobStatus = import('../electron/types').BuildJobStatus;
type BuildProfile = import('../electron/types').BuildProfile;
type ProjectConfig = import('../electron/types').ProjectConfig;
type ProjectsFile = import('../electron/types').ProjectsFile;
type DetectedProject = import('../electron/types').DetectedProject;
type BuildRecord = import('../electron/types').BuildRecord;
type ManagedJob = import('../electron/types').ManagedJob;
type AppUpdateState = import('../electron/types').AppUpdateState;
type ReleaseDeploymentInfo = import('../electron/types').ReleaseDeploymentInfo;
import { renderProjectsRoute } from './routes/projects';
import { renderFakePlayersRoute } from './routes/fake-players';
import { activateRootNavigation } from './routes';
import { renderProjectInfoRoute } from './routes/projects/[projectId]';
import { renderProjectSetupRoute } from './routes/projects/[projectId]/configs';
import { platformHasEditableConfigs, renderPlatformConfigsRoute } from './routes/projects/[projectId]/[platform]/configs';
import { projectPlatforms, renderPlatformsRoute } from './routes/projects/[projectId]/platforms';
import { renderBuildRoute } from './routes/projects/[projectId]/[platform]/build';
import { configureDialogs, showCodebaseImportDialog } from './shared/ui/dialogs';
import { loadLastRoutePath, parseRoute, saveLastRoute } from './shared/navigation';
import { renderPageHeader } from './shared/ui/page-header';
import { showAlert, showChoiceModal, showConfirm, showModal, showTechnicalError } from './shared/ui/modal';
import { platformName } from './shared/platforms';
import { renderLoadingScreenRoute } from './routes/projects/[projectId]/loading';
import { renderUiShowcaseRoute } from './routes/ui';
import { renderJobsRoute } from './routes/jobs';
import { renderJobDetailRoute } from './routes/jobs/[jobId]';
import { hideFacebookConsoleBrowser, renderFacebookConsoleRoute } from './routes/projects/[projectId]/[platform]/console';
import { initializeThemeToggle } from './shared/theme';
import { hydrateIcons } from './shared/ui/icon';
import { hydrateIconButton } from './shared/ui/icon-button';
import { initializeDefaultFieldSize } from './shared/ui/fields';
import { createJobNotifications } from './shared/ui/job-notifications';
import { createCollapsibleSidebar } from './shared/ui/sidebar';
import { createRouteAddress, normalizeRoutePath } from './shared/ui/route-address';
import { renderNotFoundRoute } from './routes/not-found';
import { createActionListItem } from './shared/ui/action-list';
import { createButton } from './shared/ui/fields';
import { renderSettingsRoute, type SettingsRouteControl } from './routes/settings';
import { renderDeployRoute } from './routes/deploy';
import { bindCopyAction } from './shared/ui/copy-action';

initializeDefaultFieldSize();

renderPageHeader(document.getElementById('projects-page-header')!, {
    title: 'Projects', description: 'Register and manage the Cocos projects available on this machine.',
    actions: [{ id: 'add-project-btn', label: 'Add project folder', className: 'btn-primary' }],
});
renderPageHeader(document.getElementById('project-setup-page-header')!, {
    title: 'Configurations', description: 'Manage project-wide settings and components required by HayHay Tools.',
});
renderPageHeader(document.getElementById('platforms-page-header')!, {
    title: 'Platforms', description: 'Choose which target platforms this project supports.',
    actions: [{ id: 'add-platform-page-btn', label: 'Add platform', className: 'btn-primary' }],
});
renderPageHeader(document.getElementById('build-page-header')!, {
    title: 'Build', titleId: 'active-project-name',
    description: 'Select an environment to build the current platform.', descriptionId: 'build-page-description',
    actions: [
        { id: 'open-local-preview-btn', label: 'Local preview', className: 'btn-secondary' },
        { id: 'open-facebook-hosting-btn', label: 'Open web hosting', className: 'btn-secondary' },
    ],
});

declare global {
    interface Window {
        buildApi: import('../electron/types').BuildApi;
    }
}

interface JobViewState {
    projectId: string;
    profileId: string;
    status: BuildJobStatus;
    exitCode?: number;
}

type AppPage = 'projects' | 'fake-players' | 'jobs' | 'job-detail' | 'ui' | 'settings' | 'deploy' | 'project' | 'configs' | 'loading' | 'platforms' | 'platform-configs' | 'platform-loading' | 'facebook-console' | 'facebook-console-browser' | 'facebook-console-assets' | 'build' | 'not-found';

function slugify(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

let projectsFile: ProjectsFile = { projects: [] };
let selectedProjectId: string | null = null;
let selectedPlatform: string | null = null;
let selectedFakePlayersView: 'avatars' | 'player-infos' = 'avatars';
let selectedDeployView: 'configurations' | 'builds' = 'configurations';
let detectedProject: DetectedProject | null = null;
const jobs = new Map<string, JobViewState>();
let buildRecords: BuildRecord[] = [];
let currentPage: AppPage | null = null;
let selectedJobId: string | null = null;
let notFoundRoute = '/';
let setupRenderRequest = 0;
let appUpdateState: AppUpdateState;
let releaseDeploymentInfo: ReleaseDeploymentInfo;
let settingsRouteControl: SettingsRouteControl | undefined;

const projectListEl = document.getElementById('project-list') as HTMLElement;
const activeProjectNameEl = document.getElementById('active-project-name') as HTMLHeadingElement;
const profileListEl = document.getElementById('profile-list') as HTMLUListElement;
const jobListEl = document.getElementById('job-list') as HTMLUListElement;
const logOutputEl = document.getElementById('log-output') as HTMLPreElement;
const addProjectBtn = document.getElementById('add-project-btn') as HTMLButtonElement;
const bridgeWarningEl = document.getElementById('bridge-warning') as HTMLDivElement;
const bridgeWarningTextEl = document.getElementById('bridge-warning-text') as HTMLSpanElement;
const bridgeFixPlaceholder = document.getElementById('bridge-fix-btn') as HTMLButtonElement;
const bridgeFixBtn = createButton({ id: 'bridge-fix-btn', label: 'Fix bridge', className: 'btn-secondary', size: 'sm', symbol: 'refresh' }); bridgeFixPlaceholder.replaceWith(bridgeFixBtn);
const currentRouteInput = document.getElementById('current-route') as HTMLInputElement;
const copyRouteBtn = document.getElementById('copy-route-btn') as HTMLButtonElement;
const refreshRouteBtn = document.getElementById('refresh-route-btn') as HTMLButtonElement;
const jobNotificationsBtn = document.getElementById('job-notifications-btn') as HTMLButtonElement;
const jobNotificationsCount = document.getElementById('job-notifications-count') as HTMLElement;
const themeToggleBtn = document.getElementById('theme-toggle-btn') as HTMLButtonElement;
const projectsPageEl = document.getElementById('projects-page') as HTMLElement;
const fakePlayersPageEl = document.getElementById('fake-players-page') as HTMLElement;
const fakePlayersPageHeaderEl = document.getElementById('fake-players-page-header') as HTMLElement;
const fakePlayersPageContentEl = document.getElementById('fake-players-page-content') as HTMLElement;
const uiPageEl = document.getElementById('ui-page') as HTMLElement;
const uiPageHeaderEl = document.getElementById('ui-page-header') as HTMLElement;
const uiShowcaseContentEl = document.getElementById('ui-showcase-content') as HTMLElement;
const jobsPageEl = document.getElementById('jobs-page') as HTMLElement;
const jobsPageHeaderEl = document.getElementById('jobs-page-header') as HTMLElement;
const jobsPageContentEl = document.getElementById('jobs-page-content') as HTMLElement;
const jobDetailPageEl = document.getElementById('job-detail-page') as HTMLElement;
const jobDetailPageHeaderEl = document.getElementById('job-detail-page-header') as HTMLElement;
const jobDetailPageContentEl = document.getElementById('job-detail-page-content') as HTMLElement;
const settingsPageEl = document.getElementById('settings-page') as HTMLElement;
const settingsPageHeaderEl = document.getElementById('settings-page-header') as HTMLElement;
const settingsPageContentEl = document.getElementById('settings-page-content') as HTMLElement;
const deployNavItem = document.getElementById('deploy-nav-item') as HTMLElement;
const deployPageEl = document.getElementById('deploy-page') as HTMLElement;
const deployPageHeaderEl = document.getElementById('deploy-page-header') as HTMLElement;
const deployPageContentEl = document.getElementById('deploy-page-content') as HTMLElement;
const notFoundPageEl = document.getElementById('not-found-page') as HTMLElement;
const notFoundPageHeaderEl = document.getElementById('not-found-page-header') as HTMLElement;
const notFoundPageContentEl = document.getElementById('not-found-page-content') as HTMLElement;
const buildPageEl = document.getElementById('build-panel') as HTMLElement;
const platformsPageEl = document.getElementById('platforms-page') as HTMLElement;
const projectSettingsLayoutEl = document.getElementById('project-settings-layout') as HTMLElement;
const settingsSidebarEl = projectSettingsLayoutEl.querySelector<HTMLElement>('.settings-sidebar')!;
const projectInfoPageEl = document.getElementById('project-info-page') as HTMLElement;
const projectInfoCardEl = document.getElementById('project-info-card') as HTMLElement;
const projectSetupPageEl = document.getElementById('project-setup-page') as HTMLElement;
const projectSetupListEl = document.getElementById('project-setup-list') as HTMLElement;
const loadingScreenPageEl = document.getElementById('loading-screen-page') as HTMLElement;
const loadingScreenHeaderEl = document.getElementById('loading-screen-page-header') as HTMLElement;
const loadingScreenContentEl = document.getElementById('loading-screen-content') as HTMLElement;
const platformConfigsPageEl = document.getElementById('platform-configs-page') as HTMLElement;
const platformLoadingPageEl = document.getElementById('platform-loading-page') as HTMLElement;
const platformLoadingHeaderEl = document.getElementById('platform-loading-page-header') as HTMLElement;
const platformLoadingContentEl = document.getElementById('platform-loading-content') as HTMLElement;
const facebookConsolePageEl = document.getElementById('facebook-console-page') as HTMLElement;
const facebookConsoleHeaderEl = document.getElementById('facebook-console-page-header') as HTMLElement;
const facebookConsoleContentEl = document.getElementById('facebook-console-page-content') as HTMLElement;
const facebookConsoleNavItem = document.getElementById('facebook-console-nav') as HTMLElement;
createCollapsibleSidebar({ element: settingsSidebarEl, storageKey: 'cocos-build-dashboard:settings-sidebar-collapsed' });
const platformConfigsListEl = document.getElementById('platform-configs-list') as HTMLUListElement;
const platformConfigsNavItem = document.querySelector<HTMLButtonElement>('.nav-item[data-route="platform-configs"]')!;
const platformManageListEl = document.getElementById('platform-manage-list') as HTMLElement;
const addPlatformPageBtn = document.getElementById('add-platform-page-btn') as HTMLButtonElement;
const buildPageDescriptionEl = document.getElementById('build-page-description') as HTMLElement;
const openFacebookHostingBtn = document.getElementById('open-facebook-hosting-btn') as HTMLButtonElement;
const openLocalPreviewBtn = document.getElementById('open-local-preview-btn') as HTMLButtonElement;
const workspaceShellEl = document.getElementById('workspace-shell') as HTMLElement;
const rootSidebarEl = document.getElementById('root-sidebar') as HTMLElement;
createCollapsibleSidebar({ element: rootSidebarEl, storageKey: 'cocos-build-dashboard:root-sidebar-collapsed' });
createCollapsibleSidebar({ element: document.getElementById('project-panel') as HTMLElement, storageKey: 'cocos-build-dashboard:platform-sidebar-collapsed' });
const appHeaderEyebrowEl = document.getElementById('app-header-eyebrow') as HTMLElement;
const breadcrumbsEl = document.getElementById('app-breadcrumbs') as HTMLElement;
const globalBackBtn = document.getElementById('global-back-btn') as HTMLButtonElement;
const toolingWarningEl = document.getElementById('tooling-warning') as HTMLDivElement;
const toolingWarningTextEl = document.getElementById('tooling-warning-text') as HTMLSpanElement;
const toolingFixPlaceholder = document.getElementById('tooling-fix-btn') as HTMLButtonElement;
const toolingFixBtn = createButton({ id: 'tooling-fix-btn', label: 'Sync tools', className: 'btn-secondary', size: 'sm', symbol: 'refresh' }); toolingFixPlaceholder.replaceWith(toolingFixBtn);
let bridgeStatusRequest = 0;

function getSelectedProject(): ProjectConfig | undefined {
    return projectsFile.projects.find((p) => p.id === selectedProjectId);
}

async function refreshBridgeStatus(): Promise<void> {
    const requestId = ++bridgeStatusRequest;
    const project = getSelectedProject();
    if (!project) {
        bridgeWarningEl.hidden = true;
        return;
    }
    try {
        const status = await window.buildApi.getBridgeStatus(project.projectPath);
        if (requestId !== bridgeStatusRequest || project.id !== selectedProjectId) {
            return;
        }
        bridgeWarningEl.hidden = !status.supported || status.running || (!status.editorOpen && status.installed);
        if (!status.supported) {
            return;
        } else if (!status.installed) {
            bridgeWarningTextEl.textContent = 'Editor build bridge is not installed for this project. Open-Editor builds are unavailable.';
            bridgeFixBtn.textContent = 'Install bridge';
        } else if (status.editorOpen && !status.running) {
            bridgeWarningTextEl.textContent = 'Bridge is installed but the open Cocos Editor has not loaded it. Update it, then refresh extensions or restart Cocos.';
            bridgeFixBtn.textContent = 'Update bridge';
        }
    } catch (error) {
        bridgeWarningEl.hidden = false;
        bridgeWarningTextEl.textContent = `Could not check Editor bridge: ${error instanceof Error ? error.message : String(error)}`;
        bridgeFixBtn.textContent = 'Retry';
    }
}

async function refreshToolingStatus(): Promise<void> {
    const project = getSelectedProject();
    if (!project) {
        toolingWarningEl.hidden = true;
        return;
    }
    try {
        const status = await window.buildApi.getToolingStatus(project.projectPath);
        toolingWarningEl.hidden = !status.needsSync;
        toolingWarningTextEl.textContent = status.conflicts.length
            ? `Managed tool files were modified: ${status.conflicts.join(', ')}`
            : `Shared tools need synchronization for Cocos Creator ${status.creatorVersion} (${status.creatorFamily}).`;
        toolingFixBtn.hidden = status.conflicts.length > 0;
        toolingFixBtn.disabled = false;
        toolingFixBtn.textContent = status.managedInstallationExists ? 'Update tools' : 'Install tools';
    } catch (error) {
        toolingWarningEl.hidden = false;
        toolingWarningTextEl.textContent = `Could not inspect shared tools: ${error instanceof Error ? error.message : String(error)}`;
        toolingFixBtn.hidden = false;
        toolingFixBtn.disabled = false;
    }
}

function appendLog(jobId: string, line: string): void {
    const row = document.createElement('div');
    if (/\b(error|failed|exception)\b/i.test(line)) {
        row.className = 'log-line-error';
    } else if (/\bwarn(ing)?\b/i.test(line)) {
        row.className = 'log-line-warn';
    }
    const tag = document.createElement('span');
    tag.className = 'log-job';
    tag.textContent = `[${jobId}] `;
    row.appendChild(tag);
    row.appendChild(document.createTextNode(line));
    logOutputEl.appendChild(row);
    logOutputEl.scrollTop = logOutputEl.scrollHeight;
}

function createEmptyState(text: string): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = text;
    return li;
}

function renderProjectList(): void {
    renderProjectsRoute({
        list: projectListEl,
        projects: projectsFile.projects,
        selectedProjectId,
        onOpen: (project) => {
            selectedProjectId = project.id;
            renderProjectList();
            renderProfileList();
            renderProjectInfo();
            showPage('project');
            void refreshBridgeStatus();
            void refreshToolingStatus();
        },
        onRemove: async (project) => {
            if (!await showConfirm({ title: 'Remove project?', message: `Remove "${project.name}" from the dashboard? The project files will not be deleted.`, confirmLabel: 'Remove', danger: true })) return;
            projectsFile.projects = projectsFile.projects.filter((candidate) => candidate.id !== project.id);
            if (selectedProjectId === project.id) selectedProjectId = projectsFile.projects[0]?.id ?? null;
            await window.buildApi.saveProjects(projectsFile);
            renderProjectList(); renderProfileList();
        },
    });
}

function availablePlatforms(project: ProjectConfig | undefined): string[] {
    return project ? projectPlatforms(project) : [];
}

function ensurePlatform(project: ProjectConfig | undefined): void {
    const platforms = availablePlatforms(project);
    if (!selectedPlatform || !platforms.includes(selectedPlatform)) selectedPlatform = platforms[0] ?? null;
}

function projectBaseRoute(project: ProjectConfig): string {
    return `/projects/${encodeURIComponent(project.id)}`;
}

function renderProjectInfo(): void {
    const project = getSelectedProject();
    if (project) renderProjectInfoRoute({
        header: document.getElementById('project-info-page-header')!,
        container: projectInfoCardEl,
        project,
        onSaved: (updated, projectId) => {
            projectsFile = updated;
            selectedProjectId = projectId;
            renderProjectList();
            renderProjectInfo();
            showPage('project');
        },
    });
}

function renderProjectSetup(): void {
    const project = getSelectedProject();
    if (!project) return;
    const requestId = ++setupRenderRequest;
    void renderProjectSetupRoute({
        list: projectSetupListEl,
        project,
        onInstallCodebase: () => void showCodebaseImportDialog(project, renderProjectSetup),
        onInstallBridge: async () => { await window.buildApi.installBridge(project.projectPath); },
        onSyncTooling: async () => { await window.buildApi.syncTooling(project.projectPath); },
        onSyncPreviewSimulator: async () => { await window.buildApi.syncPreviewSimulator(project.projectPath); },
        onResetPreviewSimulator: async () => { await window.buildApi.resetPreviewSimulator(project.projectPath); },
        isCurrent: () => requestId === setupRenderRequest && selectedProjectId === project.id && currentPage === 'configs',
    }).catch((error) => {
        if (requestId !== setupRenderRequest || selectedProjectId !== project.id || currentPage !== 'configs') return;
        projectSetupListEl.innerHTML = '';
        projectSetupListEl.appendChild(createEmptyState(`Could not inspect project setup: ${error instanceof Error ? error.message : String(error)}`));
    });
}

function renderPlatformConfigs(): void {
    const project = getSelectedProject();
    if (!project || !selectedPlatform) return;
    void renderPlatformConfigsRoute({
        header: document.getElementById('platform-configs-page-header')!,
        list: platformConfigsListEl,
        project,
        platform: selectedPlatform,
        onSave: async () => { await window.buildApi.saveProjects(projectsFile); },
        onInstallTemplates: async (missing) => {
            if (!selectedPlatform) return;
            try {
                await window.buildApi.importBuildTemplate(project.projectPath, selectedPlatform, missing);
                renderPlatformConfigs();
            } catch (error) {
                showAlert(error instanceof Error ? error.message : String(error), 'Could not install build templates', 'warning');
            }
        },
    });
}

function renderBreadcrumbs(page: AppPage, project: ProjectConfig | undefined): void {
    breadcrumbsEl.innerHTML = '';
    const add = (label: string, href?: string, action?: () => void): void => {
        if (breadcrumbsEl.children.length) {
            const separator = document.createElement('span'); separator.className = 'breadcrumb-separator'; separator.textContent = '›'; breadcrumbsEl.appendChild(separator);
        }
        if (action && href) {
            const link = document.createElement('a'); link.className = 'breadcrumb-link'; link.textContent = label; link.href = href;
            link.addEventListener('click', (event) => { event.preventDefault(); action(); }); breadcrumbsEl.appendChild(link);
        } else {
            const current = document.createElement('span'); current.className = 'breadcrumb-current'; current.textContent = label; breadcrumbsEl.appendChild(current);
        }
    };
    add('HayHay Tools', '/', () => showPage('projects'));
    if (page === 'not-found') { add('Page not found'); return; }
    if (page === 'ui') { add('UI components'); return; }
    if (page === 'settings') { add('Settings'); return; }
    if (page === 'deploy') { add('Deploy'); add(selectedDeployView === 'configurations' ? 'Configurations' : 'Builds'); return; }
    if (page === 'fake-players') { add('Fake players'); add(selectedFakePlayersView === 'avatars' ? 'Avatars' : 'Player information'); return; }
    if (page === 'jobs' || page === 'job-detail') { add('Jobs', page === 'jobs' ? undefined : '/jobs', page === 'jobs' ? undefined : () => showPage('jobs')); if (page === 'job-detail') add('Details'); return; }
    add('Projects', page === 'projects' ? undefined : '/projects', page === 'projects' ? undefined : () => showPage('projects'));
    if (project && page !== 'projects') {
        add(project.name, projectBaseRoute(project), () => { renderProjectInfo(); showPage('project'); });
    }
    if (page === 'project') add('Info');
    if (page === 'configs') add('Configurations');
    if (page === 'loading') add('Loading Designer');
    if (page === 'platforms') add('Platforms');
    if ((page === 'platform-configs' || page === 'platform-loading' || page === 'facebook-console' || page === 'facebook-console-browser' || page === 'facebook-console-assets' || page === 'build') && selectedPlatform) {
        add(platformName(selectedPlatform), `${projectBaseRoute(project!)}/${encodeURIComponent(selectedPlatform)}`, () => showPage('build'));
    }
    if (page === 'platform-configs') add('Configurations');
    if (page === 'platform-loading') add('Loading Designer');
    if (page === 'facebook-console' || page === 'facebook-console-browser' || page === 'facebook-console-assets') { add('Meta console', page === 'facebook-console' ? undefined : `${projectBaseRoute(project!)}/${encodeURIComponent(selectedPlatform!)}/console`, page === 'facebook-console' ? undefined : () => showPage('facebook-console')); if (page === 'facebook-console-browser') add('Browser'); if (page === 'facebook-console-assets') add('Assets'); }
    if (page === 'build') add('Build');
}

function routeForPage(page: AppPage, project: ProjectConfig | undefined): string {
    if (page === 'not-found') return notFoundRoute;
    if (page === 'projects') return '/projects';
    if (page === 'fake-players') return `/fake-players/${selectedFakePlayersView}`;
    if (page === 'jobs') return '/jobs';
    if (page === 'job-detail') return `/jobs/${encodeURIComponent(selectedJobId ?? '')}`;
    if (page === 'ui') return '/ui';
    if (page === 'settings') return '/settings';
    if (page === 'deploy') return `/deploy/${selectedDeployView}`;
    if (!project) return '/projects';
    if (page === 'project') return projectBaseRoute(project);
    if (page === 'configs') return `${projectBaseRoute(project)}/configs`;
    if (page === 'loading') return `${projectBaseRoute(project)}/loading`;
    if (page === 'platforms') return `${projectBaseRoute(project)}/platforms`;
    const platformRoute = `${projectBaseRoute(project)}/${encodeURIComponent(selectedPlatform ?? '')}`;
    if (page === 'platform-configs') return `${platformRoute}/configs`;
    if (page === 'platform-loading') return `${platformRoute}/loading`;
    if (page === 'facebook-console') return `${platformRoute}/console`;
    if (page === 'facebook-console-browser') return `${platformRoute}/console/browser`;
    if (page === 'facebook-console-assets') return `${platformRoute}/console/assets`;
    return `${platformRoute}/build`;
}

function navigateToRoute(value: string): void {
    const route = normalizeRoutePath(value);
    const parsed = parseRoute(route);
    if (!parsed) {
        notFoundRoute = route;
        showPage('not-found');
        return;
    }
    if (parsed.page === 'projects' || parsed.page === 'jobs' || parsed.page === 'ui' || parsed.page === 'settings' || parsed.page === 'fake-players' || parsed.page === 'deploy') {
        if (parsed.page === 'deploy' && !releaseDeploymentInfo.development) { notFoundRoute = route; showPage('not-found'); return; }
        if (parsed.page === 'fake-players') selectedFakePlayersView = parsed.fakePlayersView ?? 'avatars';
        if (parsed.page === 'deploy') selectedDeployView = parsed.deployView ?? 'configurations';
        showPage(parsed.page);
        return;
    }
    if (parsed.page === 'job-detail') {
        selectedJobId = parsed.jobId ?? null;
        if (!selectedJobId) { notFoundRoute = route; showPage('not-found'); return; }
        showPage('job-detail');
        return;
    }
    const project = projectsFile.projects.find((candidate) => candidate.id === parsed.projectId);
    if (!project) { notFoundRoute = route; showPage('not-found'); return; }
    selectedProjectId = project.id;
    if (parsed.page === 'project' || parsed.page === 'configs' || parsed.page === 'loading' || parsed.page === 'platforms') {
        showPage(parsed.page);
        return;
    }
    if (!parsed.platform || !projectPlatforms(project).includes(parsed.platform)) {
        notFoundRoute = route;
        showPage('not-found');
        return;
    }
    selectedPlatform = parsed.platform;
    showPage(parsed.page);
}

const routeAddress = createRouteAddress({ input: currentRouteInput, onNavigate: navigateToRoute });

function showPage(page: AppPage): void {
    const project = getSelectedProject();
    ensurePlatform(project);
    if (page === 'deploy' && !releaseDeploymentInfo.development) { notFoundRoute = '/deploy'; page = 'not-found'; }
    if (page !== 'projects' && page !== 'fake-players' && page !== 'jobs' && page !== 'job-detail' && page !== 'ui' && page !== 'settings' && page !== 'deploy' && page !== 'not-found' && !project) page = 'projects';
    if ((page === 'platform-configs' || page === 'platform-loading' || page === 'facebook-console' || page === 'facebook-console-browser' || page === 'facebook-console-assets' || page === 'build') && !selectedPlatform) page = 'platforms';
    const hasPlatformConfigs = Boolean(selectedPlatform && platformHasEditableConfigs(selectedPlatform));
    platformConfigsNavItem.hidden = !hasPlatformConfigs;
    facebookConsoleNavItem.hidden = selectedPlatform !== 'fb-instant-games';
    if ((page === 'facebook-console' || page === 'facebook-console-browser' || page === 'facebook-console-assets') && selectedPlatform !== 'fb-instant-games') page = 'build';
    if (page === 'platform-configs' && !hasPlatformConfigs) page = 'build';
    if (page !== 'facebook-console-browser') hideFacebookConsoleBrowser();
    currentPage = page;
    globalBackBtn.hidden = page === 'projects' || page === 'fake-players' || page === 'jobs' || page === 'ui' || page === 'settings' || page === 'deploy';
    globalBackBtn.disabled = page === 'projects' || page === 'fake-players' || page === 'jobs' || page === 'ui' || page === 'settings' || page === 'deploy';
    projectsPageEl.hidden = page !== 'projects';
    fakePlayersPageEl.hidden = page !== 'fake-players';
    uiPageEl.hidden = page !== 'ui';
    jobsPageEl.hidden = page !== 'jobs';
    jobDetailPageEl.hidden = page !== 'job-detail';
    settingsPageEl.hidden = page !== 'settings';
    deployPageEl.hidden = page !== 'deploy';
    notFoundPageEl.hidden = page !== 'not-found';
    rootSidebarEl.hidden = page !== 'projects' && page !== 'fake-players' && page !== 'jobs' && page !== 'job-detail' && page !== 'ui' && page !== 'settings' && page !== 'deploy';
    projectSettingsLayoutEl.hidden = page !== 'project' && page !== 'configs' && page !== 'loading' && page !== 'platforms';
    projectInfoPageEl.hidden = page !== 'project';
    projectSetupPageEl.hidden = page !== 'configs';
    loadingScreenPageEl.hidden = page !== 'loading';
    platformsPageEl.hidden = page !== 'platforms';
    platformConfigsPageEl.hidden = page !== 'platform-configs';
    platformLoadingPageEl.hidden = page !== 'platform-loading';
    facebookConsolePageEl.hidden = page !== 'facebook-console' && page !== 'facebook-console-browser' && page !== 'facebook-console-assets';
    buildPageEl.hidden = page !== 'build';
    const activeRoute = routeForPage(page, project);
    routeAddress.setRoute(activeRoute);
    workspaceShellEl.classList.toggle('management-layout', page === 'projects' || page === 'fake-players' || page === 'jobs' || page === 'job-detail' || page === 'ui' || page === 'settings' || page === 'deploy' || page === 'not-found' || page === 'project' || page === 'configs' || page === 'loading' || page === 'platforms');
    appHeaderEyebrowEl.textContent = page === 'projects' || page === 'fake-players' || page === 'jobs' || page === 'job-detail' || page === 'ui' || page === 'settings' || page === 'deploy' || page === 'not-found' ? 'Application' : page === 'project' || page === 'configs' || page === 'loading' || page === 'platforms' ? 'Project settings' : 'Platform workspace';
    renderBreadcrumbs(page, project);
    if (page === 'project') renderProjectInfo();
    if (page === 'platforms') renderPlatformManagement();
    if (page === 'platform-configs') renderPlatformConfigs();
    if (page === 'platform-loading' && project && selectedPlatform) void renderLoadingScreenRoute({ project, platform: selectedPlatform, header: platformLoadingHeaderEl, content: platformLoadingContentEl });
    if ((page === 'facebook-console' || page === 'facebook-console-browser' || page === 'facebook-console-assets') && project) void renderFacebookConsoleRoute({ project, header: facebookConsoleHeaderEl, content: facebookConsoleContentEl, view: page === 'facebook-console-browser' ? 'browser' : page === 'facebook-console-assets' ? 'assets' : 'overview' });
    if (page === 'configs') renderProjectSetup();
    if (page === 'loading' && project) void renderLoadingScreenRoute({ project, header: loadingScreenHeaderEl, content: loadingScreenContentEl });
    if (page === 'build') {
        renderProfileList();
        void refreshBuildRecords();
    }
    if (page === 'projects') activateRootNavigation('projects');
    if (page === 'fake-players') { activateRootNavigation('fake-players'); void renderFakePlayersRoute({ header: fakePlayersPageHeaderEl, content: fakePlayersPageContentEl, view: selectedFakePlayersView }); }
    if (page === 'jobs') { activateRootNavigation('jobs'); void renderManagedJobs(); }
    if (page === 'job-detail') { activateRootNavigation('jobs'); void renderManagedJobDetail(); }
    if (page === 'ui') { activateRootNavigation('ui'); renderUiShowcaseRoute({ header: uiPageHeaderEl, content: uiShowcaseContentEl }); }
    if (page === 'settings') { activateRootNavigation('settings'); settingsRouteControl = renderSettingsRoute({ header: settingsPageHeaderEl, content: settingsPageContentEl, state: appUpdateState, save: (preferences) => window.buildApi.saveUpdatePreferences(preferences), check: () => window.buildApi.checkForUpdates(), download: () => window.buildApi.downloadUpdate(), install: () => window.buildApi.installUpdate() }); }
    if (page === 'deploy') { activateRootNavigation('deploy'); void renderDeployRoute({ header: deployPageHeaderEl, content: deployPageContentEl, view: selectedDeployView, onOpenConfigurations: () => { selectedDeployView = 'configurations'; showPage('deploy'); }, onOpenJob: (jobId) => { selectedJobId = jobId; showPage('job-detail'); } }); }
    if (page === 'not-found') renderNotFoundRoute({ header: notFoundPageHeaderEl, content: notFoundPageContentEl, route: notFoundRoute, onOpenProjects: () => showPage('projects') });
    for (const item of Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-item[data-route]'))) {
        item.classList.toggle('active', item.dataset.route === page && (page !== 'fake-players' || item.dataset.fakePlayersView === selectedFakePlayersView) && (page !== 'deploy' || item.dataset.deployView === selectedDeployView) || (page === 'job-detail' && item.dataset.route === 'jobs'));
    }
    for (const item of Array.from(document.querySelectorAll<HTMLButtonElement>('.settings-nav-item[data-route]'))) {
        item.classList.toggle('active', item.dataset.route === page);
    }
    saveLastRoute(activeRoute);
}

async function renderManagedJobs(): Promise<void> {
    const managedJobs = await window.buildApi.getJobs();
    if (currentPage !== 'jobs') return;
    renderJobsRoute({ header: jobsPageHeaderEl, content: jobsPageContentEl, jobs: managedJobs, projects: projectsFile.projects, onOpen: (id) => { selectedJobId = id; showPage('job-detail'); }, onClearFinished: async () => { await window.buildApi.clearFinishedJobs(); await renderManagedJobs(); } });
}

async function renderManagedJobDetail(): Promise<void> {
    const job = selectedJobId ? await window.buildApi.getJob(selectedJobId) : null;
    if (currentPage !== 'job-detail') return;
    const project = job?.projectId ? projectsFile.projects.find((candidate) => candidate.id === job.projectId) : undefined;
    const profile = project && job?.profileId ? project.profiles.find((candidate) => candidate.id === job.profileId) : undefined;
    const openWorkflow = job ? (): void => {
        if (job.sourceUrl?.startsWith('/')) { navigateToRoute(job.sourceUrl); return; }
        const destinationProject = project ?? getSelectedProject();
        if (!destinationProject) { showPage('projects'); return; }
        selectedProjectId = destinationProject.id;
        if (job.name.startsWith('Reparse Meta console assets')) { selectedPlatform = 'fb-instant-games'; showPage('facebook-console-assets'); return; }
        if (job.name.startsWith('Import ') && job.name.includes('build template')) { if (profile) selectedPlatform = profile.platform; showPage('platform-configs'); return; }
        if (profile) { selectedPlatform = profile.platform; showPage('build'); return; }
        if (job.name.startsWith('Resolve Android ')) { selectedPlatform = 'android'; showPage('platform-configs'); return; }
        showPage('configs');
    } : undefined;
    renderJobDetailRoute({
        header: jobDetailPageHeaderEl,
        content: jobDetailPageContentEl,
        job,
        onOpenWorkflow: openWorkflow,
    });
}

function renderProfileList(): void {
    const project = getSelectedProject();
    activeProjectNameEl.textContent = 'Build';
    copyRouteBtn.disabled = false;
    refreshRouteBtn.disabled = false;

    if (!project) {
        openFacebookHostingBtn.hidden = true;
        openFacebookHostingBtn.dataset.appId = '';
        renderBuildRoute({ list: profileListEl, profiles: [], records: [], onBuild: () => undefined, onOpenOutput: () => undefined, onServe: async () => undefined, onCancel: () => undefined, onCancelDeployment: () => undefined, onDeploy: () => undefined });
        return;
    }
    ensurePlatform(project);
    buildPageDescriptionEl.textContent = `Build ${project.name} for ${selectedPlatform ? platformName(selectedPlatform) : 'the selected platform'}.`;
    const profiles = project.profiles.filter((profile) => profile.platform === selectedPlatform);
    const facebookAppId = selectedPlatform === 'fb-instant-games'
        ? profiles.find((profile) => profile.facebookAppId?.trim())?.facebookAppId?.trim()
        : undefined;
    openFacebookHostingBtn.hidden = !facebookAppId;
    openFacebookHostingBtn.dataset.appId = facebookAppId ?? '';
    renderBuildRoute({
        list: profileListEl,
        profiles,
        records: buildRecords,
        onBuild: (profile, rebuild) => { void requestEnvironmentBuild(profile, rebuild); },
        onOpenOutput: (profile) => {
            void window.buildApi.openBuildOutput(project.id, profile.id).catch((error) => showAlert(error instanceof Error ? error.message : String(error), 'Could not open output', 'warning'));
        },
        onServe: async (profile, protocol) => {
            try { await window.buildApi.startLocalWebServer(project.id, profile.id, protocol); }
            catch (error) { showAlert(error instanceof Error ? error.message : String(error), `Could not start ${protocol.toUpperCase()} server`, 'warning'); }
        },
        onCancel: (profile) => {
            void window.buildApi.cancelBuildProfile(project.id, profile.id).then(() => refreshBuildRecords());
        },
        onCancelDeployment: (record) => {
            if (record.deploymentTaskId) void window.buildApi.cancelDeployment(record.deploymentTaskId).then(() => refreshBuildRecords());
        },
        onDeploy: (profile, target) => {
            if (profile.platform === 'ios' && (target === 'device' || target === 'simulator' || target === 'testflight')) void deployIos(profile, target);
            if (profile.platform === 'android' && (target === 'device' || target === 'simulator' || target === 'google-play')) void deployAndroid(profile, target);
            if (profile.platform === 'fb-instant-games' && target === 'facebook-hosting') void deployFacebook(profile);
        },
    });
}

openFacebookHostingBtn.hidden = true;
openFacebookHostingBtn.addEventListener('click', () => {
    const appId = openFacebookHostingBtn.dataset.appId;
    if (appId) void window.buildApi.openExternalUrl(`https://developers.facebook.com/apps/${encodeURIComponent(appId)}/instant-games/hosting/`);
});
openLocalPreviewBtn.addEventListener('click', () => {
    const project = getSelectedProject();
    if (!project || openLocalPreviewBtn.disabled) return;
    openLocalPreviewBtn.disabled = true;
    const previousLabel = openLocalPreviewBtn.textContent;
    openLocalPreviewBtn.textContent = 'Opening…';
    void window.buildApi.openLocalPreview(project.projectPath, project.creatorExecutable)
        .catch((error) => showAlert(error instanceof Error ? error.message : String(error), 'Could not open local preview', 'warning'))
        .finally(() => { openLocalPreviewBtn.disabled = false; openLocalPreviewBtn.textContent = previousLabel; });
});

async function deployFacebook(profile: BuildProfile): Promise<void> {
    const project = getSelectedProject(); if (!project) return;
    const missing: string[] = [];
    if (!profile.facebookAppId) missing.push('Facebook App ID is missing.');
    if (!profile.facebookAppAccessToken) missing.push('Facebook app access token is missing.');
    if (missing.length) { showBuildConfigurationRequired(profile, missing); return; }
    const confirmed = await showConfirm({
        title: `Deploy ${profile.label}?`,
        message: 'The generated ZIP will be uploaded to Facebook Instant Games Web Hosting as a new hosted build.',
        confirmLabel: 'Deploy', icon: 'warning',
    });
    if (!confirmed) return;
    const taskId = crypto.randomUUID();
    const record = buildRecords.find((candidate) => candidate.profileId === profile.id);
    if (record) {
        record.deploymentStatus = 'uploading'; record.deploymentTaskId = taskId;
        record.deploymentFinishedAt = undefined; record.deploymentErrorDetails = undefined;
        renderProfileList();
    }
    try {
        await window.buildApi.deployFacebook({ projectId: project.id, profileId: profile.id, taskId });
    } catch (error) {
        // Deployment errors are persisted and rendered on the build card.
        void error;
    } finally {
        await refreshBuildRecords();
    }
}

async function deployAndroid(profile: BuildProfile, target: 'device' | 'simulator' | 'google-play'): Promise<void> {
    const project = getSelectedProject(); if (!project) return;
    const missing: string[] = [];
    if (!profile.packageName) missing.push('Package name');
    if (target === 'google-play') {
        if (!profile.androidKeystorePath) missing.push('Release keystore');
        if (!profile.androidKeystorePassword) missing.push('Keystore password');
        if (!profile.androidKeyAlias) missing.push('Key alias');
        if (!profile.androidKeyPassword) missing.push('Key password');
        if (!profile.androidPlayServiceAccountPath) missing.push('Google Play service-account JSON');
    }
    const toolchain = await window.buildApi.getAndroidToolchainStatus(project.projectPath);
    if (!toolchain.ready) missing.push(`Android SDK, NDK, and JDK ${toolchain.requiredJdkMajor}`);
    if (missing.length) { showBuildConfigurationRequired(profile, missing.map((value) => `${value} is missing.`)); return; }
    let deviceId: string | undefined;
    if (target === 'device') {
        const devices = await window.buildApi.listAndroidDevices(project.id);
        if (!devices.length) { showAlert('No authorized Android device was found. Connect a device by USB and enable USB debugging.', 'Device unavailable', 'warning'); return; }
        deviceId = devices[0].id;
        if (devices.length > 1) {
            const selected = await new Promise<string | null>((resolve) => {
                void showChoiceModal('Choose Android device', devices.map((device) => ({ value: device.id, title: device.name, meta: device.model }))).then(resolve);
            });
            if (!selected) return; deviceId = selected;
        }
    }
    const isDevice = target === 'device'; const isSimulator = target === 'simulator';
    const confirmed = await showConfirm({
        title: isSimulator ? 'Run in Android emulator?' : isDevice ? 'Deploy to device?' : 'Upload to Google Play?',
        message: isSimulator ? 'Gradle will build an APK, start an available emulator if needed, install the app, and launch it.' : isDevice ? 'Gradle will build an APK, install it on the connected device, and launch it.' : `Gradle will create a signed App Bundle and upload it to the ${profile.androidPlayTrack || 'internal'} track.`,
        confirmLabel: isSimulator ? 'Run' : isDevice ? 'Deploy' : 'Upload', icon: isDevice || isSimulator ? 'info' : 'warning',
    });
    if (!confirmed) return;
    const taskId = crypto.randomUUID();
    const record = buildRecords.find((candidate) => candidate.profileId === profile.id);
    if (record) { record.deploymentStatus = 'uploading'; record.deploymentTaskId = taskId; record.deploymentFinishedAt = undefined; record.deploymentErrorDetails = undefined; renderProfileList(); }
    try { await window.buildApi.deployAndroid({ projectId: project.id, profileId: profile.id, target, deviceId, taskId }); }
    catch { /* Deployment errors are persisted and rendered on the build card. */ }
    finally { await refreshBuildRecords(); }
}

async function deployIos(profile: BuildProfile, target: 'device' | 'simulator' | 'testflight'): Promise<void> {
    const project = getSelectedProject(); if (!project) return;
    const missing: string[] = [];
    if (!profile.packageName) missing.push('Bundle identifier');
    if (target !== 'simulator' && !profile.iosTeamId) missing.push('Apple Team ID');
    if (target === 'testflight') {
        if (!profile.iosApiKeyId) missing.push('App Store Connect API Key ID');
        if (!profile.iosApiIssuerId) missing.push('App Store Connect Issuer ID');
        if (!profile.iosApiKeyPath) missing.push('App Store Connect .p8 private key');
    }
    if (missing.length) { showBuildConfigurationRequired(profile, missing.map((value) => `${value} is missing.`)); return; }
    let deviceId: string | undefined;
    if (target === 'device') {
        const devices = await window.buildApi.listIosDevices();
        if (!devices.length) { showAlert('No connected and available physical iOS device was found.', 'Device unavailable', 'warning'); return; }
        deviceId = devices[0].id;
        if (devices.length > 1) {
            const selected = await showChoiceModal('Choose iOS device', devices.map((device) => ({ value: device.id, title: device.name, meta: device.model })));
            if (!selected) return; deviceId = selected;
        }
    }
    const confirmed = await showConfirm({ title: target === 'simulator' ? 'Run in iOS Simulator?' : target === 'device' ? 'Deploy to device?' : 'Upload to TestFlight?', message: target === 'simulator' ? 'Xcode will build the app for an available iOS Simulator, boot it if needed, install the app, and launch it.' : target === 'device' ? 'Xcode will sign the app, install it on the connected device, and launch it.' : 'Xcode will create an App Store archive and upload it to App Store Connect.', confirmLabel: target === 'simulator' ? 'Run' : target === 'device' ? 'Deploy' : 'Upload', icon: 'info' });
    if (!confirmed) return;
    const taskId = crypto.randomUUID();
    const record = buildRecords.find((candidate) => candidate.profileId === profile.id);
    if (record) { record.deploymentStatus = 'uploading'; record.deploymentTaskId = taskId; record.deploymentFinishedAt = undefined; record.deploymentErrorDetails = undefined; renderProfileList(); }
    try { await window.buildApi.deployIos({ projectId: project.id, profileId: profile.id, target, deviceId, taskId }); }
    catch { /* Deployment errors are persisted and rendered on the build card. */ }
    finally { await refreshBuildRecords(); }
}

async function refreshBuildRecords(): Promise<void> {
    const project = getSelectedProject();
    if (!project) return;
    buildRecords = await window.buildApi.getBuildRecords(project.id);
    if (currentPage === 'build') renderProfileList();
}

async function startEnvironmentBuild(profile: BuildProfile): Promise<void> {
    if (!selectedProjectId) return;
    const [jobId] = await window.buildApi.startBuild({ projectId: selectedProjectId, profileIds: [profile.id] });
    if (jobId) jobs.set(jobId, { projectId: selectedProjectId, profileId: profile.id, status: 'pending' });
    await refreshBuildRecords();
}

async function missingBuildConfiguration(project: ProjectConfig, profile: BuildProfile): Promise<string[]> {
    const missing: string[] = [];
    if ((profile.platform === 'android' || profile.platform === 'ios') && !profile.packageName?.trim()) {
        missing.push(`${profile.label} ${profile.platform === 'ios' ? 'bundle identifier' : 'package name'} is missing.`);
    }
    if (profile.platform === 'android') {
        const toolchain = await window.buildApi.getAndroidToolchainStatus(project.projectPath);
        if (!toolchain.configured.sdkPath) missing.push('Android SDK is not configured.');
        if (!toolchain.configured.ndkPath) missing.push('Android NDK is not configured.');
        if (!toolchain.configured.javaHome) missing.push(`JDK ${toolchain.requiredJdkMajor} is not configured.`);
    }
    return missing;
}

function showBuildConfigurationRequired(profile: BuildProfile, missing: string[]): void {
    const content = document.createElement('div'); content.className = 'build-config-required-content';
    const copy = document.createElement('p'); copy.textContent = `${profile.label} cannot be built until these settings are completed.`;
    const list = document.createElement('ul'); list.className = 'build-config-required-list';
    for (const issue of missing) { const item = document.createElement('li'); item.textContent = issue; list.appendChild(item); }
    content.append(copy, list);
    showModal({
        title: 'Configuration required', icon: 'warning', content,
        actions: [
            { label: 'Not now', run: (close) => close() },
            { label: 'Open configurations', className: 'btn-primary', run: (close) => { close(); selectedPlatform = profile.platform; showPage('platform-configs'); } },
        ],
    });
}

async function requestEnvironmentBuild(profile: BuildProfile, rebuild: boolean): Promise<void> {
    const project = getSelectedProject(); if (!project) return;
    const missing = await missingBuildConfiguration(project, profile);
    if (missing.length) { showBuildConfigurationRequired(profile, missing); return; }
    if (rebuild && !await showConfirm({ title: `Rebuild ${profile.label}?`, message: 'The existing output will be replaced.', confirmLabel: 'Rebuild', icon: 'warning' })) return;
    await startEnvironmentBuild(profile);
}

function renderPlatformManagement(): void {
    const project = getSelectedProject();
    if (!project) return;
    renderPlatformsRoute({ list: platformManageListEl, addButton: addPlatformPageBtn, project,
        onAdd: async (platform) => {
            const variants = [{ id: 'dev', label: 'Development', debug: true }, { id: 'prod', label: 'Production', debug: false }];
            project.profiles.push(...variants.map((variant) => ({ id: `${platform}-${variant.id}`, label: variant.label, platform, debug: variant.debug, environment: variant.id, buildPath: `build/${platform}/${variant.id}` })));
            await window.buildApi.saveProjects(projectsFile); renderPlatformManagement(); renderProfileList();
        },
        onOpen: (platform) => { selectedPlatform = platform; showPage('build'); },
        onRemove: async (platform) => { if (!await showConfirm({ title: 'Remove platform?', message: `Remove "${platform}" and its build environments from this project?`, confirmLabel: 'Remove', danger: true })) return; project.profiles = project.profiles.filter((profile) => profile.platform !== platform); if (selectedPlatform === platform) selectedPlatform = null; await window.buildApi.saveProjects(projectsFile); renderPlatformManagement(); renderProfileList(); showPage('platforms'); },
    });
}

function jobLabel(job: JobViewState): string {
    const project = projectsFile.projects.find((p) => p.id === job.projectId);
    const profile = project?.profiles.find((p) => p.id === job.profileId);
    return `${project?.name ?? job.projectId} / ${profile?.platform ?? '?'} / ${profile?.label ?? job.profileId}`;
}

function renderJobList(): void {
    jobListEl.replaceChildren();
    for (const [jobId, job] of jobs) {
        const badge = document.createElement('span');
        badge.className = `badge badge-${job.status}`;
        badge.textContent = job.status + (job.exitCode !== undefined ? ` (exit ${job.exitCode})` : '');
        const actions = document.createElement('div'); actions.appendChild(badge);
        if (job.status === 'pending' || job.status === 'running') {
            const cancelBtn = createButton({ label: 'Cancel', className: 'btn-danger', size: 'sm', symbol: 'close' });
            cancelBtn.addEventListener('click', () => void window.buildApi.cancelBuild(jobId));
            actions.appendChild(cancelBtn);
        }
        const item = createActionListItem({ title: jobLabel(job), actions, tagName: 'li' }); jobListEl.appendChild(item.element);
    }
    if (jobs.size === 0) {
        jobListEl.appendChild(createEmptyState('Chưa có job nào.'));
    }
}

configureDialogs({
    projectsFile,
    detectedProject,
    getSelectedProject,
    selectProject: (id) => { selectedProjectId = id; },
    selectPlatform: (platform) => { selectedPlatform = platform; },
    renderProjects: renderProjectList,
    renderBuild: renderProfileList,
    renderPlatforms: renderPlatformManagement,
    showPlatforms: () => showPage('platforms'),
});

addProjectBtn.addEventListener('click', () => {
    void (async () => {
        addProjectBtn.disabled = true;
        try {
            const selectedPath = await window.buildApi.pickFolder();
            if (!selectedPath) return;
            const detected = await window.buildApi.inspectProjectFolder(selectedPath);
            const existing = projectsFile.projects.find((project) => project.projectPath === detected.projectPath);
            if (existing) {
                showTechnicalError('Project already added', 'This project folder is already registered.', `Project: ${existing.name}\nID: ${existing.id}\nPath: ${existing.projectPath}`);
                return;
            }
            const baseId = slugify(detected.name) || 'cocos-project';
            let id = baseId; let suffix = 2;
            while (projectsFile.projects.some((project) => project.id === id)) id = `${baseId}-${suffix++}`;
            const project: ProjectConfig = {
                id,
                name: detected.name,
                orientation: 'landscape',
                projectPath: detected.projectPath,
                creatorExecutable: detected.creatorExecutable!,
                profiles: detected.profiles ?? [],
            };
            projectsFile.projects.push(project);
            await window.buildApi.saveProjects(projectsFile);
            selectedProjectId = project.id;
            renderProjectList();
        } catch (error) {
            const details = error instanceof Error ? error.stack || error.message : String(error);
            showTechnicalError('Unsupported project folder', 'The selected folder could not be added as a supported Cocos Creator project.', details);
        } finally {
            addProjectBtn.disabled = false;
        }
    })();
});
globalBackBtn.addEventListener('click', () => {
    if (currentPage === 'not-found') {
        showPage('projects');
    } else if (currentPage === 'job-detail') {
        showPage('jobs');
    } else if (currentPage === 'ui') {
        showPage('projects');
    } else if (currentPage === 'project' || currentPage === 'configs' || currentPage === 'loading') {
        showPage('projects');
    } else if (currentPage === 'platforms') {
        renderProjectInfo();
        showPage('project');
    } else if (currentPage === 'platform-configs' || currentPage === 'platform-loading' || currentPage === 'facebook-console' || currentPage === 'facebook-console-browser' || currentPage === 'facebook-console-assets' || currentPage === 'build') {
        renderPlatformManagement();
        showPage('platforms');
    }
});
for (const item of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-route]'))) {
    item.addEventListener('click', () => {
        const route = item.dataset.route;
        if (route === 'projects' || route === 'fake-players' || route === 'jobs' || route === 'ui' || route === 'settings' || route === 'deploy' || route === 'project' || route === 'configs' || route === 'loading' || route === 'platforms' || route === 'platform-configs' || route === 'platform-loading' || route === 'facebook-console' || route === 'facebook-console-browser' || route === 'facebook-console-assets' || route === 'build') {
            if (route === 'fake-players') selectedFakePlayersView = item.dataset.fakePlayersView === 'player-infos' ? 'player-infos' : 'avatars';
            if (route === 'deploy') selectedDeployView = item.dataset.deployView === 'builds' ? 'builds' : 'configurations';
            showPage(route);
        }
    });
}
bindCopyAction(copyRouteBtn, () => currentRouteInput.value);

refreshRouteBtn.addEventListener('click', () => {
    void (async () => {
        refreshRouteBtn.disabled = true;
        const previousId = selectedProjectId;
        projectsFile = await window.buildApi.getProjects();
        selectedProjectId = projectsFile.projects.some((project) => project.id === previousId)
            ? previousId
            : projectsFile.projects[0]?.id ?? null;
        renderProjectList();
        renderProjectInfo();
        renderProfileList();
        await Promise.all([refreshBridgeStatus(), refreshToolingStatus()]);
        const route = currentRouteInput.value;
        navigateToRoute(route);
        refreshRouteBtn.disabled = false;
    })();
});
bridgeFixBtn.addEventListener('click', () => {
    const project = getSelectedProject();
    if (!project) {
        return;
    }
    void (async () => {
        bridgeFixBtn.disabled = true;
        bridgeFixBtn.textContent = 'Installing…';
        try {
            const status = await window.buildApi.installBridge(project.projectPath);
            if (status.running) {
                bridgeWarningEl.hidden = true;
            } else if (status.editorOpen) {
                bridgeWarningEl.hidden = false;
                bridgeWarningTextEl.textContent =
                    'Bridge files are installed. In Cocos Creator, refresh/enable it in Extension > Extension Manager, or restart the Editor once.';
                bridgeFixBtn.textContent = 'Check again';
            } else {
                bridgeWarningEl.hidden = true;
            }
        } catch (error) {
            bridgeWarningEl.hidden = false;
            bridgeWarningTextEl.textContent = `Bridge installation failed: ${error instanceof Error ? error.message : String(error)}`;
            bridgeFixBtn.textContent = 'Retry';
        } finally {
            bridgeFixBtn.disabled = false;
        }
    })();
});
toolingFixBtn.addEventListener('click', () => {
    const project = getSelectedProject();
    if (!project) return;
    void (async () => {
        toolingFixBtn.disabled = true;
        toolingFixBtn.textContent = 'Synchronizing…';
        try {
            const status = await window.buildApi.syncTooling(project.projectPath);
            toolingWarningEl.hidden = !status.needsSync;
            await refreshBridgeStatus();
        } catch (error) {
            toolingWarningEl.hidden = false;
            toolingWarningTextEl.textContent = `Tool synchronization failed: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            toolingFixBtn.disabled = false;
            await refreshToolingStatus();
        }
    })();
});
hydrateIconButton(jobNotificationsBtn, 'notifications');
jobNotificationsBtn.appendChild(jobNotificationsCount);
const jobNotifications = createJobNotifications({
    trigger: jobNotificationsBtn,
    count: jobNotificationsCount,
    loadJobs: () => window.buildApi.getJobs(),
    onOpenJob: (id) => { selectedJobId = id; showPage('job-detail'); },
    onOpenAll: () => showPage('jobs'),
});
void jobNotifications.refresh();

window.buildApi.onLog(({ jobId, line }) => appendLog(jobId, line));

window.buildApi.onStatus(({ jobId, status, exitCode }) => {
    const job = jobs.get(jobId);
    if (job) {
        job.status = status;
        job.exitCode = exitCode;
        renderJobList();
    }
    void refreshBuildRecords();
});

window.buildApi.onProgress(() => void refreshBuildRecords());
window.buildApi.onJobsChanged(() => {
    void jobNotifications.refresh();
    if (currentPage === 'jobs' && !document.querySelector('.ui-dropdown-popover.is-open')) void renderManagedJobs();
    if (currentPage === 'job-detail') void renderManagedJobDetail();
});
window.buildApi.onUpdateStateChanged((state) => {
    appUpdateState = state;
    if (currentPage === 'settings') settingsRouteControl?.update(state);
});
window.setInterval(() => {
    if (currentPage === 'job-detail') void renderManagedJobDetail();
}, 1_000);

hydrateIcons();
hydrateIconButton(copyRouteBtn, 'copy'); hydrateIconButton(refreshRouteBtn, 'refresh'); hydrateIconButton(themeToggleBtn, 'sun');
hydrateIconButton(document.getElementById('global-back-btn') as HTMLButtonElement, 'back');
initializeThemeToggle(themeToggleBtn);
void (async () => {
    [projectsFile, detectedProject, appUpdateState, releaseDeploymentInfo] = await Promise.all([
        window.buildApi.getProjects(),
        window.buildApi.detectCurrentProject(),
        window.buildApi.getUpdateState(),
        window.buildApi.getReleaseDeploymentInfo(),
    ]);
    deployNavItem.hidden = !releaseDeploymentInfo.development;
    configureDialogs({
        projectsFile, detectedProject, getSelectedProject,
        selectProject: (id) => { selectedProjectId = id; },
        selectPlatform: (platform) => { selectedPlatform = platform; },
        renderProjects: renderProjectList, renderBuild: renderProfileList,
        renderPlatforms: renderPlatformManagement, showPlatforms: () => showPage('platforms'),
    });

    if (detectedProject) {
        const normalizedDetectedPath = detectedProject.projectPath.replace(/[\\/]+$/, '');
        let project = projectsFile.projects.find(
            (candidate) => candidate.projectPath.replace(/[\\/]+$/, '') === normalizedDetectedPath,
        );
        let changed = false;
        if (!project && detectedProject.creatorExecutable) {
            const baseId = slugify(detectedProject.name) || 'cocos-project';
            let id = baseId;
            let suffix = 2;
            while (projectsFile.projects.some((candidate) => candidate.id === id)) {
                id = `${baseId}-${suffix++}`;
            }
            project = {
                id,
                name: detectedProject.name,
                orientation: 'landscape',
                projectPath: detectedProject.projectPath,
                creatorExecutable: detectedProject.creatorExecutable,
                profiles: [],
            };
            projectsFile.projects.push(project);
            changed = true;
        } else if (
            project &&
            detectedProject.creatorExecutable &&
            (!project.creatorExecutable || !project.creatorExecutable.trim())
        ) {
            project.creatorExecutable = detectedProject.creatorExecutable;
            changed = true;
        }
        if (changed) {
            await window.buildApi.saveProjects(projectsFile);
        }
        if (project) {
            selectedProjectId = project.id;
        }
    }
    const restoredRoute = loadLastRoutePath();
    renderProjectList();
    renderProjectInfo();
    renderProfileList();
    renderPlatformManagement();
    renderJobList();
    if (restoredRoute) navigateToRoute(restoredRoute);
    else showPage(selectedProjectId ? 'build' : 'projects');
    document.body.classList.remove('is-booting');
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await window.buildApi.rendererReady();
    await refreshBuildRecords();
    await refreshBridgeStatus();
    await refreshToolingStatus();
})();

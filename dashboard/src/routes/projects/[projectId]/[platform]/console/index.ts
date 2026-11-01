import type { FacebookConsoleAssetExtraction, FacebookConsoleBrowserState, FacebookConsoleRequest, FacebookConsoleStatus, ProjectConfig } from '../../../../../../electron/types';
import { createButton, createTextField, setButtonLabel, setButtonLoading } from '../../../../../shared/ui/fields';
import { createIconButton } from '../../../../../shared/ui/icon-button';
import { createContentPanel } from '../../../../../shared/ui/content-panel';
import { createPanelHeaderAction } from '../../../../../shared/ui/panel';
import { renderPageHeader } from '../../../../../shared/ui/page-header';
import { showConfirm } from '../../../../../shared/ui/modal';
import { createActionList, createActionListItem } from '../../../../../shared/ui/action-list';
import { createDataTable } from '../../../../../shared/ui/data-table';
import { runWithLoadingState } from '../../../../../shared/ui/loading-state';

interface Options { header: HTMLElement; content: HTMLElement; project: ProjectConfig; view: ConsoleView; }
type ConsoleView = 'overview' | 'browser' | 'assets';
let browserCleanup: (() => void) | null = null;
let browserStateSink: ((state: FacebookConsoleBrowserState) => void) | null = null;
let browserStateListenerInstalled = false;

function value(label: string, text: string): HTMLDivElement {
    const item = document.createElement('div'); const term = document.createElement('dt'); const detail = document.createElement('dd');
    term.textContent = label; detail.textContent = text; item.append(term, detail); return item;
}

function statusContent(status: FacebookConsoleStatus): HTMLElement {
    const content = document.createElement('div'); content.className = 'facebook-console-summary';
    const summary = document.createElement('dl'); summary.className = 'job-detail-summary';
    summary.append(value('Session', status.signedIn ? `Signed in${status.accountId ? ` · ${status.accountId}` : ''}` : 'Sign-in required'), value('Storage', status.persistent ? 'Persistent isolated profile' : 'Temporary profile'), value('Browser', status.browserOpen ? 'Separate window open' : 'Embedded workspace ready'), value('Captured requests', String(status.requestCount)));
    const note = document.createElement('p'); note.className = 'form-hint'; note.textContent = 'Passwords are never stored by the dashboard. Meta cookies remain inside the isolated Chromium profile until you clear the session.';
    content.append(summary, note); return content;
}

function appContent(status: FacebookConsoleStatus): HTMLElement {
    const summary = document.createElement('dl'); summary.className = 'job-detail-summary';
    summary.append(value('App ID', status.appId ?? 'Not configured'), value('Business ID', status.businessId ?? 'Not configured')); return summary;
}

function requestContent(requests: FacebookConsoleRequest[]): HTMLElement {
    const content = document.createElement('div'); content.className = 'facebook-console-requests';
    const table = createDataTable({ items: requests.slice(0, 50), keyOf: (request) => request.id, emptyMessage: 'Navigate the Meta browser to begin capturing safe request metadata.', columns: [
        { id: 'request', label: 'Request', render: (request) => { const endpoint = document.createElement('span'); endpoint.className = 'facebook-console-request-endpoint'; const method = document.createElement('strong'); method.textContent = request.method; const path = document.createElement('code'); path.textContent = `${request.host}${request.path}`; endpoint.append(method, path); return endpoint; } },
        { id: 'type', label: 'Type', width: '140px', render: (request) => request.resourceType },
        { id: 'status', label: 'Status', width: '90px', render: (request) => request.statusCode ? String(request.statusCode) : '—' },
        { id: 'duration', label: 'Duration', width: '100px', render: (request) => request.durationMs === undefined ? '—' : `${request.durationMs}ms` },
    ] });
    content.appendChild(table.element); return content;
}

function installBrowserStateListener(): void {
    if (browserStateListenerInstalled) return;
    browserStateListenerInstalled = true;
    window.buildApi.onFacebookConsoleBrowserChanged((state) => browserStateSink?.(state));
}

function viewportBounds(viewport: HTMLElement): { x: number; y: number; width: number; height: number } {
    const rect = viewport.getBoundingClientRect(); return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

async function mountBrowser(projectId: string, panel: HTMLElement): Promise<void> {
    browserCleanup?.();
    const viewport = panel.querySelector<HTMLElement>('.facebook-console-browser-viewport')!;
    const address = panel.querySelector<HTMLInputElement>('.facebook-console-browser-address input')!;
    const title = panel.querySelector<HTMLElement>('.facebook-console-browser-title')!;
    const back = panel.querySelector<HTMLButtonElement>('[data-browser-action="back"]')!;
    const forward = panel.querySelector<HTMLButtonElement>('[data-browser-action="forward"]')!;
    const update = (state: FacebookConsoleBrowserState): void => { address.value = state.url; title.textContent = state.loading ? 'Loading…' : (state.title || 'Meta developer console'); back.disabled = !state.canGoBack; forward.disabled = !state.canGoForward; };
    browserStateSink = update;
    const syncBounds = (): void => { if (!panel.hidden && viewport.isConnected) void window.buildApi.resizeFacebookConsoleBrowser(viewportBounds(viewport)); };
    const observer = new ResizeObserver(syncBounds); observer.observe(viewport);
    window.addEventListener('resize', syncBounds); window.addEventListener('scroll', syncBounds, true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    update(await window.buildApi.showFacebookConsoleBrowser(projectId, viewportBounds(viewport)));
    browserCleanup = () => { observer.disconnect(); window.removeEventListener('resize', syncBounds); window.removeEventListener('scroll', syncBounds, true); browserStateSink = null; void window.buildApi.hideFacebookConsoleBrowser(); browserCleanup = null; };
}

function assetsBody(className = '', useTable = false): HTMLElement {
    const preview = document.createElement('div'); preview.className = 'facebook-console-asset-preview';
    const previewImage = document.createElement('img'); previewImage.alt = ''; previewImage.hidden = true;
    const previewVideo = document.createElement('video'); previewVideo.controls = true; previewVideo.hidden = true;
    const previewEmpty = document.createElement('p'); previewEmpty.className = 'form-hint'; previewEmpty.textContent = 'Select an extracted asset to preview it.';
    const previewMeta = document.createElement('div'); previewMeta.className = 'facebook-console-asset-preview-meta';
    preview.append(previewImage, previewVideo, previewEmpty, previewMeta);
    const collection = useTable ? document.createElement('div') : createActionList('facebook-console-asset-list'); collection.className = useTable ? 'facebook-console-asset-table-host' : collection.className;
    const content = document.createElement('div'); content.className = `facebook-console-assets-content${className ? ` ${className}` : ''}`; if (useTable) content.append(collection, preview); else content.append(preview, collection); return content;
}

function assetsLibrary(projectId: string, hidden = false): HTMLElement {
    const wrapper = document.createElement('div'); wrapper.className = 'facebook-console-assets-library'; const panelContent = assetsBody();
    const assetsActions = document.createElement('div'); const openAssets = createPanelHeaderAction('folder', 'Open extracted assets folder', 'facebook-console-assets-open'); assetsActions.appendChild(openAssets);
    const panel = createContentPanel({ title: 'Extracted assets', content: panelContent, actions: assetsActions, collapsible: false, compactHeader: true, flush: true, className: 'facebook-console-assets-panel' }); panel.hidden = hidden;
    openAssets.addEventListener('click', () => void window.buildApi.openFacebookConsoleAssetsFolder(projectId)); wrapper.appendChild(panel); return wrapper;
}

function assetsPage(): HTMLElement { const page = document.createElement('div'); page.className = 'facebook-console-assets-page'; page.appendChild(assetsBody('is-page', true)); return page; }

function browserPanel(projectId: string): HTMLElement {
    const workspace = document.createElement('div'); workspace.className = 'facebook-console-browser-workspace';
    const toolbar = document.createElement('div'); toolbar.className = 'facebook-console-browser-toolbar';
    const back = createIconButton({ icon: 'back', label: 'Back', variant: 'control', size: 'sm' }); back.dataset.browserAction = 'back'; back.disabled = true;
    const forward = createIconButton({ icon: 'back', label: 'Forward', variant: 'control', size: 'sm', className: 'facebook-console-forward' }); forward.dataset.browserAction = 'forward'; forward.disabled = true;
    const reload = createIconButton({ icon: 'refresh', label: 'Reload', variant: 'control', size: 'sm' }); reload.dataset.browserAction = 'reload';
    const home = createIconButton({ icon: 'globe', label: 'Open app dashboard', variant: 'control', size: 'sm' }); home.dataset.browserAction = 'home';
    const address = createTextField({ type: 'url', placeholder: 'https://developers.facebook.com/…', size: 'sm' }); address.element.classList.add('facebook-console-browser-address');
    const go = createIconButton({ icon: 'play', label: 'Go', variant: 'control', size: 'sm' });
    const title = document.createElement('span'); title.className = 'facebook-console-browser-title'; title.textContent = 'Meta developer console';
    const status = document.createElement('div'); status.className = 'facebook-console-browser-status'; status.hidden = true; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    toolbar.append(back, forward, reload, home, address.element, go);
    const viewport = document.createElement('div'); viewport.className = 'facebook-console-browser-viewport'; viewport.setAttribute('aria-label', 'Embedded Meta developer console');
    const browserContent = document.createElement('div'); browserContent.className = 'facebook-console-browser-content'; browserContent.append(status, title, viewport);
    const shell = createContentPanel({ content: browserContent, actions: toolbar, collapsible: false, compactHeader: true, flush: true, className: 'facebook-console-browser-shell' });
    workspace.append(shell, assetsLibrary(projectId, true));
    const navigate = async (action: 'back' | 'forward' | 'reload' | 'home', url?: string): Promise<void> => { browserStateSink?.(await window.buildApi.navigateFacebookConsoleBrowser(action, url)); };
    for (const button of [back, forward, reload, home]) button.addEventListener('click', () => void navigate(button.dataset.browserAction as 'back' | 'forward' | 'reload' | 'home'));
    const submit = (): void => { const url = address.input.value.trim(); if (url) void navigate('reload', url); };
    go.addEventListener('click', submit); address.input.addEventListener('keydown', (event) => { if ((event as KeyboardEvent).key === 'Enter') submit(); });
    workspace.dataset.projectId = projectId; return workspace;
}

function renderExtractedAssets(root: HTMLElement, result: FacebookConsoleAssetExtraction): void {
    const panel = root.querySelector<HTMLElement>('.facebook-console-assets-panel'); const list = root.querySelector<HTMLElement>('.facebook-console-asset-list'); const tableHost = root.querySelector<HTMLElement>('.facebook-console-asset-table-host');
    const image = root.querySelector<HTMLImageElement>('.facebook-console-asset-preview img')!; const video = root.querySelector<HTMLVideoElement>('.facebook-console-asset-preview video')!; const empty = root.querySelector<HTMLElement>('.facebook-console-asset-preview .form-hint')!; const meta = root.querySelector<HTMLElement>('.facebook-console-asset-preview-meta')!;
    if (panel) panel.hidden = false; list?.replaceChildren(); tableHost?.replaceChildren();
    const openAssets = root.querySelector<HTMLButtonElement>('.facebook-console-assets-open'); if (openAssets) openAssets.disabled = false;
    const showPreview = (file: FacebookConsoleAssetExtraction['files'][number]): void => {
        const isVideo = file.sourceKind === 'video'; image.hidden = isVideo; video.hidden = !isVideo; empty.hidden = true;
        if (isVideo) { image.removeAttribute('src'); video.src = file.previewUrl; void video.play().catch(() => undefined); } else { video.pause(); video.removeAttribute('src'); image.src = file.previewUrl; image.alt = file.label; }
        meta.textContent = `${file.fileName} · ${file.width || '?'} × ${file.height || '?'} · ${file.sourceKind} · ${file.validationStatus}`;
    };
    if (tableHost) {
        const renderStatus = (file: FacebookConsoleAssetExtraction['files'][number]): HTMLElement => { const original = file.sourceKind === 'original'; const badge = document.createElement('span'); badge.className = `badge ${original || file.sourceKind === 'video' ? 'badge-success' : 'badge-neutral'}`; badge.textContent = original ? 'Original' : file.sourceKind === 'video' ? 'Video' : 'Preview'; return badge; };
        const renderValidation = (file: FacebookConsoleAssetExtraction['files'][number]): HTMLElement => { const badge = document.createElement('span'); badge.className = `badge ${file.validationStatus === 'valid' ? 'badge-success' : 'badge-failed'}`; badge.textContent = file.validationStatus === 'valid' ? 'Valid' : 'Corrupt'; if (file.validationMessage) badge.title = file.validationMessage; return badge; };
        const table = createDataTable({ items: result.files, keyOf: (file) => file.fileName, selectedKey: result.files[0]?.fileName, emptyMessage: 'No extracted assets', onSelect: showPreview, columns: [
            { id: 'asset', label: 'Asset', render: (file) => file.label },
            { id: 'file', label: 'File', render: (file) => file.fileName },
            { id: 'dimensions', label: 'Dimensions', width: '120px', render: (file) => `${file.width || '?'} × ${file.height || '?'}` },
            { id: 'status', label: 'Status', width: '92px', render: renderStatus },
            { id: 'validation', label: 'Integrity', width: '92px', render: renderValidation },
        ] });
        tableHost.appendChild(table.element); if (result.files[0]) showPreview(result.files[0]); return;
    }
    result.files.forEach((file, index) => {
        const isOriginal = file.sourceKind === 'original'; const status = document.createElement('span'); status.className = `badge ${isOriginal || file.sourceKind === 'video' ? 'badge-success' : 'badge-neutral'}`; status.textContent = isOriginal ? 'Original' : file.sourceKind === 'video' ? 'Video' : 'Preview';
        const item = createActionListItem({ title: file.label, meta: `${file.fileName} · ${file.width || '?'} × ${file.height || '?'} · ${file.validationStatus}`, trailing: status });
        item.element.addEventListener('click', () => { list!.querySelectorAll('.ui-action-list-item').forEach((candidate) => { candidate.classList.remove('is-selected'); candidate.setAttribute('aria-current', 'false'); }); item.setSelected(true); showPreview(file); }); list!.appendChild(item.element); if (index === 0) { item.setSelected(true); showPreview(file); }
    });
}

export function hideFacebookConsoleBrowser(): void { browserCleanup?.(); void window.buildApi.hideFacebookConsoleBrowser(); }

export async function renderFacebookConsoleRoute(options: Options): Promise<void> {
    installBrowserStateListener(); hideFacebookConsoleBrowser();
    const title = options.view === 'browser' ? 'Meta console browser' : options.view === 'assets' ? 'Meta console assets' : 'Meta console';
    const description = options.view === 'browser' ? 'Navigate the authenticated app console. Extract page assets or leave the current page open for subsequent actions.' : options.view === 'assets' ? 'Browse project-owned images and videos extracted from the Meta console.' : 'Inspect the persistent Meta session, connected app, and safe request metadata.';
    renderPageHeader(options.header, { title, description, actions: [
        ...(options.view === 'browser' ? [{ id: 'facebook-console-extract-assets', label: 'Extract page assets', className: 'btn-primary', symbol: 'download' as const }] : []),
        ...(options.view === 'assets' ? [{ id: 'facebook-console-open-assets', label: 'Open folder', className: 'btn-secondary', symbol: 'folder' as const }, { id: 'facebook-console-reparse-progress', label: 'Parsing 0%', className: 'btn-secondary', symbol: 'refresh' as const, disabled: true }, { id: 'facebook-console-reparse-assets', label: 'Reparse', className: 'btn-primary', symbol: 'refresh' as const }] : []),
        ...(options.view !== 'assets' ? [{ id: 'facebook-console-open', label: 'Open separate window', className: 'btn-secondary', symbol: 'globe' as const }] : []),
        ...(options.view !== 'assets' ? [{ id: 'facebook-console-refresh', label: 'Refresh', className: 'btn-secondary', symbol: 'refresh' as const }] : []),
    ] });
    const open = options.header.querySelector<HTMLButtonElement>('#facebook-console-open'); const refresh = options.header.querySelector<HTMLButtonElement>('#facebook-console-refresh'); const openAssets = options.header.querySelector<HTMLButtonElement>('#facebook-console-open-assets'); const reparse = options.header.querySelector<HTMLButtonElement>('#facebook-console-reparse-assets'); const parsing = options.header.querySelector<HTMLButtonElement>('#facebook-console-reparse-progress');
    const extract = options.header.querySelector<HTMLButtonElement>('#facebook-console-extract-assets');
    const overview = document.createElement('div'); overview.className = 'facebook-console-overview';
    const browser = browserPanel(options.project.id);
    const assets = assetsPage(); options.content.replaceChildren(options.view === 'browser' ? browser : options.view === 'assets' ? assets : overview);
    const extractionStatus = options.content.querySelector<HTMLElement>('.facebook-console-browser-status');
    const renderOverview = async (): Promise<void> => {
        const [status, requests] = await runWithLoadingState(options.content, () => Promise.all([window.buildApi.getFacebookConsoleStatus(options.project.id), window.buildApi.listFacebookConsoleRequests()]), { label: 'Loading Meta console…' });
        const sessionActions = document.createElement('div'); const clear = createButton({ label: 'Clear session', className: 'btn-danger', symbol: 'trash', size: 'sm' }); sessionActions.appendChild(clear);
        clear.addEventListener('click', async () => { if (!await showConfirm({ title: 'Clear Meta session?', message: 'This signs the Meta browser out and removes its cookies, cache, and local storage.', confirmLabel: 'Clear session', danger: true })) return; hideFacebookConsoleBrowser(); await window.buildApi.clearFacebookConsoleSession(); await renderOverview(); });
        overview.replaceChildren(createContentPanel({ title: 'Browser session', content: statusContent(status), actions: sessionActions, collapsible: false }), createContentPanel({ title: 'Connected app', content: appContent(status), collapsible: false }), createContentPanel({ title: 'Recent Meta requests', description: 'Query strings, headers, cookies, tokens, request bodies, and response bodies are not captured.', content: requestContent(requests), collapsible: false }));
    };
    open?.addEventListener('click', async () => { open.disabled = true; setButtonLoading(open, true); try { await window.buildApi.openFacebookConsole(options.project.id); await renderOverview(); } finally { setButtonLoading(open, false); open.disabled = false; } });
    openAssets?.addEventListener('click', () => void window.buildApi.openFacebookConsoleAssetsFolder(options.project.id));
    if (parsing) parsing.hidden = true;
    const watchReparseJob = (jobId: string): void => {
        if (!reparse || !parsing) return;
        reparse.hidden = true; parsing.hidden = false;
        const poll = async (): Promise<void> => {
            const job = await window.buildApi.getJob(jobId); if (!assets.isConnected) return;
            if (!job) { parsing.hidden = true; reparse.hidden = false; return; }
            setButtonLabel(parsing, `Parsing ${Math.max(0, Math.min(100, Math.round(job.progress)))}%`);
            if (job.status === 'pending' || job.status === 'running') { window.setTimeout(() => void poll(), 500); return; }
            parsing.hidden = true; reparse.hidden = false;
            if (job.status === 'success') renderExtractedAssets(assets, await window.buildApi.listFacebookConsoleAssets(options.project.id));
        };
        void poll();
    };
    reparse?.addEventListener('click', async () => {
        reparse.disabled = true;
        try {
            const jobId = await window.buildApi.reparseFacebookConsoleAssets(options.project.id); reparse.disabled = false; watchReparseJob(jobId);
        } catch { reparse.disabled = false; }
    });
    extract?.addEventListener('click', async () => {
        extract.disabled = true; setButtonLoading(extract, true);
        if (extractionStatus) { extractionStatus.hidden = false; extractionStatus.classList.remove('is-error', 'is-success'); extractionStatus.textContent = 'Scanning and downloading assets from the current page…'; }
        try {
            const result = await window.buildApi.extractFacebookConsoleAssets(options.project.id);
            renderExtractedAssets(browser, result);
            const originals = result.files.filter((file) => file.sourceKind === 'original').length;
            const videos = result.files.filter((file) => file.sourceKind === 'video').length; const previews = result.files.length - originals - videos;
            if (extractionStatus) { extractionStatus.classList.add('is-success'); extractionStatus.textContent = `Extracted ${result.files.length} assets (${originals} original images, ${videos} videos, ${previews} preview/background) to ${result.directory}.${result.skipped ? ` ${result.skipped} inaccessible assets were skipped.` : ''}`; }
        } catch (error) {
            if (extractionStatus) { extractionStatus.classList.add('is-error'); extractionStatus.textContent = `Extraction failed: ${error instanceof Error ? error.message : String(error)}`; }
        }
        finally { setButtonLoading(extract, false); extract.disabled = false; }
    });
    refresh?.addEventListener('click', async () => { refresh.disabled = true; setButtonLoading(refresh, true); try { if (options.view === 'browser') browserStateSink?.(await window.buildApi.getFacebookConsoleBrowserState()); else await renderOverview(); } finally { setButtonLoading(refresh, false); refresh.disabled = false; } });
    if (options.view === 'browser') {
        await runWithLoadingState(options.content, () => mountBrowser(options.project.id, browser), { label: 'Opening Meta console…' });
    } else if (options.view === 'assets') {
        const [result, jobs] = await runWithLoadingState(options.content, () => Promise.all([window.buildApi.listFacebookConsoleAssets(options.project.id), window.buildApi.getJobs()]), { label: 'Loading extracted assets…' });
        renderExtractedAssets(assets, result);
        const active = jobs.find((job) => job.projectId === options.project.id && job.name.startsWith('Reparse Meta console assets') && (job.status === 'pending' || job.status === 'running'));
        if (active) watchReparseJob(active.id);
    } else await renderOverview();
}

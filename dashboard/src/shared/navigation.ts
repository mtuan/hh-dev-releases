export type StoredRoutePage = 'projects' | 'fake-players' | 'jobs' | 'job-detail' | 'ui' | 'settings' | 'deploy' | 'project' | 'configs' | 'loading' | 'platforms' | 'platform-configs' | 'platform-loading' | 'facebook-console' | 'facebook-console-browser' | 'facebook-console-assets' | 'build';

export interface StoredRoute {
    page: StoredRoutePage;
    deployView?: 'configurations' | 'builds';
    projectId?: string;
    platform?: string;
    jobId?: string;
    fakePlayersView?: 'avatars' | 'player-infos';
}

const LAST_ROUTE_KEY = 'hayhay-tools:last-route';

function decodeSegment(value: string): string | null {
    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
}

export function parseRoute(route: string): StoredRoute | null {
    const segments = route.split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (segments.length === 1 && segments[0] === 'projects') return { page: 'projects' };
    if (segments[0] === 'fake-players' && segments.length <= 2) {
        const view = segments[1] ?? 'avatars';
        return view === 'avatars' || view === 'player-infos' ? { page: 'fake-players', fakePlayersView: view } : null;
    }
    if (segments.length === 1 && segments[0] === 'ui') return { page: 'ui' };
    if (segments.length === 1 && segments[0] === 'settings') return { page: 'settings' };
    if (segments[0] === 'deploy' && segments.length <= 2) {
        const view = segments[1] ?? 'configurations';
        return view === 'configurations' || view === 'builds' ? { page: 'deploy', deployView: view } : null;
    }
    if (segments.length === 1 && segments[0] === 'jobs') return { page: 'jobs' };
    if (segments.length === 2 && segments[0] === 'jobs') { const jobId = decodeSegment(segments[1]); return jobId ? { page: 'job-detail', jobId } : null; }
    if (segments[0] !== 'projects' || segments.length < 2 || segments.length > 5) return null;

    const projectId = decodeSegment(segments[1]);
    if (!projectId) return null;
    if (segments.length === 2) return { page: 'project', projectId };
    if (segments.length === 3 && (segments[2] === 'configs' || segments[2] === 'setup')) return { page: 'configs', projectId };
    if (segments.length === 3 && segments[2] === 'platforms') return { page: 'platforms', projectId };
    if (segments.length === 3 && segments[2] === 'loading') return { page: 'loading', projectId };

    const platform = decodeSegment(segments[2]);
    if (!platform) return null;
    // The platform owner route resolves to its primary daily workflow.
    if (segments.length === 3) return { page: 'build', projectId, platform };
    if (segments[3] === 'templates') return { page: 'platform-configs', projectId, platform };
    if (segments[3] === 'configs') return { page: 'platform-configs', projectId, platform };
    if (segments[3] === 'loading') return { page: 'platform-loading', projectId, platform };
    if (segments[3] === 'console' && segments.length === 4) return { page: 'facebook-console', projectId, platform };
    if (segments[3] === 'console' && segments[4] === 'browser') return { page: 'facebook-console-browser', projectId, platform };
    if (segments[3] === 'console' && segments[4] === 'assets') return { page: 'facebook-console-assets', projectId, platform };
    if (segments[3] === 'build') return { page: 'build', projectId, platform };
    return null;
}

export function saveLastRoute(route: string): void {
    setPreference('navigation.currentRoute', route); try { localStorage.setItem(LAST_ROUTE_KEY, route); } catch { /* Legacy compatibility. */ }
}

export function loadLastRoute(): StoredRoute | null {
    try {
        const route = getPreference<string | null>('navigation.currentRoute', null, LAST_ROUTE_KEY);
        return route ? parseRoute(route) : null;
    } catch {
        return null;
    }
}

export function loadLastRoutePath(): string | null {
    try {
        return getPreference<string | null>('navigation.currentRoute', null, LAST_ROUTE_KEY);
    } catch {
        return null;
    }
}
import { getPreference, setPreference } from './preferences';

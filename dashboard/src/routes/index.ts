export type RootRouteId = 'projects' | 'fake-players' | 'jobs' | 'ui' | 'settings' | 'deploy';

export function activateRootNavigation(route: RootRouteId): void {
    for (const item of Array.from(document.querySelectorAll<HTMLButtonElement>('.root-sidebar [data-route]'))) {
        item.classList.toggle('active', item.dataset.route === route);
    }
}

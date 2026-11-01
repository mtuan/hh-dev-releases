import { renderPageHeader } from '../../shared/ui/page-header';
import { createButton } from '../../shared/ui/fields';

interface Options {
    header: HTMLElement;
    content: HTMLElement;
    route: string;
    onOpenProjects: () => void;
}

export function renderNotFoundRoute(options: Options): void {
    renderPageHeader(options.header, {
        title: 'Page not found',
        description: `No dashboard page matches ${options.route}.`,
    });
    options.content.innerHTML = '';
    const state = document.createElement('section');
    state.className = 'not-found-state';
    const code = document.createElement('strong');
    code.textContent = '404';
    const message = document.createElement('p');
    message.textContent = 'Check the route above or return to Projects.';
    const action = createButton({ label: 'Open Projects', className: 'btn-primary' });
    action.addEventListener('click', options.onOpenProjects);
    state.append(code, message, action);
    options.content.appendChild(state);
}

export interface RouteAddressOptions {
    input: HTMLInputElement;
    onNavigate: (route: string) => void;
}

export interface RouteAddressControl {
    setRoute: (route: string) => void;
    revert: () => void;
}

export function normalizeRoutePath(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '/';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function createRouteAddress(options: RouteAddressOptions): RouteAddressControl {
    let committedRoute = normalizeRoutePath(options.input.value);
    options.input.readOnly = false;
    options.input.setAttribute('autocomplete', 'off');
    options.input.setAttribute('spellcheck', 'false');

    const setRoute = (route: string): void => {
        committedRoute = normalizeRoutePath(route);
        options.input.value = committedRoute;
        options.input.title = committedRoute;
    };

    const revert = (): void => {
        options.input.value = committedRoute;
        options.input.title = committedRoute;
    };

    options.input.addEventListener('focus', () => options.input.select());
    options.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            options.onNavigate(normalizeRoutePath(options.input.value));
            options.input.blur();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            revert();
            options.input.blur();
        }
    });
    options.input.addEventListener('blur', revert);

    setRoute(committedRoute);
    return { setRoute, revert };
}

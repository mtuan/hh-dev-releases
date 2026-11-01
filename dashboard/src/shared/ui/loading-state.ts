export interface LoadingStateOptions {
    label?: string;
    overlay?: boolean;
}

export interface LoadingState {
    element: HTMLDivElement;
    setLabel(label: string): void;
}

/** Shared indeterminate state for page, panel, and content-region loading. */
export function createLoadingState(options: LoadingStateOptions = {}): LoadingState {
    const element = document.createElement('div');
    element.className = `ui-loading-state${options.overlay === false ? '' : ' is-overlay'}`;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');

    const spinner = document.createElement('span');
    spinner.className = 'ui-loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'ui-loading-label';
    element.append(spinner, label);

    const setLabel = (value: string): void => { label.textContent = value; };
    setLabel(options.label ?? 'Loading…');
    return { element, setLabel };
}

/**
 * Runs asynchronous work behind the shared loading state without replacing the
 * mounted content subtree or its interactive state.
 */
export async function runWithLoadingState<T>(host: HTMLElement, task: (loading: LoadingState) => Promise<T>, options: LoadingStateOptions = {}): Promise<T> {
    const loading = createLoadingState(options);
    host.classList.add('ui-loading-host');
    host.setAttribute('aria-busy', 'true');
    host.appendChild(loading.element);
    try {
        return await task(loading);
    } finally {
        loading.element.remove();
        if (!host.querySelector('.ui-loading-state')) {
            host.classList.remove('ui-loading-host');
            host.removeAttribute('aria-busy');
        }
    }
}

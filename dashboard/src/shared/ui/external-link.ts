export interface ExternalLinkOptions {
    label: string;
    url: string;
    className?: string;
}

/** Opens an HTTPS link in the operating system browser without navigating the dashboard. */
export function createExternalLink(options: ExternalLinkOptions): HTMLAnchorElement {
    const link = document.createElement('a');
    link.className = `ui-external-link ${options.className ?? ''}`.trim();
    link.href = options.url;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    link.textContent = options.label;
    link.addEventListener('click', (event) => {
        event.preventDefault();
        void window.buildApi.openExternalUrl(options.url);
    });
    return link;
}

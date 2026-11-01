export type IconName = 'folder' | 'file' | 'package' | 'trash' | 'play' | 'copy' | 'refresh' | 'notifications' | 'chevron' | 'sidebar' | 'build' | 'projects' | 'users' | 'settings' | 'info' | 'help' | 'platforms' | 'setup' | 'localization' | 'optimize' | 'loading' | 'back' | 'save' | 'check' | 'add' | 'close' | 'download' | 'globe' | 'lock' | 'action' | 'sun' | 'moon' | 'eye';

const ICONS: Record<IconName, string> = {
    folder: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 4.2h4.3l1.3 1.5h6.8v6.6a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z"/><path d="M1.8 4.2v-.5a1 1 0 0 1 1-1h3l1.3 1.5"/></svg>',
    file: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.5 1.8h5.6l3.4 3.4v8.2a.8.8 0 0 1-.8.8H3.5a.8.8 0 0 1-.8-.8V2.6a.8.8 0 0 1 .8-.8z"/><path d="M9 1.8v3.6h3.5"/></svg>',
    package: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.5l5.8 3v6L8 14.5l-5.8-4v-6z"/><path d="M2.2 4.5 8 7.5l5.8-3M8 7.5v7"/></svg>',
    trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9.5h6.8L12 4M6.5 6.5v4M9.5 6.5v4"/></svg>',
    play: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="m5 3 7 5-7 5z"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11H2.5A1.5 1.5 0 0 1 1 9.5v-7A1.5 1.5 0 0 1 2.5 1h7A1.5 1.5 0 0 1 11 2.5V3"/></svg>',
    refresh: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5V2l-1.5 1.5A5.5 5.5 0 1 0 13.2 9"/><path d="M13 2h-3"/></svg>',
    notifications: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5h10l-1.2-1.7V6.7a3.8 3.8 0 0 0-7.6 0v3.1z"/><path d="M6.3 13.2a2 2 0 0 0 3.4 0"/></svg>',
    chevron: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m4 6 4 4 4-4"/></svg>',
    sidebar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1.8" y="2" width="12.4" height="12" rx="1.5"/><path d="M6 2v12M10.8 5.5 8.4 8l2.4 2.5"/></svg>',
    build: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M3 2.5h10v11H3z"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/></svg>',
    projects: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6h12M5 3v3"/></svg>',
    users: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="6" cy="5.2" r="2.4"/><path d="M1.8 13c.3-2.6 1.8-4 4.2-4s3.9 1.4 4.2 4"/><circle cx="11.5" cy="5.8" r="1.8"/><path d="M11 9.5c1.8 0 3 .9 3.2 2.8"/></svg>',
    settings: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/></svg>',
    info: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.5v.5"/></svg>',
    help: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6.4 6.1a1.8 1.8 0 1 1 2.3 1.7c-.7.3-.9.7-.9 1.4M7.8 11.5h.1"/></svg>',
    platforms: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
    setup: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/><circle cx="8" cy="8" r="2.4"/></svg>',
    localization: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M2.3 8h11.4M8 2c1.7 1.6 2.6 3.6 2.6 6S9.7 12.4 8 14M8 2C6.3 3.6 5.4 5.6 5.4 8s.9 4.4 2.6 6"/></svg>',
    optimize: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3M5 8h6M8 5v6"/></svg>',
    loading: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 12.5h10M4 10a4 4 0 1 1 8 0M8 3V1.5M3.2 5.2 2.1 4.1M12.8 5.2l1.1-1.1"/></svg>',
    back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8h-11M6.5 4l-4 4 4 4"/></svg>',
    save: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2.5h9l2 2v9h-11zM5 2.5v4h5v-4M5 13V9h6v4"/></svg>',
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8.5 3.2 3.2L13 4.8"/></svg>',
    add: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
    download: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v7M5 7l3 3 3-3M3 13h10"/></svg>',
    globe: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c1.6 1.5 2.4 3.3 2.4 5.5S9.6 12 8 13.5C6.4 12 5.6 10.2 5.6 8S6.4 4 8 2.5z"/></svg>',
    lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2M8 10v1.5"/></svg>',
    action: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r=".8"/><circle cx="8" cy="8" r=".8"/><circle cx="13" cy="8" r=".8"/></svg>',
    sun: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2.7"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1"/></svg>',
    moon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13.2 10.4A5.8 5.8 0 0 1 5.6 2.8 5.8 5.8 0 1 0 13.2 10.4Z"/></svg>',
    eye: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4S1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="1.8"/></svg>',
};

export function iconMarkup(name: IconName): string { return ICONS[name]; }
export function createIcon(name: IconName, extraClass = ''): HTMLSpanElement { const icon = document.createElement('span'); icon.className = `ui-icon ${extraClass}`.trim(); icon.setAttribute('aria-hidden', 'true'); icon.innerHTML = iconMarkup(name); return icon; }
export function setIcon(element: HTMLElement, name: IconName): void { element.replaceChildren(createIcon(name)); }
export function hydrateIcons(root: ParentNode = document): void { root.querySelectorAll<HTMLElement>('[data-icon]').forEach((element) => { const name = element.dataset.icon as IconName | undefined; if (name && ICONS[name]) { element.classList.add('ui-icon'); element.setAttribute('aria-hidden', 'true'); element.innerHTML = iconMarkup(name); } }); }

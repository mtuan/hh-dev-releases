import type { ManagedJob } from '../../../electron/types';
import { createButton } from './fields';
import { createActionList, createActionListItem } from './action-list';
import { createPopover } from './popover';
import { formatRelativeTime } from '../time';

const CHECKED_JOBS_KEY = 'cocos-build-dashboard:checked-job-statuses';

function readCheckedStatuses(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(CHECKED_JOBS_KEY) ?? '{}') as Record<string, string>; } catch { return {}; }
}

function duration(job: ManagedJob): string {
    const milliseconds = job.durationMs ?? (job.status === 'running' ? Date.now() - new Date(job.startedAt).getTime() : undefined);
    if (milliseconds === undefined) return '—';
    const seconds = Math.max(0, Math.round(milliseconds / 1_000));
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export interface JobNotificationsOptions {
    trigger: HTMLButtonElement;
    count: HTMLElement;
    loadJobs(): Promise<ManagedJob[]>;
    onOpenJob(jobId: string): void;
    onOpenAll(): void;
}

export interface JobNotificationsControl { refresh(): Promise<void>; }

export function createJobNotifications(options: JobNotificationsOptions): JobNotificationsControl {
    const content = document.createElement('div'); content.className = 'job-notifications-menu';
    const popover = createPopover({ trigger: options.trigger, content, className: 'job-notifications-popover', align: 'end', onOpen: () => void render(true) });
    let jobs: ManagedJob[] = [];

    const unreadIds = (): Set<string> => {
        const checked = readCheckedStatuses();
        return new Set(jobs.filter((job) => checked[job.id] !== job.status).map((job) => job.id));
    };
    const updateCount = (): void => {
        const count = unreadIds().size;
        options.count.hidden = count === 0;
        options.count.textContent = count > 99 ? '99+' : String(count);
        options.trigger.classList.toggle('has-unread', count > 0);
        options.trigger.setAttribute('aria-label', count ? `Job notifications, ${count} unread` : 'Job notifications');
    };
    const acknowledge = (ids: Set<string>): void => {
        if (!ids.size) return;
        const checked = readCheckedStatuses();
        for (const job of jobs) if (ids.has(job.id)) checked[job.id] = job.status;
        localStorage.setItem(CHECKED_JOBS_KEY, JSON.stringify(checked));
        updateCount();
    };
    const render = async (acknowledgeUnread = false): Promise<void> => {
        jobs = await options.loadJobs();
        const highlighted = unreadIds();
        content.innerHTML = '';
        const header = document.createElement('div'); header.className = 'job-notifications-header';
        const title = document.createElement('strong'); title.textContent = 'Job notifications';
        const summary = document.createElement('span'); summary.textContent = highlighted.size ? `${highlighted.size} unread` : 'Up to date';
        header.append(title, summary); content.appendChild(header);
        const list = createActionList('job-notifications-list');
        for (const job of jobs.slice(0, 5)) {
            const status = document.createElement('span'); status.className = `badge badge-${job.status}`; status.textContent = job.status;
            const item = createActionListItem({ title: job.name, meta: `${job.type} · ${formatRelativeTime(job.startedAt)} · ${duration(job)}`, trailing: status, highlighted: highlighted.has(job.id), onActivate: () => { popover.hide(); options.onOpenJob(job.id); } });
            list.appendChild(item.element);
        }
        if (!jobs.length) { const empty = document.createElement('p'); empty.className = 'job-notifications-empty'; empty.textContent = 'No jobs yet.'; list.appendChild(empty); }
        content.appendChild(list);
        const footer = document.createElement('div'); footer.className = 'job-notifications-footer';
        const allJobs = createButton({ label: 'View all jobs', className: 'btn-secondary', size: 'sm' });
        allJobs.addEventListener('click', () => { popover.hide(); options.onOpenAll(); }); footer.appendChild(allJobs); content.appendChild(footer);
        updateCount();
        if (acknowledgeUnread) acknowledge(highlighted);
    };
    return { refresh: () => render(false) };
}

import type { ManagedJob, ProjectConfig } from '../../../electron/types';
import { renderPageHeader } from '../../shared/ui/page-header';
import { showConfirm } from '../../shared/ui/modal';
import { createDataTable } from '../../shared/ui/data-table';
import { formatRelativeTime } from '../../shared/time';

export function formatDuration(milliseconds?: number): string {
    if (milliseconds === undefined) return '—';
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60); return `${minutes}m ${seconds % 60}s`;
}

export function jobDuration(job: ManagedJob): number | undefined {
    return job.durationMs ?? (job.status === 'running' ? Date.now() - new Date(job.startedAt).getTime() : undefined);
}

export function renderJobsRoute(options: { header: HTMLElement; content: HTMLElement; jobs: ManagedJob[]; projects: ProjectConfig[]; onOpen(id: string): void; onClearFinished(): Promise<void> }): void {
    const finishedCount = options.jobs.filter((job) => job.status !== 'pending' && job.status !== 'running').length;
    renderPageHeader(options.header, { title: 'Jobs', description: 'Build, deployment, installation, and configuration operation history.', actions: [{ id: 'jobs-clear-finished', label: 'Clear finished', className: 'btn-danger', symbol: 'trash', disabled: finishedCount === 0 }] });
    options.header.querySelector<HTMLButtonElement>('#jobs-clear-finished')?.addEventListener('click', async (event) => {
        const button = event.currentTarget as HTMLButtonElement; if (!await showConfirm({ title: 'Clear finished jobs?', message: `Remove ${finishedCount} completed, failed, or canceled ${finishedCount === 1 ? 'job' : 'jobs'} from the history? Running and pending jobs will be kept.`, confirmLabel: 'Clear finished', danger: true })) return;
        button.disabled = true; await options.onClearFinished();
    });
    options.content.innerHTML = '';
    const badge = (text: string, className: string): HTMLElement => { const element = document.createElement('span'); element.className = className; element.textContent = text; return element; };
    const projectNames = new Map(options.projects.map((project) => [project.id, project.name]));
    const table = createDataTable({
        items: options.jobs, keyOf: (job) => job.id, pageSize: 10, preferenceKey: 'jobs', emptyMessage: 'No jobs have been recorded yet.', className: 'managed-job-table', onSelect: (job) => options.onOpen(job.id),
        columns: [
            { id: 'project', label: 'Project', width: '220px', render: (job) => job.project?.name ?? (job.projectId ? projectNames.get(job.projectId) ?? job.projectId : '—') },
            { id: 'action', label: 'Action', width: '180px', render: (job) => job.action ?? job.type },
            { id: 'detail', label: 'Job detail / description', render: (job) => job.name },
            { id: 'started', label: 'Started', width: '130px', render: (job) => formatRelativeTime(job.startedAt) },
            { id: 'duration', label: 'Duration', width: '100px', render: (job) => formatDuration(jobDuration(job)) },
            { id: 'status', label: 'Status', width: '100px', render: (job) => badge(job.status, `badge badge-${job.status}`) },
        ],
    });
    options.content.appendChild(table.element);
}

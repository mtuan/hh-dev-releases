import type { ManagedJob } from '../../../../electron/types';
import { createButton } from '../../../shared/ui/fields';
import { createContentPanel } from '../../../shared/ui/content-panel';
import { renderPageHeader } from '../../../shared/ui/page-header';
import { formatDuration, jobDuration } from '..';
import { formatRelativeTime } from '../../../shared/time';
import { bindCopyAction } from '../../../shared/ui/copy-action';

export function renderJobDetailRoute(options: { header: HTMLElement; content: HTMLElement; job: ManagedJob | null; onOpenWorkflow?: () => void }): void {
    const job = options.job;
    renderPageHeader(options.header, {
        title: job?.name ?? 'Job not found',
        description: job ? `${job.type} job · ${job.id}` : 'This job does not exist or is no longer available.',
        actions: options.onOpenWorkflow ? [{ id: 'job-open-workflow-btn', label: 'Open workflow', className: 'btn-primary', symbol: 'play' }] : undefined,
    });
    options.header.querySelector<HTMLButtonElement>('#job-open-workflow-btn')?.addEventListener('click', () => options.onOpenWorkflow?.());
    options.content.innerHTML = ''; if (!job) return;
    const summary = document.createElement('dl'); summary.className = 'job-summary-grid';
    for (const [label, value] of [['Project', job.project?.name ?? job.projectId ?? '—'], ['Action', job.action ?? job.type], ['Source', job.sourceUrl ?? '—'], ['Status', job.status], ['Started', formatRelativeTime(job.startedAt)], ['Duration', formatDuration(jobDuration(job))]]) { const cell = document.createElement('div'); const term = document.createElement('dt'); term.textContent = label; const detail = document.createElement('dd'); detail.textContent = value; cell.append(term, detail); summary.appendChild(cell); }
    options.content.appendChild(createContentPanel({ title: 'Overview', content: summary, collapsible: false }));

    const tasks = document.createElement('ul'); tasks.className = 'job-task-list';
    for (const task of job.tasks) { const row = document.createElement('li'); const copy = document.createElement('div'); const name = document.createElement('strong'); name.textContent = task.name; const timing = document.createElement('span'); timing.textContent = formatDuration(task.durationMs ?? (task.startedAt && task.status === 'running' ? Date.now() - new Date(task.startedAt).getTime() : undefined)); copy.append(name, timing); const progress = document.createElement('progress'); progress.max = 100; progress.value = task.progress; const badge = document.createElement('span'); badge.className = `badge badge-${task.status}`; badge.textContent = task.status; row.append(copy, progress, badge); tasks.appendChild(row); }
    options.content.appendChild(createContentPanel({ title: 'Tasks', content: tasks, collapsible: false }));

    const logShell = document.createElement('div'); logShell.className = 'job-log-shell'; const actions = document.createElement('div'); actions.className = 'job-log-actions';
    if (job.status === 'failed') { const copyErrors = createButton({ label: 'Copy failure logs', symbol: 'copy', className: 'btn-secondary', size: 'sm' }); bindCopyAction(copyErrors, () => (job.errorLogs.length ? job.errorLogs : job.logs).join('\n')); actions.appendChild(copyErrors); }
    const copyAll = createButton({ label: 'Copy all logs', symbol: 'copy', className: 'btn-secondary', size: 'sm' }); bindCopyAction(copyAll, () => job.logs.join('\n')); actions.appendChild(copyAll);
    const logs = document.createElement('pre'); logs.className = 'job-detail-logs'; logs.textContent = job.logs.join('\n') || 'No logs recorded.'; logShell.appendChild(logs);
    options.content.appendChild(createContentPanel({ title: 'Logs', content: logShell, actions, collapsible: false }));
}

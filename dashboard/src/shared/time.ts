export function formatRelativeTime(value?: string | number | Date): string {
    if (value === undefined) return '—';
    const timestamp = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return '—';
    const elapsed = Math.max(0, Date.now() - timestamp); const seconds = Math.floor(elapsed / 1_000);
    if (seconds < 45) return 'just now';
    const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24); if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    const weeks = Math.floor(days / 7); if (days < 60) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    const months = Math.floor(days / 30); if (days < 730) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    const years = Math.floor(days / 365); return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

import { createPagination } from './pagination';

export type DataTableCell = string | HTMLElement;
export interface DataTableColumn<T> { id: string; label: string; width?: string; align?: 'start' | 'center' | 'end'; render(item: T): DataTableCell; }
export interface DataTableOptions<T> { columns: DataTableColumn<T>[]; items?: T[]; keyOf(item: T): string; selectedKey?: string; emptyMessage?: string; className?: string; pageSize?: number; pageSizeOptions?: number[]; preferenceKey?: string; onSelect?(item: T): void; }
export interface DataTableControl<T> { element: HTMLDivElement; setItems(items: T[]): void; setSelectedKey(key: string | undefined): void; }

export function createDataTable<T>(options: DataTableOptions<T>): DataTableControl<T> {
    const element = document.createElement('div'); element.className = `ui-data-table${options.className ? ` ${options.className}` : ''}`;
    const table = document.createElement('table'); table.className = 'ui-data-table-table'; const head = document.createElement('thead'); const headerRow = document.createElement('tr');
    for (const column of options.columns) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = column.label; cell.dataset.align = column.align ?? 'start'; if (column.width) cell.style.width = column.width; headerRow.appendChild(cell); }
    head.appendChild(headerRow); const body = document.createElement('tbody'); table.append(head, body); element.appendChild(table); let items = options.items ?? []; let selectedKey = options.selectedKey; let page = 0; let pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : items.length || 1;
    const pagination = options.pageSize ? createPagination({ totalItems: items.length, pageSize, pageSizeOptions: options.pageSizeOptions, preferenceKey: options.preferenceKey, onChange(nextPage, nextPageSize) { page = nextPage; pageSize = nextPageSize; render(); } }) : undefined; if (pagination) { pageSize = pagination.pageSize; element.appendChild(pagination.element); }
    const render = (): void => {
        body.replaceChildren();
        const pageCount = Math.max(1, Math.ceil(items.length / pageSize)); page = Math.min(page, pageCount - 1);
        const start = page * pageSize; const visibleItems = items.slice(start, start + pageSize);
        if (!items.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = options.columns.length; cell.className = 'ui-data-table-empty'; cell.textContent = options.emptyMessage ?? 'No items'; row.appendChild(cell); body.appendChild(row); return; }
        for (const item of visibleItems) {
            const key = options.keyOf(item); const row = document.createElement('tr'); if (options.onSelect) { row.tabIndex = 0; row.classList.add('is-selectable'); row.setAttribute('aria-selected', String(key === selectedKey)); } row.dataset.key = key; row.classList.toggle('is-selected', key === selectedKey);
            for (const column of options.columns) { const cell = document.createElement('td'); cell.dataset.align = column.align ?? 'start'; const value = column.render(item); if (typeof value === 'string') cell.textContent = value; else cell.appendChild(value); row.appendChild(cell); }
            const activate = (): void => { selectedKey = key; body.querySelectorAll('tr').forEach((candidate) => { const active = candidate === row; candidate.classList.toggle('is-selected', active); candidate.setAttribute('aria-selected', String(active)); }); options.onSelect?.(item); };
            if (options.onSelect) {
                const isInteractiveTarget = (target: EventTarget | null): boolean => target instanceof Element && Boolean(target.closest('button,a,input,select,textarea,[role="button"]'));
                row.addEventListener('click', (event) => { if (!isInteractiveTarget(event.target)) activate(); }); row.addEventListener('keydown', (event) => { if (!isInteractiveTarget(event.target) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); activate(); } });
            }
            body.appendChild(row);
        }
    };
    const control: DataTableControl<T> = { element, setItems(nextItems) { items = nextItems; page = 0; pagination?.setPage(0); pagination?.setTotalItems(items.length); render(); }, setSelectedKey(key) { selectedKey = key; render(); } }; pagination?.setTotalItems(items.length); render(); return control;
}

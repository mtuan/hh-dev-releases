import { createButton, createSelectField } from './fields';
import { getPreference, setPreference } from '../preferences';

export interface PaginationOptions {
    totalItems?: number;
    pageSize: number;
    pageSizeOptions?: number[];
    itemLabel?: string;
    preferenceKey?: string;
    onChange(page: number, pageSize: number): void;
}

export interface PaginationControl {
    element: HTMLDivElement;
    page: number;
    pageSize: number;
    setPage(page: number): void;
    setTotalItems(totalItems: number): void;
}

export function createPagination(options: PaginationOptions): PaginationControl {
    const element = document.createElement('div'); element.className = 'ui-data-table-pagination';
    const pageButtons = document.createElement('div'); pageButtons.className = 'ui-data-table-page-buttons'; pageButtons.setAttribute('role', 'group'); pageButtons.setAttribute('aria-label', 'Pages');
    const pageSizeControl = document.createElement('div'); pageSizeControl.className = 'ui-data-table-page-size';
    const pageSizes = [...new Set(options.pageSizeOptions ?? [10, 25, 50, 100])].filter((value) => value > 0).sort((a, b) => a - b); const savedPageSize = options.preferenceKey ? Number(getPreference(`pagination.${options.preferenceKey}.pageSize`, options.pageSize)) : options.pageSize; const initialPageSize = savedPageSize > 0 ? savedPageSize : options.pageSize; if (!pageSizes.includes(initialPageSize)) pageSizes.unshift(initialPageSize);
    const itemLabel = options.itemLabel ?? 'records'; const pageSizeSelect = createSelectField(pageSizes.map((value) => ({ value: String(value), label: `${value} ${itemLabel}/page` })), 'sm'); pageSizeSelect.setValue(String(initialPageSize)); pageSizeControl.append(pageSizeSelect.element); element.append(pageButtons, pageSizeControl);
    let totalItems = options.totalItems ?? 0; let page = 0; let pageSize = initialPageSize;
    const tokens = (pageCount: number): Array<number | 'ellipsis'> => {
        if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index);
        const visible = new Set([0, pageCount - 1, page - 1, page, page + 1].filter((value) => value >= 0 && value < pageCount)); const sorted = [...visible].sort((a, b) => a - b); const result: Array<number | 'ellipsis'> = [];
        sorted.forEach((value, index) => { if (index && value - sorted[index - 1] > 1) result.push('ellipsis'); result.push(value); }); return result;
    };
    const render = (): void => {
        const pageCount = Math.max(1, Math.ceil(totalItems / pageSize)); page = Math.min(page, pageCount - 1); pageButtons.replaceChildren(); pageButtons.hidden = pageCount <= 1;
        const addButton = (label: string, target: number, disabled = false, current = false): void => { const button = createButton({ label, ariaLabel: label === '‹' ? 'Previous page' : label === '›' ? 'Next page' : `Page ${target + 1}`, className: `${current ? 'btn-primary' : 'btn-secondary'} ui-data-table-page-button${current ? ' is-current' : ''}`, size: 'sm', symbol: false, disabled }); button.setAttribute('aria-current', current ? 'page' : 'false'); button.addEventListener('click', () => { page = target; render(); options.onChange(page, pageSize); }); pageButtons.appendChild(button); };
        addButton('‹', Math.max(0, page - 1), page === 0);
        for (const token of tokens(pageCount)) { if (token === 'ellipsis') { const ellipsis = document.createElement('span'); ellipsis.className = 'ui-data-table-page-ellipsis'; ellipsis.textContent = '…'; ellipsis.setAttribute('aria-hidden', 'true'); pageButtons.appendChild(ellipsis); } else addButton(String(token + 1), token, false, token === page); }
        addButton('›', Math.min(pageCount - 1, page + 1), page >= pageCount - 1);
    };
    pageSizeSelect.onChange((value) => { pageSize = Number(value); page = 0; if (options.preferenceKey) setPreference(`pagination.${options.preferenceKey}.pageSize`, pageSize); render(); options.onChange(page, pageSize); });
    const control: PaginationControl = { element, get page() { return page; }, get pageSize() { return pageSize; }, setPage(nextPage) { page = Math.max(0, nextPage); render(); }, setTotalItems(nextTotal) { totalItems = Math.max(0, nextTotal); render(); } }; render(); return control;
}

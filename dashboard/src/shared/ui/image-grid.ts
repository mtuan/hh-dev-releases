import { createPagination } from './pagination';

export interface ImageGridOptions<T> {
    items?: T[];
    keyOf(item: T): string;
    renderItem(item: T): HTMLElement;
    emptyMessage?: string;
    pageSize?: number;
    pageSizeOptions?: number[];
    itemLabel?: string;
    preferenceKey?: string;
    className?: string;
}

export interface ImageGridControl<T> {
    element: HTMLDivElement;
    setItems(items: T[]): void;
}

export function createImageGrid<T>(options: ImageGridOptions<T>): ImageGridControl<T> {
    const element = document.createElement('div');
    element.className = `ui-image-grid${options.className ? ` ${options.className}` : ''}`;
    const grid = document.createElement('div');
    grid.className = 'ui-image-grid-items';
    element.appendChild(grid);

    let items = options.items ?? [];
    let page = 0;
    let pageSize = options.pageSize ?? Math.max(items.length, 1);
    const pagination = options.pageSize ? createPagination({
        totalItems: items.length,
        pageSize,
        pageSizeOptions: options.pageSizeOptions,
        itemLabel: options.itemLabel ?? 'images',
        preferenceKey: options.preferenceKey,
        onChange(nextPage, nextPageSize) {
            page = nextPage;
            pageSize = nextPageSize;
            render();
        },
    }) : undefined;
    if (pagination) {
        pageSize = pagination.pageSize;
        element.appendChild(pagination.element);
    }

    const render = (): void => {
        grid.replaceChildren();
        const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
        page = Math.min(page, pageCount - 1);
        const visibleItems = items.slice(page * pageSize, (page + 1) * pageSize);
        if (!visibleItems.length) {
            const empty = document.createElement('p');
            empty.className = 'ui-empty-state ui-image-grid-empty';
            empty.textContent = options.emptyMessage ?? 'No images';
            grid.appendChild(empty);
            return;
        }
        for (const item of visibleItems) {
            const rendered = options.renderItem(item);
            rendered.dataset.key = options.keyOf(item);
            grid.appendChild(rendered);
        }
    };

    const control: ImageGridControl<T> = {
        element,
        setItems(nextItems) {
            items = nextItems;
            page = 0;
            pagination?.setPage(0);
            pagination?.setTotalItems(items.length);
            render();
        },
    };
    pagination?.setTotalItems(items.length);
    render();
    return control;
}

export type FieldSize = 'sm' | 'md' | 'lg' | 'xl';

export const DEFAULT_FIELD_SIZE: FieldSize = 'md';
let defaultFieldSize: FieldSize = DEFAULT_FIELD_SIZE;

export function applyFieldSize(element: HTMLElement, size?: FieldSize): void {
    if (size) element.classList.add(`ui-size-${size}`);
}

export function setDefaultFieldSize(size: FieldSize): void {
    defaultFieldSize = size;
    document.documentElement.dataset.uiSize = size;
}

export function getDefaultFieldSize(): FieldSize {
    return defaultFieldSize;
}

export function initializeDefaultFieldSize(): void {
    document.documentElement.dataset.uiSize ||= defaultFieldSize;
}

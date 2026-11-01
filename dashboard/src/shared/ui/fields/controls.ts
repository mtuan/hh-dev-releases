import { createPopover } from '../popover';
import { applyFieldSize, type FieldSize } from './size';

export interface ValueControl<T = string> {
    element: HTMLElement;
    readonly value: T;
    setValue(value: T, notify?: boolean): void;
    onChange(callback: (value: T) => void): void;
}
export interface DropdownControl extends ValueControl<string> {
    element: HTMLDivElement;
    setItems(items: DropdownItem[]): void;
}

export interface DropdownItem { value: string; label: string; swatch?: string; }

export interface DisclosureFieldControl { element: HTMLButtonElement; label: HTMLSpanElement; setLabel(value: string): void; }

/** Select-shaped trigger for an anchored picker or configuration popover. */
export function createDisclosureField(ariaLabel: string, value = '', size?: FieldSize): DisclosureFieldControl {
    const element = document.createElement('button'); element.type = 'button'; element.className = 'ui-control-button custom-dropdown-trigger'; element.setAttribute('aria-haspopup', 'dialog'); element.setAttribute('aria-expanded', 'false'); element.setAttribute('aria-label', ariaLabel); applyFieldSize(element, size);
    const copy = document.createElement('span'); copy.className = 'custom-dropdown-copy'; const label = document.createElement('span'); label.textContent = value; copy.appendChild(label); const arrow = document.createElement('span'); arrow.className = 'custom-dropdown-arrow'; element.append(copy, arrow);
    return { element, label, setLabel(next) { label.textContent = next; element.title = next; } };
}

export function createDropdown(initialItems: DropdownItem[], size?: FieldSize): DropdownControl {
    const element = document.createElement('div'); element.className = 'custom-dropdown';
    applyFieldSize(element, size);
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ui-control-button custom-dropdown-trigger'; trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
    const triggerCopy = document.createElement('span'); triggerCopy.className = 'custom-dropdown-copy'; const triggerSwatch = document.createElement('span'); triggerSwatch.className = 'custom-dropdown-swatch'; const label = document.createElement('span'); triggerCopy.append(triggerSwatch, label); const arrow = document.createElement('span'); arrow.className = 'custom-dropdown-arrow'; trigger.append(triggerCopy, arrow);
    const menu = document.createElement('div'); menu.className = 'custom-dropdown-menu'; menu.role = 'listbox';
    const listeners = new Set<(value: string) => void>(); let items = [...initialItems]; let value = items[0]?.value ?? ''; let buttons: HTMLButtonElement[] = [];
    const sync = (): void => { element.dataset.formValue = value; const selected = items.find((item) => item.value === value) ?? items[0]; label.textContent = selected?.label ?? ''; triggerSwatch.hidden = !selected?.swatch; triggerSwatch.style.background = selected?.swatch ?? ''; buttons.forEach((button) => { const active = button.dataset.value === value; button.classList.toggle('selected', active); button.setAttribute('aria-selected', String(active)); }); };
    const popover = createPopover({ trigger, content: menu, className: 'ui-dropdown-popover', onOpen: () => buttons.find((button) => button.dataset.value === value)?.focus() });
    const open = (): void => popover.show();
    const close = (): void => popover.hide();
    const renderItems = (): void => { menu.innerHTML = ''; buttons = items.map((item) => { const option = document.createElement('button'); option.type = 'button'; option.className = 'ui-control-button custom-dropdown-option'; option.role = 'option'; option.dataset.value = item.value; if (item.swatch) { const swatch = document.createElement('span'); swatch.className = 'custom-dropdown-swatch'; swatch.style.background = item.swatch; option.appendChild(swatch); } const text = document.createElement('span'); text.textContent = item.label; option.appendChild(text); option.addEventListener('click', () => { close(); api.setValue(item.value, true); trigger.focus(); }); menu.appendChild(option); return option; }); };
    const api: DropdownControl = { element, get value() { return value; }, setValue(next, notify = false) { if (!items.some((item) => item.value === next)) return; value = next; sync(); if (notify) { listeners.forEach((listener) => listener(value)); element.dispatchEvent(new Event('change', { bubbles: true })); } }, setItems(next) { items = [...next]; if (!items.some((item) => item.value === value)) value = items[0]?.value ?? ''; renderItems(); sync(); }, onChange(callback) { listeners.add(callback); } };
    const keyboard = (event: KeyboardEvent): void => { if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return; event.preventDefault(); if (!popover.open) open(); const current = Math.max(0, items.findIndex((item) => item.value === value)); const offset = event.key === 'ArrowDown' ? 1 : -1; api.setValue(items[(current + offset + items.length) % items.length].value, true); buttons.find((button) => button.dataset.value === value)?.focus(); };
    trigger.addEventListener('keydown', keyboard); menu.addEventListener('keydown', keyboard); element.append(trigger); renderItems(); sync(); return api;
}

export function createSegmentedToggle(items: Array<{ value: string; label: string }>, size?: FieldSize): ValueControl<string> {
    const element = document.createElement('div'); element.className = 'segmented-toggle'; element.role = 'group';
    applyFieldSize(element, size);
    element.style.setProperty('--segment-count', String(items.length));
    const listeners = new Set<(value: string) => void>(); let value = items[0]?.value ?? '';
    const buttons = items.map((item) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-control-button'; button.textContent = item.label; button.dataset.value = item.value; button.addEventListener('click', () => api.setValue(item.value, true)); element.appendChild(button); return button; });
    const sync = (): void => { element.dataset.formValue = value; element.style.setProperty('--segment-index', String(Math.max(0, items.findIndex((item) => item.value === value)))); buttons.forEach((button) => { const active = button.dataset.value === value; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }); };
    const api: ValueControl<string> = { element, get value() { return value; }, setValue(next, notify = false) { if (!items.some((item) => item.value === next)) return; value = next; sync(); if (notify) { listeners.forEach((listener) => listener(value)); element.dispatchEvent(new Event('change', { bubbles: true })); } }, onChange(callback) { listeners.add(callback); } };
    sync(); return api;
}

export interface RangeControl extends ValueControl<number> {
    element: HTMLDivElement;
}

export function createRangeControl(min: number, max: number, initial: number, suffix = '', size?: FieldSize): RangeControl {
    const element = document.createElement('div'); element.className = 'range-control';
    applyFieldSize(element, size);
    const slider = document.createElement('div'); slider.className = 'range-slider'; const fill = document.createElement('span'); fill.className = 'range-slider-fill';
    const input = document.createElement('input'); input.type = 'range'; input.min = String(min); input.max = String(max); input.step = '1';
    const output = document.createElement('output'); const listeners = new Set<(value: number) => void>(); let value = initial;
    const sync = (): void => { element.dataset.formValue = String(value); input.value = String(value); output.value = `${value}${suffix}`; const percent = max === min ? 0 : ((value - min) / (max - min)) * 100; fill.style.width = `${percent}%`; };
    const api: RangeControl = { element, get value() { return value; }, setValue(next, notify = false) { value = Math.max(min, Math.min(max, Math.round(next))); sync(); if (notify) { listeners.forEach((listener) => listener(value)); element.dispatchEvent(new Event('input', { bubbles: true })); } }, onChange(callback) { listeners.add(callback); } };
    input.addEventListener('input', () => api.setValue(Number(input.value), true)); slider.append(fill, input); element.append(slider, output); sync(); return api;
}

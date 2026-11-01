import {
    createCheckboxField, createColorField, createDateField, createFileField, createGradientField, createNumberField,
    createPasswordField, createRadioGroup, createRangeField, createSegmentedField, createSelectField, createSwitchField,
    createTextAreaField, createTextField, type DateFieldType, type DropdownItem, type GradientValue,
    type FieldSize,
} from './fields';
import type { ValueControl } from './fields/controls';
import { createIconButton } from './icon-button';
import { createPopover } from './popover';

export type DynamicFormValues = Record<string, unknown>;
export type DynamicFieldType = 'text' | 'email' | 'search' | 'tel' | 'url' | 'password' | 'number' | 'date' | 'datetime-local' | 'month' | 'time' | 'week' | 'textarea' | 'select' | 'segmented' | 'range' | 'color' | 'gradient' | 'file' | 'checkbox' | 'switch' | 'radio' | 'custom';
export interface DynamicFieldContext<T extends DynamicFormValues> { readonly values: Readonly<T>; setValue(key: keyof T & string, value: unknown): void; patch(values: Partial<T>): void; validate(): boolean; }
export interface DynamicFieldControl<T = unknown> extends ValueControl<T> { setDisabled?(disabled: boolean): void; setError?(message?: string): void; focus?(): void; }
export interface DynamicFieldDefinition<T extends DynamicFormValues = DynamicFormValues> {
    key: keyof T & string;
    type: DynamicFieldType;
    label: string;
    description?: string | ((values: Readonly<T>) => string | undefined);
    descriptionMode?: 'inline' | 'info';
    /** @deprecated Use description. */
    hint?: string | ((values: Readonly<T>) => string | undefined);
    placeholder?: string;
    options?: DropdownItem[] | Array<{ value: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    rows?: number;
    autoGrow?: boolean;
    maxRows?: number;
    clearable?: boolean;
    compact?: boolean;
    size?: FieldSize;
    accept?: string;
    chooseFile?: () => Promise<string | null>;
    columns?: 1 | 2;
    /** @deprecated Use columns. */
    span?: 1 | 2;
    visible?: boolean | ((values: Readonly<T>) => boolean);
    disabled?: boolean | ((values: Readonly<T>) => boolean);
    readOnly?: boolean | ((values: Readonly<T>) => boolean);
    required?: boolean | ((values: Readonly<T>) => boolean);
    validate?: (value: unknown, values: Readonly<T>) => string | undefined;
    normalize?: (value: unknown, values: Readonly<T>) => unknown;
    onChange?: (value: unknown, context: DynamicFieldContext<T>) => void;
    create?: (value: unknown, context: DynamicFieldContext<T>) => DynamicFieldControl;
}
export type DynamicFormLayout<T extends DynamicFormValues> = Array<Array<keyof T & string>>;
export interface DynamicFormDefinition<T extends DynamicFormValues> { fields: DynamicFieldDefinition<T>[]; initialValues: T; layout?: DynamicFormLayout<T>; size?: FieldSize; validate?: (values: Readonly<T>) => Partial<Record<keyof T & string, string>>; onChange?: (values: Readonly<T>, changedKey: keyof T & string) => void; }
export interface DynamicFormController<T extends DynamicFormValues> {
    element: HTMLDivElement;
    readonly values: T;
    readonly valid: boolean;
    readonly dirty: boolean;
    setValue(key: keyof T & string, value: unknown, notify?: boolean): void;
    patch(values: Partial<T>, notify?: boolean): void;
    reset(values?: T): void;
    commit(): void;
    validate(): boolean;
    onChange(callback: (values: Readonly<T>, changedKey: keyof T & string) => void): void;
    getControl(key: keyof T & string): DynamicFieldControl | undefined;
}

interface RuntimeField<T extends DynamicFormValues> { definition: DynamicFieldDefinition<T>; control: DynamicFieldControl; wrapper: HTMLDivElement; label: HTMLLabelElement; description: HTMLParagraphElement; descriptionContent?: HTMLParagraphElement; descriptionTrigger?: HTMLButtonElement; error: HTMLParagraphElement; }
const clone = <T extends DynamicFormValues>(value: T): T => structuredClone(value);
const resolve = <T extends DynamicFormValues>(rule: boolean | ((values: Readonly<T>) => boolean) | undefined, values: T, fallback: boolean): boolean => typeof rule === 'function' ? rule(values) : rule ?? fallback;
const empty = (value: unknown): boolean => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
const descriptionMode = <T extends DynamicFormValues>(field: DynamicFieldDefinition<T>): 'inline' | 'info' => field.descriptionMode ?? (field.description !== undefined ? 'info' : 'inline');

function setNativeState(control: DynamicFieldControl, disabled: boolean, readOnly: boolean): void {
    control.setDisabled?.(disabled);
    control.element.classList.toggle('is-disabled', disabled);
    control.element.classList.toggle('is-readonly', readOnly);
    control.element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input,textarea,button').forEach((item) => {
        item.disabled = disabled;
        if (item instanceof HTMLInputElement || item instanceof HTMLTextAreaElement) item.readOnly = readOnly;
    });
}

function createBuiltInControl<T extends DynamicFormValues>(field: DynamicFieldDefinition<T>, value: unknown): DynamicFieldControl {
    const stringValue = value == null ? '' : String(value);
    if (field.type === 'password') return createPasswordField({ value: stringValue, placeholder: field.placeholder, clearable: field.clearable, size: field.size });
    if (['text', 'email', 'search', 'tel', 'url'].includes(field.type)) return createTextField({ value: stringValue, type: field.type as 'text' | 'email' | 'search' | 'tel' | 'url', placeholder: field.placeholder, clearable: field.clearable, size: field.size });
    if (field.type === 'number') return createNumberField({ value: typeof value === 'number' ? value : null, min: field.min, max: field.max, step: field.step, placeholder: field.placeholder, compact: field.compact, size: field.size });
    if (['date', 'datetime-local', 'month', 'time', 'week'].includes(field.type)) return createDateField(field.type as DateFieldType, { value: stringValue, placeholder: field.placeholder, size: field.size });
    if (field.type === 'textarea') return createTextAreaField({ value: stringValue, placeholder: field.placeholder, rows: field.rows, autoGrow: field.autoGrow, maxRows: field.maxRows, size: field.size });
    if (field.type === 'select') return createSelectField(field.options as DropdownItem[] ?? [], field.size);
    if (field.type === 'segmented') return createSegmentedField(field.options as Array<{ value: string; label: string }> ?? [], field.size);
    if (field.type === 'range') return createRangeField(field.min ?? 0, field.max ?? 100, typeof value === 'number' ? value : 0, field.suffix, field.size);
    if (field.type === 'color') return createColorField(stringValue || '#ffffff', field.size);
    if (field.type === 'gradient') return createGradientField((value ?? {}) as Partial<GradientValue>, field.size);
    if (field.type === 'file') return createFileField({ value: stringValue, placeholder: field.placeholder, accept: field.accept, choose: field.chooseFile ?? (async () => null), size: field.size });
    if (field.type === 'checkbox') return createCheckboxField('', Boolean(value), field.size);
    if (field.type === 'switch') return createSwitchField('', Boolean(value), field.size);
    if (field.type === 'radio') return createRadioGroup(field.options as Array<{ value: string; label: string }> ?? [], stringValue, field.size);
    throw new Error(`Dynamic form field "${field.key}" requires a custom create() factory.`);
}

export function createDynamicForm<T extends DynamicFormValues>(definition: DynamicFormDefinition<T>): DynamicFormController<T> {
    const element = document.createElement('div'); element.className = 'ui-dynamic-form';
    if (definition.size) element.classList.add(`ui-size-${definition.size}`);
    let values = clone(definition.initialValues); let baseline = clone(values); let valid = true; let refreshing = false;
    const listeners = new Set<(values: Readonly<T>, changedKey: keyof T & string) => void>(); const runtime = new Map<keyof T & string, RuntimeField<T>>(); const layoutRows: HTMLDivElement[] = [];
    const context: DynamicFieldContext<T> = { get values() { return values; }, setValue(key, value) { api.setValue(key, value); }, patch(next) { api.patch(next); }, validate() { return api.validate(); } };
    for (const field of definition.fields) {
        const wrapper = document.createElement('div'); wrapper.className = `ui-dynamic-field span-${field.columns ?? field.span ?? 1}`; wrapper.dataset.field = field.key;
        if (field.size) wrapper.classList.add(`ui-size-${field.size}`);
        const label = document.createElement('label'); label.className = 'ui-field-label'; label.textContent = field.label;
        const labelRow = document.createElement('div'); labelRow.className = 'ui-dynamic-field-label'; labelRow.appendChild(label);
        let descriptionTrigger: HTMLButtonElement | undefined; let descriptionContent: HTMLParagraphElement | undefined;
        if (descriptionMode(field) === 'info') {
            descriptionTrigger = createIconButton({ icon: 'info', label: `About ${field.label}`, variant: 'control', className: 'ui-dynamic-description-button' }); descriptionTrigger.setAttribute('aria-haspopup', 'dialog');
            descriptionContent = document.createElement('p'); descriptionContent.className = 'ui-dynamic-description-popover-content';
            let pinned = false; const popover = createPopover({ trigger: descriptionTrigger, content: descriptionContent, className: 'ui-dynamic-description-popover', triggerOnClick: false, onClose: () => { pinned = false; } });
            descriptionTrigger.addEventListener('click', () => { pinned = !pinned; if (pinned) popover.show(); else popover.hide(); });
            descriptionTrigger.addEventListener('pointerenter', () => { if (!pinned) popover.show(); }); descriptionTrigger.addEventListener('pointerleave', () => { if (!pinned) popover.hide(); });
            descriptionTrigger.addEventListener('focus', () => popover.show()); descriptionTrigger.addEventListener('blur', () => { if (!pinned) popover.hide(); }); labelRow.appendChild(descriptionTrigger);
        }
        const control = field.create ? field.create(values[field.key], context) : createBuiltInControl(field, values[field.key]);
        const input = control.element.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea'); if (input) { if (!input.id) input.id = `dynamic-${field.key}-${Math.random().toString(36).slice(2)}`; label.htmlFor = input.id; }
        const description = document.createElement('p'); description.className = 'ui-field-hint'; const error = document.createElement('p'); error.className = 'ui-field-error'; error.hidden = true;
        wrapper.append(labelRow, control.element, description, error); element.appendChild(wrapper); runtime.set(field.key, { definition: field, control, wrapper, label, description, descriptionContent, descriptionTrigger, error });
        control.setValue(values[field.key], false); control.onChange((next) => { if (!refreshing) api.setValue(field.key, next); });
    }
    if (definition.layout) {
        element.classList.add('has-defined-layout'); const placed = new Set<keyof T & string>();
        const appendRow = (keys: Array<keyof T & string>): void => {
            if (!keys.length) return; const row = document.createElement('div'); row.className = 'ui-dynamic-form-row'; row.style.setProperty('--dynamic-form-row-columns', String(keys.length));
            for (const key of keys) { const field = runtime.get(key); if (!field) throw new Error(`Dynamic form layout references unknown field "${key}".`); if (placed.has(key)) throw new Error(`Dynamic form layout contains field "${key}" more than once.`); placed.add(key); row.appendChild(field.wrapper); }
            element.appendChild(row); layoutRows.push(row);
        };
        element.replaceChildren(); definition.layout.forEach(appendRow); runtime.forEach((_field, key) => { if (!placed.has(key)) appendRow([key]); });
    }
    const refresh = (editingKey?: keyof T & string): void => {
        refreshing = true;
        runtime.forEach(({ definition: field, control, wrapper, description, descriptionContent, descriptionTrigger }, key) => {
            wrapper.hidden = !resolve(field.visible, values, true); const disabled = resolve(field.disabled, values, false); const readOnly = resolve(field.readOnly, values, false); setNativeState(control, disabled, readOnly);
            const source = field.description ?? field.hint; const descriptionText = typeof source === 'function' ? source(values) : source; const infoMode = descriptionMode(field) === 'info';
            description.textContent = infoMode ? '' : descriptionText ?? ''; description.hidden = infoMode || !descriptionText;
            if (descriptionContent) descriptionContent.textContent = descriptionText ?? ''; if (descriptionTrigger) descriptionTrigger.hidden = !descriptionText;
            if (key !== editingKey) control.setValue(values[key], false);
        });
        layoutRows.forEach((row) => { row.hidden = Array.from(row.children).every((child) => (child as HTMLElement).hidden); });
        refreshing = false; api.validate(); element.dataset.dirty = String(api.dirty); element.classList.toggle('is-dirty', api.dirty);
    };
    const api: DynamicFormController<T> = {
        element,
        get values() { return clone(values); },
        get valid() { return valid; },
        get dirty() { return JSON.stringify(values) !== JSON.stringify(baseline); },
        setValue(key, next, notify = true) { const field = runtime.get(key)?.definition; if (!field) return; const normalized = field.normalize ? field.normalize(next, values) : next; (values as DynamicFormValues)[key] = normalized; field.onChange?.(normalized, context); refresh(key); if (notify) { definition.onChange?.(values, key); listeners.forEach((listener) => listener(values, key)); element.dispatchEvent(new Event('input', { bubbles: true })); } },
        patch(next, notify = true) { Object.entries(next).forEach(([key, value]) => { const field = runtime.get(key); const normalized = field?.definition.normalize ? field.definition.normalize(value, values) : value; (values as DynamicFormValues)[key] = normalized; }); refresh(); if (notify) { const key = Object.keys(next)[0] as keyof T & string; if (key) { definition.onChange?.(values, key); listeners.forEach((listener) => listener(values, key)); element.dispatchEvent(new Event('input', { bubbles: true })); } } },
        reset(next = definition.initialValues) { values = clone(next); baseline = clone(next); refresh(); },
        commit() { baseline = clone(values); refresh(); },
        validate() { const formErrors: Partial<Record<keyof T & string, string>> = definition.validate?.(values) ?? {}; valid = true; runtime.forEach(({ definition: field, control, wrapper, error }, key) => { let message: string | undefined; if (!wrapper.hidden) { if (resolve(field.required, values, false) && empty(values[key])) message = 'This field is required.'; message ??= field.validate?.(values[key], values); message ??= formErrors[key]; } error.textContent = message ?? ''; error.hidden = !message; wrapper.classList.toggle('has-error', Boolean(message)); control.setError?.(message); if (message) valid = false; }); element.dataset.valid = String(valid); return valid; },
        onChange(callback) { listeners.add(callback); },
        getControl(key) { return runtime.get(key)?.control; },
    };
    refresh(); return api;
}

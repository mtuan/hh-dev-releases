export { createButton, setButtonLabel, setButtonLoading, actionSymbol, type ButtonOptions, type ButtonSymbol } from './button';
export { createDisclosureField, type DisclosureFieldControl, type DropdownControl, type DropdownItem, type RangeControl, type ValueControl } from './controls';
export { applyFieldSize, DEFAULT_FIELD_SIZE, getDefaultFieldSize, initializeDefaultFieldSize, setDefaultFieldSize, type FieldSize } from './size';

import { createDropdown, createRangeControl, createSegmentedToggle, type DropdownControl, type DropdownItem, type RangeControl, type ValueControl } from './controls';
import { createButton } from './button';
import { createPopover } from '../popover';
import { createIconButton } from '../icon-button';
import { applyFieldSize, type FieldSize } from './size';

export type TextFieldType = 'text' | 'email' | 'search' | 'tel' | 'url';
export type DateFieldType = 'date' | 'datetime-local' | 'month' | 'time' | 'week';

export interface FieldControl<T> extends ValueControl<T> {
    element: HTMLElement;
    input: HTMLInputElement | HTMLTextAreaElement;
    setDisabled(disabled: boolean): void;
    setError(message?: string): void;
    focus(): void;
}

export interface FieldLayout { element: HTMLDivElement; label: HTMLLabelElement; hint: HTMLParagraphElement; error: HTMLParagraphElement; setHint(text?: string): void; setError(text?: string): void; }
export function createFieldLayout(labelText: string, control: HTMLElement, hintText?: string, size?: FieldSize): FieldLayout {
    const element = document.createElement('div'); element.className = 'ui-field-layout'; const label = document.createElement('label'); label.className = 'ui-field-label'; label.textContent = labelText; const id = control.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea')?.id;
    applyFieldSize(element, size);
    if (id) label.htmlFor = id; const hint = document.createElement('p'); hint.className = 'ui-field-hint'; const error = document.createElement('p'); error.className = 'ui-field-error'; error.hidden = true;
    const api: FieldLayout = { element, label, hint, error, setHint(text = '') { hint.textContent = text; hint.hidden = !text; }, setError(text = '') { error.textContent = text; error.hidden = !text; element.classList.toggle('has-error', Boolean(text)); } }; api.setHint(hintText); element.append(label, control, hint, error); return api;
}

export interface TextFieldOptions {
    value?: string;
    type?: TextFieldType;
    placeholder?: string;
    autocomplete?: string;
    clearable?: boolean;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    maxLength?: number;
    size?: FieldSize;
}

function notify<T>(element: HTMLElement, listeners: Set<(value: T) => void>, value: T, eventName = 'input'): void {
    element.dataset.formValue = String(value ?? ''); listeners.forEach((listener) => listener(value)); element.dispatchEvent(new Event(eventName, { bubbles: true }));
}

function errorState(element: HTMLElement, input: HTMLElement, message?: string): void {
    element.classList.toggle('has-error', Boolean(message)); input.toggleAttribute('aria-invalid', Boolean(message));
    if (message) { element.dataset.validationMessage = message; input.setAttribute('title', message); }
    else { delete element.dataset.validationMessage; input.removeAttribute('title'); }
}

export function createTextField(options: TextFieldOptions = {}): FieldControl<string> {
    const element = document.createElement('div'); element.className = 'ui-field ui-input-field';
    applyFieldSize(element, options.size);
    const input = document.createElement('input'); input.className = 'ui-field-input'; input.type = options.type ?? 'text'; input.value = options.value ?? ''; input.placeholder = options.placeholder ?? '';
    if (options.autocomplete) input.setAttribute('autocomplete', options.autocomplete); if (options.maxLength !== undefined) input.maxLength = options.maxLength;
    input.required = Boolean(options.required); input.disabled = Boolean(options.disabled); input.readOnly = Boolean(options.readOnly);
    const listeners = new Set<(value: string) => void>();
    const api: FieldControl<string> = { element, input, get value() { return input.value; }, setValue(value, shouldNotify = false) { input.value = value; element.dataset.formValue = value; if (shouldNotify) notify(element, listeners, value); }, onChange(callback) { listeners.add(callback); }, setDisabled(disabled) { input.disabled = disabled; element.classList.toggle('is-disabled', disabled); }, setError(message) { errorState(element, input, message); }, focus() { input.focus(); } };
    input.addEventListener('input', () => { element.dataset.formValue = input.value; listeners.forEach((listener) => listener(input.value)); });
    element.appendChild(input);
    if (options.clearable) { const clear = createIconButton({ icon: 'close', label: 'Clear value', title: 'Clear', variant: 'control', className: 'ui-field-affordance' }); clear.addEventListener('click', () => api.setValue('', true)); element.appendChild(clear); }
    element.dataset.formValue = input.value; return api;
}

export function createPasswordField(options: Omit<TextFieldOptions, 'type'> = {}): FieldControl<string> {
    const field = createTextField({ ...options, type: 'text', clearable: false }); const input = field.input as HTMLInputElement; input.type = 'password';
    const reveal = createIconButton({ icon: 'eye', label: 'Show password', variant: 'control', className: 'ui-field-affordance ui-password-toggle' });
    reveal.addEventListener('click', () => { const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; reveal.title = visible ? 'Show password' : 'Hide password'; reveal.setAttribute('aria-label', reveal.title); }); field.element.appendChild(reveal); return field;
}

export interface NumberFieldOptions { value?: number | null; min?: number; max?: number; step?: number; placeholder?: string; required?: boolean; disabled?: boolean; compact?: boolean; size?: FieldSize; }
export function createNumberField(options: NumberFieldOptions = {}): FieldControl<number | null> {
    const element = document.createElement('div'); element.className = `ui-field ui-number-field${options.compact ? ' is-compact' : ''}`;
    applyFieldSize(element, options.size);
    const input = document.createElement('input'); input.className = 'ui-field-input'; input.type = 'number'; input.value = options.value === null || options.value === undefined ? '' : String(options.value); input.placeholder = options.placeholder ?? '';
    if (options.min !== undefined) input.min = String(options.min); if (options.max !== undefined) input.max = String(options.max); if (options.step !== undefined) input.step = String(options.step); input.required = Boolean(options.required); input.disabled = Boolean(options.disabled);
    const listeners = new Set<(value: number | null) => void>(); const value = (): number | null => input.value === '' ? null : Number(input.value);
    const api: FieldControl<number | null> = { element, input, get value() { return value(); }, setValue(next, shouldNotify = false) { input.value = next === null ? '' : String(next); element.dataset.formValue = input.value; if (shouldNotify) notify(element, listeners, value()); }, onChange(callback) { listeners.add(callback); }, setDisabled(disabled) { input.disabled = disabled; element.classList.toggle('is-disabled', disabled); }, setError(message) { errorState(element, input, message); }, focus() { input.focus(); } };
    input.addEventListener('input', () => { element.dataset.formValue = input.value; listeners.forEach((listener) => listener(value())); }); element.appendChild(input); element.dataset.formValue = input.value; return api;
}

export function createDateField(type: DateFieldType, options: Omit<TextFieldOptions, 'type' | 'clearable'> = {}): FieldControl<string> {
    const formats: Record<DateFieldType, string> = { date: 'YYYY-MM-DD', 'datetime-local': 'YYYY-MM-DD HH:mm', month: 'YYYY-MM', time: 'HH:mm', week: 'YYYY-Www' };
    const patterns: Record<DateFieldType, string> = { date: '\\d{4}-\\d{2}-\\d{2}', 'datetime-local': '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}', month: '\\d{4}-\\d{2}', time: '\\d{2}:\\d{2}', week: '\\d{4}-W\\d{2}' };
    const field = createTextField({ ...options, type: 'text', placeholder: options.placeholder ?? formats[type], maxLength: options.maxLength ?? formats[type].length }); const input = field.input as HTMLInputElement; input.inputMode = 'numeric'; input.pattern = patterns[type]; input.dataset.dateType = type; input.setAttribute('aria-label', `${type} (${formats[type]})`); field.element.classList.add('ui-date-field'); return field;
}

function rgbToHsv(hex: string): { h: number; s: number; v: number } {
    const value = hex.replace('#', ''); const r = parseInt(value.slice(0, 2), 16) / 255; const g = parseInt(value.slice(2, 4), 16) / 255; const b = parseInt(value.slice(4, 6), 16) / 255; const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
    const h = delta === 0 ? 0 : max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4); return { h: h < 0 ? h + 360 : h, s: max === 0 ? 0 : delta / max, v: max };
}
function hsvToHex(h: number, s: number, v: number): string {
    const c = v * s; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = v - c; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function createColorField(initial = '#ffffff', size?: FieldSize): FieldControl<string> {
    const normalized = /^#[0-9a-f]{6}$/i.test(initial) ? initial.toLowerCase() : '#ffffff'; const element = document.createElement('div'); element.className = 'ui-field ui-color-field'; const input = document.createElement('input'); input.type = 'hidden'; input.value = normalized;
    applyFieldSize(element, size);
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ui-control-button ui-color-trigger'; trigger.setAttribute('aria-label', 'Choose color'); trigger.setAttribute('aria-haspopup', 'dialog'); const swatch = document.createElement('span'); swatch.className = 'ui-color-swatch'; trigger.appendChild(swatch);
    const picker = document.createElement('div'); picker.className = 'ui-color-popover-content'; const saturation = document.createElement('div'); saturation.className = 'ui-color-saturation'; const saturationThumb = document.createElement('span'); saturationThumb.className = 'ui-color-saturation-thumb'; saturation.appendChild(saturationThumb);
    const hue = document.createElement('input'); hue.type = 'range'; hue.min = '0'; hue.max = '360'; hue.step = '1'; hue.className = 'ui-color-hue'; hue.setAttribute('aria-label', 'Hue'); const footer = document.createElement('div'); footer.className = 'ui-color-footer'; const preview = document.createElement('span'); preview.className = 'ui-color-preview'; const hex = document.createElement('input'); hex.type = 'text'; hex.className = 'ui-color-hex'; hex.maxLength = 7; hex.setAttribute('aria-label', 'Hex color'); footer.append(preview, hex); picker.append(saturation, hue, footer);
    const listeners = new Set<(value: string) => void>(); let hsv = rgbToHsv(normalized); const popover = createPopover({ trigger, content: picker, className: 'ui-color-popover', onOpen: () => hex.focus() });
    const render = (): void => { swatch.style.background = input.value; preview.style.background = input.value; hex.value = input.value.toUpperCase(); hue.value = String(Math.round(hsv.h)); saturation.style.setProperty('--picker-hue', `hsl(${hsv.h} 100% 50%)`); saturationThumb.style.left = `${hsv.s * 100}%`; saturationThumb.style.top = `${(1 - hsv.v) * 100}%`; element.dataset.formValue = input.value; };
    const set = (next: string, shouldNotify = false): void => { if (!/^#[0-9a-f]{6}$/i.test(next)) return; input.value = next.toLowerCase(); hsv = rgbToHsv(input.value); render(); if (shouldNotify) notify(element, listeners, input.value); };
    const updateFromHsv = (): void => { input.value = hsvToHex(hsv.h, hsv.s, hsv.v); render(); notify(element, listeners, input.value); };
    const setSaturation = (event: PointerEvent): void => { const rect = saturation.getBoundingClientRect(); hsv.s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); hsv.v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)); updateFromHsv(); };
    saturation.addEventListener('pointerdown', (event) => { saturation.setPointerCapture(event.pointerId); setSaturation(event); }); saturation.addEventListener('pointermove', (event) => { if (saturation.hasPointerCapture(event.pointerId)) setSaturation(event); });
    hue.addEventListener('input', () => { hsv.h = Number(hue.value); updateFromHsv(); }); hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) set(hex.value, true); });
    const api: FieldControl<string> = { element, input, get value() { return input.value; }, setValue(next, shouldNotify = false) { set(next, shouldNotify); }, onChange(callback) { listeners.add(callback); }, setDisabled(disabled) { trigger.disabled = disabled; element.classList.toggle('is-disabled', disabled); if (disabled) popover.hide(); }, setError(message) { errorState(element, trigger, message); }, focus() { trigger.focus(); } };
    element.append(input, trigger); render(); return api;
}

export type GradientType = 'linear' | 'radial' | 'conic';
export interface GradientValue { type: GradientType; colors: string[]; angle: number; centerX: number; centerY: number; shape: 'circle' | 'ellipse'; }
export interface GradientFieldControl extends ValueControl<GradientValue> { element: HTMLDivElement; }
let gradientPerformanceSequence = 0;
export function gradientCss(value: GradientValue): string {
    const stops = value.colors.join(', '); return value.type === 'radial' ? `radial-gradient(${value.shape} at ${value.centerX}% ${value.centerY}%, ${stops})` : value.type === 'conic' ? `conic-gradient(from ${value.angle}deg at ${value.centerX}% ${value.centerY}%, ${stops})` : `linear-gradient(${value.angle}deg, ${stops})`;
}

export function createGradientField(initial: Partial<GradientValue> = {}, size?: FieldSize): GradientFieldControl {
    const debugId = ++gradientPerformanceSequence; const debugPrefix = `[gradient-performance:${debugId}]`;
    const clone = (source: GradientValue): GradientValue => ({ ...source, colors: [...source.colors] });
    const normalize = (source: Partial<GradientValue>): GradientValue => {
        const colors = source.colors?.slice(0, 3) ?? ['#10141c', '#3a6ea5'];
        if (colors.length < 2) colors.push('#3a6ea5');
        return { type: source.type ?? 'linear', colors, angle: source.angle ?? 180, centerX: source.centerX ?? 50, centerY: source.centerY ?? 50, shape: source.shape ?? 'circle' };
    };
    const element = document.createElement('div'); element.className = 'ui-gradient-field';
    applyFieldSize(element, size);
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ui-control-button ui-gradient-trigger'; trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-label', 'Edit gradient');
    const preview = document.createElement('span'); preview.className = 'ui-gradient-preview'; trigger.appendChild(preview);
    let value = normalize(initial); let draft = clone(value);
    const content = document.createElement('div'); content.className = 'ui-gradient-popover-content';
    const type = createSegmentedField([{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Circle' }, { value: 'conic', label: 'Conic' }]);
    const count = createSegmentedField([{ value: '2', label: '2 colors' }, { value: '3', label: '3 colors' }]);
    const colorRow = document.createElement('div'); colorRow.className = 'ui-gradient-colors'; const colorArrows: HTMLSpanElement[] = [];
    const colorFields = [createColorField(draft.colors[0]), createColorField(draft.colors[1]), createColorField(draft.colors[2] ?? '#7c5cff')];
    colorFields.forEach((field, index) => { if (index) { const arrow = document.createElement('span'); arrow.textContent = '→'; arrow.className = 'gradient-color-picker-arrow'; colorArrows.push(arrow); colorRow.appendChild(arrow); } colorRow.appendChild(field.element); });
    const angle = createNumberField({ value: draft.angle, min: 0, max: 360, compact: true });
    const centerX = createNumberField({ value: draft.centerX, min: 0, max: 100, compact: true });
    const centerY = createNumberField({ value: draft.centerY, min: 0, max: 100, compact: true });
    const shape = createSegmentedField([{ value: 'circle', label: 'Circle' }, { value: 'ellipse', label: 'Ellipse' }]);
    const row = (label: string, control: HTMLElement): HTMLDivElement => { const item = document.createElement('div'); item.className = 'ui-gradient-config-row'; const text = document.createElement('span'); text.textContent = label; item.append(text, control); return item; };
    const angleRow = row('Angle (°)', angle.element); const shapeRow = row('Shape', shape.element);
    const center = document.createElement('div'); center.className = 'ui-gradient-center'; center.append(row('Center X (%)', centerX.element), row('Center Y (%)', centerY.element));
    const configuration = document.createElement('div'); configuration.className = 'ui-gradient-configuration'; configuration.append(row('Type', type.element), row('Stops', count.element), row('Colors', colorRow), angleRow, shapeRow, center);
    const livePreview = document.createElement('div'); livePreview.className = 'ui-gradient-live-preview'; const previewLabel = document.createElement('span'); previewLabel.textContent = 'Preview'; const previewCanvas = document.createElement('div'); previewCanvas.className = 'ui-gradient-live-preview-canvas'; livePreview.append(previewLabel, previewCanvas);
    const actions = document.createElement('div'); actions.className = 'ui-gradient-actions';
    const cancelButton = createButton({ label: 'Cancel', className: 'btn-secondary', symbol: 'close' });
    const applyButton = createButton({ label: 'Apply', className: 'btn-primary', symbol: 'check' }); actions.append(cancelButton, applyButton);
    content.append(configuration, livePreview, actions);
    const listeners = new Set<(value: GradientValue) => void>();
    let previewFrame = 0; let previewScheduledAt = 0; let previewReason = ''; let longTaskObserver: PerformanceObserver | undefined;
    const renderDraftVisibility = (): void => { colorFields[2].element.hidden = draft.colors.length < 3; colorArrows[1].hidden = draft.colors.length < 3; angleRow.hidden = draft.type === 'radial'; shapeRow.hidden = draft.type !== 'radial'; center.hidden = draft.type === 'linear'; };
    const renderDraftPreview = (): void => { const frameStarted = performance.now(); const scheduledAt = previewScheduledAt; const reason = previewReason; previewFrame = 0; previewScheduledAt = 0; previewReason = ''; previewCanvas.style.background = gradientCss(draft); const styleApplied = performance.now(); console.info(debugPrefix, 'preview-style', { reason, frameWaitMs: Number((frameStarted - scheduledAt).toFixed(2)), styleMs: Number((styleApplied - frameStarted).toFixed(2)), type: draft.type, stops: draft.colors.length, canvas: `${previewCanvas.clientWidth}x${previewCanvas.clientHeight}` }); requestAnimationFrame(() => console.info(debugPrefix, 'next-frame', { reason, totalMs: Number((performance.now() - scheduledAt).toFixed(2)) })); };
    const scheduleDraftPreview = (reason: string, interactionStarted = performance.now()): void => { previewReason = previewReason ? `${previewReason},${reason}` : reason; if (!previewFrame) { previewScheduledAt = interactionStarted; previewFrame = requestAnimationFrame(renderDraftPreview); } };
    const renderDraft = (): void => { const started = performance.now(); if (previewFrame) { cancelAnimationFrame(previewFrame); previewFrame = 0; } type.setValue(draft.type); count.setValue(String(draft.colors.length)); angle.setValue(draft.angle); centerX.setValue(draft.centerX); centerY.setValue(draft.centerY); shape.setValue(draft.shape); colorFields.forEach((field, index) => field.setValue(draft.colors[index] ?? '#7c5cff')); renderDraftVisibility(); previewScheduledAt = started; previewReason = 'full-render'; renderDraftPreview(); console.info(debugPrefix, 'full-render', { durationMs: Number((performance.now() - started).toFixed(2)), type: draft.type, stops: draft.colors.length }); };
    const renderValue = (): void => { preview.style.background = gradientCss(value); element.dataset.formValue = JSON.stringify(value); };
    const logGeometry = (): void => { const measure = (target: Element): { left: number; right: number; width: number } => { const rect = target.getBoundingClientRect(); return { left: Number(rect.left.toFixed(1)), right: Number(rect.right.toFixed(1)), width: Number(rect.width.toFixed(1)) }; }; const rows = Array.from(center.children); const inputs = [centerX.input, centerY.input]; console.info(debugPrefix, 'geometry', { popover: measure(content), configuration: measure(configuration), preview: measure(livePreview), center: measure(center), rows: rows.map(measure), inputs: inputs.map(measure), overflow: inputs.map((input, index) => Number((input.getBoundingClientRect().right - rows[index].getBoundingClientRect().right).toFixed(1))), devicePixelRatio: window.devicePixelRatio }); };
    const popover = createPopover({ trigger, content, className: 'ui-gradient-popover', onOpen: () => { const started = performance.now(); if (PerformanceObserver.supportedEntryTypes.includes('longtask')) { longTaskObserver = new PerformanceObserver((list) => list.getEntries().forEach((entry) => console.warn(debugPrefix, 'long-task', { startMs: Number(entry.startTime.toFixed(2)), durationMs: Number(entry.duration.toFixed(2)), name: entry.name }))); longTaskObserver.observe({ entryTypes: ['longtask'] }); } draft = clone(value); renderDraft(); requestAnimationFrame(logGeometry); console.info(debugPrefix, 'popover-open', { durationMs: Number((performance.now() - started).toFixed(2)), userAgent: navigator.userAgent }); }, onClose: () => { draft = clone(value); longTaskObserver?.disconnect(); longTaskObserver = undefined; if (previewFrame) cancelAnimationFrame(previewFrame); previewFrame = 0; previewScheduledAt = 0; previewReason = ''; console.info(debugPrefix, 'popover-close'); } });
    type.onChange((next) => { const started = performance.now(); draft.type = next as GradientType; renderDraftVisibility(); console.info(debugPrefix, 'interaction', { control: 'type', value: next, syncMs: Number((performance.now() - started).toFixed(2)) }); scheduleDraftPreview(`type:${next}`, started); });
    count.onChange((next) => { const started = performance.now(); const size = Number(next); draft.colors = size === 3 ? [draft.colors[0], draft.colors[1], draft.colors[2] ?? '#7c5cff'] : draft.colors.slice(0, 2); if (size === 3) colorFields[2].setValue(draft.colors[2]); renderDraftVisibility(); console.info(debugPrefix, 'interaction', { control: 'stops', value: size, syncMs: Number((performance.now() - started).toFixed(2)) }); scheduleDraftPreview(`stops:${size}`, started); });
    angle.onChange((next) => { if (next !== null) { draft.angle = next; scheduleDraftPreview('angle'); } });
    centerX.onChange((next) => { if (next !== null) { draft.centerX = next; scheduleDraftPreview('center-x'); } });
    centerY.onChange((next) => { if (next !== null) { draft.centerY = next; scheduleDraftPreview('center-y'); } });
    shape.onChange((next) => { draft.shape = next as GradientValue['shape']; scheduleDraftPreview('shape'); });
    colorFields.forEach((field, index) => field.onChange((next) => { draft.colors[index] = next; scheduleDraftPreview(`color:${index}`); }));
    cancelButton.addEventListener('click', () => popover.hide());
    applyButton.addEventListener('click', () => { const changed = JSON.stringify(value) !== JSON.stringify(draft); value = clone(draft); renderValue(); popover.hide(); if (changed) { const snapshot = clone(value); listeners.forEach((listener) => listener(snapshot)); element.dispatchEvent(new Event('input', { bubbles: true })); } });
    const api: GradientFieldControl = { element, get value() { return clone(value); }, setValue(next, shouldNotify = false) { value = normalize(next); draft = clone(value); renderValue(); renderDraft(); if (shouldNotify) { const snapshot = clone(value); listeners.forEach((listener) => listener(snapshot)); element.dispatchEvent(new Event('input', { bubbles: true })); } }, onChange(callback) { listeners.add(callback); } };
    element.append(trigger); renderValue(); renderDraft(); return api;
}

export function createSelectField(items: DropdownItem[], size?: FieldSize): DropdownControl { return createDropdown(items, size); }
export function createSegmentedField(items: Array<{ value: string; label: string }>, size?: FieldSize): ValueControl<string> { return createSegmentedToggle(items, size); }
export function createRangeField(min: number, max: number, initial: number, suffix = '', size?: FieldSize): RangeControl { return createRangeControl(min, max, initial, suffix, size); }

export interface TextAreaFieldOptions { value?: string; placeholder?: string; rows?: number; autoGrow?: boolean; maxRows?: number; required?: boolean; disabled?: boolean; readOnly?: boolean; maxLength?: number; size?: FieldSize; }
export function createTextAreaField(options: TextAreaFieldOptions = {}): FieldControl<string> {
    const element = document.createElement('div'); element.className = 'ui-field ui-textarea-field'; const input = document.createElement('textarea'); input.className = 'ui-field-input'; input.value = options.value ?? ''; input.placeholder = options.placeholder ?? ''; input.rows = options.rows ?? 4; input.required = Boolean(options.required); input.disabled = Boolean(options.disabled); input.readOnly = Boolean(options.readOnly); if (options.maxLength !== undefined) input.maxLength = options.maxLength;
    applyFieldSize(element, options.size);
    const resize = (): void => { if (!options.autoGrow) return; const lines = Math.max(1, input.value.split('\n').length); const maxRows = Math.max(1, options.maxRows ?? 3); input.rows = Math.min(lines, maxRows); input.style.overflowY = lines > maxRows ? 'auto' : 'hidden'; };
    if (options.autoGrow) element.classList.add('is-auto-grow');
    const listeners = new Set<(value: string) => void>(); const api: FieldControl<string> = { element, input, get value() { return input.value; }, setValue(value, shouldNotify = false) { input.value = value; resize(); element.dataset.formValue = value; if (shouldNotify) notify(element, listeners, value); }, onChange(callback) { listeners.add(callback); }, setDisabled(disabled) { input.disabled = disabled; element.classList.toggle('is-disabled', disabled); }, setError(message) { errorState(element, input, message); }, focus() { input.focus(); } };
    input.addEventListener('input', () => { resize(); element.dataset.formValue = input.value; listeners.forEach((listener) => listener(input.value)); }); element.appendChild(input); resize(); element.dataset.formValue = input.value; return api;
}

export interface BooleanFieldControl extends ValueControl<boolean> { element: HTMLLabelElement; input: HTMLInputElement; setDisabled(disabled: boolean): void; }
function createBooleanField(labelText: string, value: boolean, variant: 'checkbox' | 'switch', size?: FieldSize): BooleanFieldControl {
    const element = document.createElement('label'); element.className = `ui-boolean-field ui-${variant}-field`; const input = document.createElement('input'); input.type = 'checkbox'; input.checked = value; const visual = document.createElement('span'); visual.className = 'ui-boolean-control'; const label = document.createElement('span'); label.className = 'ui-boolean-label'; label.textContent = labelText; const listeners = new Set<(value: boolean) => void>();
    applyFieldSize(element, size);
    const api: BooleanFieldControl = { element, input, get value() { return input.checked; }, setValue(next, shouldNotify = false) { input.checked = next; element.dataset.formValue = String(next); if (shouldNotify) notify(element, listeners, next, 'change'); }, onChange(callback) { listeners.add(callback); }, setDisabled(disabled) { input.disabled = disabled; element.classList.toggle('is-disabled', disabled); } };
    input.addEventListener('change', () => { element.dataset.formValue = String(input.checked); listeners.forEach((listener) => listener(input.checked)); }); element.append(input, visual, label); element.dataset.formValue = String(value); return api;
}
export function createCheckboxField(label: string, value = false, size?: FieldSize): BooleanFieldControl { return createBooleanField(label, value, 'checkbox', size); }
export function createSwitchField(label: string, value = false, size?: FieldSize): BooleanFieldControl { return createBooleanField(label, value, 'switch', size); }

export function createRadioGroup(items: Array<{ value: string; label: string }>, initial?: string, size?: FieldSize): ValueControl<string> {
    const element = document.createElement('div'); element.className = 'ui-radio-group'; const name = `radio-${Math.random().toString(36).slice(2)}`; const listeners = new Set<(value: string) => void>(); let value = initial ?? items[0]?.value ?? '';
    applyFieldSize(element, size);
    const inputs = items.map((item) => { const label = document.createElement('label'); label.className = 'ui-radio-field'; const input = document.createElement('input'); input.type = 'radio'; input.name = name; input.value = item.value; const visual = document.createElement('span'); visual.className = 'ui-radio-control'; const text = document.createElement('span'); text.textContent = item.label; label.append(input, visual, text); element.appendChild(label); return input; });
    const api: ValueControl<string> = { element, get value() { return value; }, setValue(next, shouldNotify = false) { if (!items.some((item) => item.value === next)) return; value = next; inputs.forEach((input) => { input.checked = input.value === value; }); element.dataset.formValue = value; if (shouldNotify) notify(element, listeners, value, 'change'); }, onChange(callback) { listeners.add(callback); } };
    inputs.forEach((input) => input.addEventListener('change', () => { if (input.checked) { value = input.value; element.dataset.formValue = value; listeners.forEach((listener) => listener(value)); } })); api.setValue(value); return api;
}

export interface FileFieldOptions { value?: string; placeholder?: string; accept?: string; choose(): Promise<string | null>; clear?(): void | Promise<void>; size?: FieldSize; preview?: 'image'; formatValue?(value: string): string; previewUrl?(value: string): string; }
export interface FileFieldControl extends ValueControl<string> { element: HTMLDivElement; setDisabled(disabled: boolean): void; }
export function createFileField(options: FileFieldOptions): FileFieldControl {
    const element = document.createElement('div'); element.className = 'ui-file-field'; const display = createTextField({ placeholder: options.placeholder ?? 'No file selected', readOnly: true, clearable: true }); const choose = createButton({ label: 'Browse', className: 'ui-file-choose btn-secondary', symbol: 'folder' }); const listeners = new Set<(value: string) => void>(); let value = options.value ?? '';
    applyFieldSize(element, options.size);
    const preview = options.preview === 'image' ? document.createElement('img') : undefined;
    if (preview) { preview.className = 'ui-file-preview'; preview.alt = ''; preview.setAttribute('aria-hidden', 'true'); display.element.prepend(preview); display.element.classList.add('has-file-preview'); }
    const fileUrl = (source: string): string => { if (/^(?:data:|blob:|https?:|file:)/i.test(source)) return source; const normalized = source.replaceAll('\\', '/'); return encodeURI(`file://${normalized.startsWith('/') ? '' : '/'}${normalized}`); };
    const render = (): void => { display.setValue(value ? options.formatValue?.(value) ?? value.split(/[\\/]/).pop() ?? value : ''); if (preview) { preview.hidden = !value; if (value) preview.src = options.previewUrl?.(value) ?? fileUrl(value); else preview.removeAttribute('src'); } };
    const api: FileFieldControl = { element, get value() { return value; }, setValue(next, shouldNotify = false) { value = next; render(); element.dataset.formValue = next; if (shouldNotify) notify(element, listeners, next, 'change'); }, onChange(callback) { listeners.add(callback); }, setDisabled(disabled) { display.setDisabled(disabled); choose.disabled = disabled; element.classList.toggle('is-disabled', disabled); } };
    choose.addEventListener('click', async () => { const selected = await options.choose(); if (selected) api.setValue(selected, true); }); display.onChange(async (next) => { if (!next) await options.clear?.(); api.setValue(next, true); }); element.append(display.element, choose); render(); element.dataset.formValue = value; return api;
}

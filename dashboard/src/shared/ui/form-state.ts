import { setButtonLoading } from './fields';

export interface ValidationIssue { element?: HTMLElement; message: string; }
export interface FormState { dirty: boolean; valid: boolean; saving: boolean; issues: ValidationIssue[]; }

interface FormControllerOptions<T> {
    read(): T;
    validate?(value: T): ValidationIssue[];
    save(value: T): Promise<void>;
    saveButton?: HTMLButtonElement;
    onStateChange?(state: FormState): void;
}
function fingerprint(value: unknown): string { return JSON.stringify(value); }
const saveControllers = new Map<HTMLButtonElement, () => void>();
let saveShortcutRegistered = false;

function registerSaveShortcut(): void {
    if (saveShortcutRegistered) return; saveShortcutRegistered = true;
    document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() !== 's' || (!event.metaKey && !event.ctrlKey) || event.altKey) return;
        for (const [button, submit] of Array.from(saveControllers).reverse()) {
            if (!button.isConnected) { saveControllers.delete(button); continue; }
            event.preventDefault(); submit(); return;
        }
    });
}

export function readFormSnapshot(root: ParentNode): string[] {
    return Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLElement>('input, select, textarea, [data-form-value]')).map((element) => {
        if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) return String(element.checked);
        if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return element.value;
        return element.dataset.formValue ?? '';
    });
}

export interface FormController<T> {
    readonly state: FormState;
    changed(): void;
    submit(): Promise<void>;
    acceptCurrent(): void;
}

export function createFormController<T>(options: FormControllerOptions<T>): FormController<T> {
    let baseline = fingerprint(options.read()); let saving = false;
    let state: FormState = { dirty: false, valid: true, saving: false, issues: [] };
    const marked = new Set<HTMLElement>();
    const update = (): void => {
        const value = options.read(); const issues = options.validate?.(value) ?? [];
        marked.forEach((element) => { element.removeAttribute('aria-invalid'); element.removeAttribute('data-validation-message'); }); marked.clear();
        issues.forEach((issue) => { if (!issue.element) return; issue.element.setAttribute('aria-invalid', 'true'); issue.element.dataset.validationMessage = issue.message; marked.add(issue.element); });
        state = { dirty: fingerprint(value) !== baseline, valid: issues.length === 0, saving, issues };
        if (options.saveButton) { options.saveButton.disabled = saving || !state.dirty || !state.valid; setButtonLoading(options.saveButton, saving); options.saveButton.title = issues[0]?.message ?? ''; } options.onStateChange?.(state);
    };
    const controller: FormController<T> = {
        get state() { return state; },
        changed: update,
        acceptCurrent() { baseline = fingerprint(options.read()); update(); },
        async submit() {
            update(); if (!state.dirty || !state.valid || saving) return;
            saving = true; update();
            try { await options.save(options.read()); baseline = fingerprint(options.read()); }
            catch { /* The route owns user-facing error reporting. */ }
            finally { saving = false; update(); }
        },
    };
    if (options.saveButton) { options.saveButton.addEventListener('click', () => void controller.submit()); options.saveButton.setAttribute('aria-keyshortcuts', 'Meta+S Control+S'); saveControllers.set(options.saveButton, () => void controller.submit()); registerSaveShortcut(); } update(); return controller;
}

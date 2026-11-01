export interface TextFormatValue { bold: boolean; italic: boolean; underline: boolean; }
export interface TextFormatToolbar { element: HTMLDivElement; setValue(value: TextFormatValue): void; }

/** Compact, reusable rich-text style toggles for panel forms and popovers. */
export function createTextFormatToolbar(initial: TextFormatValue, onChange: (value: TextFormatValue) => void): TextFormatToolbar {
    let value = { ...initial }; const element = document.createElement('div'); element.className = 'ui-text-format-toolbar'; element.setAttribute('role', 'group'); element.setAttribute('aria-label', 'Text formatting');
    const definitions: Array<[keyof TextFormatValue, string, string]> = [['bold', 'Bold', 'Bold'], ['italic', 'Italic', 'Italic'], ['underline', 'Underline', 'Underline']];
    const buttons = definitions.map(([key, copy, label]) => { const button = document.createElement('button'); button.type = 'button'; button.className = `ui-text-format-button is-${key}`; button.textContent = copy; button.title = label; button.setAttribute('aria-label', label); button.addEventListener('click', () => { value = { ...value, [key]: !value[key] }; render(); onChange({ ...value }); }); element.appendChild(button); return button; });
    const render = (): void => definitions.forEach(([key], index) => { buttons[index].classList.toggle('active', value[key]); buttons[index].setAttribute('aria-pressed', String(value[key])); });
    render(); return { element, setValue(next) { value = { ...next }; render(); } };
}

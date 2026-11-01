export interface TabItem<T extends string> { id: T; label: string; panel: HTMLElement; }
export interface TabsControl<T extends string> { element: HTMLDivElement; readonly value: T; select(value: T, notify?: boolean): void; }

export function createTabs<T extends string>(items: Array<TabItem<T>>, initial: T, onChange?: (value: T) => void): TabsControl<T> {
    const element = document.createElement('div'); element.className = 'ui-tabs'; element.role = 'tablist';
    const buttons = items.map((item) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-control-button ui-tab'; button.role = 'tab'; button.textContent = item.label; button.dataset.tab = item.id; element.appendChild(button); return button; });
    let value = initial;
    const control: TabsControl<T> = { element, get value() { return value; }, select(next, notify = false) { if (!items.some((item) => item.id === next)) return; value = next; items.forEach((item, index) => { const active = item.id === value; item.panel.hidden = !active; buttons[index].classList.toggle('active', active); buttons[index].setAttribute('aria-selected', String(active)); }); if (notify) onChange?.(value); } };
    buttons.forEach((button) => button.addEventListener('click', () => control.select(button.dataset.tab as T, true))); control.select(initial); return control;
}

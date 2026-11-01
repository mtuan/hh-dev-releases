export interface ActionListItemOptions {
    title: string;
    meta?: string;
    trailing?: HTMLElement;
    actions?: HTMLElement;
    tagName?: 'div' | 'li';
    selected?: boolean;
    highlighted?: boolean;
    onActivate?: () => void;
    className?: string;
}

export interface ActionListItemControl {
    element: HTMLElement;
    button: HTMLButtonElement;
    setSelected(selected: boolean): void;
    setHighlighted(highlighted: boolean): void;
}

export function createActionList(className?: string): HTMLDivElement {
    const element = document.createElement('div');
    element.className = `ui-action-list${className ? ` ${className}` : ''}`;
    return element;
}

export function createActionListItem(options: ActionListItemOptions): ActionListItemControl {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ui-control-button ui-action-list-item${options.className ? ` ${options.className}` : ''}`;
    const copy = document.createElement('span'); copy.className = 'ui-action-list-copy';
    const title = document.createElement('strong'); title.className = 'ui-action-list-title'; title.textContent = options.title; copy.appendChild(title);
    if (options.meta) { const meta = document.createElement('span'); meta.className = 'ui-action-list-meta'; meta.textContent = options.meta; copy.appendChild(meta); }
    button.appendChild(copy); if (options.trailing) { options.trailing.classList.add('ui-action-list-trailing'); button.appendChild(options.trailing); }
    const element = options.actions ? document.createElement(options.tagName ?? 'div') : button;
    if (options.actions) { element.className = 'ui-action-list-row'; options.actions.classList.add('ui-action-list-actions'); element.append(button, options.actions); }
    const setSelected = (selected: boolean): void => { button.classList.toggle('is-selected', selected); button.setAttribute('aria-current', selected ? 'true' : 'false'); };
    const setHighlighted = (highlighted: boolean): void => { button.classList.toggle('is-highlighted', highlighted); };
    setSelected(options.selected ?? false); setHighlighted(options.highlighted ?? false);
    if (options.onActivate) button.addEventListener('click', options.onActivate);
    return { element, button, setSelected, setHighlighted };
}

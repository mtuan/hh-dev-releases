import { createIconButton } from './icon-button';
import { bindCopyAction } from './copy-action';

export interface CopyValueItem { label: string; value: string; copyValue?: string; }

/** Compact one-value-per-row reference list for setup guides and generated values. */
export function createCopyValueList(items: CopyValueItem[]): HTMLElement {
    const list = document.createElement('dl');
    list.className = 'ui-copy-value-list';
    items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'ui-copy-value-row';
        const label = document.createElement('dt');
        label.textContent = item.label;
        const value = document.createElement('dd');
        const code = document.createElement('code');
        code.textContent = item.value;
        const copy = createIconButton({ icon: 'copy', label: `Copy ${item.label}`, variant: 'ghost', size: 'sm' });
        bindCopyAction(copy, item.copyValue ?? item.value);
        value.append(code, copy);
        row.append(label, value);
        list.appendChild(row);
    });
    return list;
}

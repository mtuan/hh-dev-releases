import { createCopyValueList, type CopyValueItem } from './copy-value-list';
import { createExternalLink } from './external-link';

export interface SetupGuideStep {
    title: string;
    description?: string;
    link?: { label: string; url: string };
    values?: CopyValueItem[];
    note?: string;
}

/** A short, actionable setup sequence with direct links and copyable values per step. */
export function createSetupGuide(steps: SetupGuideStep[]): HTMLElement {
    const list = document.createElement('ol');
    list.className = 'ui-setup-guide';
    steps.forEach((step) => {
        const item = document.createElement('li');
        item.className = 'ui-setup-guide-step';
        const header = document.createElement('div');
        header.className = 'ui-setup-guide-step-header';
        const title = document.createElement('h3');
        title.textContent = step.title;
        header.appendChild(title);
        item.appendChild(header);
        if (step.description) { const description = document.createElement('p'); description.textContent = step.description; item.appendChild(description); }
        if (step.link) { const open = document.createElement('div'); open.className = 'ui-setup-guide-open'; const label = document.createElement('span'); label.textContent = 'Open:'; open.append(label, createExternalLink(step.link)); item.appendChild(open); }
        if (step.values?.length) { const label = document.createElement('div'); label.className = 'ui-setup-guide-values-label'; label.textContent = 'Enter values:'; item.append(label, createCopyValueList(step.values)); }
        if (step.note) { const note = document.createElement('p'); note.className = 'ui-setup-guide-note'; note.textContent = step.note; item.appendChild(note); }
        list.appendChild(item);
    });
    return list;
}

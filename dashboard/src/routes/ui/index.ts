import { renderPageHeader } from '../../shared/ui/page-header';
import { createButton, createCheckboxField, createColorField, createDateField, createDisclosureField, createFieldLayout, createFileField, createGradientField, createNumberField, createPasswordField, createRadioGroup, createRangeField, createSegmentedField, createSelectField, createSwitchField, createTextAreaField, createTextField, setButtonLoading, type ButtonSymbol } from '../../shared/ui/fields';
import { createPopover } from '../../shared/ui/popover';
import { showModal } from '../../shared/ui/modal';
import { createDynamicForm } from '../../shared/ui/dynamic-form';
import { createIconButton } from '../../shared/ui/icon-button';
import { createContentPanel } from '../../shared/ui/content-panel';
import { createSettingsControl, createSettingsPanel } from '../../shared/ui/settings-panel';
import { createJobNotifications } from '../../shared/ui/job-notifications';
import { createCollapsibleSidebar } from '../../shared/ui/sidebar';
import { createActionList, createActionListItem } from '../../shared/ui/action-list';
import { createDataTable } from '../../shared/ui/data-table';
import { createLoadingState } from '../../shared/ui/loading-state';
import { createRouteAddress } from '../../shared/ui/route-address';
import { createImageGrid } from '../../shared/ui/image-grid';
import { createHelpSidebar } from '../../shared/ui/help-sidebar';
import { createSetupGuide } from '../../shared/ui/setup-guide';
import { bindCopyAction } from '../../shared/ui/copy-action';
import { createPanelHeaderAction } from '../../shared/ui/panel';
import { showErrorToast, showSuccessToast } from '../../shared/ui/toast';

interface Options { header: HTMLElement; content: HTMLElement; }

function demo(title: string, description?: string): HTMLDivElement {
    const item = document.createElement('div'); item.className = 'ui-showcase-item'; const heading = document.createElement('h3'); heading.textContent = title; item.appendChild(heading);
    if (description) { const copy = document.createElement('p'); copy.textContent = description; item.appendChild(copy); } return item;
}
function row(...elements: HTMLElement[]): HTMLDivElement { const value = document.createElement('div'); value.className = 'ui-showcase-row'; value.append(...elements); return value; }
function section(title: string, description: string): HTMLElement {
    const value = document.createElement('section'); value.className = 'ui-showcase-section'; const header = document.createElement('div'); header.className = 'ui-showcase-section-header'; const heading = document.createElement('h2'); heading.textContent = title; const copy = document.createElement('p'); copy.textContent = description; header.append(heading, copy); const grid = document.createElement('div'); grid.className = 'ui-showcase-grid'; value.append(header, grid); return value;
}
function grid(sectionElement: HTMLElement): HTMLDivElement { return sectionElement.querySelector<HTMLDivElement>('.ui-showcase-grid')!; }

export function renderUiShowcaseRoute(options: Options): void {
    renderPageHeader(options.header, { title: 'UI components', description: 'Reference implementations and supported states for the shared dashboard field system.' }); options.content.innerHTML = '';

    const theme = section('Theme and colors', 'Every page and component uses semantic tokens. Use the sun/moon control in the route bar to verify both modes.');
    const palette = demo('Semantic palette'); palette.append(row(...['bg', 'surface', 'surface-2', 'surface-3', 'border', 'text', 'text-muted', 'accent', 'accent-hover', 'accent-soft', 'on-accent', 'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'info-text', 'info-soft', 'route-bg', 'code-bg', 'code-text', 'link'].map((token) => { const chip = document.createElement('div'); chip.className = 'ui-token-chip'; chip.style.setProperty('--token-color', `var(--${token})`); const color = document.createElement('span'); const label = document.createElement('code'); label.textContent = `--${token}`; chip.append(color, label); return chip; }))); grid(theme).append(palette);

    const buttons = section('Buttons', 'Variants, sizes, symbols, disabled state, and layout-stable loading.');
    const variants = demo('Variants'); variants.append(row(createButton({ label: 'Primary action', className: 'btn-primary', symbol: 'play' }), createButton({ label: 'Secondary action', className: 'btn-secondary', symbol: 'folder' }), createButton({ label: 'Delete', className: 'btn-danger', symbol: 'trash' }), createButton({ label: 'Disabled', className: 'btn-secondary', disabled: true, symbol: 'action' })));
    const sizes = demo('Sizes'); sizes.append(row(createButton({ label: 'Small', className: 'btn-secondary', symbol: 'add', size: 'sm' }), createButton({ label: 'Default', className: 'btn-secondary', symbol: 'add', size: 'md' }), createButton({ label: 'Large', className: 'btn-secondary', symbol: 'add', size: 'lg' }), createButton({ label: 'Extra large', className: 'btn-secondary', symbol: 'add', size: 'xl' })));
    const loading = demo('Loading'); const loadingButton = createButton({ label: 'Save', className: 'btn-primary', symbol: 'save' }); setButtonLoading(loadingButton, true); loadingButton.disabled = true; loading.append(row(loadingButton, createButton({ label: 'Save', className: 'btn-primary', symbol: 'save' })));
    const iconButtons = demo('Icon buttons', 'Icon-only actions use the same size scale as text buttons. Ghost actions are transparent at rest.'); const copyButton = createIconButton({ icon: 'copy', label: 'Copy', size: 'sm' }); bindCopyAction(copyButton, 'Copied UI example'); iconButtons.append(row(copyButton, createIconButton({ icon: 'refresh', label: 'Refresh', size: 'md' }), createIconButton({ icon: 'sidebar', label: 'Collapse sidebar', variant: 'ghost', size: 'md' }), createIconButton({ icon: 'sun', label: 'Use light mode', size: 'lg' }), createIconButton({ icon: 'trash', label: 'Delete', className: 'btn-danger', size: 'xl' })));
    const symbols = demo('Symbol set'); const symbolNames: ButtonSymbol[] = ['save', 'check', 'add', 'trash', 'close', 'download', 'folder', 'play', 'copy', 'refresh', 'globe', 'lock', 'help', 'action']; symbols.append(row(...symbolNames.map((symbol) => createButton({ label: symbol, className: 'btn-secondary ui-button-sm', symbol })))); grid(buttons).append(variants, sizes, loading, iconButtons, symbols);

    const text = section('Text fields', 'Text-oriented inputs share height, focus, disabled, read-only, clear, and validation behavior.');
    const basic = demo('Text types'); basic.append(createFieldLayout('Text', createTextField({ value: 'Player one', clearable: true }).element, 'Clearable text field.').element, createFieldLayout('Email', createTextField({ type: 'email', placeholder: 'player@example.com' }).element).element, createFieldLayout('Search', createTextField({ type: 'search', placeholder: 'Search projects' }).element).element, createFieldLayout('URL', createTextField({ type: 'url', placeholder: 'https://example.com' }).element).element);
    const password = demo('Password'); password.append(createFieldLayout('Secret', createPasswordField({ value: 'secret-value', autocomplete: 'current-password' }).element, 'Use the eye affordance to reveal the value.').element);
    const states = demo('States'); const invalid = createTextField({ value: 'Invalid value' }); invalid.setError('This value is not accepted.'); states.append(createFieldLayout('Required', createTextField({ required: true, placeholder: 'Required value' }).element).element, createFieldLayout('Read only', createTextField({ value: 'Managed value', readOnly: true }).element).element, createFieldLayout('Disabled', createTextField({ value: 'Unavailable', disabled: true }).element).element, createFieldLayout('Invalid', invalid.element).element); grid(text).append(basic, password, states);
    const routeAddressDemo = demo('Route address', 'Enter commits navigation; Escape or focus loss restores the active route.'); const routeField = createTextField({ value: '/projects/example' }); const routeOutput = document.createElement('code'); routeOutput.textContent = '/projects/example'; const routeControl = createRouteAddress({ input: routeField.input as HTMLInputElement, onNavigate: (route) => { routeOutput.textContent = route; routeControl.setRoute(route); } }); routeAddressDemo.append(routeField.element, routeOutput); grid(text).append(routeAddressDemo);
    const fieldSizes = demo('Sizes', 'The global default is medium. A form or individual field can override it.'); fieldSizes.append(createFieldLayout('Small', createTextField({ value: '32px control', size: 'sm' }).element, undefined, 'sm').element, createFieldLayout('Medium', createTextField({ value: '40px control', size: 'md' }).element, undefined, 'md').element, createFieldLayout('Large', createTextField({ value: '48px control', size: 'lg' }).element, undefined, 'lg').element); grid(text).append(fieldSizes);

    const numeric = section('Numbers and dates', 'Numeric widths and native date/time modes use the same field shell.');
    const numbers = demo('Numbers'); numbers.append(createFieldLayout('Default number', createNumberField({ value: 42, min: 0, max: 100 }).element).element, createFieldLayout('Negative number', createNumberField({ value: -4, min: -24, max: 24 }).element, 'Intermediate minus input remains editable.').element, createFieldLayout('Compact number', createNumberField({ value: 18, min: 8, max: 96, compact: true }).element).element);
    const dates = demo('Date and time'); dates.append(createFieldLayout('Date', createDateField('date').element).element, createFieldLayout('Date and time', createDateField('datetime-local').element).element, createFieldLayout('Time', createDateField('time').element).element, createFieldLayout('Month', createDateField('month').element).element); grid(numeric).append(numbers, dates);

    const content = section('Content and assets', 'Long text, colors, and file selection use consistent focus and clear behavior.');
    const textarea = demo('Textarea'); textarea.append(createFieldLayout('Description', createTextAreaField({ value: 'A reusable multiline field.', rows: 4 }).element, 'Resizable vertically.').element, createFieldLayout('Compact auto-grow', createTextAreaField({ value: 'One line initially', rows: 1, autoGrow: true, maxRows: 3 }).element, 'Grows up to three visible lines, then scrolls.').element);
    const colors = demo('Color'); colors.append(row(createFieldLayout('Accent', createColorField('#3a6ea5').element).element, createFieldLayout('Danger', createColorField('#e5675f').element).element, createFieldLayout('Gradient', createGradientField({ type: 'linear', colors: ['#ff5fcf', '#7038ff'], angle: 145 }).element, 'Linear, circle, and conic gradients with two or three stops.').element));
    const sampleImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#7c5cff"/><circle cx="32" cy="26" r="12" fill="#fff"/><path d="M12 56 27 39l10 9 7-7 8 15" fill="#c9bbff"/></svg>');
    const files = demo('File'); files.append(createFieldLayout('Image', createFileField({ value: sampleImage, accept: 'image/*', preview: 'image', formatValue: () => 'loading.png', choose: async () => null }).element, 'Image files show a thumbnail; Browse and clear are owned by the shared component.').element); grid(content).append(textarea, colors, files);

    const choices = section('Choices', 'Single, boolean, segmented, and continuous selections expose the same value/change contract.');
    const select = demo('Dropdown and disclosure'); select.append(createSelectField([{ value: 'violet', label: 'Neon Nova', swatch: 'linear-gradient(135deg,#8a35ff,#17003d)' }, { value: 'ice', label: 'Ice Beam', swatch: 'linear-gradient(135deg,#00b8ff,#002a78)' }, { value: 'fire', label: 'Fireball', swatch: 'linear-gradient(135deg,#ff8a00,#9d004f)' }, { value: 'slime', label: 'Slime Rush', swatch: 'linear-gradient(135deg,#39ff88,#004f3a)' }, { value: 'coin', label: 'Coin Rush', swatch: 'linear-gradient(135deg,#ffd93d,#ff5a00)' }]).element, createDisclosureField('Configure font style', 'Titan One · 82px · Bold').element);
    const boolean = demo('Boolean'); boolean.append(createCheckboxField('Include debug symbols', true).element, createSwitchField('Enable loading screen', true).element);
    const radio = demo('Radio group'); radio.append(createRadioGroup([{ value: 'inherit', label: 'Inherit' }, { value: 'custom', label: 'Custom' }, { value: 'disabled', label: 'Disable' }], 'inherit').element);
    const segmented = demo('Segmented'); segmented.append(createSegmentedField([{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]).element);
    const range = demo('Range'); range.append(createRangeField(0, 100, 42, '%').element); grid(choices).append(select, boolean, radio, segmented, range);

    const panels = section('Panels', 'Every titled surface composes one shared compact-header panel shell. Parent stacks own the spacing between panels.');
    const contentPanelDemo = demo('Content panel');
    const arbitraryContent = document.createElement('p'); arbitraryContent.textContent = 'Arbitrary content uses the same title, surface, border, spacing, and theme contract.';
    const toolbarActions = document.createElement('div'); toolbarActions.className = 'ui-showcase-row'; toolbarActions.append(createIconButton({ icon: 'back', label: 'Back', variant: 'control', size: 'sm' }), createTextField({ value: 'Actions-only compact panel header', size: 'sm' }).element, createIconButton({ icon: 'play', label: 'Go', variant: 'control', size: 'sm' }));
    contentPanelDemo.append(createContentPanel({ title: 'Shared compact header', status: 'Ready', statusClass: 'badge-success', content: arbitraryContent }), createContentPanel({ title: 'Explicit spacious header', description: 'Use only when a page has a specific hierarchy reason.', content: document.createElement('div'), compactHeader: false }), createContentPanel({ content: document.createElement('div'), actions: toolbarActions, flush: true, collapsible: false }));
    const helpSidebarDemo = demo('Contextual help sidebar', 'Panel help actions toggle one shared right-side instruction surface.'); const helpSidebar = createHelpSidebar(); const helpCopy = createSetupGuide([{ title: 'Create a repository', link: { label: 'GitHub new repository', url: 'https://github.com/new' }, values: [{ label: 'Name', value: 'hh-dev-releases' }, { label: 'Branch', value: 'main' }] }]); const helpTrigger = createPanelHeaderAction('help', 'Show contextual help'); helpTrigger.addEventListener('click', () => { helpSidebar.toggle({ key: 'showcase', title: 'Configuration help', description: 'Complete each step in order.', content: helpCopy }); }); helpSidebarDemo.append(helpTrigger, helpSidebar.element);
    const settingsPanelDemo = demo('Settings panel');
    const settingsList = document.createElement('ul'); settingsList.className = 'settings-panel-list';
    settingsList.append(
        createSettingsPanel({
            title: 'Shared settings',
            rows: [
                { title: 'Name', actions: createSettingsControl(createTextField({ value: 'Loading screen' })) },
                { fields: [
                    { title: 'Width', actions: createSettingsControl(createNumberField({ value: 1080 })) },
                    { title: 'Height', actions: createSettingsControl(createNumberField({ value: 1920 })) },
                ] },
            ],
        }),
        createSettingsPanel({ title: 'Compact inline exception', layout: 'inline', rows: [{ title: 'Name', actions: createSettingsControl(createTextField({ value: 'Explicit opt-in' })) }] }),
    );
    settingsPanelDemo.append(settingsList);
    const sidebarDemo = demo('Collapsible sidebar', 'The collapse action stays at the bottom. Sidebars persist and synchronize state when they share a storage key, and support collapsible: false.');
    const sampleSidebar = document.createElement('aside'); sampleSidebar.className = 'ui-showcase-sidebar'; const sampleNavigation = document.createElement('nav'); sampleNavigation.textContent = 'Sidebar content'; sampleSidebar.appendChild(sampleNavigation); createCollapsibleSidebar({ element: sampleSidebar, label: 'Example tools' }); sidebarDemo.append(sampleSidebar);
    const actionListDemo = demo('Action list', 'Full-width selectable rows share title, metadata, trailing status, hover, selected, and highlighted states.');
    const sampleList = createActionList(); const ready = document.createElement('span'); ready.className = 'badge badge-success'; ready.textContent = 'Ready'; const firstItem = createActionListItem({ title: 'App icon (1024 × 1024)', meta: 'app-icon.jpg · 1024 × 1024', trailing: ready, selected: true }); const running = document.createElement('span'); running.className = 'badge badge-running'; running.textContent = 'Running'; const secondItem = createActionListItem({ title: 'Build Android development', meta: 'build · just now · 42s', trailing: running, highlighted: true }); const rowActions = document.createElement('div'); rowActions.append(createIconButton({ icon: 'trash', label: 'Remove item', variant: 'control', size: 'sm' })); const thirdItem = createActionListItem({ title: 'Project with a secondary action', meta: '/Projects/Sample', actions: rowActions }); sampleList.append(firstItem.element, secondItem.element, thirdItem.element); actionListDemo.append(sampleList);
    const tableDemo = demo('Data table', 'Structured selectable data uses the shared table; columns consume the available width and rows support pointer and keyboard selection.');
    tableDemo.append(createDataTable({ items: [{ name: 'App icon', file: 'app-icon.jpg', status: 'Original' }, { name: 'Portrait banner', file: 'portrait-banner.jpg', status: 'Original' }], keyOf: (item) => item.file, selectedKey: 'app-icon.jpg', columns: [{ id: 'name', label: 'Asset', render: (item) => item.name }, { id: 'file', label: 'File', render: (item) => item.file }, { id: 'status', label: 'Status', width: '90px', render: (item) => item.status }] }).element);
    const imageGridDemo = demo('Image grid', 'Paged image collections use the same collection shell, page navigator, and page-size selector as data tables.');
    const sampleImages = createImageGrid({ items: ['violet', 'blue', 'green'], keyOf: (item) => item, pageSize: 2, pageSizeOptions: [2, 4, 8], preferenceKey: 'showcase.image-grid', renderItem: (item) => { const card = document.createElement('article'); card.className = 'ui-showcase-image-card'; const image = document.createElement('img'); image.src = sampleImage; image.alt = `${item} sample`; card.appendChild(image); return card; } }); imageGridDemo.append(sampleImages.element);
    const loadingStateDemo = demo('Loading state', 'Asynchronous pages and regions keep their mounted content and use the shared busy overlay. Labels may report the active phase and elapsed time.'); const loadingSurface = document.createElement('div'); loadingSurface.className = 'ui-showcase-loading-surface ui-loading-host'; loadingSurface.setAttribute('aria-busy', 'true'); loadingSurface.appendChild(createLoadingState({ label: 'Loading releases · 1.8s' }).element); loadingStateDemo.append(loadingSurface);
    grid(panels).append(contentPanelDemo, helpSidebarDemo, settingsPanelDemo, sidebarDemo, actionListDemo, tableDemo, imageGridDemo, loadingStateDemo);

    const forms = section('Dynamic forms', 'Define field types, responsive columns, validation, visibility, enabled state, normalization, and cross-field behavior entirely in code.');
    const formDemo = demo('Schema-driven form', 'Changing the mode controls which fields exist and how they validate.');
    const dynamicForm = createDynamicForm({
        initialValues: { mode: 'simple', name: 'Loading screen', retries: 3, accent: '#7c5cff', channel: 'stable', advancedNote: '' },
        layout: [['mode'], ['name'], ['retries', 'accent', 'channel'], ['advancedNote']],
        fields: [
            { key: 'mode', type: 'segmented', label: 'Mode', description: 'Inline descriptions stay visible below the control.', descriptionMode: 'inline', options: [{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }] },
            { key: 'name', type: 'text', label: 'Name', description: 'Descriptions use the info icon by default.', clearable: true, required: true, validate: (value) => String(value).trim().length < 3 ? 'Use at least 3 characters.' : undefined },
            { key: 'retries', type: 'number', label: 'Retries', min: 0, max: 10, compact: true, normalize: (value) => Math.max(0, Math.min(10, Number(value ?? 0))) },
            { key: 'accent', type: 'color', label: 'Accent' },
            { key: 'channel', type: 'segmented', label: 'Channel', options: [{ value: 'stable', label: 'Stable' }, { value: 'beta', label: 'Beta' }] },
            { key: 'advancedNote', type: 'textarea', label: 'Advanced note', rows: 3, visible: (values) => values.mode === 'advanced', required: (values) => values.mode === 'advanced' },
        ],
    });
    const formState = document.createElement('pre'); formState.className = 'ui-dynamic-form-state';
    const renderFormState = (): void => { formState.textContent = JSON.stringify({ valid: dynamicForm.valid, dirty: dynamicForm.dirty, values: dynamicForm.values }, null, 2); };
    dynamicForm.onChange(renderFormState); renderFormState(); formDemo.append(createContentPanel({ title: 'Example settings', content: dynamicForm.element }), formState); grid(forms).append(formDemo);

    const overlays = section('Overlays', 'Anchored menus and pickers use Popover; focused workflows and decisions use Modal.');
    const overlayDemo = demo('Popover and modal'); const popoverButton = createButton({ label: 'Open popover', className: 'btn-secondary', symbol: 'action' }); const popoverContent = document.createElement('div'); popoverContent.className = 'ui-showcase-popover-content'; popoverContent.textContent = 'Reusable anchored content'; createPopover({ trigger: popoverButton, content: popoverContent });
    const sidePopoverButton = createButton({ label: 'Open side popover', className: 'btn-secondary', symbol: 'action' }); const sidePopoverContent = document.createElement('div'); sidePopoverContent.className = 'ui-showcase-popover-content'; sidePopoverContent.textContent = 'Right-placed content for collapsed navigation'; createPopover({ trigger: sidePopoverButton, content: sidePopoverContent, placement: 'right' });
    const modalButton = createButton({ label: 'Open modal', className: 'btn-secondary', symbol: 'action' }); modalButton.addEventListener('click', () => { const content = document.createElement('p'); content.textContent = 'Reusable modal content for focused tasks and decisions.'; showModal({ title: 'Modal example', icon: 'info', content, actions: [{ label: 'Close', className: 'btn-primary', run: (close) => close() }] }); });
    const loadingModalButton = createButton({ label: 'Open loading modal', className: 'btn-secondary', symbol: 'action' }); loadingModalButton.addEventListener('click', () => { const content = document.createElement('p'); content.textContent = 'The complete destination layout stays mounted beneath the full-modal loading state.'; const modal = showModal({ title: 'Loading modal example', icon: 'info', content, actions: [{ label: 'Close', className: 'btn-primary', run: (close) => close() }] }); void modal.runWithLoading(() => new Promise<void>((resolve) => window.setTimeout(resolve, 1_200)), 'Preparing content…'); }); overlayDemo.append(row(popoverButton, sidePopoverButton, modalButton, loadingModalButton)); grid(overlays).append(overlayDemo);
    const notificationDemo = demo('Job notifications', 'Unread status changes use the shared icon action and anchored notification list.');
    const notificationTrigger = createIconButton({ icon: 'notifications', label: 'Job notifications' }); notificationTrigger.classList.add('job-notifications-trigger');
    const notificationCount = document.createElement('span'); notificationCount.className = 'job-notifications-count'; notificationTrigger.appendChild(notificationCount);
    const now = new Date().toISOString();
    const notificationControl = createJobNotifications({ trigger: notificationTrigger, count: notificationCount, loadJobs: async () => [{ id: 'showcase-job', type: 'build', name: 'Build development Android', action: 'Build', sourceUrl: '/ui', status: 'running', progress: 42, startedAt: now, tasks: [], logs: [], errorLogs: [] }], onOpenJob: () => undefined, onOpenAll: () => undefined });
    void notificationControl.refresh(); notificationDemo.append(row(notificationTrigger)); grid(overlays).append(notificationDemo);
    const toastDemo = demo('Toasts', 'Completed actions use transient success feedback. Errors remain until closed and offer copyable technical details.');
    const successToastButton = createButton({ label: 'Show success toast', className: 'btn-secondary', symbol: 'check' });
    successToastButton.addEventListener('click', () => showSuccessToast('Configurations saved', 'Deployment configuration is up to date.'));
    const errorToastButton = createButton({ label: 'Show error toast', className: 'btn-secondary', symbol: 'action' });
    errorToastButton.addEventListener('click', () => showErrorToast('Could not save configuration', 'The configuration could not be updated.', 'Error: Example technical detail\n    at saveConfiguration (configurations.ts:42)'));
    toastDemo.append(row(successToastButton, errorToastButton)); grid(overlays).append(toastDemo);

    options.content.append(theme, buttons, text, numeric, content, choices, panels, forms, overlays);
}

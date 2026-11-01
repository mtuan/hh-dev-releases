# Shared field system

Import form controls from `shared/ui/fields`. Every value control exposes `element`, `value`, `setValue`, and `onChange`; input-style fields additionally expose `input`, `setDisabled`, `setError`, and `focus`.

Available components:

- `createButton` with shared SVG symbols and stable loading spinner
- `createTextField` for text, email, search, telephone, and URL values
- `createPasswordField` with show/hide affordance
- `createNumberField`, including compact numeric fields
- `createDateField` for date, date-time, month, time, and week values
- `createTextAreaField`
- `createColorField`
- `createGradientField`, supporting linear, radial/circle, ellipse, and conic gradients with two or three standalone `createColorField` stops
- `createFileField` with choose and clear behavior
- `createSelectField` / `createDropdown`
- `createCheckboxField`
- `createSwitchField`
- `createRadioGroup`
- `createSegmentedField` / `createSegmentedToggle`
- `createRangeField` / `createRangeControl`
- `createFieldLayout` for a consistent label, hint, and error region

Every component supports `sm`, `md`, and `lg`. The application default is `DEFAULT_FIELD_SIZE` in `size.ts` (`md` by default). Dynamic forms accept a top-level `size`; individual field definitions and standalone controls accept `size` for exceptions. Sizing is inherited by compound controls, so do not reproduce it with route CSS.

Field components are always standalone. Build and test their UI and behavior independently, then pass the component to `createSettingsControl` when placing it inside a `createSettingsPanel` row. Do not create form-specific copies of a field.

For forms whose fields or behavior are data-driven, use `createDynamicForm` from `../dynamic-form`. Its definition supports all shared field types, one- or two-column placement, conditional visibility/disabled/read-only/required state, normalization, per-field and cross-field validation, change effects, dirty tracking, and custom field factories. A dynamic form composes the standalone controls; it does not replace or fork their UI.

Use `createPopover` for anchored menus, compact pickers, and contextual controls. Use `showModal` for focused workflows, confirmations, and content that should interrupt the page. Native browser picker popups are not part of the shared UI and should not be used for themed controls.

Use `createFormController` for validation, dirty tracking, keyboard save, and saving state. Use `createSettingsPanel` for one- and two-column page layout.

Use `createTextAreaField({ rows: 1, autoGrow: true, maxRows: 3 })` for compact multiline values that should begin as a single line and expand only when the user adds line breaks.

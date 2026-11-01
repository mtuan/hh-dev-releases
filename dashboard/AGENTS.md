# Renderer architecture rules

- Project-owned dashboard data that should be shared with other developers lives under `<game-project>/.cocos-build-dashboard/`. Store settings, editable source configuration, extracted assets, and their manifests there. Keep only machine-specific registration, window state, credentials, and transient job history in Electron user data. Generated Cocos/runtime files may remain in their platform-required locations.

For dashboard UI/UX implementation or review, read and follow the repository-owned skill at `.codex/skills/cocos-build-dashboard-ui-ux/SKILL.md`. This local copy is authoritative and must remain git-tracked with the tool.

- `src/app.ts` is only the browser composition root: initialize state, mount the shell, and dispatch routes.
- Every page lives under `src/routes/` using filesystem route structure. Current routes are:
  - `src/routes/index.ts` → `/` root application layout
  - `src/routes/projects/index.ts` → `/projects`
  - `src/routes/ui/index.ts` → `/ui` shared component showcase
  - `src/routes/projects/[projectId]/configs/index.ts` → `/projects/:projectId/configs`
  - `src/routes/projects/[projectId]/platforms/index.ts` → `/projects/:projectId/platforms`
  - `src/routes/projects/[projectId]/[platform]/configs/index.ts` → `/projects/:projectId/:platform/configs`
  - `src/routes/projects/[projectId]/loading/index.ts` → both project `/projects/:projectId/loading` and platform `/projects/:projectId/:platform/loading` loading-screen scopes
  - `/projects/:projectId/:platform` resolves to the platform Build page
  - `src/routes/projects/[projectId]/[platform]/templates/index.ts` → `/projects/:projectId/:platform/templates`
  - `src/routes/projects/[projectId]/[platform]/build/index.ts` → `/projects/:projectId/:platform/build`
  - `src/routes/projects/[projectId]/[platform]/console/index.ts` → Meta console overview `/projects/:projectId/fb-instant-games/console` and embedded browser `/projects/:projectId/fb-instant-games/console/browser`
- A route owns its DOM rendering and page-specific event handlers. Never add page rendering or page actions to `app.ts`.
- Reusable UI belongs in `src/shared/ui/`; shared state and navigation belong in `src/shared/`.
- Electron/IPC access is wrapped by shared services. Route modules must not duplicate persistence or IPC conventions.
- Keep files focused. A source file approaching 600 lines must be split before adding more behavior; route files should normally stay below 250 lines.
- The sidebar is flat by default. Add submenu structure only when a real tool has child routes.
- Global routes such as `/projects` render inside the `/` root sidebar. Project settings and project/platform tools own separate nested layouts.
- Project removal belongs only to `/projects`; platform removal belongs only to `/projects/:projectId/platforms`.
- Build-template import belongs to the platform detail route `/projects/:projectId/:platform/templates`, not the platform-management list.
- The daily workspace context is one project plus one platform; tool pages are children such as `/projects/:projectId/:platform/build`.
- Every page uses the shared content pattern: title and description on the left, page actions on the right, and one consistent full-width content gutter.
- Every route header must be rendered through `src/shared/ui/page-header.ts`, including pages with no actions. Do not hand-code route header markup or repeat the page title inside the content body.
- Subpage headers must use the shared typography, gutter, and sidebar-width tokens. Do not add route- or ID-specific title sizing or offsets.
- When a page has only one content section, do not add a section subtitle or separator beneath the page header. Section headings and separators are reserved for distinguishing two or more sibling sections.
- Lists use the shared `createActionList` / `createActionListItem` primitives for full-width action rows. The row body is the default action; secondary actions stay compact on the right. Do not recreate title/meta/status row markup or wrap lists in decorative nested cards.
- Structured record collections use the shared `createDataTable` primitive whenever records expose two or more comparable attributes, repeated status/value columns, or aligned row actions. Reserve action lists for menus, navigation/preview selection, and single-primary-action rows whose extra text is subordinate metadata; reserve panels for genuinely complex workflows. Do not hand-build route-local table headers, selectable-row state, keyboard activation, or empty states.
- Keep consistent vertical spacing between all list rows; do not let route-specific list styles collapse items together.

## Development workflow

- Never inspect, control, or visually verify the live Electron app. The user will provide screenshots when visual feedback is needed.
- For process diagnostics, identify the development runtime by its exact executable path, working directory, and watcher PID. Never launch or bind to the dashboard by display name, and never open an app bundle under `release/`; macOS may otherwise select stale packaging output that shares the production name.
- Use `npm run dev` for normal development. It owns transactional validation, staging, renderer reload, and main-process restart. Never start independent TypeScript, esbuild, or Electron watchers alongside it.
- Before an AI makes the first file edit in a multi-file task, it must run `npm run dev:update:start`. This creates the update lock, allowing any number of source files to change without exposing a partial implementation to the running app.
- Keep the update lock while editing and while fixing validation failures. After all intended edits are complete and the required verification commands pass, run `npm run dev:update:finish` exactly once. Releasing the lock triggers one complete staged build and one reload. Do not release it between intermediate patches.
- If a turn is interrupted or the work is intentionally abandoned, leave the lock in place while code is invalid; remove it only after restoring a valid complete state. At the start of later work, an existing lock means a previous transaction is still open and must be completed rather than bypassed.
- The transactional watcher builds into a temporary staging directory. It promotes output only when renderer type checking, Electron/CLI compilation, renderer bundling, and loading-runtime bundling all succeed. A failed build must leave the last working app running without reload.
- Renderer-only changes receive one hot reload after promotion. Electron main-process, preload, CLI, package, or main tsconfig changes receive one full tool restart after promotion. Do not manually reload or restart before the transaction finishes.
- While the dev watcher is running, do not run `npm run build` after ordinary TypeScript, HTML, CSS, or route edits. Read the watcher output for type and bundle failures instead.
- Run `npm run build` only when the watcher is unavailable or when an explicit one-shot verification is materially useful.
- Run `npm run package` only when the user requests a distributable build or release packaging needs verification. Never package merely to display a source change during development.
- Do not stop and relaunch the development app for renderer changes; allow live reload to apply them. Restart manually only when the watcher is broken or a native/Electron condition requires it.

## Shared UI conventions

- Dashboard CSS is authored under `src/styles/`. Semantic theme tokens belong in `themes/`, reusable application-shell and component rules belong in `components/`, and route-owned presentation belongs in `pages/`. A file under `bundles/` selects one theme and imports `bundles/shared.css`; the renderer build must emit that entry as one bundled stylesheet. Never restore a monolithic route-and-component stylesheet or put component geometry into a theme.

- Before writing route DOM, inventory `src/shared/ui/` and the `/ui` showcase for an existing primitive. If the needed behavior is reusable and absent, implement it in `src/shared/ui/` first; never begin with a route-local copy and plan to consolidate later.
- Run `npm run check:ui` for every dashboard UI change. The audit rejects route-owned native form/table/dialog elements, hand-built panel/modal/dropdown/list shells, and generic native buttons. Its only narrow exemptions are domain rendering surfaces such as selectable nodes inside the loading canvas/tree; exemptions must not be expanded to cover ordinary dashboard controls.
- Every reusable component belongs in `src/shared/ui/` and must be implemented there before route use. Specialized variants compose one shared base primitive instead of duplicating DOM, styling, states, or behavior; all titled panel variants compose `createPanel`.
- Every panel-shaped surface must compose the shared `createPanel` API (directly or through `createContentPanel`/`createSettingsPanel`). This includes browser frames, editors, previews, node trees, inspectors, asset lists, and side panes. Routes may arrange content inside a panel, but must never recreate panel headers, borders, radii, separators, collapse behavior, or shell sizing with page-local DOM/CSS.
- Panel headers are compact by default. Opt out with `compactHeader: false` only for a documented hierarchy requirement; routes must not recreate a spacious header locally.
- Panels never own external margins. A parent panel stack owns spacing with `--panel-stack-gap`; use that same token for every vertical or grid collection of sibling panels so gaps never accumulate or vary by route.
- Panel-level actions belong in the right side of the shared panel header through its `actions` option. Put an action inside the body only when it operates on one specific body item or field next to it; do not place panel-wide toolbars above or below panel content.
- Panel status tags use the shared `status` and `statusClass` options and render immediately after the panel title. Never place a status badge in the right-side `actions` area or recreate title/status markup in a route.
- Build forms from the public `src/shared/ui/fields/` field system plus `form-state.ts`, `settings-panel.ts`, and `tabs.ts`; route modules must not recreate controls, tab state, save-button state, validation, or dirty detection. `form-controls.ts` and `button.ts` are compatibility entry points, not the API for new route code.
- Use `createFormController` for editable pages. Save actions start disabled, enable only for valid dirty data, show the shared saving state, and reset their baseline after a successful save.
- Successful saves restore the save button state and dirty baseline, then use the shared transient success toast; do not open a modal or alert. Save errors use the shared persistent error toast with copyable technical details and remain until the user closes them. Reserve modal/alert feedback for validation problems or actions that require a user decision.
- Use `createTabs` for tab rendering and selection. Route-specific code owns only URL synchronization and tab content.
- Use `createSettingsPanel` and its one- or two-field rows for form layout. Fields use the two-line stacked convention by default: label/help above, component below. A row supports at most two fields; both columns share the same tracks. Use `layout: 'inline'` only for an intentional compact exception, never as a route-local default.
- Project loading screens are opt-in. Platform loading screens explicitly inherit the project configuration, customize it, or disable it; never silently generate loading integration for an unconfigured project.
- New reusable input behavior belongs in `src/shared/ui/fields/` and must expose the shared value/change API instead of route-specific event wiring.
- Every file or image selection uses the shared `createFileField`; routes must not combine a read-only text field with a separate Browse button. Image selectors enable the shared in-field thumbnail and retain the component-owned clear affordance.
- Preserve mounted UI identity during live updates. Timers, polling callbacks, subscriptions, job events, and status changes must update only the smallest affected controls or text nodes; they must never rebuild a route, panel, table, or other container merely to refresh elapsed time, progress, status, or similar dynamic values.
- Never use `innerHTML`, `replaceChildren`, route render functions, or equivalent subtree replacement while interactive descendants are mounted. Such updates must preserve focus, open popovers and menus, selections, pagination, scroll position, and unsaved input. Use shared control update APIs such as `setItems` and `setSelectedKey`, a component-specific update method, or targeted text/attribute changes instead.
- Recurring refresh logic requires an explicit teardown-scope review before implementation. Live timestamps use targeted text updates or a shared live-time component; a clock tick is never a reason to remount page content.
- Any page, panel, or content region that awaits work long enough to leave incomplete or empty UI must use the shared loading-state boundary from `src/shared/ui/loading-state.ts`. Mount the destination UI once, run the asynchronous work through `runWithLoadingState`, and remove the busy overlay in `finally`; do not invent route-local spinners or replace the mounted subtree when loading completes.
- All form controls use the shared `sm`, `md`, and `lg` size contract. Set the application default through `DEFAULT_FIELD_SIZE`, override a whole dynamic form with its `size`, and use per-field sizing only for intentional exceptions; routes must not define control dimensions.
- Every shared field component and supported state must be demonstrated on `/ui`; update the showcase whenever the field API, sizes, modes, colors, validation, or loading behavior changes.
- All pages and shared components must render correctly in both light and dark mode using semantic CSS tokens. Do not introduce mode-specific hardcoded surface or text colors; verify new states through the global route-bar theme toggle and `/ui` palette showcase.
- Create action buttons through `src/shared/ui/button.ts`. Action buttons always use a familiar pictogram from the shared SVG symbol set (for example: floppy disk for Save, trash bin for Delete, folder for Browse, plus for Add); do not substitute abstract text glyphs. Loading replaces the fixed-size icon slot with the shared spinner so labels and layout do not shift. Tabs, dropdown options, segmented toggles, and inline clear controls are not action buttons.
- Create icon-only actions through `src/shared/ui/icon-button.ts` and use `src/shared/ui/icon.ts` as the single SVG registry. Never embed route-local SVG markup or substitute text glyphs for icon buttons. Field-owned icon affordances use the component's `control` variant.
- Use the shared segmented slide toggle for two to four short, fixed, mutually exclusive choices when the options fit the available width. Reserve dropdowns for longer, dynamic, crowded, or larger option sets.
- Unknown or unavailable paths render the shared `src/routes/not-found/` page. Never silently redirect an invalid route to a valid page.
- The editable route address is owned by `src/shared/ui/route-address.ts`; route entry, refresh, and restored navigation must use the same resolver. Enter commits, while Escape reverts to the active route.

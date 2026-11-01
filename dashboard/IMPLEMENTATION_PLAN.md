# Shared tooling implementation plan

## Milestone 1 — package boundary

- Move reusable bridges, templates, codebase, and loading assets under `resources/`.
- Package `resources/` as immutable Electron `extraResources`.
- Resolve built-in resources consistently in development and packaged builds.

## Milestone 2 — versioned project installation

- Detect the Cocos Creator major family from the project `package.json`.
- Keep machine paths in Electron user data and project settings in Git.
- Add `cocos-tools.lock.json`, package manifests, managed-file hashes, and conflict-safe sync.
- Add doctor, sync, and status operations to both Electron and CLI surfaces.

## Milestone 3 — loading kit

- Ship a shared DOM loading runtime, platform adapters, schema, and defaults.
- Keep game themes and platform overrides in `<project>/loading/`.
- Install Creator-family-specific integration files without sharing incompatible bootstraps.
- Use a static OS splash plus a Cocos loading scene on native targets.

## Milestone 4 — unified build flow

- Select a Creator 2.x or 3.x adapter before each build.
- Compose the platform adapter and project loading theme.
- Run through the open-Editor bridge when available or headless CLI otherwise.
- Validate installed packages and output before reporting success.

## Milestone 5 — distribution and verification

- Ship the same core through the Electron UI and command-line entry point.
- Build TypeScript, run package-manager self-tests, and smoke-test existing builds.
- Keep resource manifests versioned so future updates can be previewed safely.


---
phase: 15-windows-installer-setup-wizard
plan: 02
subsystem: ui
tags: [react, electron, setup-wizard, tailwindcss, ipc]

requires:
  - phase: 15-01
    provides: electron-store, IPC handlers, preload bridge, Docker detection
provides:
  - 5-step React setup wizard (Welcome, Mode, Docker Check, Storage, Summary)
  - First-run detection and routing in App.tsx
  - Deferred Docker Compose startup until setup completes
  - User-selectable model cache path with native folder dialog
affects: [frontend, desktop, docker-compose]

tech-stack:
  added: ["@testing-library/react", "@testing-library/jest-dom"]
  patterns: [typed window.paragrafSetup IPC, conditional wizard routing]

key-files:
  created:
    - frontend/src/types/electron.d.ts
    - frontend/src/__tests__/SetupWizard.test.tsx
    - frontend/src/components/SetupWizard.tsx
    - frontend/src/components/SetupSteps/WelcomeStep.tsx
    - frontend/src/components/SetupSteps/ModeStep.tsx
    - frontend/src/components/SetupSteps/DockerCheckStep.tsx
    - frontend/src/components/SetupSteps/StorageStep.tsx
    - frontend/src/components/SetupSteps/SummaryStep.tsx
    - desktop/scripts/dev.cjs
    - desktop/src/renderer/index.html
  modified:
    - frontend/src/App.tsx
    - desktop/src/main/index.ts
    - desktop/src/main/ipc.ts
    - desktop/src/main/docker.ts
    - desktop/src/main/store.ts
    - desktop/src/preload/index.ts
    - desktop/electron.vite.config.ts
    - desktop/package.json
    - docker-compose.desktop.yml

key-decisions:
  - "Typed window.paragrafSetup — no (window as any) casts, strict TypeScript throughout"
  - "Model cache path selectable via native folder dialog, persisted in electron-store, passed to Docker Compose as PARAGRAF_MODEL_CACHE env var"
  - "electron-vite dev script removes ELECTRON_RUN_AS_NODE (VS Code Terminal sets it, breaks Electron module loading)"
  - "electron-store bundled into main process (exclude from externalizeDepsPlugin) because v11 is ESM-only"

patterns-established:
  - "Setup wizard first-run pattern: App.tsx checks setupComplete via IPC, renders wizard or main app"
  - "Native dialog IPC pattern: main process opens dialog, returns path to renderer"

requirements-completed: [INST-02, INST-04, INST-05]

duration: 45min
completed: 2026-03-31
---

# Phase 15-02: Setup Wizard Summary

**5-step React setup wizard with Docker detection, user-selectable model cache path, and deferred Docker startup**

## Performance

- **Duration:** ~45 min (including human verification and bugfixes)
- **Tasks:** 4/4 (3 automated + 1 human-verify checkpoint)
- **Files created:** 10
- **Files modified:** 9

## Accomplishments
- 5-step setup wizard (Welcome, Mode, Docker Check, Storage, Summary) with German UI, Tailwind dark mode, accessibility
- Mode selection: Docker enabled with "Empfohlen" badge, Native disabled with "Kommt in Version 2.1"
- Docker auto-detection with 4-state display and "Erneut prüfen" retry
- Storage estimation with breakdown table (~8.5 GB) and user-selectable model cache path via native folder dialog
- First-run routing in App.tsx: desktop mode shows wizard when setupComplete is false
- Deferred Docker Compose start: main process checks store before starting, passes model cache path as env var
- 10 passing frontend tests covering step rendering, navigation, mode cards, Docker states, first-run detection

## Task Commits

1. **Task 0: Window type declarations and test scaffold** — `b75750f`
2. **Task 1: SetupWizard container and 5 step components** — `7403791`
3. **Task 2: Wire SetupWizard into App.tsx and defer Docker startup** — `1241042`
4. **Bugfix: Umlaute, dynamic model cache path, electron-vite dev fixes** — `db43146`
5. **Feature: Selectable model cache path with folder dialog** — `47a22f3`

## Decisions Made
- Used typed `window.paragrafSetup` throughout (no `(window as any)` casts) — type declarations in electron.d.ts
- Model cache path is user-selectable via native Windows folder dialog, stored in electron-store, and passed to Docker Compose as `PARAGRAF_MODEL_CACHE` environment variable that overrides the named volume
- Fixed electron-vite dev for VS Code Terminal: `ELECTRON_RUN_AS_NODE=1` env var (set by VS Code) prevents Electron module loading — dev script removes it
- electron-store v11 (ESM-only) must be bundled into main process via `externalizeDepsPlugin({ exclude: ["electron-store"] })`
- Added `projectName` to electron-store constructor (required when bundled)

## Deviations from Plan

### Auto-fixed Issues

**1. Umlaute missing in all German text**
- **Found during:** Human verification (Task 3)
- **Issue:** All German umlauts written as ae/oe/ue instead of ä/ö/ü
- **Fix:** Replaced in all 5 step components and tests
- **Committed in:** `db43146`

**2. Model cache path hardcoded**
- **Found during:** Human verification (Task 3)
- **Issue:** `C:\ProgramData\Paragraf\models` was not user-configurable
- **Fix:** Added folder dialog IPC, store persistence, Docker Compose env var passthrough
- **Committed in:** `47a22f3`

**3. electron-vite dev broken in VS Code Terminal**
- **Found during:** Human verification (Task 3)
- **Issue:** `ELECTRON_RUN_AS_NODE=1` from VS Code prevented Electron module loading; also missing renderer entry point
- **Fix:** Created `scripts/dev.cjs` wrapper, added `src/renderer/index.html`, configured electron-vite renderer config
- **Committed in:** `db43146`

---

**Total deviations:** 3 auto-fixed during human verification
**Impact on plan:** All fixes necessary for correct functionality. Model cache path feature extends original scope based on user feedback.

## Issues Encountered
- Global `electron` package in `C:\Users\Jan_L\node_modules\` shadowed Electron's built-in module (removed)
- electron-store v11 ESM-only incompatible with CJS output — solved by bundling it inline
- `.asar` file locked by Docker Desktop preventing npm operations — killed Docker processes to unlock

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Complete setup wizard infrastructure in place
- Phase 15 verification can proceed
- Desktop app starts correctly with wizard on first run, skips on subsequent launches

---
*Phase: 15-windows-installer-setup-wizard*
*Completed: 2026-03-31*

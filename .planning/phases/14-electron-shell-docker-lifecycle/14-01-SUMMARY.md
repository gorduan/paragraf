---
phase: 14-electron-shell-docker-lifecycle
plan: 01
subsystem: desktop
tags: [electron, electron-builder, nsis, browserwindow, preload, ipc]

# Dependency graph
requires: []
provides:
  - "Electron project scaffold with build tooling (electron-vite)"
  - "BrowserWindow factory with security defaults (contextIsolation, sandbox)"
  - "Single-instance lock preventing duplicate app instances"
  - "Preload bridge exposing API base URL and desktop IPC to renderer"
  - "electron-builder NSIS installer config with Start Menu shortcut"
affects: [14-02, 15-docker-detection-health-bridge, 16-installer-packaging-signing]

# Tech tracking
tech-stack:
  added: [electron@41.1.0, electron-builder@26.8.1, electron-vite@5.0.0, tree-kill@1.2.2, vitest@4.1.2]
  patterns: [electron-vite main/preload/renderer build, contextBridge IPC, single-instance lock]

key-files:
  created:
    - desktop/package.json
    - desktop/tsconfig.json
    - desktop/tsconfig.node.json
    - desktop/electron.vite.config.ts
    - desktop/electron-builder.yml
    - desktop/vitest.config.ts
    - desktop/src/main/index.ts
    - desktop/src/main/window.ts
    - desktop/src/main/logger.ts
    - desktop/src/preload/index.ts
    - desktop/tests/window-shell.test.ts
    - desktop/tests/single-instance.test.ts
    - desktop/resources/icon.ico
    - desktop/resources/icon.png
  modified: []

key-decisions:
  - "electron-vite for build tooling (main/preload/renderer split builds)"
  - "Placeholder icons created as minimal valid PNG/ICO (real branding needed before release)"
  - "Preload injects http://localhost:8000 as API base URL for Docker backend"

patterns-established:
  - "Electron main process modules in desktop/src/main/"
  - "Preload scripts in desktop/src/preload/"
  - "Unit tests in desktop/tests/ using vitest with electron mocks"
  - "Logger format matching backend style: timestamp | LEVEL | main | message"

requirements-completed: [SHELL-01, SHELL-02, SHELL-03]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 14 Plan 01: Electron Shell + Window Summary

**Electron 41 project scaffold with BrowserWindow (contextIsolation+sandbox), single-instance lock, preload IPC bridge, and NSIS installer config**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T10:54:25Z
- **Completed:** 2026-03-29T10:59:57Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Scaffolded complete Electron project with electron-vite build tooling and TypeScript strict mode
- Implemented BrowserWindow factory with security defaults (contextIsolation, sandbox, no nodeIntegration)
- Single-instance lock prevents duplicate app instances, focuses existing window on second launch
- Preload bridge exposes API base URL and paragrafDesktop IPC bridge to renderer
- electron-builder configured for NSIS installer with Start Menu shortcut and desktop icon
- All 3 unit tests passing (window creation, security settings, single-instance lock)

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Electron project scaffold** - `01d6729` (feat)
2. **Task 2: Implement main process, window, preload, single-instance** - `866d5a2` (feat)
3. **Package lockfile** - `f7641e1` (chore)

## Files Created/Modified
- `desktop/package.json` - Electron project definition with all dependencies
- `desktop/tsconfig.json` - TypeScript config (ES2022, strict)
- `desktop/tsconfig.node.json` - Node-specific TS config for electron.vite.config
- `desktop/electron.vite.config.ts` - electron-vite build config (main/preload/renderer)
- `desktop/electron-builder.yml` - NSIS installer config with shortcuts
- `desktop/vitest.config.ts` - Test runner configuration
- `desktop/src/main/index.ts` - App entry with single-instance lock
- `desktop/src/main/window.ts` - BrowserWindow factory with security defaults
- `desktop/src/main/logger.ts` - Main process logging utility
- `desktop/src/preload/index.ts` - IPC bridge with API base URL and desktop API
- `desktop/tests/window-shell.test.ts` - Window creation and security tests
- `desktop/tests/single-instance.test.ts` - Single-instance lock test
- `desktop/resources/icon.ico` - Placeholder icon (ICO format)
- `desktop/resources/icon.png` - Placeholder icon (PNG format)

## Decisions Made
- Used electron-vite for build tooling with separate main/preload/renderer build targets
- Created minimal valid placeholder icons (1x1 pixel) -- real branding icons needed before installer build
- Preload injects `http://localhost:8000` as API base URL matching Docker backend port
- Tests use vitest with vi.fn() constructor mocks for Electron's BrowserWindow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed BrowserWindow mock in tests to use constructor function**
- **Found during:** Task 2 (unit test execution)
- **Issue:** `vi.fn().mockImplementation(() => ({...}))` is not a valid constructor -- `new BrowserWindow()` threw "not a constructor"
- **Fix:** Changed mock to use `vi.fn(function(this) {...})` pattern which is callable with `new`
- **Files modified:** desktop/tests/window-shell.test.ts, desktop/tests/single-instance.test.ts
- **Verification:** All 3 tests pass
- **Committed in:** 866d5a2 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Windows path separator in test assertion**
- **Found during:** Task 2 (unit test execution)
- **Issue:** `stringContaining("renderer/index.html")` failed because Windows uses backslash path separators
- **Fix:** Normalized path to forward slashes before assertion: `loadedPath.replace(/\\\\/g, "/").toContain(...)`
- **Files modified:** desktop/tests/window-shell.test.ts
- **Verification:** Test passes on Windows
- **Committed in:** 866d5a2 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in plan-provided test code)
**Impact on plan:** Both fixes necessary for tests to pass on Windows. No scope creep.

## Issues Encountered
- C: drive was 100% full, npm install failed with ENOSPC. Cleaned npm cache (freed 3.8GB) and redirected cache to E: drive.

## Known Stubs
- `desktop/resources/icon.ico` and `icon.png` are 1x1 pixel placeholders -- real branding icons needed before installer build (Phase 16)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Electron shell ready for Plan 02 (Docker lifecycle management)
- `createMainWindow()` exported for use in Docker status integration
- Preload bridge has `docker:status` and `docker:restart` IPC stubs ready for handler implementation
- Before-quit handler for Docker cleanup will be added in Plan 02

## Self-Check: PASSED

- All 13 created files verified present on disk
- All 3 commits verified in git log (01d6729, 866d5a2, f7641e1)

---
*Phase: 14-electron-shell-docker-lifecycle*
*Completed: 2026-03-29*

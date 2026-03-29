---
phase: 14-electron-shell-docker-lifecycle
plan: 02
subsystem: desktop
tags: [electron, docker-compose, lifecycle, ipc, tree-kill, execFile]

# Dependency graph
requires:
  - phase: 14-01
    provides: "Electron project scaffold with BrowserWindow, preload IPC bridge, single-instance lock"
provides:
  - "Docker Compose lifecycle management (start/stop/status via execFile)"
  - "IPC handlers for docker:status and docker:restart"
  - "docker-compose.desktop.yml (headless 3-service compose without frontend)"
  - "Desktop-aware HealthOverlay with restart button"
affects: [15-docker-detection-health-bridge, 16-installer-packaging-signing]

# Tech tracking
tech-stack:
  added: []
  patterns: [execFile with array args (no shell injection), tree-kill for process cleanup, before-quit with timeout fallback]

key-files:
  created:
    - docker-compose.desktop.yml
    - desktop/src/main/docker.ts
    - desktop/src/main/ipc.ts
    - desktop/tests/docker-lifecycle.test.ts
  modified:
    - desktop/src/main/index.ts
    - frontend/src/components/HealthOverlay.tsx
    - desktop/tests/single-instance.test.ts

key-decisions:
  - "execFile with array args instead of exec to prevent shell injection"
  - "10s timeout on Docker Compose stop with tree-kill fallback for clean shutdown"
  - "isQuitting guard prevents double before-quit handling"
  - "Desktop HealthOverlay detects Electron via paragrafDesktop.isDesktop preload bridge"

patterns-established:
  - "Docker commands via execFile with windowsHide: true for Windows compatibility"
  - "IPC handlers in separate ipc.ts module for testability"
  - "Desktop mode detection via (window as any).paragrafDesktop?.isDesktop"

requirements-completed: [LIFE-01, LIFE-02]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 14 Plan 02: Docker Lifecycle & IPC Summary

**Docker Compose auto-start on app launch, auto-stop on quit with 10s timeout + tree-kill fallback, IPC handlers for status/restart, and desktop-aware HealthOverlay**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T11:03:01Z
- **Completed:** 2026-03-29T11:07:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Docker Compose lifecycle fully automated: starts on app.whenReady(), stops on before-quit with 10s timeout and tree-kill fallback
- IPC handlers registered for docker:status (checks Docker daemon availability) and docker:restart (stop + start)
- docker-compose.desktop.yml created as headless 3-service compose (qdrant, backend, mcp) without frontend
- HealthOverlay detects desktop mode and shows "Backend neu starten" button instead of CLI instructions
- All 10 unit tests pass (7 docker lifecycle + IPC, 3 existing shell tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Docker lifecycle module, IPC handlers, and desktop compose file** - `fcda24e` (feat)
2. **Task 2: Wire Docker lifecycle into main process and adapt HealthOverlay for desktop** - `84fccd8` (feat)

## Files Created/Modified
- `docker-compose.desktop.yml` - Headless 3-service compose file (no frontend service)
- `desktop/src/main/docker.ts` - Docker Compose lifecycle: start, stop, status check, emergency kill
- `desktop/src/main/ipc.ts` - IPC handler registration for docker:status and docker:restart
- `desktop/tests/docker-lifecycle.test.ts` - 7 tests for lifecycle and IPC handlers
- `desktop/src/main/index.ts` - Wired Docker lifecycle into app startup and before-quit cleanup
- `frontend/src/components/HealthOverlay.tsx` - Desktop-aware error UI with restart button
- `desktop/tests/single-instance.test.ts` - Fixed electron mock to include ipcMain

## Decisions Made
- Used execFile with array arguments (not exec/spawn with shell string) to prevent command injection
- 10s timeout on stopDockerCompose ensures app exits even if Docker hangs
- Added isQuitting guard to prevent recursive before-quit handler invocation
- Desktop mode detected via preload-injected paragrafDesktop.isDesktop property

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed single-instance test electron mock missing ipcMain**
- **Found during:** Task 2 (test verification)
- **Issue:** After index.ts now imports and calls registerIpcHandlers(), the electron mock in single-instance.test.ts needed ipcMain, child_process, and tree-kill mocks
- **Fix:** Added ipcMain mock to electron mock, added child_process and tree-kill mocks
- **Files modified:** desktop/tests/single-instance.test.ts
- **Verification:** All 10 tests pass with no unhandled errors
- **Committed in:** 84fccd8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in existing test mock)
**Impact on plan:** Auto-fix necessary because index.ts now imports docker.ts and ipc.ts modules. No scope creep.

## Issues Encountered
None.

## Known Stubs
None - all functionality is fully wired.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Docker lifecycle complete, ready for Phase 15 (Docker detection + health bridge)
- IPC handlers registered for docker:status and docker:restart
- HealthOverlay already adapts to desktop mode
- docker-compose.desktop.yml ready for Electron to manage

## Self-Check: PASSED

- All 7 created/modified files verified present on disk
- Both commits verified in git log (fcda24e, 84fccd8)

---
*Phase: 14-electron-shell-docker-lifecycle*
*Completed: 2026-03-29*

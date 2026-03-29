---
phase: 15-windows-installer-setup-wizard
plan: 01
subsystem: desktop
tags: [nsis, electron-store, ipc, docker-detection, preload-bridge]

requires:
  - phase: 14-electron-shell-docker-lifecycle
    provides: "Electron shell with Docker lifecycle, IPC handlers, preload bridge"
provides:
  - "NSIS installer with welcome page, license page, directory selection"
  - "electron-store typed schema for setup wizard state persistence"
  - "Extended Docker detection with 4-tier fallback (running/not-running/installed/missing)"
  - "7 setup wizard IPC handlers in ipc.ts"
  - "paragrafSetup preload bridge with 7 methods for renderer"
affects: [15-02-PLAN, setup-wizard-ui]

tech-stack:
  added: [electron-store]
  patterns: [4-tier-docker-detection, ipc-namespace-grouping, vi-hoisted-mocks]

key-files:
  created:
    - desktop/build/installer.nsh
    - desktop/build/license.rtf
    - desktop/src/main/store.ts
    - desktop/tests/store.test.ts
    - desktop/tests/docker-detection.test.ts
  modified:
    - desktop/electron-builder.yml
    - desktop/src/main/docker.ts
    - desktop/src/main/ipc.ts
    - desktop/src/preload/index.ts
    - desktop/package.json

key-decisions:
  - "Used vi.hoisted() for test mock backing stores to avoid vitest hoisting issues"
  - "4-tier Docker detection: docker info > docker --version > Windows Registry > missing"
  - "All 7 setup IPC handlers in ipc.ts (not split across files) for maintainability"

patterns-established:
  - "IPC namespace grouping: setup:* channels for wizard, docker:* for lifecycle"
  - "electron-store typed schema with AppSchema interface"

requirements-completed: [INST-01, INST-03, INST-05]

duration: 5min
completed: 2026-03-29
---

# Phase 15 Plan 01: NSIS Installer + Setup Wizard Infrastructure Summary

**NSIS installer with welcome/license pages, electron-store for wizard state, 4-tier Docker detection, and 7 IPC handlers with preload bridge**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T12:32:57Z
- **Completed:** 2026-03-29T12:37:48Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- NSIS installer configured with welcome page, German RDG license, and directory selection
- electron-store installed with typed AppSchema persisting setup wizard state across restarts
- Docker detection extended from 3-state to 4-state with Windows Registry fallback
- 7 IPC handlers registered for setup wizard communication (getState, setStep, checkDocker, openDockerDownload, complete, storageEstimate, startDocker)
- Preload bridge extended with paragrafSetup namespace exposing all 7 methods to renderer
- 19 tests passing (5 new + 14 existing with updated mocks)

## Task Commits

Each task was committed atomically:

1. **Task 1: NSIS installer macros, license file, and electron-builder config** - `7693e17` (feat)
2. **Task 2 RED: failing tests for store and docker detection** - `46c2a3c` (test)
3. **Task 2 GREEN: electron-store, Docker detection, IPC, preload bridge** - `cd3e11c` (feat)

## Files Created/Modified
- `desktop/build/installer.nsh` - NSIS welcome and license page macros
- `desktop/build/license.rtf` - German RDG disclaimer and terms in RTF
- `desktop/electron-builder.yml` - Updated build config with license ref and backend bundling
- `desktop/src/main/store.ts` - electron-store typed schema with SetupState
- `desktop/src/main/docker.ts` - Added checkDockerDetailed() with 4-tier detection
- `desktop/src/main/ipc.ts` - Added 7 setup wizard IPC handlers
- `desktop/src/preload/index.ts` - Added paragrafSetup bridge with 7 methods
- `desktop/package.json` - Added electron-store dependency
- `desktop/tests/store.test.ts` - Store defaults and persistence tests
- `desktop/tests/docker-detection.test.ts` - 4-tier detection tests
- `desktop/tests/docker-lifecycle.test.ts` - Added electron-store mock
- `desktop/tests/single-instance.test.ts` - Added electron-store mock

## Decisions Made
- Used `vi.hoisted()` for mock backing stores to avoid vitest module hoisting issues with `vi.mock()`
- 4-tier Docker detection uses execFile (not exec) for security, consistent with Phase 14 convention
- All 7 setup IPC handlers placed in `ipc.ts` alongside existing docker handlers for single registration point

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added electron-store mock to existing tests**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Existing docker-lifecycle.test.ts and single-instance.test.ts failed because ipc.ts now imports store.ts which requires electron-store
- **Fix:** Added `vi.mock("electron-store")` to both existing test files
- **Files modified:** desktop/tests/docker-lifecycle.test.ts, desktop/tests/single-instance.test.ts
- **Verification:** All 19 tests pass
- **Committed in:** cd3e11c (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep existing tests passing after new import chain. No scope creep.

## Issues Encountered
None.

## Known Stubs
None - all data flows are wired to electron-store persistence and real Docker CLI detection.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Main-process infrastructure complete for Plan 02 (React setup wizard UI)
- paragrafSetup bridge ready for renderer consumption
- electron-store persists wizard state for app restart scenarios
- NSIS installer configured for production builds

---
*Phase: 15-windows-installer-setup-wizard*
*Completed: 2026-03-29*

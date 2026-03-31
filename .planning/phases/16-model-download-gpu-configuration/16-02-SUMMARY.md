---
phase: 16-model-download-gpu-configuration
plan: 02
subsystem: infra
tags: [electron, ipc, docker-compose, gpu, cache-management, electron-store]

# Dependency graph
requires:
  - phase: 16-model-download-gpu-configuration-01
    provides: Model download backend infrastructure (download service, progress API)
provides:
  - Electron IPC handlers for GPU switching with D-09 CPU fallback
  - Docker Compose GPU overlay support via docker-compose.gpu.yml
  - Model cache clearing with D-07 setup state reset
  - Cache size calculation for host directories
  - Preload bridge exposing all GPU/cache methods to renderer
  - TypeScript types for all new IPC methods
affects: [16-03, frontend-setup-wizard, gpu-configuration-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GPU overlay: docker compose -f base.yml -f gpu.yml for GPU variant"
    - "D-09 CPU fallback: store GPU=false and restart CPU-only on switchGpu failure"
    - "D-07 cache reset: set setupStep=4 + setupComplete=false on cache clear"
    - "Type-safe store.get: cast to concrete types since electron-store returns {} | undefined"

key-files:
  created: []
  modified:
    - desktop/src/main/store.ts
    - desktop/src/main/docker.ts
    - desktop/src/main/ipc.ts
    - desktop/src/preload/index.ts
    - frontend/src/types/electron.d.ts

key-decisions:
  - "getGpuComposeFilePath() mirrors getComposeFilePath() pattern for dev/packaged path resolution"
  - "store.get casts to concrete types (string, boolean) to work around electron-store's {} | undefined return type"
  - "setup:complete now sets setupStep=7 (reflecting 7-step wizard: 0-6 with new download+gpu steps)"
  - "clearModelCache removes hub/ subdirectory only (not entire modelCachePath) to preserve user's folder"

patterns-established:
  - "GPU IPC pattern: store preference first, then stop/start Docker, fallback to CPU on error"
  - "Cache management: fs/promises imported dynamically in handler, walk recursive for size calculation"

requirements-completed: [MODEL-02, MODEL-03, MODEL-04]

# Metrics
duration: 15min
completed: 2026-03-31
---

# Phase 16 Plan 02: GPU Switching and Cache Management IPC Summary

**Electron IPC layer extended with GPU compose overlay selection, model cache clearing with setup state reset, and cache size calculation — all bridged to renderer via preload and declared in TypeScript types.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-31T19:28:08Z
- **Completed:** 2026-03-31T19:42:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `startDockerCompose` extended with `gpuEnabled` parameter that appends `-f docker-compose.gpu.yml` overlay when enabled
- 4 new IPC handlers registered: `setup:switchGpu` (with D-09 CPU fallback), `setup:getGpuPreference`, `setup:clearModelCache` (with D-07 setup reset), `setup:getCacheSize`
- Preload bridge and frontend TypeScript types fully updated to expose all new methods
- `SetupState` updated with `gpuEnabled: boolean` field in store schema, defaults, and frontend type declarations

## Task Commits

1. **Task 1: Extend store, Docker module, and IPC handlers** - `1c31870` (feat)
2. **Task 2: Update preload bridge and TypeScript types** - `74537a8` (feat)

## Files Created/Modified

- `desktop/src/main/store.ts` - Added `gpuEnabled: boolean` to `SetupState` interface and defaults
- `desktop/src/main/docker.ts` - Added `getGpuComposeFilePath()` helper, extended `startDockerCompose` with `gpuEnabled` parameter
- `desktop/src/main/ipc.ts` - Added 4 new IPC handlers (switchGpu, getGpuPreference, clearModelCache, getCacheSize), updated docker:restart and setup:startDocker to pass GPU setting, updated setup:complete to use step 7
- `desktop/src/preload/index.ts` - Exposed switchGpu, getGpuPreference, clearModelCache, getCacheSize in paragrafSetup bridge
- `frontend/src/types/electron.d.ts` - Added gpuEnabled/modelCachePath to SetupState, 4 new methods to ParagrafSetup, updated restartDocker return type in ParagrafDesktop

## Decisions Made

- **GPU path resolution:** `getGpuComposeFilePath()` mirrors the existing `getComposeFilePath()` pattern for consistent dev/packaged path resolution
- **Type casting:** `store.get()` returns `{} | undefined` in electron-store's type system; cast to concrete types (`as string`, `as boolean`) at point of use rather than fighting the type system
- **Step count:** `setup:complete` now sets step 7 (7 steps total: 0=welcome through 6=summary, plus new 4=download and 5=gpu steps)
- **Cache directory:** `clearModelCache` removes `hub/` subdirectory only, not the entire `modelCachePath`, preserving the user's chosen folder

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed store.get type errors in new IPC handlers**
- **Found during:** Task 1 verification (TypeScript compilation check)
- **Issue:** New handlers using `store.get("setup.modelCachePath")` and `store.get("setup.gpuEnabled")` produced TypeScript errors because electron-store types return `{} | undefined`, not the concrete field type
- **Fix:** Added explicit type casts (`as string`, `as boolean`) at each store.get call site in the new handlers — same approach needed in pre-existing handlers but left those as pre-existing issues
- **Files modified:** desktop/src/main/ipc.ts
- **Verification:** `npx tsc --noEmit` in desktop directory shows only 2 pre-existing errors (index.ts:44 and store.ts:30), no new errors
- **Committed in:** 1c31870 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/type error)
**Impact on plan:** Necessary type correctness fix. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in both `desktop/` (2 errors: electron-store projectName option, index.ts store.get) and `frontend/` (~13 errors in SetupWizard components). None introduced by this plan. Verified by stash/unstash comparison.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (Frontend GPU Config UI) can now call `window.paragrafSetup.switchGpu(true/false)`, `getGpuPreference()`, `clearModelCache()`, and `getCacheSize()` — all IPC bridges are in place
- TypeScript types fully declared so Plan 03 components get autocomplete and type checking
- D-07 and D-09 patterns implemented at the IPC layer (no frontend logic needed for fallback behavior)

---
*Phase: 16-model-download-gpu-configuration*
*Completed: 2026-03-31*

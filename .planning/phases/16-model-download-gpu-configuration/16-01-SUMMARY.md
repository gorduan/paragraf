---
phase: 16-model-download-gpu-configuration
plan: 01
subsystem: api
tags: [fastapi, huggingface_hub, sse, model-download, gpu-detection, cache-management]

# Dependency graph
requires: []
provides:
  - ModelManager service with SSE byte-level download progress, status, cache, GPU detection
  - POST /api/models/download (SSE streaming, concurrent lock, 409 protection)
  - GET /api/models/status (per-model downloaded/size info)
  - GET /api/models/cache (cache path, total size, free space)
  - DELETE /api/models/cache (removes hub/ directory)
  - GET /api/settings/gpu (extended with nvidia-smi + torch.cuda, GpuDetectionResponse)
affects:
  - "16-02 GPU config plan: reuses ModelManager.detect_gpu()"
  - "16-03 frontend plan: consumes all 5 new endpoints"

# Tech tracking
tech-stack:
  added:
    - huggingface_hub (hf_hub_download, list_repo_files, snapshot_download)
    - asyncio.Lock for download concurrency control
    - subprocess.check_output for nvidia-smi
  patterns:
    - "SSE generator pattern: async generator yielding dict events"
    - "Manual lock acquire/release in async generator (can't use async with)"
    - "sys.modules patching in tests for optional heavy dependencies (torch, huggingface_hub)"

key-files:
  created:
    - backend/src/paragraf/services/model_manager.py
    - backend/tests/test_model_manager.py
  modified:
    - backend/src/paragraf/api_models.py
    - backend/src/paragraf/api.py

key-decisions:
  - "Use hf_hub_download per-file (not snapshot_download) for byte-level progress per RESEARCH.md Pitfall 1"
  - "Manual lock acquire/release in async generators instead of async with (Python limitation)"
  - "nvidia-smi subprocess as primary GPU detection, torch.cuda as fallback (per RESEARCH.md D-04)"
  - "Test heavy dependencies (torch, huggingface_hub) via sys.modules patching to avoid install requirement"

patterns-established:
  - "ModelManager: instantiated once in _register_routes(), not tied to AppContext (independent service)"
  - "SSE events use dict (not Pydantic) for flexibility in generator context"
  - "concurrent download check: if self._download_lock.locked() before acquire for early rejection"

requirements-completed: [MODEL-01, MODEL-02, MODEL-04]

# Metrics
duration: 15min
completed: 2026-03-31
---

# Phase 16 Plan 01: Model Download Backend Summary

**ModelManager service with hf_hub_download per-file SSE progress, asyncio.Lock concurrency protection, nvidia-smi+torch.cuda GPU detection, and 5 new FastAPI endpoints**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-31T19:20:00Z
- **Completed:** 2026-03-31T19:36:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `ModelManager` service class with all 5 required methods (download_models, get_model_status, get_cache_info, clear_cache, detect_gpu)
- Added 7 new Pydantic models to api_models.py (ModelDownloadEvent, ModelInfo, ModelStatusResponse, ModelCacheEntry, CacheInfoResponse, GpuDetectionResponse)
- Wired 5 new/extended API endpoints in api.py and extended GET /api/settings/gpu with GpuDetectionResponse
- 13 unit tests covering all methods, all passing

## Task Commits

1. **Task 1: ModelManager service + Pydantic models** - `c56fe8d` (feat)
2. **Task 2: Wire API endpoints to ModelManager** - `3b35bda` (feat)

## Files Created/Modified

- `backend/src/paragraf/services/model_manager.py` - ModelManager class: download/status/cache/GPU with SSE streaming, retry logic, concurrent download lock
- `backend/src/paragraf/api_models.py` - Added ModelDownloadEvent, ModelInfo, ModelStatusResponse, ModelCacheEntry, CacheInfoResponse, GpuDetectionResponse
- `backend/src/paragraf/api.py` - Import ModelManager + new models; 5 new/extended endpoints; ModelManager initialized in _register_routes
- `backend/tests/test_model_manager.py` - 13 unit tests covering all ModelManager methods

## Decisions Made

- Used `hf_hub_download` per-file (not `snapshot_download`) for byte-level progress, then `snapshot_download` afterwards for config files — per RESEARCH.md Pitfall 1
- Manual lock acquire/release in async generator rather than `async with` (Python limitation: can't use context managers in async generators)
- GPU detection: try nvidia-smi subprocess first (5s timeout), then torch.cuda as fallback
- Test isolation: use `sys.modules` patching for `torch` and `huggingface_hub` since these are not installed in the local Python 3.13 test environment (Docker-only project)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed async generator lock incompatibility**
- **Found during:** Task 1 (ModelManager download_models implementation)
- **Issue:** Python does not allow `async with` context managers in async generators. Initial implementation used `async with self._download_lock:` which would fail at runtime.
- **Fix:** Changed to manual `await self._download_lock.acquire()` before the generator body, with `self._download_lock.release()` in the `finally` block
- **Files modified:** backend/src/paragraf/services/model_manager.py
- **Verification:** Tests pass; lock correctly prevents concurrent downloads
- **Committed in:** c56fe8d (Task 1 commit)

**2. [Rule 1 - Bug] Fixed test mocking for non-installed dependencies**
- **Found during:** Task 1 (test execution)
- **Issue:** Tests used `patch("torch.cuda.is_available", ...)` and `patch("huggingface_hub.list_repo_files", ...)` but these modules are not installed in the local Python 3.13 environment — patching non-imported modules fails with ModuleNotFoundError
- **Fix:** Switched to `patch.dict(sys.modules, {"torch": fake_torch})` pattern using `types.ModuleType` for fake modules. For `huggingface_hub`, created a `_make_hf_mock()` helper method.
- **Files modified:** backend/tests/test_model_manager.py
- **Verification:** All 13 tests pass
- **Committed in:** c56fe8d (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

- Python 3.12+ requirement in pyproject.toml conflicted with locally-installed Python 3.10. Tests run successfully with Python 3.13 (`py -3.13`) using `PYTHONPATH=src`.

## Known Stubs

None - all data flows are wired. ModelManager reads actual filesystem state for status/cache, calls actual subprocess for GPU detection, uses actual huggingface_hub for downloads.

## Next Phase Readiness

- ModelManager service fully functional, ready for Plan 02 (GPU configuration) to call `model_manager.detect_gpu()` and extend GPU endpoints
- All 5 endpoints ready for Plan 03 (frontend UI) to consume
- `GpuDetectionResponse` is a superset of old `GpuInfoResponse` — backwards compatible for existing frontend SettingsPage

## Self-Check: PASSED

- [x] backend/src/paragraf/services/model_manager.py exists
- [x] backend/tests/test_model_manager.py exists
- [x] 16-01-SUMMARY.md exists
- [x] Commit c56fe8d (Task 1) exists
- [x] Commit 3b35bda (Task 2) exists

---
*Phase: 16-model-download-gpu-configuration*
*Completed: 2026-03-31*

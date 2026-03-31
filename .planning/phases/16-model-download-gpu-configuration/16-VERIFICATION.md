---
phase: 16-model-download-gpu-configuration
verified: 2026-03-31T20:00:00Z
status: human_needed
score: 19/19 must-haves verified
human_verification:
  - test: "Run setup wizard in Electron app — navigate to step 5 (Modelle) and trigger download"
    expected: "Progress bars appear per model showing downloaded bytes, speed in MB/s, and ETA. Disk space warning appears if <5 GB free. Next button remains disabled until both models are marked complete."
    why_human: "SSE streaming rendering and progress bar animation cannot be verified without a running Docker stack and HuggingFace connectivity."
  - test: "In setup wizard step 6 (GPU), open on a machine without NVIDIA GPU"
    expected: "Step auto-detects no GPU, shows 'Kein NVIDIA-GPU erkannt', and offers Skip button only (no Enable toggle)."
    why_human: "GPU detection path in GpuDetectionStep depends on runtime nvidia-smi / torch.cuda output."
  - test: "In Settings page, toggle GPU switch on a CPU-only machine"
    expected: "Error alert (role=alert) appears with failure message. GPU preference reverts to CPU (D-09 fallback)."
    why_human: "D-09 fallback path requires Docker Compose restart to fail, which needs a running app."
  - test: "In Settings page, click 'Cache loeschen' confirmation dialog"
    expected: "alertdialog modal appears. Confirm clears cache and resets download step (next app start re-shows download step). Cancel leaves cache intact."
    why_human: "D-07 setup state reset requires verifying electron-store value after IPC call."
---

# Phase 16: Model Download and GPU Configuration Verification Report

**Phase Goal:** Model download with progress, GPU detection and configuration, cache management
**Verified:** 2026-03-31T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/models/download streams SSE events with per-model byte-level progress | VERIFIED | `api.py:344-356` SSE generator via `model_manager.download_models()`, `model_manager.py:46-126` async generator with `hf_hub_download` per-file |
| 2 | GET /api/models/status returns which models are downloaded and their sizes | VERIFIED | `api.py:358-362`, `model_manager.py:212-254` reads hub dir, checks safetensors files |
| 3 | GET /api/models/cache returns cache path, total size, free space, per-model breakdown | VERIFIED | `api.py:364-368`, `model_manager.py:256-295` shutil.disk_usage + rglob |
| 4 | DELETE /api/models/cache removes the hub directory and returns success | VERIFIED | `api.py:370-373`, `model_manager.py:297-314` shutil.rmtree |
| 5 | GET /api/settings/gpu returns nvidia-smi data in addition to torch.cuda | VERIFIED | `api.py:337-340` returns `GpuDetectionResponse`, `model_manager.py:316-371` subprocess nvidia-smi + torch.cuda fallback |
| 6 | Concurrent download requests are rejected with 409 status | VERIFIED | `api.py:347-348` `if model_manager._downloading: return JSONResponse(status_code=409, ...)` |
| 7 | Electron IPC can trigger Docker Compose restart with or without GPU overlay file | VERIFIED | `docker.ts:111-124` `startDockerCompose(cachePath, gpuEnabled)` appends `-f docker-compose.gpu.yml` when enabled |
| 8 | Electron IPC can query and change the GPU preference (stored in electron-store) | VERIFIED | `ipc.ts:96-119` `setup:switchGpu` stores preference, `setup:getGpuPreference` reads it |
| 9 | Electron IPC can clear the model cache directory on the host | VERIFIED | `ipc.ts:121-139` `setup:clearModelCache` removes hub/ via fs.rm recursive |
| 10 | Clearing model cache resets setup state so download step is shown on next app start (D-07) | VERIFIED | `ipc.ts:129-131` sets `setup.setupStep=4` and `setup.setupComplete=false` |
| 11 | Electron IPC can change the model cache path and store it persistently | VERIFIED | Pre-existing from earlier phase, `store.ts` includes `modelCachePath` |
| 12 | Preload bridge exposes all new IPC methods to the renderer | VERIFIED | `preload/index.ts:26-29` exposes switchGpu, getGpuPreference, clearModelCache, getCacheSize |
| 13 | TypeScript types declare all new IPC methods for the frontend | VERIFIED | `electron.d.ts:37-40` declares all 4 methods with correct return types |
| 14 | Setup wizard shows model download step with per-model progress bars showing %, bytes, speed, ETA | VERIFIED | `ModelDownloadStep.tsx:220` role=progressbar, `232-234` renders downloadedBytes/totalBytes/speedMbps, 322 lines |
| 15 | Setup wizard shows GPU detection step that auto-detects GPU and offers enable/skip | VERIFIED | `GpuDetectionStep.tsx:23` calls `api.gpuDetection()`, `:39` calls `switchGpu(true)`, 164 lines |
| 16 | Download step blocks wizard progression until all models are downloaded | VERIFIED | `ModelDownloadStep.tsx:300-303` Next button only rendered when `status === "complete"` |
| 17 | Settings page has GPU toggle that triggers Docker restart with feedback | VERIFIED | `SettingsPage.tsx:62` calls `paragrafSetup?.switchGpu()`, `:265` role=alert for errors |
| 18 | Settings page has cache management section showing path, sizes, per-model breakdown, and delete button | VERIFIED | `SettingsPage.tsx:291-332` renders cacheInfo.cache_path, total_size_mb, free_space_mb, per-model m.size_mb |
| 19 | Disk space warning appears when <5GB free before download | VERIFIED | `ModelDownloadStep.tsx:84-86` handles disk_warning event, `:171-179` renders warning with freeGb value |

**Score:** 19/19 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/paragraf/services/model_manager.py` | ModelManager class with download, status, cache, GPU detection | VERIFIED | 372 lines, all 5 methods present, asyncio.Lock, hf_hub_download, nvidia-smi subprocess |
| `backend/src/paragraf/api_models.py` | New Pydantic models including ModelDownloadEvent | VERIFIED | ModelDownloadEvent, ModelInfo, ModelStatusResponse, ModelCacheEntry, CacheInfoResponse, GpuDetectionResponse all present |
| `backend/src/paragraf/api.py` | New endpoints wired to ModelManager | VERIFIED | 5 endpoints at lines 337-373, ModelManager imported and instantiated |
| `backend/tests/test_model_manager.py` | Unit tests, min 100 lines | VERIFIED | 254 lines, 13 test functions |
| `desktop/src/main/ipc.ts` | New IPC handlers for GPU switch, cache clear, cache path change | VERIFIED | 4 new handlers: switchGpu, getGpuPreference, clearModelCache, getCacheSize |
| `desktop/src/main/docker.ts` | startDockerCompose accepts gpuEnabled parameter | VERIFIED | Signature `startDockerCompose(modelCachePath?, gpuEnabled?)`, getGpuComposeFilePath() helper |
| `desktop/src/main/store.ts` | gpuEnabled field in SetupState | VERIFIED | `gpuEnabled: boolean` in interface and defaults |
| `desktop/src/preload/index.ts` | Preload bridge with switchGpu, clearModelCache, getGpuPreference | VERIFIED | All 4 methods exposed via ipcRenderer.invoke |
| `frontend/src/types/electron.d.ts` | TypeScript declarations for new IPC methods | VERIFIED | All 4 methods with full return type signatures, SetupState.gpuEnabled |
| `frontend/src/components/SetupSteps/ModelDownloadStep.tsx` | Wizard step for model download with SSE progress | VERIFIED | 322 lines, api.downloadModels SSE stream, role=progressbar, throttled updates |
| `frontend/src/components/SetupSteps/GpuDetectionStep.tsx` | Wizard step for GPU auto-detection | VERIFIED | 164 lines, api.gpuDetection(), paragrafSetup?.switchGpu() |
| `frontend/src/components/SetupWizard.tsx` | Updated wizard with 7 steps including download and GPU | VERIFIED | 7 STEPS array with "download" and "gpu", both new components imported and rendered |
| `frontend/src/pages/SettingsPage.tsx` | GPU toggle section and cache management section | VERIFIED | GPU-Konfiguration section with switchGpu, Model-Cache section with cacheInfo data flow |
| `frontend/src/lib/api.ts` | New API methods: downloadModels, modelStatus, cacheInfo, clearCache | VERIFIED | downloadModels (SSE), modelStatus, cacheInfo, clearCache, gpuDetection all present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/src/paragraf/api.py` | `backend/src/paragraf/services/model_manager.py` | ModelManager instance in app state | WIRED | `from paragraf.services.model_manager import ModelManager`, `model_manager = ModelManager()` at line 291 |
| `backend/src/paragraf/api.py` | `backend/src/paragraf/api_models.py` | response_model imports | WIRED | `ModelStatusResponse`, `CacheInfoResponse`, `GpuDetectionResponse` imported at lines 20, 29, 50 |
| `desktop/src/main/ipc.ts` | `desktop/src/main/docker.ts` | startDockerCompose with gpuEnabled parameter | WIRED | `ipc.ts:96-115` calls `startDockerCompose(cachePath, enabled)` |
| `desktop/src/preload/index.ts` | `desktop/src/main/ipc.ts` | ipcRenderer.invoke | WIRED | setup:switchGpu, setup:clearModelCache, setup:getGpuPreference all bridged |
| `frontend/src/components/SetupSteps/ModelDownloadStep.tsx` | `/api/models/download` | api.downloadModels SSE stream | WIRED | `api.downloadModels(handleProgress)` at line 155 |
| `frontend/src/components/SetupSteps/GpuDetectionStep.tsx` | `/api/settings/gpu` | api.gpuDetection fetch | WIRED | `api.gpuDetection().then(...)` at line 23 |
| `frontend/src/pages/SettingsPage.tsx` | `window.paragrafSetup` | Electron IPC for GPU switch and cache management | WIRED | `paragrafSetup?.switchGpu()`, `paragrafSetup?.clearModelCache()`, `paragrafSetup?.getCacheSize()` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `SettingsPage.tsx` (cache section) | `cacheInfo` | `api.cacheInfo()` -> `GET /api/models/cache` -> `model_manager.get_cache_info()` | Yes — shutil.disk_usage + rglob filesystem walk | FLOWING |
| `SettingsPage.tsx` (GPU section) | `gpuInfo` | `api.gpuDetection()` -> `GET /api/settings/gpu` -> `model_manager.detect_gpu()` | Yes — subprocess nvidia-smi + torch.cuda | FLOWING |
| `ModelDownloadStep.tsx` | `models[].downloadedBytes` | SSE stream `api.downloadModels()` -> `POST /api/models/download` -> `model_manager.download_models()` | Yes — hf_hub_download byte counter via _ProgressTqdm | FLOWING |
| `ModelDownloadStep.tsx` (initial) | models status on mount | `api.modelStatus()` -> `GET /api/models/status` -> `model_manager.get_model_status()` | Yes — rglob safetensors file check on filesystem | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ModelManager file exists and has class | grep -c "class ModelManager" model_manager.py | 1 | PASS |
| All 5 endpoint paths registered in api.py | grep -c "api/models\|api/settings/gpu" api.py | 4+ hits | PASS |
| 13 test functions exist in test file | grep -c "def test_" test_model_manager.py | 13 | PASS |
| IPC handlers cover all 4 new methods | grep -c "ipcMain.handle.*setup:" ipc.ts | 4+ new handles | PASS |
| Backend import — Docker-only project, no local deps | n/a | SKIPPED (Docker-only project, no local deps installed) | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MODEL-01 | 16-01, 16-03 | ML-Modelle (~4GB) werden beim ersten Start automatisch heruntergeladen mit Fortschrittsbalken | SATISFIED | ModelDownloadStep.tsx renders SSE progress bars; api.py SSE endpoint; ModelManager hf_hub_download per-file |
| MODEL-02 | 16-01, 16-02, 16-03 | GPU/CUDA wird automatisch erkannt und konfiguriert (nvidia-smi + torch.cuda) | SATISFIED | model_manager.detect_gpu() uses subprocess nvidia-smi + torch fallback; GpuDetectionStep auto-detects |
| MODEL-03 | 16-02, 16-03 | Nutzer kann zwischen CPU und GPU zur Laufzeit wechseln (Settings) | SATISFIED | SettingsPage GPU toggle calls paragrafSetup?.switchGpu(); IPC restarts Docker with/without gpu overlay |
| MODEL-04 | 16-01, 16-02, 16-03 | Model-Cache kann in den Einstellungen verwaltet werden (Pfad, Groesse, Loeschen) | SATISFIED | SettingsPage Model-Cache section shows path/sizes/per-model; clearCache IPC resets D-07 state |

All 4 requirement IDs declared across plans are accounted for and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No stubs, placeholder returns, empty implementations, or TODO/FIXME markers detected in the phase artifacts.

### Human Verification Required

#### 1. Model Download Progress in Setup Wizard

**Test:** Run `docker compose up --build`, open the Electron app, proceed to wizard step 5 (Modelle). Trigger download with models not yet cached.
**Expected:** Both BAAI/bge-m3 and BAAI/bge-reranker-v2-m3 show individual progress bars with live-updating downloaded bytes, MB/s speed, and ETA. If disk has <5 GB free, amber warning panel appears above progress bars. "Weiter" button is disabled/hidden until both bars reach 100%.
**Why human:** SSE streaming rendering and live UI updates cannot be verified without a running Docker stack and active HuggingFace download.

#### 2. GPU Detection Step (CPU-only Machine)

**Test:** On a machine without NVIDIA GPU, proceed to wizard step 6 (GPU).
**Expected:** Step auto-detects no GPU within ~5 seconds, displays "Kein NVIDIA-GPU erkannt" message, shows only "Überspringen" button (no "GPU aktivieren" toggle).
**Why human:** nvidia-smi subprocess and torch.cuda detection path requires the actual Docker container environment.

#### 3. Settings Page GPU Toggle Failure (D-09)

**Test:** In Settings page, toggle GPU switch to enabled on a machine that fails Docker restart with GPU overlay.
**Expected:** Toggle shows loading state, then an amber/red `role="alert"` error message appears with the failure detail. The toggle reverts to CPU position. Docker restarts in CPU mode.
**Why human:** D-09 CPU fallback path requires Docker Compose restart failure, which cannot be simulated without a running app.

#### 4. Cache Delete Confirmation and D-07 Reset

**Test:** In Settings page, click "Cache loeschen" button. Confirm in the alertdialog. Close and reopen the app.
**Expected:** After confirm: cache section shows 0 GB. On next app start: setup wizard opens at step 4 (Modelle) instead of directly launching — confirming D-07 setupStep=4 / setupComplete=false reset was stored.
**Why human:** D-07 setup state reset verification requires reading electron-store value after IPC call and restarting the Electron app.

### Gaps Summary

No gaps found. All 19 observable truths are verified, all 14 required artifacts exist and are substantively implemented, all 7 key links are wired, and all 4 requirement IDs are satisfied.

The 4 human verification items are behavioral/runtime checks that require a running Docker + Electron stack — they cannot be verified statically.

---

_Verified: 2026-03-31T20:00:00Z_
_Verifier: Claude (gsd-verifier)_

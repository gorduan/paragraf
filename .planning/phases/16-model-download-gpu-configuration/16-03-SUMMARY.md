---
plan: "16-03"
phase: "16-model-download-gpu-configuration"
status: checkpoint
started: "2026-03-31T17:30:00Z"
completed: "2026-03-31T18:00:00Z"
tasks_completed: 2
tasks_total: 3
---

# Plan 16-03 Summary: Frontend UI for Model Download + GPU

## What Was Built

### Task 1: API client methods + ModelDownloadStep + GpuDetectionStep
- **frontend/src/lib/api.ts**: 4 new types (ModelDownloadEvent, ModelStatusResponse, CacheInfoResponse, GpuDetectionResponse), 5 new API methods (downloadModels SSE, modelStatus, cacheInfo, clearCache, gpuDetection)
- **frontend/src/components/SetupSteps/ModelDownloadStep.tsx**: Wizard step showing per-model progress bars with bytes/speed/ETA, disk space warning, auto-skip if models already downloaded, throttled UI updates
- **frontend/src/components/SetupSteps/GpuDetectionStep.tsx**: Wizard step auto-detecting GPU via `/api/settings/gpu`, offers enable/skip, D-09 CPU fallback on failure

### Task 2: Wire wizard steps + extend SettingsPage
- **frontend/src/components/SetupWizard.tsx**: Updated from 5 to 7 steps (added download at index 4, gpu at index 5)
- **frontend/src/pages/SettingsPage.tsx**: New GPU-Konfiguration section with toggle (role="switch", aria-checked, D-09 error alert), new Model-Cache section with path/sizes/per-model breakdown/delete with confirmation dialog (role="alertdialog", D-07 IPC reset)

### Task 3: Visual verification (CHECKPOINT — awaiting human)
Requires manual testing of wizard flow and settings page.

## Key Files

### Created
- frontend/src/components/SetupSteps/ModelDownloadStep.tsx
- frontend/src/components/SetupSteps/GpuDetectionStep.tsx

### Modified
- frontend/src/lib/api.ts
- frontend/src/components/SetupWizard.tsx
- frontend/src/pages/SettingsPage.tsx

## Deviations

None.

## Self-Check: PASSED

- [x] ModelDownloadStep consumes SSE stream with role="progressbar" and aria-live="polite"
- [x] GpuDetectionStep calls api.gpuDetection and paragrafSetup?.switchGpu
- [x] SetupWizard has 7 steps in correct order
- [x] SettingsPage GPU toggle with D-09 error display (role="alert")
- [x] SettingsPage cache delete with confirmation dialog (role="alertdialog")
- [x] SettingsPage cache clear uses IPC for D-07 setup state reset
- [x] No new TypeScript errors introduced (pre-existing errors from StorageEstimate naming conflict remain)

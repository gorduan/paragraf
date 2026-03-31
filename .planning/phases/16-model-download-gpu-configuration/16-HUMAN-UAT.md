---
status: partial
phase: 16-model-download-gpu-configuration
source: [16-VERIFICATION.md]
started: "2026-03-31T20:00:00Z"
updated: "2026-03-31T20:00:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. SSE download progress rendering in setup wizard
expected: Progress bars appear per model showing downloaded bytes, speed in MB/s, and ETA. Disk space warning appears if <5 GB free. Next button remains disabled until both models are marked complete.
result: [pending]

### 2. GPU detection on CPU-only machine
expected: Step auto-detects no GPU, shows "Keine NVIDIA-GPU erkannt", and offers Skip button only.
result: [pending]

### 3. GPU toggle failure in Settings (D-09 fallback)
expected: Error alert (role=alert) appears with failure message. GPU preference reverts to CPU.
result: [pending]

### 4. Cache delete with setup state reset (D-07)
expected: alertdialog modal appears. Confirm clears cache and resets download step (next app start re-shows download step). Cancel leaves cache intact.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

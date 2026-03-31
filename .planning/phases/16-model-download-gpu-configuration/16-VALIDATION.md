---
phase: 16
slug: model-download-gpu-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend), vitest (frontend) |
| **Config file** | `backend/pyproject.toml`, `frontend/vite.config.ts` |
| **Quick run command** | `docker compose exec backend python -m pytest tests/ -x -q` |
| **Full suite command** | `docker compose exec backend python -m pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose exec backend python -m pytest tests/ -x -q`
- **After every plan wave:** Run `docker compose exec backend python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | MODEL-01 | unit | `pytest tests/test_download.py` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | MODEL-01 | integration | `pytest tests/test_download.py -k sse` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | MODEL-02 | unit | `pytest tests/test_gpu.py` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | MODEL-02 | integration | `pytest tests/test_gpu.py -k detection` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 2 | MODEL-03 | unit | `pytest tests/test_gpu.py -k switch` | ❌ W0 | ⬜ pending |
| 16-04-01 | 04 | 2 | MODEL-04 | unit | `pytest tests/test_cache.py` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_download.py` — stubs for MODEL-01 (download progress, resume, SSE streaming)
- [ ] `backend/tests/test_gpu.py` — stubs for MODEL-02, MODEL-03 (GPU detection, CPU/GPU switching)
- [ ] `backend/tests/test_cache.py` — stubs for MODEL-04 (cache info, cache deletion)

*Existing test infrastructure (pytest, conftest.py) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Download progress bar renders correctly | MODEL-01 | Visual UI verification | Open app, trigger model download, verify progress bars show per-model progress with speed and ETA |
| GPU toggle in Settings triggers restart feedback | MODEL-03 | Requires Docker restart observation | Toggle CPU/GPU in Settings, verify HealthOverlay shows restart message |
| Cache deletion confirmation dialog | MODEL-04 | UI interaction flow | Navigate to Settings > Cache, click delete, verify confirmation dialog appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

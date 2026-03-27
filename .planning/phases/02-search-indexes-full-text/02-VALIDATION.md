---
phase: 2
slug: search-indexes-full-text
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-27
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.0+ with pytest-asyncio (asyncio_mode = "auto") |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `docker compose exec backend python -m pytest tests/test_qdrant_store.py tests/test_models.py -x -v` |
| **Full suite command** | `docker compose exec backend python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose exec backend python -m pytest tests/test_qdrant_store.py tests/test_models.py -x -v`
- **After every plan wave:** Run `docker compose exec backend python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Test files are created within the same task that implements the production code. No separate Wave 0 plan is needed — existing test files (`test_qdrant_store.py`, `test_models.py`) are extended in Plan 02-01, and new test files (`test_integration.py`, `test_search_tool.py`) are created in Plan 02-02.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Created By | Status |
|---------|------|------|-------------|-----------|-------------------|------------|--------|
| 02-01-01 | 01 | 1 | INFRA-03 | unit | `python -m pytest tests/test_qdrant_store.py::TestQdrantStoreIndexes -x` | Plan 01 Task 1 | pending |
| 02-01-02 | 01 | 1 | INFRA-04 | unit | `python -m pytest tests/test_qdrant_store.py::TestQdrantStoreIndexes -x` | Plan 01 Task 1 | pending |
| 02-01-03 | 01 | 1 | INFRA-04 | unit | `python -m pytest tests/test_qdrant_store.py::TestBuildFilterRange -x` | Plan 01 Task 1 | pending |
| 02-01-04 | 01 | 1 | SRCH-06 | unit | `python -m pytest tests/test_qdrant_store.py::TestQdrantStoreFulltext -x` | Plan 01 Task 1 | pending |
| 02-02-01 | 02 | 2 | SRCH-06 | unit | `python -m pytest tests/test_models.py -x` | Plan 01 Task 1 | pending |
| 02-02-02 | 02 | 2 | SRCH-06 | unit | `python -m pytest tests/test_integration.py -x` | Plan 02 Task 2 | pending |
| 02-02-03 | 02 | 2 | SRCH-06 | unit | `python -m pytest tests/test_search_tool.py -x` | Plan 02 Task 2 | pending |

*Status: pending / green / red / flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Index creation on live Qdrant | INFRA-03, INFRA-04 | Requires running Qdrant with data | `POST /api/indexes/ensure`, verify 200 response with `created` list |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Test files created by the same plan that implements production code
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

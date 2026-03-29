---
phase: 4
slug: recommend-pagination
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x with pytest-asyncio |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `docker compose exec backend python -m pytest tests/ -v -x --timeout=30` |
| **Full suite command** | `docker compose exec backend python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose exec backend python -m pytest tests/ -v -x --timeout=30`
- **After every plan wave:** Run `docker compose exec backend python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SRCH-01 | unit | `pytest tests/test_qdrant_store.py -v -k recommend` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | SRCH-04 | unit | `pytest tests/test_qdrant_store.py -v -k scroll` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | SRCH-08 | unit | `pytest tests/test_qdrant_store.py -v -k batch` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | SRCH-01 | integration | `pytest tests/test_api.py -v -k recommend` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | SRCH-04 | integration | `pytest tests/test_api.py -v -k pagination` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | SRCH-08 | integration | `pytest tests/test_api.py -v -k batch` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | MCP-01 | unit | `pytest tests/test_mcp_tools.py -v -k similar` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | MCP-05 | unit | `pytest tests/test_mcp_tools.py -v -k abschnitt` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_recommend.py` — stubs for SRCH-01 (recommend), SRCH-04 (scroll pagination)
- [ ] `tests/test_batch_search.py` — stubs for SRCH-08 (batch search)
- [ ] `tests/test_mcp_similar.py` — stubs for MCP-01 (paragraf_similar tool), MCP-05 (abschnitt filter)

*Existing pytest infrastructure covers framework needs — no new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| load_warning signal under high batch load | SRCH-08 | Requires simulated load conditions | Submit 10 concurrent batch queries, verify `load_warning: true` in response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

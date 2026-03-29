---
phase: 5
slug: grouping-discovery-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >=8.0.0 + pytest-asyncio >=0.23.0 |
| **Config file** | `backend/pyproject.toml` (`asyncio_mode = "auto"`) |
| **Quick run command** | `cd backend && python -m pytest tests/test_qdrant_store.py tests/test_api_models.py -x -q` |
| **Full suite command** | `docker compose exec backend python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SRCH-03 | unit | `cd backend && python -m pytest tests/test_qdrant_store.py -k "grouped_search" -x` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | SRCH-02 | unit | `cd backend && python -m pytest tests/test_qdrant_store.py -k "discover" -x` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | SRCH-05 | unit | `cd backend && python -m pytest tests/test_qdrant_store.py -k "grouped_recommend" -x` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | SRCH-03 | unit | `cd backend && python -m pytest tests/test_api_models.py -k "grouped" -x` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | SRCH-02 | unit | `cd backend && python -m pytest tests/test_api_models.py -k "discover" -x` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | MCP-02 | unit | `cd backend && python -m pytest tests/test_discover_tool.py -x` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | MCP-07 | unit | `cd backend && python -m pytest tests/test_grouped_search_tool.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_discover_tool.py` — stubs for MCP-02 (paragraf_discover tool)
- [ ] `tests/test_grouped_search_tool.py` — stubs for MCP-07 (paragraf_grouped_search + paragraf_similar_grouped)
- [ ] New test cases in `tests/test_qdrant_store.py` for `discover()`, `grouped_search()`, `grouped_recommend()`
- [ ] New test cases in `tests/test_api_models.py` for DiscoverRequest, GroupedSearchRequest, GroupedRecommendRequest validation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Qdrant query_points_groups returns correctly grouped results | SRCH-03 | Requires running Qdrant with indexed data | Run `docker compose up`, index a law, call `/api/search/grouped` |
| Discovery API with real embeddings produces meaningful results | SRCH-02 | Requires ML models loaded | Run `docker compose up`, call `/api/discover` with known point IDs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

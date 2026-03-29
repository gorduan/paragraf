---
phase: 7
slug: query-expansion-chunking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x with pytest-asyncio |
| **Config file** | `backend/pyproject.toml` |
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
| 07-01-xx | 01 | 1 | SRCH-07 | unit | `pytest tests/test_query_expander.py -v` | ❌ W0 | ⬜ pending |
| 07-02-xx | 02 | 1 | CHUNK-01, CHUNK-02 | unit | `pytest tests/test_chunking.py -v` | ❌ W0 | ⬜ pending |
| 07-03-xx | 03 | 2 | MCP-04 | unit | `pytest tests/test_multi_hop.py -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_query_expander.py` — stubs for SRCH-07 (synonym expansion, normalization)
- [ ] `tests/test_chunking.py` — stubs for CHUNK-01, CHUNK-02 (satz splitting, absatz boundaries)
- [ ] `tests/test_multi_hop.py` — stubs for MCP-04 (multi-hop traversal, circular reference protection)

*Existing pytest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Expanded terms visible in API response | SRCH-07 | Requires actual search query | `curl POST /api/search` with "GdB" query, verify `expanded_terms` field |
| Multi-hop MCP prompt chains search+refs | MCP-04 | Requires MCP client | Test via Claude Desktop with `paragraf_legal_analysis` prompt |
| Re-indexing with new chunking | CHUNK-02 | Requires running Qdrant + full index | Index a law, verify satz/absatz chunks in collection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

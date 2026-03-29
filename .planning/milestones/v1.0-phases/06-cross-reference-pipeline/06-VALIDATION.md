---
phase: 6
slug: cross-reference-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >= 8.0.0, pytest-asyncio >= 0.23.0 (asyncio_mode = "auto") |
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
| 06-01-01 | 01 | 1 | XREF-01 | unit | `pytest tests/test_xref_extractor.py -v` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | XREF-02 | unit | `pytest tests/test_xref_extractor.py -v` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | XREF-03 | unit | `pytest tests/test_qdrant_store.py -v -k xref` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | XREF-04 | unit | `pytest tests/test_api.py -v -k references` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | MCP-03 | unit | `pytest tests/test_mcp_references.py -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_xref_extractor.py` — stubs for XREF-01, XREF-02 (extraction patterns, verified/unverified tagging)
- [ ] `tests/test_qdrant_store.py` — extend with xref payload filter stubs for XREF-03
- [ ] `tests/test_api.py` — extend with reference endpoint stubs for XREF-04
- [ ] `tests/test_mcp_references.py` — stubs for MCP-03 (paragraf_references tool)

*Existing pytest infrastructure covers framework needs. No new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snapshot created before extraction | XREF-03 | Requires running Qdrant instance with data | 1. Index a law 2. Run extraction 3. Verify snapshot exists in Qdrant dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

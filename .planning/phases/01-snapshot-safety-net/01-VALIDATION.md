---
phase: 1
slug: snapshot-safety-net
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio (asyncio_mode = "auto") |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `docker compose exec backend python -m pytest tests/ -v -k snapshot` |
| **Full suite command** | `docker compose exec backend python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose exec backend python -m pytest tests/ -v -k snapshot`
- **After every plan wave:** Run `docker compose exec backend python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFRA-01 | integration | `pytest tests/ -v -k snapshot_create` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INFRA-01 | integration | `pytest tests/ -v -k snapshot_list` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | INFRA-01 | integration | `pytest tests/ -v -k snapshot_restore` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | INFRA-02 | integration | `pytest tests/ -v -k quantization` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | MCP-06 | integration | `pytest tests/ -v -k mcp_snapshot` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | INFRA-01 | integration | `pytest tests/ -v -k auto_snapshot` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_snapshot.py` — stubs for INFRA-01 (create, list, restore, delete snapshot)
- [ ] `tests/test_quantization.py` — stubs for INFRA-02 (scalar quantization activation, search params)
- [ ] `tests/test_mcp_snapshot.py` — stubs for MCP-06 (paragraf_snapshot tool actions)

*Existing pytest infrastructure covers framework needs. Only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snapshot persists across container restart | INFRA-01 | Requires Docker restart cycle | 1. Create snapshot 2. `docker compose down` 3. `docker compose up` 4. List snapshots — verify still present |
| Memory reduction with quantization | INFRA-02 | Requires populated collection + memory measurement | 1. Note Qdrant memory before 2. Enable quantization 3. Compare memory via Qdrant dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

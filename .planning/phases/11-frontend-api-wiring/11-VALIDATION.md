---
phase: 11
slug: frontend-api-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), pytest 8.x (backend) |
| **Config file** | `frontend/vitest.config.ts`, `backend/pyproject.toml` |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run && cd ../backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | SRCH-08, SRCH-05, MCP-04 | unit | `grep -c 'multiHop\|recommendGrouped\|searchBatch' frontend/src/lib/api.ts` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | XREF-01, XREF-02 | unit | `grep -c 'references_out' frontend/src/lib/api.ts` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | MCP-04 | manual | Browser: multi-hop search mode visible | N/A | ⬜ pending |
| 11-02-02 | 02 | 2 | XREF-03 | unit | `grep -c 'extractReferences' frontend/src/lib/api.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (vitest already configured, api.ts patterns established)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-hop search UI surface | MCP-04 | Visual UI component rendering | Navigate to SearchPage, verify "Verweissuche" mode appears and triggers multi-hop API |
| Auto-trigger reference extraction | XREF-03 | Requires full indexing flow | Index a law, verify `/api/references/extract` is called after completion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

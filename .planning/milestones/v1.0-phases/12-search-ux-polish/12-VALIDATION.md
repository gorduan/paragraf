---
phase: 12
slug: search-ux-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 + @testing-library/react 16.3.2 |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | XREF-05 | unit | `cd frontend && npx vitest run src/components/__tests__/ResultCard.test.tsx -t "graph" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | UI-05 | unit | `cd frontend && npx vitest run src/pages/__tests__/SearchPage.test.tsx -t "compare" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | SRCH-07 | unit | `cd frontend && npx vitest run src/pages/__tests__/SearchPage.test.tsx -t "expand" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | SRCH-07 | unit | `cd frontend && npx vitest run src/pages/__tests__/SearchPage.test.tsx -t "announcement" --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/__tests__/ResultCard.test.tsx` — stubs for XREF-05 (onGraphNavigate callback)
- [ ] `frontend/src/pages/__tests__/SearchPage.test.tsx` — stubs for UI-05, SRCH-07 (compare badge, expansion toggle, filter announcement)

*Note: SearchPage is complex with many dependencies. Testing individual handler logic may be more practical than full-page rendering tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Graph page navigation visual | XREF-05 | Requires running app with data | Click "Zitationen" button on ResultCard, verify GraphPage loads with correct paragraph |
| Compare page navigation visual | UI-05 | Requires running app with selections | Add items to compare, click badge, verify ComparePage loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 8
slug: search-results-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) + Vite build |
| **Config file** | `frontend/tsconfig.json`, `frontend/vite.config.ts` |
| **Quick run command** | `cd frontend && npx tsc --noEmit` |
| **Full suite command** | `cd frontend && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx tsc --noEmit`
- **After every plan wave:** Run `cd frontend && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | UI-07, UI-04 | build | `cd frontend && npx tsc --noEmit` | N/A | ⬜ pending |
| 08-01-02 | 01 | 1 | UI-07, UI-04 | build | `cd frontend && npx tsc --noEmit` | N/A | ⬜ pending |
| 08-02-01 | 02 | 1 | UI-02, UI-06 | build | `cd frontend && npx tsc --noEmit` | N/A | ⬜ pending |
| 08-02-02 | 02 | 1 | UI-02, UI-06 | build | `cd frontend && npx tsc --noEmit` | N/A | ⬜ pending |
| 08-03-01 | 03 | 2 | UI-03, UI-05 | build | `cd frontend && npx tsc --noEmit` | N/A | ⬜ pending |
| 08-03-02 | 03 | 2 | UI-03, UI-05 | build | `cd frontend && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript compiler and Vite build provide type-checking and bundle validation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recommend inline expansion animates | UI-02 | CSS animation visual check | Click "Aehnliche finden", verify smooth expand |
| Accordion open/close in grouped view | UI-03 | Visual interaction | Toggle to "Gruppiert", click accordion headers |
| Filter chips appear/remove correctly | UI-04 | Visual interaction | Apply filter, verify chip, click X to remove |
| Search mode toggle visual state | UI-07 | Visual styling | Click each segment, verify active state styling |
| Dark mode compatibility | All | Visual check | Toggle dark mode, verify all new components |
| Responsive layout on mobile | All | Viewport check | Resize to <768px, verify stacking behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

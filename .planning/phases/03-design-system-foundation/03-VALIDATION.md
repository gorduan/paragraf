---
phase: 3
slug: design-system-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd frontend && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UI-01 | build | `cd frontend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | UI-01 | build | `cd frontend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 1 | UI-01 | unit | `cd frontend && npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | UI-01 | unit | `cd frontend && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@testing-library/react` + `jsdom` — install as devDependencies
- [ ] `frontend/vitest.config.ts` — vitest config with jsdom environment and `@` path alias
- [ ] `frontend/src/components/ui/__tests__/` — test directory for primitive components

*Wave 0 tasks will be embedded in Plan 01 as prerequisite tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual regression after SearchPage migration | UI-01 | Visual comparison requires human eye | Build app, navigate to SearchPage, verify layout matches pre-migration appearance in both light/dark mode |
| Dark mode toggle preserves new tokens | UI-01 | Theme switching visual check | Toggle dark mode on/off, verify all indigo/slate tokens switch correctly |
| Keyboard shortcuts (Ctrl+1-7) still work | UI-01 | Interaction testing | Press each shortcut, verify navigation unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

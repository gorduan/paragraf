---
phase: 9
slug: cross-reference-discovery-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd frontend && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | XREF-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | XREF-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | XREF-06, UI-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | XREF-06, UI-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | UI-10 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 2 | UI-10 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/__tests__/CitationLink.test.tsx` — stubs for XREF-05
- [ ] `frontend/src/components/__tests__/GraphCanvas.test.tsx` — stubs for XREF-06, UI-08
- [ ] `frontend/src/components/__tests__/DiscoveryExampleBar.test.tsx` — stubs for UI-10

*Existing vitest infrastructure covers framework needs. Only test file stubs required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Force-directed graph layout readability at various zoom | UI-08 | Visual quality cannot be automated | Open GraphPage, zoom 0.3x-3x, verify node labels readable, edges don't overlap excessively |
| Citation tooltip hover timing (300ms delay) | XREF-05 | Timing interaction requires browser | Hover citation link, verify tooltip appears after ~300ms delay |
| Canvas pan/zoom with mouse/touch | XREF-06 | Requires real browser interaction | Drag canvas to pan, scroll to zoom, pinch on touch device |
| Discovery chip colors (green/red) match design tokens | UI-10 | Visual color verification | Activate discovery mode, add positive/negative examples, verify chip colors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

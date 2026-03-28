---
phase: 10
slug: dashboard-export-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend), vitest (frontend — if installed), manual browser testing |
| **Config file** | `backend/pyproject.toml` (pytest), `frontend/vite.config.ts` (vitest) |
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
| 10-01-XX | 01 | 1 | INFRA-05, UI-12 | manual | Browser: IndexPage snapshot section visible | N/A | ⬜ pending |
| 10-02-XX | 02 | 1 | UI-09 | manual | Browser: export button triggers PDF/MD download | N/A | ⬜ pending |
| 10-03-XX | 03 | 2 | UI-11 | manual | Browser: resize to 768px, verify no layout breakage | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers backend testing. Frontend is primarily manual verification via browser:

- [ ] Verify `docker compose up --build` succeeds with all services healthy
- [ ] Verify existing backend tests still pass after any API changes

*Frontend tests: Phase 10 is UI-focused. Primary validation is manual browser testing across breakpoints.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snapshot create/restore/delete UI | INFRA-05, UI-12 | UI interaction flow with confirmation dialogs | 1. Navigate to IndexPage 2. Click "Snapshot erstellen" 3. Verify snapshot appears in list 4. Click restore icon, confirm dialog 5. Click delete icon, confirm dialog |
| PDF/Markdown export download | UI-09 | Browser download behavior, PDF content verification | 1. Run a search 2. Click "Alles exportieren" > PDF 3. Verify PDF downloads with correct content + RDG disclaimer 4. Repeat for Markdown |
| WCAG 2.1 AA keyboard navigation | UI-11 | Requires manual Tab/Enter/Escape testing | 1. Tab through all interactive elements on each page 2. Verify focus-visible ring 3. Verify Escape closes dialogs/overlays 4. Verify aria-live announcements |
| Responsive tablet layout | UI-11 | Visual layout verification at breakpoints | 1. Resize to 768px width 2. Verify sidebar collapses to hamburger 3. Verify no horizontal overflow 4. Verify 44px touch targets |
| Contrast ratio compliance | UI-11 | Visual verification with dev tools | 1. Inspect muted text uses neutral-500 (not neutral-400) in light mode 2. Check all text meets 4.5:1 ratio |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

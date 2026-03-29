---
phase: 14
slug: electron-shell-docker-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), pytest 8.x (backend — existing), Electron Playwright |
| **Config file** | `desktop/vitest.config.ts` (new), `backend/pyproject.toml` (existing) |
| **Quick run command** | `cd desktop && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd desktop && npx vitest run && cd ../backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd desktop && npx vitest run --reporter=verbose`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | SHELL-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | SHELL-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | SHELL-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | LIFE-01 | unit+integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | LIFE-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `desktop/` — Initialize Electron project with package.json, tsconfig.json
- [ ] `desktop/tests/` — Test directory with vitest config
- [ ] `desktop/tests/docker-lifecycle.test.ts` — Stubs for LIFE-01, LIFE-02
- [ ] `desktop/tests/single-instance.test.ts` — Stubs for SHELL-03
- [ ] `desktop/tests/window-shell.test.ts` — Stubs for SHELL-01, SHELL-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop window renders SPA correctly | SHELL-01 | Requires visual inspection of Electron window | Start app, verify React SPA loads in BrowserWindow |
| Windows Start Menu integration | SHELL-02 | Requires OS-level verification | Build installer, check Start Menu shortcut and icon |
| Single instance lock brings window to front | SHELL-03 | Requires two OS processes | Launch app, try launching second instance, verify first window focuses |
| Docker Compose starts/stops with app | LIFE-01 | Requires Docker daemon running | Start app, verify containers start; close app, verify containers stop |
| Health status overlay in desktop mode | LIFE-02 | Requires running backend stack | Start app without Docker, verify error overlay; start Docker, verify ready state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

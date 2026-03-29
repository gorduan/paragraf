---
phase: 15
slug: windows-installer-setup-wizard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), manual (NSIS installer) |
| **Config file** | `desktop/vitest.config.ts` (may need creation) |
| **Quick run command** | `cd desktop && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd desktop && npx vitest run && npx electron-builder --dir` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd desktop && npx vitest run --reporter=verbose`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | INST-01 | manual | `npx electron-builder --dir` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | INST-01 | manual | NSIS installer output check | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | INST-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | INST-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 2 | INST-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 15-03-02 | 03 | 2 | INST-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `desktop/tests/setup-wizard.test.ts` — stubs for INST-02 through INST-05
- [ ] `desktop/vitest.config.ts` — if no test config exists
- [ ] vitest install — if no test framework detected in desktop/

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NSIS installer welcome screen | INST-01 | GUI interaction | Run built .exe, verify welcome screen, license, directory picker |
| Docker Desktop detection | INST-03 | System-level dependency | Run on system with/without Docker, verify detection |
| Installer file size < 100MB | INST-01 | Build output check | Check `dist/` output size after `electron-builder` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

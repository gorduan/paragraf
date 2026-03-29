---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Desktop Installer
status: ready_to_plan
stopped_at: null
last_updated: "2026-03-29"
last_activity: 2026-03-29
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 10
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Juristen und Buerger installieren Paragraf mit einem Doppelklick -- ohne CLI, ohne Docker-Kenntnisse, ohne technisches Vorwissen.
**Current focus:** Phase 14 - Electron Shell & Docker Lifecycle

## Current Position

Phase: 14 (first of 4 in v2.0 milestone)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-29 -- Roadmap created for v2.0 Desktop Installer milestone

Progress: [░░░░░░░░░░] 0% (0/10 plans across v2.0)

## Performance Metrics

**Velocity (v1.0 reference):**
- Total plans completed: 33
- Average duration: ~4 min/plan
- Total execution time: ~2.2 hours

**v2.0 Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 Research]: Electron 40 + electron-builder over Tauri 2 (no Rust, sidecar lifecycle immature)
- [v2.0 Research]: Thin installer (<100MB) + post-install downloads (NSIS 2GB limit)
- [v2.0 Research]: Docker mode only in v2.0 (native mode deferred to v2.1)
- [v2.0 Research]: tree-kill + short HF_HOME paths from day one

### Pending Todos

None yet.

### Blockers/Concerns

- Code signing certificate needed early for SmartScreen reputation (Azure Trusted Signing ~10 EUR/month)
- Docker Desktop detection needs phase-level research (registry + named pipe + CLI)
- HF_HOME must use short path (C:\ProgramData\Paragraf\models) to avoid MAX_PATH

## Session Continuity

Last session: 2026-03-29
Stopped at: Roadmap created for v2.0 Desktop Installer milestone
Resume file: None

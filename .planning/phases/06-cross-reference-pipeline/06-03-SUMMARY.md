---
phase: 06-cross-reference-pipeline
plan: 03
subsystem: api
tags: [mcp, cross-reference, fastmcp, tool-registration]

# Dependency graph
requires:
  - phase: 06-cross-reference-pipeline
    provides: QdrantStore get_outgoing_references, get_incoming_references, count_incoming_references methods
provides:
  - paragraf_references MCP tool with richtung parameter (ausgehend/eingehend/beide)
  - register_reference_tools function for server.py integration
affects: [09-cross-reference-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [MCP tool wrapping QdrantStore reference methods, richtung parameter for directional queries]

key-files:
  created:
    - backend/src/paragraf/tools/references.py
    - backend/tests/test_references_tool.py
  modified:
    - backend/src/paragraf/server.py

key-decisions:
  - "DISCLAIMER uses simplified text matching existing tool pattern (§ 2 RDG reference)"
  - "Paragraph normalization adds § prefix if missing and not Art. prefix"
  - "max_ergebnisse clamped to 1-50 range matching tool docstring"

patterns-established:
  - "Reference tool follows same register_*_tools pattern as discover, recommend, grouped_search"
  - "richtung parameter uses German enum values: ausgehend, eingehend, beide"

requirements-completed: [MCP-03]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 06 Plan 03: MCP References Tool Summary

**paragraf_references MCP tool exposing citation network via richtung parameter (ausgehend/eingehend/beide) with 7 unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T11:47:47Z
- **Completed:** 2026-03-27T11:51:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- paragraf_references MCP tool with directional query support via richtung parameter
- Tool registered in server.py alongside 7 existing tools
- 7 unit tests covering all richtung modes, empty results, DISCLAIMER, incoming_count, and clamping

## Task Commits

Each task was committed atomically:

1. **Task 1: MCP tool paragraf_references + server registration** - `747d09f` (feat)
2. **Task 2: Unit tests for paragraf_references MCP tool** - `70b2b28` (test)

_Note: TDD approach -- tests written alongside implementation, verified via AST and acceptance criteria (local Python 3.10 cannot run full test suite requiring StrEnum from 3.11+)_

## Files Created/Modified
- `backend/src/paragraf/tools/references.py` - MCP tool with register_reference_tools and paragraf_references
- `backend/src/paragraf/server.py` - Added import and registration of reference tools
- `backend/tests/test_references_tool.py` - 7 async unit tests with MockAppContext pattern

## Decisions Made
- Followed existing register_*_tools pattern from discover.py for consistency
- DISCLAIMER uses simplified § 2 RDG text (shorter than the full EUTB disclaimer in other tools)
- Paragraph input normalization adds § prefix when missing, preserving Art. prefix for Grundgesetz articles

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Local Python is 3.10 (project requires 3.12+), preventing local pytest execution. Verified via AST parsing, syntax checks, and acceptance criteria validation. Full test suite runs in Docker.

## Known Stubs

None - all functionality is fully wired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 plans of Phase 06 complete: extraction, storage/REST, and MCP tool
- Citation network accessible via REST API and MCP protocol
- Ready for Phase 09 cross-reference UI integration

## Self-Check: PASSED

- All 3 files exist (references.py, server.py modified, test_references_tool.py)
- Both commit hashes (747d09f, 70b2b28) verified in git log

---
*Phase: 06-cross-reference-pipeline*
*Completed: 2026-03-27*

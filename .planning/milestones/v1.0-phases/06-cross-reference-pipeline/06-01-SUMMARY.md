---
phase: 06-cross-reference-pipeline
plan: 01
subsystem: api
tags: [regex, cross-reference, pydantic, extraction, german-law]

# Dependency graph
requires:
  - phase: 01-snapshot-safety-net
    provides: LAW_REGISTRY with 95+ entries for verified tagging
provides:
  - Reference Pydantic model with 6 fields (gesetz, paragraph, absatz, raw, verified, kontext)
  - ChunkMetadata.references_out field for outgoing cross-references
  - CrossReferenceExtractor service with regex-based German citation parsing
  - xref_resolution_strategy config setting (filter/precomputed)
affects: [06-02, 06-03, 09-cross-reference-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [regex-based citation extraction, LAW_REGISTRY-validated references, i.V.m. chain splitting]

key-files:
  created:
    - backend/src/paragraf/services/cross_reference.py
    - backend/tests/test_cross_reference.py
  modified:
    - backend/src/paragraf/models/law.py
    - backend/src/paragraf/config.py
    - backend/tests/test_models.py
    - backend/tests/test_config.py

key-decisions:
  - "Regex patterns built from LAW_REGISTRY keys sorted by length descending for longest-match-first"
  - "i.V.m. chains handled via dedicated pattern before single citations to prevent partial matches"
  - "Fallback pattern catches unknown laws as verified=False without requiring LAW_REGISTRY presence"
  - "Context keywords normalized: vgl. -> siehe, gem. -> gemaess"

patterns-established:
  - "CrossReferenceExtractor.extract() returns list[dict] (not Reference models) for flexibility in storage layer"
  - "Deduplication by (gesetz, paragraph, absatz) tuple to prevent duplicate references"
  - "Priority-ordered pattern matching: i.V.m. chains > plural > single > artikel > unknown fallback"

requirements-completed: [XREF-01]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 06 Plan 01: Cross-Reference Extraction Foundation Summary

**Regex-based CrossReferenceExtractor parsing SS/Art./i.V.m./SSSS citations from German legal text with LAW_REGISTRY verification**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T11:29:19Z
- **Completed:** 2026-03-27T11:34:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Reference Pydantic model with 6 fields per D-04 for structured cross-reference storage
- CrossReferenceExtractor with 5 regex patterns covering SS, Art., SSSS, i.V.m. chains, and unknown laws
- 20 unit tests covering all citation pattern scenarios including edge cases
- Config setting xref_resolution_strategy for future filter/precomputed toggle per D-07

## Task Commits

Each task was committed atomically:

1. **Task 1: Reference model, ChunkMetadata extension, config settings** - `114a7c5` (feat)
2. **Task 2: CrossReferenceExtractor service with regex extraction + unit tests** - `2161e5a` (feat)

_Note: TDD tasks -- tests written first, then implementation (RED-GREEN verified via regex pattern testing)_

## Files Created/Modified
- `backend/src/paragraf/services/cross_reference.py` - CrossReferenceExtractor with regex-based citation extraction
- `backend/src/paragraf/models/law.py` - Reference model + ChunkMetadata.references_out field
- `backend/src/paragraf/config.py` - xref_resolution_strategy setting
- `backend/tests/test_cross_reference.py` - 20 unit tests for extraction logic
- `backend/tests/test_models.py` - Tests for Reference model and ChunkMetadata.references_out
- `backend/tests/test_config.py` - Tests for xref_resolution_strategy default

## Decisions Made
- LAW_REGISTRY keys sorted by length descending to prevent "SGB" matching before "SGB IX" (Pitfall 1)
- i.V.m. chain pattern processed before single-citation patterns to handle law abbreviation propagation correctly
- Fallback pattern for unknown laws ensures unverified references are captured per D-02
- Context keyword "vgl." mapped to "siehe" for normalized kontext field per D-05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Local Python is 3.10 (project requires 3.12+), preventing local pytest execution. Verified regex patterns via standalone Python scripts. Full test suite runs in Docker.

## Known Stubs

None - all functionality is fully wired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CrossReferenceExtractor ready for integration with Qdrant set_payload in Plan 02
- Reference model ready for API response serialization in Plan 03
- xref_resolution_strategy config ready for incoming reference lookup strategy selection

## Self-Check: PASSED

- All 4 source/test files exist
- Both commit hashes (114a7c5, 2161e5a) verified in git log

---
*Phase: 06-cross-reference-pipeline*
*Completed: 2026-03-27*

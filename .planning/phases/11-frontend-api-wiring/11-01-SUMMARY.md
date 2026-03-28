---
phase: 11-frontend-api-wiring
plan: 01
subsystem: api
tags: [typescript, pydantic, rest-api, cross-references, multi-hop]

requires:
  - phase: 06-cross-references
    provides: ReferenceItem model and references_out on ChunkMetadata
  - phase: 07-query-expansion
    provides: MultiHop endpoint and HopResultItem model

provides:
  - SearchResultItem with references_out field in API responses
  - 4 new frontend API methods (multiHop, searchBatch, recommendGrouped, extractReferences)
  - Complete TypeScript type coverage for all backend Pydantic models

affects: [11-02-PLAN, frontend-components]

tech-stack:
  added: []
  patterns: [references_out propagation via _result_to_item mapper]

key-files:
  created: []
  modified:
    - backend/src/paragraf/api_models.py
    - backend/src/paragraf/api.py
    - frontend/src/lib/api.ts

key-decisions:
  - "Moved ReferenceItem before SearchResultItem in api_models.py to avoid forward reference"
  - "references_out is null (not empty list) when no references exist, reducing JSON payload size"

patterns-established:
  - "ReferenceItem mapping: meta.references_out -> list[ReferenceItem] in _result_to_item"

requirements-completed: [XREF-01, XREF-02, SRCH-05, SRCH-08, MCP-04]

duration: 2min
completed: 2026-03-28
---

# Phase 11 Plan 01: API Wiring Summary

**Backend references_out propagation to SearchResultItem and 4 new frontend API methods (multiHop, searchBatch, recommendGrouped, extractReferences) with full TypeScript type coverage**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T21:47:36Z
- **Completed:** 2026-03-28T21:49:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Backend SearchResultItem now includes references_out field, propagating cross-reference data from ChunkMetadata to API responses
- Frontend api.ts has 4 new typed methods matching all backend endpoints that previously had no frontend consumer
- All TypeScript types mirror exact Pydantic model field names, types, and optionality

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix backend SearchResultItem and _result_to_item to propagate references_out** - `bba1ce2` (feat)
2. **Task 2: Add all missing TypeScript types and API methods to api.ts** - `413c961` (feat)

## Files Created/Modified
- `backend/src/paragraf/api_models.py` - Moved ReferenceItem before SearchResultItem, added references_out field
- `backend/src/paragraf/api.py` - Updated _result_to_item to map meta.references_out to list[ReferenceItem]
- `frontend/src/lib/api.ts` - Added 9 new TypeScript interfaces and 4 new API methods

## Decisions Made
- Moved ReferenceItem class definition before SearchResultItem to avoid forward reference issues
- references_out defaults to None (not empty list) to reduce JSON payload when no references exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All API types and methods ready for Plan 02 (UI component wiring)
- references_out data will flow through to any component rendering SearchResultItem

---
*Phase: 11-frontend-api-wiring*
*Completed: 2026-03-28*

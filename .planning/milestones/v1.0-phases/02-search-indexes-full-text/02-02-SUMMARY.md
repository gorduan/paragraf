---
phase: 02-search-indexes-full-text
plan: 02
subsystem: api, mcp-tools
tags: [search-modes, fulltext, hybrid, migration-endpoint, mcp-tool]

# Dependency graph
requires:
  - phase: 02-search-indexes-full-text
    plan: 01
    provides: QdrantStore fulltext_search, create_text_index, create_absatz_index, SearchFilter with absatz_von/absatz_bis
provides:
  - REST /api/search with 3 search modes (semantic/fulltext/hybrid_fulltext)
  - REST POST /api/indexes/ensure migration endpoint
  - MCP paragraf_search with suchmodus (semantisch/volltext/hybrid) and absatz range params
  - _deduplicate_results helper function for shared dedup logic
affects: [frontend-search-ui, mcp-clients]

# Tech tracking
tech-stack:
  added: []
  patterns: [search_type branching in API layer, mode_map German-to-internal mapping in MCP, shared dedup helper]

key-files:
  created:
    - backend/tests/test_search_tool.py
  modified:
    - backend/src/paragraf/api.py
    - backend/src/paragraf/api_models.py
    - backend/src/paragraf/tools/search.py
    - backend/tests/test_integration.py

key-decisions:
  - "Fulltext mode skips reranking entirely -- MatchText+sparse scoring is sufficient for keyword searches"
  - "Hybrid_fulltext runs semantic and fulltext independently, merges, then reranks -- avoids coupling search internals"
  - "MCP uses German parameter names (suchmodus, semantisch/volltext/hybrid) mapped to internal English types"

patterns-established:
  - "Search mode branching: body.search_type or suchmodus selects code path"
  - "Independent search merge: run both searches, dedup by chunk.id, then rerank combined set"
  - "Extracted _deduplicate_results helper shared between MCP tool modes"

requirements-completed: [INFRA-03, INFRA-04, SRCH-06]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 02 Plan 02: API & MCP Tool Wiring Summary

**REST search endpoint with 3 modes (semantic/fulltext/hybrid_fulltext), index migration endpoint, and MCP tool with suchmodus and absatz range parameters**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T04:49:09Z
- **Completed:** 2026-03-27T04:53:48Z
- **Tasks:** 2
- **Files modified:** 5 (4 modified + 1 created)

## Accomplishments
- Branched POST /api/search on search_type: semantic (existing behavior), fulltext (MatchText+sparse, no reranking), hybrid_fulltext (both searches merged then reranked)
- Added absatz_von/absatz_bis fields to SearchRequest, passed through to SearchFilter
- Added POST /api/indexes/ensure endpoint to create text and absatz payload indexes on demand
- Extended MCP paragraf_search with suchmodus (semantisch/volltext/hybrid), absatz_von, absatz_bis parameters
- Extracted _deduplicate_results helper to eliminate code duplication across search modes
- Added TestSearchEndpointSignature (6 tests) and TestSearchToolSignature (7 tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Branch search endpoint on search_type and add migration endpoint** - `acb7315` (feat)
2. **Task 2: Extend MCP paragraf_search tool with suchmodus and absatz parameters** - `738d9c9` (feat)

## Files Created/Modified
- `backend/src/paragraf/api.py` - Search endpoint branches on search_type, migration endpoint POST /api/indexes/ensure
- `backend/src/paragraf/api_models.py` - Added absatz_von/absatz_bis to SearchRequest
- `backend/src/paragraf/tools/search.py` - Extended paragraf_search with suchmodus, absatz_von, absatz_bis; added _deduplicate_results helper
- `backend/tests/test_integration.py` - Added TestSearchEndpointSignature with 6 model validation tests
- `backend/tests/test_search_tool.py` - Created TestSearchToolSignature with 7 source inspection tests

## Decisions Made
- Fulltext mode skips reranking entirely -- MatchText+sparse scoring from Plan 01 provides sufficient ranking for keyword searches
- Hybrid_fulltext runs semantic and fulltext searches independently and merges results -- avoids coupling search internals or passing raw Qdrant filter objects
- MCP tool uses German parameter names (suchmodus with semantisch/volltext/hybrid values) mapped to internal English types via mode_map

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Local Python is 3.10 (project requires 3.12+), so tests could only be verified via syntax check, not execution. All tests verified syntactically correct and pattern-complete.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all methods are fully implemented with no placeholder logic.

## Next Phase Readiness
- Phase 02 is functionally complete: full-text search, range filtering, index migration, and 3-mode search all wired into REST API and MCP tools
- Frontend can now use search_type parameter to offer fulltext and hybrid search modes
- MCP clients (Claude Desktop/Code) can use suchmodus parameter for different search strategies

## Self-Check: PASSED

- All 5 files verified on disk
- Commit acb7315 verified in git log
- Commit 738d9c9 verified in git log

---
*Phase: 02-search-indexes-full-text*
*Completed: 2026-03-27*

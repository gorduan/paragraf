---
phase: 02-search-indexes-full-text
plan: 01
subsystem: api, database
tags: [qdrant, full-text-search, range-filter, payload-index, sparse-vector]

# Dependency graph
requires:
  - phase: 01-snapshot-safety-net
    provides: Qdrant collection with scalar quantization and snapshot safety
provides:
  - SearchFilter with absatz_von/absatz_bis range fields
  - SearchRequest with search_type (semantic/fulltext/hybrid_fulltext)
  - SearchResponse with search_type echo field
  - QdrantStore.create_text_index() with WORD tokenizer
  - QdrantStore.create_absatz_index() with integer range+lookup
  - QdrantStore.fulltext_search() with MatchText + sparse scoring
  - _build_filter Range condition with D-05 chunk_typ constraint
affects: [02-02-PLAN, api-endpoints, mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [MatchText filter + sparse vector scoring for full-text search, Range filter with auto chunk_typ constraint]

key-files:
  created: []
  modified:
    - backend/src/paragraf/models/law.py
    - backend/src/paragraf/api_models.py
    - backend/src/paragraf/services/qdrant_store.py
    - backend/tests/test_models.py
    - backend/tests/test_qdrant_store.py

key-decisions:
  - "WORD tokenizer for full-text index (not multilingual -- unavailable in Qdrant v1.13.2)"
  - "Sparse vector scoring for fulltext_search ranking (not just scroll) to provide relevance scores"
  - "Auto-add chunk_typ=absatz when range filter active and no explicit chunk_typ set (D-05)"

patterns-established:
  - "Range filter pattern: absatz_von/absatz_bis -> models.Range(gte/lte) on absatz field"
  - "MatchText + sparse scoring pattern: filter narrows, sparse vector ranks"
  - "_records_to_results for scroll fallback with score=0.0"

requirements-completed: [INFRA-03, INFRA-04, SRCH-06]

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 02 Plan 01: Search Indexes & Full-Text Summary

**Full-text search with WORD tokenizer, absatz range filtering with integer index, and 3-mode search_type on request/response models**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T04:38:02Z
- **Completed:** 2026-03-27T04:45:36Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Extended SearchFilter with absatz_von/absatz_bis integer range fields for absatz-level filtering
- Added search_type (semantic/fulltext/hybrid_fulltext) to SearchRequest and SearchResponse
- Implemented create_text_index (WORD tokenizer, min 2 / max 40 chars, lowercase) and create_absatz_index (integer with range+lookup) on QdrantStore
- Implemented fulltext_search with MatchText filter + sparse vector scoring, with scroll fallback
- Extended _build_filter with Range conditions and D-05 auto chunk_typ=absatz constraint
- All 60 unit tests passing (25 model tests + 35 qdrant_store tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend models and add QdrantStore service methods** - `4492268` (feat)

## Files Created/Modified
- `backend/src/paragraf/models/law.py` - Added absatz_von/absatz_bis fields to SearchFilter
- `backend/src/paragraf/api_models.py` - Added search_type to SearchRequest (Literal) and SearchResponse
- `backend/src/paragraf/services/qdrant_store.py` - Added create_text_index, create_absatz_index, fulltext_search, _records_to_results; extended _build_filter with Range
- `backend/tests/test_models.py` - Added TestSearchFilter, TestSearchRequestSearchType, TestSearchResponseSearchType
- `backend/tests/test_qdrant_store.py` - Added TestQdrantStoreIndexes, TestBuildFilterRange, TestQdrantStoreFulltext

## Decisions Made
- Used WORD tokenizer (not multilingual) for full-text index -- multilingual is not available in Qdrant v1.13.2 per research
- Used sparse vector scoring via query_points for fulltext_search ranking rather than just scroll, providing meaningful relevance scores
- Auto-constrain chunk_typ to "absatz" when range filter active and no explicit chunk_typ set (D-05 design decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all methods are fully implemented with no placeholder logic.

## Next Phase Readiness
- Model extensions and service methods ready for Plan 02 to wire into API endpoints and MCP tools
- fulltext_search, create_text_index, create_absatz_index all tested and operational
- search_type field ready for API layer routing logic

## Self-Check: PASSED

- All 5 modified files verified on disk
- Commit 4492268 verified in git log
- 60/60 tests passing

---
*Phase: 02-search-indexes-full-text*
*Completed: 2026-03-27*

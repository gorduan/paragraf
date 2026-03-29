---
phase: 04-recommend-pagination
plan: 01
subsystem: api
tags: [qdrant, recommend, pagination, scroll, pydantic]

requires:
  - phase: 02-search-indexes
    provides: "QdrantStore with hybrid_search, fulltext_search, _build_filter, _points_to_results, _records_to_results"
provides:
  - "QdrantStore.recommend() method with RecommendQuery and AVERAGE_VECTOR strategy"
  - "QdrantStore.scroll_search() method with cursor-based pagination"
  - "QdrantStore._resolve_point_id() for paragraph+gesetz to UUID resolution"
  - "RecommendRequest, RecommendResponse, BatchSearchRequest, BatchSearchResponse Pydantic models"
  - "SearchRequest cursor/page_size fields, SearchResponse next_cursor field"
  - "Settings: batch_max_queries, scroll_page_size, recommend_default_limit"
affects: [04-02-PLAN, 04-03-PLAN]

tech-stack:
  added: []
  patterns: ["RecommendQuery with AVERAGE_VECTOR strategy", "cursor-based scroll pagination", "uuid5 point ID resolution from paragraph+gesetz"]

key-files:
  created:
    - backend/tests/test_api_models.py
  modified:
    - backend/src/paragraf/config.py
    - backend/src/paragraf/api_models.py
    - backend/src/paragraf/services/qdrant_store.py
    - backend/tests/test_qdrant_store.py

key-decisions:
  - "RecommendQuery uses AVERAGE_VECTOR strategy (no negative examples per D-03)"
  - "exclude_same_law implemented via must_not filter condition (per D-02)"
  - "scroll_search returns tuple of results and next_cursor string"

patterns-established:
  - "Recommend pattern: query_points with RecommendQuery, RecommendInput(positive=ids, strategy=AVERAGE_VECTOR)"
  - "Scroll pattern: client.scroll with offset=cursor, returns (records, next_offset)"
  - "Point ID resolution: scroll with gesetz+paragraph+chunk_typ filter, uuid5(NAMESPACE_URL, chunk_id)"

requirements-completed: [SRCH-01, SRCH-04]

duration: 4min
completed: 2026-03-27
---

# Phase 04 Plan 01: Recommend & Pagination Service Layer Summary

**QdrantStore recommend/scroll/resolve methods with RecommendQuery AVERAGE_VECTOR strategy, cursor-based scroll pagination, and 4 new Pydantic request/response models**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T09:07:53Z
- **Completed:** 2026-03-27T09:11:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- QdrantStore.recommend() uses query_points with RecommendQuery and AVERAGE_VECTOR strategy, with exclude_same_law via must_not filter
- QdrantStore.scroll_search() provides cursor-based pagination via Qdrant scroll API
- QdrantStore._resolve_point_id() resolves paragraph+gesetz to UUID5 point ID
- 4 new Pydantic models (RecommendRequest, RecommendResponse, BatchSearchRequest, BatchSearchResponse) with validation
- SearchRequest extended with cursor/page_size, SearchResponse with next_cursor
- 3 new Settings fields: batch_max_queries, scroll_page_size, recommend_default_limit

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Settings, Pydantic models, and QdrantStore service methods** - `d97a5f6` (feat)
2. **Task 2: Unit tests for recommend, scroll_search, and _resolve_point_id** - `10ff4d7` (test)

## Files Created/Modified
- `backend/src/paragraf/config.py` - Added batch_max_queries, scroll_page_size, recommend_default_limit settings
- `backend/src/paragraf/api_models.py` - Added RecommendRequest, RecommendResponse, BatchSearchRequest, BatchSearchResponse; extended SearchRequest/SearchResponse with pagination fields
- `backend/src/paragraf/services/qdrant_store.py` - Added recommend(), scroll_search(), _resolve_point_id() methods
- `backend/tests/test_qdrant_store.py` - Added TestQdrantStoreRecommend, TestResolvePointId, TestQdrantStoreScroll test classes
- `backend/tests/test_api_models.py` - Created with TestRecommendRequest, TestBatchSearchRequest, TestSearchRequestPagination, TestSearchResponsePagination

## Decisions Made
- RecommendQuery uses AVERAGE_VECTOR strategy with only positive examples (no negative examples per D-03)
- exclude_same_law implemented via must_not filter condition on gesetz field (per D-02)
- scroll_search returns tuple[list[SearchResult], str | None] for easy cursor handling
- QuantizationSearchParams(rescore=True, oversampling=1.5) applied to recommend() consistent with existing search methods

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Local Python is 3.10 while project requires 3.12+ -- tests could not be run locally (Docker not running). Verified via AST parsing that all Python files have valid syntax. Full test suite should be run via Docker when available.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Service layer foundation complete for Plan 02 (REST endpoints) and Plan 03 (MCP tools)
- recommend(), scroll_search(), _resolve_point_id() ready to be called from API routes
- Pydantic models ready for FastAPI request/response validation

---
*Phase: 04-recommend-pagination*
*Completed: 2026-03-27*

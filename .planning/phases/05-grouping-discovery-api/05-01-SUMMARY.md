---
phase: 05-grouping-discovery-api
plan: 01
subsystem: api
tags: [qdrant, discovery, grouping, recommend, pydantic, python]

# Dependency graph
requires:
  - phase: 04-recommend-pagination
    provides: RecommendQuery pattern, _build_filter, _points_to_results, SearchFilter, SearchResult
provides:
  - QdrantStore.discover() with DiscoverQuery and ContextPair
  - QdrantStore.grouped_search() with query_points_groups and group_by gesetz
  - QdrantStore.grouped_recommend() combining RecommendQuery with query_points_groups
  - _groups_to_grouped_results() static converter
  - 7 new Pydantic models (GroupedSearchRequest, DiscoverRequest, GroupedRecommendRequest, GroupedResultGroup, GroupedSearchResponse, DiscoverResponse, GroupedRecommendResponse)
  - 4 new Settings (group_size_default, group_max_groups, discovery_max_positive, discovery_max_negative)
affects: [05-02-PLAN (REST endpoints), 05-03-PLAN (MCP tools)]

# Tech tracking
tech-stack:
  added: []
  patterns: [query_points_groups with group_by for grouped results, DiscoverQuery with ContextPair for explorative search]

key-files:
  created: []
  modified:
    - backend/src/paragraf/config.py
    - backend/src/paragraf/api_models.py
    - backend/src/paragraf/services/qdrant_store.py
    - backend/tests/test_qdrant_store.py
    - backend/tests/test_api_models.py

key-decisions:
  - "Dense-only for grouped search (no hybrid fusion with grouping per Pitfall 4)"
  - "DiscoverQuery context is None when no context_pairs provided (not empty list)"
  - "Same exclude_gesetz must_not pattern for grouped_recommend as for recommend"

patterns-established:
  - "_groups_to_grouped_results: Static converter from Qdrant GroupsResult to (gesetz, list[SearchResult]) tuples"
  - "query_points_groups with group_by='gesetz' as standard grouping pattern"

requirements-completed: [SRCH-02, SRCH-03, SRCH-05]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 05 Plan 01: Grouping & Discovery Service Layer Summary

**QdrantStore discover/grouped_search/grouped_recommend methods with 7 Pydantic request/response models and 4 config settings**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T10:27:23Z
- **Completed:** 2026-03-27T10:30:51Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Three new QdrantStore async methods: discover(), grouped_search(), grouped_recommend()
- Seven new Pydantic models for grouping and discovery request/response contracts
- Four new ENV-configurable settings for group sizes and discovery limits
- 25 new unit tests covering all service methods, static helper, and model validations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Settings, Pydantic models, and QdrantStore service methods** - `3dd6adb` (feat)
2. **Task 2: Unit tests for service methods and Pydantic models** - `0b3da75` (test)

## Files Created/Modified
- `backend/src/paragraf/config.py` - Added 4 new settings for grouping and discovery
- `backend/src/paragraf/api_models.py` - Added 7 new Pydantic models for grouped/discovery requests and responses
- `backend/src/paragraf/services/qdrant_store.py` - Added discover(), grouped_search(), grouped_recommend(), _groups_to_grouped_results()
- `backend/tests/test_qdrant_store.py` - Added 4 test classes with 9 tests for new service methods
- `backend/tests/test_api_models.py` - Added 4 test classes with 16 tests for new Pydantic models

## Decisions Made
- Dense-only for grouped search: query_points_groups doesn't support hybrid fusion (Pitfall 4 from research)
- DiscoverQuery context set to None (not empty list) when no context_pairs provided
- Reused same exclude_gesetz must_not filter pattern from recommend() for grouped_recommend()

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Service layer complete, ready for REST endpoint wiring (Plan 02)
- All Pydantic request/response models ready for API route definitions
- MCP tools (Plan 03) can call the same service methods

## Self-Check: PASSED

- All 5 files exist on disk
- Both commits (3dd6adb, 0b3da75) found in git log
- config.py: 4 new settings verified
- api_models.py: 7 new model classes verified
- qdrant_store.py: 11 matching patterns (3 methods + helper + API types + grouping)

---
*Phase: 05-grouping-discovery-api*
*Completed: 2026-03-27*

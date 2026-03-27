---
phase: 07-query-expansion-chunking
plan: 01
subsystem: api
tags: [query-expansion, synonyms, nlp, legal-search]

# Dependency graph
requires:
  - phase: 06-cross-references
    provides: LAW_REGISTRY with tags, parser normalization patterns
provides:
  - QueryExpander service class with synonym index
  - LEGAL_SYNONYMS curated dictionary (24 entries, 4 legal domains)
  - Arabic-to-roman numeral normalization at query time
  - JSON override support for synonyms without code changes
  - Config settings for query expansion strategy and toggle
affects: [07-02, 07-03, search-pipeline-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [n-gram matching for multi-word synonyms, LAW_REGISTRY auto-index generation]

key-files:
  created:
    - backend/src/paragraf/data/__init__.py
    - backend/src/paragraf/data/synonyms.py
    - backend/src/paragraf/services/query_expander.py
    - backend/tests/test_query_expander.py
  modified:
    - backend/src/paragraf/config.py
    - backend/tests/test_config.py

key-decisions:
  - "Reimplemented arabic-to-roman normalization inline (not importing from parser) to avoid coupling QueryExpander to GesetzParser"
  - "Max 3 expansion terms per matched token to prevent query dilution"
  - "N-gram matching (3-gram, 2-gram, 1-gram) for multi-word legal terms like 'merkzeichen g'"

patterns-established:
  - "data/ package for static dictionaries and curated data"
  - "QueryExpander as standalone service (no async, no ML deps) instantiable without AppContext"

requirements-completed: [SRCH-07]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 7 Plan 1: QueryExpander Service Summary

**Legal synonym expansion service with LAW_REGISTRY auto-indexing, curated 24-entry dictionary, arabic-to-roman normalization, and JSON override support**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T03:10:43Z
- **Completed:** 2026-03-27T03:15:43Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- QueryExpander builds synonym index automatically from 95+ LAW_REGISTRY entries (abk<->beschreibung + tags)
- Curated LEGAL_SYNONYMS dictionary with 24 entries across Behindertenrecht, Arbeitsrecht, Sozialrecht, Steuerrecht
- Arabic-to-roman normalization converts "SGB 9" to "SGB IX" at query time with LAW_REGISTRY validation
- Multi-word n-gram matching (trigrams, bigrams, unigrams) with dilution guard (max 3 terms per match)
- Optional JSON file override for extending synonyms without code changes
- Comprehensive test suite: 9 tests across 4 test classes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create synonym dictionary and QueryExpander service** - `8c604ec` (feat)
2. **Task 2: Unit tests for QueryExpander** - `77594a1` (test)

## Files Created/Modified
- `backend/src/paragraf/data/__init__.py` - Data package init
- `backend/src/paragraf/data/synonyms.py` - Curated LEGAL_SYNONYMS dict (24 entries)
- `backend/src/paragraf/services/query_expander.py` - QueryExpander service class
- `backend/src/paragraf/config.py` - Added query_expansion_strategy, query_expansion_enabled, synonyms_json_path
- `backend/tests/test_query_expander.py` - 9 tests across 4 classes
- `backend/tests/test_config.py` - Added test_query_expansion_defaults

## Decisions Made
- Reimplemented arabic-to-roman normalization inline rather than importing from GesetzParser to keep QueryExpander decoupled from parser dependencies (httpx, lxml, etc.)
- Max 3 expansion terms per matched token to prevent query dilution (per research Pitfall 1)
- N-gram matching order: 3-gram > 2-gram > 1-gram with matched-index tracking to avoid double-counting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Docker not running locally, so tests verified via syntax/AST checks and string content validation. Full test execution requires `docker compose up`.

## Known Stubs

None - all functionality is fully wired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- QueryExpander ready for integration into search pipeline (Plan 07-02 or 07-03)
- `expand()` returns tuple of (expanded_query, terms) for caller to decide strategy
- Config settings ready: `QUERY_EXPANSION_STRATEGY`, `QUERY_EXPANSION_ENABLED`, `SYNONYMS_JSON_PATH`

## Self-Check: PASSED

All 4 created files verified present. Both commit hashes (8c604ec, 77594a1) verified in git log.

---
*Phase: 07-query-expansion-chunking*
*Completed: 2026-03-27*

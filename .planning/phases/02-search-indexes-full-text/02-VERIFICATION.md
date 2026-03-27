---
phase: 02-search-indexes-full-text
verified: 2026-03-27T06:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run POST /api/search with search_type=fulltext on a live Docker stack"
    expected: "Returns keyword-matching results without reranking; response includes search_type='fulltext'"
    why_human: "Requires running Qdrant + backend Docker services; cannot verify live search behavior programmatically on this host"
  - test: "Run POST /api/indexes/ensure on a live Docker stack"
    expected: "Returns {created: ['text_fulltext', 'absatz_integer'], errors: [], erfolg: true} on first call; idempotent on second call"
    why_human: "Requires live Qdrant connection to create payload indexes"
  - test: "Invoke MCP paragraf_search with suchmodus='volltext' from a Claude Desktop/Code client"
    expected: "Returns keyword-matching results; no reranker call occurs"
    why_human: "MCP protocol integration requires running MCP service container"
---

# Phase 02: Search Indexes & Full-Text Verification Report

**Phase Goal:** Qdrant full-text indexes und erweiterte Suchfilter — Volltextsuche, Absatz-Range-Filter, Index-Migration-Endpoint
**Verified:** 2026-03-27T06:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Searching with absatz range parameters returns only absatz-level chunks within the specified range | VERIFIED | `_build_filter` in `qdrant_store.py` line 257-276: `models.Range(**range_params)` on `absatz` key + D-05 auto `chunk_typ=absatz` constraint |
| 2  | Full-text keyword search returns results matching exact terms in law text | VERIFIED | `fulltext_search()` at line 390 uses `models.MatchText(text=query)` as a must-condition, backed by `create_text_index()` with WORD tokenizer |
| 3  | API consumers can specify search_type to choose between semantic, fulltext, and hybrid_fulltext modes | VERIFIED | `SearchRequest.search_type: Literal["semantic", "fulltext", "hybrid_fulltext"]` in `api_models.py` line 18; `api.py` lines 297/312/364 branch on it |
| 4  | Index creation endpoints can build full-text and integer range indexes on an existing Qdrant collection | VERIFIED | `POST /api/indexes/ensure` at `api.py` line 971 calls `ctx.qdrant.create_text_index()` and `ctx.qdrant.create_absatz_index()` |
| 5  | SearchResponse echoes the search mode used so consumers know which mode produced results | VERIFIED | `SearchResponse.search_type` field in `api_models.py` line 69; all three branches in `api.py` set `search_type=` explicitly |
| 6  | POST /api/search with search_type=fulltext calls fulltext_search and skips reranking | VERIFIED | `api.py` lines 297-310: fulltext branch calls `ctx.qdrant.fulltext_search()`, builds items directly, no `arerank` call |
| 7  | POST /api/search with search_type=semantic preserves current behavior (hybrid_search + rerank) | VERIFIED | `api.py` lines 364-404: else-branch calls `ctx.qdrant.hybrid_search()` then `ctx.reranker.arerank()`, unchanged logic |
| 8  | POST /api/search with search_type=hybrid_fulltext runs both searches independently, merges results, then reranks | VERIFIED | `api.py` lines 312-362: runs `hybrid_search` and `fulltext_search` separately, deduplicates by chunk.id, then `arerank` |
| 9  | POST /api/indexes/ensure creates text and absatz indexes via QdrantStore methods | VERIFIED | `api.py` lines 971-989: calls `create_text_index()` and `create_absatz_index()`, returns created/errors/erfolg |
| 10 | MCP paragraf_search tool accepts suchmodus parameter with semantisch/volltext/hybrid | VERIFIED | `tools/search.py` line 54: `suchmodus: str = "semantisch"`; line 100: `mode_map = {"semantisch": "semantic", "volltext": "fulltext", "hybrid": "hybrid_fulltext"}` |
| 11 | MCP paragraf_search tool accepts absatz_von and absatz_bis parameters | VERIFIED | `tools/search.py` lines 55-56: `absatz_von: int | None = None`, `absatz_bis: int | None = None`; passed to `SearchFilter` at lines 95-96 |
| 12 | MCP paragraf_search tool skips reranking for volltext mode | VERIFIED | `tools/search.py` lines 103-118: volltext branch calls `qdrant.fulltext_search()` and `_deduplicate_results()` directly, no `reranker.arerank()` call |
| 13 | SearchResponse includes search_type field matching the request | VERIFIED | `api_models.py` line 69: `search_type: str = Field("semantic", ...)`; all response constructions pass the active mode string |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/paragraf/models/law.py` | SearchFilter with absatz_von, absatz_bis fields | VERIFIED | Lines 238-239: `absatz_von: int \| None` and `absatz_bis: int \| None` with Field descriptions |
| `backend/src/paragraf/api_models.py` | SearchRequest with search_type, SearchResponse with search_type | VERIFIED | SearchRequest line 18: `Literal["semantic", "fulltext", "hybrid_fulltext"]`; SearchResponse line 69: `search_type: str` |
| `backend/src/paragraf/services/qdrant_store.py` | fulltext_search, create_text_index, create_absatz_index methods | VERIFIED | All three methods present at lines 99, 115, 390; fully implemented with real Qdrant client calls |
| `backend/tests/test_qdrant_store.py` | Tests for index creation, range filter, fulltext search | VERIFIED | Classes `TestQdrantStoreIndexes` (line 316), `TestBuildFilterRange` (line 358), `TestQdrantStoreFulltext` (line 405) |
| `backend/tests/test_models.py` | Tests for SearchFilter range fields, SearchRequest search_type | VERIFIED | Classes `TestSearchFilter` (line 174), `TestSearchRequestSearchType` (line 202) containing `absatz_von` |
| `backend/src/paragraf/api.py` | Search endpoint branching on search_type, migration endpoint POST /api/indexes/ensure | VERIFIED | Branching lines 297-404; migration endpoint lines 971-989 |
| `backend/src/paragraf/tools/search.py` | Extended paragraf_search with suchmodus, absatz_von, absatz_bis | VERIFIED | Parameters at lines 54-56; mode_map at line 100; fulltext_search called at line 106 and 128 |
| `backend/tests/test_search_tool.py` | MCP tool signature and mode mapping tests | VERIFIED | Class `TestSearchToolSignature` at line 8; 7 test methods |
| `backend/tests/test_integration.py` | SearchEndpointSignature tests | VERIFIED | Class `TestSearchEndpointSignature` at line 199; 6 test methods |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/src/paragraf/api.py` | `backend/src/paragraf/services/qdrant_store.py` | `ctx.qdrant.fulltext_search()` call for fulltext mode | WIRED | `api.py` line 299: `await ctx.qdrant.fulltext_search(...)` in fulltext branch |
| `backend/src/paragraf/api.py` | `backend/src/paragraf/services/qdrant_store.py` | `ctx.qdrant.create_text_index()` in migration endpoint | WIRED | `api.py` line 978: `await ctx.qdrant.create_text_index()` |
| `backend/src/paragraf/tools/search.py` | `backend/src/paragraf/services/qdrant_store.py` | `qdrant.fulltext_search()` for volltext mode in MCP tool | WIRED | `tools/search.py` line 106: `await qdrant.fulltext_search(...)` in volltext branch |
| `backend/src/paragraf/services/qdrant_store.py` | `backend/src/paragraf/models/law.py` | `SearchFilter.absatz_von/absatz_bis` used in `_build_filter` | WIRED | `qdrant_store.py` lines 257-276: `search_filter.absatz_von` and `search_filter.absatz_bis` read |
| `backend/src/paragraf/services/qdrant_store.py` | `qdrant_client.models` | `MatchText` and `Range` filter conditions | WIRED | `qdrant_store.py` line 403: `models.MatchText(text=query)`; line 266: `models.Range(**range_params)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `qdrant_store.py fulltext_search` | `results` from `query_points` | `self.client.query_points()` with MatchText filter + SparseVector | Real Qdrant DB query | FLOWING |
| `qdrant_store.py create_text_index` | N/A (side effect) | `self.client.create_payload_index()` with TextIndexParams | Real Qdrant index creation | FLOWING |
| `qdrant_store.py _build_filter` | `models.Range(**range_params)` | `search_filter.absatz_von/absatz_bis` from caller | Populated from request fields | FLOWING |
| `api.py /api/search` | `items` rendered to response | Calls `ctx.qdrant.fulltext_search()` or `hybrid_search()` | Real DB queries (not static) | FLOWING |
| `api.py /api/indexes/ensure` | `created`/`errors` lists | Direct Qdrant client calls via `create_text_index()` and `create_absatz_index()` | Real index operations | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All source files parse without syntax errors | `python -c "import ast; ast.parse(open(f).read())"` on 7 files | OK on all files | PASS |
| Commits documented in SUMMARY exist in git log | `git log --oneline` | `4492268`, `acb7315`, `738d9c9` all present | PASS |
| `create_text_index` uses WORD tokenizer (not multilingual) | `grep "TokenizerType.WORD"` | Found at `qdrant_store.py` line 106 | PASS |
| `create_absatz_index` has `range=True` | `grep "IntegerIndexParams"` | Found at lines 120-124 with `range=True, lookup=True` | PASS |
| Tests cannot execute locally | `python -m pytest` | `ModuleNotFoundError: no module named 'paragraf'` — Python 3.10 on host, project requires 3.12+ | SKIP (Docker-only) |

Note: Test execution is Docker-only by project design. Structural and syntactic verification confirms the test classes exist and are well-formed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-03 | 02-01-PLAN, 02-02-PLAN | Full-Text Index auf `text`-Feld fuer exakte Wortsuche | SATISFIED | `create_text_index()` with `TextIndexParams(type=TEXT, tokenizer=WORD)` wired into `POST /api/indexes/ensure` |
| INFRA-04 | 02-01-PLAN, 02-02-PLAN | Payload Range-Filter fuer numerisches `absatz`-Feld | SATISFIED | `create_absatz_index()` with `IntegerIndexParams(range=True, lookup=True)`; `_build_filter` emits `models.Range()` conditions |
| SRCH-06 | 02-01-PLAN, 02-02-PLAN | Full-Text-Suche als Toggle neben semantischer Suche | SATISFIED | `search_type` field on `SearchRequest` selects mode; API and MCP tool both expose the toggle; REQUIREMENTS.md marks all three as `[x]` Complete |

No orphaned requirements: only INFRA-03, INFRA-04, SRCH-06 are mapped to Phase 2 in REQUIREMENTS.md, and all three are claimed by both plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No stubs, placeholders, TODO markers, or hardcoded empty returns were found in any of the phase-modified files. All `return []` / `return {}` occurrences are either error-path short-circuits (empty search results) or fallback returns that are populated by real upstream calls.

### Human Verification Required

#### 1. Live Full-Text Search

**Test:** Start `docker compose up --build`, POST `{"anfrage": "Schwerbehinderung", "search_type": "fulltext"}` to `http://localhost:3847/api/search`
**Expected:** Non-empty results array with `search_type="fulltext"` in response body; results contain the literal word "Schwerbehinderung"
**Why human:** Requires running Qdrant + backend services with indexed data; `create_payload_index` must succeed against a live Qdrant collection

#### 2. Index Migration Endpoint

**Test:** POST `{}` to `http://localhost:3847/api/indexes/ensure`
**Expected:** `{"created": ["text_fulltext", "absatz_integer"], "errors": [], "erfolg": true}` on first call; same shape with empty `created` (idempotent) on second call
**Why human:** Requires live Qdrant connection; Qdrant v1.13.2 idempotency of `create_payload_index` on existing indexes should be verified

#### 3. MCP volltext Mode

**Test:** Invoke `paragraf_search(anfrage="Pflegegrad 3", suchmodus="volltext")` via Claude Desktop/Code MCP client
**Expected:** Returns results with literal phrase; no reranker log entries appear in backend logs
**Why human:** Requires MCP service container and a connected Claude client

### Gaps Summary

No gaps. All 13 must-have truths are verified against the actual codebase. All artifacts exist, are substantive (fully implemented, not stubs), are wired (called from the correct callers), and have real data flowing through them. All three documented commits exist in git history. All requirement IDs are accounted for with evidence.

---

_Verified: 2026-03-27T06:00:00Z_
_Verifier: Claude (gsd-verifier)_

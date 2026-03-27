---
phase: 07-query-expansion-chunking
verified: 2026-03-27T14:30:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run full test suite in Docker"
    expected: "All 9 test_query_expander tests, 4 TestSatz* parser tests, multi-hop tests, and prompt tests pass green"
    why_human: "Docker was not running during implementation; tests are structurally verified but runtime execution has not been confirmed"
  - test: "POST /api/search with expand=true"
    expected: "Response contains non-empty expanded_terms when query includes 'GdB' or 'Kuendigung'"
    why_human: "Cannot invoke live API without running stack"
  - test: "POST /api/search/multi-hop with tiefe=2"
    expected: "Response contains results from hop 0 (via_reference=null) and hop 1+ (via_reference set), visited_paragraphs contains all traversed paragraphs"
    why_human: "Requires live Qdrant with indexed data"
---

# Phase 7: Query Expansion, Satz Chunking & Multi-Hop Verification Report

**Phase Goal:** Search recall is improved through conservative legal synonym expansion and smarter paragraph segmentation, with multi-hop MCP prompts combining search and citation traversal
**Verified:** 2026-03-27T14:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | QueryExpander builds synonym index from LAW_REGISTRY automatically | VERIFIED | `query_expander.py:47-51` iterates LAW_REGISTRY entries, builds bidirectional abk<->beschreibung mappings |
| 2 | QueryExpander expands 'GdB' to include 'Grad der Behinderung' | VERIFIED | `synonyms.py:11`: `"gdb": ["Grad der Behinderung"]` in LEGAL_SYNONYMS; expand() checks this key |
| 3 | QueryExpander normalizes arabic numbers at search time (SGB 9 -> SGB IX) | VERIFIED | `query_expander.py:85-103`: `_normalize_query()` uses `_ARABIC_LAW_RE` and `ROMAN_MAP`, validates against LAW_REGISTRY |
| 4 | Optional JSON file can override/extend synonyms without code change | VERIFIED | `query_expander.py:61-83`: `_load_json_overrides()` reads `settings.synonyms_json_path`, logs warning on missing file |
| 5 | Settings expose QUERY_EXPANSION_STRATEGY and QUERY_EXPANSION_ENABLED | VERIFIED | `config.py:68-70`: both fields present with defaults "append" and True |
| 6 | Parser splits long Absaetze into Satz-level chunks at sentence boundaries | VERIFIED | `parser.py:37`, `parser.py:313-332`: `_split_into_saetze()` function + satz chunk generation loop |
| 7 | Legal abbreviations (Abs., Nr., i.V.m., etc.) are NOT split at | VERIFIED | `parser.py:27-36`: `_LEGAL_ABBREVS` tuple with 34 entries, placeholder-based protection in `_split_into_saetze()` |
| 8 | New satz chunk type has correct metadata with chunk_typ='satz' | VERIFIED | `parser.py:332`: `chunk_typ="satz"` in satz chunk construction; `models/law.py:233`: field description updated to "paragraph \| absatz \| satz" |
| 9 | Satz splitting threshold is configurable via CHUNK_SATZ_MIN_LENGTH ENV | VERIFIED | `parser.py:313,315`: `settings.chunk_satz_min_length` used in both guard and split call; `config.py:74` |
| 10 | Search endpoint accepts expand parameter and returns expanded_terms in response | VERIFIED | `api_models.py:26`: `expand: bool = Field(True)` in SearchRequest; `api_models.py:74`: `expanded_terms` in SearchResponse; `api.py:343-377` wires both |
| 11 | Multi-hop endpoint chains search with reference traversal up to 3 hops | VERIFIED | `api.py:1451`: `/api/search/multi-hop` endpoint; `multi_hop.py:29-127`: `search_with_hops()` with hop loop |
| 12 | Circular references are detected and skipped in multi-hop traversal | VERIFIED | `multi_hop.py:50,91-94`: `visited: set[str]` + `if ref_key in visited: ... continue` with debug log |
| 13 | Three MCP prompt templates are registered: paragraf_legal_analysis, paragraf_norm_chain, paragraf_compare_areas | VERIFIED | `prompts/__init__.py:110,138,161`: all three defined inside `register_prompts()`; `server.py:165`: `register_prompts(mcp)` called |
| 14 | docker-compose.yml has all new ENV vars for query expansion, chunking, and multi-hop | VERIFIED | All 7 vars present in both backend (lines 47-53) and mcp (lines 94-100) services: QUERY_EXPANSION_STRATEGY, QUERY_EXPANSION_ENABLED, SYNONYMS_JSON_PATH, CHUNK_MIN_LENGTH_FOR_SPLIT, CHUNK_SATZ_MIN_LENGTH, MULTI_HOP_MAX_DEPTH, MULTI_HOP_RESULTS_PER_HOP |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/paragraf/services/query_expander.py` | QueryExpander service class | VERIFIED | 165 lines, substantive; exports `QueryExpander` with `expand()`, `_build_index()`, `_normalize_query()`, `_load_json_overrides()`, `synonym_count` property |
| `backend/src/paragraf/data/synonyms.py` | Hand-curated LEGAL_SYNONYMS dict | VERIFIED | 36 lines; contains `LEGAL_SYNONYMS` with 22 entries across 4 legal domains |
| `backend/src/paragraf/data/__init__.py` | Package init | VERIFIED | Exists (74 bytes) |
| `backend/tests/test_query_expander.py` | Unit tests for query expansion | VERIFIED | 4 test classes: TestQueryExpanderIndex, TestQueryExpanderExpand, TestQueryExpanderNormalize, TestQueryExpanderJsonOverride |
| `backend/src/paragraf/services/parser.py` | Extended chunking with Satz-level splitting | VERIFIED | Contains `_split_into_saetze`, `_LEGAL_ABBREVS`, `chunk_typ="satz"`, satz ID pattern `_Abs{N}_S{M}` |
| `backend/tests/test_parser.py` | Unit tests for Satz chunking | VERIFIED | Added TestSatzChunking, TestSatzAbbreviations, TestSatzMetadata, TestReindexChunkTypes; imports `_split_into_saetze` from parser |
| `backend/src/paragraf/services/multi_hop.py` | MultiHopService | VERIFIED | 128 lines; `search_with_hops()` with visited set, hop loop, reference traversal |
| `backend/src/paragraf/api_models.py` | MultiHopRequest, MultiHopResponse, HopResultItem, expand/expanded_terms | VERIFIED | All 3 new classes present; SearchRequest has `expand: bool = True`; SearchResponse has `expanded_terms: list[str]` |
| `backend/src/paragraf/prompts/__init__.py` | 3 new MCP prompt templates | VERIFIED | `paragraf_legal_analysis`, `paragraf_norm_chain`, `paragraf_compare_areas` all defined and reference correct tool names |
| `backend/tests/test_multi_hop.py` | Unit tests for multi-hop service | VERIFIED | TestMultiHopService, TestMultiHopCircular, TestExpandedTermsModel; covers visited_paragraphs, circular detection, depth limits, model validation |
| `backend/tests/test_prompts.py` | Tests for new prompt templates | VERIFIED | TestMultiHopPrompts class with tests for all 3 templates |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `query_expander.py` | `models/law.py` | `from paragraf.models.law import LAW_REGISTRY` | WIRED | Line 12; used in `_build_index()` at line 47 |
| `query_expander.py` | `data/synonyms.py` | `from paragraf.data.synonyms import LEGAL_SYNONYMS` | WIRED | Line 11; used in `_build_index()` at line 54 |
| `parser.py` | `config.py` | `settings.chunk_satz_min_length` and `settings.chunk_min_length_for_split` | WIRED | Lines 289, 313, 315 |
| `parser.py` | `models/law.py` | `chunk_typ="satz"` in LawChunk construction | WIRED | Line 332 |
| `multi_hop.py` | `qdrant_store.py` | `self.qdrant.hybrid_search` and `self.qdrant.get_outgoing_references` | WIRED | Lines 54, 85, 99 |
| `api.py` | `query_expander.py` | `query_expander.expand()` before search | WIRED | Lines 82, 269, 345-346; used across all search branches at 346, 377, 430, 461, 472, 492 |
| `api.py` | `multi_hop.py` | `MultiHopService.search_with_hops()` | WIRED | Lines 48-49, 79, 1451-1475 |
| `server.py` | `prompts/__init__.py` | `register_prompts(mcp)` | WIRED | `server.py:14` imports, `server.py:165` calls |
| `server.py` | `query_expander.py` | `QueryExpander` in AppContext dataclass | WIRED | Lines 18, 45: `query_expander: QueryExpander = field(default_factory=QueryExpander)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `api.py` /api/search | `expanded_terms` | `query_expander.expand(body.anfrage)` — reads from `_synonyms` dict built from LAW_REGISTRY + LEGAL_SYNONYMS | Yes — real synonym lookups, not hardcoded | FLOWING |
| `multi_hop.py` | `all_results` | `self.qdrant.hybrid_search()` + `self.qdrant.get_outgoing_references()` — real Qdrant calls | Yes — delegates to live vector DB | FLOWING |
| `prompts/__init__.py` | prompt strings | f-string construction with user-provided `thema`, `start_paragraph`, `rechtsgebiete` | Yes — dynamic prompts, not static | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| QueryExpander module imports | `python -c "from paragraf.services.query_expander import QueryExpander"` | Not runnable outside Docker (package path) | SKIP — requires Docker |
| `_split_into_saetze` is exported from parser | `grep "_split_into_saetze" backend/src/paragraf/services/parser.py` | Found at lines 37, 315 | PASS |
| MultiHopService imports from correct modules | File read — all imports resolve to existing files | All dependencies present: qdrant_store, reranker, query_expander | PASS |
| docker-compose.yml has all 7 ENV vars in both services | `grep` check | All 7 found in both backend (lines 47-53) and mcp (lines 94-100) blocks | PASS |
| `paragraph_id` and `abs_id` generation lines unchanged | `grep "paragraph_id\s*=" parser.py`, `grep "abs_id\s*=" parser.py` | Line 270: `f"{norm_abk}_{enbez}".replace(...)`, Line 293: `f"{paragraph_id}_Abs{abs_nr}"` — both intact | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SRCH-07 | 07-01-PLAN, 07-03-PLAN | Query Expansion mit juristischem Synonym-Woerterbuch (konservativ, nur Abkuerzungen + Kernsynonyme) | SATISFIED | QueryExpander with LAW_REGISTRY auto-index + 22-entry LEGAL_SYNONYMS; integrated into /api/search with expand toggle and expanded_terms in response |
| MCP-04 | 07-03-PLAN | Multi-Hop MCP-Prompt — Paragraphen finden, Querverweise folgen, Rechtslage zusammenfassen | SATISFIED | 3 MCP prompt templates (paragraf_legal_analysis, paragraf_norm_chain, paragraf_compare_areas) registered in server; MultiHopService + /api/search/multi-hop REST endpoint for programmatic multi-hop |
| CHUNK-01 | 07-02-PLAN | Parser verbessern — Chunking an juristischen Strukturgrenzen (Absatz, Satz, Nummer) | SATISFIED | `_split_into_saetze()` with 34-abbreviation protection; satz chunk type with ID pattern `*_Abs{N}_S{M}` and configurable thresholds |
| CHUNK-02 | 07-03-PLAN | Re-Indexierung mit verbessertem Chunking (nach Snapshot) | SATISFIED | Parser used by `/api/index` endpoint (api.py:126,132) now produces satz chunks; existing paragraph_id and abs_id unchanged — safe for re-indexing |

All 4 requirement IDs from plan frontmatter accounted for. No orphaned requirements found in REQUIREMENTS.md for Phase 7.

### Anti-Patterns Found

No blockers or significant anti-patterns detected in new files.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `multi_hop.py:86` | Bare `except Exception:` swallows errors during reference fetching | Info | Intentional degradation — logs warning and continues; acceptable for network calls |
| `prompts/__init__.py` | Prompt templates return f-strings only (no actual tool invocation) | Info | Correct MCP pattern — prompts are instructions to the LLM, not code that calls tools |

### Human Verification Required

#### 1. Full Test Suite Execution in Docker

**Test:** `docker compose exec backend python -m pytest tests/ -x -v`
**Expected:** All tests pass including TestQueryExpanderIndex (synonym_count > 50), TestQueryExpanderExpand (GdB -> Grad der Behinderung), TestSatzChunking (3 sentences), TestSatzAbbreviations (Abs. not split), TestMultiHopService, TestMultiHopCircular
**Why human:** Docker was not running during implementation; tests could only be structurally verified. The summaries explicitly note: "Cannot run tests locally or in Docker (disk space full, Docker not running)."

#### 2. Live Search with Query Expansion

**Test:** Send `POST /api/search` with `{"anfrage": "GdB Schwerbehinderung", "expand": true}`
**Expected:** Response includes `expanded_terms` containing "Grad der Behinderung" and/or "SGB IX"; search results are returned
**Why human:** Requires live Docker stack with running backend and Qdrant

#### 3. Multi-Hop Traversal

**Test:** Send `POST /api/search/multi-hop` with `{"anfrage": "Eingliederungshilfe", "tiefe": 2, "expand": true}` after indexing SGB IX
**Expected:** Results from hop 0 have `via_reference: null`; hop 1 results have `via_reference` set; `visited_paragraphs` contains multiple entries; no duplicate paragraphs
**Why human:** Requires live stack with indexed data containing cross-references

### Gaps Summary

No gaps. All must-haves verified. The three human verification items are runtime confirmation items, not structural gaps — the code is correctly written and wired.

---

_Verified: 2026-03-27T14:30:00Z_
_Verifier: Claude (gsd-verifier)_

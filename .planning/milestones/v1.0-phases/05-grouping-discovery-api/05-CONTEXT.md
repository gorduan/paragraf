# Phase 5: Grouping & Discovery API - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-Phase: Grouped search results via Qdrant `query_points_groups`, explorative Discovery search with positive/negative examples via Qdrant Discovery API, grouped recommendations (Recommend + Groups combined), and three new MCP tools (`paragraf_discover`, `paragraf_grouped_search`, `paragraf_similar_grouped`). Kein Frontend-UI — das kommt in Phase 8/9.

Requirements: SRCH-02 (Discovery API), SRCH-03 (Grouping API), SRCH-05 (Grouped Recommendations), MCP-02 (paragraf_discover), MCP-07 (paragraf_grouped_search)

</domain>

<decisions>
## Implementation Decisions

### Grouping API
- **D-01:** Group results by `gesetz` field only. No rechtsgebiet grouping — gesetz is the natural grouping for legal search.
- **D-02:** Group size configurable per request via `group_size` parameter (default 3, range 1-10). Default set via `GROUP_SIZE_DEFAULT` ENV var.
- **D-03:** Maximum groups configurable per request via `max_groups` parameter (default 10, range 1-20). Default set via `GROUP_MAX_GROUPS` ENV var.
- **D-04:** New dedicated endpoint `POST /api/search/grouped`. Separate from `/api/search` because grouped responses have a fundamentally different structure (groups array vs flat results). Uses `query_points_groups` internally.

### Discovery API
- **D-05:** Dual-input like Phase 4 Recommend: accept both point IDs AND paragraph+gesetz pairs with internal ID resolution. Reuse Phase 4's resolution logic.
- **D-06:** Example limits configurable via ENV: `DISCOVERY_MAX_POSITIVE` (default 5), `DISCOVERY_MAX_NEGATIVE` (default 5). Minimum 1 positive required, 0 negative allowed (degrades to recommend behavior).
- **D-07:** New dedicated endpoint `POST /api/discover`. Separate from `/api/recommend` — Discovery has different semantics (positive+negative vs positive-only). Own Pydantic request/response models.
- **D-08:** Discovery uses Qdrant `DiscoverQuery` with `ContextPair` for positive/negative vector relationships.

### Grouped Recommendations
- **D-09:** New dedicated endpoint `POST /api/recommend/grouped`. Takes same input as `/api/recommend` but returns results grouped by gesetz.
- **D-10:** Shared config with grouped search: same `GROUP_SIZE_DEFAULT` and `GROUP_MAX_GROUPS` ENV vars apply to both grouped search and grouped recommendations.

### MCP Tool Strategy
- **D-11:** New `paragraf_discover` tool with dual-input (punkt_ids OR paragraph+gesetz) for both positive and negative examples. German params: `positiv_beispiele`, `negativ_beispiele`. Consistent with `paragraf_similar` pattern.
- **D-12:** New standalone `paragraf_grouped_search` tool with own parameters: `anfrage`, `gesetzbuch`, `group_size`, `max_groups`. Calls `/api/search/grouped` internally. Claude sees it as a distinct capability.
- **D-13:** New `paragraf_similar_grouped` tool for grouped recommendations. Mirrors REST API split. Claude can choose flat vs grouped results.

### ENV Configuration (Phase 4 D-15/D-16 continuation)
- **D-14:** New ENV vars in docker-compose.yml:
  - `GROUP_SIZE_DEFAULT` (default: 3)
  - `GROUP_MAX_GROUPS` (default: 10)
  - `DISCOVERY_MAX_POSITIVE` (default: 5)
  - `DISCOVERY_MAX_NEGATIVE` (default: 5)
- All added to Pydantic Settings in `config.py`.

### Claude's Discretion
- Whether Discovery results include a context label explaining why a result appeared (e.g., "similar to positive #1") — evaluate if this adds value for legal search
- Error handling for invalid/missing point IDs in Discovery
- Qdrant `DiscoverQuery` parameters (score_threshold, strategy details)
- Internal implementation of grouped response structure (how groups are ordered/sorted)
- Naming of Pydantic models for grouped responses

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Service Layer
- `backend/src/paragraf/services/qdrant_store.py` — `recommend()` method (line 461) as template for Discovery, `query_points()` pattern, `_build_filter()`, quantization params
- `backend/src/paragraf/api.py` — REST endpoint patterns, recommend route, search route
- `backend/src/paragraf/api_models.py` — Pydantic request/response models (RecommendRequest, SearchRequest as templates)
- `backend/src/paragraf/models/law.py` — SearchFilter, SearchResult, LawChunk, ChunkMetadata

### MCP Tools
- `backend/src/paragraf/tools/recommend.py` — `paragraf_similar` tool as template for `paragraf_discover` and `paragraf_similar_grouped`
- `backend/src/paragraf/tools/search.py` — `paragraf_search` tool as template for `paragraf_grouped_search`

### Configuration
- `backend/src/paragraf/config.py` — Pydantic Settings pattern (add new GROUP_*/DISCOVERY_* settings)
- `docker-compose.yml` — ENV variable configuration

### Prior Phase Context
- `.planning/phases/04-recommend-pagination/04-CONTEXT.md` — Recommend API design decisions, dual-input pattern, ENV-first config, query_points exclusive
- `.planning/phases/02-search-indexes-full-text/02-CONTEXT.md` — Extend-existing pattern, SearchFilter extension

### Qdrant API Reference
- `.planning/codebase/STACK.md` — Qdrant v1.13.2 capabilities, `query_points` unified API
- `.planning/research/STACK.md` — Qdrant API details including `query_points_groups`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QdrantStore.recommend()`: Template for Discovery method — add `DiscoverQuery` with `ContextPair` instead of `RecommendQuery`
- `QdrantStore._build_filter()`: Filter builder reusable for all new endpoints
- `QdrantStore._points_to_results()`: Result conversion reusable
- Point ID resolution logic in `recommend()` (paragraph+gesetz to UUID) — reuse for Discovery dual-input
- `_deduplicate_results()` in `tools/search.py` — reusable for MCP tool output
- Quantization search params pattern: `SearchParams(quantization=QuantizationSearchParams(rescore=True, oversampling=1.5))` — apply to all new queries

### Established Patterns
- **query_points exclusive**: All queries use `client.query_points()` — Discovery uses same with `DiscoverQuery`, Grouping uses `client.query_points_groups()`
- **Separate endpoints for separate semantics**: /api/search, /api/recommend, /api/search/batch — continue with /api/discover, /api/search/grouped, /api/recommend/grouped
- **Pydantic Settings for config**: New settings in `config.py` with ENV binding
- **MCP German params**: Deutsche Parameter-Namen in MCP-Tools
- **Async throughout**: All service methods async

### Integration Points
- `qdrant_store.py`: New methods `discover()`, `grouped_search()`, `grouped_recommend()`
- `api.py`: Three new endpoints: `/api/discover`, `/api/search/grouped`, `/api/recommend/grouped`
- `api_models.py`: New Pydantic models for discover, grouped search, grouped recommend requests/responses
- `config.py`: New settings: `group_size_default`, `group_max_groups`, `discovery_max_positive`, `discovery_max_negative`
- `tools/`: New files `discover.py`, `grouped_search.py`. New tool in `recommend.py` or separate file for `paragraf_similar_grouped`
- `docker-compose.yml`: New ENV vars

</code_context>

<specifics>
## Specific Ideas

- **Dual-input fuer Discovery**: User will explizit dasselbe Pattern wie bei paragraf_similar — punkt_ids ODER paragraph+gesetz. Konsistenz ueber alle Qdrant-basierten Tools.
- **ENV-first Konfiguration**: Alle Limits (group_size, max_groups, positive/negative limits) muessen als Docker-Umgebungsvariablen konfigurierbar sein. Fortsetzung von Phase 4 D-15/D-16.
- **Drei separate MCP Tools**: User bevorzugt klare Trennung — paragraf_discover, paragraf_grouped_search, paragraf_similar_grouped. Keine Mode-Flags auf bestehenden Tools.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-grouping-discovery-api*
*Context gathered: 2026-03-27*

# Phase 2: Search Indexes & Full-Text - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize the Qdrant collection with full-text and range indexes, then expose full-text keyword search as a new search mode alongside the existing semantic hybrid search. Backend-only phase — no frontend UI changes.

Requirements: INFRA-03 (Full-Text Index), INFRA-04 (Payload Range Filter), SRCH-06 (Full-Text Search Toggle)

</domain>

<decisions>
## Implementation Decisions

### Search Mode Design
- **D-01:** Single endpoint `/api/search` extended with `search_type` parameter: `'semantic'` (default, current behavior), `'fulltext'` (keyword-only), `'hybrid_fulltext'` (combines both). No separate endpoint.
- **D-02:** Full-text search skips cross-encoder reranking. Reranking only applies to semantic and hybrid modes. Full-text results use Qdrant's built-in text scoring.
- **D-03:** `SearchResponse` includes a `search_type` field echoing which mode produced the results. Useful for frontend toggle state and MCP consumers.

### Absatz Range Filtering
- **D-04:** `SearchFilter` extended with `absatz_von` (int | None) and `absatz_bis` (int | None) for min/max range queries. Single value: set both equal. Null = no filter.
- **D-05:** When absatz range filter is active, only absatz-level chunks (chunk_typ='absatz') are returned. Paragraph-level chunks (absatz=null) are excluded.

### Full-Text Search Behavior
- **D-06:** Full-text index on `text` payload field uses Qdrant's `multilingual` tokenizer for proper German compound word handling.
- **D-07:** Full-text search is case-insensitive (lowercase indexing).
- **D-08:** Minimum token length `min_token_len=2` — single-character tokens (section sign, bare numbers) are not indexed.
- **D-09:** Full-text results ranked by Qdrant's built-in text scoring, not just filtered.

### Index Creation
- **D-10:** New indexes (full-text on `text`, integer range on `absatz`) are NOT auto-created in `ensure_collection()`. A separate migration endpoint triggers index creation explicitly.
- **D-11:** Qdrant builds indexes from existing payload data — no re-indexing of laws required. Just create the index and Qdrant indexes all existing points automatically.

### MCP Tool Exposure
- **D-12:** Extend existing `paragraf_search` MCP tool with `suchmodus` parameter: `'semantisch'` (default), `'volltext'`, `'hybrid'`. No separate tool.
- **D-13:** Add `absatz_von` and `absatz_bis` parameters to `paragraf_search` MCP tool.
- **D-14:** Tool description includes guidance for Claude on when to use which search mode: 'semantisch' for meaning-based queries, 'volltext' for exact legal terms/paragraph numbers, 'hybrid' when unsure.

### Claude's Discretion
- Migration endpoint naming and REST design (e.g., `POST /api/indexes/create` or similar)
- Error handling for index creation failures
- Whether to add an index status check endpoint
- Qdrant TextIndex `max_token_len` configuration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Service Layer
- `backend/src/paragraf/services/qdrant_store.py` — Core Qdrant operations, `ensure_collection()` (existing KEYWORD indexes at lines 91-96), `hybrid_search()`, `_build_filter()` (extend for absatz range + text match)
- `backend/src/paragraf/api.py` — REST endpoint patterns, search route at line 284, reranking pipeline
- `backend/src/paragraf/api_models.py` — `SearchRequest` (add search_type), `SearchResponse` (add search_type field), `SearchResultItem` (absatz field exists)
- `backend/src/paragraf/models/law.py` — `SearchFilter` (extend with absatz_von/absatz_bis), `ChunkMetadata` (absatz is int|None, 1-based)

### MCP Tools
- `backend/src/paragraf/tools/search.py` — `paragraf_search` MCP tool (extend with suchmodus, absatz_von, absatz_bis parameters)

### Configuration
- `backend/src/paragraf/config.py` — Settings class, add any search mode defaults here
- `docker-compose.yml` — Environment variable configuration

### Parser (context only)
- `backend/src/paragraf/services/parser.py` — Lines 248-260: absatz-level chunks created only when paragraph > 800 chars, absatz is 1-based int

### Phase 1 Context
- `.planning/phases/01-snapshot-safety-net/01-CONTEXT.md` — Established patterns for async services, REST/MCP integration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QdrantStore._build_filter()`: Extend with `Range` condition for absatz_von/absatz_bis and `MatchText` for full-text
- `QdrantStore.hybrid_search()`: Template for new `fulltext_search()` method
- `SearchFilter` model: Add absatz_von, absatz_bis fields
- `SearchRequest/SearchResponse` models: Add search_type field
- `paragraf_search` MCP tool: Add suchmodus, absatz_von, absatz_bis parameters
- Existing KEYWORD index creation pattern in `ensure_collection()` lines 91-96

### Established Patterns
- **Async throughout**: All service methods use `async/await`
- **Filter builder**: `_build_filter()` accumulates `FieldCondition` list into `Filter(must=[...])`
- **Dedup logic**: `api.py` deduplicates paragraph vs. absatz chunks by paragraph+gesetz key
- **MCP tool pattern**: `@mcp.tool()` decorator, German parameter names, `ctx.app_context` for service access
- **REST pattern**: Pydantic request model -> service call -> Pydantic response model

### Integration Points
- `qdrant_store.py`: New `fulltext_search()` method, extend `_build_filter()` for Range and MatchText
- `api.py`: Branch on `search_type` in search endpoint, skip reranking for fulltext mode
- `api_models.py`: Extend `SearchRequest` with `search_type`, `SearchResponse` with `search_type`
- `models/law.py`: Extend `SearchFilter` with `absatz_von`, `absatz_bis`
- `tools/search.py`: Add `suchmodus`, `absatz_von`, `absatz_bis` params to `paragraf_search`
- New migration endpoint for index creation (new route in `api.py`)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User consistently chose recommended options, preferring clean conventions (multilingual tokenizer, case-insensitive, min 2 token length) and single-surface API design (extend existing endpoints rather than creating new ones).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-search-indexes-full-text*
*Context gathered: 2026-03-27*

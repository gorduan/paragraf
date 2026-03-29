# Phase 6: Cross-Reference Pipeline - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract legal cross-references from paragraph text, store them as structured payload in Qdrant, and expose a citation network API for navigating between referencing and referenced norms. Backend-only phase — no frontend UI (that's Phase 9).

Requirements: XREF-01 (Regex extraction), XREF-02 (Payload storage), XREF-03 (Re-indexing with references), XREF-04 (Citation network API), MCP-03 (paragraf_references tool)

</domain>

<decisions>
## Implementation Decisions

### Citation Pattern Scope
- **D-01:** Core patterns: § X GESETZ, § X Abs. Y GESETZ, Art. X GESETZ, i.V.m. chains. Covers ~90% of real citations. Expandable later without re-architecture.
- **D-02:** All extracted citations tagged as `verified` (law abbreviation in LAW_REGISTRY) or `unverified` (not in registry). Both are stored — unverified captures references to laws not yet indexed.
- **D-03:** i.V.m. chains split into separate references. "§ 5 Abs. 1 i.V.m. § 6 Abs. 2 SGB IX" becomes two independent references, each independently navigable.

### Payload & Storage Design
- **D-04:** References stored as structured objects in `references_out` payload field: `{gesetz, paragraph, absatz, raw, verified, kontext}`. Enables filtering by target law, granular lookups, and clean API responses.
- **D-05:** Context keyword stored per reference (`kontext` field): 'i.V.m.', 'gemaess', 'nach', 'siehe', null. Explains WHY a paragraph cites another.

### Incoming Reference Lookup
- **D-06:** Qdrant payload filter at query time as default strategy. Query references_out fields with nested match to find "what cites this paragraph". No pre-computation needed.
- **D-07:** Resolution strategy configurable via environment variable (e.g., `XREF_RESOLUTION_STRATEGY`). Default: `filter` (query-time). Future option: `precomputed` (reverse index).
- **D-08:** API response includes `incoming_count` alongside the list of citing paragraphs. Uses Qdrant count query with same filter.

### Re-indexing Approach
- **D-09:** `set_payload` as default approach — adds `references_out` to existing points without re-embedding. No downtime, vectors unchanged. Snapshot created before operation (Phase 1 D-03).
- **D-10:** Full re-index must also be possible as an option (e.g., parameter on extraction endpoint). For cases where complete data refresh is needed.
- **D-11:** Standalone endpoint `POST /api/references/extract` triggers extraction + set_payload on all indexed laws. Independent of indexing flow. Also callable via MCP tool.

### Claude's Discretion
- Regex implementation details and test strategy for citation patterns
- Pydantic model names for reference objects
- Error handling for partial extraction failures (some laws succeed, some fail)
- Whether to add a `POST /api/references/extract/{gesetz}` single-law variant
- Nested filter structure for Qdrant payload queries on structured objects

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Service Layer
- `backend/src/paragraf/services/qdrant_store.py` — Core Qdrant operations, `_build_filter()` pattern for payload filtering, `set_payload` via AsyncQdrantClient
- `backend/src/paragraf/services/parser.py` — Law text parsing, chunk creation (lines 220-265), paragraph text format that extraction runs on
- `backend/src/paragraf/api.py` — REST endpoint patterns, `_normalize_paragraph_input()` for §-normalization (line 208-212)
- `backend/src/paragraf/api_models.py` — Pydantic request/response model patterns

### Models
- `backend/src/paragraf/models/law.py` — `ChunkMetadata` (line 204-219, needs `references_out` field), `LAW_REGISTRY` for citation validation, `SearchFilter`, `LawChunk`

### MCP Tools
- `backend/src/paragraf/tools/search.py` — MCP tool registration pattern
- `backend/src/paragraf/tools/discover.py` — Dual-input pattern (punkt_id or paragraph+gesetz string), `_resolve_examples` pattern

### Configuration
- `backend/src/paragraf/config.py` — Pydantic Settings pattern, add XREF_RESOLUTION_STRATEGY
- `docker-compose.yml` — Environment variable configuration

### Prior Phase Context
- `.planning/phases/01-snapshot-safety-net/01-CONTEXT.md` — Snapshot before re-indexing (D-03), async service patterns
- `.planning/phases/02-search-indexes-full-text/02-CONTEXT.md` — Extend existing endpoints pattern, _build_filter() extension pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LAW_REGISTRY` (95+ entries): Validates extracted law abbreviations for verified/unverified tagging
- `_normalize_paragraph_input()`: §-character normalization, reusable for citation text cleanup
- `_build_filter()`: Qdrant filter builder pattern — extend for nested reference payload queries
- `AsyncQdrantClient.set_payload()`: Available for adding references_out without re-embedding
- `AppContext`: Holds service instances — extraction service can use existing `qdrant` and `parser` references

### Established Patterns
- **Async throughout**: All service methods use async/await
- **MCP tool pattern**: `@mcp.tool()` decorator, German parameter names, `ctx.app_context` for service access
- **REST pattern**: Pydantic request model -> service call -> Pydantic response model
- **Dual-input**: Accept either punkt_id or paragraph+gesetz string (from Phase 4/5 tools)
- **Snapshot-before-modify**: Auto-snapshot before any collection modification (Phase 1 D-03)

### Integration Points
- New `CrossReferenceExtractor` service class in `backend/src/paragraf/services/`
- `qdrant_store.py`: New methods for set_payload (references), nested filter queries for incoming refs, count queries
- `api.py`: New `/api/references/extract` and `/api/references/{gesetz}/{paragraph}` endpoints
- `api_models.py`: New reference-related Pydantic models
- `tools/`: New `references.py` MCP tool file for `paragraf_references`
- `config.py`: Add `XREF_RESOLUTION_STRATEGY` setting
- `docker-compose.yml`: Add XREF env vars

</code_context>

<specifics>
## Specific Ideas

- User wants both fast (set_payload) and thorough (full re-index) paths available — not either/or
- Incoming reference resolution must be configurable via ENV for future flexibility
- Unverified references (laws not in registry) should still be stored, not discarded

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-cross-reference-pipeline*
*Context gathered: 2026-03-27*

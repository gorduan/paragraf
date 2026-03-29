# Phase 1: Snapshot Safety Net - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement Qdrant snapshot backup/restore and scalar quantization for the "paragraf" collection. This is the safety net that enables all subsequent collection modifications (re-indexing, schema changes, new indexes) to proceed without risk of data loss.

Requirements: INFRA-01 (Snapshot API), INFRA-02 (Scalar Quantization), MCP-06 (paragraf_snapshot tool)

</domain>

<decisions>
## Implementation Decisions

### Snapshot Storage
- **D-01:** Snapshots stored in Qdrant-internal `/qdrant/snapshots` directory, already part of the `qdrant_data` Docker volume. No extra volume needed.
- **D-02:** Retain last 3 snapshots maximum. Oldest auto-deleted when limit exceeded.
- **D-03:** Automatic snapshot before every re-indexing operation. Index endpoint creates snapshot before writing new data — safety net without extra user action.

### Scalar Quantization
- **D-04:** Scalar quantization (Float32 -> Int8) for dense vectors only. Sparse vectors untouched.
- **D-05:** Activate retroactively via `update_collection` on existing collection. No re-indexing required.
- **D-06:** Always rescore with original vectors after quantized search. `rescore=True`, `oversampling=1.5`. Best quality with reduced RAM.

### API Design
- **D-07:** Dedicated REST namespace: `POST /api/snapshots` (create), `GET /api/snapshots` (list), `POST /api/snapshots/{name}/restore` (restore), `DELETE /api/snapshots/{name}` (delete).
- **D-08:** Single MCP tool `paragraf_snapshot(aktion, name?)` with actions: 'erstellen', 'auflisten', 'wiederherstellen', 'loeschen'. One tool, multiple actions pattern.
- **D-09:** Synchronous responses for all snapshot operations. No SSE streaming — snapshots are fast (seconds).

### Claude's Discretion
- Error handling strategy for failed snapshots/restores
- Naming convention for auto-created snapshots (e.g., timestamp-based)
- Whether to log quantization activation status in health endpoint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Service Layer
- `backend/src/paragraf/services/qdrant_store.py` — Core Qdrant operations, `ensure_collection()`, `hybrid_search()`, `AsyncQdrantClient` usage
- `backend/src/paragraf/api.py` — REST endpoint patterns (FastAPI router, lifespan, error handling)
- `backend/src/paragraf/api_models.py` — Pydantic request/response model patterns
- `backend/src/paragraf/tools/ingest.py` — MCP tool patterns for index operations (where auto-snapshot integrates)

### MCP Tools
- `backend/src/paragraf/tools/search.py` — MCP tool registration pattern with FastMCP
- `backend/src/paragraf/tools/lookup.py` — Simpler MCP tool examples

### Configuration
- `backend/src/paragraf/config.py` — Pydantic Settings pattern
- `docker-compose.yml` — Qdrant service config, volume mapping

### Research
- `.planning/research/STACK.md` — Qdrant v1.13.2 API capabilities, `query_points` unified API
- `.planning/research/PITFALLS.md` — Snapshot-before-destructive-change requirement, quantization dense-only guidance

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QdrantStore` class: All Qdrant operations go through this service. New snapshot/quantization methods add here.
- `AsyncQdrantClient`: Already initialized with timeout=30s. Snapshot API is on the same client.
- `AppContext` dataclass: Holds service instances. Snapshot service doesn't need a new context entry — uses existing `qdrant` store.

### Established Patterns
- **Async throughout**: All service methods are async, use `await`. Snapshot methods follow same pattern.
- **Lazy loading**: Models load on first use. Qdrant connection is eager (in lifespan). Snapshot API is ready immediately.
- **MCP tool pattern**: Tools in `tools/` directory, registered via `@mcp.tool()` decorator, use `ctx.app_context` for service access.
- **REST pattern**: FastAPI routes in `api.py`, Pydantic models in `api_models.py`, service calls via `app.state.app_context`.
- **Error handling**: try/except with logging, HTTP 500 responses for unexpected errors.

### Integration Points
- `api.py`: Add snapshot routes alongside existing `/api/index` routes
- `tools/ingest.py`: Hook auto-snapshot into `paragraf_index` before indexing starts
- `qdrant_store.py`: Add `create_snapshot()`, `list_snapshots()`, `restore_snapshot()`, `delete_snapshot()`, `enable_quantization()` methods
- `api_models.py`: Add `SnapshotResponse`, `SnapshotListResponse` models

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants reliable backup/restore and memory optimization.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-snapshot-safety-net*
*Context gathered: 2026-03-27*

# Phase 1: Snapshot Safety Net - Research

**Researched:** 2026-03-27
**Domain:** Qdrant snapshot API, scalar quantization, MCP tool design
**Confidence:** HIGH

## Summary

Phase 1 adds a snapshot backup/restore mechanism and scalar quantization to the existing Qdrant collection. This is pure backend work touching three files primarily: `qdrant_store.py` (new methods), `api.py` (new REST endpoints), and a new `tools/snapshot.py` (MCP tool). The Qdrant Python client (`AsyncQdrantClient`) already includes all required snapshot methods (`create_snapshot`, `list_snapshots`, `delete_snapshot`, `recover_snapshot`) and quantization configuration (`update_collection` with `ScalarQuantization`). No new dependencies are needed.

The existing codebase has well-established patterns for both REST endpoints and MCP tools that this phase should follow exactly. The `QdrantStore` class is the single point of contact for all Qdrant operations, and new snapshot/quantization methods belong there.

**Primary recommendation:** Add 5 methods to `QdrantStore`, 4 REST endpoints under `/api/snapshots`, and 1 MCP tool `paragraf_snapshot` with multi-action pattern. Enable scalar quantization on the dense vector via `update_collection`. Auto-snapshot before re-indexing by hooking into the existing index endpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Snapshots stored in Qdrant-internal `/qdrant/snapshots` directory, already part of the `qdrant_data` Docker volume. No extra volume needed.
- **D-02:** Retain last 3 snapshots maximum. Oldest auto-deleted when limit exceeded.
- **D-03:** Automatic snapshot before every re-indexing operation. Index endpoint creates snapshot before writing new data -- safety net without extra user action.
- **D-04:** Scalar quantization (Float32 -> Int8) for dense vectors only. Sparse vectors untouched.
- **D-05:** Activate retroactively via `update_collection` on existing collection. No re-indexing required.
- **D-06:** Always rescore with original vectors after quantized search. `rescore=True`, `oversampling=1.5`. Best quality with reduced RAM.
- **D-07:** Dedicated REST namespace: `POST /api/snapshots` (create), `GET /api/snapshots` (list), `POST /api/snapshots/{name}/restore` (restore), `DELETE /api/snapshots/{name}` (delete).
- **D-08:** Single MCP tool `paragraf_snapshot(aktion, name?)` with actions: 'erstellen', 'auflisten', 'wiederherstellen', 'loeschen'. One tool, multiple actions pattern.
- **D-09:** Synchronous responses for all snapshot operations. No SSE streaming -- snapshots are fast (seconds).

### Claude's Discretion
- Error handling strategy for failed snapshots/restores
- Naming convention for auto-created snapshots (e.g., timestamp-based)
- Whether to log quantization activation status in health endpoint

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Snapshot API integriert -- Backup vor Re-Indexierung erstellen und wiederherstellen | Qdrant client provides `create_snapshot`, `list_snapshots`, `recover_snapshot`, `delete_snapshot` methods on `AsyncQdrantClient`. REST endpoints under `/api/snapshots`. Auto-snapshot hook in index endpoint. |
| INFRA-02 | Scalar Quantization fuer Dense-Vektoren aktiviert (Sparse unberuehrt) | `update_collection` with `ScalarQuantization(scalar=ScalarQuantizationConfig(type=ScalarType.INT8))`. Applied to collection level, affects dense vectors. Search params need `quantization=QuantizationSearchParams(rescore=True, oversampling=1.5)`. |
| MCP-06 | MCP-Tool `paragraf_snapshot` -- Backup erstellen/wiederherstellen | New file `tools/snapshot.py` with `register_snapshot_tools(mcp)`. Single tool with `aktion` parameter (Literal type). Follows existing MCP tool patterns from `tools/search.py` and `tools/lookup.py`. |
</phase_requirements>

## Standard Stack

### Core (already in project -- no additions needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| qdrant-client | >=1.12.0 (current in pyproject.toml) | Snapshot API + quantization config | All required methods (`create_snapshot`, `list_snapshots`, `recover_snapshot`, `delete_snapshot`, `update_collection`) are available in >=1.12.0 |
| FastAPI | >=0.115.0 | REST endpoints for snapshots | Already in stack |
| FastMCP (mcp[cli]) | >=1.0.0 | MCP tool registration | Already in stack |
| Pydantic | >=2.0.0 | Request/response models | Already in stack |

### No New Dependencies Required

This phase requires zero new packages. The Qdrant Python client already supports all snapshot and quantization operations.

**Installation:** Nothing to install.

## Architecture Patterns

### Recommended Project Structure Changes

```
backend/src/paragraf/
  services/
    qdrant_store.py        # ADD: 5 new methods (snapshot CRUD + enable_quantization)
  api.py                   # ADD: 4 new REST routes under /api/snapshots
                           # MODIFY: index endpoint to auto-snapshot before indexing
  api_models.py            # ADD: SnapshotInfo, SnapshotListResponse, SnapshotCreateResponse
  tools/
    snapshot.py            # NEW: paragraf_snapshot MCP tool
    __init__.py            # unchanged
  server.py                # ADD: register_snapshot_tools(mcp) import + call
  config.py                # ADD: snapshot_max_count: int = 3 setting
```

### Pattern 1: QdrantStore Service Methods

**What:** All Qdrant interactions go through the `QdrantStore` class. Snapshot and quantization methods follow the same async pattern as existing methods.

**Example:**
```python
# Source: existing pattern from qdrant_store.py
async def create_snapshot(self) -> str:
    """Erstellt einen Snapshot der Collection. Gibt den Snapshot-Namen zurueck."""
    snapshot = await self.client.create_snapshot(
        collection_name=self.collection_name,
        wait=True,
    )
    return snapshot.name

async def list_snapshots(self) -> list[SnapshotDescription]:
    """Listet alle Snapshots der Collection."""
    return await self.client.list_snapshots(
        collection_name=self.collection_name,
    )

async def restore_snapshot(self, snapshot_name: str) -> bool:
    """Stellt die Collection aus einem Snapshot wieder her."""
    # Qdrant recover_snapshot needs a location (URL or file path)
    # Internal snapshots are at: file:///qdrant/snapshots/{collection}/{snapshot_name}
    location = f"file:///qdrant/snapshots/{self.collection_name}/{snapshot_name}"
    return await self.client.recover_snapshot(
        collection_name=self.collection_name,
        location=location,
        wait=True,
    )

async def delete_snapshot(self, snapshot_name: str) -> bool:
    """Loescht einen Snapshot."""
    return await self.client.delete_snapshot(
        collection_name=self.collection_name,
        snapshot_name=snapshot_name,
        wait=True,
    )

async def delete_oldest_snapshots(self, max_count: int = 3) -> list[str]:
    """Loescht aelteste Snapshots wenn mehr als max_count vorhanden."""
    snapshots = await self.list_snapshots()
    if len(snapshots) <= max_count:
        return []
    # Sort by creation_time, delete oldest
    sorted_snaps = sorted(snapshots, key=lambda s: s.creation_time or "")
    to_delete = sorted_snaps[:len(snapshots) - max_count]
    deleted = []
    for snap in to_delete:
        await self.delete_snapshot(snap.name)
        deleted.append(snap.name)
    return deleted

async def enable_scalar_quantization(self) -> None:
    """Aktiviert Scalar Quantization (Int8) fuer Dense-Vektoren."""
    await self.client.update_collection(
        collection_name=self.collection_name,
        quantization_config=models.ScalarQuantization(
            scalar=models.ScalarQuantizationConfig(
                type=models.ScalarType.INT8,
                quantile=0.99,
                always_ram=True,
            ),
        ),
    )
```

### Pattern 2: REST Endpoints (following existing api.py patterns)

**What:** Snapshot REST endpoints follow the same pattern as existing routes: `_get_ctx(request)` to access services, Pydantic response models, try/except with logging.

**Example:**
```python
# Source: existing pattern from api.py
@app.post("/api/snapshots", response_model=SnapshotCreateResponse)
async def create_snapshot(request: Request) -> SnapshotCreateResponse:
    ctx = _get_ctx(request)
    qdrant = ctx.qdrant
    try:
        name = await qdrant.create_snapshot()
        deleted = await qdrant.delete_oldest_snapshots(max_count=settings.snapshot_max_count)
        return SnapshotCreateResponse(
            name=name,
            erfolg=True,
            geloeschte_snapshots=deleted,
        )
    except Exception as e:
        logger.error("Snapshot-Erstellung fehlgeschlagen: %s", e)
        return JSONResponse(status_code=500, content={"detail": str(e)})
```

### Pattern 3: MCP Tool (following existing tools/search.py pattern)

**What:** Single MCP tool with `aktion` parameter using `Literal` type for constrained action values. Follows the `register_*_tools(mcp)` pattern.

**Example:**
```python
# Source: existing pattern from tools/search.py, tools/ingest.py
def register_snapshot_tools(mcp: FastMCP) -> None:
    """Registriert Snapshot-Tools."""

    @mcp.tool()
    async def paragraf_snapshot(
        ctx: Context,
        aktion: str,  # 'erstellen', 'auflisten', 'wiederherstellen', 'loeschen'
        name: str | None = None,
    ) -> str:
        """Verwaltet Snapshots der Qdrant-Collection fuer Backup und Wiederherstellung.
        ...
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant
        # dispatch based on aktion
```

### Pattern 4: Auto-Snapshot Before Indexing

**What:** Hook into the existing `/api/index` POST endpoint and `paragraf_index` MCP tool to create a snapshot before any indexing operation begins.

**Integration points:**
- `api.py` line ~616: `index_gesetze()` function -- add snapshot call before SSE stream starts
- `tools/ingest.py` line ~19: `paragraf_index()` function -- add snapshot call before indexing

### Anti-Patterns to Avoid
- **Separate snapshot service class:** Do NOT create a new `SnapshotService` class. All Qdrant operations belong in `QdrantStore`. The `AppContext` dataclass does not need a new field.
- **Exposing Qdrant snapshot URLs to frontend:** Snapshot restore uses internal Qdrant file paths. Never expose these to the frontend REST API response.
- **Blocking startup for quantization:** Quantization activation should be idempotent and run during `ensure_collection()` or as a one-time migration, not on every request.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot file management | Custom file copy/move logic | `AsyncQdrantClient.create_snapshot()` + `recover_snapshot()` | Qdrant manages snapshot files internally in `/qdrant/snapshots/`. Attempting to manage files directly bypasses Qdrant's consistency guarantees. |
| Snapshot naming | Custom UUID/timestamp generator for snapshot names | Qdrant's auto-generated names (format: `{collection}-{timestamp}.snapshot`) | Qdrant generates consistent, sortable names. Custom names would require mapping. |
| Quantization implementation | Custom int8 vector conversion | `models.ScalarQuantization` config via `update_collection()` | Qdrant handles the quantization math, storage, and transparent rescoring internally. |
| Snapshot retention policy | Cron job or scheduled cleanup | Inline cleanup after each `create_snapshot()` call | Simple: list, sort by time, delete oldest if count > max. No scheduler needed for a 3-snapshot limit. |

**Key insight:** Qdrant's built-in snapshot and quantization APIs handle all the complexity. The implementation is thin wrapper methods that delegate to the client SDK.

## Common Pitfalls

### Pitfall 1: Snapshot Restore Location Format

**What goes wrong:** `recover_snapshot()` requires a `location` parameter that can be a URL (`http://...`) or a file path (`file:///qdrant/snapshots/...`). Using the wrong format or wrong path causes silent failure.

**Why it happens:** The Qdrant docs show multiple location formats (HTTP URL, file path, S3 URL). For internal Docker snapshots, the file path must use the container-internal path, not the host path.

**How to avoid:** Use `file:///qdrant/snapshots/{collection_name}/{snapshot_name}` for snapshots stored in the default Qdrant snapshot directory. This is the container-internal path, not the Docker volume mount path.

**Warning signs:** `recover_snapshot()` returns `True` but collection data doesn't change, or returns an error about file not found.

### Pitfall 2: Concurrent Writes During Snapshot

**What goes wrong:** Creating a snapshot while an indexing operation is in progress can produce an inconsistent snapshot. Restoring from it may result in partial data.

**Why it happens:** Qdrant snapshots are not transactional locks. They capture the state at a point in time, but concurrent writes during creation can lead to partial capture.

**How to avoid:** The auto-snapshot-before-indexing design (D-03) naturally avoids this -- snapshot is created BEFORE any writes begin. For manual snapshots via REST/MCP, document that users should not create snapshots during active indexing.

**Warning signs:** Snapshot file size varies unexpectedly, restored collection has different point count than expected.

### Pitfall 3: Quantization Applied to Wrong Vector or Not Applied At All

**What goes wrong:** Calling `update_collection` with quantization config but not seeing memory reduction. Or quantization breaking sparse search.

**Why it happens:** Qdrant GitHub Issue #6125 documents cases where quantization is not applied correctly. Additionally, the quantization config at collection level applies to dense vectors by default (not sparse), which is correct for this use case, but developers may misunderstand the scope.

**How to avoid:** After enabling quantization, verify it by checking `get_collection()` response which includes `quantization_config` in the collection info. Qdrant v1.13.2 applies scalar quantization to dense vectors at the collection level. Sparse vectors use inverted indices and are not quantized.

**Warning signs:** `get_collection()` shows `quantization_config: None` after calling `update_collection()`. Memory usage unchanged.

### Pitfall 4: Search Quality After Quantization Without Rescoring

**What goes wrong:** Search quality drops noticeably because quantized vectors (int8) have lower precision than original float32 vectors.

**Why it happens:** By default Qdrant rescores with original vectors, but if `rescore=False` is set (or if search params override defaults), the approximate quantized distances are used for final ranking.

**How to avoid:** Always set `rescore=True` and `oversampling=1.5` in search parameters. This means Qdrant uses quantized vectors for fast candidate retrieval, then rescores the top candidates with original float32 vectors. The existing `hybrid_search` method needs to pass `SearchParams(quantization=QuantizationSearchParams(rescore=True, oversampling=1.5))` to `query_points`.

**Warning signs:** Search result order changes after enabling quantization. Results that were previously top-ranked now appear lower.

### Pitfall 5: Snapshot Name Validation for Delete/Restore

**What goes wrong:** User passes a snapshot name that doesn't exist, causing an unhandled exception from the Qdrant client.

**Why it happens:** The `delete_snapshot` and `recover_snapshot` methods throw exceptions when the snapshot name is invalid.

**How to avoid:** Validate snapshot name against `list_snapshots()` before attempting delete/restore. Return a clear German error message if snapshot not found.

## Code Examples

### Pydantic Response Models (api_models.py)

```python
# Source: follows existing api_models.py patterns
class SnapshotInfo(BaseModel):
    name: str = Field(description="Snapshot-Dateiname")
    creation_time: str | None = Field(None, description="Erstellungszeitpunkt")
    size: int = Field(0, description="Groesse in Bytes")

class SnapshotListResponse(BaseModel):
    snapshots: list[SnapshotInfo]
    total: int

class SnapshotCreateResponse(BaseModel):
    erfolg: bool
    name: str = Field(description="Name des erstellten Snapshots")
    nachricht: str = Field(default="", description="Statusmeldung")
    geloeschte_snapshots: list[str] = Field(
        default_factory=list,
        description="Namen der automatisch geloeschten aeltesten Snapshots",
    )

class SnapshotRestoreResponse(BaseModel):
    erfolg: bool
    nachricht: str = Field(description="Statusmeldung")
```

### Search Params with Quantization

```python
# Source: Qdrant Python client docs
# Must be added to hybrid_search and dense_search methods in qdrant_store.py
search_params = models.SearchParams(
    quantization=models.QuantizationSearchParams(
        rescore=True,
        oversampling=1.5,
    ),
)

# Pass to query_points:
results = await self.client.query_points(
    collection_name=self.collection_name,
    prefetch=prefetch_queries,
    query=models.FusionQuery(fusion=models.Fusion.RRF),
    limit=top_k,
    with_payload=True,
    search_params=search_params,  # NEW
)
```

### Settings Addition (config.py)

```python
# Source: follows existing config.py pattern
# Add to Settings class:
snapshot_max_count: int = 3
```

### Auto-Snapshot Hook in Index Endpoint

```python
# Source: integration into existing api.py index_gesetze function
# At the start of the SSE stream generator, before any indexing:
async def _index_stream(...):
    # Auto-snapshot before indexing
    try:
        snapshot_name = await qdrant.create_snapshot()
        await qdrant.delete_oldest_snapshots(max_count=settings.snapshot_max_count)
        logger.info("Auto-Snapshot erstellt: %s", snapshot_name)
        yield _sse_event(IndexProgressEvent(
            gesetz="system",
            schritt="snapshot",
            nachricht=f"Sicherungs-Snapshot erstellt: {snapshot_name}",
        ))
    except Exception as e:
        logger.warning("Auto-Snapshot fehlgeschlagen: %s", e)
        # Continue with indexing even if snapshot fails

    # ... existing indexing logic ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Qdrant backup via volume copy | Qdrant Snapshot API (built-in) | Available since Qdrant 1.x | Safe, atomic snapshots without Docker volume manipulation |
| Float32 vectors only | Scalar quantization (int8) with rescoring | Available since Qdrant 1.7 | 75% dense vector memory reduction with minimal quality loss |
| Separate search/recommend/discover endpoints | Unified `query_points` API | Qdrant 1.10+ | Simpler client code, single endpoint for all query types |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest >= 8.0.0 + pytest-asyncio >= 0.23.0 |
| Config file | `backend/pyproject.toml` (asyncio_mode = "auto") |
| Quick run command | `docker compose exec backend python -m pytest tests/test_qdrant_store.py -x -v` |
| Full suite command | `docker compose exec backend python -m pytest tests/ -v` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01a | create_snapshot returns snapshot name | unit (mocked client) | `pytest tests/test_qdrant_store.py::TestQdrantStoreSnapshots::test_create_snapshot -x` | No -- Wave 0 |
| INFRA-01b | list_snapshots returns list of SnapshotDescription | unit (mocked client) | `pytest tests/test_qdrant_store.py::TestQdrantStoreSnapshots::test_list_snapshots -x` | No -- Wave 0 |
| INFRA-01c | restore_snapshot calls recover_snapshot with correct file path | unit (mocked client) | `pytest tests/test_qdrant_store.py::TestQdrantStoreSnapshots::test_restore_snapshot -x` | No -- Wave 0 |
| INFRA-01d | delete_oldest_snapshots removes excess snapshots | unit (mocked client) | `pytest tests/test_qdrant_store.py::TestQdrantStoreSnapshots::test_delete_oldest_snapshots -x` | No -- Wave 0 |
| INFRA-01e | Auto-snapshot fires before indexing | unit (mocked) | `pytest tests/test_qdrant_store.py::TestQdrantStoreSnapshots::test_auto_snapshot_before_index -x` | No -- Wave 0 |
| INFRA-02a | enable_scalar_quantization calls update_collection with correct config | unit (mocked client) | `pytest tests/test_qdrant_store.py::TestQdrantStoreQuantization::test_enable_quantization -x` | No -- Wave 0 |
| INFRA-02b | Search params include quantization rescoring | unit | `pytest tests/test_qdrant_store.py::TestQdrantStoreQuantization::test_search_params_quantization -x` | No -- Wave 0 |
| MCP-06a | paragraf_snapshot 'erstellen' creates snapshot | unit (mocked) | `pytest tests/test_snapshot_tool.py::test_snapshot_erstellen -x` | No -- Wave 0 |
| MCP-06b | paragraf_snapshot 'auflisten' returns list | unit (mocked) | `pytest tests/test_snapshot_tool.py::test_snapshot_auflisten -x` | No -- Wave 0 |
| MCP-06c | paragraf_snapshot 'wiederherstellen' restores | unit (mocked) | `pytest tests/test_snapshot_tool.py::test_snapshot_wiederherstellen -x` | No -- Wave 0 |
| MCP-06d | paragraf_snapshot invalid action returns error | unit | `pytest tests/test_snapshot_tool.py::test_snapshot_invalid_action -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `docker compose exec backend python -m pytest tests/test_qdrant_store.py tests/test_snapshot_tool.py -x -v`
- **Per wave merge:** `docker compose exec backend python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_qdrant_store.py` -- add `TestQdrantStoreSnapshots` and `TestQdrantStoreQuantization` classes (extend existing file)
- [ ] `tests/test_snapshot_tool.py` -- new file for MCP snapshot tool tests
- [ ] No framework install needed -- pytest already configured

## Open Questions

1. **Snapshot restore file path format**
   - What we know: `recover_snapshot()` accepts `location` as a string. Qdrant stores snapshots at `/qdrant/snapshots/{collection_name}/`. The Docker volume `qdrant_data` maps to `/qdrant/storage`, not `/qdrant/snapshots`.
   - What's unclear: Whether the default snapshot directory (`/qdrant/snapshots`) is inside or outside the `qdrant_data` volume. The Docker config maps `qdrant_data:/qdrant/storage`, but snapshots default to `/qdrant/snapshots`.
   - Recommendation: Test with actual Qdrant Docker container. If snapshots are not persisted across container restarts (because `/qdrant/snapshots` is not in the volume), we may need to add a volume mount for snapshots or configure the snapshot storage path. The user decision D-01 says snapshots are "already part of the `qdrant_data` Docker volume" -- this needs verification. Qdrant's default snapshot directory may need explicit volume mapping.

2. **Quantization activation idempotency**
   - What we know: `update_collection` with the same quantization config can be called multiple times.
   - What's unclear: Whether calling it when quantization is already active is a no-op or triggers re-quantization.
   - Recommendation: Check collection info for existing quantization config before calling `update_collection`. Only apply if not already configured. This avoids unnecessary re-quantization on every startup.

3. **Snapshot path in Qdrant Docker**
   - What we know: Qdrant stores snapshots at a configurable path, default `/qdrant/snapshots`.
   - What's unclear: The current `docker-compose.yml` maps `qdrant_data:/qdrant/storage` but does not map a volume for `/qdrant/snapshots`.
   - Recommendation: Either add a snapshot volume (`snapshot_data:/qdrant/snapshots`) to `docker-compose.yml`, OR configure Qdrant to store snapshots inside `/qdrant/storage/snapshots` via environment variable `QDRANT__STORAGE__SNAPSHOTS_PATH=/qdrant/storage/snapshots`. The second option keeps the single-volume simplicity.

## Project Constraints (from CLAUDE.md)

- **Branch policy:** All commits go to branch `Docker-only`, never to main/master
- **Qdrant Version:** v1.13.2 (pinned Docker image) -- features must be compatible
- **Language:** Deutsche Docstrings, englische Variablen/Funktionsnamen
- **Async:** All service methods are async, use `await`
- **Error handling:** try/except with logging, German error messages
- **Config:** Via environment variables in docker-compose.yml, Pydantic Settings
- **MCP tools:** Registered via `@mcp.tool()` decorator in `tools/` directory files
- **REST pattern:** FastAPI routes in `api.py`, Pydantic models in `api_models.py`
- **Naming:** snake_case for functions/variables, PascalCase for classes/models
- **Testing:** pytest with asyncio_mode="auto", unit tests use mocked clients
- **Code style:** `from __future__ import annotations` at top of every file, `str | None` not `Optional[str]`
- **Ruff:** Line length 100, enabled rules: E, F, I, N, W, UP, B, SIM

## Sources

### Primary (HIGH confidence)
- [Qdrant Python Client - AsyncQdrantClient](https://python-client.qdrant.tech/qdrant_client.async_qdrant_client) -- verified `create_snapshot`, `list_snapshots`, `delete_snapshot`, `recover_snapshot` method signatures
- [Qdrant Snapshots Documentation](https://qdrant.tech/documentation/concepts/snapshots/) -- snapshot create, list, delete, recover API patterns
- [Qdrant Snapshot Tutorial](https://qdrant.tech/documentation/database-tutorials/create-snapshot/) -- create and restore workflow
- [Qdrant Quantization Docs](https://qdrant.tech/articles/what-is-vector-quantization/) -- ScalarQuantization config, INT8 type, quantile, always_ram
- Existing codebase: `backend/src/paragraf/services/qdrant_store.py` -- all Qdrant interaction patterns
- Existing codebase: `backend/src/paragraf/tools/search.py`, `tools/ingest.py`, `tools/lookup.py` -- MCP tool registration patterns
- Existing codebase: `backend/src/paragraf/api.py`, `api_models.py` -- REST endpoint and Pydantic model patterns

### Secondary (MEDIUM confidence)
- [Qdrant GitHub Issue #6125](https://github.com/qdrant/qdrant/issues/6125) -- quantization not applied correctly in some cases (edge case awareness)
- `.planning/research/STACK.md` -- Qdrant v1.13.2 API strategy, scalar quantization config
- `.planning/research/PITFALLS.md` -- snapshot-before-destructive-change pattern, quantization dense-only guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all APIs verified against official docs and client SDK
- Architecture: HIGH -- follows established patterns exactly, 5 canonical reference files reviewed
- Pitfalls: HIGH -- documented from Qdrant issues, official docs, and project-specific research

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- Qdrant v1.13.2 is pinned, client API is mature)

# Phase 4: Recommend & Pagination - Research

**Researched:** 2026-03-27
**Domain:** Qdrant Recommend API, Scroll API, Batch Query, MCP Tool Extension
**Confidence:** HIGH

## Summary

Phase 4 adds three backend capabilities to the existing Qdrant-based law search system: (1) a Recommend endpoint using Qdrant's `query_points` with `RecommendQuery` to find similar paragraphs, (2) cursor-based pagination via Qdrant's `scroll()` method for navigating large result sets, and (3) a batch search endpoint executing multiple queries in parallel via `asyncio.gather()`. All three are also exposed as MCP tools.

The existing codebase already uses `query_points` exclusively (no legacy `search()` or `recommend()` calls), so Recommend integrates naturally by passing a `RecommendQuery` instead of a `FusionQuery`. The `scroll()` method is already used as a fallback in `fulltext_search` (line 436), confirming client compatibility. Batch query can use either `query_batch_points` (native Qdrant batching) or `asyncio.gather()` over existing `hybrid_search` calls -- the context decision D-11 specifies `asyncio.gather()`.

**Primary recommendation:** Use `models.RecommendQuery(recommend=models.RecommendInput(positive=[...]))` with the existing `query_points` pattern, reuse `_build_filter` and `_points_to_results` for all new methods, and extend SearchRequest/SearchResponse rather than creating parallel models for pagination.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dual-Input: Point-ID als primaerer Input UND paragraph+gesetz als Alternative mit interner Aufloesung zu Point-ID. Beides unterstuetzt.
- **D-02:** Konfigurierbarer `exclude_same_law` Parameter (default: true). Aufrufer entscheidet ob Ergebnisse aus dem gleichen Gesetz ein-/ausgeschlossen werden.
- **D-03:** Nur positive Beispiele in Phase 4. Keine Negative Examples -- Discovery API (Phase 5) bringt Positiv+Negativ-Kombination.
- **D-04:** Liste von 1-5 Point-IDs als Input unterstuetzt. Qdrant mittelt die Vektoren fuer Multi-ID-Recommend.
- **D-05:** Neuer REST-Endpoint `POST /api/recommend` (nicht auf /api/search aufgesetzt -- eigene Semantik).
- **D-06:** Cursor-basierte Pagination mit Qdrant Scroll API. Response enthaelt `next_cursor` Feld (null = letzte Seite).
- **D-07:** Standard-Seitengroesse 10 Ergebnisse (konsistent mit bestehendem `final_top_k`). Konfigurierbar per Parameter `page_size`.
- **D-08:** Bestehenden `/api/search` Endpoint erweitern: optionaler `cursor` Parameter in SearchRequest. Ohne cursor = erste Seite (wie bisher). SearchResponse bekommt `next_cursor` Feld.
- **D-09:** Neuer separater Endpoint `POST /api/search/batch`. Body ist Array von SearchRequests. Klare Trennung von Single-Search.
- **D-10:** Maximum 10 parallele Queries (konfigurierbar via ENV). Backend liefert `load_warning: true` im Response wenn Auslastung hoch -- Frontend-Dialog mit Reduktions-Optionen kommt in Phase 8.
- **D-11:** Alle Queries werden mit `asyncio.gather()` parallel ausgefuehrt. Gemeinsame Filter moeglich aber nicht erzwungen -- jede Query hat eigene Filter.
- **D-12:** Neues eigenes `paragraf_similar` MCP-Tool (MCP-01). Nicht in paragraf_search integriert -- klare Trennung fuer Claude.
- **D-13:** paragraf_similar bekommt dieselben Filter-Parameter wie paragraf_search: gesetzbuch, abschnitt, absatz_von, absatz_bis. Konsistente API (MCP-05).
- **D-14:** Pagination auch im MCP exponiert: paragraf_search bekommt optionalen `cursor` Parameter. Response enthaelt `next_cursor`. Claude kann durch grosse Ergebnismengen blaettern.
- **D-15:** ALLE leistungs- und suchrelevanten Einstellungen muessen als Docker-Umgebungsvariablen in docker-compose.yml konfigurierbar sein.
- **D-16:** Alle neuen Einstellungen in Pydantic Settings (`config.py`) mit sinnvollen Defaults.

### Claude's Discretion
- Genaue Qdrant `query_points` Parameter fuer Recommend (strategy, score_threshold)
- Interne Point-ID-Aufloesung: Lookup-Strategie (scroll mit exaktem Filter vs. dedizierter Index)
- Error Handling bei nicht gefundenen Point-IDs oder leeren Recommend-Ergebnissen
- Naming der Pydantic-Modelle fuer Recommend Request/Response
- Ob `load_warning` als Response-Feld oder HTTP-Header zurueckgegeben wird

### Deferred Ideas (OUT OF SCOPE)
- Batch-Limit UI-Dialog (Phase 8)
- Rueckwirkende ENV-Audit bestehender Settings
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | Qdrant Recommend API -- aehnliche Paragraphen zu einem gegebenen Punkt finden | `query_points` with `RecommendQuery` + `RecommendInput(positive=[...])`, strategy `average_vector` (default), reuse `_build_filter` and `_points_to_results` |
| SRCH-04 | Qdrant Scroll API -- paginierte Ergebnisse mit Offset/Limit | `scroll()` method returns `(records, next_page_offset)`, cursor is a Point ID (UUID string), pass as `offset` parameter |
| SRCH-08 | Batch Search Endpoint fuer parallele Queries | `asyncio.gather()` over existing `hybrid_search()` calls per D-11, validate count against `batch_max_queries` setting |
| MCP-01 | MCP-Tool `paragraf_similar` -- aehnliche Paragraphen via Recommend API | New file `tools/recommend.py`, register via `register_recommend_tools(mcp)`, same pattern as `tools/search.py` |
| MCP-05 | Abschnitt-Filter vollstaendig in allen MCP-Such-Tools exponieren | Already present in `paragraf_search` (abschnitt parameter exists); verify `paragraf_similar` includes it too |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| qdrant-client | >=1.12.0 (project spec) | Async Qdrant client with `query_points`, `scroll`, `query_batch_points` | Already in use; `RecommendQuery` available since 1.7+ |
| FastAPI | >=0.115.0 | REST endpoint definitions | Already in use |
| Pydantic | >=2.0.0 | Request/Response model definitions | Already in use |
| pydantic-settings | >=2.0.0 | ENV-based configuration | Already in use |
| FastMCP (mcp[cli]) | >=1.0.0 | MCP tool registration | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| asyncio (stdlib) | 3.12+ | `asyncio.gather()` for batch parallel execution | Batch search endpoint |
| uuid (stdlib) | 3.12+ | UUID5 generation for point ID resolution | Resolving paragraph+gesetz to point ID |

No new dependencies required. All features are covered by existing libraries.

## Architecture Patterns

### Recommended Project Structure
```
backend/src/paragraf/
├── services/
│   └── qdrant_store.py        # Add: recommend(), scroll_search()
├── api.py                      # Add: /api/recommend, /api/search/batch, cursor in /api/search
├── api_models.py               # Add: RecommendRequest, RecommendResponse, BatchSearchRequest, BatchSearchResponse
├── config.py                   # Add: batch_max_queries, scroll_page_size, recommend_default_limit
├── models/
│   └── law.py                  # No changes needed (SearchFilter already has all fields)
└── tools/
    ├── search.py               # Extend: add cursor param to paragraf_search
    └── recommend.py            # NEW: paragraf_similar MCP tool
```

### Pattern 1: RecommendQuery via query_points
**What:** Use the unified `query_points` API with `RecommendQuery` instead of the legacy `recommend()` endpoint.
**When to use:** For all recommend operations (SRCH-01).
**Example:**
```python
# Source: Qdrant Python Client docs + existing codebase pattern
from qdrant_client import models

results = await self.client.query_points(
    collection_name=self.collection_name,
    query=models.RecommendQuery(
        recommend=models.RecommendInput(
            positive=point_ids,  # list[str] of UUID strings
            strategy=models.RecommendStrategy.AVERAGE_VECTOR,
        ),
    ),
    using=DENSE_VECTOR_NAME,
    query_filter=qdrant_filter,
    limit=limit,
    with_payload=True,
    score_threshold=score_threshold,
    search_params=models.SearchParams(
        quantization=models.QuantizationSearchParams(
            rescore=True,
            oversampling=1.5,
        ),
    ),
)
```

### Pattern 2: Point-ID Resolution from paragraph+gesetz
**What:** Resolve a `(paragraph, gesetz)` pair to a Qdrant point UUID using `scroll()` with exact filter.
**When to use:** When the caller provides paragraph+gesetz instead of a point ID (D-01).
**Example:**
```python
# Source: Existing _build_filter + scroll pattern (qdrant_store.py line 436)
import uuid

async def _resolve_point_id(self, paragraph: str, gesetz: str) -> str | None:
    """Resolves paragraph+gesetz to Qdrant point UUID."""
    search_filter = SearchFilter(gesetz=gesetz, paragraph=paragraph, chunk_typ="paragraph")
    qdrant_filter = self._build_filter(search_filter)
    records, _ = await self.client.scroll(
        collection_name=self.collection_name,
        scroll_filter=qdrant_filter,
        limit=1,
        with_payload=["chunk_id"],
    )
    if not records:
        return None
    # Reconstruct the UUID5 used during upsert
    chunk_id = records[0].payload.get("chunk_id", "")
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))
```

### Pattern 3: Cursor-based Scroll Pagination
**What:** Extend search to support cursor-based pagination using Qdrant scroll.
**When to use:** For paginated browsing of filtered result sets (SRCH-04).
**Example:**
```python
# Source: Qdrant scroll API docs
records, next_offset = await self.client.scroll(
    collection_name=self.collection_name,
    scroll_filter=qdrant_filter,
    limit=page_size,
    offset=cursor,  # UUID string from previous next_page_offset, or None for first page
    with_payload=True,
)
# next_offset is None when no more pages exist
```

### Pattern 4: Batch Search with asyncio.gather
**What:** Execute multiple search queries in parallel using asyncio.gather.
**When to use:** For the batch search endpoint (SRCH-08, D-11).
**Example:**
```python
# Source: D-11 locked decision
async def batch_search(self, queries: list[SearchRequest]) -> list[SearchResponse]:
    tasks = [self._execute_single_search(q) for q in queries]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r if not isinstance(r, Exception) else error_response(r) for r in results]
```

### Pattern 5: exclude_same_law Filter Extension
**What:** When `exclude_same_law=True`, add a `must_not` condition to exclude the source paragraph's law.
**When to use:** Recommend endpoint (D-02).
**Example:**
```python
# Build filter, then add must_not for same law exclusion
if exclude_same_law and source_gesetz:
    if qdrant_filter is None:
        qdrant_filter = models.Filter(
            must_not=[
                models.FieldCondition(
                    key="gesetz",
                    match=models.MatchValue(value=source_gesetz),
                )
            ]
        )
    else:
        qdrant_filter.must_not = [
            models.FieldCondition(
                key="gesetz",
                match=models.MatchValue(value=source_gesetz),
            )
        ]
```

### Anti-Patterns to Avoid
- **Using legacy `recommend()` method:** Use `query_points` with `RecommendQuery` exclusively (project decision from roadmap).
- **Offset-based pagination on query_points:** `query_points` offset is numeric and slow for large offsets. Use `scroll()` for true cursor-based pagination.
- **Shared embedding service in batch:** Each `hybrid_search` call within `asyncio.gather` already encodes the query. Do NOT pre-encode all queries and try to batch embeddings -- the existing method handles encoding internally.
- **Returning point IDs to frontend without mapping:** Point IDs are UUID5 hashes. Always include the `chunk_id` (readable ID like "SGB_IX_§152") in responses so callers can refer back to them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recommend similar vectors | Custom cosine similarity search | `models.RecommendQuery` via `query_points` | Qdrant handles multi-vector averaging, strategy selection, and HNSW-accelerated search |
| Cursor-based pagination | Manual offset tracking / result caching | `scroll()` with `next_page_offset` | Qdrant's scroll is optimized for sequential iteration with stable cursors |
| Parallel query execution | Thread pool / process pool | `asyncio.gather()` | All Qdrant calls are already async; gather is the natural pattern |
| Point ID resolution | Secondary index / separate lookup table | `scroll()` with exact filter + UUID5 recomputation | The UUID5 is deterministic from chunk_id, and scroll with keyword filter is O(1) |
| Filter building | Separate filter constructors per endpoint | Reuse existing `_build_filter(SearchFilter)` | Already handles gesetz, paragraph, abschnitt, chunk_typ, absatz range |

**Key insight:** The existing `QdrantStore` class already has all the building blocks. Every new feature is a composition of existing methods (`_build_filter`, `_points_to_results`, `_records_to_results`, `scroll`, `query_points`) with different query types.

## Common Pitfalls

### Pitfall 1: Point ID Type Mismatch
**What goes wrong:** Qdrant point IDs in this project are UUID5 strings (e.g., `"a3f2c1d4-..."`), generated from chunk IDs via `uuid.uuid5(uuid.NAMESPACE_URL, chunk.id)`. Passing a raw chunk_id (like "SGB_IX_§152") as a point ID to `RecommendInput(positive=[...])` will fail.
**Why it happens:** The chunk_id stored in the payload is NOT the Qdrant point ID. The point ID is the UUID5 hash of the chunk_id.
**How to avoid:** Always resolve chunk_id to point UUID via `str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))` or use the `_resolve_point_id` method.
**Warning signs:** "Point not found" errors from Qdrant when calling recommend.

### Pitfall 2: Scroll Cursor is a Point ID, Not a Page Number
**What goes wrong:** Treating `next_page_offset` as an integer page number. Qdrant scroll cursors are Point IDs (UUID strings in this project).
**Why it happens:** Confusing scroll API with offset-based pagination.
**How to avoid:** Store and pass cursor values as opaque strings. The SearchRequest `cursor` field should be `str | None`, not `int`.
**Warning signs:** 400 errors from Qdrant when passing numeric cursors.

### Pitfall 3: Scroll Returns Unsorted Results (No Relevance Ranking)
**What goes wrong:** Expecting scroll results to be ranked by relevance. Scroll returns points sorted by ID, not by similarity score.
**Why it happens:** Scroll is a traversal API, not a search API.
**How to avoid:** For paginated *search* results, use `query_points` with `offset` parameter (numeric, less efficient for deep pages) or accept ID-ordered results from scroll for browsing use cases. Decision D-06/D-08 specifies scroll -- document this limitation clearly in API responses.
**Warning signs:** Users confused by result ordering when paginating search results.

### Pitfall 4: asyncio.gather Exception Handling in Batch
**What goes wrong:** One failing query in a batch kills all queries because `asyncio.gather` raises the first exception by default.
**Why it happens:** Not using `return_exceptions=True`.
**How to avoid:** Always use `asyncio.gather(*tasks, return_exceptions=True)` and handle individual failures in the results.
**Warning signs:** Entire batch returning 500 when a single query has invalid filters.

### Pitfall 5: Missing Quantization Params in Recommend
**What goes wrong:** Recommend results have lower quality than search because quantization rescore params are missing.
**Why it happens:** New method doesn't include the `search_params` with quantization settings that all other search methods use.
**How to avoid:** Copy the `search_params=models.SearchParams(quantization=...)` block from `hybrid_search` to the recommend method.
**Warning signs:** Lower recall quality in recommend vs. search with same vectors.

### Pitfall 6: Pagination on Reranked Results is Architecturally Incompatible
**What goes wrong:** Trying to paginate reranked search results with scroll. Reranking requires all candidates, so page 2 would need to re-run the full search + rerank and skip page 1 results.
**Why it happens:** Scroll operates on raw Qdrant data, but search goes through embed -> query -> rerank pipeline.
**How to avoid:** Pagination (D-08) should use scroll for browsing/filtering use cases (no reranking). For semantic search, the existing `max_ergebnisse` limit is the pagination mechanism. Document this clearly: cursor pagination is for filtered browsing, not for "page 2 of semantic search results."
**Warning signs:** Performance issues when paginating through reranked results.

## Code Examples

### RecommendRequest/Response Pydantic Models
```python
# Source: Existing api_models.py patterns
class RecommendRequest(BaseModel):
    point_ids: list[str] | None = Field(
        None,
        min_length=1,
        max_length=5,
        description="Liste von Qdrant Point-IDs (UUID-Strings)",
    )
    paragraph: str | None = Field(None, description="Paragraph als Alternative zu Point-ID")
    gesetz: str | None = Field(None, description="Gesetz als Alternative zu Point-ID")
    limit: int = Field(10, ge=1, le=50, description="Anzahl aehnlicher Ergebnisse")
    exclude_same_law: bool = Field(True, description="Ergebnisse aus dem gleichen Gesetz ausschliessen")
    gesetzbuch: str | None = Field(None, description="Filter nach Gesetzbuch")
    abschnitt: str | None = Field(None, description="Filter nach Abschnitt")
    absatz_von: int | None = Field(None, description="Absatz-Range Minimum")
    absatz_bis: int | None = Field(None, description="Absatz-Range Maximum")


class RecommendResponse(BaseModel):
    source_ids: list[str] = Field(description="Verwendete Point-IDs als Basis")
    results: list[SearchResultItem]
    total: int
    disclaimer: str = SearchResponse.model_fields["disclaimer"].default
```

### SearchRequest Extension for Pagination
```python
# Extend existing SearchRequest (api_models.py)
class SearchRequest(BaseModel):
    anfrage: str = Field(description="Suchanfrage in natuerlicher Sprache")
    # ... existing fields ...
    cursor: str | None = Field(None, description="Cursor fuer naechste Seite (aus next_cursor)")
    page_size: int = Field(10, ge=1, le=100, description="Ergebnisse pro Seite")


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int
    search_type: str = Field("semantic")
    next_cursor: str | None = Field(None, description="Cursor fuer naechste Seite (null = letzte Seite)")
    disclaimer: str = "..."
```

### BatchSearchRequest/Response
```python
class BatchSearchRequest(BaseModel):
    queries: list[SearchRequest] = Field(
        min_length=1,
        max_length=10,  # from settings.batch_max_queries
        description="Liste von Suchanfragen",
    )


class BatchSearchResponse(BaseModel):
    results: list[SearchResponse]
    total_queries: int
    load_warning: bool = Field(False, description="True wenn Auslastung hoch")
```

### Settings Extension
```python
# In config.py
class Settings(BaseSettings):
    # ... existing ...
    batch_max_queries: int = 10
    scroll_page_size: int = 10
    recommend_default_limit: int = 10
```

### QdrantStore.recommend() Method
```python
async def recommend(
    self,
    point_ids: list[str],
    limit: int = 10,
    search_filter: SearchFilter | None = None,
    exclude_gesetz: str | None = None,
    score_threshold: float | None = None,
) -> list[SearchResult]:
    """Findet aehnliche Paragraphen via Qdrant Recommend API."""
    qdrant_filter = self._build_filter(search_filter)

    # exclude_same_law: must_not auf Gesetz
    if exclude_gesetz:
        must_not = [
            models.FieldCondition(
                key="gesetz",
                match=models.MatchValue(value=exclude_gesetz),
            )
        ]
        if qdrant_filter is None:
            qdrant_filter = models.Filter(must_not=must_not)
        else:
            qdrant_filter.must_not = must_not

    results = await self.client.query_points(
        collection_name=self.collection_name,
        query=models.RecommendQuery(
            recommend=models.RecommendInput(
                positive=point_ids,
                strategy=models.RecommendStrategy.AVERAGE_VECTOR,
            ),
        ),
        using=DENSE_VECTOR_NAME,
        query_filter=qdrant_filter,
        limit=limit,
        with_payload=True,
        score_threshold=score_threshold,
        search_params=models.SearchParams(
            quantization=models.QuantizationSearchParams(
                rescore=True,
                oversampling=1.5,
            ),
        ),
    )
    return self._points_to_results(results)
```

### QdrantStore.scroll_search() Method
```python
async def scroll_search(
    self,
    search_filter: SearchFilter | None = None,
    limit: int = 10,
    cursor: str | None = None,
) -> tuple[list[SearchResult], str | None]:
    """Paginierte Suche via Qdrant Scroll API."""
    qdrant_filter = self._build_filter(search_filter)
    records, next_offset = await self.client.scroll(
        collection_name=self.collection_name,
        scroll_filter=qdrant_filter,
        limit=limit,
        offset=cursor,
        with_payload=True,
    )
    results = self._records_to_results(records)
    next_cursor = str(next_offset) if next_offset is not None else None
    return results, next_cursor
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `client.recommend()` | `client.query_points(query=RecommendQuery(...))` | qdrant-client 1.7+ | Unified API, supports prefetch+fusion |
| `client.search()` | `client.query_points(query=vector)` | qdrant-client 1.7+ | Already adopted in this codebase |
| Offset-based pagination | Cursor-based via `scroll()` | Available since early versions | Better performance for deep pagination |

**Deprecated/outdated:**
- `client.recommend()`: Legacy method, replaced by `query_points` with `RecommendQuery`. This project already uses `query_points` exclusively.
- `client.search()`: Legacy method, replaced by `query_points`. Already not used in this project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=8.0.0 + pytest-asyncio >=0.23.0 |
| Config file | `backend/pyproject.toml` (asyncio_mode = "auto") |
| Quick run command | `docker compose exec backend python -m pytest tests/ -x -q` |
| Full suite command | `docker compose exec backend python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-01 | recommend() returns similar points via RecommendQuery | unit | `docker compose exec backend python -m pytest tests/test_qdrant_store.py::TestQdrantStoreRecommend -x` | No -- Wave 0 |
| SRCH-01 | _resolve_point_id resolves paragraph+gesetz to UUID | unit | `docker compose exec backend python -m pytest tests/test_qdrant_store.py::TestResolvePointId -x` | No -- Wave 0 |
| SRCH-04 | scroll_search() returns paginated results with cursor | unit | `docker compose exec backend python -m pytest tests/test_qdrant_store.py::TestQdrantStoreScroll -x` | No -- Wave 0 |
| SRCH-08 | Batch search executes queries in parallel | unit | `docker compose exec backend python -m pytest tests/test_api_batch.py -x` | No -- Wave 0 |
| MCP-01 | paragraf_similar MCP tool returns formatted results | unit | `docker compose exec backend python -m pytest tests/test_recommend_tool.py -x` | No -- Wave 0 |
| MCP-05 | abschnitt filter works in paragraf_similar | unit | `docker compose exec backend python -m pytest tests/test_recommend_tool.py::test_abschnitt_filter -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `docker compose exec backend python -m pytest tests/ -x -q`
- **Per wave merge:** `docker compose exec backend python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_qdrant_store.py` -- add TestQdrantStoreRecommend, TestResolvePointId, TestQdrantStoreScroll classes (extend existing file)
- [ ] `tests/test_recommend_tool.py` -- new file for paragraf_similar MCP tool tests
- [ ] `tests/test_api_batch.py` -- new file for batch search endpoint tests (or add to test_integration.py)
- [ ] `tests/test_api_models.py` -- validate RecommendRequest, BatchSearchRequest Pydantic models (or add to test_models.py)

## Open Questions

1. **RecommendStrategy choice**
   - What we know: Qdrant offers `average_vector` (default), `best_score`, and `sum_scores` strategies
   - What's unclear: Which strategy produces the best results for law text recommendations
   - Recommendation: Use `average_vector` (default, simplest, good for single-vector dense search). Can be made configurable later if needed.

2. **Scroll pagination for semantic search**
   - What we know: Scroll returns ID-sorted results without relevance ranking. Semantic search requires embedding + reranking.
   - What's unclear: Whether users expect "page 2 of semantic search" or "browse filtered results"
   - Recommendation: Implement cursor pagination only for browse/filter use cases (no reranking). For semantic search, keep the existing `max_ergebnisse` limit as the sole pagination. Document this clearly.

3. **load_warning implementation**
   - What we know: D-10 requires `load_warning: true` in batch response when system is under high load
   - What's unclear: How to measure "high load" -- CPU usage? Query latency? Concurrent request count?
   - Recommendation: Use a simple heuristic: `load_warning = len(queries) >= settings.batch_max_queries * 0.8` (signal when approaching limit). Can be refined later.

## Project Constraints (from CLAUDE.md)

- All commits on branch `Docker-only`, never on main/master
- German docstrings, English variable/function names
- Async/await for all service methods
- Pydantic v2 for models and settings
- Configuration via environment variables in docker-compose.yml
- `from __future__ import annotations` at top of every Python file
- Ruff linter: line-length 100, strict rules
- Mypy strict mode
- `query_points` exclusively, no legacy endpoints
- RDG-Disclaimer bei jeder Antwort
- MCP tools use German parameter names (gesetzbuch, abschnitt, anfrage)

## Sources

### Primary (HIGH confidence)
- [Qdrant Query Points API Reference](https://api.qdrant.tech/api-reference/search/query-points) -- RecommendQuery schema, parameters, strategies
- [Qdrant Scroll Points API Reference](https://api.qdrant.tech/api-reference/points/scroll-points) -- Scroll pagination, next_page_offset
- [Qdrant Batch Query API Reference](https://api.qdrant.tech/api-reference/search/query-batch-points) -- QueryRequestBatch schema
- [Qdrant Python Client Docs](https://python-client.qdrant.tech/qdrant_client.async_qdrant_client) -- AsyncQdrantClient method signatures
- Existing codebase: `qdrant_store.py`, `api.py`, `api_models.py`, `tools/search.py`, `config.py` -- established patterns

### Secondary (MEDIUM confidence)
- [qdrant-client GitHub tests](https://github.com/qdrant/qdrant-client/blob/master/tests/test_async_qdrant_client.py) -- RecommendQuery usage examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all features available in existing qdrant-client >=1.12.0
- Architecture: HIGH -- all patterns are extensions of existing codebase patterns, verified against Qdrant API docs
- Pitfalls: HIGH -- identified from API documentation, codebase analysis, and known Qdrant behavior

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable APIs, no breaking changes expected)

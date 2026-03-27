# Phase 5: Grouping & Discovery API - Research

**Researched:** 2026-03-27
**Domain:** Qdrant query_points_groups, DiscoverQuery, grouped recommendations, MCP tools
**Confidence:** HIGH

## Summary

Phase 5 adds three Qdrant-powered capabilities to the backend: grouped search results (group by `gesetz` field), explorative Discovery search (positive/negative examples via DiscoverQuery), and grouped recommendations (Recommend + Groups combined). No frontend changes -- this is a pure backend/MCP phase.

All three features build on the existing `query_points` pattern established in Phase 4. The grouped search uses `client.query_points_groups()` which accepts the same query types as `query_points()` but adds `group_by`, `group_size`, and `limit` parameters. Discovery uses `DiscoverQuery` with `ContextPair` objects instead of `RecommendQuery`. Grouped recommendations combine `RecommendQuery` with `query_points_groups`.

**Primary recommendation:** Follow the existing `recommend()` method in `qdrant_store.py` as the template. All three new service methods use the same filter builder, quantization params, and result conversion patterns. The `query_points_groups` response has a different structure (groups with hits) requiring a new `_groups_to_results()` converter.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Group results by `gesetz` field only. No rechtsgebiet grouping.
- **D-02:** Group size configurable per request via `group_size` parameter (default 3, range 1-10). Default set via `GROUP_SIZE_DEFAULT` ENV var.
- **D-03:** Maximum groups configurable per request via `max_groups` parameter (default 10, range 1-20). Default set via `GROUP_MAX_GROUPS` ENV var.
- **D-04:** New dedicated endpoint `POST /api/search/grouped`. Uses `query_points_groups` internally.
- **D-05:** Dual-input for Discovery: accept both point IDs AND paragraph+gesetz pairs with internal ID resolution. Reuse Phase 4's resolution logic.
- **D-06:** Example limits configurable via ENV: `DISCOVERY_MAX_POSITIVE` (default 5), `DISCOVERY_MAX_NEGATIVE` (default 5). Minimum 1 positive required, 0 negative allowed.
- **D-07:** New dedicated endpoint `POST /api/discover`. Own Pydantic request/response models.
- **D-08:** Discovery uses Qdrant `DiscoverQuery` with `ContextPair` for positive/negative vector relationships.
- **D-09:** New dedicated endpoint `POST /api/recommend/grouped`. Same input as `/api/recommend` but grouped results.
- **D-10:** Shared config: same `GROUP_SIZE_DEFAULT` and `GROUP_MAX_GROUPS` ENV vars for both grouped search and grouped recommendations.
- **D-11:** New `paragraf_discover` MCP tool with dual-input. German params: `positiv_beispiele`, `negativ_beispiele`.
- **D-12:** New standalone `paragraf_grouped_search` MCP tool with `anfrage`, `gesetzbuch`, `group_size`, `max_groups`.
- **D-13:** New `paragraf_similar_grouped` MCP tool for grouped recommendations.
- **D-14:** New ENV vars: `GROUP_SIZE_DEFAULT`, `GROUP_MAX_GROUPS`, `DISCOVERY_MAX_POSITIVE`, `DISCOVERY_MAX_NEGATIVE`. Added to Pydantic Settings.

### Claude's Discretion
- Whether Discovery results include a context label explaining why a result appeared
- Error handling for invalid/missing point IDs in Discovery
- Qdrant `DiscoverQuery` parameters (score_threshold, strategy details)
- Internal implementation of grouped response structure (how groups are ordered/sorted)
- Naming of Pydantic models for grouped responses

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-02 | Qdrant Discovery API -- explorative Suche mit Positiv/Negativ-Beispielen | DiscoverQuery + ContextPair API verified. New `discover()` method in QdrantStore, new `/api/discover` endpoint. |
| SRCH-03 | Qdrant Grouping API -- Suchergebnisse nach Gesetz gruppiert zurueckgeben | `query_points_groups` API verified. New `grouped_search()` method, new `/api/search/grouped` endpoint. |
| SRCH-05 | Grouped Recommendations -- Empfehlungen nach Gesetz gruppiert | Combine RecommendQuery with `query_points_groups`. New `grouped_recommend()` method, new `/api/recommend/grouped` endpoint. |
| MCP-02 | MCP-Tool `paragraf_discover` -- explorative Suche mit Positiv/Negativ-Beispielen | New tool in `tools/discover.py` with dual-input pattern from `paragraf_similar`. |
| MCP-07 | MCP-Tool `paragraf_grouped_search` -- gruppierte Suchergebnisse | New tool in `tools/grouped_search.py` calling grouped search endpoint. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Branch:** All commits on branch `Docker-only`, never on main/master
- **Python 3.12+** with `from __future__ import annotations`
- **Async/await** for all service methods
- **Deutsche Docstrings**, englische Variablen-/Funktionsnamen
- **Pydantic v2** for all request/response models
- **RDG-Disclaimer** bei jeder Antwort
- **Qdrant v1.13.2** -- features must be compatible
- **qdrant-client >=1.12.0** -- current dependency
- **Ruff** line-length 100, rules E/F/I/N/W/UP/B/SIM
- **mypy strict mode**
- **ENV-first config** via docker-compose.yml and Pydantic Settings

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| qdrant-client | >=1.12.0 (existing) | `query_points_groups`, `DiscoverQuery` | Already installed; both APIs available in >=1.12.0 with Qdrant v1.13.2 |
| FastAPI | >=0.115.0 (existing) | Three new REST endpoints | Existing framework |
| Pydantic | >=2.0.0 (existing) | New request/response models | Existing pattern |
| pydantic-settings | >=2.0.0 (existing) | Four new ENV settings | Existing pattern |
| FastMCP | >=1.0.0 (existing) | Three new MCP tools | Existing framework |

No new dependencies required. All features use existing libraries.

## Architecture Patterns

### Recommended Project Structure (changes only)

```
backend/src/paragraf/
├── services/
│   └── qdrant_store.py      # +discover(), +grouped_search(), +grouped_recommend(), +_groups_to_results()
├── api.py                    # +/api/discover, +/api/search/grouped, +/api/recommend/grouped
├── api_models.py             # +DiscoverRequest, DiscoverResponse, GroupedSearchRequest, GroupedSearchResponse, GroupedRecommendRequest, GroupedRecommendResponse
├── config.py                 # +group_size_default, group_max_groups, discovery_max_positive, discovery_max_negative
├── tools/
│   ├── discover.py           # NEW: paragraf_discover MCP tool
│   └── grouped_search.py     # NEW: paragraf_grouped_search + paragraf_similar_grouped MCP tools
└── server.py                 # Register new tool modules
```

### Pattern 1: Qdrant query_points_groups

**What:** Group search results by payload field using `client.query_points_groups()`.

**API signature (verified from Qdrant docs):**
```python
result = await self.client.query_points_groups(
    collection_name=self.collection_name,
    query=<any query type>,          # NearestQuery, RecommendQuery, FusionQuery, etc.
    using=DENSE_VECTOR_NAME,
    group_by="gesetz",               # Payload field to group by (keyword type)
    group_size=3,                    # Max results per group
    limit=10,                        # Max number of groups
    query_filter=qdrant_filter,
    with_payload=True,
    search_params=models.SearchParams(
        quantization=models.QuantizationSearchParams(
            rescore=True,
            oversampling=1.5,
        ),
    ),
)
# Returns GroupsResult with .groups: list[PointGroup]
# Each PointGroup has: .id (group key), .hits (list[ScoredPoint])
```

**Key constraint:** The `gesetz` field already has a keyword payload index (created in Phase 2). This satisfies the requirement for `group_by` to work on an indexed field.

**Response structure:** The groups are returned as `GroupsResult.groups`, each with an `.id` (the gesetz value) and `.hits` (scored points within that group). Groups are ordered by best score within each group.

### Pattern 2: Qdrant DiscoverQuery with ContextPair

**What:** Explorative search using positive/negative example pairs to shape the search space.

**API structure (verified from Qdrant REST API docs):**
```python
# Discovery needs a target point + context pairs
result = await self.client.query_points(
    collection_name=self.collection_name,
    query=models.DiscoverQuery(
        discover=models.DiscoverInput(
            target=target_point_id,         # The anchor point
            context=[
                models.ContextPair(
                    positive=positive_id,    # Pull towards this
                    negative=negative_id,    # Push away from this
                ),
                # More context pairs...
            ],
        ),
    ),
    using=DENSE_VECTOR_NAME,
    limit=limit,
    query_filter=qdrant_filter,
    with_payload=True,
    search_params=models.SearchParams(
        quantization=models.QuantizationSearchParams(
            rescore=True,
            oversampling=1.5,
        ),
    ),
)
```

**Critical detail:** DiscoverQuery requires both a `target` and `context` pairs. The `target` is the primary point around which results are explored. Each `ContextPair` requires BOTH a `positive` and `negative` point ID. This differs from RecommendQuery which only uses positives.

**Design decision for dual-input:** When user provides only positive examples (0 negatives), the first positive becomes the `target`, and remaining positives are paired with themselves as both positive+negative in context (effectively a recommend-like behavior). When negatives are present, pair positives with negatives to create meaningful context pairs.

**Recommended approach for context pair construction:**
- If 1 positive, 0 negative: Use `target=positive[0]`, empty context. This degrades to nearest-neighbor around the target.
- If N positive, 0 negative: Use `target=positive[0]`, no context pairs. Effectively a single-point recommend.
- If N positive, M negative: Use `target=positive[0]`, create context pairs by pairing each remaining positive with each negative (cartesian product, capped).

### Pattern 3: Grouped Recommendations (Recommend + Groups)

**What:** Combine `RecommendQuery` with `query_points_groups()` to get recommended results grouped by law.

```python
result = await self.client.query_points_groups(
    collection_name=self.collection_name,
    query=models.RecommendQuery(
        recommend=models.RecommendInput(
            positive=point_ids,
            strategy=models.RecommendStrategy.AVERAGE_VECTOR,
        ),
    ),
    using=DENSE_VECTOR_NAME,
    group_by="gesetz",
    group_size=group_size,
    limit=max_groups,
    query_filter=qdrant_filter,
    with_payload=True,
    search_params=models.SearchParams(
        quantization=models.QuantizationSearchParams(
            rescore=True,
            oversampling=1.5,
        ),
    ),
)
```

This is the simplest of the three features -- it reuses the existing RecommendQuery pattern but routes it through `query_points_groups` instead of `query_points`.

### Pattern 4: New _groups_to_results() converter

**What:** Convert `GroupsResult` to a nested response structure.

```python
@staticmethod
def _groups_to_grouped_results(
    groups_result: Any,
) -> list[tuple[str, list[SearchResult]]]:
    """Konvertiert GroupsResult zu Liste von (gesetz, results) Tupeln."""
    grouped: list[tuple[str, list[SearchResult]]] = []
    for group in groups_result.groups:
        gesetz = str(group.id)
        results = []
        for rank, point in enumerate(group.hits, start=1):
            payload = point.payload or {}
            metadata = ChunkMetadata(
                gesetz=payload.get("gesetz", ""),
                paragraph=payload.get("paragraph", ""),
                # ... same pattern as _points_to_results
            )
            chunk = LawChunk(
                id=payload.get("chunk_id", ""),
                text=payload.get("text", ""),
                metadata=metadata,
            )
            results.append(SearchResult(chunk=chunk, score=point.score or 0.0, rank=rank))
        grouped.append((gesetz, results))
    return grouped
```

### Pattern 5: Pydantic Models for Grouped Responses

**Recommended model naming:**

```python
# Request models
class GroupedSearchRequest(BaseModel):
    anfrage: str
    gesetzbuch: str | None = None
    abschnitt: str | None = None
    group_size: int = Field(3, ge=1, le=10)
    max_groups: int = Field(10, ge=1, le=20)
    search_type: Literal["semantic", "fulltext", "hybrid_fulltext"] = "semantic"

class DiscoverRequest(BaseModel):
    positive_ids: list[str] | None = None
    positive_paragraphs: list[LookupRequest] | None = None  # Reuse existing model
    negative_ids: list[str] | None = None
    negative_paragraphs: list[LookupRequest] | None = None
    limit: int = Field(10, ge=1, le=50)
    gesetzbuch: str | None = None
    abschnitt: str | None = None

class GroupedRecommendRequest(BaseModel):
    # Same fields as RecommendRequest + group params
    point_ids: list[str] | None = None
    paragraph: str | None = None
    gesetz: str | None = None
    group_size: int = Field(3, ge=1, le=10)
    max_groups: int = Field(10, ge=1, le=20)
    exclude_same_law: bool = True
    gesetzbuch: str | None = None

# Response models
class GroupedResultGroup(BaseModel):
    gesetz: str
    results: list[SearchResultItem]
    total: int

class GroupedSearchResponse(BaseModel):
    query: str
    groups: list[GroupedResultGroup]
    total_groups: int
    disclaimer: str = "..."  # RDG

class DiscoverResponse(BaseModel):
    positive_ids: list[str]
    negative_ids: list[str]
    results: list[SearchResultItem]
    total: int
    disclaimer: str = "..."

class GroupedRecommendResponse(BaseModel):
    source_ids: list[str]
    groups: list[GroupedResultGroup]
    total_groups: int
    disclaimer: str = "..."
```

### Anti-Patterns to Avoid

- **Adding mode flags to existing endpoints**: Do not add a `grouped=true` parameter to `/api/search`. Per D-04, grouped responses have a fundamentally different structure. Separate endpoints.
- **Building context pairs from only positives**: DiscoverQuery's `ContextPair` requires both positive and negative. When no negatives exist, do not fabricate fake negative examples. Instead, use target-only discovery (empty context).
- **Sharing _points_to_results for groups**: The `query_points_groups` response has `.groups[].hits` not `.points`. A separate converter is needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grouping results by law | Post-process flat results into groups | `query_points_groups` | Qdrant does server-side grouping with proper score ordering; post-processing loses ranking fidelity |
| Discovery search | RecommendQuery with manual negative filtering | `DiscoverQuery` with `ContextPair` | Qdrant's discovery algorithm shapes the search space geometrically; filtering after the fact produces inferior results |
| Point ID resolution | Custom scroll+filter in each method | Reuse `QdrantStore._resolve_point_id()` | Already implemented and tested in Phase 4 |

## Common Pitfalls

### Pitfall 1: group_size is best-effort

**What goes wrong:** Tests expect exactly `group_size` results per group, but Qdrant may return fewer.
**Why it happens:** If a law has fewer indexed paragraphs than `group_size`, the group will have fewer hits.
**How to avoid:** Document that `group_size` is a maximum, not guaranteed. Response model uses `total` per group to reflect actual count.
**Warning signs:** Tests failing with assertion on exact group sizes.

### Pitfall 2: DiscoverQuery requires target + context structure

**What goes wrong:** Passing point IDs directly as in RecommendQuery.
**Why it happens:** Discovery has a fundamentally different API shape than Recommend.
**How to avoid:** Always wrap in `DiscoverInput(target=..., context=[ContextPair(...)])`. The target is mandatory. Context can be empty list.
**Warning signs:** Qdrant returning validation errors about missing target field.

### Pitfall 3: ContextPair requires BOTH positive and negative

**What goes wrong:** Trying to create a ContextPair with only a positive example.
**Why it happens:** Assuming ContextPair works like RecommendInput positives.
**How to avoid:** Each ContextPair must have both a positive and a negative point. When user provides no negatives, use empty context list instead of fabricating pairs.
**Warning signs:** Pydantic/Qdrant validation errors on ContextPair construction.

### Pitfall 4: Grouped search with FusionQuery (hybrid mode)

**What goes wrong:** Using `query_points_groups` with `prefetch` + `FusionQuery` for hybrid grouped search.
**Why it happens:** Hybrid search currently uses prefetch+fusion in `hybrid_search()`.
**How to avoid:** For grouped search, use dense-only via `query_points_groups` with a dense vector query. Hybrid fusion with grouping may not be supported or may produce unexpected results. Start with dense-only grouped search and add hybrid if confirmed working.
**Warning signs:** Qdrant errors about unsupported query combinations in `query_points_groups`.

### Pitfall 5: Multiple point ID resolution for Discovery

**What goes wrong:** Discovery accepts multiple positive AND negative paragraph+gesetz pairs. Sequential resolution is slow.
**Why it happens:** `_resolve_point_id()` does one scroll per pair.
**How to avoid:** Use `asyncio.gather()` to resolve all point IDs in parallel. Handle partial failures (some IDs not found) gracefully.
**Warning signs:** Discovery endpoint taking multiple seconds when resolving 5+ paragraph+gesetz pairs.

### Pitfall 6: MCP tool registration in server.py

**What goes wrong:** Forgetting to import and call `register_discover_tools()` and `register_grouped_search_tools()` in `server.py`.
**Why it happens:** New tool modules need explicit registration.
**How to avoid:** Add imports and registration calls in the `create_server()` function, matching the existing pattern.

## Code Examples

### Grouped Search Service Method

```python
# Source: Qdrant API docs + existing recommend() pattern
async def grouped_search(
    self,
    query: str,
    group_size: int = 3,
    max_groups: int = 10,
    search_filter: SearchFilter | None = None,
) -> list[tuple[str, list[SearchResult]]]:
    """Grouped search: Ergebnisse nach Gesetz gruppiert."""
    if self.embedding is None:
        raise RuntimeError("Kein EmbeddingService konfiguriert")

    dense_vec, _ = self.embedding.encode_query(query)
    qdrant_filter = self._build_filter(search_filter)

    result = await self.client.query_points_groups(
        collection_name=self.collection_name,
        query=dense_vec,
        using=DENSE_VECTOR_NAME,
        group_by="gesetz",
        group_size=group_size,
        limit=max_groups,
        query_filter=qdrant_filter,
        with_payload=True,
        search_params=models.SearchParams(
            quantization=models.QuantizationSearchParams(
                rescore=True,
                oversampling=1.5,
            ),
        ),
    )
    return self._groups_to_grouped_results(result)
```

### Discovery Service Method

```python
# Source: Qdrant API docs + existing recommend() pattern
async def discover(
    self,
    target_id: str,
    context_pairs: list[tuple[str, str]],  # (positive_id, negative_id)
    limit: int = 10,
    search_filter: SearchFilter | None = None,
) -> list[SearchResult]:
    """Discovery API: Explorative Suche mit Positiv/Negativ-Kontext."""
    qdrant_filter = self._build_filter(search_filter)

    context = [
        models.ContextPair(positive=pos, negative=neg)
        for pos, neg in context_pairs
    ]

    results = await self.client.query_points(
        collection_name=self.collection_name,
        query=models.DiscoverQuery(
            discover=models.DiscoverInput(
                target=target_id,
                context=context if context else None,
            ),
        ),
        using=DENSE_VECTOR_NAME,
        limit=limit,
        query_filter=qdrant_filter,
        with_payload=True,
        search_params=models.SearchParams(
            quantization=models.QuantizationSearchParams(
                rescore=True,
                oversampling=1.5,
            ),
        ),
    )
    return self._points_to_results(results)
```

### MCP Tool Pattern (paragraf_discover)

```python
# Source: existing paragraf_similar tool pattern
@mcp.tool()
async def paragraf_discover(
    ctx: Context,
    positiv_beispiele: list[str],
    negativ_beispiele: list[str] | None = None,
    gesetzbuch: str | None = None,
    abschnitt: str | None = None,
    max_ergebnisse: int = 10,
) -> str:
    """Explorative Suche mit Positiv/Negativ-Beispielen.

    Args:
        positiv_beispiele: Punkt-IDs oder 'paragraph gesetz' Strings.
        negativ_beispiele: Punkt-IDs oder 'paragraph gesetz' Strings (optional).
        gesetzbuch: Filter nach Gesetzbuch.
        abschnitt: Filter nach Abschnitt.
        max_ergebnisse: Anzahl Ergebnisse (1-20).
    """
    # ... resolve IDs, build context pairs, call discover()
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=8.0.0 + pytest-asyncio >=0.23.0 |
| Config file | `backend/pyproject.toml` (`asyncio_mode = "auto"`) |
| Quick run command | `cd backend && python -m pytest tests/test_qdrant_store.py tests/test_api_models.py -x -q` |
| Full suite command | `docker compose exec backend python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-02 | Discovery API returns results from positive/negative examples | unit | `cd backend && python -m pytest tests/test_qdrant_store.py -k "discover" -x` | Wave 0 |
| SRCH-03 | Grouped search returns results grouped by gesetz | unit | `cd backend && python -m pytest tests/test_qdrant_store.py -k "grouped_search" -x` | Wave 0 |
| SRCH-05 | Grouped recommendations return results grouped by gesetz | unit | `cd backend && python -m pytest tests/test_qdrant_store.py -k "grouped_recommend" -x` | Wave 0 |
| MCP-02 | paragraf_discover tool resolves IDs and calls discover | unit | `cd backend && python -m pytest tests/test_discover_tool.py -x` | Wave 0 |
| MCP-07 | paragraf_grouped_search tool calls grouped search | unit | `cd backend && python -m pytest tests/test_grouped_search_tool.py -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_discover_tool.py` -- covers MCP-02 (paragraf_discover tool)
- [ ] `tests/test_grouped_search_tool.py` -- covers MCP-07 (paragraf_grouped_search + paragraf_similar_grouped)
- [ ] New test cases in `tests/test_qdrant_store.py` for `discover()`, `grouped_search()`, `grouped_recommend()`
- [ ] New test cases in `tests/test_api_models.py` for DiscoverRequest, GroupedSearchRequest, GroupedRecommendRequest validation

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `search_groups` (legacy) | `query_points_groups` (unified) | Qdrant v1.10+ | Use query_points_groups exclusively per project convention |
| Separate `discover` endpoint | `query_points` with `DiscoverQuery` | Qdrant v1.10+ | Discovery is just another query type in the unified API |
| Manual result grouping (post-process) | Server-side `query_points_groups` | Qdrant v1.10+ | Better ranking fidelity; Qdrant handles score-ordered grouping |

## Open Questions

1. **DiscoverQuery with empty context**
   - What we know: `DiscoverInput` requires a `target`. `context` can be an empty list or None.
   - What's unclear: Whether empty context degrades gracefully to nearest-neighbor or throws an error.
   - Recommendation: Test with empty context during implementation. If it errors, fall back to NearestQuery for the target point when no negatives provided.

2. **Hybrid grouped search (FusionQuery + query_points_groups)**
   - What we know: `query_points_groups` accepts `prefetch` and `FusionQuery`.
   - What's unclear: Whether RRF fusion works correctly with grouping. Dense-only is safer.
   - Recommendation: Start with dense-only grouped search. Add hybrid grouped if testing confirms it works. Fulltext grouped search is likely not needed for the initial implementation.

3. **Context pair construction strategy**
   - What we know: Each ContextPair needs both positive and negative.
   - What's unclear: Optimal pairing when user provides N positives and M negatives (N != M).
   - Recommendation: Use cartesian product capped at a reasonable limit. First positive is always the target. Remaining positives paired with all negatives. If no negatives, empty context.

## Sources

### Primary (HIGH confidence)
- [Qdrant REST API - query_points_groups](https://api.qdrant.tech/api-reference/search/query-points-groups) -- Full parameter spec, response structure, query type support
- [Qdrant REST API - query_points](https://api.qdrant.tech/api-reference/search/query-points) -- DiscoverQuery, DiscoverInput, ContextPair structure
- [Qdrant Python Client docs](https://python-client.qdrant.tech/qdrant_client.qdrant_client) -- `query_points_groups` Python method signature

### Secondary (MEDIUM confidence)
- Existing codebase: `qdrant_store.py` `recommend()` method (line 461) -- verified template for new methods
- Existing codebase: `tools/recommend.py` -- verified template for new MCP tools
- `.planning/research/STACK.md` -- Prior research on Qdrant v1.13.2 capabilities

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all APIs verified in Qdrant docs
- Architecture: HIGH -- extends established patterns from Phase 4 (recommend, query_points)
- Pitfalls: HIGH -- identified from API docs and codebase analysis (group_size best-effort, ContextPair requirements, target field mandatory)

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable APIs, no fast-moving dependencies)

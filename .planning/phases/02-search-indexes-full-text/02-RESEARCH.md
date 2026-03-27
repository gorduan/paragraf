# Phase 2: Search Indexes & Full-Text - Research

**Researched:** 2026-03-27
**Domain:** Qdrant full-text indexing, payload range indexes, keyword search API design
**Confidence:** HIGH

## Summary

This phase adds full-text and integer range payload indexes to the existing Qdrant collection, then exposes a full-text keyword search mode alongside the existing semantic hybrid search. The core Qdrant features needed (TextIndexParams, IntegerIndexParams, MatchText filter, Range filter) are all available in Qdrant v1.13.2 and qdrant-client >= 1.12.0.

**Critical finding:** The `multilingual` tokenizer specified in CONTEXT.md decision D-06 was introduced in Qdrant v1.15, NOT available in v1.13.2. The `word` tokenizer must be used instead -- it splits on spaces, punctuation, and special characters, which works correctly for German legal text (German uses space-separated words unlike CJK languages that motivated the multilingual tokenizer).

**Second critical finding:** Qdrant's MatchText is a **filter operation**, not a scoring/ranking mechanism. It returns matching points but does not rank them by text relevance. For the "fulltext" search mode, the implementation must use MatchText as a filter combined with the existing sparse vector scoring (bge-m3 lexical weights) to provide ranked results, or use scroll with MatchText for simpler filter-based retrieval. The existing sparse vectors from bge-m3 already encode keyword-level information and provide BM25-like scoring through Qdrant's sparse vector search.

**Primary recommendation:** Implement fulltext search by using MatchText as a pre-filter on the `text` field, then rank results using the existing sparse vector scores. This leverages the full-text index for efficient text matching while providing meaningful ranking through the already-indexed sparse vectors.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single endpoint `/api/search` extended with `search_type` parameter: `'semantic'` (default, current behavior), `'fulltext'` (keyword-only), `'hybrid_fulltext'` (combines both). No separate endpoint.
- **D-02:** Full-text search skips cross-encoder reranking. Reranking only applies to semantic and hybrid modes. Full-text results use Qdrant's built-in text scoring.
- **D-03:** `SearchResponse` includes a `search_type` field echoing which mode produced the results.
- **D-04:** `SearchFilter` extended with `absatz_von` (int | None) and `absatz_bis` (int | None) for min/max range queries.
- **D-05:** When absatz range filter is active, only absatz-level chunks (chunk_typ='absatz') are returned. Paragraph-level chunks (absatz=null) are excluded.
- **D-06:** Full-text index on `text` payload field uses Qdrant's `multilingual` tokenizer. **NOTE: Not available in Qdrant v1.13.2 -- must use `word` tokenizer instead (see Pitfall 1).**
- **D-07:** Full-text search is case-insensitive (lowercase indexing).
- **D-08:** Minimum token length `min_token_len=2`.
- **D-09:** Full-text results ranked by Qdrant's built-in text scoring. **NOTE: MatchText is filter-only -- ranking must come from sparse vector scores (see Architecture Patterns).**
- **D-10:** New indexes are NOT auto-created in `ensure_collection()`. A separate migration endpoint triggers index creation explicitly.
- **D-11:** Qdrant builds indexes from existing payload data -- no re-indexing of laws required.
- **D-12:** Extend existing `paragraf_search` MCP tool with `suchmodus` parameter: `'semantisch'` (default), `'volltext'`, `'hybrid'`.
- **D-13:** Add `absatz_von` and `absatz_bis` parameters to `paragraf_search` MCP tool.
- **D-14:** Tool description includes guidance for Claude on when to use which search mode.

### Claude's Discretion
- Migration endpoint naming and REST design (e.g., `POST /api/indexes/create` or similar)
- Error handling for index creation failures
- Whether to add an index status check endpoint
- Qdrant TextIndex `max_token_len` configuration

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-03 | Full-Text Index on `text` payload field for exact keyword matching | TextIndexParams with `word` tokenizer, lowercase=True, min_token_len=2. Created via `create_payload_index()`. |
| INFRA-04 | Payload Range Filter for numeric `absatz` field | IntegerIndexParams with range=True, lookup=True. Range filter via `models.Range(gte=..., lte=...)`. |
| SRCH-06 | Full-Text Search as toggle alongside semantic search | Extend `/api/search` with `search_type` param. MatchText filter + sparse vector scoring for fulltext mode. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| qdrant-client | >= 1.12.0 (already installed) | Async Qdrant operations | Project standard, provides all needed models |
| qdrant/qdrant | v1.13.2 (Docker) | Vector database server | Project constraint -- do not upgrade |

### Key Models Used (from `qdrant_client.models`)
| Model | Purpose |
|-------|---------|
| `TextIndexParams` | Configure full-text index with tokenizer settings |
| `TextIndexType.TEXT` | Index type enum value for text indexes |
| `TokenizerType.WORD` | Tokenizer type (word-boundary splitting) |
| `IntegerIndexParams` | Configure integer index with range/lookup |
| `IntegerIndexType.INTEGER` | Index type enum value for integer indexes |
| `MatchText` | Filter condition for full-text matching |
| `Range` | Filter condition for numeric range queries |
| `FieldCondition` | Wrapper for filter conditions (already used) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `word` tokenizer | `multilingual` tokenizer | Multilingual only available in Qdrant >= 1.15; `word` works for German |
| `prefix` tokenizer | `word` tokenizer | Prefix creates additional prefix indexes per word -- overkill for legal text search |
| MatchText + sparse scoring | Pure scroll with MatchText | Scroll doesn't score results, only filters -- ranked results are more useful |

## Architecture Patterns

### Recommended Project Structure
No new files needed. Extensions to existing files:

```
backend/src/paragraf/
├── services/
│   └── qdrant_store.py     # Add: fulltext_search(), create_text_index(), create_integer_index()
├── api.py                   # Modify: search endpoint branches on search_type
├── api_models.py            # Add: search_type to SearchRequest/SearchResponse
├── models/law.py            # Add: absatz_von, absatz_bis to SearchFilter
├── config.py                # Optional: default search_type setting
└── tools/search.py          # Add: suchmodus, absatz_von, absatz_bis params
```

### Pattern 1: Full-Text Index Creation (Migration Endpoint)

**What:** Create payload indexes on demand via a REST endpoint, NOT during `ensure_collection()`.
**When to use:** After collection already has data. Qdrant indexes existing payload data automatically.

```python
# In qdrant_store.py
async def create_text_index(self) -> None:
    """Erstellt Full-Text Index auf dem text-Feld."""
    await self.client.create_payload_index(
        collection_name=self.collection_name,
        field_name="text",
        field_schema=models.TextIndexParams(
            type=models.TextIndexType.TEXT,
            tokenizer=models.TokenizerType.WORD,
            min_token_len=2,
            max_token_len=40,
            lowercase=True,
        ),
        wait=True,
    )

async def create_absatz_index(self) -> None:
    """Erstellt Integer-Index auf dem absatz-Feld fuer Range-Queries."""
    await self.client.create_payload_index(
        collection_name=self.collection_name,
        field_name="absatz",
        field_schema=models.IntegerIndexParams(
            type=models.IntegerIndexType.INTEGER,
            lookup=True,
            range=True,
        ),
        wait=True,
    )
```

### Pattern 2: Full-Text Search with Sparse Vector Scoring

**What:** Use MatchText as a pre-filter, then rank by sparse vector scores.
**When to use:** `search_type='fulltext'` -- pure keyword search without semantic vectors.

```python
# In qdrant_store.py
async def fulltext_search(
    self,
    query: str,
    top_k: int = 20,
    search_filter: SearchFilter | None = None,
) -> list[SearchResult]:
    """Full-Text-Suche: MatchText-Filter + Sparse-Vektor-Scoring."""
    # Build filter with MatchText on text field
    text_condition = models.FieldCondition(
        key="text",
        match=models.MatchText(text=query),
    )

    # Combine with existing filters
    base_filter = self._build_filter(search_filter)
    must_conditions = [text_condition]
    if base_filter and base_filter.must:
        must_conditions.extend(base_filter.must)

    combined_filter = models.Filter(must=must_conditions)

    # Use sparse vector query for scoring within MatchText-filtered results
    if self.embedding is None:
        raise RuntimeError("Kein EmbeddingService konfiguriert")

    _, sparse_weights = self.embedding.encode_query(query)
    sparse_indices, sparse_values = EmbeddingService.sparse_to_qdrant(sparse_weights)

    if sparse_indices:
        results = await self.client.query_points(
            collection_name=self.collection_name,
            query=models.SparseVector(
                indices=sparse_indices,
                values=sparse_values,
            ),
            using=SPARSE_VECTOR_NAME,
            limit=top_k,
            query_filter=combined_filter,
            with_payload=True,
        )
    else:
        # Fallback: scroll with filter if no sparse vectors
        records, _ = await self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=combined_filter,
            limit=top_k,
            with_payload=True,
        )
        # Convert scroll results (no scoring)
        return self._records_to_results(records)

    return self._points_to_results(results)
```

### Pattern 3: Absatz Range Filter Extension

**What:** Extend `_build_filter()` to handle absatz_von/absatz_bis range conditions.
**When to use:** When SearchFilter has absatz range values.

```python
# Extension to _build_filter() in qdrant_store.py
if search_filter.absatz_von is not None or search_filter.absatz_bis is not None:
    range_params = {}
    if search_filter.absatz_von is not None:
        range_params["gte"] = search_filter.absatz_von
    if search_filter.absatz_bis is not None:
        range_params["lte"] = search_filter.absatz_bis
    conditions.append(
        models.FieldCondition(
            key="absatz",
            range=models.Range(**range_params),
        )
    )
    # D-05: Only absatz-level chunks when range filter active
    conditions.append(
        models.FieldCondition(
            key="chunk_typ",
            match=models.MatchValue(value="absatz"),
        )
    )
```

### Pattern 4: Search Endpoint Branching

**What:** Single `/api/search` endpoint that branches behavior based on `search_type`.
**When to use:** Always -- this is the unified search entry point.

```python
# In api.py search endpoint
if body.search_type == "semantic":
    # Existing behavior: hybrid_search -> rerank -> dedup
    raw_results = await ctx.qdrant.hybrid_search(...)
    reranked = await ctx.reranker.arerank(...)
elif body.search_type == "fulltext":
    # D-02: Skip reranking. MatchText filter + sparse scoring
    raw_results = await ctx.qdrant.fulltext_search(...)
    # No reranking, use results as-is
elif body.search_type == "hybrid_fulltext":
    # Combine: run both, merge with RRF or simple interleave
    semantic_results = await ctx.qdrant.hybrid_search(...)
    fulltext_results = await ctx.qdrant.fulltext_search(...)
    # Merge and dedup
```

### Pattern 5: Migration Endpoint Design

**What:** REST endpoint to trigger index creation.
**Recommendation for Claude's discretion:** `POST /api/indexes/ensure`

```python
# In api.py
@app.post("/api/indexes/ensure")
async def ensure_indexes(request: Request) -> dict:
    """Erstellt fehlende Payload-Indexes (Full-Text, Integer Range)."""
    ctx = _get_ctx(request)
    created = []
    try:
        await ctx.qdrant.create_text_index()
        created.append("text_fulltext")
    except Exception as e:
        logger.warning("Text-Index Erstellung fehlgeschlagen: %s", e)
    try:
        await ctx.qdrant.create_absatz_index()
        created.append("absatz_integer")
    except Exception as e:
        logger.warning("Absatz-Index Erstellung fehlgeschlagen: %s", e)
    return {"created": created, "erfolg": True}
```

### Anti-Patterns to Avoid
- **Using `multilingual` tokenizer with Qdrant v1.13.2:** Will fail -- this tokenizer was added in v1.15.
- **Creating indexes in `ensure_collection()`:** Decision D-10 explicitly forbids this. Indexes are created via migration endpoint.
- **Expecting MatchText to return scored/ranked results:** MatchText is a filter, not a scorer. Always combine with vector-based scoring.
- **Forgetting chunk_typ filter on absatz range queries:** Decision D-05 requires excluding paragraph-level chunks when absatz range is active.
- **Using `text_any` instead of `text` for MatchText:** `text` requires ALL words present (more precise for legal search); `text_any` matches ANY word.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text tokenization | Custom text splitting/indexing | Qdrant TextIndexParams | Qdrant handles inverted index, tokenization, case normalization |
| Range filtering | Manual absatz value comparison | Qdrant IntegerIndexParams + Range | Server-side filtering is orders of magnitude faster |
| Text matching | Python-side text search | Qdrant MatchText filter | Server-side filtering uses inverted index, scales to millions |
| Score fusion | Custom score merging | Qdrant RRF fusion via query_points | RRF is mathematically sound for combining incompatible scores |

**Key insight:** Qdrant already provides all the indexing and filtering primitives needed. The implementation work is about wiring these Qdrant features into the existing API surface, not building search infrastructure.

## Common Pitfalls

### Pitfall 1: Multilingual Tokenizer Not Available in v1.13.2
**What goes wrong:** CONTEXT.md decision D-06 specifies `multilingual` tokenizer, but it requires Qdrant >= 1.15.
**Why it happens:** The multilingual tokenizer was added in Qdrant 1.15 for CJK language support.
**How to avoid:** Use `word` tokenizer instead. For German legal text (space-separated words), `word` tokenizer works correctly. It splits on spaces, punctuation, and special characters.
**Warning signs:** `create_payload_index` call fails with unknown tokenizer type error.

### Pitfall 2: MatchText is Filter-Only, Not a Scorer
**What goes wrong:** CONTEXT.md D-09 says "Full-text results ranked by Qdrant's built-in text scoring." Qdrant MatchText does not produce relevance scores.
**Why it happens:** Qdrant is a vector database first; full-text is a filtering feature, not a ranking system.
**How to avoid:** Combine MatchText filter with sparse vector scoring from bge-m3. The sparse vectors already encode keyword-level term weights, providing BM25-like ranking for filtered results.
**Warning signs:** All fulltext results have score=0 or identical scores.

### Pitfall 3: IntegerIndexParams Default Behavior
**What goes wrong:** Using `models.PayloadSchemaType.INTEGER` (simple string) does not enable range queries by default in some client versions.
**Why it happens:** Known qdrant-client issue (#6731) -- explicit `IntegerIndexParams(range=True, lookup=True)` is safer.
**How to avoid:** Always use the explicit `IntegerIndexParams` object with `range=True` and `lookup=True`.
**Warning signs:** Range filter returns no results even when data exists.

### Pitfall 4: MatchText Requires All Words Present
**What goes wrong:** Searching for "Pflegeleistungen Anspruch" only returns documents containing BOTH words.
**Why it happens:** MatchText `text` mode requires all query tokens to be present. This is by design.
**How to avoid:** This is actually desirable for legal text precision. If looser matching is needed, use `MatchText` with `text_any` variant (matches ANY word). But for this project, the strict ALL-words behavior is better for legal precision.
**Warning signs:** Too few results for multi-word queries.

### Pitfall 5: Index Creation on Existing Collection is Async
**What goes wrong:** Index creation returns immediately but indexing happens in background. Queries right after may not use the new index.
**Why it happens:** Qdrant builds indexes asynchronously for large collections.
**How to avoid:** Use `wait=True` in `create_payload_index()` call. The method will block until indexing completes.
**Warning signs:** MatchText filter returns fewer results than expected immediately after index creation.

### Pitfall 6: Absatz Field is Null for Paragraph-Level Chunks
**What goes wrong:** Range filter on `absatz` field excludes paragraph-level chunks (where absatz=null).
**Why it happens:** Only absatz-level chunks (created when paragraph > 800 chars) have numeric absatz values. Paragraph-level chunks have absatz=None.
**How to avoid:** Decision D-05 already addresses this: when absatz range filter is active, also filter to chunk_typ='absatz'. This is by design.
**Warning signs:** Missing results when absatz range filter is used without chunk_typ constraint.

## Code Examples

### Creating Full-Text Index
```python
# Source: Qdrant official docs - https://qdrant.tech/documentation/manage-data/indexing/
await client.create_payload_index(
    collection_name="paragraf",
    field_name="text",
    field_schema=models.TextIndexParams(
        type=models.TextIndexType.TEXT,
        tokenizer=models.TokenizerType.WORD,
        min_token_len=2,
        max_token_len=40,
        lowercase=True,
    ),
    wait=True,
)
```

### Creating Integer Range Index
```python
# Source: Qdrant official docs + GitHub issue #6731
await client.create_payload_index(
    collection_name="paragraf",
    field_name="absatz",
    field_schema=models.IntegerIndexParams(
        type=models.IntegerIndexType.INTEGER,
        lookup=True,
        range=True,
    ),
    wait=True,
)
```

### Using MatchText Filter
```python
# Source: Qdrant filtering docs - https://qdrant.tech/documentation/search/filtering/
filter_condition = models.FieldCondition(
    key="text",
    match=models.MatchText(text="Pflegeleistungen"),
)
# Use in Filter(must=[...])
```

### Using Range Filter
```python
# Source: Qdrant filtering docs
range_condition = models.FieldCondition(
    key="absatz",
    range=models.Range(gte=1, lte=5),
)
```

### Extending SearchRequest Model
```python
# In api_models.py
from typing import Literal

class SearchRequest(BaseModel):
    anfrage: str = Field(description="Suchanfrage in natuerlicher Sprache")
    gesetzbuch: str | None = Field(None, description="Filter nach Gesetzbuch")
    abschnitt: str | None = Field(None, description="Filter nach Abschnitt")
    max_ergebnisse: int = Field(5, ge=1, le=20, description="Anzahl Ergebnisse")
    search_type: Literal["semantic", "fulltext", "hybrid_fulltext"] = Field(
        "semantic",
        description="Suchmodus: semantic (Standard), fulltext (Keyword), hybrid_fulltext (beides)",
    )
```

### Extending SearchFilter Model
```python
# In models/law.py
class SearchFilter(BaseModel):
    gesetz: str | None = Field(None, description="Nach Gesetzbuch filtern")
    paragraph: str | None = Field(None, description="Nach Paragraph filtern")
    abschnitt: str | None = Field(None, description="Nach Abschnitt filtern")
    chunk_typ: str | None = Field(None, description="paragraph | absatz | abschnitt")
    absatz_von: int | None = Field(None, description="Absatz-Range Minimum (1-basiert)")
    absatz_bis: int | None = Field(None, description="Absatz-Range Maximum (1-basiert)")
```

### Extending MCP Tool
```python
# In tools/search.py
@mcp.tool()
async def paragraf_search(
    ctx: Context,
    anfrage: str,
    gesetzbuch: str | None = None,
    abschnitt: str | None = None,
    max_ergebnisse: int = settings.final_top_k,
    suchmodus: str = "semantisch",
    absatz_von: int | None = None,
    absatz_bis: int | None = None,
) -> str:
    """Durchsucht deutsche Gesetze nach relevanten Paragraphen.

    Args:
        suchmodus: Suchmodus - 'semantisch' (Standard, bedeutungsbasiert),
                   'volltext' (exakte Begriffe/Paragraphennummern),
                   'hybrid' (beides kombiniert, wenn unsicher)
        absatz_von: Optional: Minimum Absatz-Nummer (1-basiert)
        absatz_bis: Optional: Maximum Absatz-Nummer (1-basiert)
    """
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `search()` legacy endpoint | `query_points()` universal API | Qdrant 1.10 | Already used in codebase |
| No full-text in Qdrant | TextIndexParams + MatchText | Qdrant 0.10+ | Available in v1.13.2 |
| `word` tokenizer only | `multilingual` tokenizer added | Qdrant 1.15 | NOT available in v1.13.2 |
| Client-side BM25 | Server-side BM25 sparse vectors | Qdrant 1.15.2 | NOT available in v1.13.2 |
| Simple integer field | IntegerIndexParams with range | Qdrant 1.x | Available in v1.13.2 |

**Deprecated/outdated:**
- Using `multilingual` tokenizer with Qdrant < 1.15 (not available)
- Built-in BM25 conversion with Qdrant < 1.15.2 (not available)
- Legacy `search()` endpoint (project already uses `query_points()`)

## Open Questions

1. **max_token_len for German legal text**
   - What we know: German compound words (e.g., "Pflegeversicherungsleistungen") can be very long. Default max_token_len might truncate them.
   - What's unclear: Exact max length of compound words in the corpus.
   - Recommendation: Set `max_token_len=40` to accommodate long German compound words. The `word` tokenizer splits on non-alphanumeric characters, so hyphenated compounds are already split.

2. **Hybrid fulltext mode fusion strategy**
   - What we know: RRF fusion works well for combining dense+sparse. Adding MatchText as a third signal needs careful design.
   - What's unclear: Whether to use RRF fusion server-side or merge results client-side.
   - Recommendation: For `hybrid_fulltext` mode, run semantic hybrid search (dense+sparse+RRF) with MatchText as an additional filter. This is simpler than three-way fusion and ensures all results contain the query keywords.

3. **Index creation idempotency**
   - What we know: Qdrant may error if index already exists on a field.
   - What's unclear: Exact error behavior when re-creating an existing index.
   - Recommendation: Wrap index creation in try/except, check collection info for existing indexes first, or handle the "already exists" error gracefully.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.0+ with pytest-asyncio (asyncio_mode = "auto") |
| Config file | `backend/pyproject.toml` |
| Quick run command | `docker compose exec backend python -m pytest tests/test_qdrant_store.py -x -v` |
| Full suite command | `docker compose exec backend python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-03 | Full-text index creation via create_payload_index | unit | `docker compose exec backend python -m pytest tests/test_qdrant_store.py::TestQdrantStoreIndexes -x` | Wave 0 |
| INFRA-03 | MatchText filter builds correct FieldCondition | unit | `docker compose exec backend python -m pytest tests/test_qdrant_store.py::TestQdrantStoreFulltext -x` | Wave 0 |
| INFRA-04 | Integer range index creation | unit | `docker compose exec backend python -m pytest tests/test_qdrant_store.py::TestQdrantStoreIndexes -x` | Wave 0 |
| INFRA-04 | _build_filter with absatz_von/absatz_bis produces Range condition | unit | `docker compose exec backend python -m pytest tests/test_qdrant_store.py::TestBuildFilterRange -x` | Wave 0 |
| SRCH-06 | SearchRequest accepts search_type parameter | unit | `docker compose exec backend python -m pytest tests/test_models.py -x` | Wave 0 |
| SRCH-06 | fulltext_search method calls query_points with MatchText | unit | `docker compose exec backend python -m pytest tests/test_qdrant_store.py::TestQdrantStoreFulltext -x` | Wave 0 |
| SRCH-06 | Search endpoint branches on search_type | unit | `docker compose exec backend python -m pytest tests/test_integration.py -x` | Wave 0 |
| SRCH-06 | MCP tool accepts suchmodus parameter | unit | `docker compose exec backend python -m pytest tests/test_search_tool.py -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `docker compose exec backend python -m pytest tests/test_qdrant_store.py tests/test_models.py -x -v`
- **Per wave merge:** `docker compose exec backend python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_qdrant_store.py::TestQdrantStoreIndexes` -- covers INFRA-03, INFRA-04 (index creation)
- [ ] `tests/test_qdrant_store.py::TestBuildFilterRange` -- covers INFRA-04 (range filter building)
- [ ] `tests/test_qdrant_store.py::TestQdrantStoreFulltext` -- covers SRCH-06 (fulltext search method)
- [ ] `tests/test_models.py` -- extend with SearchFilter absatz_von/absatz_bis, SearchRequest search_type

## Project Constraints (from CLAUDE.md)

- **Branch policy:** All commits on branch `Docker-only`, never on main/master
- **Qdrant version:** v1.13.2 -- features must be compatible with this version
- **Models:** BAAI/bge-m3 + bge-reranker-v2-m3 -- no new ML models
- **Async/await:** All service methods use async/await
- **German docstrings, English variable names**
- **Pydantic v2 for models**, Field() with description for API documentation
- **Code style:** Ruff, line-length 100, strict mypy, from __future__ import annotations
- **Use `query_points` / `query_points_groups` exclusively**, not legacy endpoints

## Sources

### Primary (HIGH confidence)
- [Qdrant Indexing Documentation](https://qdrant.tech/documentation/manage-data/indexing/) -- TextIndexParams, IntegerIndexParams, tokenizer types, index creation
- [Qdrant Filtering Documentation](https://qdrant.tech/documentation/search/filtering/) -- MatchText, Range, filter syntax
- [Qdrant Python Client Docs](https://python-client.qdrant.tech/qdrant_client.async_qdrant_client) -- AsyncQdrantClient method signatures, field_schema types
- [Qdrant API Reference - Create Payload Index](https://api.qdrant.tech/api-reference/indexes/create-field-index) -- REST API for index creation

### Secondary (MEDIUM confidence)
- [Qdrant 1.15 Blog Post](https://qdrant.tech/blog/qdrant-1.15.x/) -- Confirmed multilingual tokenizer introduced in v1.15 (not v1.13)
- [Qdrant GitHub Issue #6731](https://github.com/qdrant/qdrant/issues/6731) -- IntegerIndexParams range/lookup default behavior
- [Qdrant GitHub Issue #7430](https://github.com/qdrant/qdrant/issues/7430) -- MatchText is filter-only, does not produce scores
- [Qdrant Hybrid Search Article](https://qdrant.tech/articles/hybrid-search/) -- RRF fusion, query_points prefetch patterns

### Tertiary (LOW confidence)
- [Qdrant GitHub Issue #5817](https://github.com/qdrant/qdrant/issues/5817) -- Tokenizer behavior details (word tokenizer splits on non-alphanumeric)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all features verified in Qdrant v1.13.2 and qdrant-client >= 1.12.0
- Architecture: HIGH -- patterns follow existing codebase conventions and Qdrant official docs
- Pitfalls: HIGH -- multilingual tokenizer limitation verified via changelog; MatchText filter-only nature verified via multiple sources

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- Qdrant v1.13.2 is pinned)

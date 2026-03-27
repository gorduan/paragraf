# Architecture Research

**Domain:** German legal-tech RAG application -- extending existing Docker Compose system with advanced Qdrant features, cross-reference extraction, query expansion, and frontend design system
**Researched:** 2026-03-27
**Confidence:** HIGH

## System Overview (Extended Architecture)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Frontend (nginx + React 19)                       │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Design    │  │ Search +   │  │ Citation     │  │ Grouped Results  │  │
│  │ System    │  │ Recommend  │  │ Graph Page   │  │ + Pagination     │  │
│  │ (tokens,  │  │ + Discovery│  │ (interactive │  │ (Scroll API)     │  │
│  │  ui lib)  │  │ UI         │  │  d3/canvas)  │  │                  │  │
│  └─────┬─────┘  └──────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
│        └───────────┬────┴──────────┬────┴───────────────────┘            │
│               frontend/src/lib/api.ts (typed REST client)                │
├──────────────────────────────────────────────────────────────────────────┤
│                    nginx reverse proxy (/api/* -> backend:8000)           │
├──────────────────────────────────────────────────────────────────────────┤
│                         Backend (FastAPI + FastMCP)                       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                      API Layer (api.py)                          │    │
│  │  NEW: /api/recommend, /api/discover, /api/search-grouped,       │    │
│  │       /api/scroll, /api/citations/{id}, /api/citation-graph,    │    │
│  │       /api/snapshot/create, /api/snapshot/restore               │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
│                             │                                            │
│  ┌──────────────────────────┴───────────────────────────────────────┐    │
│  │                    Service Layer                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │    │
│  │  │ QdrantStore  │  │ QueryExpander│  │ CrossRefExtractor      │  │    │
│  │  │ (extended)   │  │ (NEW)        │  │ (NEW)                  │  │    │
│  │  │ +recommend() │  │ synonym map  │  │ regex parser           │  │    │
│  │  │ +discover()  │  │ embedding    │  │ payload enrichment     │  │    │
│  │  │ +grouped()   │  │ expansion    │  │ graph queries          │  │    │
│  │  │ +scroll()    │  │              │  │                        │  │    │
│  │  │ +snapshot()  │  │              │  │                        │  │    │
│  │  └──────┬───────┘  └──────────────┘  └────────────────────────┘  │    │
│  └─────────┼────────────────────────────────────────────────────────┘    │
│            │                                                             │
├────────────┼─────────────────────────────────────────────────────────────┤
│            v                                                             │
│         Qdrant v1.13.2                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Collection: "paragraf"                                          │    │
│  │  Vectors: dense (1024-dim cosine) + sparse (lexical weights)     │    │
│  │  Payload: gesetz, paragraph, absatz, titel, abschnitt,          │    │
│  │           chunk_typ, text, norm_id, hierarchie_pfad, stand,     │    │
│  │           quelle                                                 │    │
│  │  NEW payload fields:                                             │    │
│  │    - references_out: [{gesetz, paragraph, context}]              │    │
│  │    - references_in_count: int                                    │    │
│  │  NEW indexes:                                                    │    │
│  │    - Full-text on "text" field                                   │    │
│  │    - Integer on "absatz" (range filter)                          │    │
│  │  Quantization: Scalar INT8 (4x memory reduction)                │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Integration Point |
|-----------|----------------|-------------------|
| **QdrantStore (extended)** | Wraps all Qdrant APIs: hybrid search, recommend, discover, grouped search, scroll, snapshot, quantization config | Existing `qdrant_store.py` -- add methods, do not restructure |
| **CrossRefExtractor (new)** | Regex-based extraction of legal citations from law text during indexing; stores as payload | New `services/cross_ref.py`, called from parser pipeline |
| **QueryExpander (new)** | Expands user queries with legal synonyms and embedding-based paraphrases before search | New `services/query_expander.py`, called from search endpoints |
| **Frontend Design System** | Shared tokens (colors, spacing, typography), primitives (Button, Input, Card, Badge), composed components | New `frontend/src/ui/` directory with Tailwind CSS v4 theme tokens |
| **Citation Graph UI** | Interactive visualization of cross-references between law sections | New page component using lightweight canvas/SVG rendering |

## Cross-Reference Storage: Qdrant Payload (Not a Graph DB)

**Decision: Store citations as Qdrant payload fields, not in a separate graph database.**

**Rationale:**
- Adding Neo4j or similar adds a 4th Docker service, increasing deployment complexity for what is fundamentally a simple adjacency list
- The citation graph for German law is bounded (95 laws, ~50K paragraphs, estimated ~200K cross-references) -- this fits comfortably in Qdrant payloads
- Qdrant payload filtering can efficiently query "find all paragraphs that reference SGB IX Section 152"
- Two-hop queries (A references B, B references C) require at most 2 Qdrant lookups, which is acceptable

**Payload Schema Extension:**

```python
# Added to each point's payload during indexing
{
    # Existing fields unchanged...

    # NEW: Outgoing references extracted from this paragraph's text
    "references_out": [
        {"gesetz": "SGB XII", "paragraph": "Section 41", "raw": "Section 41 SGB XII"},
        {"gesetz": "SGB IX", "paragraph": "Section 99", "raw": "Section 99 Abs. 1 SGB IX"}
    ],

    # NEW: Count of incoming references (updated post-indexing via batch update)
    "references_in_count": 3
}
```

**Querying the Citation Graph:**

```python
# Forward: "What does Section 152 SGB IX reference?"
# -> Direct payload read from the point

# Reverse: "What references Section 152 SGB IX?"
# -> Qdrant scroll with filter on references_out containing matching gesetz+paragraph

# Two-hop: "What is transitively connected to Section 152 SGB IX?"
# -> Combine forward + reverse results, then repeat for each result
```

**Index Requirements:**
- New payload index on `references_out[].gesetz` (keyword) for efficient reverse lookups
- Qdrant supports nested payload filtering since v1.1, so filtering on `references_out[].gesetz` and `references_out[].paragraph` works

## Cross-Reference Extraction Pipeline

**Approach: Regex-based extraction at indexing time, inspired by the [german-legal-reference-parser](https://github.com/lavis-nlp/german-legal-reference-parser) library.**

The extractor does NOT depend on that library (it is unmaintained since 2023 and tightly coupled to Open Legal Data format). Instead, build a focused regex set for the specific citation patterns found in German statutes:

```python
# services/cross_ref.py

CITATION_PATTERNS = [
    # "Section 152 SGB IX", "Section 152 Abs. 1 SGB IX"
    r'§§?\s*(\d+\w*)\s*(Abs\.\s*\d+)?\s*((?:Satz|S\.)\s*\d+)?\s+([A-Z][A-Za-z\s/äöüÄÖÜ]+)',

    # "Art. 3 GG", "Artikel 3 Abs. 1 GG"
    r'Art(?:ikel)?\.?\s*(\d+\w*)\s*(Abs\.\s*\d+)?\s+([A-Z][A-Za-z\s/äöüÄÖÜ]+)',

    # "i.V.m. Section 288 Abs. 1 BGB" (in conjunction with)
    r'i\.?\s*V\.?\s*m\.?\s*§§?\s*(\d+\w*)\s*(Abs\.\s*\d+)?\s+([A-Z][A-Za-z\s/äöüÄÖÜ]+)',
]
```

**Integration into Indexing Flow:**

```
Parse XML -> Extract LawChunks -> Extract cross-references per chunk
    -> Embed chunks -> Upsert with references_out payload
    -> Post-indexing: compute references_in_count via scroll + batch update
```

The extraction runs synchronously during the parse step (before embedding), adding negligible time to the indexing pipeline. The `references_in_count` is computed as a post-processing batch after all laws are indexed, using Qdrant's scroll API to count reverse references.

## Recommend/Discovery API Integration

### Recommend API: "Similar Paragraphs"

**Maps to:** `QdrantStore.recommend()` -- new method
**Qdrant API:** `query_points()` with `RecommendQuery`

```python
async def recommend(
    self,
    point_id: str,           # UUID5 of the source paragraph
    top_k: int = 10,
    search_filter: SearchFilter | None = None,
    negative_ids: list[str] | None = None,
) -> list[SearchResult]:
    """Find paragraphs similar to a given paragraph."""
    query = models.RecommendQuery(
        positive=[point_id],
        negative=negative_ids or [],
        strategy=models.RecommendStrategy.AVERAGE_VECTOR,
    )
    results = await self.client.query_points(
        collection_name=self.collection_name,
        query=query,
        using=DENSE_VECTOR_NAME,
        query_filter=self._build_filter(search_filter),
        limit=top_k,
        with_payload=True,
    )
    return self._points_to_results(results)
```

**Frontend Integration:** "Similar Paragraphs" button on each `ResultCard`. Clicking triggers a recommend request and displays results inline or in a slide-over panel.

**REST Endpoint:**
```
POST /api/recommend
Body: { "chunk_id": "SGB_IX_§_152", "max_ergebnisse": 10, "gesetzbuch": null }
```

### Discovery API: "Explorative Search"

**Maps to:** `QdrantStore.discover()` -- new method
**Qdrant API:** `query_points()` with `DiscoverQuery` or `ContextQuery`

```python
async def discover(
    self,
    target_id: str | None,
    context_pairs: list[tuple[str, str]],  # (positive_id, negative_id)
    top_k: int = 10,
    search_filter: SearchFilter | None = None,
) -> list[SearchResult]:
    """Discovery search with positive/negative context pairs."""
    pairs = [
        models.ContextPair(positive=pos, negative=neg)
        for pos, neg in context_pairs
    ]
    if target_id:
        query = models.DiscoverQuery(target=target_id, context=pairs)
    else:
        query = models.ContextQuery(context=pairs)

    results = await self.client.query_points(
        collection_name=self.collection_name,
        query=query,
        using=DENSE_VECTOR_NAME,
        query_filter=self._build_filter(search_filter),
        limit=top_k,
        with_payload=True,
    )
    return self._points_to_results(results)
```

**Frontend Integration:** An advanced search mode where users can mark results as "more like this" (positive) or "less like this" (negative) to iteratively refine results. Build on top of existing search page as a toggle.

**REST Endpoint:**
```
POST /api/discover
Body: { "target_id": "uuid", "positive_ids": [...], "negative_ids": [...], "max_ergebnisse": 10 }
```

### Grouping API: "Results by Law/Legal Area"

**Maps to:** `QdrantStore.search_grouped()` -- new method
**Qdrant API:** `query_points_groups()` with `group_by` parameter

```python
async def search_grouped(
    self,
    query: str,
    group_by: str = "gesetz",  # or "rechtsgebiet" if added as payload
    group_size: int = 3,
    num_groups: int = 10,
    search_filter: SearchFilter | None = None,
) -> list[dict]:
    """Hybrid search with results grouped by a payload field."""
    dense_vec, sparse_weights = self.embedding.encode_query(query)
    sparse_indices, sparse_values = EmbeddingService.sparse_to_qdrant(sparse_weights)

    prefetch = [
        models.Prefetch(query=dense_vec, using=DENSE_VECTOR_NAME, limit=50),
    ]
    if sparse_indices:
        prefetch.append(models.Prefetch(
            query=models.SparseVector(indices=sparse_indices, values=sparse_values),
            using=SPARSE_VECTOR_NAME, limit=50,
        ))

    results = await self.client.query_points_groups(
        collection_name=self.collection_name,
        prefetch=prefetch,
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        group_by=group_by,
        group_size=group_size,
        limit=num_groups,
        with_payload=True,
    )
    return results  # GroupsResult with .groups list
```

**Key Consideration:** The `group_by` field must be a keyword-indexed payload field. `gesetz` is already indexed. To group by `rechtsgebiet` (legal area), add it as a payload field during indexing (derived from `LAW_REGISTRY`) and create a keyword index.

**REST Endpoint:**
```
POST /api/search-grouped
Body: { "anfrage": "...", "group_by": "gesetz", "group_size": 3, "max_groups": 10 }
```

### Scroll API: Pagination

**Maps to:** `QdrantStore.scroll()` -- new method
**Qdrant API:** `scroll_points()` with `offset` parameter (point ID or integer)

```python
async def scroll(
    self,
    search_filter: SearchFilter | None = None,
    limit: int = 20,
    offset: str | None = None,
) -> tuple[list[SearchResult], str | None]:
    """Paginate through all matching points."""
    results, next_offset = await self.client.scroll(
        collection_name=self.collection_name,
        scroll_filter=self._build_filter(search_filter),
        limit=limit,
        offset=offset,
        with_payload=True,
    )
    return self._scroll_to_results(results), next_offset
```

**Use Cases:**
- Law Browser: paginate through all paragraphs of a law
- Index status: enumerate all indexed points
- Citation graph: scroll all cross-references

## Query Expansion Pipeline

**Position in search flow:** Before embedding, after user input.

```
User query
    │
    ├─ 1. Legal synonym expansion (deterministic, fast)
    │     "Kuendigungsschutz" -> also "KSchG", "Kuendigungsschutzgesetz"
    │     "Behinderung" -> also "Schwerbehinderung", "GdB"
    │
    ├─ 2. Abbreviation resolution
    │     "GdB" -> "Grad der Behinderung"
    │     "SGB" -> "Sozialgesetzbuch"
    │
    └─ 3. Multi-query fusion (optional, more complex)
          Embed original + expanded queries separately
          Combine via prefetch + RRF fusion in Qdrant

Result: expanded_query string OR multiple prefetch queries
```

**Architecture Decision: Start with synonym expansion only.** Multi-query fusion adds latency (multiple embedding calls). Synonym expansion is a simple dictionary lookup that improves recall at zero latency cost.

**Implementation:**

```python
# services/query_expander.py

class QueryExpander:
    """Expands search queries with legal domain synonyms."""

    def __init__(self):
        self.synonyms: dict[str, list[str]] = {}
        self._load_legal_synonyms()

    def expand(self, query: str) -> str:
        """Append relevant synonyms to the query string."""
        additions = []
        query_lower = query.lower()
        for term, expansions in self.synonyms.items():
            if term in query_lower:
                additions.extend(expansions)
        if additions:
            return f"{query} ({' '.join(additions)})"
        return query
```

**Integration Point:** Called in `api.py` search route before passing query to `QdrantStore.hybrid_search()`. Configurable via env var `QUERY_EXPANSION_ENABLED=true`.

## Frontend Design System Architecture

### Layered Approach on TailwindCSS v4

The existing frontend uses TailwindCSS v4 + lucide-react icons with no component library. Build a design system in layers:

**Layer 1: Design Tokens** (CSS custom properties via Tailwind v4 theme)

```css
/* frontend/src/styles/tokens.css */
@theme {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-surface: #1e1e2e;
  --color-surface-raised: #2a2a3e;
  --color-text: #e2e8f0;
  --color-text-muted: #94a3b8;
  --color-border: #334155;
  --color-accent: #f59e0b;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  --spacing-page: 1.5rem;
  --spacing-section: 1rem;
  --spacing-element: 0.5rem;
}
```

**Layer 2: Primitive Components** (small, composable, no business logic)

```
frontend/src/ui/
  ├── Button.tsx          # Variants: primary, secondary, ghost, danger
  ├── Input.tsx           # Text input with label, error state
  ├── Card.tsx            # Surface container with optional header/footer
  ├── Badge.tsx           # Tags: gesetz names, rechtsgebiet, chunk_typ
  ├── Skeleton.tsx        # Loading placeholder
  ├── Dialog.tsx          # Modal wrapper
  ├── Tabs.tsx            # Tab navigation
  ├── Pagination.tsx      # Page navigation (for Scroll API)
  └── index.ts            # Barrel export
```

**Layer 3: Composed Components** (domain-specific, use primitives)

```
frontend/src/components/
  ├── ResultCard.tsx       # REFACTORED: uses Card, Badge from ui/
  ├── SearchBar.tsx        # REFACTORED: uses Input, Button from ui/
  ├── GroupedResults.tsx   # NEW: renders grouped search results
  ├── CitationGraph.tsx    # NEW: interactive graph visualization
  ├── RecommendPanel.tsx   # NEW: similar paragraphs slide-over
  ├── DiscoveryMode.tsx    # NEW: pos/neg feedback search UI
  ├── FilterPanel.tsx      # NEW: advanced filters (abschnitt, absatz range, chunk_typ)
  └── ...existing components
```

**Migration Strategy:** Do NOT rewrite existing components in one shot. Instead:
1. Create `ui/` primitives first
2. New components use primitives from day one
3. Gradually refactor existing components to use primitives (one per PR)

### No External Component Library

**Decision: No shadcn/ui, Radix, Headless UI, or other libraries.**

Rationale:
- The app has ~8 component types total -- a full library is overkill
- TailwindCSS v4 with custom tokens covers all needs
- Adding dependencies increases Docker build time and bundle size
- The existing pattern (manual Tailwind classes) works; just needs consistency

### Citation Graph Visualization

**Decision: Lightweight SVG/Canvas rendering, NOT a heavy graph library like D3 or vis.js.**

Rationale:
- The citation graph for a single paragraph typically shows 5-20 connected nodes
- Full graph rendering for all 50K paragraphs is not the use case -- users explore from a specific node
- A simple force-directed layout with ~50 nodes max can be done with a small custom component or a micro-library

**Fallback if custom is too complex:** Use `react-force-graph-2d` (~30KB gzipped), which renders on canvas and handles force layout. Evaluate during implementation.

## Data Flow: Extended Search Pipeline

### Standard Search (Enhanced)

```
User types query
    |
    v
QueryExpander.expand(query)              # synonym expansion
    |
    v
QdrantStore.hybrid_search(expanded_query) # existing flow
    |
    v
RerankerService.arerank(results)          # existing cross-encoder
    |
    v
Enrich results with references_out        # NEW: attach citation data
    |
    v
Return SearchResponse                     # existing serialization
```

### Grouped Search (New)

```
User types query + selects "group by law"
    |
    v
QueryExpander.expand(query)
    |
    v
QdrantStore.search_grouped(query, group_by="gesetz")
    |
    v
NOTE: Reranking is NOT applied per-group (would require N reranker calls)
Instead: rely on Qdrant's RRF fusion score for within-group ranking
    |
    v
Return GroupedSearchResponse
```

### Recommend Flow (New)

```
User clicks "Similar Paragraphs" on a ResultCard
    |
    v
Frontend sends chunk_id to /api/recommend
    |
    v
QdrantStore.recommend(point_id)   # uses RecommendQuery on dense vectors
    |
    v
Optional: RerankerService for top-K refinement
    |
    v
Return SearchResponse (same format as regular search)
```

## Recommended Project Structure (New/Modified Files)

```
backend/src/paragraf/
  ├── services/
  │   ├── qdrant_store.py      # EXTENDED: +recommend(), +discover(), +search_grouped(),
  │   │                        #           +scroll(), +snapshot_create(), +snapshot_restore(),
  │   │                        #           +enable_quantization(), +create_fulltext_index()
  │   ├── cross_ref.py         # NEW: CrossRefExtractor class
  │   ├── query_expander.py    # NEW: QueryExpander class
  │   ├── embedding.py         # unchanged
  │   ├── reranker.py          # unchanged
  │   └── parser.py            # MODIFIED: calls CrossRefExtractor during parse
  ├── api.py                   # EXTENDED: new endpoints
  ├── api_models.py            # EXTENDED: new request/response models
  ├── tools/
  │   ├── search.py            # EXTENDED: recommend + discover MCP tools
  │   ├── lookup.py            # EXTENDED: citation lookup MCP tool
  │   └── ingest.py            # unchanged
  └── data/
      └── legal_synonyms.json  # NEW: synonym dictionary for query expansion

frontend/src/
  ├── ui/                      # NEW: design system primitives
  │   ├── Button.tsx
  │   ├── Input.tsx
  │   ├── Card.tsx
  │   ├── Badge.tsx
  │   ├── Skeleton.tsx
  │   ├── Pagination.tsx
  │   └── index.ts
  ├── styles/
  │   ├── index.css            # MODIFIED: import tokens.css
  │   └── tokens.css           # NEW: design tokens via @theme
  ├── components/
  │   ├── GroupedResults.tsx    # NEW
  │   ├── CitationGraph.tsx    # NEW
  │   ├── RecommendPanel.tsx   # NEW
  │   ├── DiscoveryMode.tsx    # NEW
  │   ├── FilterPanel.tsx      # NEW
  │   └── ...existing          # GRADUALLY REFACTORED
  ├── pages/
  │   ├── SearchPage.tsx       # EXTENDED: grouped mode, discovery mode, pagination
  │   ├── CitationPage.tsx     # NEW: citation graph explorer
  │   └── ...existing
  └── lib/
      └── api.ts               # EXTENDED: new endpoint methods
```

## Architectural Patterns

### Pattern 1: Extend QdrantStore, Don't Wrap It

**What:** Add new methods to existing `QdrantStore` class rather than creating wrapper classes or new service classes for each Qdrant API.

**When to use:** For all Qdrant API integrations (recommend, discover, grouped, scroll, snapshot).

**Trade-offs:** Keeps service layer flat and discoverable. QdrantStore grows in size but remains the single source of truth for all vector DB operations. The alternative (separate RecommendService, DiscoveryService) creates unnecessary indirection for what are essentially thin wrappers around Qdrant client calls.

### Pattern 2: Payload Enrichment at Index Time

**What:** Extract cross-references and add derived data to Qdrant payloads during the indexing pipeline, not at query time.

**When to use:** For any data that can be computed once and queried many times (cross-references, rechtsgebiet from LAW_REGISTRY, computed metadata).

**Trade-offs:** Increases indexing time slightly but eliminates query-time computation. Requires re-indexing when extraction logic changes. This is acceptable because indexing is an explicit user action (not continuous) and the current pipeline already takes minutes for embedding.

### Pattern 3: Progressive Enhancement for Frontend

**What:** Build new UI components using design system primitives; refactor existing components gradually, not all at once.

**When to use:** Always. Rewriting all components simultaneously risks breaking the working UI.

**Trade-offs:** Temporary visual inconsistency between refactored and un-refactored components. Mitigate by defining tokens first (so colors/spacing are consistent even before component refactoring).

## Anti-Patterns

### Anti-Pattern 1: Separate Graph Database for Citations

**What people do:** Add Neo4j or similar to store the citation graph as a proper graph database.

**Why it's wrong:** Adds operational complexity (4th Docker service, new backup strategy, new query language) for a graph that fits in Qdrant payloads. The citation network is bounded and sparse -- ~200K edges over ~50K nodes is trivially queryable via payload filters.

**Do this instead:** Store `references_out` as a nested payload array. Use Qdrant's nested field filtering for reverse lookups. If two-hop queries become a performance bottleneck (unlikely at this scale), consider a materialized adjacency list in a JSON file as cache.

### Anti-Pattern 2: Reranking Grouped Results

**What people do:** Apply cross-encoder reranking to each group's results in grouped search.

**Why it's wrong:** With 10 groups x 3 results each, that is 30 reranker calls (each ~50ms on CPU) = 1.5s added latency. The reranker is designed for refining a flat top-K list, not for per-group refinement.

**Do this instead:** Rely on Qdrant's RRF fusion score for within-group ordering. Apply reranking only to the overall top results when the user drills into a specific group.

### Anti-Pattern 3: Multi-Query Embedding for Query Expansion

**What people do:** Embed the original query + N expanded queries separately and fuse results.

**Why it's wrong:** Each embedding call takes ~100ms on CPU. 3 expanded queries = 400ms total before even hitting Qdrant. This defeats the purpose of faster search.

**Do this instead:** Append synonym terms to the original query string before embedding. The sparse vector component naturally picks up lexical matches for the added terms. For truly different semantic angles, consider this as a future optimization only after measuring synonym expansion's impact.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Qdrant v1.13.2 | AsyncQdrantClient via qdrant-client Python lib | All new APIs (recommend, discover, group, scroll, snapshot, quantization) are available in v1.13.2 |
| gesetze-im-internet.de | HTTP download of XML ZIPs (existing) | Cross-reference extraction happens post-download during parse |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CrossRefExtractor <-> Parser | Direct function call during parse | Extractor receives chunk text, returns list of references |
| QueryExpander <-> API routes | Direct function call before search | Expander receives query string, returns expanded string |
| Frontend <-> Backend (new endpoints) | REST JSON via nginx proxy | Same pattern as existing endpoints; add types to api.ts |
| Design System <-> Pages | Import from `ui/` barrel | Pages import primitives, compose into page-specific layouts |

## Build Order (Dependency Graph)

```
Phase 1: Foundation (no dependencies between items)
  ├── Snapshot API (safety net for re-indexing)
  ├── Scalar Quantization config
  ├── Full-text index on "text" field
  ├── Integer index on "absatz" field
  └── Frontend design tokens + primitives (ui/)

Phase 2: Core Qdrant Features (depends on Phase 1 indexes)
  ├── Recommend API + endpoint + ResultCard button
  ├── Scroll API + endpoint + pagination component
  ├── Grouping API + endpoint + GroupedResults component
  └── Payload enrichment: add "rechtsgebiet" field from LAW_REGISTRY

Phase 3: Cross-References (depends on Phase 1 snapshot for safety)
  ├── CrossRefExtractor service
  ├── Parser integration (extract during indexing)
  ├── Re-index with cross-references (use snapshot for rollback)
  ├── Citation API endpoints
  └── Citation Graph UI component + page

Phase 4: Search Enhancement (depends on Phase 2 recommend + Phase 3 citations)
  ├── Query expansion (synonym dictionary)
  ├── Discovery API + endpoint + DiscoveryMode UI
  ├── Advanced filter panel (abschnitt, absatz range, chunk_typ)
  └── Export functionality (PDF/Markdown)

Phase 5: Polish (depends on all above)
  ├── Refactor existing components to use design system
  ├── Responsive design improvements
  ├── Accessibility audit
  └── MCP tool extensions (recommend, discover, batch search)
```

**Build Order Rationale:**
- Snapshot API first because cross-reference extraction requires re-indexing, and you want rollback capability
- Quantization and indexes first because they are non-breaking changes that improve performance for all subsequent work
- Design tokens before components because tokens define the visual language everything else builds on
- Recommend before Discovery because Recommend is simpler (one positive ID) and validates the pattern for Discovery (multiple positive/negative pairs)
- Cross-references before query expansion because cross-references are a data pipeline change (indexing) while query expansion is a search-time change; getting the data model right first is more important
- MCP tools last because the REST API validates the interface first; MCP tools are thin wrappers

## Scaling Considerations

| Concern | Current (~50K points) | At 200K points | At 1M points |
|---------|------------------------|-----------------|---------------|
| Memory | ~200MB (1024-dim float32) | ~800MB | Scalar quantization reduces to ~250MB at 1M |
| Search latency | <100ms | <200ms | Quantization + HNSW tuning keeps <500ms |
| Indexing time | ~30min (CPU) | ~2h (CPU) | Batch size tuning, GPU recommended |
| Citation graph | Trivial | Payload arrays grow but still fast | Consider materialized reverse index JSON |

## Sources

- [Qdrant Query Points Groups API Reference](https://api.qdrant.tech/api-reference/search/query-points-groups)
- [Qdrant Recommend Points API Reference](https://api.qdrant.tech/api-reference/search/recommend-points)
- [Qdrant Discovery/Recommendation Article](https://qdrant.tech/articles/new-recommendation-api/)
- [Qdrant Scalar Quantization Guide](https://qdrant.tech/articles/scalar-quantization/)
- [Qdrant Python Client Documentation](https://python-client.qdrant.tech/)
- [DeepWiki: Qdrant Client Search and Query](https://deepwiki.com/qdrant/qdrant-client/4.3-search-and-query)
- [German Legal Reference Parser (GitHub)](https://github.com/lavis-nlp/german-legal-reference-parser) -- pattern reference only, not used as dependency
- [Qdrant v1.15 Quantization Updates](https://qdrant.tech/blog/qdrant-1.15.x/) -- confirms features exist in earlier versions

---
*Architecture research for: Paragraf v2 -- Qdrant feature expansion, cross-references, query expansion, frontend design system*
*Researched: 2026-03-27*

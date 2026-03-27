# Stack Research

**Domain:** Advanced Qdrant features, German legal cross-reference extraction, query expansion, frontend redesign
**Researched:** 2026-03-27
**Confidence:** MEDIUM-HIGH (Qdrant APIs verified against v1.13.x docs; NLP libraries verified via GitHub/PyPI; frontend libs verified via official docs)

## Recommended Stack

### Core Technologies (already in place -- no changes)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Python 3.12+ | 3.12 | Backend | Keep |
| FastAPI | >=0.115.0 | REST API | Keep |
| React 19 | ^19.0.0 | Frontend SPA | Keep |
| Vite 6 | ^6.0.0 | Build tool | Keep |
| TailwindCSS 4 | ^4.0.0 | CSS framework | Keep |
| Qdrant | v1.13.2 | Vector DB | Keep (Docker image pinned) |
| qdrant-client | >=1.12.0 | Python Qdrant SDK | **Bump to >=1.13.0** |

### New Backend Libraries

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| *(none -- pure regex)* | -- | Cross-reference extraction | Custom regex is better than `olparse` (see rationale below) | HIGH |
| py-openthesaurus | >=1.0.5 | German synonym lookup for query expansion | Only maintained Python wrapper for OpenThesaurus (German synonym DB). Lightweight, 60 req/min API or local MySQL dump. | MEDIUM |
| @react-pdf/renderer | -- | *Backend alternative: use WeasyPrint if server-side PDF needed* | -- | -- |

### New Frontend Libraries

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| shadcn/ui | latest (CLI) | Design system / component library | Official Vite + React 19 + TailwindCSS 4 support. Copy-paste model gives full control. 84k+ GitHub stars, actively maintained. Built on Radix UI primitives (accessibility). | HIGH |
| @radix-ui/react-* | (transitive via shadcn) | Accessible UI primitives | Required by shadcn/ui components. Headless, composable, WAI-ARIA compliant. | HIGH |
| react-force-graph-2d | ^1.48.0 | Citation network graph visualization | Lightweight 2D force-directed graph using Canvas. d3-force engine. Works with React 19 (thin wrapper). Better than reagraph (WebGL overkill for citation graphs) or raw D3 (too low-level). | MEDIUM |
| @react-pdf/renderer | ^4.0.0 | PDF export of search results and comparisons | Build PDFs from React components (invoices/reports pattern). Better than jsPDF for structured legal documents because it renders from JSX, not from DOM screenshots. | MEDIUM |
| class-variance-authority | ^0.7.0 | Component variant management | Required by shadcn/ui for consistent component styling. | HIGH |
| clsx | ^2.0.0 | Conditional class merging | Required by shadcn/ui. Lightweight (228B). | HIGH |
| tailwind-merge | ^2.0.0 | Tailwind class conflict resolution | Required by shadcn/ui. Prevents `p-4 p-2` conflicts. | HIGH |

### Development Tools (additions)

| Tool | Purpose | Notes |
|------|---------|-------|
| `npx shadcn@latest init` | Initialize shadcn/ui in frontend | Run once, configures components.json |
| `npx shadcn@latest add [component]` | Add individual UI components | Add only what you need: button, card, dialog, tabs, select, input, badge, tooltip, dropdown-menu, sheet, separator, scroll-area |

## Qdrant v1.13.2 API Strategy

**Critical insight:** Qdrant v1.13 has a **unified `query_points` API** that replaces the older separate `search`, `recommend`, `discover` endpoints. Use `query_points` and `query_points_groups` for everything.

### Unified Query API (`query_points`)

All advanced search features route through one endpoint. The `query` parameter determines behavior:

| Query Type | Python Client | Purpose | Use Case |
|------------|---------------|---------|----------|
| **NearestQuery** | `models.NearestQuery(nearest=...)` | Standard vector search | Existing hybrid search (refactor to use this) |
| **RecommendQuery** | `models.RecommendQuery(recommend=models.RecommendInput(positive=[id], negative=[]))` | Find similar to given point(s) | "Aehnliche Paragraphen" button |
| **DiscoverQuery** | `models.DiscoverQuery(discover=models.DiscoverInput(target=id, context=[...]))` | Explore with positive/negative context | Explorative search with user feedback |
| **ContextQuery** | `models.ContextQuery(context=[...])` | Guide search towards area of positive examples | Refine results interactively |
| **FusionQuery** | `models.FusionQuery(fusion=models.Fusion.RRF)` | Combine prefetch results | Current RRF hybrid search pattern |
| **OrderByQuery** | `models.OrderByQuery(order_by="field")` | Sort by payload field | Browse paragraphs in order |

### Grouping API (`query_points_groups`)

```python
await client.query_points_groups(
    collection_name="paragraf",
    query=vector,
    group_by="gesetz",      # Group results by law abbreviation
    group_size=3,            # Top 3 results per law
    limit=10,                # Max 10 law groups
    with_payload=True,
)
```

**Key constraints:**
- `group_by` field must be a **string or number** field with a payload index
- `group_size` is best-effort, not guaranteed
- Create a keyword payload index on `gesetz` field for performance

### Scroll API (Pagination)

```python
result = await client.scroll(
    collection_name="paragraf",
    scroll_filter=models.Filter(...),
    limit=20,
    offset=last_point_id,    # From previous response's next_page_offset
    with_payload=True,
    order_by="paragraph",    # Optional: sort by payload field
)
next_offset = result.next_page_offset  # Use in next request
```

**Pagination model:** Cursor-based (not page-number). Frontend must track `next_page_offset` from each response.

### Full-Text Index

```python
await client.create_payload_index(
    collection_name="paragraf",
    field_name="text",
    field_schema=models.TextIndexParams(
        type=models.TextIndexType.TEXT,
        tokenizer=models.TokenizerType.WORD,
        min_token_len=2,
        max_token_len=30,
    ),
)
```

**Use for:** Exact word/phrase matching alongside vector search. Enables `models.FieldCondition(key="text", match=models.MatchText(text="..."))`.

### Scalar Quantization

```python
await client.update_collection(
    collection_name="paragraf",
    quantization_config=models.ScalarQuantization(
        scalar=models.ScalarQuantizationConfig(
            type=models.ScalarType.INT8,
            quantile=0.99,
            always_ram=True,
        ),
    ),
)
```

**Effect:** 75% memory reduction for dense vectors (1024-dim float32 -> int8). Use with `rescore=True` and `oversampling=2.0` in search params to maintain accuracy.

### Snapshot API

```python
# Create before re-indexing
snapshot = await client.create_snapshot(collection_name="paragraf")
# snapshot.name = "paragraf-2026-03-27-12-00-00.snapshot"

# Restore if something goes wrong
await client.recover_snapshot(
    collection_name="paragraf",
    location=f"http://localhost:6333/collections/paragraf/snapshots/{snapshot.name}",
)
```

## Cross-Reference Extraction Strategy

### Why NOT use `olparse` (german-legal-reference-parser)

| Factor | Assessment |
|--------|------------|
| Last commit | March 2023 (3 years stale) |
| PyPI package | Not published (install from source only) |
| Python version | No 3.12 testing |
| Scope | Designed for court decisions (Urteile), not statute cross-references |
| Dependencies | Adds unnecessary complexity |
| Alternative | Custom regex is ~100 lines and covers our exact patterns |

### Recommended: Custom Regex Module

German legal cross-references follow predictable patterns. Build a `cross_references.py` module with these regex patterns:

```python
import re

# Pattern: "ss 123 Abs. 1 BGB" or "ss 123 BGB" or "ssss 123, 124 BGB"
SINGLE_REF = r'§\s*(\d+[a-z]?)\s*(?:Abs\.\s*(\d+))?\s*(?:S(?:atz|\.)\s*(\d+))?\s*(?:Nr\.\s*(\d+))?\s*([A-Z][A-Za-z]+(?:\s+[IVX]+)?)'

# Pattern: "ssss 123, 124 BGB" (multiple paragraphs)
MULTI_REF = r'§§\s*([\d,\s]+(?:bis\s+\d+)?)\s+([A-Z][A-Za-z]+(?:\s+[IVX]+)?)'

# Pattern: "i.V.m. ss 456 BGB" (in Verbindung mit)
IVM_REF = r'(?:i\.\s*V\.\s*m\.|in\s+Verbindung\s+mit)\s+§\s*(\d+[a-z]?)\s+([A-Z][A-Za-z]+(?:\s+[IVX]+)?)'

# Pattern: "Art. 12 GG" or "Artikel 12 GG"
ARTICLE_REF = r'(?:Art(?:ikel)?\.?\s*)(\d+[a-z]?)\s+([A-Z][A-Za-z]+(?:\s+[IVX]+)?)'
```

**Storage:** Add a `cross_references` payload field to each Qdrant point:
```json
{
  "cross_references": [
    {"gesetz": "BGB", "paragraph": "123", "absatz": "1"},
    {"gesetz": "ZPO", "paragraph": "456", "absatz": null}
  ]
}
```

**Validation:** Match extracted `gesetz` abbreviation against existing `LAW_REGISTRY` keys to filter false positives.

**Confidence:** HIGH -- regex-based extraction for German legal citations is a well-established approach (verified via academic papers from lavis-nlp group). The structured format of German legal citations ("ss X Abs. Y Gesetz") makes regex reliable.

## Query Expansion Strategy

### Three-Layer Approach

| Layer | Method | Latency | When |
|-------|--------|---------|------|
| 1. Legal abbreviation expansion | Static dictionary | ~0ms | Always |
| 2. German synonym lookup | py-openthesaurus API | ~50-100ms | Optional, user-toggleable |
| 3. Embedding-based expansion | bge-m3 already handles this | 0ms extra | Implicit in vector search |

### Layer 1: Legal Abbreviation Dictionary (HIGH confidence)

Build a static `LEGAL_SYNONYMS` dict mapping common terms to legal terminology:

```python
LEGAL_SYNONYMS = {
    "Behinderung": ["Behinderung", "Schwerbehinderung", "Teilhabe"],
    "Kuendigung": ["Kuendigung", "Kuendigungsschutz", "Abmahnung"],
    "Miete": ["Miete", "Mietvertrag", "Mietrecht", "Wohnraum"],
    "Scheidung": ["Scheidung", "Ehescheidung", "Trennung"],
    # ... expand based on LAW_REGISTRY rechtsgebiete
}
```

### Layer 2: OpenThesaurus Integration (MEDIUM confidence)

```python
from py_openthesaurus import OpenThesaurusWeb
ot = OpenThesaurusWeb()
synonyms = ot.get_synonyms(word="Kuendigung")
# Returns: ["Entlassung", "Rauswurf", "Abberufung", ...]
```

**Caveat:** 60 req/min rate limit on API. Cache aggressively (legal vocabulary is stable). Consider downloading the MySQL dump for offline use.

### Layer 3: Implicit via bge-m3 (already working)

bge-m3 embeddings already capture semantic similarity. A query for "Kuendigung" will find results about "Entlassung" through vector similarity. Query expansion layers 1+2 improve **sparse search recall** (BM25/keyword matching), not dense search.

### Why NOT a fine-tuned German legal LLM for expansion

- Adds model loading time and memory (~3GB+)
- Overkill for synonym expansion
- bge-m3 already handles semantic similarity
- Static dict + OpenThesaurus covers the keyword gap cheaply

## Frontend Design System

### shadcn/ui Installation for Existing Vite Project

```bash
cd frontend

# Required dependencies for shadcn/ui
npm install class-variance-authority clsx tailwind-merge

# Required for shadcn path resolution
npm install -D @types/node

# Initialize shadcn (interactive CLI)
npx shadcn@latest init
```

**Configuration (`components.json`):**
- Style: "default" (or "new-york" for denser UI)
- CSS variables: yes (for theme consistency)
- Tailwind CSS: v4 (auto-detected)
- Components alias: `@/components`
- Utils alias: `@/lib/utils`

### Recommended shadcn Components for This Project

| Component | Use Case | Priority |
|-----------|----------|----------|
| button | All interactive actions | P0 |
| card | Search result cards, law cards | P0 |
| input | Search bar, filters | P0 |
| badge | Law abbreviation tags, chunk type | P0 |
| tabs | Search/Browse/Compare navigation | P0 |
| dialog | Paragraph detail view, export | P1 |
| select | Filter dropdowns (Gesetz, Rechtsgebiet) | P1 |
| dropdown-menu | Action menus on result cards | P1 |
| tooltip | Info icons, abbreviation explanations | P1 |
| sheet | Mobile sidebar, filter panel | P1 |
| scroll-area | Long result lists, law text | P1 |
| separator | Visual section dividers | P2 |
| skeleton | Loading states | P2 |
| pagination | Scroll API results pagination | P1 |
| toggle-group | View mode switches | P2 |
| collapsible | Grouped results expand/collapse | P1 |

### Citation Graph Visualization

**Use `react-force-graph-2d`** because:
- Canvas-based rendering (performant for 100-500 node graphs)
- d3-force physics engine (well-established)
- Thin React wrapper (no framework lock-in)
- Supports node/link coloring, labels, click handlers
- ~50KB bundle size

**Not reagraph** -- WebGL is overkill for 2D citation networks.
**Not raw D3** -- Too much boilerplate for React integration.
**Not React Flow** -- Designed for flowcharts/node editors, not force-directed graphs.

### PDF Export

**Use `@react-pdf/renderer`** for structured legal document export:
- Build PDFs from JSX (not DOM screenshots)
- Supports German characters natively
- Proper typography control for legal documents
- Server-independent (runs in browser)

**Not jsPDF + html2canvas** -- produces rasterized/screenshot PDFs, poor text quality for legal documents that need to be searchable and copy-pasteable.

## Installation Summary

### Backend (add to pyproject.toml)

```toml
dependencies = [
    # ... existing deps ...
    "py-openthesaurus>=1.0.5",   # German synonym lookup
]
```

**Note:** qdrant-client >=1.12.0 already supports all v1.13.2 server APIs (query_points, query_points_groups, scroll, snapshots, quantization). No version bump strictly required, but >=1.13.0 ensures best compatibility.

### Frontend (add to package.json)

```bash
# shadcn/ui prerequisites
npm install class-variance-authority clsx tailwind-merge
npm install -D @types/node

# Initialize shadcn
npx shadcn@latest init

# Graph visualization
npm install react-force-graph-2d

# PDF export
npm install @react-pdf/renderer
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Custom regex for cross-refs | `olparse` (german-legal-reference-parser) | Never for this project -- unmaintained, not on PyPI, designed for court decisions |
| Custom regex for cross-refs | spaCy NER pipeline | Only if regex fails on >10% of citations (unlikely for statute references) |
| py-openthesaurus | GermaNet (academic) | If you have a GermaNet license (commercial, not open) |
| py-openthesaurus | Fine-tuned LLM | If query expansion quality is insufficient after testing |
| shadcn/ui | Ant Design / MUI | If you need complex pre-built components (data tables, date pickers). But both fight with TailwindCSS 4 and add 100KB+ bundle |
| react-force-graph-2d | reagraph | If you need 3D visualization or >10k nodes |
| react-force-graph-2d | Cytoscape.js | If you need advanced graph algorithms (shortest path, clustering) beyond visualization |
| @react-pdf/renderer | jsPDF + html2canvas | If you just need quick "screenshot to PDF" without caring about text quality |
| Cursor-based pagination (Scroll) | Page-number pagination | Never with Qdrant -- Scroll API is cursor-based by design |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Separate `search_points` / `recommend` / `discover` endpoints | Deprecated pattern in Qdrant. The unified `query_points` API replaces them all and supports prefetch/fusion. | `query_points` + `query_points_groups` |
| `olparse` / german-legal-reference-parser | Unmaintained (last commit 2023), not on PyPI, no Python 3.12 support, designed for court decisions not statutes | Custom regex module (~100 lines) |
| GermaNet for synonyms | Commercial license required, heavyweight academic tool | py-openthesaurus (free, API-based) |
| spaCy German model for citation extraction | Overkill -- German legal citations are structurally predictable with "ss" prefix. NER adds 500MB+ model and complexity. | Regex patterns validated against LAW_REGISTRY |
| MUI / Ant Design / Chakra UI | Conflict with TailwindCSS 4, large bundle size, opinionated styling that fights existing design | shadcn/ui (TailwindCSS-native, copy-paste, zero runtime) |
| D3.js direct DOM manipulation | Fights React's virtual DOM. Requires manual lifecycle management. | react-force-graph-2d (React wrapper over d3-force) |
| Neo4j for citation graph | Adding a 4th Docker service for a graph DB is massive overhead when Qdrant payload queries can traverse citations | Qdrant payload filtering + in-memory graph traversal |
| Binary Quantization | Too aggressive for 1024-dim bge-m3 vectors -- causes significant recall loss | Scalar Quantization (INT8) with rescoring |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| qdrant-client >=1.13.0 | Qdrant server v1.13.2 | Full API parity. Older client (>=1.12) works but may lack type hints for newer features |
| shadcn/ui (latest) | React 19 + TailwindCSS 4 + Vite 6 | Officially supported as of 2025. All components updated for React 19 (no forwardRef). |
| react-force-graph-2d ^1.48 | React 18/19 | Thin wrapper, no React internals dependency. Works with React 19. |
| @react-pdf/renderer ^4.0 | React 18/19 | Check peer deps; may need `--legacy-peer-deps` with npm |
| py-openthesaurus >=1.0.5 | Python 3.12 | Pure Python, no native deps. API-based. |

## Sources

- [Qdrant v1.13.x Query Points API](https://api.qdrant.tech/v-1-13-x/api-reference/search/query-points) -- verified endpoint schema, query types (HIGH confidence)
- [Qdrant v1.13.x Query Points Groups API](https://api.qdrant.tech/v-1-13-x/api-reference/search/query-points-groups) -- verified group_by, group_size params (HIGH confidence)
- [Qdrant v1.13.x Scroll Points API](https://api.qdrant.tech/v-1-13-x/api-reference/points/scroll-points) -- verified cursor-based pagination (HIGH confidence)
- [Qdrant Quantization Docs](https://qdrant.tech/articles/what-is-vector-quantization/) -- scalar quantization config (HIGH confidence)
- [Qdrant Snapshot Docs](https://qdrant.tech/documentation/database-tutorials/create-snapshot/) -- create/restore API (HIGH confidence)
- [Qdrant Full-Text Index](https://qdrant.tech/articles/qdrant-introduces-full-text-filters-and-indexes/) -- text index configuration (HIGH confidence)
- [lavis-nlp/german-legal-reference-parser](https://github.com/lavis-nlp/german-legal-reference-parser) -- evaluated and rejected (MEDIUM confidence on rejection rationale)
- [py-openthesaurus on PyPI](https://pypi.org/project/py-openthesaurus/) -- German synonyms (MEDIUM confidence)
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite) -- React 19 + TailwindCSS 4 setup (HIGH confidence)
- [shadcn/ui Tailwind v4 Migration](https://ui.shadcn.com/docs/tailwind-v4) -- component updates for v4 (HIGH confidence)
- [react-force-graph GitHub](https://github.com/vasturiano/react-force-graph) -- v1.48, Canvas-based (MEDIUM confidence on React 19 compat)
- [qdrant-client on PyPI](https://pypi.org/project/qdrant-client/) -- latest v1.17.1 (HIGH confidence)

---
*Stack research for: Paragraf v2 -- Advanced Qdrant features, cross-reference extraction, query expansion, frontend redesign*
*Researched: 2026-03-27*

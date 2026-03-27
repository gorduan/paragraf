# Project Research Summary

**Project:** Paragraf v2 -- Volles Qdrant-Potenzial (Advanced Features Milestone)
**Domain:** German legal-tech RAG application with vector search, cross-reference extraction, and frontend redesign
**Researched:** 2026-03-27
**Confidence:** MEDIUM-HIGH

## Executive Summary

Paragraf v2 is an existing Docker-based legal search application using Qdrant hybrid search (dense + sparse with RRF fusion) and cross-encoder reranking. The next milestone extends it with advanced Qdrant APIs (recommend, discover, grouping, scroll, snapshots), cross-reference extraction from German law text, query expansion with legal synonyms, and a frontend design system overhaul. The existing stack (Python 3.12, FastAPI, React 19, Vite, TailwindCSS 4, Qdrant v1.13.2) is solid and requires no fundamental changes -- only targeted additions. The key insight from stack research is that Qdrant v1.13's unified `query_points` API replaces all legacy search endpoints, and all new features (recommend, discover, group, scroll) route through this single API.

The recommended approach is a phased build that prioritizes safety infrastructure (snapshots) first, then core Qdrant search features (recommend, pagination, grouping), then the data-pipeline-heavy cross-reference extraction, and finally search enhancements and polish. This ordering respects the critical dependency: cross-reference extraction requires re-indexing, and re-indexing requires the snapshot safety net. The frontend should adopt a design token system and primitive components (via shadcn/ui) incrementally -- not a big-bang rewrite -- to avoid breaking the working application that has zero frontend tests.

The top risks are: (1) German legal citation parsing is deceptively complex with dozens of variant forms, requiring scoped-down v1 extraction with normalization from day one; (2) query expansion can cause "query drift" in legal German where synonyms have different legal meanings, demanding conservative hand-curated dictionaries; (3) the frontend has zero tests, making any visual redesign a regression risk; and (4) the Qdrant grouping API has a legacy/modern endpoint split that has confused real users (GitHub issue #5397). All four risks have clear mitigations documented in the research.

## Key Findings

### Recommended Stack

The existing stack needs minimal changes. The only backend addition is `py-openthesaurus` for German synonym lookup. Cross-reference extraction uses custom regex (not the unmaintained `olparse` library). The frontend adds shadcn/ui as a component system (built on Radix UI primitives with TailwindCSS 4 support), react-force-graph-2d for citation network visualization, and @react-pdf/renderer for structured PDF export.

**Core technologies (keep as-is):**
- Python 3.12 + FastAPI: Backend REST API and ML model serving
- React 19 + Vite 6 + TailwindCSS 4: Frontend SPA
- Qdrant v1.13.2: Vector database (bump qdrant-client to >=1.13.0 for best API parity)

**New additions:**
- shadcn/ui: Design system with accessible components, TailwindCSS-native, zero runtime overhead
- react-force-graph-2d: Canvas-based citation graph visualization (~50KB, d3-force engine)
- @react-pdf/renderer: JSX-based PDF export for legal documents
- py-openthesaurus: German synonym API for query expansion (60 req/min, cache aggressively)
- Custom regex module: ~100 lines for German legal cross-reference extraction

**Critical version note:** Use `query_points` and `query_points_groups` APIs exclusively. The legacy `search`, `recommend`, `discover`, and `search_groups` endpoints are deprecated patterns.

### Expected Features

**Must have (table stakes):**
- Paginated search results (Qdrant Scroll API) -- every search tool paginates
- Grouped results by law/legal area (Qdrant Groups API) -- Beck-online and Juris do this
- Advanced filtering UI -- expose existing backend filter capabilities (law, section, legal area)
- Full-text keyword search toggle -- lawyers need exact term matching alongside semantic search
- Export to Markdown/clipboard -- legal professionals copy results into briefs
- Snapshot backup -- safety net before any re-indexing operations

**Should have (differentiators):**
- "Similar Paragraphs" recommendation (Qdrant Recommend API) -- no free German legal tool offers this
- Citation network visualization -- genuinely novel; TENJI study showed graph interfaces doubled retrieval performance
- Discovery search with positive/negative examples -- exploratory comparative legal research
- Cross-reference extraction and clickable links (Normenkette) -- standard in paid databases, novel in free tools
- Query expansion with legal synonyms -- improves recall for sparse search component

**Defer (v2+):**
- Grouped recommendations (Recommend + Groups combined)
- Semantic chunking improvements (legal clause-aware segmentation)
- PDF export (higher effort than Markdown/clipboard)
- Mobile-responsive design audit and accessibility audit
- Built-in LLM chat (keep MCP integration instead), user accounts, Neo4j graph DB, ColBERT multi-vector

### Architecture Approach

The architecture extends the existing 3-service Docker Compose setup without adding new services. All new Qdrant features are added as methods on the existing `QdrantStore` class (extend, do not wrap). Cross-references are stored as Qdrant payload fields (not a separate graph DB) -- the citation graph for ~95 laws and ~50K paragraphs fits comfortably in payload arrays. Two new backend services are added: `CrossRefExtractor` (regex-based, runs at index time) and `QueryExpander` (dictionary-based, runs at search time). The frontend gains a `ui/` directory with design system primitives and new composed components for grouped results, citation graphs, recommendation panels, and discovery mode.

**Major components:**
1. **QdrantStore (extended)** -- single entry point for all Qdrant APIs: hybrid search, recommend, discover, grouped, scroll, snapshot, quantization
2. **CrossRefExtractor (new)** -- regex extraction of legal citations at index time, stores structured references as payload
3. **QueryExpander (new)** -- legal synonym dictionary lookup before search, improves sparse search recall
4. **Frontend Design System** -- Tailwind v4 design tokens + shadcn/ui primitives + composed domain components
5. **Citation Graph UI** -- interactive force-directed graph visualization of cross-references between law sections

**Key architecture decisions:**
- Payload enrichment at index time, not query time (cross-references, rechtsgebiet)
- No reranking on grouped results (too expensive: 10 groups x 3 results = 30 reranker calls)
- Synonym expansion appended to query string before single embedding call (not multi-query fusion)
- Progressive frontend enhancement: new components use primitives, existing components refactored gradually

### Critical Pitfalls

1. **Snapshot API must come first** -- adding quantization, indices, or cross-reference payloads modifies the collection irreversibly. Without snapshots, a failed migration means hours of re-indexing. Implement snapshot create/restore before any other Qdrant changes.

2. **German citation parsing has dozens of variant forms** -- "simple" regex catches ~60% of citations. Scope v1 to the standard `SS X Abs. Y GESETZ` pattern where the law abbreviation matches `LAW_REGISTRY` keys. Normalize all citations to canonical form from day one. Accept that completeness is iterative.

3. **Grouping API has legacy/modern split** -- `search_groups` does NOT support hybrid dense+sparse fusion. Must use `query_points_groups` exclusively. Verified via Qdrant GitHub issue #5397.

4. **Query expansion causes drift in legal German** -- legal terms have precise meanings that differ from everyday synonyms. Use hand-curated abbreviation expansions only (e.g., "GdB" -> "Grad der Behinderung"), not general-purpose synonym databases. Make expansion toggleable and visible to users.

5. **Frontend redesign without tests risks silent regressions** -- zero frontend tests exist. Add smoke tests for critical flows (health check, search, SSE indexing, law browser) BEFORE any visual redesign. Decompose the 965-line IndexPage before restyling.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Safety and Infrastructure
**Rationale:** All subsequent phases modify the Qdrant collection (indexes, quantization, cross-reference payloads). Without snapshots, any failure requires full re-indexing. Design tokens must precede UI work for visual consistency.
**Delivers:** Snapshot API (create/restore), scalar quantization (dense vectors only), full-text index on `text` field, keyword index on `gesetz`, integer index on `absatz`, frontend design tokens and primitive UI components
**Addresses:** Snapshot backup (table stakes), index performance foundations
**Avoids:** Pitfall 7 (no snapshots before destructive changes), Pitfall 5 (quantization on sparse vectors)

### Phase 2: Core Search Features
**Rationale:** Recommend, pagination, and grouping are the highest-value features with the clearest Qdrant API patterns. They depend on Phase 1 indexes but not on cross-references. Can be built in parallel across backend and frontend.
**Delivers:** "Similar Paragraphs" recommendation, paginated search results, grouped results by law, full-text keyword search toggle, advanced filter sidebar UI, Markdown/clipboard export
**Uses:** Qdrant `query_points` (RecommendQuery), `query_points_groups`, Scroll API, full-text index
**Implements:** Extended QdrantStore methods, new REST endpoints, new frontend components (GroupedResults, RecommendPanel, FilterPanel, Pagination)
**Avoids:** Pitfall 1 (Recommend API requires point IDs, not text), Pitfall 2 (use `query_points_groups` not `search_groups`)

### Phase 3: Cross-Reference Extraction and Visualization
**Rationale:** Cross-references require a data pipeline change (re-indexing with new payload fields) and are the most complex feature. Must come after snapshots (Phase 1) for safety. Unlocks citation graph, clickable links, and multi-hop MCP prompts.
**Delivers:** CrossRefExtractor regex module, re-indexed collection with `references_out` payload, clickable cross-reference links in UI, interactive citation network graph, citation API endpoints
**Uses:** Custom regex patterns, react-force-graph-2d, Qdrant nested payload filtering
**Implements:** CrossRefExtractor service, parser integration, CitationGraph component, CitationPage
**Avoids:** Pitfall 3 (citation parsing complexity -- scope to standard patterns, normalize from day one)

### Phase 4: Search Enhancement and Discovery
**Rationale:** Query expansion and discovery search build on top of the recommend infrastructure (Phase 2) and cross-reference data (Phase 3). These are refinement features that improve an already-working system.
**Delivers:** Query expansion with legal synonym dictionary, discovery search (positive/negative examples), multi-hop MCP prompts chaining search + citation traversal, PDF export
**Uses:** QueryExpander service, Qdrant DiscoverQuery/ContextQuery, @react-pdf/renderer
**Implements:** QueryExpander service, DiscoveryMode UI, MCP tool extensions
**Avoids:** Pitfall 4 (query drift -- start with conservative abbreviation-only expansion, measure before broadening)

### Phase 5: Polish and Optimization
**Rationale:** Refactoring existing components to use the design system, responsive design, and accessibility are important but should not block feature delivery. These are best done after all features are in place.
**Delivers:** Existing components refactored to use design system primitives, responsive design improvements, accessibility audit (WCAG), grouped recommendations (Recommend + Groups combined), semantic chunking improvements
**Addresses:** Technical debt, visual consistency, mobile usability

### Phase Ordering Rationale

- **Snapshots before everything** because every subsequent phase modifies the collection, and there is currently no backup mechanism
- **Core search features before cross-references** because they deliver immediate user value with simpler Qdrant API patterns, while cross-references require a complex data pipeline and re-indexing
- **Cross-references before query expansion** because the data model (indexing pipeline) must be right before optimizing search-time behavior
- **Polish last** because visual consistency matters but must not block feature delivery; progressive enhancement keeps the app usable throughout

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Cross-References):** Citation regex patterns need iterative discovery and testing against real law text. The `german-legal-reference-parser` patterns should be adapted, not blindly copied. Allocate time for a manual annotation sample of 50+ paragraphs to measure extraction recall.
- **Phase 4 (Query Expansion):** Legal synonym dictionaries do not exist off-the-shelf. Building the initial dictionary requires domain expertise. Consider LLM-assisted generation of the synonym map.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** Qdrant snapshot, quantization, and indexing APIs are thoroughly documented with verified examples.
- **Phase 2 (Core Search):** Qdrant recommend, grouping, and scroll APIs have complete documentation and working code samples in research. shadcn/ui installation is well-documented for the exact stack (React 19 + Vite + Tailwind v4).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All Qdrant APIs verified against v1.13.x docs; shadcn/ui officially supports React 19 + TailwindCSS 4; qdrant-client compatibility confirmed |
| Features | MEDIUM-HIGH | Table stakes validated against Beck-online/Juris/dejure.org feature sets; TENJI study supports citation graph value; anti-features list is well-reasoned |
| Architecture | HIGH | Extends existing patterns (QdrantStore, REST API, component structure); payload-based citation storage validated for scale (~200K edges over ~50K nodes); no new Docker services |
| Pitfalls | MEDIUM-HIGH | Qdrant API pitfalls verified via official docs and GitHub issues; citation parsing complexity validated via `german-legal-reference-parser` project; query drift supported by TU Munich research; frontend risk confirmed by zero-test codebase |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Citation extraction recall:** No benchmark exists yet. The regex patterns are theoretical until tested against real law text from the indexed corpus. Plan a manual annotation exercise early in Phase 3.
- **py-openthesaurus rate limits:** 60 req/min may be insufficient under load. Need to evaluate local MySQL dump of OpenThesaurus for offline use, or aggressive caching strategy.
- **react-force-graph-2d React 19 compatibility:** Listed as MEDIUM confidence in stack research. The library is a thin wrapper so likely works, but needs verification during Phase 3 implementation.
- **Frontend smoke tests:** No testing infrastructure exists. Phase 1 or Phase 2 should include adding a basic test setup (Vitest + Testing Library or Playwright) before the redesign work in later phases.
- **Reranking interaction with grouped results:** The decision to skip reranking on grouped results is a performance trade-off. May need user feedback to validate that RRF-only ordering within groups is acceptable quality.

## Sources

### Primary (HIGH confidence)
- [Qdrant v1.13.x Query Points API](https://api.qdrant.tech/v-1-13-x/api-reference/search/query-points) -- query types, prefetch/fusion
- [Qdrant v1.13.x Query Points Groups API](https://api.qdrant.tech/v-1-13-x/api-reference/search/query-points-groups) -- grouping parameters
- [Qdrant v1.13.x Scroll Points API](https://api.qdrant.tech/v-1-13-x/api-reference/points/scroll-points) -- cursor-based pagination
- [Qdrant Quantization Docs](https://qdrant.tech/articles/what-is-vector-quantization/) -- scalar quantization config
- [Qdrant Snapshot Docs](https://qdrant.tech/documentation/database-tutorials/create-snapshot/) -- create/restore API
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite) -- React 19 + TailwindCSS 4 setup
- [qdrant-client on PyPI](https://pypi.org/project/qdrant-client/) -- v1.17.1, full API parity

### Secondary (MEDIUM confidence)
- [Qdrant GitHub Issue #5397](https://github.com/qdrant/qdrant/issues/5397) -- search_groups hybrid limitation confirmed
- [TENJI: Human-Centered Legal Knowledge Graph (ACM CIKM 2025)](https://dl.acm.org/doi/10.1145/3746252.3761003) -- graph interfaces doubled retrieval performance
- [german-legal-reference-parser (GitHub)](https://github.com/lavis-nlp/german-legal-reference-parser) -- citation pattern reference (library itself rejected as dependency)
- [py-openthesaurus on PyPI](https://pypi.org/project/py-openthesaurus/) -- German synonyms
- [react-force-graph (GitHub)](https://github.com/vasturiano/react-force-graph) -- Canvas-based graph rendering
- [TU Munich: German Legal IR Query Expansion](https://wwwmatthes.in.tum.de/pages/p6wat10sn8sc/German-Legal-Information-Retrieval-Query-Expansion-with-Word-Embeddings) -- query expansion pitfalls

### Tertiary (LOW confidence)
- [Beck-Noxtua Datenbasis](https://www.beck-noxtua.de/datenbasis/) -- competitive validation that semantic legal search is market direction
- [Juristische Datenbanken Vergleich](https://www.juristischedatenbanken.de/marktuebersicht/) -- market overview

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*

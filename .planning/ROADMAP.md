# Roadmap: Paragraf v2 -- Volles Qdrant-Potenzial

## Overview

This milestone unlocks the full potential of the Qdrant vector database and transforms the Paragraf frontend into a professional legal research tool. The journey starts with safety infrastructure (snapshots, quantization), builds core search capabilities (recommend, grouping, pagination, full-text), adds the cross-reference pipeline that makes law interconnections visible, enhances search quality (query expansion, semantic chunking), and delivers polished UI for every feature. Each phase delivers a coherent, verifiable capability that builds on the previous.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Snapshot Safety Net** - Backup/restore and scalar quantization before any collection modifications
- [ ] **Phase 2: Search Indexes & Full-Text** - Full-text index, range filters, and keyword search backend
- [ ] **Phase 3: Design System Foundation** - Design tokens, primitives, and consistent visual language
- [ ] **Phase 4: Recommend & Pagination** - Similar paragraphs, paginated results, batch search, and MCP tools
- [ ] **Phase 5: Grouping & Discovery API** - Grouped results, discovery search, and grouped recommendations
- [x] **Phase 6: Cross-Reference Pipeline** - Citation extraction, re-indexing, citation network API (completed 2026-03-27)
- [ ] **Phase 7: Query Expansion & Chunking** - Legal synonym expansion, multi-hop MCP, semantic chunking
- [ ] **Phase 8: Search Results UX** - Recommend button, grouped view, filters, compare, pagination, full-text toggle
- [ ] **Phase 9: Cross-Reference & Discovery UX** - Clickable citation links, interactive graph, discovery mode UI
- [x] **Phase 10: Dashboard, Export & Polish** - Snapshot management, PDF/Markdown export, accessibility, responsive polish (completed 2026-03-28)
- [ ] **Phase 11: Frontend API Wiring** - Wire all backend-only endpoints into frontend API client and add UI surfaces (gap closure)
- [ ] **Phase 12: Search UX Polish** - Fix broken interactive elements, add missing click handlers and expansion toggle (gap closure)
- [ ] **Phase 13: Tracking Artifact Cleanup** - Fix stale checkboxes, progress table, and SUMMARY frontmatter (gap closure)

## Phase Details

### Phase 1: Snapshot Safety Net
**Goal**: The system has a reliable backup/restore mechanism and optimized vector storage, enabling all subsequent collection modifications to proceed safely
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, MCP-06
**Success Criteria** (what must be TRUE):
  1. User can create a Qdrant collection snapshot via API and MCP tool before any re-indexing
  2. User can restore a collection from a snapshot, returning the database to its prior state
  3. Scalar quantization is active on dense vectors, reducing memory usage without degrading search quality
  4. Claude Desktop/Code can create and restore snapshots via the `paragraf_snapshot` MCP tool
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- QdrantStore snapshot/quantization methods, config, Docker volume, unit tests
- [ ] 01-02-PLAN.md -- REST endpoints, MCP tool, auto-snapshot hooks, quantization startup

### Phase 2: Search Indexes & Full-Text
**Goal**: The Qdrant collection has optimized indexes for exact text matching and numeric filtering, and the backend exposes full-text keyword search alongside semantic search
**Depends on**: Phase 1
**Requirements**: INFRA-03, INFRA-04, SRCH-06
**Success Criteria** (what must be TRUE):
  1. Full-text index exists on the `text` payload field, enabling exact keyword matching
  2. Payload range filter on the `absatz` field allows numeric range queries (e.g., paragraphs 1-10)
  3. Backend exposes a full-text search endpoint that returns results based on exact keyword matches
  4. Full-text search can be toggled independently of semantic search via API parameter
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Models, QdrantStore service methods (fulltext_search, index creation, range filter), unit tests
- [x] 02-02-PLAN.md -- REST endpoint branching, migration endpoint, MCP tool extension (suchmodus, absatz range)

### Phase 3: Design System Foundation
**Goal**: The frontend has a consistent design token system and reusable primitive components that all subsequent UI work builds upon
**Depends on**: Phase 1
**Requirements**: UI-01
**Success Criteria** (what must be TRUE):
  1. Design tokens for colors, spacing, typography, and shadows are defined in Tailwind CSS 4 configuration
  2. A set of primitive UI components (Button, Card, Input, Badge, Dialog) exists and follows the token system
  3. At least one existing page (e.g., SearchPage) uses the new primitives without visual regression
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md -- Design tokens, dependencies, cn() utility, vitest setup, Button/Card/Input/Badge primitives
- [x] 03-02-PLAN.md -- Radix primitives (Dialog/Select/Tooltip/Tabs), SearchPage + Sidebar migration

### Phase 4: Recommend & Pagination
**Goal**: Users can find similar paragraphs to any given result and navigate large result sets with pagination, while MCP tools expose these capabilities to Claude
**Depends on**: Phase 2
**Requirements**: SRCH-01, SRCH-04, SRCH-08, MCP-01, MCP-05
**Success Criteria** (what must be TRUE):
  1. Backend returns similar paragraphs for a given point ID using Qdrant Recommend API via `query_points`
  2. Search results support cursor-based pagination with configurable page size via Scroll API
  3. Batch search endpoint accepts multiple queries and returns results in parallel
  4. MCP tool `paragraf_similar` returns similar paragraphs for a given paragraph
  5. All MCP search tools accept `abschnitt` (section) filter parameter
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Settings, Pydantic models, QdrantStore service methods (recommend, scroll_search, _resolve_point_id), unit tests
- [x] 04-02-PLAN.md -- REST endpoints (/api/recommend, /api/search/batch, cursor in /api/search), docker-compose ENV vars
- [x] 04-03-PLAN.md -- MCP tool paragraf_similar, cursor in paragraf_search, unit tests

### Phase 5: Grouping & Discovery API
**Goal**: Search results can be grouped by law/legal area and users can perform explorative search with positive/negative examples via the Discovery API
**Depends on**: Phase 4
**Requirements**: SRCH-02, SRCH-03, SRCH-05, MCP-02, MCP-07
**Success Criteria** (what must be TRUE):
  1. Backend returns search results grouped by `gesetz` field using `query_points_groups` (not legacy `search_groups`)
  2. Discovery API endpoint accepts positive and negative example point IDs and returns exploratory results
  3. Recommendations can be returned grouped by law (Recommend + Groups combined)
  4. MCP tool `paragraf_discover` enables explorative search with positive/negative examples
  5. MCP tool `paragraf_grouped_search` returns results grouped by law
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md -- Settings, Pydantic models, QdrantStore service methods (discover, grouped_search, grouped_recommend), unit tests
- [x] 05-02-PLAN.md -- REST endpoints (/api/discover, /api/search/grouped, /api/recommend/grouped), docker-compose ENV vars
- [x] 05-03-PLAN.md -- MCP tools paragraf_discover, paragraf_grouped_search, paragraf_similar_grouped, unit tests

### Phase 6: Cross-Reference Pipeline
**Goal**: The system extracts legal cross-references from paragraph text, stores them as structured payload, and exposes a citation network API for navigating between referencing and referenced norms
**Depends on**: Phase 1 (snapshots for safe re-indexing), Phase 2 (indexes)
**Requirements**: XREF-01, XREF-02, XREF-03, XREF-04, MCP-03
**Success Criteria** (what must be TRUE):
  1. Regex-based extractor identifies standard German legal citations (SS X Abs. Y GESETZ, i.V.m., etc.) from paragraph text
  2. Extracted cross-references are stored as structured arrays in Qdrant payload (`references_out` field) after re-indexing
  3. Citation network API returns both outgoing references (what a paragraph cites) and incoming references (what cites this paragraph)
  4. MCP tool `paragraf_references` returns cross-references for a given paragraph
  5. Re-indexing is performed safely using snapshot backup/restore from Phase 1
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md -- Reference model, CrossReferenceExtractor service with regex extraction, unit tests
- [x] 06-02-PLAN.md -- QdrantStore reference methods, REST endpoints, Pydantic API models, docker-compose ENV
- [x] 06-03-PLAN.md -- MCP tool paragraf_references, server registration, unit tests

### Phase 7: Query Expansion & Chunking
**Goal**: Search recall is improved through conservative legal synonym expansion and smarter paragraph segmentation, with multi-hop MCP prompts combining search and citation traversal
**Depends on**: Phase 6 (cross-references for multi-hop), Phase 4 (search infrastructure)
**Requirements**: SRCH-07, MCP-04, CHUNK-01, CHUNK-02
**Success Criteria** (what must be TRUE):
  1. Query expansion appends legal abbreviation expansions and core synonyms to search queries (e.g., "GdB" expands to include "Grad der Behinderung")
  2. Expansion is toggleable and visible to users (they see what was expanded)
  3. Multi-hop MCP prompt chains paragraph search with citation traversal to answer complex legal questions
  4. Parser chunks long paragraphs at legal structure boundaries (Absatz, Satz, Nummer) instead of arbitrary token limits
  5. Collection is re-indexed with improved chunking (after snapshot backup)
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md -- QueryExpander service, curated synonym dictionary, config settings, unit tests
- [x] 07-02-PLAN.md -- Parser Satz-level chunking at legal structure boundaries, config thresholds, unit tests
- [x] 07-03-PLAN.md -- MultiHopService, REST integration (expand in search, multi-hop endpoint), MCP prompts, docker-compose ENV

### Phase 8: Search Results UX
**Goal**: Users interact with search results through a polished interface with recommend buttons, grouped views, advanced filters, inline comparison, pagination controls, and full-text search toggle
**Depends on**: Phase 3 (design system), Phase 4 (recommend/pagination backend), Phase 5 (grouping backend)
**Requirements**: UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE):
  1. Each result card has an "Aehnliche Paragraphen" button that loads similar paragraphs inline
  2. Search results can be toggled between flat list and grouped-by-law view
  3. A filter sidebar/panel allows filtering by Abschnitt, Chunk-Typ, and Absatz-Range
  4. User can add results directly to comparison view from search results (onCompare wired)
  5. Pagination controls appear at bottom of search results with page navigation
  6. Full-text search toggle is available in the search bar alongside semantic search
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 08-01-PLAN.md -- API client extensions, CompareContext, SearchModeToggle, FilterPanel, FilterChips
- [x] 08-02-PLAN.md -- MiniCard, RecommendSection, ResultCard recommend button + compare wiring
- [x] 08-03-PLAN.md -- ViewToggle, GroupedResults, LoadMoreButton, SearchPage + SearchBar full integration

### Phase 9: Cross-Reference & Discovery UX
**Goal**: Users can visually explore the citation network between laws and perform discovery searches with positive/negative example selection
**Depends on**: Phase 3 (design system), Phase 6 (cross-reference data), Phase 5 (discovery backend)
**Requirements**: XREF-05, XREF-06, UI-08, UI-10
**Success Criteria** (what must be TRUE):
  1. Cross-references in paragraph text are rendered as clickable links that navigate to the referenced norm
  2. An interactive force-directed citation graph shows relationships between paragraphs/laws with clickable nodes
  3. The citation graph visualization matches the design system tokens and is readable at various zoom levels
  4. Discovery search UI allows selecting positive and negative examples via checkbox or drag-and-drop to refine explorative search
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 09-01-PLAN.md -- API client extensions, citation parser, CitationLink/CitationTooltip, LookupPage rendering, Sidebar+App graph route
- [x] 09-02-PLAN.md -- d3-force graph-utils, GraphCanvas, GraphSidePanel, GraphLegend, GraphPage with dual-level toggle
- [x] 09-03-PLAN.md -- DiscoveryExampleBar, UndoSnackbar, SearchModeToggle extension, ResultCard +/- buttons, SearchPage discovery integration
- [x] 09-04-PLAN.md -- Gap closure: Fix graph node labels, edge rendering, and side panel click (Gaps 1-3)
- [x] 09-05-PLAN.md -- Gap closure: Fix discovery API call, UndoSnackbar, dark mode chip contrast (Gaps 4-6)

### Phase 10: Dashboard, Export & Polish
**Goal**: The application is feature-complete with snapshot management in the dashboard, document export, responsive design, and accessibility compliance
**Depends on**: Phase 3 (design system), Phase 8 (search UX), Phase 9 (cross-ref UX)
**Requirements**: INFRA-05, UI-09, UI-11, UI-12
**Success Criteria** (what must be TRUE):
  1. Index dashboard includes snapshot management: create snapshot, view status, restore from snapshot
  2. Users can export search results and comparisons as PDF or Markdown documents
  3. Application meets WCAG 2.1 AA accessibility standards (keyboard navigation, screen reader support, contrast ratios)
  4. Application is usable on tablet-sized screens with no layout breakage or hidden content
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 10-01-PLAN.md -- Snapshot API client, relative-time utility, SnapshotSection/SnapshotCard components, IndexPage integration
- [x] 10-02-PLAN.md -- jsPDF install, unified ExportData types, PDF/Markdown generation, ExportDropdown/ExportButton components
- [x] 10-03-PLAN.md -- Responsive sidebar hamburger, export integration into all pages, WCAG 2.1 AA accessibility polish

### Phase 11: Frontend API Wiring
**Goal**: All backend endpoints that currently have no frontend consumer are wired into the API client with minimal UI surfaces, closing the integration gap between backend and web UI
**Depends on**: Phase 8 (search UX), Phase 9 (cross-ref UX), Phase 10 (dashboard)
**Requirements**: XREF-01, XREF-02, XREF-03, CHUNK-02, MCP-04, SRCH-05, SRCH-08
**Gap Closure**: Closes integration gaps 1, 2, 4, 5, 6 from milestone audit
**Success Criteria** (what must be TRUE):
  1. `api.ts` exposes `multiHop()`, `recommendGrouped()`, `searchBatch()` methods
  2. Multi-hop search has a UI surface in the frontend (tab, mode, or dedicated section)
  3. `/api/references/extract` is triggered automatically from IndexPage after indexing completes
  4. `_result_to_item()` propagates `references_out` from chunk metadata to `SearchResultItem`
**UI hint**: yes

Plans: 2 plans

Plans:
- [x] 11-01-PLAN.md -- Backend references_out fix + frontend API client wiring (4 new methods)
- [ ] 11-02-PLAN.md -- Multi-hop search UI surface + auto reference extraction trigger

### Phase 12: Search UX Polish
**Goal**: All interactive elements in search results work correctly — citation deep-links, compare badge clicks, and query expansion opt-out are functional
**Depends on**: Phase 11
**Requirements**: XREF-05, UI-05, SRCH-07
**Gap Closure**: Closes integration gaps 3, 7 and minor UX items from milestone audit
**Success Criteria** (what must be TRUE):
  1. ResultCard "Zitationen" button navigates to GraphPage (onGraphNavigate passed from SearchPage)
  2. Compare counter badge in SearchPage has onClick handler navigating to ComparePage
  3. Query expansion toggle UI allows users to disable expansion per search
  4. Filter announcement includes filtered result count for screen readers
**UI hint**: yes

Plans: (to be created via `/gsd:plan-phase 12`)

### Phase 13: Tracking Artifact Cleanup
**Goal**: All planning artifacts accurately reflect the completed state of the milestone — no stale checkboxes, progress entries, or missing frontmatter
**Depends on**: Phase 12
**Requirements**: MCP-06
**Gap Closure**: Closes all tracking/documentation gaps from milestone audit
**Success Criteria** (what must be TRUE):
  1. MCP-06 checkbox in REQUIREMENTS.md is `[x]` and traceability shows `Complete`
  2. All SUMMARY frontmatter `requirements_completed` fields are populated (07-03, 09-04, 09-05, 10-02, 10-03)
  3. ROADMAP.md progress table reflects actual completion state of all phases

Plans: (to be created via `/gsd:plan-phase 13`)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Snapshot Safety Net | 2/2 | Complete | 2026-03-27 |
| 2. Search Indexes & Full-Text | 2/2 | Complete | 2026-03-27 |
| 3. Design System Foundation | 2/2 | Complete | 2026-03-27 |
| 4. Recommend & Pagination | 3/3 | Complete | 2026-03-27 |
| 5. Grouping & Discovery API | 3/3 | Complete | 2026-03-27 |
| 6. Cross-Reference Pipeline | 3/3 | Complete | 2026-03-27 |
| 7. Query Expansion & Chunking | 3/3 | Complete | 2026-03-27 |
| 8. Search Results UX | 3/3 | Complete | 2026-03-27 |
| 9. Cross-Reference & Discovery UX | 5/5 | Complete | 2026-03-28 |
| 10. Dashboard, Export & Polish | 3/3 | Complete | 2026-03-28 |
| 11. Frontend API Wiring | 1/2 | In Progress|  |
| 12. Search UX Polish | 0/0 | Not started | - |
| 13. Tracking Artifact Cleanup | 0/0 | Not started | - |

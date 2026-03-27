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
- [ ] **Phase 6: Cross-Reference Pipeline** - Citation extraction, re-indexing, citation network API
- [ ] **Phase 7: Query Expansion & Chunking** - Legal synonym expansion, multi-hop MCP, semantic chunking
- [ ] **Phase 8: Search Results UX** - Recommend button, grouped view, filters, compare, pagination, full-text toggle
- [ ] **Phase 9: Cross-Reference & Discovery UX** - Clickable citation links, interactive graph, discovery mode UI
- [ ] **Phase 10: Dashboard, Export & Polish** - Snapshot management, PDF/Markdown export, accessibility, responsive polish

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
- [ ] 02-02-PLAN.md -- REST endpoint branching, migration endpoint, MCP tool extension (suchmodus, absatz range)

### Phase 3: Design System Foundation
**Goal**: The frontend has a consistent design token system and reusable primitive components that all subsequent UI work builds upon
**Depends on**: Phase 1
**Requirements**: UI-01
**Success Criteria** (what must be TRUE):
  1. Design tokens for colors, spacing, typography, and shadows are defined in Tailwind CSS 4 configuration
  2. A set of primitive UI components (Button, Card, Input, Badge, Dialog) exists and follows the token system
  3. At least one existing page (e.g., SearchPage) uses the new primitives without visual regression
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

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
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

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
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

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
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

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
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: Cross-Reference & Discovery UX
**Goal**: Users can visually explore the citation network between laws and perform discovery searches with positive/negative example selection
**Depends on**: Phase 3 (design system), Phase 6 (cross-reference data), Phase 5 (discovery backend)
**Requirements**: XREF-05, XREF-06, UI-08, UI-10
**Success Criteria** (what must be TRUE):
  1. Cross-references in paragraph text are rendered as clickable links that navigate to the referenced norm
  2. An interactive force-directed citation graph shows relationships between paragraphs/laws with clickable nodes
  3. The citation graph visualization matches the design system tokens and is readable at various zoom levels
  4. Discovery search UI allows selecting positive and negative examples via checkbox or drag-and-drop to refine explorative search
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD
- [ ] 09-03: TBD

### Phase 10: Dashboard, Export & Polish
**Goal**: The application is feature-complete with snapshot management in the dashboard, document export, responsive design, and accessibility compliance
**Depends on**: Phase 3 (design system), Phase 8 (search UX), Phase 9 (cross-ref UX)
**Requirements**: INFRA-05, UI-09, UI-11, UI-12
**Success Criteria** (what must be TRUE):
  1. Index dashboard includes snapshot management: create snapshot, view status, restore from snapshot
  2. Users can export search results and comparisons as PDF or Markdown documents
  3. Application meets WCAG 2.1 AA accessibility standards (keyboard navigation, screen reader support, contrast ratios)
  4. Application is usable on tablet-sized screens with no layout breakage or hidden content
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD
- [ ] 10-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Snapshot Safety Net | 1/2 | In Progress|  |
| 2. Search Indexes & Full-Text | 0/2 | Not started | - |
| 3. Design System Foundation | 0/2 | Not started | - |
| 4. Recommend & Pagination | 0/3 | Not started | - |
| 5. Grouping & Discovery API | 0/3 | Not started | - |
| 6. Cross-Reference Pipeline | 0/3 | Not started | - |
| 7. Query Expansion & Chunking | 0/3 | Not started | - |
| 8. Search Results UX | 0/3 | Not started | - |
| 9. Cross-Reference & Discovery UX | 0/3 | Not started | - |
| 10. Dashboard, Export & Polish | 0/3 | Not started | - |

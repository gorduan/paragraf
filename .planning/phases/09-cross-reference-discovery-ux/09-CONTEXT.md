# Phase 9: Cross-Reference & Discovery UX - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can visually explore the citation network between laws and perform discovery searches with positive/negative example selection. Purely frontend phase — all backend endpoints exist (Phase 5: `/api/discover`, Phase 6: `/api/references/{gesetz}/{paragraph}`). Delivers: clickable citation links in paragraph text, interactive force-directed citation graph, and discovery search mode in SearchPage.

Requirements: XREF-05 (Klickbare Querverweis-Links), XREF-06 (Interaktive Zitationsgraph-Visualisierung), UI-08 (Zitationsgraph), UI-10 (Discovery-Suche UI)

</domain>

<decisions>
## Implementation Decisions

### Clickable Citation Links
- **D-01:** Hover preview + click navigation. Hovering a citation shows a truncated excerpt (~3 lines / ~150 chars) in a Radix Tooltip/Popover. Clicking navigates to LookupPage pre-filled with that paragraph. "Mehr lesen" link in tooltip for full navigation.
- **D-02:** Subtle highlight styling with icon. Light background highlight on citation text + small icon (Claude picks from lucide-react). Not standard underlined link — visually distinct.
- **D-03:** Reference context labels shown inline. Small tag next to the citation link showing "i.V.m.", "gemaess", "nach" etc. from Phase 6's `kontext` field.
- **D-04:** Unverified citations (laws not in LAW_REGISTRY) are clickable with warning. Click shows "Dieses Gesetz ist nicht indexiert" message instead of navigation.
- **D-05:** Citations in hover previews are also clickable (recursive navigation). User can follow citation chains via nested tooltips.

### Citation Graph Visualization
- **D-06:** Dual-level graph with toggle. Start at law-level (each node = a law like "SGB IX"), click a law node to expand into its paragraph-level nodes. Toggle to switch between levels.
- **D-07:** Full interaction: pan + zoom + click + drag nodes. Nodes are draggable to rearrange the force-directed layout.
- **D-08:** Canvas rendering with d3-force. d3-force for physics simulation + HTML5 Canvas for performance. Handles large graphs well.
- **D-09:** Directed arrows color-coded by reference context. i.V.m. / gemaess / nach / etc. each get a distinct color. Legend explains the color mapping.
- **D-10:** Side panel on node click. Clicking a graph node opens a detail panel showing paragraph text, outgoing/incoming reference counts, and link to LookupPage. Graph remains visible alongside.

### Discovery Search UI
- **D-11:** Checkboxes on ResultCards for +/- selection. User performs a normal search, marks results as positive (green +) or negative (red -) examples, then clicks "Entdecken" button.
- **D-12:** Discovery as mode within SearchPage. Add "Entdecken" to the existing Semantisch/Volltext/Hybrid toggle (SearchModeToggle component). No separate page. Toggle within SearchPage only — no Sidebar entry.
- **D-13:** Selected examples shown as compact chips/pills above results. Green chips for positive ("+ § 5 SGB IX"), red for negative ("- § 12 BGB"). Removable with X. "Entdecken" button at the end. Reuses filter chips pattern from Phase 8.
- **D-14:** Discovery results replace current search results. Clear mental model: examples in -> results out. Back/reset restores previous search state.

### Navigation & Integration
- **D-15:** Dedicated GraphPage accessible via new "Zitationsgraph" Sidebar entry. Icon: Network or GitBranch from lucide-react.
- **D-16:** Graph reachable via "Zitationen" button on ResultCard. Opens GraphPage centered on that paragraph.
- **D-17:** No separate Sidebar entry for discovery — it's a search mode toggle within SearchPage.

### Claude's Discretion
- Exact icon choice for citation links (from lucide-react)
- d3-force configuration parameters (charge strength, link distance, collision radius)
- Color palette for edge context types (must fit design system tokens)
- Canvas rendering details (anti-aliasing, node shapes, text rendering)
- GraphPage layout (graph area vs side panel proportions)
- Responsive behavior of graph on smaller screens
- Exact discovery mode toggle placement relative to existing SearchModeToggle
- Animation/transition when switching between law-level and paragraph-level graph
- How many nodes to show initially before progressive loading

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Endpoints (already implemented)
- `backend/src/paragraf/api.py` — `/api/references/{gesetz}/{paragraph}` (L1521) returns outgoing + incoming refs with context; `/api/discover` (L621) for discovery search
- `backend/src/paragraf/api_models.py` — `ReferenceNetworkResponse`, `DiscoverRequest`, `DiscoverResponse` Pydantic models
- `backend/src/paragraf/services/qdrant_store.py` — `get_outgoing_references()`, `get_incoming_references()`, `count_incoming_references()`, `discover()` methods

### Frontend Components (extend/integrate)
- `frontend/src/pages/SearchPage.tsx` — Main integration point for discovery mode toggle + example selection
- `frontend/src/components/ResultCard.tsx` — Needs +/- checkboxes for discovery + "Zitationen" graph button
- `frontend/src/components/SearchModeToggle.tsx` — Extend with "Entdecken" mode option
- `frontend/src/components/FilterChips.tsx` — Pattern to reuse for discovery example chips
- `frontend/src/components/MiniCard.tsx` — Pattern reference for compact paragraph displays
- `frontend/src/pages/LookupPage.tsx` — Citation link click target; needs citation rendering in paragraph text

### UI Primitives (Phase 3)
- `frontend/src/components/ui/` — Button, Badge, Card, Tooltip, Dialog, Tabs — all with variant support

### API Client
- `frontend/src/lib/api.ts` — Needs new `discover()` and `references()` methods

### Sidebar
- `frontend/src/components/Sidebar.tsx` — Needs new "Zitationsgraph" entry

### Prior Phase Context
- `.planning/phases/05-grouping-discovery-api/05-CONTEXT.md` — Discovery API design (dual-input, positive/negative examples)
- `.planning/phases/06-cross-reference-pipeline/06-CONTEXT.md` — Cross-reference payload structure, citation context types
- `.planning/phases/08-search-results-ux/08-CONTEXT.md` — ResultCard patterns, filter chips, MiniCards

### Models
- `backend/src/paragraf/models/law.py` — `ChunkMetadata` with `references_out` field, reference object structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FilterChips component:** Reusable for discovery example pills (green/red chips with X to remove)
- **ResultCard:** Already has expand pattern, onCompare prop, Recommend button — add +/- discovery checkboxes + graph button
- **SearchModeToggle:** 3-way Semantisch/Volltext/Hybrid toggle — extend to 4-way with Entdecken
- **MiniCard:** Compact paragraph display — reuse pattern in graph side panel
- **Radix Tooltip:** Already installed (Phase 3) — use for citation hover previews
- **useApi hook:** Generic request lifecycle — use for references and discover API calls
- **localStorage pattern:** Bookmarks, search history, dark mode, view mode — reuse for graph preferences

### Established Patterns
- **Inline expansion:** ResultCard expand + RecommendSection pattern — similar approach for citation previews
- **Filter chips:** Removable chips with "Alle zuruecksetzen" — reuse for discovery example bar
- **API client namespace:** `api.search()`, `api.recommend()` — add `api.discover()`, `api.references()`
- **Sidebar navigation:** Existing page routing pattern for new GraphPage

### Integration Points
- **SearchPage.tsx:** Discovery mode toggle + example selection state + example chips bar
- **ResultCard.tsx:** +/- checkboxes for discovery + "Zitationen" button for graph
- **api.ts:** New `discover()` and `references()` methods
- **Sidebar.tsx:** New "Zitationsgraph" nav entry
- **App.tsx:** New route for GraphPage
- **LookupPage.tsx:** Citation link rendering in paragraph text display
- **New components:** CitationLink, CitationTooltip, GraphPage, GraphCanvas, GraphSidePanel, DiscoveryExampleBar

</code_context>

<specifics>
## Specific Ideas

- Citation links should be subtle (highlight + icon), NOT standard underlined links — visually distinct from regular hyperlinks
- Reference context labels (i.V.m., gemaess) shown as small inline tags next to citations — gives legal context
- Citations in hover previews must also be clickable for recursive chain navigation
- Graph starts at law-level, expands to paragraph-level on click — dual-level with toggle
- Graph edges color-coded by reference context type — needs legend
- Discovery uses familiar chip/pill pattern from Phase 8 filter chips, just colored green/red
- Unverified citations still clickable but show warning message instead of navigation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-cross-reference-discovery-ux*
*Context gathered: 2026-03-27*

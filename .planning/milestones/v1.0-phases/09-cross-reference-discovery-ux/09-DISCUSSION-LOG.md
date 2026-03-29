# Phase 9: Cross-Reference & Discovery UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 09-cross-reference-discovery-ux
**Areas discussed:** Clickable citation links, Citation graph visualization, Discovery search UI, Navigation & integration

---

## Clickable Citation Links

### Link Action

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to LookupPage | Clicking navigates to existing LookupPage pre-filled with paragraph | |
| Inline preview tooltip | Hover/click shows referenced paragraph in tooltip/popover | |
| Both — hover preview + click navigates | Hover shows tooltip preview, click navigates to LookupPage | ✓ |

**User's choice:** Both — hover preview + click navigates
**Notes:** None

### Link Style

| Option | Description | Selected |
|--------|-------------|----------|
| Colored underlined link | Standard link style with primary/indigo color and underline | |
| Subtle highlight with icon | Light background highlight + small link icon | ✓ |
| Badge/pill style | Citation wrapped in small rounded badge | |

**User's choice:** Subtle highlight with icon
**Notes:** None

### Unverified Citations

| Option | Description | Selected |
|--------|-------------|----------|
| Show as styled text, not clickable | Dashed underline, gray — visible but not navigable | |
| Hide completely | Render as plain text | |
| Clickable with warning | Clickable but shows "Gesetz nicht indexiert" message | ✓ |

**User's choice:** Clickable with warning
**Notes:** None

### Preview Size

| Option | Description | Selected |
|--------|-------------|----------|
| Truncated excerpt (~3 lines) | First ~150 chars with "Mehr lesen" link | ✓ |
| Full paragraph text | Complete text in larger popover | |
| You decide | Claude picks | |

**User's choice:** Truncated excerpt (~3 lines)
**Notes:** None

### Context Tag

| Option | Description | Selected |
|--------|-------------|----------|
| Show as small label next to link | Tiny tag like "i.V.m." or "gemaess" next to citation | ✓ |
| Show only in hover tooltip | Context label only in preview tooltip | |
| Don't show context | Just the citation link | |

**User's choice:** Show as small label next to link
**Notes:** None

### Nested Refs in Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — citations in previews are also clickable | Full recursive navigation via nested tooltips | ✓ |
| No — preview is text-only | Plain text preview, navigate for full citations | |

**User's choice:** Yes — citations in previews are also clickable
**Notes:** None

### Icon

| Option | Description | Selected |
|--------|-------------|----------|
| Small arrow/external-link icon | Tiny lucide-react icon after citation text | |
| Paragraph symbol icon | Small § icon for legal context | |
| You decide | Claude picks best icon | ✓ |

**User's choice:** You decide
**Notes:** Claude picks from lucide-react

---

## Citation Graph Visualization

### Graph Level

| Option | Description | Selected |
|--------|-------------|----------|
| Paragraph-level nodes | Each node is a specific paragraph | |
| Law-level nodes | Each node is a law | |
| Both with toggle | Start at law-level, expand into paragraphs on click | ✓ |

**User's choice:** Both with toggle
**Notes:** None

### Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Pan + zoom + click nodes | Standard graph interaction | |
| Pan + zoom + click + drag nodes | Full interaction with draggable nodes | ✓ |
| Static with click only | No pan/zoom | |

**User's choice:** Pan + zoom + click + drag nodes
**Notes:** None

### Node Click

| Option | Description | Selected |
|--------|-------------|----------|
| Side panel with paragraph details | Detail panel alongside graph | ✓ |
| Navigate to LookupPage | Direct navigation, leaves graph | |
| Expand connections | Progressive disclosure in graph | |

**User's choice:** Side panel with paragraph details
**Notes:** None

### Graph Library

| Option | Description | Selected |
|--------|-------------|----------|
| Canvas with d3-force | d3-force physics + Canvas rendering | ✓ |
| SVG with d3-force | d3-force physics + SVG rendering | |
| vis.js Network | Higher-level graph library | |
| You decide | Claude picks | |

**User's choice:** Canvas with d3-force
**Notes:** None

### Edge Style

| Option | Description | Selected |
|--------|-------------|----------|
| Arrows with context color | Directed arrows color-coded by reference context | ✓ |
| Simple arrows, one color | All edges same color | |
| You decide | Claude picks | |

**User's choice:** Arrows with context color
**Notes:** None

---

## Discovery Search UI

### Selection Method

| Option | Description | Selected |
|--------|-------------|----------|
| Checkboxes on ResultCards | +/- checkboxes on existing ResultCards | ✓ |
| Drag-and-drop zones | Two zones for dragging results | |
| Dedicated search + pick flow | Step-by-step guided flow | |

**User's choice:** Checkboxes on ResultCards
**Notes:** None

### Location

| Option | Description | Selected |
|--------|-------------|----------|
| Mode within SearchPage | Add "Entdecken" to existing toggle | ✓ |
| Dedicated DiscoveryPage | New page in Sidebar | |
| Floating panel/drawer | Slide-out panel overlay | |

**User's choice:** Mode within SearchPage
**Notes:** None

### Results Display

| Option | Description | Selected |
|--------|-------------|----------|
| Replace search results | Discovery results replace current results | ✓ |
| Show in separate section below | Both visible in sections | |
| Side-by-side comparison | Original left, discovery right | |

**User's choice:** Replace search results
**Notes:** None

### Examples Bar

| Option | Description | Selected |
|--------|-------------|----------|
| Compact chips/pills | Green/red chips with X, "Entdecken" button | ✓ |
| Mini-cards in two rows | Two labeled rows with mini-card entries | |
| You decide | Claude picks | |

**User's choice:** Compact chips/pills
**Notes:** Reuses filter chips pattern from Phase 8

---

## Navigation & Integration

### Graph Page Location

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated GraphPage in Sidebar | New "Zitationsgraph" Sidebar entry | ✓ |
| Panel within LookupPage | Collapsible panel on LookupPage | |
| Modal/Dialog overlay | Full-screen modal over any page | |

**User's choice:** Dedicated GraphPage in Sidebar
**Notes:** None

### Entry Points

| Option | Description | Selected |
|--------|-------------|----------|
| Button on ResultCard | "Zitationen" button on each ResultCard | ✓ |
| Button on LookupPage | Button on paragraph detail view | |
| Button on citation links | Graph icon next to citation links | |
| Sidebar nav only | Only via Sidebar manual entry | |

**User's choice:** Button on ResultCard
**Notes:** None

### Sidebar Entry

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — new "Zitationsgraph" entry | New Sidebar item with Network/GitBranch icon | ✓ |
| No — only via buttons | Graph as detail view, not primary page | |

**User's choice:** Yes — new "Zitationsgraph" entry
**Notes:** None

### Discovery Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle within SearchPage only | Discovery is a search mode, no Sidebar entry | ✓ |
| Own Sidebar entry | New "Entdecken" in Sidebar | |

**User's choice:** Toggle within SearchPage only
**Notes:** None

---

## Claude's Discretion

- Icon choice for citation links (lucide-react)
- d3-force configuration parameters
- Color palette for edge context types
- Canvas rendering details
- GraphPage layout proportions
- Responsive graph behavior
- Discovery toggle placement
- Graph level transition animations
- Initial node count before progressive loading

## Deferred Ideas

None — discussion stayed within phase scope.

# Phase 9: Cross-Reference & Discovery UX - Research

**Researched:** 2026-03-27
**Domain:** Frontend — React 19, d3-force graph visualization, citation link parsing, discovery search UX
**Confidence:** HIGH

## Summary

Phase 9 is a purely frontend phase that builds three distinct feature areas on top of existing backend endpoints: (1) clickable citation links in paragraph text with hover previews, (2) an interactive force-directed citation graph page using d3-force + HTML5 Canvas, and (3) a discovery search mode integrated into SearchPage with positive/negative example selection.

All backend APIs are already implemented. The `/api/references/{gesetz}/{paragraph}` endpoint returns outgoing + incoming references with context labels. The `/api/discover` endpoint accepts `positive_paragraphs` and `negative_paragraphs` as `{gesetz, paragraph}` pairs, eliminating the need for point IDs in the frontend. The main technical challenge is the Canvas-based graph visualization with d3-force physics simulation, which requires careful Canvas API management in React 19.

**Primary recommendation:** Use d3-force 3.x for physics only (not d3-dom), render with native Canvas 2D API, and keep all graph state in React refs to avoid re-render loops. For citations, parse paragraph text with regex matching `references_out` data and replace with CitationLink components. For discovery, extend SearchPage state with example arrays and use the existing `positive_paragraphs`/`negative_paragraphs` API fields.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Hover preview + click navigation for citation links. Radix Tooltip/Popover with truncated excerpt (~150 chars). Click navigates to LookupPage.
- D-02: Subtle highlight styling with icon (not standard underlined links). Light background + small lucide-react icon.
- D-03: Reference context labels shown inline as small tags (i.V.m., gemaess, nach, etc.)
- D-04: Unverified citations clickable with warning message instead of navigation.
- D-05: Citations in hover previews also clickable (recursive navigation via nested tooltips).
- D-06: Dual-level graph with toggle: law-level (each node = a law) with drill-down to paragraph-level.
- D-07: Full interaction: pan + zoom + click + drag nodes in force-directed layout.
- D-08: Canvas rendering with d3-force. d3-force for physics, HTML5 Canvas for rendering.
- D-09: Directed arrows color-coded by reference context (i.V.m./gemaess/nach/siehe/null).
- D-10: Side panel on node click (320px width) with paragraph details and LookupPage link.
- D-11: Checkboxes on ResultCards for +/- selection in discovery mode.
- D-12: Discovery as mode within SearchPage — 4th segment in SearchModeToggle. No separate page, no Sidebar entry.
- D-13: Selected examples shown as compact chips/pills above results (green/red). Reuses FilterChips pattern.
- D-14: Discovery results replace current search results. Reset restores previous state.
- D-15: Dedicated GraphPage accessible via new "Zitationsgraph" Sidebar entry.
- D-16: "Zitationen" button on ResultCard opens GraphPage centered on that paragraph.
- D-17: No separate Sidebar entry for discovery.

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

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XREF-05 | Klickbare Querverweis-Links in der Paragraphen-Anzeige | CitationLink component parses `references_out` from paragraph metadata; Radix Tooltip for hover previews; LookupPage navigation on click |
| XREF-06 | Interaktive Zitationsgraph-Visualisierung (gerichteter Graph) | GraphPage with d3-force 3.x physics + Canvas rendering; dual-level (law/paragraph); pan/zoom/drag/click interactions |
| UI-08 | Zitationsgraph-Visualisierung (interaktiv, klickbar) | Same as XREF-06 — GraphCanvas component with full interaction contract per UI-SPEC |
| UI-10 | Discovery-Suche UI: Positiv/Negativ-Beispiele per Checkbox | SearchModeToggle extended to 4 segments; +/- buttons on ResultCard; DiscoveryExampleBar with chips; api.discover() using positive_paragraphs/negative_paragraphs |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3-force | 3.0.0 | Force-directed graph physics simulation | Industry standard for force layout. Only the force module needed, not full d3. |
| @types/d3-force | 3.0.10 | TypeScript definitions for d3-force | DefinitelyTyped package for type safety |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-tooltip | ^1.2.8 | Citation hover preview | Already installed. Use for CitationTooltip with custom content. |
| lucide-react | ^0.460.0 | Icons | Already installed. ExternalLink for citations, Network for graph, ThumbsUp/ThumbsDown for discovery. |
| class-variance-authority | ^0.7.1 | Component variants | Already installed. Used by Button, Badge. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-force + Canvas | react-force-graph-2d | Heavier (full d3 bundle), less control over Canvas rendering, harder to match design tokens |
| d3-force + Canvas | vis-network | Very heavy (~300KB), jQuery-era API, hard to integrate with React state |
| d3-force + Canvas | cytoscape.js | Powerful but overkill for this use case (~500KB), complex API |
| Raw Canvas | SVG rendering | Poor performance beyond ~100 nodes; Canvas is correct for this graph size |

**Installation:**
```bash
cd frontend && npm install d3-force @types/d3-force
```

**Version verification:** d3-force 3.0.0 (latest, stable). @types/d3-force 3.0.10 (latest). Both verified against npm registry 2026-03-27.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── CitationLink.tsx        # Inline citation span with highlight + icon + context label
│   ├── CitationTooltip.tsx     # Radix Tooltip/Popover with excerpt preview
│   ├── GraphCanvas.tsx         # HTML5 Canvas + d3-force simulation controller
│   ├── GraphSidePanel.tsx      # Detail panel on node click (paragraph text, counts, link)
│   ├── GraphLegend.tsx         # Color legend overlay for edge context types
│   ├── DiscoveryExampleBar.tsx # Compact chip bar for selected examples + "Entdecken" button
│   ├── UndoSnackbar.tsx        # Temporary bottom snackbar with undo action
│   └── SearchModeToggle.tsx    # MODIFIED: extend from 3 to 4 segments
├── pages/
│   ├── GraphPage.tsx           # New page: dual-level graph + side panel
│   ├── SearchPage.tsx          # MODIFIED: discovery mode state + example selection
│   └── LookupPage.tsx          # MODIFIED: render text through CitationLink parser
├── lib/
│   ├── api.ts                  # MODIFIED: add discover() + references() methods
│   ├── citation-parser.ts      # NEW: regex-based citation detection in paragraph text
│   └── graph-utils.ts          # NEW: d3-force setup, Canvas rendering helpers
```

### Pattern 1: d3-force with React + Canvas (D-08)
**What:** Use d3-force purely for physics simulation, keep simulation state in React refs, render with Canvas 2D API in requestAnimationFrame loop.
**When to use:** Always for the graph visualization.
**Example:**
```typescript
// graph-utils.ts
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: "law" | "paragraph";
  refCount: number;
  gesetz: string;
  paragraph?: string;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  kontext: string | null; // "i.V.m." | "gemaess" | "nach" | "siehe" | null
}

export function createSimulation(nodes: GraphNode[], links: GraphLink[], width: number, height: number) {
  return forceSimulation(nodes)
    .force("link", forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(80))
    .force("charge", forceManyBody().strength(-200))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide<GraphNode>().radius(d => nodeRadius(d) + 5));
}
```

```typescript
// GraphCanvas.tsx — Canvas rendering in React
import { useRef, useEffect, useCallback } from "react";

export function GraphCanvas({ nodes, links, onNodeClick, ... }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation | null>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 }); // pan + zoom state

  useEffect(() => {
    const sim = createSimulation(nodes, links, width, height);
    simRef.current = sim;

    sim.on("tick", () => {
      drawFrame(canvasRef.current!, nodes, links, transformRef.current);
    });

    return () => { sim.stop(); };
  }, [nodes, links]);

  // Canvas mouse events for pan, zoom, drag, click...
}
```

### Pattern 2: Citation Text Parsing
**What:** Parse paragraph text against `references_out` metadata to find and replace citation strings with CitationLink components.
**When to use:** In LookupPage and ResultCard expanded text.
**Example:**
```typescript
// citation-parser.ts
import type { ReferenceItem } from "@/lib/api";

interface ParsedSegment {
  type: "text" | "citation";
  content: string;
  reference?: ReferenceItem;
}

export function parseCitations(text: string, references: ReferenceItem[]): ParsedSegment[] {
  // Sort references by raw string length descending (longest match first)
  // Find each reference.raw in the text and split into segments
  // Return array of text and citation segments for rendering
}
```

### Pattern 3: Discovery Mode State Management (D-11 through D-14)
**What:** Extend SearchPage with discovery state: selected examples, previous results snapshot, and mode-aware search execution.
**When to use:** When discovery mode is active in SearchPage.
**Example:**
```typescript
// In SearchPage.tsx
interface DiscoveryExample {
  paragraph: string;
  gesetz: string;
  titel: string;
  polarity: "positive" | "negative";
}

const [discoveryExamples, setDiscoveryExamples] = useState<DiscoveryExample[]>([]);
const [previousResults, setPreviousResults] = useState<SearchResultItem[] | null>(null);
// When user clicks "Entdecken": save current results, call api.discover(), show new results
// When user clicks "Zuruecksetzen": restore previousResults, clear examples, show UndoSnackbar
```

### Pattern 4: API Client Extension
**What:** Add `discover()` and `references()` methods to the `api` namespace.
**When to use:** For all new API calls in this phase.
**Example:**
```typescript
// In api.ts — new types and methods
export interface DiscoverRequest {
  positive_paragraphs: { gesetz: string; paragraph: string }[];
  negative_paragraphs?: { gesetz: string; paragraph: string }[];
  limit?: number;
  gesetzbuch?: string | null;
}

export interface ReferenceItem {
  gesetz: string;
  paragraph: string;
  absatz: number | null;
  raw: string;
  verified: boolean;
  kontext: string | null;
}

export interface IncomingReferenceItem {
  gesetz: string;
  paragraph: string;
  chunk_id: string;
  text_preview: string;
}

export interface ReferenceNetworkResponse {
  gesetz: string;
  paragraph: string;
  outgoing: ReferenceItem[];
  incoming: IncomingReferenceItem[];
  incoming_count: number;
}

// api object extensions:
discover: (body: DiscoverRequest) =>
  fetchJson<DiscoverResponse>("/api/discover", {
    method: "POST",
    body: JSON.stringify(body),
  }),

references: (gesetz: string, paragraph: string) =>
  fetchJson<ReferenceNetworkResponse>(
    `/api/references/${encodeURIComponent(gesetz)}/${encodeURIComponent(paragraph)}`
  ),
```

### Anti-Patterns to Avoid
- **Using d3 for DOM manipulation in React:** d3-select/d3-dom fights React's virtual DOM. Only use d3-force for math, render with Canvas or React.
- **SVG for large graphs:** SVG DOM nodes become slow beyond ~100 elements. Canvas is mandatory per D-08.
- **Re-rendering Canvas on React state changes:** Keep simulation data in refs. Only trigger Canvas redraw via requestAnimationFrame, not via React render cycles.
- **Fetching point IDs for discovery:** The backend accepts `positive_paragraphs` / `negative_paragraphs` as `{gesetz, paragraph}` objects. No need to fetch or store Qdrant UUIDs.
- **Full graph preload:** Do not fetch the entire citation network at once. Use progressive loading (first 50 nodes per D-10 in UI-SPEC).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip positioning | Custom absolute-positioning tooltip | Radix Tooltip (already installed) | Handles viewport collision, animations, accessibility (aria-describedby), portal rendering |
| Force-directed layout math | Custom spring/charge physics | d3-force `forceSimulation` | Decades of optimization, stable convergence, configurable forces |
| Canvas pan/zoom matrix | Manual transform tracking | Standard affine transform pattern (translate + scale) | Well-known pattern, handles coordinate conversion correctly |
| Citation text parsing | Character-by-character parser | Regex with sorted reference strings | References are pre-extracted by Phase 6; just match `raw` strings in text |
| Undo mechanism | Custom undo stack | Simple snapshot pattern (save previous state, restore on undo) | Only one level of undo needed (discovery reset), no complex undo tree |

**Key insight:** d3-force does ALL the physics; Canvas does ALL the rendering; React manages ALL the state. Keep these three concerns strictly separated.

## Common Pitfalls

### Pitfall 1: Canvas DPI Scaling (Blurry Text)
**What goes wrong:** Canvas renders blurry on high-DPI displays (Retina).
**Why it happens:** Canvas element dimensions and CSS dimensions differ from `devicePixelRatio`.
**How to avoid:** Set canvas width/height to `clientWidth * dpr` / `clientHeight * dpr`, then scale context by dpr. Set CSS width/height to logical dimensions.
**Warning signs:** Fuzzy node labels and edges on macOS or mobile devices.
```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
canvas.style.width = `${rect.width}px`;
canvas.style.height = `${rect.height}px`;
ctx.scale(dpr, dpr);
```

### Pitfall 2: d3-force Simulation Never Stops
**What goes wrong:** CPU stays high after graph stabilizes because simulation keeps ticking.
**Why it happens:** Default alpha decay is slow; simulation events fire continuously.
**How to avoid:** Listen for `sim.on("end", ...)` and stop the requestAnimationFrame loop. Or set `alphaDecay(0.02)` for faster cooling.
**Warning signs:** Fan noise, battery drain, DevTools shows high CPU.

### Pitfall 3: Canvas Click Detection Without DOM
**What goes wrong:** Cannot use standard event delegation for node clicks on Canvas.
**Why it happens:** Canvas is a single DOM element; individual shapes have no events.
**How to avoid:** On click, compute canvas coordinates (accounting for transform), iterate nodes, check distance to each node center. Use a spatial index if > 500 nodes.
**Warning signs:** Clicks miss nodes, or wrong node selected.
```typescript
function findNodeAtPoint(x: number, y: number, nodes: GraphNode[], transform: Transform): GraphNode | null {
  const canvasX = (x - transform.x) / transform.k;
  const canvasY = (y - transform.y) / transform.k;
  for (const node of nodes) {
    const dx = canvasX - (node.x ?? 0);
    const dy = canvasY - (node.y ?? 0);
    if (Math.sqrt(dx * dx + dy * dy) <= nodeRadius(node)) return node;
  }
  return null;
}
```

### Pitfall 4: No Backend Endpoint for Full Graph Data
**What goes wrong:** GraphPage needs the full citation network, but `/api/references/{gesetz}/{paragraph}` only returns refs for ONE paragraph.
**Why it happens:** Phase 6 built per-paragraph reference queries, not a global graph endpoint.
**How to avoid:** Build the graph incrementally. For law-level: use `/api/laws` to get all indexed laws, then for each visible law, query references to build edges. For paragraph-level drill-down: query that law's structure + references. Cache aggressively. Consider a new backend endpoint in a future phase if performance is insufficient — for now, parallel fetching with Promise.all is adequate for ~95 laws.
**Warning signs:** Graph takes >5s to load, excessive API calls.

### Pitfall 5: SearchModeToggle Type Widening
**What goes wrong:** Adding "discover" to the search mode type breaks existing type constraints.
**Why it happens:** `SearchMode` type is `"semantic" | "fulltext" | "hybrid_fulltext"` — adding "discover" changes the type union throughout SearchPage.
**How to avoid:** Keep discovery as a separate boolean state (`isDiscoveryMode`), not as a 4th search_type. The SearchModeToggle visually shows 4 segments, but the underlying search type remains the 3 existing ones. Discovery mode is an orthogonal concept — it uses `api.discover()` instead of `api.search()`.
**Warning signs:** Type errors throughout SearchPage, or SearchBar receiving invalid search_type.

### Pitfall 6: Citation Parsing Edge Cases
**What goes wrong:** Citation regex matches partial text incorrectly or misses citations.
**Why it happens:** Reference `raw` strings may overlap, or the same text appears in different contexts.
**How to avoid:** Sort references by `raw` string length descending (longest first). Use exact string matching against `references_out[].raw` rather than building new regex. The backend already extracted the exact citation strings.
**Warning signs:** Wrong citations highlighted, duplicate highlights, broken text flow.

### Pitfall 7: Radix Tooltip Inside Canvas
**What goes wrong:** Attempting to use Radix Tooltip for Canvas node hovers.
**Why it happens:** Canvas nodes are not DOM elements — Radix Tooltip requires a DOM trigger.
**How to avoid:** For Canvas graph node hovers, use a plain `<div>` absolutely positioned over the canvas based on mouse coordinates. Reserve Radix Tooltip for inline citation links (which ARE DOM elements).
**Warning signs:** Tooltip never appears on graph hover, or appears at wrong position.

### Pitfall 8: Discovery Mode Memory Leak
**What goes wrong:** Previous search results and undo snapshots accumulate in memory.
**Why it happens:** Storing multiple snapshots without cleanup.
**How to avoid:** Only store ONE previous results snapshot. Clear it when switching modes or after undo timeout (5s).
**Warning signs:** Growing memory usage in DevTools after many discovery iterations.

## Code Examples

### Canvas Arrow Drawing (for directed graph edges)
```typescript
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number, toY: number,
  targetRadius: number,
  color: string,
  width: number = 1.5,
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const endX = toX - targetRadius * Math.cos(angle);
  const endY = toY - targetRadius * Math.sin(angle);

  // Line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();

  // Arrowhead (8px per UI-SPEC)
  const headLen = 8;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLen * Math.cos(angle - Math.PI / 6),
    endY - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    endX - headLen * Math.cos(angle + Math.PI / 6),
    endY - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
```

### Edge Color Mapping (from UI-SPEC)
```typescript
const EDGE_COLORS = {
  light: {
    "i.V.m.": "#6366f1",  // primary-500
    "gemaess": "#22c55e",  // success-500
    "nach": "#f59e0b",     // warning-500
    "siehe": "#64748b",    // neutral-500
    null: "#cbd5e1",       // neutral-300
  },
  dark: {
    "i.V.m.": "#818cf8",  // primary-400
    "gemaess": "#4ade80",  // success-400
    "nach": "#fbbf24",     // warning-400
    "siehe": "#94a3b8",    // neutral-400
    null: "#94a3b8",       // neutral-400
  },
} as const;
```

### Graph Data Building Strategy
```typescript
// For law-level graph: build from per-law reference queries
async function buildLawLevelGraph(laws: LawInfo[]): Promise<{ nodes: GraphNode[], links: GraphLink[] }> {
  const nodes: GraphNode[] = laws.map(law => ({
    id: law.abkuerzung,
    label: law.abkuerzung,
    type: "law" as const,
    refCount: 0,
    gesetz: law.abkuerzung,
  }));

  // Fetch structure for each law to find paragraphs with references
  // Then aggregate edges at law level: "SGB IX" -> "BGB" if any paragraph in SGB IX references BGB
  // Progressive: start with first N laws, load more on demand
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| d3 v3-v5 with SVG DOM manipulation | d3-force v3 (force-only) + Canvas | d3 v6+ (2020) modularized | Import only `d3-force`, not full `d3` (~500KB savings) |
| Full d3 bundle import | Tree-shakeable ES module imports | d3 v6 | `import { forceSimulation } from "d3-force"` not `import * as d3 from "d3"` |
| React class components for Canvas | useRef + useEffect + requestAnimationFrame | React 16.8+ Hooks | Cleaner lifecycle management, no class boilerplate |

**Deprecated/outdated:**
- `d3.select().append()` DOM manipulation in React: fights the virtual DOM, use Canvas API directly
- `react-vis-force` / `react-graph-vis`: abandoned or not maintained for React 19

## Open Questions

1. **Graph Data Loading Strategy**
   - What we know: Per-paragraph reference endpoint exists. No global graph endpoint.
   - What's unclear: Whether parallel per-law requests for ~95 laws is fast enough for initial graph load.
   - Recommendation: Start with parallel Promise.all for all indexed laws' structures. Cache results. If too slow, add a backend `/api/graph/laws` endpoint in a follow-up. The progressive loading (50 nodes first per UI-SPEC) mitigates this.

2. **Citation Text Not Containing `raw` String Exactly**
   - What we know: Phase 6 extracts `raw` citation text from the original paragraph text.
   - What's unclear: Whether the `raw` string always appears verbatim in the chunk `text` field (text may be truncated for absatz/satz chunks).
   - Recommendation: Use `String.indexOf(reference.raw)` for matching. If raw is not found in text, skip that citation. Do not re-implement regex extraction in the frontend.

3. **LookupPage Text Rendering for Citations**
   - What we know: LookupPage currently renders text in a `<pre>` tag. Citations need to be interactive elements.
   - What's unclear: Whether switching from `<pre>` to a parsed component breaks the whitespace-preserving layout.
   - Recommendation: Use a wrapper component that splits text into segments, renders each as either plain text (in `<span>` with `whitespace-pre-wrap`) or CitationLink. Preserve the `font-sans leading-relaxed` styling.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XREF-05 | Citation parser segments text correctly | unit | `cd frontend && npx vitest run src/lib/citation-parser.test.ts -x` | Wave 0 |
| XREF-05 | CitationLink renders with correct ARIA | unit | `cd frontend && npx vitest run src/components/__tests__/CitationLink.test.tsx -x` | Wave 0 |
| XREF-06 | Graph node/link data structures build correctly | unit | `cd frontend && npx vitest run src/lib/graph-utils.test.ts -x` | Wave 0 |
| XREF-06 | GraphCanvas renders without crash | unit | `cd frontend && npx vitest run src/components/__tests__/GraphCanvas.test.tsx -x` | Wave 0 |
| UI-08 | GraphPage renders with sidebar entry | unit | `cd frontend && npx vitest run src/pages/__tests__/GraphPage.test.tsx -x` | Wave 0 |
| UI-10 | Discovery example bar shows/removes chips | unit | `cd frontend && npx vitest run src/components/__tests__/DiscoveryExampleBar.test.tsx -x` | Wave 0 |
| UI-10 | Discovery API types match backend contract | unit | `cd frontend && npx vitest run src/lib/api.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/lib/citation-parser.test.ts` -- covers XREF-05 (text parsing logic)
- [ ] `frontend/src/lib/graph-utils.test.ts` -- covers XREF-06 (node/link data building)
- [ ] `frontend/src/components/__tests__/CitationLink.test.tsx` -- covers XREF-05 (component rendering)
- [ ] `frontend/src/components/__tests__/DiscoveryExampleBar.test.tsx` -- covers UI-10 (chip interactions)

## Project Constraints (from CLAUDE.md)

- **Branch:** All commits on branch "Docker-only", never on main/master
- **Tech Stack:** React 19 + Vite + TailwindCSS 4 (no new frameworks)
- **Language:** German UI text, German docstrings, English variable/function names
- **Accessibility:** role, aria-label, aria-live, keyboard navigation required (per CLAUDE.md conventions)
- **Icons:** lucide-react only
- **Component patterns:** cva + cn() as established in Phase 3
- **API fields:** German where user-facing (matches existing api.ts conventions)
- **Frontend entry:** No ESLint/Prettier; TypeScript strict mode only
- **State management:** React useState + Context only (no external state libraries)
- **Dark mode:** Must respect ThemeContext (existing pattern)

## Sources

### Primary (HIGH confidence)
- Backend source code: `api_models.py` (ReferenceNetworkResponse, DiscoverRequest/Response models)
- Backend source code: `api.py` (endpoint definitions and parameter handling)
- Frontend source code: All existing components (SearchPage, ResultCard, SearchModeToggle, FilterChips, Sidebar, App.tsx, LookupPage)
- 09-CONTEXT.md decisions (D-01 through D-17)
- 09-UI-SPEC.md (full interaction contracts, colors, typography, accessibility)

### Secondary (MEDIUM confidence)
- npm registry: d3-force 3.0.0, @types/d3-force 3.0.10 (version verified)
- d3-force API: forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide (well-established API, stable since v3)

### Tertiary (LOW confidence)
- Graph loading strategy for ~95 laws (parallel fetch performance untested — may need backend optimization)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - d3-force is the only addition, well-known stable library
- Architecture: HIGH - All patterns follow established React+Canvas conventions, backend APIs verified
- Pitfalls: HIGH - Common Canvas/d3/React integration issues well-documented

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable — no fast-moving dependencies)

---
phase: 09-cross-reference-discovery-ux
plan: 02
subsystem: ui
tags: [d3-force, canvas, graph, react, visualization]

requires:
  - phase: 09-01
    provides: "API types (ReferenceNetworkResponse), api.references(), graph route in Sidebar, CitationLink/Tooltip"
provides:
  - "Interactive force-directed citation graph (GraphPage) with d3-force + HTML5 Canvas"
  - "GraphCanvas component with pan/zoom/drag/click interaction"
  - "GraphSidePanel with reference counts and navigation"
  - "GraphLegend with 5 edge context colors, collapsible"
  - "graph-utils.ts: simulation factory, Canvas rendering, node hit-testing, law-level graph building"
affects: [09-03]

tech-stack:
  added: [d3-force, "@types/d3-force"]
  patterns: [Canvas DPI scaling, d3-force simulation lifecycle, progressive loading with visible subset]

key-files:
  created:
    - frontend/src/lib/graph-utils.ts
    - frontend/src/lib/graph-utils.test.ts
    - frontend/src/components/GraphCanvas.tsx
    - frontend/src/components/__tests__/GraphCanvas.test.tsx
    - frontend/src/components/GraphSidePanel.tsx
    - frontend/src/components/GraphLegend.tsx
    - frontend/src/pages/GraphPage.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/package.json

key-decisions:
  - "d3-force for physics simulation + native Canvas for rendering (no d3-selection/d3-zoom overhead)"
  - "Progressive loading: show first 50 nodes, load more on demand to handle large graphs"
  - "Law-level drill-down: clicking a law node transitions to paragraph-level view for that law"
  - "Canvas DPI scaling via devicePixelRatio for crisp rendering on Retina displays"

patterns-established:
  - "Canvas interaction pattern: mousedown/move/up for drag detection, separate click handler for taps"
  - "Transform-aware hit testing: findNodeAtPoint converts canvas coords through pan/zoom transform"
  - "Batched API fetching: batchedFetch helper processes parallel requests in groups of 10"

requirements-completed: [XREF-06, UI-08]

duration: 5min
completed: 2026-03-27
---

# Phase 9 Plan 02: Citation Graph Visualization Summary

**Interactive force-directed citation graph with d3-force physics, Canvas rendering, dual-level toggle, pan/zoom/drag, and color-coded directed edges**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T00:57:26Z
- **Completed:** 2026-03-28T01:03:00Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 10

## Accomplishments
- d3-force installed and graph-utils.ts providing simulation factory, Canvas draw functions, hit-testing, and law-level aggregation
- GraphCanvas component with full interaction: pan, zoom (0.3x-3x), node drag, click detection, DPI-aware rendering
- GraphPage with dual-level toggle (Gesetze/Paragraphen), progressive loading, empty/loading/error states
- GraphSidePanel showing reference counts, outgoing reference list, and "Im Detail anzeigen" navigation
- GraphLegend with 5 edge context colors (i.V.m./gemaess/nach/siehe/ohne Kontext), collapsible with localStorage persistence
- All 55 tests pass including 7 graph-utils tests and 3 GraphCanvas tests

## Task Commits

Each task was committed atomically:

1. **Task 1: graph-utils (TDD RED)** - `ec239df` (test)
2. **Task 1: graph-utils (TDD GREEN)** - `217aca0` (feat)
3. **Task 2: GraphCanvas, GraphSidePanel, GraphLegend, GraphPage** - `523c2ac` (feat)

## Files Created/Modified
- `frontend/package.json` - Added d3-force and @types/d3-force dependencies
- `frontend/src/lib/graph-utils.ts` - Simulation factory, Canvas rendering, types, constants
- `frontend/src/lib/graph-utils.test.ts` - 7 unit tests for graph utilities
- `frontend/src/components/GraphCanvas.tsx` - Canvas with d3-force, pan/zoom/drag/click
- `frontend/src/components/__tests__/GraphCanvas.test.tsx` - 3 tests for Canvas mount and ARIA
- `frontend/src/components/GraphSidePanel.tsx` - Node detail panel with reference data
- `frontend/src/components/GraphLegend.tsx` - Edge color legend, collapsible
- `frontend/src/pages/GraphPage.tsx` - Full page with dual-level toggle, progressive loading
- `frontend/src/App.tsx` - Replaced placeholder with real GraphPage import

## Decisions Made
- Used native Canvas API instead of d3-selection for rendering (simpler, less overhead)
- Progressive loading starts at 50 nodes, adds 50 on button click
- Law-level drill-down on single click (click law node transitions to paragraph-level)
- Batched API fetching (groups of 10) to avoid overwhelming backend

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all components are fully wired to API data sources.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Graph visualization complete, ready for human verification (Task 3 checkpoint)
- Plan 03 (Discovery Search UI) can proceed independently

---
*Phase: 09-cross-reference-discovery-ux*
*Completed: 2026-03-27*

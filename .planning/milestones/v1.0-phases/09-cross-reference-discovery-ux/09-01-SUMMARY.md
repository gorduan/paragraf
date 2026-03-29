---
phase: 09-cross-reference-discovery-ux
plan: 01
subsystem: ui
tags: [react, radix-tooltip, citation-parser, cross-references, typescript]

requires:
  - phase: 06-cross-references
    provides: "Backend /api/references endpoint and ReferenceItem model"
  - phase: 03-design-system
    provides: "Badge, Button UI components with cva+cn pattern"
provides:
  - "parseCitations() utility for splitting text into citation segments"
  - "CitationLink component with verified/unverified handling"
  - "CitationTooltip with depth-limited nested citations"
  - "api.references() and api.discover() API client methods"
  - "ReferenceItem, ReferenceNetworkResponse, DiscoverRequest/Response types"
  - "Graph page route placeholder and Sidebar entry"
affects: [09-02-PLAN, 09-03-PLAN]

tech-stack:
  added: []
  patterns: ["depth-limited recursive citation rendering (max 1 level)", "parseCitations longest-match-first segmentation"]

key-files:
  created:
    - frontend/src/lib/citation-parser.ts
    - frontend/src/lib/citation-parser.test.ts
    - frontend/src/components/CitationLink.tsx
    - frontend/src/components/CitationTooltip.tsx
    - frontend/src/components/__tests__/CitationLink.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/pages/LookupPage.tsx
    - frontend/src/components/ResultCard.tsx
    - frontend/src/components/Sidebar.tsx
    - frontend/src/App.tsx

key-decisions:
  - "Depth-limited nesting: CitationTooltip renders nested CitationLinks only at depth < 1, preventing infinite recursion"
  - "pendingLookup counter pattern for triggering re-lookup when citation navigation updates gesetz/paragraph state"
  - "Vitest assertions (toBeTruthy) instead of jest-dom matchers to avoid setup file dependency"

patterns-established:
  - "Citation parsing: parseCitations(text, refs) returns ParsedSegment[] with longest-match-first strategy"
  - "Citation rendering: CitationTooltip wraps CitationLink, depth prop controls nesting depth"

requirements-completed: [XREF-05]

duration: 7min
completed: 2026-03-27
---

# Phase 09 Plan 01: Cross-Reference Foundation Summary

**Citation parser, CitationLink/CitationTooltip components with depth-limited nested rendering, API types for references/discover, and graph route wiring**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T18:26:36Z
- **Completed:** 2026-03-27T18:33:44Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- TDD-built citation parser with 7 unit tests covering edge cases (empty, overlap, boundaries)
- CitationLink component with verified/unverified states, ARIA roles, keyboard accessibility, kontext badges
- CitationTooltip with Radix Tooltip integration, lazy fetch on hover, and depth-limited nested citation rendering (1 level deep per D-05)
- LookupPage now renders cross-references as interactive clickable links with tooltip previews
- API client extended with references() and discover() methods matching backend contract
- Sidebar "Zitationsgraph" entry and App.tsx graph route placeholder ready for Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: API types, citation parser, and unit tests** - `67cee75` (feat) [TDD: red -> green]
2. **Task 2: CitationLink, CitationTooltip, tests, LookupPage, ResultCard, Sidebar, App route** - `4425595` (feat)

## Files Created/Modified
- `frontend/src/lib/api.ts` - Added ReferenceItem, IncomingReferenceItem, ReferenceNetworkResponse, DiscoverRequest/Response types; references_out on SearchResultItem; references() and discover() API methods
- `frontend/src/lib/citation-parser.ts` - parseCitations() with longest-match-first segmentation strategy
- `frontend/src/lib/citation-parser.test.ts` - 7 unit tests for citation parser
- `frontend/src/components/CitationLink.tsx` - Inline citation span with highlight, icon, kontext badge, verified/unverified handling
- `frontend/src/components/CitationTooltip.tsx` - Radix Tooltip wrapper with lazy fetch, excerpt preview, nested CitationLinks (depth < 1)
- `frontend/src/components/__tests__/CitationLink.test.tsx` - 6 tests for ARIA, click, keyboard, kontext
- `frontend/src/pages/LookupPage.tsx` - Replaced <pre> text with parsed citation rendering; added references fetch
- `frontend/src/components/ResultCard.tsx` - Added "Zitationen" button with Network icon and onGraphNavigate prop
- `frontend/src/components/Sidebar.tsx` - Added "graph" to Page type, "Zitationsgraph" nav entry with shortcut 7
- `frontend/src/App.tsx` - Added graph route, GraphPage placeholder, keyboard shortcut 7->graph, 8->settings

## Decisions Made
- Used depth-limited nesting (depth < 1) for CitationTooltip to prevent infinite tooltip recursion while still allowing clickable citations in hover previews per D-05
- Used pendingLookup counter state to trigger re-lookup when navigating between citations in LookupPage
- Used vitest-native assertions (toBeTruthy, getAttribute) instead of jest-dom matchers to avoid adding setup file configuration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- CitationLink tests initially used jest-dom matchers (toBeInTheDocument) which are not configured in this project's vitest setup. Switched to native vitest assertions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Citation parser and CitationLink/CitationTooltip are ready for Plan 02 (GraphPage) and Plan 03 (discovery)
- Graph route placeholder in place for Plan 02 to implement full GraphPage
- api.discover() method ready for Plan 03 to wire discovery UI

---
*Phase: 09-cross-reference-discovery-ux*
*Completed: 2026-03-27*

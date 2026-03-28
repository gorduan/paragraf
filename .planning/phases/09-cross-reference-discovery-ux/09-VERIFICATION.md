---
status: gaps_found
phase: 09-cross-reference-discovery-ux
verified_by: human
verified_at: 2026-03-28
requirements: [XREF-05, XREF-06, UI-08, UI-10]
---

# Phase 09 Verification: Cross-Reference & Discovery UX

## Must-Have Verification

### XREF-05: Clickable Citation Links (Plan 09-01)
| Check | Status |
|-------|--------|
| CitationLink renders in paragraph text | PASS |
| CitationTooltip with nested citations | PASS (automated tests) |
| Sidebar "Zitationsgraph" entry | PASS |
| Graph route placeholder | PASS |
| API types match backend contract | PASS |
| Citation parser tests (7 tests) | PASS |
| CitationLink tests (6 tests) | PASS |

### XREF-06 / UI-08: Citation Graph (Plan 09-02)
| Check | Status |
|-------|--------|
| GraphPage loads via sidebar | PASS |
| Gesetze/Paragraphen toggle | PASS |
| Drill-down into paragraph level | PASS |
| Pan, zoom, drag | PASS |
| Legend with 5 entries, collapsible | PASS |
| Dark mode colors adapt | PASS |
| **Law-level nodes show labels** | **FAIL — shows "—" instead of law abbreviations** |
| **Edges/arrows between nodes visible** | **FAIL — no edges rendered** |
| **Side panel opens on node click** | **FAIL — no panel appears** |
| "Im Detail anzeigen" navigates | FAIL (blocked by side panel gap) |

### UI-10: Discovery Search Mode (Plan 09-03)
| Check | Status |
|-------|--------|
| "Entdecken" 4th segment in toggle | PASS |
| +/- buttons on ResultCards | PASS |
| Green/red chips in DiscoveryExampleBar | PASS |
| "Zuruecksetzen" clears selections | PASS |
| Mode switch clears selections | PASS |
| Max 5 per polarity enforced | NOT TESTED (insufficient results) |
| **api.discover() returns results** | **FAIL — "Entdeckungssuche fehlgeschlagen"** |
| **UndoSnackbar appears on reset** | **FAIL — no snackbar visible** |
| **Red chip readability in dark mode** | **FAIL — text barely visible** |

## Gaps

### Gap 1: Graph nodes show no labels at law level
- **Severity:** high
- **Plan:** 09-02
- **Detail:** Law-level nodes render as circles with "—" text instead of the law abbreviation (e.g., "SGB IX", "EStG"). The `buildLawLevelGraph` or data-fetching logic likely does not populate the `label` field correctly.

### Gap 2: No edges/arrows rendered in graph
- **Severity:** high
- **Plan:** 09-02
- **Detail:** No directed arrows appear between nodes at either law-level or paragraph-level. The `drawFrame` function may not be receiving links, or the link rendering path has a bug. This is the core visual feature of the citation graph.

### Gap 3: Side panel does not open on node click
- **Severity:** high
- **Plan:** 09-02
- **Detail:** Clicking a node does not open the GraphSidePanel. The `onNodeClick` callback from GraphCanvas may not be wired correctly, or `findNodeAtPoint` is not detecting the click target.

### Gap 4: Discovery API call fails
- **Severity:** high
- **Plan:** 09-03
- **Detail:** Clicking "Entdecken" button shows error "Entdeckungssuche fehlgeschlagen. Bitte versuchen Sie es erneut." The `api.discover()` POST to `/api/discover` returns an error. Could be a request format mismatch or backend endpoint issue.

### Gap 5: UndoSnackbar not appearing after reset
- **Severity:** medium
- **Plan:** 09-03
- **Detail:** After clicking "Zuruecksetzen", no snackbar appears at the bottom of the screen. The UndoSnackbar component may not be rendered or the `showUndo` state is not being set.

### Gap 6: Red chip text barely readable in dark mode
- **Severity:** low
- **Plan:** 09-03
- **Detail:** Negative (red) discovery chips have very low contrast text in dark mode. The `text-error-700 dark:text-error-300` styling needs adjustment for better readability.

## Human Verification Items

- [x] Citation graph loads and shows nodes
- [x] Pan/zoom/drag works
- [x] Level toggle works
- [x] Discovery mode toggle works
- [x] +/- buttons and chips work
- [x] Zuruecksetzen works
- [x] Mode switch clears state
- [ ] Graph edges visible (FAILED)
- [ ] Graph labels visible (FAILED)
- [ ] Side panel on click (FAILED)
- [ ] Discovery API succeeds (FAILED)
- [ ] Undo snackbar appears (FAILED)

## Score

**Must-haves verified:** 14/20 (70%)
**Critical gaps:** 4 (Gap 1-4)
**Non-critical gaps:** 2 (Gap 5-6)

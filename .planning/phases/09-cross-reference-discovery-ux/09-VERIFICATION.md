---
phase: 09-cross-reference-discovery-ux
verified: 2026-03-28T03:20:00Z
status: passed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 14/20
  gaps_closed:
    - "Law-level graph nodes display their law abbreviation as label text"
    - "Directed arrows with arrowheads are visible between connected nodes"
    - "Clicking a graph node opens the GraphSidePanel with node details"
    - "Discovery API call returns results or shows meaningful backend error message"
    - "UndoSnackbar appears at bottom-center after clicking 'Zuruecksetzen'"
    - "Negative discovery chips have readable text in dark mode"
  gaps_remaining: []
  regressions: []
---

# Phase 09: Cross-Reference & Discovery UX Verification Report

**Phase Goal:** Users can visually explore the citation network between laws and perform discovery searches with positive/negative example selection
**Verified:** 2026-03-28T03:20:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure via plans 09-04 and 09-05

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Law-level graph nodes display their law abbreviation as label text | VERIFIED | `buildLawLevelGraph` sets `label: lawId` (gesetz abbreviation); `drawFrame` calls `ctx.fillText(node.label, ...)` at line 251 |
| 2 | Directed arrows with arrowheads are visible between connected nodes | VERIFIED | `drawArrow` function draws line + triangle arrowhead; `drawFrame` iterates all links and calls `drawArrow`; law filter now uses `indexStatus()` so indexed laws produce real reference data |
| 3 | Clicking any graph node opens the GraphSidePanel | VERIFIED | `GraphCanvas` has no duplicate `onClick` handler; `handleMouseUp` calls `onNodeClick` when `movedRef.current` is false; `GraphPage.onNodeClick` calls `handleNodeClick` for all node types without conditional drill-down |
| 4 | Law nodes in side panel have "Paragraphen anzeigen" drill-down button | VERIFIED | `GraphSidePanel.tsx` line 146-156: renders `<Button>Paragraphen anzeigen</Button>` when `node.type === "law" && onDrillDown` |
| 5 | Paragraph nodes in side panel have "Im Detail anzeigen" navigation button | VERIFIED | `GraphSidePanel.tsx` line 160-170: renders `<Button>Im Detail anzeigen</Button>` when `node.paragraph` is set |
| 6 | Discovery API call returns results or shows meaningful backend error message | VERIFIED | `fetchJson` extracts `body.detail` from error responses; `handleExecuteDiscovery` shows backend error text via `err instanceof Error ? err.message` |
| 7 | UndoSnackbar appears after "Zuruecksetzen" and auto-dismisses after 5 seconds | VERIFIED | `UndoSnackbar` uses `useRef(onDismiss)` pattern; `useEffect` dependency is `[duration]` only — timer runs stably for full 5 seconds without resetting on parent re-renders |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/pages/GraphPage.tsx` | Fixed law filter, side panel wired | VERIFIED | Uses `api.indexStatus()` with `l.status === "indexiert" && l.chunks > 0`; `onNodeClick` calls `handleNodeClick` for all nodes; passes `onDrillDown={handleDrillDown}` to GraphSidePanel |
| `frontend/src/components/GraphCanvas.tsx` | Single click handler via handleMouseUp | VERIFIED | No `onClick` handler on canvas element; `handleMouseUp` handles all click detection via `dragRef` and `movedRef` |
| `frontend/src/components/GraphSidePanel.tsx` | onDrillDown prop, "Paragraphen anzeigen" button | VERIFIED | `onDrillDown?: (gesetz: string) => void` in interface; "Paragraphen anzeigen" button rendered for law nodes |
| `frontend/src/lib/api.ts` | fetchJson extracts error detail from response body | VERIFIED | `body.detail` extraction pattern at lines 296-300; `discover()` call at line 426-428 |
| `frontend/src/pages/SearchPage.tsx` | Discovery execution with proper error handling and useCallback wrappers | VERIFIED | `savedResults` pattern before try block; `setPreviousResults` only on success; `handleUndo` and `handleUndoDismiss` wrapped in `useCallback` |
| `frontend/src/components/UndoSnackbar.tsx` | useRef callback pattern, duration-only dependency | VERIFIED | `onDismissRef = useRef(onDismiss)` at line 17; `useEffect` depends only on `[duration]` at line 23 |
| `frontend/src/components/DiscoveryExampleBar.tsx` | dark:text-error-200 and dark:text-success-200 for chip contrast | VERIFIED | Line 52-53: `dark:text-success-200` and `dark:text-error-200` present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `GraphCanvas.tsx` | `GraphPage.tsx` | `onNodeClick` callback via `handleMouseUp` | WIRED | `handleMouseUp` calls `onNodeClick(dragRef.current.node)` when `!movedRef.current`; no competing `onClick` handler |
| `GraphPage.tsx` | `api.indexStatus()` | Law filter for graph data loading | WIRED | `api.indexStatus()` called in `loadLawLevelGraph`; `IndexStatusItem` imported and used |
| `GraphPage.tsx` | `GraphSidePanel.tsx` | `onDrillDown={handleDrillDown}` prop | WIRED | Prop passed at line 428; `handleDrillDown` calls `loadParagraphLevelGraph` |
| `SearchPage.tsx` | `/api/discover` | `api.discover()` POST call | WIRED | `api.discover()` called in `handleExecuteDiscovery`; `fetchJson` posts to `/api/discover` |
| `SearchPage.tsx` | `UndoSnackbar.tsx` | `showUndo` state controls rendering | WIRED | `{showUndo && <UndoSnackbar ... />}` at line 449; `handleDiscoveryReset` sets `setShowUndo(true)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `GraphPage.tsx` | `allNodes`, `allLinks` | `api.indexStatus()` -> `api.lawStructure()` -> `api.references()` -> `buildLawLevelGraph()` | Yes — filtered to only indexed laws with chunks > 0 | FLOWING |
| `GraphSidePanel.tsx` | `referenceData` | `api.references(node.gesetz, node.paragraph)` in `handleNodeClick` | Yes — real Qdrant reference lookup | FLOWING |
| `SearchPage.tsx` (discovery) | `results`, `total` | `api.discover()` POST to `/api/discover` | Yes — backend returns Qdrant results; errors show meaningful backend message | FLOWING |

### Behavioral Spot-Checks

| Behavior | Verification Method | Result | Status |
|----------|--------------------|--------|--------|
| All 55 frontend tests pass | `npx vitest run` | 10 test files, 55 tests passed in 7.88s | PASS |
| GraphPage uses indexStatus API (not laws API) | Grep `api.indexStatus` in GraphPage.tsx | Line 77: `api.indexStatus()` present | PASS |
| GraphCanvas has no duplicate onClick handler | Inspect canvas element JSX | Canvas element has `onMouseDown`, `onMouseMove`, `onMouseUp`, `onWheel` only — no `onClick` | PASS |
| UndoSnackbar useEffect depends only on duration | Read UndoSnackbar.tsx | Line 23: `}, [duration]);` — confirmed | PASS |
| fetchJson extracts body.detail | Grep in api.ts | Lines 297-299: `body.detail` extraction present | PASS |
| Chip dark mode contrast updated | Grep DiscoveryExampleBar.tsx | Lines 52-53: `dark:text-success-200` and `dark:text-error-200` present | PASS |
| All 4 fix commits exist in git history | `git log --oneline` | cefbf94, 65d2ca9, 61aa927, 86dbb95 all confirmed present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| XREF-05 | 09-01, 09-05 | Klickbare Querverweis-Links in der Paragraphen-Anzeige | SATISFIED | CitationLink renders in paragraph text; discovery API error handling improved in 09-05 |
| XREF-06 | 09-02, 09-04 | Interaktive Zitationsgraph-Visualisierung (gerichteter Graph) | SATISFIED | GraphCanvas with d3-force; directed arrows rendered; law filter fixed in 09-04 to use indexStatus API |
| UI-08 | 09-02, 09-04 | Zitationsgraph-Visualisierung (interaktiv, klickbar) | SATISFIED | Node click opens GraphSidePanel; drill-down button for law nodes; all fixed in 09-04 |
| UI-10 | 09-03, 09-05 | Discovery-Suche UI: Positiv/Negativ-Beispiele | SATISFIED | "Entdecken" mode toggle; +/- buttons on ResultCards; DiscoveryExampleBar; UndoSnackbar; dark mode contrast fixed in 09-05 |

All 4 requirements are marked as complete in REQUIREMENTS.md with no orphaned requirements.

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| None | — | — | No TODO/FIXME/placeholder patterns found in modified files. No empty return stubs detected. All data paths wired to real API calls. |

### Human Verification Required

The following behaviors require runtime testing with an indexed Qdrant database and cannot be verified statically:

#### 1. Graph Nodes Show Labels and Edges

**Test:** Load the app with at least 2 indexed laws that have cross-references. Navigate to the Zitationsgraph page.
**Expected:** Law-level nodes display abbreviation text (e.g., "SGB IX") inside circles. Directed arrows with arrowheads appear between connected nodes.
**Why human:** Depends on runtime Qdrant data. The code path is verified but graph rendering on canvas requires visual inspection.

#### 2. Node Click Opens Side Panel

**Test:** Click any node in the graph canvas.
**Expected:** The GraphSidePanel slides in on the right showing node type badge, reference counts, and action buttons.
**Why human:** Canvas click event handling requires browser interaction to verify.

#### 3. Discovery Search Returns Results

**Test:** Perform a search, mark one result with +, click "Entdecken".
**Expected:** New results appear that are semantically similar to the positive example. If the backend returns an error, the error message from the backend is shown (not a generic message).
**Why human:** Requires live backend with indexed data and functional Qdrant discover endpoint.

#### 4. UndoSnackbar Appears After Reset

**Test:** Add discovery examples, click "Zuruecksetzen".
**Expected:** A snackbar appears at the bottom center for 5 seconds with "Rueckgaengig" button. A progress bar shrinks over the 5 seconds. Clicking "Rueckgaengig" restores the examples.
**Why human:** Timer-based visual component requires browser interaction to verify timing stability.

### Re-Verification Summary

The original verification (2026-03-28) identified 6 gaps blocking goal achievement. Plans 09-04 and 09-05 were created to close those gaps.

**Gap closure results:**

- **Gap 1 (no labels):** Root cause was wrong law filter using response-level `total_chunks` instead of per-law `indexed` status. Fixed in 09-04 by switching to `api.indexStatus()` with `l.status === "indexiert" && l.chunks > 0`. The `buildLawLevelGraph` function correctly uses `lawId` as the node label — once real data flows, labels are populated.

- **Gap 2 (no edges):** Same root cause as Gap 1. The `drawFrame` function and `drawArrow` implementation were correct all along — they just had no links to render because the law filter produced empty reference data.

- **Gap 3 (side panel not opening):** Two bugs: (a) duplicate `onClick` + `handleMouseUp` click handlers creating a race condition, and (b) law-level clicks always triggering drill-down instead of opening the side panel. Fixed in 09-04 by removing the `onClick` handler entirely and making all single-clicks open the side panel, with drill-down moved to a "Paragraphen anzeigen" button in the side panel.

- **Gap 4 (discovery API failure):** The `fetchJson` function was not extracting error details from the response body, so users saw generic "API Fehler: 404" instead of the backend's "Paragraph X in Y nicht gefunden." message. Fixed in 09-05. Additionally, previous results are now preserved on failure and cleared only on success.

- **Gap 5 (UndoSnackbar not appearing):** The `onDismiss` callback was recreated on every render (not `useCallback`-wrapped), causing the `useEffect` in `UndoSnackbar` to reset the auto-dismiss timer on every re-render. Fixed in 09-05 using the `useRef` callback pattern and `[duration]`-only dependency, with `useCallback` wrappers on the parent handlers.

- **Gap 6 (dark mode chip contrast):** Changed from `dark:text-error-300` / `dark:text-success-300` to `dark:text-error-200` / `dark:text-success-200` for improved contrast on dark 900-level backgrounds.

All 7 derived must-haves are now VERIFIED at code level. Four items require human runtime testing with a live backend.

---

_Verified: 2026-03-28T03:20:00Z_
_Verifier: Claude (gsd-verifier) — Re-verification after gap closure_

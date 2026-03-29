---
phase: 11-frontend-api-wiring
verified: 2026-03-28T22:15:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
human_verification:
  - test: "Verweissuche mode renders hop badges with correct colors"
    expected: "Hop 0 shows blue 'Direkttreffer' badge, hop 1 shows amber '1. Verweis' badge, hop 2 shows green '2. Verweis' badge"
    why_human: "CSS class names reference custom Tailwind color tokens (warning-100, success-100) that cannot be visually verified programmatically"
  - test: "DepthSlider updates search depth on change"
    expected: "Moving the slider from 1 to 3 and submitting search sends tiefe: 3 in the multiHop request"
    why_human: "Requires browser interaction; state update from range input cannot be tested without running the app"
---

# Phase 11: Frontend API Wiring Verification Report

**Phase Goal:** All backend endpoints that currently have no frontend consumer are wired into the API client with minimal UI surfaces, closing the integration gap between backend and web UI
**Verified:** 2026-03-28T22:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `api.ts` exposes `multiHop()`, `recommendGrouped()`, `searchBatch()` methods | VERIFIED | Lines 561-583 of `frontend/src/lib/api.ts` contain all three methods with correct endpoint paths and typed request/response bodies |
| 2 | Multi-hop search has a UI surface in the frontend (tab, mode, or dedicated section) | VERIFIED | `SearchModeToggle.tsx` line 16 adds `{ value: "multi_hop", label: "Verweissuche" }` to MODES array; `SearchPage.tsx` renders `DepthSlider` and `HopResultList` when `searchMode === "multi_hop"` |
| 3 | `/api/references/extract` is triggered automatically from IndexPage after indexing completes | VERIFIED | `IndexPage.tsx` line 283 calls `api.extractReferences({ gesetz: null, full_reindex: false })` as fire-and-forget after `loadStatus()` in the queue-complete block; no `await` keyword found |
| 4 | `_result_to_item()` propagates `references_out` from chunk metadata to `SearchResultItem` | VERIFIED | `api.py` lines 228-252 map `meta.references_out` to `list[ReferenceItem]`, passing `references_out=refs_out` to the `SearchResultItem` constructor; `api_models.py` line 77 declares the field |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/paragraf/api_models.py` | SearchResultItem with references_out field | VERIFIED | `ReferenceItem` class defined at line 55, before `SearchResultItem` (line 66); `references_out: list[ReferenceItem] \| None` at line 77 |
| `backend/src/paragraf/api.py` | `_result_to_item` populating references_out | VERIFIED | Lines 228-252 conditionally build `refs_out` from `meta.references_out` and assign to `SearchResultItem` |
| `frontend/src/lib/api.ts` | 4 new API methods + TypeScript types | VERIFIED | 9 new interfaces (MultiHopRequest, HopResultItem, MultiHopResponse, BatchSearchRequest, BatchSearchResponse, GroupedRecommendRequest, GroupedRecommendResponse, ReferenceExtractRequest, ReferenceExtractResponse) plus 4 methods (multiHop, searchBatch, recommendGrouped, extractReferences) |
| `frontend/src/components/HopBadge.tsx` | Hop indicator badge with color per depth | VERIFIED | 39 lines (min 15); exports `HopBadge`; implements 3 depth styles with German labels |
| `frontend/src/components/HopResultCard.tsx` | Multi-hop result card with hop badge and via-reference | VERIFIED | 49 lines (min 30); imports `HopResultItem` from api; shows `HopBadge`, via-reference, title, line-clamped text |
| `frontend/src/components/HopResultList.tsx` | List of HopResultCards with footer stats | VERIFIED | 54 lines (min 25); role="list"; footer with visitedCount and expandedTerms badges; empty state |
| `frontend/src/components/DepthSlider.tsx` | Range input 1-3 for multi-hop depth | VERIFIED | 27 lines (min 15); range 1-3 with aria attributes |
| `frontend/src/components/SearchModeToggle.tsx` | 5th mode button Verweissuche | VERIFIED | Line 3: `SearchMode` type includes `"multi_hop"`; line 16: `{ value: "multi_hop", label: "Verweissuche" }` in MODES array |
| `frontend/src/pages/SearchPage.tsx` | Multi-hop mode integration with api.multiHop | VERIFIED | Imports HopResultList, DepthSlider; state `multiHopResults`, `multiHopDepth`; `fetchMultiHop` calls `api.multiHop`; DepthSlider rendered at line 385; HopResultList rendered at line 437 |
| `frontend/src/pages/IndexPage.tsx` | Auto-trigger extractReferences after indexing | VERIFIED | Line 283: `api.extractReferences` called fire-and-forget after queue complete; log messages for start, success and error confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/src/paragraf/api.py` | `backend/src/paragraf/api_models.py` | `ReferenceItem` import in `_result_to_item` | WIRED | `refs_out` is built from `meta.references_out` and passed as `references_out=refs_out` to `SearchResultItem` constructor |
| `frontend/src/lib/api.ts` | `/api/search/multi-hop` | `fetchJson POST` | WIRED | Line 562: `fetchJson<MultiHopResponse>("/api/search/multi-hop", { method: "POST", ... })` |
| `frontend/src/pages/SearchPage.tsx` | `frontend/src/lib/api.ts` | `api.multiHop()` call | WIRED | Line 138: `api.multiHop({ anfrage: q, gesetzbuch: ..., tiefe: depth, expand: true })` inside `fetchMultiHop` |
| `frontend/src/pages/IndexPage.tsx` | `frontend/src/lib/api.ts` | `api.extractReferences()` call | WIRED | Line 283: `api.extractReferences({ gesetz: null, full_reindex: false })` fire-and-forget with `.then()` and `.catch()` |
| `frontend/src/components/SearchModeToggle.tsx` | `frontend/src/pages/SearchPage.tsx` | `multi_hop` mode value | WIRED | `SearchPage` state type includes `"multi_hop"`; `handleSearch` branches on `mode === "multi_hop"` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `HopResultList.tsx` | `results: HopResultItem[]` | `multiHopResults.results` from `api.multiHop()` response | Yes — POST to `/api/search/multi-hop` backend endpoint | FLOWING |
| `SearchPage.tsx` multi-hop branch | `multiHopResults` | `fetchMultiHop` sets it via `setMultiHopResults(res)` after awaiting `api.multiHop()` | Yes — real API response, no static fallback | FLOWING |
| `IndexPage.tsx` extractReferences trigger | Fire-and-forget, result logged via `addLog` | `api.extractReferences` response consumed in `.then()` | Yes — `.then((res) => addLog(...res.points_with_refs..., res.total_refs...))` uses response data | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with no errors | `cd frontend && npx tsc --noEmit` | Exit 0, no output | PASS |
| HopBadge exports named function | File inspection | `export function HopBadge` at line 25 | PASS |
| extractReferences not awaited (fire-and-forget) | `grep "await.*extractReferences"` in IndexPage | No matches | PASS |
| All 4 api methods present | `grep "multiHop\|searchBatch\|recommendGrouped\|extractReferences"` in api.ts | All 4 found at lines 561, 567, 573, 579 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| XREF-01 | 11-01-PLAN.md | Regex-based cross-reference extraction, references_out field in ChunkMetadata | SATISFIED | `api_models.py` SearchResultItem has `references_out`; `api.py` `_result_to_item` maps from `meta.references_out` |
| XREF-02 | 11-01-PLAN.md | Cross-references stored as array in Qdrant payload | SATISFIED | `references_out` field propagated through `_result_to_item` to API responses confirms storage-to-API pipeline is complete |
| XREF-03 | 11-02-PLAN.md | Re-indexing with cross-reference data (after snapshot) | SATISFIED | `IndexPage.tsx` auto-triggers `api.extractReferences` after indexing completes, closing the re-index loop |
| CHUNK-02 | 11-02-PLAN.md | Re-indexing with improved chunking (after snapshot) | SATISFIED | Same auto-trigger mechanism (extractReferences after indexing) ensures chunk cross-reference data is refreshed |
| MCP-04 | 11-01-PLAN.md + 11-02-PLAN.md | Multi-hop MCP prompt — follow cross-references across hops | SATISFIED | Frontend multi-hop UI implemented; `api.multiHop` wired to `/api/search/multi-hop` backend endpoint |
| SRCH-05 | 11-01-PLAN.md | Grouped Recommendations | SATISFIED | `api.recommendGrouped` added to `api.ts` line 573 calling `/api/recommend/grouped` |
| SRCH-08 | 11-01-PLAN.md | Batch Search Endpoint for parallel queries | SATISFIED | `api.searchBatch` added to `api.ts` line 567 calling `/api/search/batch` |

All 7 requirement IDs from plan frontmatter are accounted for and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TODOs, placeholders, empty returns, or stub patterns found in any modified file | — | — |

No anti-patterns detected. All components render real data and all handlers make actual API calls.

### Human Verification Required

#### 1. Hop Badge Color Rendering

**Test:** Load the app, enter a search query, select "Verweissuche" mode, and submit. Inspect the hop badges on results.
**Expected:** Hop 0 results show a blue badge labeled "Direkttreffer", hop 1 results show an amber badge labeled "1. Verweis", hop 2 results show a green badge labeled "2. Verweis".
**Why human:** The color classes (`bg-warning-100`, `bg-success-100`, `bg-primary-100`) are custom Tailwind tokens. Visual correctness of the rendered colors cannot be verified without running the app.

#### 2. DepthSlider Updates Multi-Hop Search

**Test:** In "Verweissuche" mode, move the depth slider from 1 to 3, then submit a search. Check the network request.
**Expected:** The POST body to `/api/search/multi-hop` contains `"tiefe": 3`.
**Why human:** The slider onChange sets state and the state feeds into the next `fetchMultiHop` call — this reactive chain requires browser execution to verify.

### Gaps Summary

No gaps found. All 4 success criteria are fully implemented and verified in the codebase:

1. `api.ts` exposes all 4 required methods (`multiHop`, `recommendGrouped`, `searchBatch`, `extractReferences`) with complete TypeScript types mirroring the backend Pydantic models exactly.

2. "Verweissuche" is a proper 5th mode button in `SearchModeToggle`, with a depth slider, hop-colored result cards via `HopResultList`, and `FilterPanel`/`ViewToggle` correctly hidden in this mode.

3. `IndexPage` fires `api.extractReferences` as a non-blocking promise after the indexing queue completes, with progress/success/error logging.

4. `_result_to_item` in `api.py` conditionally builds `refs_out` from `meta.references_out` and passes it to `SearchResultItem`, completing the backend-to-frontend cross-reference data pipeline.

TypeScript compilation passes with zero errors. All 7 requirement IDs (XREF-01, XREF-02, XREF-03, CHUNK-02, MCP-04, SRCH-05, SRCH-08) are satisfied. Commits `bba1ce2`, `413c961`, `41426f8`, `4a661fa` are present on branch `Docker-only`.

---

_Verified: 2026-03-28T22:15:00Z_
_Verifier: Claude (gsd-verifier)_

# Phase 11: Frontend API Wiring - Research

**Researched:** 2026-03-28
**Domain:** Frontend-Backend integration gaps (React API client, missing UI surfaces)
**Confidence:** HIGH

## Summary

Phase 11 closes the integration gap between backend REST endpoints and the frontend API client. The backend exposes 5 endpoints that have no corresponding frontend `api.ts` method: `/api/search/multi-hop`, `/api/search/batch`, `/api/recommend/grouped`, `/api/references/extract`, and `/api/indexes/ensure`. The frontend `SearchResultItem` type already declares `references_out?: ReferenceItem[]`, but the backend's `_result_to_item()` helper does NOT populate this field and the backend's `SearchResultItem` Pydantic model does NOT include it either. Both sides need fixing.

The main UI surface needed is a multi-hop search mode. Batch search and grouped recommendations are API-level features that need wiring but can defer dedicated UI to Phase 12. Reference extraction must be triggered automatically after indexing completes on the IndexPage.

**Primary recommendation:** Wire all 4 missing API methods into `api.ts` with TypeScript types mirroring the Pydantic models, add `references_out` to backend `SearchResultItem` and `_result_to_item()`, add a multi-hop search tab/mode to SearchPage, and trigger `/api/references/extract` after IndexPage indexing completion.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XREF-01 | Regex-basierte Querverweis-Extraktion | Backend complete; frontend needs `extractReferences()` API method + auto-trigger after indexing |
| XREF-02 | Querverweise als Array im Qdrant-Payload | Backend stores them; `_result_to_item()` must propagate `references_out` to frontend |
| XREF-03 | Re-Indexierung mit Querverweis-Daten | Backend complete; frontend needs auto-trigger of `/api/references/extract` after indexing |
| CHUNK-02 | Re-Indexierung mit verbessertem Chunking | Backend complete; ties to XREF-03 auto-trigger flow |
| MCP-04 | Multi-Hop MCP-Prompt | Backend `/api/search/multi-hop` exists; frontend needs `multiHop()` API method + UI surface |
| SRCH-05 | Grouped Recommendations | Backend `/api/recommend/grouped` exists; frontend needs `recommendGrouped()` API method |
| SRCH-08 | Batch Search Endpoint | Backend `/api/search/batch` exists; frontend needs `searchBatch()` API method |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Branch:** All commits on `Docker-only`, never on main/master
- **Tech Stack:** React 19 + Vite + TailwindCSS, TypeScript strict mode
- **Naming:** camelCase for frontend functions/variables, PascalCase for components/interfaces
- **API Client:** All methods on the `api` object in `frontend/src/lib/api.ts`, using `fetchJson<T>()` helper
- **Error Handling:** German error messages via `role="alert"`, `useApi<T>` hook pattern
- **Accessibility:** `aria-label`, `role="status"`, `aria-live="polite"` on loading indicators
- **Deutsche UI:** German labels and messages throughout
- **Component Pattern:** cva + cn() standard, named exports for components
- **Path alias:** `@/*` maps to `src/*`

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI framework | Already in use |
| TypeScript | 5.6+ | Type safety | Already in use, strict mode |
| TailwindCSS | 4.x | Styling | Already in use |
| lucide-react | 0.460+ | Icons | Already in use |

### Supporting (no new dependencies needed)
This phase requires NO new npm packages. All work uses existing `fetchJson<T>()` patterns, existing component primitives, and existing page structures.

## Architecture Patterns

### Pattern 1: API Client Method (existing pattern)
**What:** Each backend endpoint gets a typed method on the `api` object
**When to use:** Every new endpoint wiring
**Example:**
```typescript
// Source: frontend/src/lib/api.ts (existing pattern)
export const api = {
  multiHop: (body: MultiHopRequest) =>
    fetchJson<MultiHopResponse>("/api/search/multi-hop", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
```

### Pattern 2: Type Mirroring from Pydantic Models
**What:** TypeScript interfaces mirror backend Pydantic `BaseModel` classes exactly
**When to use:** Every new request/response type
**Key rule:** Field names stay identical (German names like `anfrage`, `gesetzbuch` preserved)

### Pattern 3: Post-Indexing Hook in IndexPage
**What:** After indexing queue completes (pos >= q.length in `indexNext`), trigger reference extraction
**Where:** `frontend/src/pages/IndexPage.tsx` line 266-281 (the "indexing complete" block)
**Example:**
```typescript
// After loadStatus() in the completion block:
api.extractReferences({ gesetz: null, full_reindex: false })
  .then((res) => {
    addLog("System", "done", res.nachricht, "info");
  })
  .catch((err) => {
    addLog("System", "error", `Querverweis-Extraktion fehlgeschlagen: ${err.message}`, "error");
  });
```

### Pattern 4: Multi-Hop as SearchPage Mode
**What:** Multi-hop search as an additional search mode alongside semantic/fulltext/hybrid_fulltext
**Where:** SearchPage already has `searchMode` state and `SearchBar` mode selector
**Approach:** Add "multi-hop" to the search mode options. When selected, use `api.multiHop()` instead of `api.search()`. Results need different rendering since `HopResultItem` has `hop` and `via_reference` fields.

### Anti-Patterns to Avoid
- **Don't create separate pages for each endpoint:** Multi-hop is a search mode, not a separate page. Batch search is an API utility, not a user-facing feature.
- **Don't forget to propagate `references_out` in backend:** The backend `SearchResultItem` model and `_result_to_item()` both need updating before the frontend can consume cross-reference data.

## Gap Analysis

### Backend Endpoints Missing from Frontend API Client

| Endpoint | Method | Backend Model (Request) | Backend Model (Response) | Frontend Priority |
|----------|--------|------------------------|--------------------------|-------------------|
| `/api/search/multi-hop` | POST | `MultiHopRequest` | `MultiHopResponse` | HIGH (needs UI) |
| `/api/search/batch` | POST | `BatchSearchRequest` | `BatchSearchResponse` | MEDIUM (API-only) |
| `/api/recommend/grouped` | POST | `GroupedRecommendRequest` | `GroupedRecommendResponse` | MEDIUM (API-only) |
| `/api/references/extract` | POST | `ReferenceExtractRequest` | `ReferenceExtractResponse` | HIGH (auto-trigger) |
| `/api/indexes/ensure` | POST | (none) | (none) | LOW (internal) |

### Backend `_result_to_item()` Gap

The function at `api.py:226-239` does NOT include `references_out`:
```python
def _result_to_item(r) -> SearchResultItem:
    meta = r.chunk.metadata
    return SearchResultItem(
        paragraph=meta.paragraph,
        # ... other fields ...
        absatz=meta.absatz,
        # MISSING: references_out=meta.references_out
    )
```

The backend `SearchResultItem` in `api_models.py:55-66` also lacks `references_out`. Both need updating:
1. Add `references_out: list[ReferenceItem] = Field(default_factory=list)` to backend `SearchResultItem`
2. Add `references_out=[...]` mapping in `_result_to_item()`

The frontend `SearchResultItem` already has `references_out?: ReferenceItem[]` (api.ts:116).

### Multi-Hop Response Structure

`MultiHopResponse` has a different result shape than `SearchResponse`:
- `hops: int` - number of hops performed
- `results: HopResultItem[]` - each item has `hop: int` and `via_reference: string | null`
- `visited_paragraphs: string[]` - all visited paragraph identifiers
- `expanded_terms: string[]` - query expansion terms

This means the SearchPage needs conditional rendering when in multi-hop mode.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type definitions | Manual TypeScript types | Mirror from Pydantic models in `api_models.py` | Ensures exact field name/type match |
| Error handling | Custom error logic | Existing `fetchJson<T>()` with German error extraction | Already handles non-OK responses consistently |
| Reference extraction trigger | Manual fetch call | `api.extractReferences()` following existing patterns | Consistent with all other API calls |

## Common Pitfalls

### Pitfall 1: Backend SearchResultItem Missing references_out
**What goes wrong:** Frontend declares `references_out` on its `SearchResultItem` type, but backend never sends it. The field is always `undefined` on the frontend.
**Why it happens:** Backend `_result_to_item()` was written before cross-references were added. The Pydantic `SearchResultItem` model also lacks the field.
**How to avoid:** Update BOTH the Pydantic model AND the `_result_to_item()` converter function. The `ChunkMetadata` model already has `references_out: list[Reference]`.
**Warning signs:** `references_out` is always `undefined` in frontend despite Qdrant having the data.

### Pitfall 2: Multi-Hop Result Type Mismatch
**What goes wrong:** Trying to render `HopResultItem` with components that expect `SearchResultItem`.
**Why it happens:** `HopResultItem` has `hop` and `via_reference` fields instead of `abschnitt`, `hierarchie_pfad`, `quelle`, `chunk_typ`, `absatz`.
**How to avoid:** Create a dedicated result list component for multi-hop results, or map `HopResultItem` to a compatible display format.
**Warning signs:** TypeScript errors when passing multi-hop results to existing `ResultCard`.

### Pitfall 3: Reference Extraction Blocking UI
**What goes wrong:** `/api/references/extract` can take minutes for large collections. Triggering it synchronously blocks the IndexPage.
**Why it happens:** The endpoint scrolls all points and applies regex extraction.
**How to avoid:** Fire-and-forget with a log message. Don't await the result in the indexing flow. Show progress via a separate status indicator or log entry.
**Warning signs:** IndexPage appears frozen after "Indexierung abgeschlossen".

### Pitfall 4: Batch Search Max Queries Limit
**What goes wrong:** Backend enforces `batch_max_queries` (default 10). Exceeding it returns 422.
**Why it happens:** The limit is configured in `Settings.batch_max_queries`.
**How to avoid:** Document the limit in the TypeScript type and enforce it client-side.
**Warning signs:** 422 errors when sending more than 10 queries.

### Pitfall 5: GroupedRecommendRequest Field Overlap with RecommendRequest
**What goes wrong:** Using the wrong request type for grouped vs. non-grouped recommend.
**Why it happens:** Both have `point_ids`, `paragraph`, `gesetz`, `exclude_same_law` but GroupedRecommend adds `group_size`, `max_groups`.
**How to avoid:** Define separate TypeScript interfaces mirroring the exact Pydantic models.

## Code Examples

### New API Methods (api.ts additions)

```typescript
// Multi-Hop Search
export interface MultiHopRequest {
  anfrage: string;
  gesetzbuch?: string | null;
  tiefe?: number;        // 1-3, default 1
  max_ergebnisse_pro_hop?: number;  // 1-10, default 5
  expand?: boolean;       // default true
}

export interface HopResultItem {
  paragraph: string;
  gesetz: string;
  titel: string;
  text: string;
  score: number;
  hop: number;
  via_reference: string | null;
}

export interface MultiHopResponse {
  query: string;
  expanded_terms: string[];
  hops: number;
  results: HopResultItem[];
  total: number;
  visited_paragraphs: string[];
  disclaimer: string;
}

// Batch Search
export interface BatchSearchRequest {
  queries: SearchRequest[];   // max 10
}

export interface BatchSearchResponse {
  results: SearchResponse[];
  total_queries: number;
  load_warning: boolean;
}

// Grouped Recommend
export interface GroupedRecommendRequest {
  point_ids?: string[] | null;
  paragraph?: string | null;
  gesetz?: string | null;
  exclude_same_law?: boolean;
  gesetzbuch?: string | null;
  abschnitt?: string | null;
  absatz_von?: number | null;
  absatz_bis?: number | null;
  group_size?: number;
  max_groups?: number;
}

export interface GroupedRecommendResponse {
  source_ids: string[];
  groups: GroupedResultGroup[];
  total_groups: number;
  disclaimer: string;
}

// Reference Extraction
export interface ReferenceExtractRequest {
  gesetz?: string | null;
  full_reindex?: boolean;
}

export interface ReferenceExtractResponse {
  erfolg: boolean;
  total_points: number;
  points_with_refs: number;
  total_refs: number;
  snapshot_name: string | null;
  nachricht: string;
}
```

### Backend _result_to_item Fix

```python
# Source: backend/src/paragraf/api.py - needs modification
def _result_to_item(r) -> SearchResultItem:  # noqa: ANN001
    meta = r.chunk.metadata
    refs_out = [
        ReferenceItem(
            gesetz=ref.gesetz,
            paragraph=ref.paragraph,
            absatz=ref.absatz,
            raw=ref.raw,
            verified=ref.verified,
            kontext=ref.kontext,
        )
        for ref in (meta.references_out or [])
    ]
    return SearchResultItem(
        paragraph=meta.paragraph,
        gesetz=meta.gesetz,
        titel=meta.titel,
        text=r.chunk.text,
        score=round(r.score, 4),
        abschnitt=meta.abschnitt,
        hierarchie_pfad=meta.hierarchie_pfad,
        quelle=meta.quelle,
        chunk_typ=meta.chunk_typ,
        absatz=meta.absatz,
        references_out=refs_out if refs_out else None,
    )
```

### Backend SearchResultItem Model Fix

```python
# Source: backend/src/paragraf/api_models.py - needs modification
class SearchResultItem(BaseModel):
    paragraph: str = Field(description="z.B. '§ 37'")
    gesetz: str = Field(description="z.B. 'SGB XI'")
    titel: str = Field(description="Titel des Paragraphen")
    text: str = Field(description="Volltext des Chunks")
    score: float = Field(description="Relevanz-Score (0-1)")
    abschnitt: str = Field(default="")
    hierarchie_pfad: str = Field(default="")
    quelle: str = Field(default="gesetze-im-internet.de")
    chunk_typ: str = Field(default="paragraph")
    absatz: int | None = Field(None)
    references_out: list[ReferenceItem] | None = Field(
        None, description="Ausgehende Querverweise (null wenn keine)"
    )
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.0+ with pytest-asyncio |
| Config file | `backend/pyproject.toml` |
| Quick run command | `docker compose exec backend python -m pytest tests/ -x -q` |
| Full suite command | `docker compose exec backend python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XREF-01 | extractReferences API method works | integration | `docker compose exec backend python -m pytest tests/ -x -k "reference"` | Depends on existing tests |
| XREF-02 | references_out propagated in SearchResultItem | unit | Manual verification via API call | Wave 0 |
| XREF-03 | Auto-trigger after indexing | manual-only | Visual verification in IndexPage | N/A |
| CHUNK-02 | Re-indexing triggers reference extraction | manual-only | Visual verification | N/A |
| MCP-04 | multiHop API method works | integration | `curl -X POST /api/search/multi-hop` | Manual |
| SRCH-05 | recommendGrouped API method works | integration | `curl -X POST /api/recommend/grouped` | Manual |
| SRCH-08 | searchBatch API method works | integration | `curl -X POST /api/search/batch` | Manual |

### Sampling Rate
- **Per task commit:** TypeScript type-check `cd frontend && npx tsc --noEmit`
- **Per wave merge:** Full backend test suite + manual UI verification
- **Phase gate:** All API methods callable, multi-hop UI renders, auto-extraction triggers

### Wave 0 Gaps
- None -- existing test infrastructure covers backend; frontend verification is primarily TypeScript compilation + manual UI testing

## Open Questions

1. **Multi-hop UI placement**
   - What we know: SearchPage has a search mode selector (semantic/fulltext/hybrid_fulltext). Multi-hop could be a 4th mode.
   - What's unclear: Should multi-hop results show hop indicators visually (e.g., "Hop 0", "Hop 1" badges)? Should the traversal depth be user-configurable?
   - Recommendation: Add as 4th search mode "Verweissuche" with depth slider (1-3). Show hop badges on results.

2. **Batch search UI surface**
   - What we know: Batch search is primarily a programmatic API. No obvious user workflow requires sending multiple queries simultaneously.
   - What's unclear: Whether a UI is needed at all for Phase 11.
   - Recommendation: Wire the API method but defer UI to Phase 12 if needed. The success criteria only requires `api.ts` exposure.

3. **Reference extraction timing**
   - What we know: Extraction can be slow (scrolls all points). Backend creates a snapshot first.
   - What's unclear: Should it only trigger when new laws are indexed, or always?
   - Recommendation: Trigger only when at least one law was successfully indexed in the session. Show a log entry but don't block the UI.

## Sources

### Primary (HIGH confidence)
- `backend/src/paragraf/api.py` -- all route definitions, `_result_to_item()` function
- `backend/src/paragraf/api_models.py` -- all Pydantic request/response models
- `frontend/src/lib/api.ts` -- current API client with all existing methods
- `frontend/src/pages/IndexPage.tsx` -- indexing completion flow
- `frontend/src/pages/SearchPage.tsx` -- search mode handling

### Secondary (MEDIUM confidence)
- `backend/src/paragraf/services/multi_hop.py` -- multi-hop service implementation
- `backend/src/paragraf/config.py` -- batch/multi-hop configuration limits

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns already established
- Architecture: HIGH -- all patterns derived from existing codebase conventions
- Pitfalls: HIGH -- gaps identified directly from source code analysis

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- no external dependencies)

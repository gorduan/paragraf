# Phase 8: Search Results UX — Research

**Researched:** 2026-03-27
**Status:** Complete

## Current Frontend State

### SearchPage.tsx
- **State:** `results: SearchResultItem[]`, `loading: boolean`, `error: string | null`, `query: string`
- **handleSearch:** `async (q: string, gesetzbuch?: string)` — calls `api.search({anfrage, gesetzbuch})`, sets results
- **Render:** Flat list of `ResultCard` components, no grouping, no pagination, no filters beyond law dropdown
- **Missing:** No compare state, no view toggle, no filter panel, no search mode toggle, no cursor/pagination

### ResultCard.tsx
- **Props:** `{ result: SearchResultItem; onCompare?: (ref: string) => void; showScore?: boolean; defaultExpanded?: boolean }`
- **State:** `expanded: boolean`, `copied: boolean`
- **Action bar (when expanded):** Copy, Bookmark (via BookmarkContext), Compare (only renders if `onCompare` prop provided)
- **Key finding:** `onCompare` is DEFINED in props but SearchPage NEVER passes it — compare button never renders

### SearchBar.tsx
- **Props:** `{ onSearch: (query: string, gesetzbuch?: string) => void; placeholder?: string; showFilter?: boolean; autoFocus?: boolean }`
- **Features:** Search history (localStorage, max 20), law filter via native `<select>` grouped by rechtsgebiet
- **onSearch signature:** `(query: string, gesetzbuch?: string) => void`

### App.tsx — Context Patterns
- **BookmarkContext:** `{ bookmarks: string[]; addBookmark; removeBookmark; isBookmarked }` — localStorage persisted
- **ThemeContext:** `{ dark: boolean; toggle: () => void }` — localStorage persisted
- **No CompareContext exists** — must be created for Phase 8
- **Page routing:** `setPage(page)` state, pages: search, lookup, compare, laws, counseling, index, settings

### ComparePage.tsx (reference pattern)
- Array state `refs: string[]`, functions `addRef()`, `removeRef(index)`, `updateRef(index, value)`
- Calls `api.compare({ paragraphen: valid })` — grid layout with columns matching number of items

## API Layer

### Frontend Types (api.ts)

```typescript
interface SearchRequest {
  anfrage: string;
  gesetzbuch?: string | null;
  abschnitt?: string | null;
  max_ergebnisse?: number;       // Default: 5, Range: 1-20
  search_type?: "semantic" | "fulltext" | "hybrid_fulltext";
  absatz_von?: number | null;
  absatz_bis?: number | null;
  cursor?: string | null;         // For pagination
  page_size?: number;             // Default: 10, Range: 1-100
  expand?: boolean;               // Default: true
}

interface SearchResultItem {
  paragraph: string;    gesetz: string;      titel: string;
  text: string;         score: number;       abschnitt: string;
  hierarchie_pfad: string;  quelle: string;  chunk_typ: string;
  absatz: number | null;
}

interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  search_type?: string;
  next_cursor?: string | null;    // null = last page
  expanded_terms?: string[];
  disclaimer: string;
}
```

### Backend Endpoints (api.py + api_models.py)

| Endpoint | Method | Request Model | Response Model | Status |
|----------|--------|---------------|----------------|--------|
| `/api/search` | POST | SearchRequest | SearchResponse | Exists, supports cursor/search_type/filters |
| `/api/recommend` | POST | RecommendRequest | RecommendResponse | Exists, not called from frontend |
| `/api/search/grouped` | POST | GroupedSearchRequest | GroupedSearchResponse | Exists, not called from frontend |
| `/api/recommend/grouped` | POST | GroupedRecommendRequest | GroupedRecommendResponse | Exists, not called from frontend |
| `/api/discover` | POST | DiscoverRequest | DiscoverResponse | Exists, not called from frontend |

### RecommendRequest/Response (backend)
- **Request:** `point_ids` OR `paragraph+gesetz`, `limit`, `exclude_same_law`, filters
- **Response:** List of SearchResultItem with scores

### GroupedSearchRequest/Response (backend)
- **Request:** `anfrage`, `gesetzbuch`, `abschnitt`, `group_size`, `max_groups`, `search_type`
- **Response:** Groups results by `gesetz`, each group has up to `group_size` results

## UI Primitives Available (Phase 3)

| Primitive | Variants | Key API |
|-----------|----------|---------|
| Button | primary, secondary, ghost, destructive × sm, md, lg | `<Button variant="ghost" size="sm">` |
| Card | default, interactive + CardHeader/Content/Footer | Compound component |
| Badge | default, primary, success, warning, error | `<Badge variant="primary">` |
| Select | Radix UI wrapper | SelectTrigger/Content/Item/Group/Label |
| Input | default, error | Standard HTML input + CVA |
| Tabs | Radix UI wrapper | Tabs/TabsList/TabsTrigger/TabsContent |

## Implementation Patterns

### Recommend Integration
1. ResultCard gets "Aehnliche finden" button in action bar
2. Click triggers `api.recommend({ paragraph, gesetz })` — needs new frontend API method
3. Results render in RecommendSection below the card (inline expansion)
4. Mini-Cards: compact view (paragraph+gesetz+score one line), expandable text
5. Initial 3, "Weitere anzeigen" loads rest (up to 10)

### Grouped View
1. New API method `api.searchGrouped()` calling `/api/search/grouped`
2. Toggle between flat (current) and grouped (accordion) views
3. Accordion: gesetz name + hit count in header, ResultCards inside
4. First group open, rest collapsed
5. View mode persisted in localStorage key `paragraf_view_mode`

### Filter Panel
1. Collapsible panel below SearchBar with "Erweiterte Filter" toggle
2. Fields: Abschnitt (Select dropdown), Chunk-Typ (radio: Paragraph/Absatz), Absatz-Range (two number inputs)
3. Apply button triggers new search with filter params (already supported by backend)
4. Active filters as removable chips above results

### Search Mode Toggle
1. 3-segment control below SearchBar: Semantisch | Volltext | Hybrid
2. Maps to `search_type` param: semantic | fulltext | hybrid_fulltext
3. Backend already supports all three modes

### Pagination
1. "Mehr laden" button appends next page via `next_cursor` from SearchResponse
2. Display "X von ~Y Ergebnissen"
3. Cursor stored in SearchPage state, passed on next search call

### Compare Wiring
1. Create CompareContext in App.tsx (pattern from BookmarkContext)
2. SearchPage passes `onCompare` to ResultCard
3. Compare counter/badge shows selection count with link to ComparePage
4. Session-scoped (not persisted in localStorage)

## Pitfalls

1. **Grouped view needs separate API call** — cannot regroup flat results client-side (backend does group_by in Qdrant)
2. **View toggle resets results** — switching from flat to grouped requires new API call with different endpoint
3. **Filter state complexity** — filters + search mode + pagination cursor + view mode = many state variables in SearchPage; consider useReducer
4. **Recommend per-card state** — each ResultCard manages its own recommend expansion independently
5. **SearchBar onSearch signature change** — adding search_type param changes the callback signature, must update SearchBar props

## Validation Architecture

### Testable Assertions
1. **Recommend:** Click "Aehnliche finden" → RecommendSection renders with Mini-Cards
2. **Grouped:** Toggle to "Gruppiert" → accordion with gesetz headers renders
3. **Filters:** Apply chunk_typ filter → search request includes `chunk_typ` param
4. **Compare:** Click compare on ResultCard → CompareContext updates, counter increments
5. **Pagination:** Click "Mehr laden" → results array grows, cursor advances
6. **Search mode:** Select "Volltext" → search request includes `search_type: "fulltext"`

## RESEARCH COMPLETE

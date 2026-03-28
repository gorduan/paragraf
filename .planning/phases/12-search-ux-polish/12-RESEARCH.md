# Phase 12: Search UX Polish - Research

**Researched:** 2026-03-28
**Domain:** React frontend UX wiring (click handlers, state propagation, accessibility)
**Confidence:** HIGH

## Summary

Phase 12 is a pure frontend polish phase that closes four specific gaps in SearchPage interactive elements. All backend infrastructure is already complete -- the `expand` parameter, graph navigation, compare context, and accessibility live regions all exist. The gaps are exclusively about missing prop wiring, missing click handlers, and missing UI toggles in the React frontend.

The four issues are well-scoped and isolated: (1) ResultCard's `onGraphNavigate` prop is never passed from SearchPage, (2) the compare counter Badge has no onClick, (3) there is no UI toggle for query expansion despite backend support, and (4) filter announcements lack result counts. Each fix is 5-20 lines of code in existing files.

**Primary recommendation:** Wire missing props and handlers in SearchPage.tsx, add an expansion toggle checkbox near expanded terms display, and enhance announcement strings with counts. No new components or backend changes needed.

## Project Constraints (from CLAUDE.md)

- **Branch:** All commits on `Docker-only`, never on main/master
- **Stack:** React 19 + Vite + TailwindCSS 4, no new dependencies
- **Language:** German UI text, German docstrings, English variable/function names
- **Accessibility:** WCAG 2.1 AA -- `aria-live`, `role="alert"`, `aria-label` on interactive elements
- **Component patterns:** cva + cn() utility, named exports for components, PascalCase component files
- **Design system:** Use existing Button, Badge, Card primitives from `@/components/ui/`
- **State:** No state management library -- React useState + Context only
- **Compare context:** Session-scoped (useState), not localStorage

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XREF-05 | Clickable cross-reference links in paragraph display | ResultCard "Zitationen" button exists but `onGraphNavigate` prop is not passed from SearchPage -- needs wiring + page navigation callback |
| UI-05 | Compare directly from search results (onCompare wired) | Compare Badge in results header has no onClick -- needs handler navigating to ComparePage via page state |
| SRCH-07 | Query expansion with legal synonym dictionary (toggleable) | Backend `expand` param defaults to `true`, frontend SearchRequest type has `expand?: boolean` but no UI toggle exists -- need checkbox + state |
</phase_requirements>

## Standard Stack

No new libraries needed. All work uses existing project dependencies.

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | 19.x | UI framework | Installed |
| lucide-react | 0.460+ | Icons (Network, ArrowRight, etc.) | Installed |
| TailwindCSS | 4.x | Styling | Installed |

### Supporting (already installed)
| Library | Purpose | Used For |
|---------|---------|----------|
| @/components/ui/Badge | Badge component | Compare counter display |
| @/components/ui/Button | Ghost button | Expansion toggle |
| @/lib/utils (cn) | Class merging | Conditional styling |

**Installation:** None required.

## Architecture Patterns

### Current Page Navigation Pattern
The app uses a simple `page` state in `App.tsx` with a `setPage` callback. Pages that need to trigger navigation receive an `onPageChange` prop (see GraphPage pattern). SearchPage currently receives NO navigation props.

```typescript
// App.tsx -- current pattern
case "search":
  return <SearchPage />;
// Needs to become:
case "search":
  return <SearchPage onPageChange={(p) => setPage(p as Page)} />;
```

### Prop Threading Pattern (existing)
ResultCard already accepts `onGraphNavigate` and `onCompare` as optional props. SearchPage just needs to pass them. This is the established pattern -- see how DiscoveryExampleBar receives callbacks from SearchPage.

### State-Up Pattern for Expansion Toggle
The `expand` boolean should live in SearchPage state (alongside `searchMode`, `filters`, etc.) and be passed into the `api.search()` call. The toggle UI renders near the expanded terms display.

### Anti-Patterns to Avoid
- **Adding new Context for page navigation:** Use prop drilling -- SearchPage only needs one `onPageChange` callback, not a new Context
- **Creating new component for expansion toggle:** A simple checkbox with label suffices -- no need for a dedicated component
- **Modifying backend:** All backend support already exists -- `expand` parameter, `expanded_terms` response field

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page navigation | Router library | `onPageChange` prop from App | Project uses simple state-based routing, no router |
| Toggle UI | Custom toggle component | HTML checkbox + label with Tailwind | Minimal UI, accessible by default |

## Common Pitfalls

### Pitfall 1: Missing onPageChange in SearchPage type
**What goes wrong:** Adding onPageChange prop to SearchPage but forgetting to update App.tsx renderPage
**Why it happens:** Two files must change in sync
**How to avoid:** Update SearchPage interface AND App.tsx renderPage in the same task
**Warning signs:** TypeScript won't catch it because the prop is optional

### Pitfall 2: Stale expand state in load-more
**What goes wrong:** User toggles expansion off, then clicks "load more" -- but the load-more call still uses the old expand value
**Why it happens:** handleLoadMore closure captures stale state
**How to avoid:** Include `expand` state in the handleLoadMore call, or use useCallback with expand dependency
**Warning signs:** Expanded terms appear in paginated results after user disabled expansion

### Pitfall 3: Compare badge onClick without keyboard support
**What goes wrong:** Badge is clickable by mouse but not keyboard-accessible
**Why it happens:** Badge is a `<span>` not a `<button>`, so onClick alone is insufficient
**How to avoid:** Wrap in a `<button>` or use Button component with ghost variant. Add `role="link"` or use semantic element.
**Warning signs:** Badge not reachable via Tab key

### Pitfall 4: Announcement timing after filter apply
**What goes wrong:** Announcement says "5 Ergebnisse" before the API call completes
**Why it happens:** Setting announcement in handleFilterApply before executeSearch returns
**How to avoid:** Set the count announcement inside executeSearch's success path (already happening for regular search -- just include filter context)
**Warning signs:** Screen reader announces stale count

## Code Examples

### Gap 1: Wire onGraphNavigate to ResultCard

```typescript
// SearchPage.tsx -- add prop and pass through
interface SearchPageProps {
  onPageChange?: (page: string) => void;
}

export function SearchPage({ onPageChange }: SearchPageProps) {
  // ... existing state ...

  // In ResultCard rendering:
  <ResultCard
    result={r}
    onGraphNavigate={(gesetz, paragraph) => onPageChange?.("graph")}
    discoveryMode={isDiscoveryMode}
    discoveryPolarity={getPolarity(r.gesetz, r.paragraph)}
    onDiscoveryToggle={handleExampleToggle}
  />
}
```

### Gap 2: Compare badge onClick

```typescript
// SearchPage.tsx -- add onClick to existing Badge
<Badge
  variant="primary"
  className="cursor-pointer"
  aria-live="polite"
  onClick={() => onPageChange?.("compare")}
  role="link"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === "Enter") onPageChange?.("compare"); }}
>
  {compareItems.length} zum Vergleich <ArrowRight size={12} className="inline ml-1" aria-hidden="true" />
</Badge>
```

Note: Badge may need to be wrapped in a `<button>` if it doesn't support onClick natively. Check Badge component implementation.

### Gap 3: Query expansion toggle

```typescript
// SearchPage.tsx -- new state + UI
const [expandEnabled, setExpandEnabled] = useState(true);

// Pass to api.search calls:
const res = await api.search({
  anfrage: q,
  // ... existing params ...
  expand: expandEnabled,
});

// UI near expanded terms display:
{expandedTerms.length > 0 && (
  <div className="flex items-center gap-2 mt-1">
    <p className="text-xs text-neutral-500 dark:text-neutral-400">
      Erweitert: {expandedTerms.join(", ")}
    </p>
  </div>
)}
<label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
  <input
    type="checkbox"
    checked={expandEnabled}
    onChange={(e) => setExpandEnabled(e.target.checked)}
    className="rounded border-neutral-300"
  />
  Begriffe erweitern
</label>
```

### Gap 4: Filter announcement with count

```typescript
// Inside executeSearch, after results come back:
const filterActive = Object.values(filterValues).some(v => v !== null);
const countText = `${res.results.length} Ergebnisse gefunden`;
setAnnouncement(filterActive ? `${countText} (gefiltert)` : countText);
```

## Detailed Gap Analysis

### Gap 1: ResultCard "Zitationen" button (XREF-05)

**Current state:** ResultCard has `onGraphNavigate` prop (line 27) and calls it on click (line 227). SearchPage renders ResultCard WITHOUT passing `onGraphNavigate` (line 482-487). Button click does nothing.

**Fix:** SearchPage needs an `onPageChange` prop from App.tsx, then passes `onGraphNavigate` to ResultCard that calls `onPageChange("graph")`.

**Files:** `frontend/src/pages/SearchPage.tsx`, `frontend/src/App.tsx`

### Gap 2: Compare counter badge (UI-05)

**Current state:** Badge at line 464 in SearchPage shows compare count with `cursor-pointer` class but has NO onClick handler. It is purely decorative.

**Fix:** Add onClick handler that calls `onPageChange("compare")`. Badge component (Badge.tsx) renders a `<span>` -- need to either wrap in button or use Button component instead.

**Files:** `frontend/src/pages/SearchPage.tsx`, possibly `frontend/src/components/ui/Badge.tsx`

### Gap 3: Query expansion toggle (SRCH-07)

**Current state:**
- Backend: `SearchRequest.expand` defaults to `True` (api_models.py line 26)
- Frontend API type: `expand?: boolean` exists in SearchRequest (api.ts line 20)
- SearchPage: Never passes `expand` to `api.search()` calls -- defaults to backend's `True`
- No UI toggle exists anywhere

**Fix:** Add `expandEnabled` state to SearchPage, pass to all `api.search()` calls, render checkbox toggle near search controls or expanded terms display.

**Files:** `frontend/src/pages/SearchPage.tsx`

### Gap 4: Filter announcement with count (accessibility)

**Current state:** `handleFilterApply` (line 248-254) sets `setAnnouncement("Filter angewendet")` before calling `executeSearch`. The executeSearch callback does set count-based announcements, but the filter apply handler's announcement overwrites them briefly.

**Fix:** Remove the premature "Filter angewendet" announcement from handleFilterApply, or enhance the executeSearch announcement to mention filters. The key requirement is that screen readers hear the filtered result count.

**Files:** `frontend/src/pages/SearchPage.tsx`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 + @testing-library/react 16.3.2 |
| Config file | `frontend/vitest.config.ts` (assumed from package.json) |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XREF-05 | Zitationen button calls onGraphNavigate | unit | `cd frontend && npx vitest run src/components/__tests__/ResultCard.test.tsx -t "graph" --reporter=verbose` | Wave 0 |
| UI-05 | Compare badge navigates to compare page | unit | `cd frontend && npx vitest run src/pages/__tests__/SearchPage.test.tsx -t "compare" --reporter=verbose` | Wave 0 |
| SRCH-07 | Expansion toggle controls expand param | unit | `cd frontend && npx vitest run src/pages/__tests__/SearchPage.test.tsx -t "expand" --reporter=verbose` | Wave 0 |
| SRCH-07 | Filter announcement includes count | unit | `cd frontend && npx vitest run src/pages/__tests__/SearchPage.test.tsx -t "announcement" --reporter=verbose` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/__tests__/ResultCard.test.tsx` -- covers XREF-05 (onGraphNavigate callback)
- [ ] `frontend/src/pages/__tests__/SearchPage.test.tsx` -- covers UI-05, SRCH-07 (may be too heavy; consider testing individual behaviors via component tests)

*(Note: SearchPage is complex with many dependencies. Testing individual handler logic may be more practical than full-page rendering tests.)*

## Sources

### Primary (HIGH confidence)
- Direct source code inspection of: `SearchPage.tsx`, `ResultCard.tsx`, `App.tsx`, `SearchBar.tsx`, `SearchModeToggle.tsx`, `api.ts`, `api_models.py`, `api.py`, `config.py`
- All findings verified by reading actual source files in the repository

### Secondary (MEDIUM confidence)
- Badge component behavior (assumed `<span>` based on standard shadcn/radix pattern -- should verify before implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing code inspected
- Architecture: HIGH - all four gaps precisely identified with line numbers
- Pitfalls: HIGH - derived from actual code patterns observed

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- frontend-only changes, no dependency drift risk)

# Phase 8: Search Results UX - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Users interact with search results through a polished interface with recommend buttons, grouped views, advanced filters, inline comparison, pagination controls, and full-text search toggle. Rein Frontend-Phase — alle Backend-Endpoints existieren bereits (Phase 4/5/7).

Requirements: UI-02 (Aehnliche Paragraphen Button), UI-03 (Ergebnis-Gruppierung), UI-04 (Erweiterte Filter-UI), UI-05 (Vergleich aus Suchergebnissen), UI-06 (Paginierung), UI-07 (Full-Text Toggle)

</domain>

<decisions>
## Implementation Decisions

### Recommend-Button ("Aehnliche Paragraphen")
- **D-01:** Inline Expansion — aehnliche Paragraphen klappen unterhalb der ResultCard auf. Kein Kontextwechsel, Nutzer bleibt in der Ergebnisliste. Passt zum bestehenden Expand-Pattern der ResultCard.
- **D-02:** Initial 3 Mini-Cards anzeigen, "Mehr laden" Button fuer weitere. Recommend-API liefert bis zu 10.
- **D-03:** Mini-Cards als kompakte Darstellung: Paragraph + Gesetz + Score in einer Zeile, aufklappbar fuer Text. Visuell klar als Unter-Ergebnis erkennbar (eingerueckt, subtilerer Style).
- **D-04:** Mini-Cards bieten alle Aktionen: Aufklappen, Vergleichen UND Bookmark.

### Grouped vs Flat View
- **D-05:** Toggle-Buttons (Liste | Gruppiert) direkt ueber den Suchergebnissen, neben der Ergebnisanzahl.
- **D-06:** Gruppierte Ansicht als Accordion — jedes Gesetz als aufklappbare Sektion mit Gesetzname + Trefferanzahl im Header. Erste Gruppe offen, Rest zugeklappt.
- **D-07:** Letzten Ansichtsmodus in localStorage merken und beim naechsten Besuch wiederherstellen (konsistent mit bestehendem localStorage-Pattern fuer Bookmarks, Search History, Dark Mode).

### Filter Sidebar/Panel
- **D-08:** Collapsible Panel direkt unter dem SearchBar. Button "Erweiterte Filter" oeffnet/schliesst es. Kein Platzverbrauch wenn geschlossen, mobile-freundlich.
- **D-09:** Filter werden per Button "Filter anwenden" angewendet, nicht sofort bei jeder Aenderung. Vermeidet unnoetige API-Calls.
- **D-10:** Aktive Filter als Chips/Tags ueber den Ergebnissen sichtbar mit X zum Entfernen und "Alle zuruecksetzen" Link.
- **D-11:** Filter-Optionen: Abschnitt (Dropdown), Chunk-Typ (Radio: Paragraph/Absatz), Absatz-Range (von/bis Nummernfelder).

### Pagination
- **D-12:** "Mehr laden" Button am Ende der Ergebnisliste. Haengt naechste Seite an bestehende Ergebnisse an. Nutzt cursor-basierten Scroll-API-Ansatz aus Phase 4 (next_cursor).
- **D-13:** Anzeige "X von ~Y Ergebnissen" neben dem Button (soweit Backend Gesamtzahl liefert).

### Full-Text Search Toggle
- **D-14:** 3-Wege Segmented-Control direkt im/unter dem SearchBar: Semantisch | Volltext | Hybrid. Immer sichtbar, schnell umschaltbar.
- **D-15:** Backend unterstuetzt bereits alle drei Modi via `search_type` Parameter (semantic/fulltext/hybrid_fulltext). Frontend muss nur den Parameter mitsenden.

### Compare (onCompare verdrahten)
- **D-16:** onCompare-Prop in SearchPage verdrahten: Klick auf "Vergleichen" auf ResultCard fuegt Paragraph zur Vergleichs-Auswahl hinzu. Badge/Indicator zeigt Anzahl ausgewaehlter Paragraphen, Link zur ComparePage. Erfuellt UI-05.

### Claude's Discretion
- Genaue Styling-Details der Mini-Cards (Einrueckung, Farbgebung, Uebergaenge)
- Accordion-Implementierung (eigene Komponente vs Radix Accordion)
- Exakte Platzierung und Styling der Toggle-Buttons und Segmented-Control
- Responsive Breakpoints fuer Filter-Panel auf Mobile
- State-Management fuer Compare-Auswahl (Context vs lokaler State)
- Ob "Mehr laden" einen Loading-Spinner innerhalb des Buttons zeigt
- Genaue Formulierung der deutschen UI-Labels

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend Components (Hauptaenderungen)
- `frontend/src/pages/SearchPage.tsx` — Hauptseite, wird erweitert mit Toggle, Filter, Pagination, Compare-Wiring
- `frontend/src/components/ResultCard.tsx` — Bekommt Recommend-Button, hat bereits onCompare Prop
- `frontend/src/components/SearchBar.tsx` — Bekommt Full-Text Toggle, hat bereits Law-Filter Dropdown

### UI Primitives (Phase 3, wiederverwendbar)
- `frontend/src/components/ui/Badge.tsx` — Fuer Filter-Chips und Ergebnis-Badges
- `frontend/src/components/ui/Button.tsx` — Fuer Toggle-Buttons, Mehr-Laden, Filter-Anwenden
- `frontend/src/components/ui/Card.tsx` — Basis fuer Mini-Cards
- `frontend/src/components/ui/Select.tsx` — Fuer Abschnitt-Dropdown im Filter-Panel
- `frontend/src/components/ui/Tabs.tsx` — Moeglicherweise fuer Segmented-Control nutzbar
- `frontend/src/components/ui/Input.tsx` — Fuer Absatz-Range Nummernfelder

### API Client
- `frontend/src/lib/api.ts` — REST-Client, muss um recommend, grouped search, fulltext Aufrufe erweitert werden

### Backend Endpoints (bereits implementiert)
- `backend/src/paragraf/api.py` — `/api/recommend` (L497), `/api/search/grouped` (L687), fulltext search_type (L364), cursor pagination (L349)
- `backend/src/paragraf/api_models.py` — Pydantic Request/Response Modelle fuer alle Endpoints

### Prior Phase Context
- `.planning/phases/03-design-system-foundation/03-CONTEXT.md` — Design-System Tokens, Primitive-API
- `.planning/phases/04-recommend-pagination/04-CONTEXT.md` — Recommend API Design, Cursor-Pagination
- `.planning/phases/05-grouping-discovery-api/05-CONTEXT.md` — Grouping API, Group-Size Defaults

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **UI Primitives (Phase 3):** Button, Card, Badge, Select, Input, Tabs, Tooltip, Dialog — alle mit Varianten-Support (`variant`, `size`)
- **ResultCard:** Hat bereits `onCompare` Prop (nicht verdrahtet), `showScore`, `defaultExpanded`, Bookmark-Integration via BookmarkContext
- **SearchBar:** Hat Law-Filter Dropdown mit Rechtsgebiet-Gruppierung, Suchhistorie in localStorage
- **useApi Hook:** Generischer Hook fuer Request-Lifecycle (`data`, `loading`, `error`)
- **BookmarkContext:** In App.tsx, localStorage-basiert — Pattern fuer Compare-Auswahl wiederverwendbar

### Established Patterns
- **localStorage Persistenz:** Bookmarks, Search History, Dark Mode — gleicher Ansatz fuer View-Modus und ggf. Filter-Prefs
- **Expand/Collapse:** ResultCard nutzt useState fuer expand — gleicher Ansatz fuer Accordion und Filter-Panel
- **API Client Namespace:** `api.search()`, `api.laws()` etc. — neue Methoden `api.recommend()`, `api.searchGrouped()` analog
- **Accessibility:** `role="status"`, `aria-live="polite"`, `role="alert"` — beibehalten fuer neue Interaktionen

### Integration Points
- **SearchPage.tsx:** Hauptintegrationspunkt — bekommt Toggle, Filter, Pagination, Compare-State
- **api.ts:** Muss um `recommend()`, `searchGrouped()`, `search()` mit search_type/cursor Parameter erweitert werden
- **App.tsx:** Ggf. CompareContext analog zu BookmarkContext fuer seitenuebergreifende Vergleichsauswahl

</code_context>

<specifics>
## Specific Ideas

- Mini-Cards fuer Recommend-Ergebnisse sollen visuell klar als "Unter-Ergebnisse" erkennbar sein (Einrueckung, subtilerer Style)
- Accordion in gruppierter Ansicht: Erste Gruppe automatisch offen, Rest geschlossen
- Filter-Chips sollen entfernbar sein (X-Button) mit "Alle zuruecksetzen" Option
- "Mehr laden" Button zeigt ungefaehre Gesamtzahl: "10 von ~42 Ergebnissen"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-search-results-ux*
*Context gathered: 2026-03-27*

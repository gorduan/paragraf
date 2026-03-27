# Phase 3: Design System Foundation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a consistent design token system (colors, spacing, typography, shadows, radii) and reusable primitive UI components that all subsequent UI phases (8, 9, 10) build upon. Migrate SearchPage and Sidebar to validate the new system. Backend-agnostic — purely frontend work.

Requirements: UI-01 (Design-System mit konsistenten Tokens)

</domain>

<decisions>
## Implementation Decisions

### Token System
- **D-01:** Vollstaendige Token-Palette: Semantic Colors (success/warning/error/info je 50-900), Spacing-Scale (4px-Basis), Typography-Scale (5-6 Stufen), Shadows (3 Stufen), Border-Radii (3 Stufen). Alles in TailwindCSS 4 `@theme` Block in `index.css`.
- **D-02:** Primary-Palette von Blau auf Indigo umstellen (500: #6366f1). Wirkt formeller und juristischer. Gesamte `--color-primary-*` Reihe anpassen.
- **D-03:** Dark Mode bleibt class-basiert (`@custom-variant dark`). Token-System definiert Light- und Dark-Varianten fuer alle semantischen Farben.

### Primitive Components
- **D-04:** Erweitertes Set mit 7-8 Primitives: Button, Card, Input, Badge, Dialog, Select/Dropdown, Tooltip, Tabs. Jede Komponente als eigene Datei in `src/components/ui/`.
- **D-05:** Alle Primitives mit Varianten-Support ueber Props (`variant`, `size`). Konsistente API: `<Button variant="primary" size="sm">`. 2-4 Varianten pro Primitive.
- **D-06:** Radix UI Primitives als Headless-Basis fuer Dialog, Select, Tooltip, Tabs. Radix liefert Accessibility-Verhalten (Fokus-Trap, Keyboard-Nav, ARIA), Styling komplett ueber Tailwind.

### Migration
- **D-07:** SearchPage + Sidebar als Referenz-Migration in Phase 3. Restliche Pages (LookupPage, ComparePage, etc.) migrieren in Phase 8-10 wenn sie sowieso ueberarbeitet werden.
- **D-08:** Bestehende Accessibility-Infrastruktur (skip-link, sr-only, focus-visible, reduced-motion, high-contrast) bleibt erhalten und wird in Token-System integriert.

### Claude's Discretion
- Genaue Indigo-Farbwerte (50-900) und Semantic Color Paletten
- Spacing-Scale Stufen und Naming
- Typography-Scale Stufen (font-size + line-height + weight Kombinationen)
- Shadow-Stufen (sm/md/lg oder aehnlich)
- Radix-Paketauswahl (welche `@radix-ui/*` Pakete konkret)
- Interne Implementierung der Varianten (className-Mapping, cva/clsx, oder plain objects)
- Ob ein `cn()` Utility-Helper fuer className-Merging sinnvoll ist

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend Styles & Config
- `frontend/src/styles/index.css` — Bestehende `@theme` Block mit Primary-Palette, Accessibility-CSS, Dark-Mode-Variant
- `frontend/vite.config.ts` — Vite-Config mit `@` Path-Alias und Tailwind-Plugin
- `frontend/tsconfig.json` — TypeScript strict mode, path aliases
- `frontend/package.json` — Aktuelle Dependencies (TailwindCSS 4, React 19, Vite 6)

### Existing Components (Migration Targets)
- `frontend/src/pages/SearchPage.tsx` — Hauptseite, Referenz-Migration auf neue Primitives
- `frontend/src/components/Sidebar.tsx` — Navigation, Referenz-Migration
- `frontend/src/components/SearchBar.tsx` — Nutzt Input-artige Elemente, Kandidat fuer Input-Primitive
- `frontend/src/components/ResultCard.tsx` — Nutzt Card-artige Patterns, Kandidat fuer Card-Primitive

### Patterns & Conventions
- `.planning/codebase/CONVENTIONS.md` — Frontend-Naming, Component-Patterns, Accessibility-Conventions
- `.planning/codebase/STACK.md` — TailwindCSS 4, React 19, Vite 6 Versionen

### Prior Phase Context
- `.planning/phases/01-snapshot-safety-net/01-CONTEXT.md` — Established single-surface API pattern
- `.planning/phases/02-search-indexes-full-text/02-CONTEXT.md` — Clean conventions preference confirmed

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `index.css` `@theme` Block: Bereits TailwindCSS 4 Token-Infrastruktur vorhanden. Erweitern, nicht ersetzen.
- Dark Mode Variant: `@custom-variant dark (&:where(.dark, .dark *))` bereits konfiguriert.
- Accessibility CSS: Skip-link, sr-only, focus-visible, reduced-motion, high-contrast — alles bleibt.
- `ThemeContext` in `App.tsx`: Dark/Light Toggle bereits implementiert.

### Established Patterns
- Named exports fuer Components: `export function SearchPage()`
- Props interfaces direkt ueber der Komponente definiert
- Keine Barrel-Files — direkter Import aus spezifischen Dateien
- `@/*` Path-Alias fuer Imports

### Integration Points
- `frontend/src/components/ui/` — Neues Verzeichnis fuer Primitive Components
- `frontend/src/styles/index.css` — Token-Erweiterung im `@theme` Block
- `frontend/package.json` — Radix UI Dependencies hinzufuegen
- `frontend/src/pages/SearchPage.tsx` — Referenz-Migration
- `frontend/src/components/Sidebar.tsx` — Referenz-Migration

</code_context>

<specifics>
## Specific Ideas

- **Indigo-Palette**: User waehlt bewusst Indigo statt Blau fuer einen juristisch-serioeseren Look. Die Palette soll sich deutlich von der bisherigen blauen Primary-Farbe unterscheiden.
- **Erweitertes Primitives-Set**: User investiert bewusst mehr Aufwand jetzt (7-8 Primitives mit Varianten), um Ad-hoc-Styling in Phase 8-10 zu minimieren.
- **Radix fuer Accessibility**: Explizite Entscheidung gegen Handrolling von Dialog/Select/Tooltip Accessibility-Logik.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-design-system-foundation*
*Context gathered: 2026-03-27*

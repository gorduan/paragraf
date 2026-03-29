# Phase 10: Dashboard, Export & Polish - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The application becomes feature-complete with snapshot management in the index dashboard, document export across all pages, WCAG 2.1 AA accessibility compliance, and responsive tablet-friendly design. This is the final phase of the milestone.

Requirements: INFRA-05 (Snapshot-Button im Index-Dashboard), UI-09 (PDF/Markdown-Export), UI-11 (Responsive Design + Accessibility Audit), UI-12 (Snapshot-Management im Index-Dashboard)

</domain>

<decisions>
## Implementation Decisions

### Snapshot Management UI
- **D-01:** Dedicated section below the existing donut chart + stats area in IndexPage. Always visible, not behind a tab or dialog. Shows snapshot list with create/restore/delete actions.
- **D-02:** Confirmation Dialog (Radix Dialog) for destructive actions (restore, delete). Warning text, snapshot name, and explicit action button. Consistent with existing Dialog component from Phase 3.
- **D-03:** Each snapshot displays: name, creation timestamp (relative format like "vor 2 Stunden"), and file size. Backend already returns all three fields via GET /api/snapshots.
- **D-04:** Both manual and auto-snapshot: manual "Snapshot erstellen" button always available, plus optional "Auto-Snapshot vor Indexierung" toggle. When enabled, system creates snapshot before each re-index run. Backend auto-deletes oldest when max (3) reached.

### Export Format & Scope
- **D-05:** PDF + Markdown both supported. PDF for sharing/printing (lawyers, officials), Markdown for further editing/integration.
- **D-06:** All pages exportable: search results, comparisons, individual lookups, law browser sections, citation graph. Comprehensive export coverage.
- **D-07:** Client-side PDF generation using a JS library (e.g., jspdf or html2pdf.js). No backend changes needed. Adds ~200KB to bundle.
- **D-08:** Both global and per-item export: "Alles exportieren" toolbar button with format dropdown (PDF/Markdown) on each page, plus per-card/per-item export option on individual results.

### Accessibility (WCAG 2.1 AA)
- **D-09:** Pragmatic AA compliance: aria-labels on all interactive elements, keyboard navigation through all pages, proper focus management in dialogs/modals, contrast ratio check on design tokens. Manual review against checklist, no formal audit tool.
- **D-10:** Structural screen reader support: correct heading hierarchy, landmark regions (main, nav, aside), aria-labels, and live regions for dynamic content. No actual screen reader QA — proper HTML semantics assumed.
- **D-11:** aria-live regions on ALL dynamic content areas: search results count updates, loading spinners, filter updates, indexing progress/completion, snapshot operation status, graph interactions, tooltip content, error messages.

### Responsive & Tablet Polish
- **D-12:** Sidebar collapses to hamburger menu icon on screens < 1024px (lg breakpoint). Tap to open as overlay. Standard responsive pattern, touch-friendly.
- **D-13:** Target breakpoint md: 768px for tablet layout. Below md = stacked mobile layout, above md = side-by-side. Covers iPad portrait and most tablets.
- **D-14:** Enforce 44px minimum touch targets on all interactive elements (buttons, links, checkboxes) per WCAG 2.5.5. Review and fix all components.

### Claude's Discretion
- Exact PDF library choice (jspdf vs html2pdf.js vs alternative)
- PDF styling and layout (header, footer, page numbers, fonts)
- Markdown template structure for each exportable page
- Snapshot section visual design (table vs cards)
- Auto-snapshot toggle placement (in snapshot section vs settings)
- Hamburger menu animation and overlay styling
- Specific heading hierarchy restructuring per page
- Which Tailwind responsive utilities to apply per component
- aria-live politeness levels (polite vs assertive) per context

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Snapshot API (fully implemented)
- `backend/src/paragraf/api.py` lines 1354-1450 — REST endpoints: POST /api/snapshots, GET /api/snapshots, POST /api/snapshots/{name}/restore, DELETE /api/snapshots/{name}
- `backend/src/paragraf/api_models.py` lines 221-248 — SnapshotInfo, SnapshotListResponse, SnapshotCreateResponse, SnapshotRestoreResponse models
- `backend/src/paragraf/services/qdrant_store.py` — Snapshot service methods
- `backend/src/paragraf/config.py` line 51 — snapshot_max_count setting (default: 3)

### Frontend (integration targets)
- `frontend/src/pages/IndexPage.tsx` — Current index dashboard (donut chart, stats, queue pipeline, log viewer)
- `frontend/src/lib/api.ts` — REST client (needs snapshot methods added)
- `frontend/src/components/ui/Dialog.tsx` — Radix-based Dialog component (for confirmation modals)
- `frontend/src/components/ui/Button.tsx` — Button with variants (for actions)
- `frontend/src/components/ui/Tabs.tsx` — Tabs component (available but not used for snapshots)
- `frontend/src/components/Sidebar.tsx` — Navigation sidebar (responsive hamburger target)
- `frontend/src/styles/index.css` — Existing a11y CSS: skip-link, sr-only, focus-visible, reduced-motion, high-contrast

### Prior Phase Context
- `.planning/phases/03-design-system-foundation/03-CONTEXT.md` — Design tokens, Radix primitives, cva+cn() pattern
- `.planning/phases/08-search-results-ux/08-CONTEXT.md` — Filter chips pattern, collapsible panel, localStorage persistence
- `.planning/phases/09-cross-reference-discovery-ux/09-CONTEXT.md` — Canvas graph rendering, d3-force, side panel pattern

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — Full directory layout and component inventory
- `.planning/codebase/CONVENTIONS.md` — Naming and code style patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Dialog` component (Radix-based): Ready for snapshot confirmation modals
- `Button` component with variants: Ready for export/snapshot action buttons
- `StatCard` component in IndexDashboard: Can be reused for snapshot stats
- `Badge` component: Can indicate snapshot status
- `Tooltip` component (Radix): For export format hints
- Design tokens (indigo palette, spacing, shadows): Consistent styling foundation
- `cn()` utility + cva: Component variant pattern established

### Established Patterns
- localStorage persistence: Used for theme, bookmarks, search history, view mode (Phase 8)
- Collapsible panel pattern: Filter panel in SearchPage (Phase 8) — reusable for responsive sidebar
- SSE streaming: IndexPage already handles real-time log streaming — pattern for snapshot progress
- Radix Dialog: Close button with sr-only label "Schliessen" already accessible

### Integration Points
- IndexPage: Snapshot section integrates below existing stats area
- api.ts: Needs 4 new snapshot methods + export helper methods
- Sidebar: Needs responsive hamburger toggle at lg breakpoint
- All pages: Export toolbar button integration
- All interactive elements: aria-label audit pass
- index.css: May need additional responsive utility classes

</code_context>

<specifics>
## Specific Ideas

- Auto-snapshot toggle provides safety net without manual intervention before re-indexing
- Per-item export alongside global export gives maximum flexibility for both quick single-paragraph sharing and full result set export
- aria-live on ALL dynamic content (not just key areas) ensures comprehensive screen reader coverage
- 44px touch targets enforced as explicit WCAG 2.5.5 requirement, not just "trust defaults"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-dashboard-export-polish*
*Context gathered: 2026-03-28*

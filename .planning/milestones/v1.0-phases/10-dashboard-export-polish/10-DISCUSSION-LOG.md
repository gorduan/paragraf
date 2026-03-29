# Phase 10: Dashboard, Export & Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 10-dashboard-export-polish
**Areas discussed:** Snapshot Management UI, Export Format & Scope, Accessibility Audit Scope, Responsive & Tablet Polish

---

## Snapshot Management UI

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated section below stats | New "Snapshots" section below donut chart + stats. Always visible. | :heavy_check_mark: |
| Tab alongside indexing | Tabs component with "Indexierung" and "Snapshots" tabs. | |
| Dialog from toolbar button | "Snapshots verwalten" button opens Dialog. | |

**User's choice:** Dedicated section below stats
**Notes:** Fits naturally into the dashboard layout, always visible without extra clicks.

### Confirmation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation Dialog | Radix Dialog with warning text, snapshot name, explicit action button. | :heavy_check_mark: |
| Inline confirm button | Button changes to red "Sicher?" for 3 seconds, click again. | |
| You decide | Claude picks. | |

**User's choice:** Confirmation Dialog
**Notes:** Consistent with existing Dialog component from Phase 3.

### Snapshot Info Display

| Option | Description | Selected |
|--------|-------------|----------|
| Name + Datum + Groesse | All three fields, compact table or card layout. | :heavy_check_mark: |
| Minimal: Name + Datum | Just name and timestamp. | |
| Rich: + Collection stats | Would need backend changes. | |

**User's choice:** Name + Datum + Groesse
**Notes:** Backend already returns all three fields.

### Auto-Snapshot Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Manual only | User clicks "Snapshot erstellen" explicitly. | |
| Auto before indexing | Automatic snapshot before every re-index. | |
| Both with toggle | Manual button + optional "Auto-Snapshot vor Indexierung" toggle. | :heavy_check_mark: |

**User's choice:** Both with toggle
**Notes:** Maximum flexibility — manual always available, auto-snapshot optional.

---

## Export Format & Scope

### Formats

| Option | Description | Selected |
|--------|-------------|----------|
| PDF + Markdown | Both formats for different use cases. | :heavy_check_mark: |
| Markdown only | Simpler, no new dependencies. | |
| PDF only | Primary legal document format. | |

**User's choice:** PDF + Markdown
**Notes:** PDF for lawyers/officials, Markdown for editing/integration.

### Exportable Pages

| Option | Description | Selected |
|--------|-------------|----------|
| Search results + Comparisons | Main work products only. | |
| Everything | All pages: search, comparisons, lookups, law browser, graph. | :heavy_check_mark: |
| Comparisons only | Minimal scope. | |

**User's choice:** Everything
**Notes:** Comprehensive export coverage across all pages.

### Generation Location

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side | JS library in browser, no backend changes. | :heavy_check_mark: |
| Backend endpoint | Server-side with weasyprint. | |
| You decide | Claude picks. | |

**User's choice:** Client-side
**Notes:** No backend changes needed, works offline, adds ~200KB to bundle.

### Export UX Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Consistent toolbar button | "Exportieren" button with dropdown on each page. | |
| Context menu per item | Per-card export option. | |
| Both: toolbar + per-item | Global + per-card export. | :heavy_check_mark: |

**User's choice:** Both: toolbar + per-item
**Notes:** Maximum flexibility for both bulk and individual export.

---

## Accessibility Audit Scope

### Priority Level

| Option | Description | Selected |
|--------|-------------|----------|
| Pragmatic AA | aria-labels, keyboard nav, focus management, contrast check. Manual review. | :heavy_check_mark: |
| Comprehensive audit | Automated tool + manual testing. | |
| Minimal: keyboard + contrast | Only two most impactful categories. | |

**User's choice:** Pragmatic AA
**Notes:** Manual review against checklist, no formal audit tool.

### Screen Reader Support

| Option | Description | Selected |
|--------|-------------|----------|
| Structural only | Heading hierarchy, landmarks, aria-labels, live regions. No actual SR QA. | :heavy_check_mark: |
| Skip SR scope | Focus on keyboard and visual only. | |
| Full SR support | All ARIA live regions + NVDA/VoiceOver testing. | |

**User's choice:** Structural only
**Notes:** Proper HTML semantics assumed to provide implicit SR support.

### aria-live Regions

| Option | Description | Selected |
|--------|-------------|----------|
| Key areas only | Search results, indexing progress, snapshot status, errors. | |
| All dynamic content | Every state change gets aria-live. | :heavy_check_mark: |
| You decide | Claude picks. | |

**User's choice:** All dynamic content
**Notes:** Comprehensive screen reader coverage for all dynamic updates.

---

## Responsive & Tablet Polish

### Sidebar Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible with hamburger | Collapses to hamburger at < 1024px, opens as overlay. | :heavy_check_mark: |
| Bottom navigation bar | Replace sidebar with bottom tabs on mobile. | |
| Always visible, narrower | Icon-only sidebar on tablet. | |

**User's choice:** Collapsible with hamburger
**Notes:** Standard responsive pattern, touch-friendly.

### Target Breakpoint

| Option | Description | Selected |
|--------|-------------|----------|
| md: 768px | Standard Tailwind md. Covers iPad portrait. | :heavy_check_mark: |
| lg: 1024px | More conservative, landscape iPad. | |
| You decide | Claude picks per page. | |

**User's choice:** md: 768px
**Notes:** Below md = stacked mobile, above md = side-by-side.

### Touch Targets

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, enforce 44px minimum | WCAG 2.5.5: all interactive elements >= 44x44px. | :heavy_check_mark: |
| Trust Tailwind defaults | Only fix obvious violations. | |
| You decide | Claude audits and fixes as needed. | |

**User's choice:** Yes, enforce 44px minimum
**Notes:** Explicit WCAG 2.5.5 compliance, not relying on defaults.

---

## Claude's Discretion

- PDF library choice (jspdf vs html2pdf.js)
- PDF layout details (headers, footers, page numbers)
- Markdown template structure per page
- Snapshot section visual design
- Auto-snapshot toggle placement
- Hamburger menu animation/overlay styling
- Heading hierarchy restructuring
- Responsive utility application per component
- aria-live politeness levels per context

## Deferred Ideas

None — discussion stayed within phase scope.

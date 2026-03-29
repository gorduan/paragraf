# Phase 10: Dashboard, Export & Polish - Research

**Researched:** 2026-03-28
**Domain:** Frontend UX (Snapshot Management, PDF/Markdown Export, Accessibility, Responsive Design)
**Confidence:** HIGH

## Summary

Phase 10 is the final milestone phase, making the application feature-complete. It covers four distinct workstreams: (1) Snapshot management UI in the IndexPage, (2) client-side PDF/Markdown export across all pages, (3) WCAG 2.1 AA accessibility compliance, and (4) responsive design for tablet screens. The backend snapshot API is fully implemented (POST/GET/DELETE/RESTORE on `/api/snapshots`), so this phase is frontend-only except for adding API client methods.

The primary technical risks are: PDF library choice affecting bundle size and text selectability, comprehensive aria-live coverage across all dynamic content areas, and responsive sidebar conversion from fixed panel to hamburger overlay. All of these are well-understood patterns with established solutions.

**Primary recommendation:** Use jsPDF 4.x for programmatic PDF generation (not html2canvas screenshot approach) to produce selectable text PDFs. Use native `Intl.RelativeTimeFormat` with `de` locale for snapshot timestamps. Implement responsive sidebar via Tailwind breakpoints + React state, not a CSS-only approach.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dedicated snapshot section below donut chart + stats area in IndexPage. Always visible, not behind a tab or dialog.
- **D-02:** Confirmation Dialog (Radix Dialog) for destructive actions (restore, delete).
- **D-03:** Each snapshot displays: name, creation timestamp (relative format), and file size.
- **D-04:** Manual "Snapshot erstellen" button + optional "Auto-Snapshot vor Indexierung" toggle. Backend auto-deletes oldest when max (3) reached.
- **D-05:** PDF + Markdown both supported.
- **D-06:** All pages exportable: search results, comparisons, individual lookups, law browser sections, citation graph.
- **D-07:** Client-side PDF generation using a JS library. No backend changes needed.
- **D-08:** Both global and per-item export: "Alles exportieren" toolbar button + per-card export option.
- **D-09:** Pragmatic AA compliance: aria-labels, keyboard nav, focus management, contrast check. Manual review, no formal audit tool.
- **D-10:** Correct heading hierarchy, landmark regions, aria-labels, live regions.
- **D-11:** aria-live regions on ALL dynamic content areas.
- **D-12:** Sidebar collapses to hamburger menu on screens < 1024px.
- **D-13:** Target breakpoint md: 768px for tablet layout.
- **D-14:** 44px minimum touch targets on all interactive elements per WCAG 2.5.5.

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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-05 | Snapshot-Button im Index-Dashboard (Frontend) | Snapshot API fully implemented in backend. Frontend needs API client methods + SnapshotSection component. See Standard Stack and Architecture Patterns. |
| UI-09 | PDF/Markdown-Export von Ergebnissen und Vergleichen | jsPDF 4.x for PDF, plain string assembly for Markdown. ExportDropdown + ExportButton components. See Code Examples. |
| UI-11 | Responsive Design-Verbesserungen und Accessibility-Audit (WCAG 2.1 AA) | Tailwind responsive utilities, aria-live regions, heading hierarchy audit. See Common Pitfalls and Architecture Patterns. |
| UI-12 | Snapshot-Management im Index-Dashboard (erstellen, Status, wiederherstellen) | SnapshotSection + SnapshotCard components with Dialog confirmations. See Architecture Patterns. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Branch:** All commits on `Docker-only` branch, never directly on main/master
- **Stack:** React 19 + Vite 6 + TailwindCSS 4, no new frameworks
- **Component pattern:** cva + cn() + Radix primitives (from Phase 3)
- **Language:** German UI, German docstrings, English variable/function names
- **Icons:** lucide-react ^0.460.0
- **Type safety:** TypeScript strict mode
- **Accessibility conventions:** Already established -- role="status", aria-live, aria-label, sr-only, skip-link, prefers-reduced-motion, prefers-contrast, focus-visible

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jspdf | 4.2.1 | Client-side PDF generation | Programmatic API produces selectable text (not screenshots). ES6 module support, fflate compression (10-20% smaller than pako). ~200KB minified+gzipped. |
| Intl.RelativeTimeFormat | Built-in | German relative timestamps | Native browser API, zero dependencies. `de` locale produces "vor 2 Stunden" etc. No library needed. |
| @radix-ui/react-dialog | ^1.1.15 | Confirmation dialogs | Already installed. Used for restore/delete confirmations. |
| @radix-ui/react-tooltip | ^1.2.8 | Icon button labels | Already installed. Snapshot action icons use tooltips. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.460.0 | Icons | Already installed. New icons: RotateCcw, Trash2, Menu, X, Download, FileText, FileDown, Camera. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsPDF (programmatic) | html2pdf.js (screenshot) | html2pdf.js is simpler (DOM to PDF in one call) but produces image-based PDFs with no selectable text. jsPDF produces real text PDFs. For a legal app where users copy/paste paragraphs, text selectability is critical. |
| jsPDF (programmatic) | @react-pdf/renderer | @react-pdf/renderer (v4.3.2) uses its own React renderer with custom components. Overkill for this use case -- would require reimplementing every page layout in a parallel component tree. |
| No timestamp library | date-fns/dayjs | Intl.RelativeTimeFormat is built-in, supports German, covers the exact use case. No dependency needed. |

**Installation:**
```bash
cd frontend && npm install jspdf
```

**Version verification:** jsPDF 4.2.1 verified via `npm view jspdf version` (2026-03-28).

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── SnapshotSection.tsx      # Snapshot list + create + auto-toggle
│   ├── SnapshotCard.tsx         # Individual snapshot display
│   ├── ExportDropdown.tsx       # Global "Alles exportieren" with format picker
│   ├── ExportButton.tsx         # Per-item export (icon button + format menu)
│   └── Sidebar.tsx              # MODIFIED: responsive hamburger
├── lib/
│   ├── api.ts                   # MODIFIED: add snapshot API methods
│   ├── export-pdf.ts            # PDF generation logic per page type
│   ├── export-markdown.ts       # Markdown generation logic per page type
│   └── relative-time.ts         # Intl.RelativeTimeFormat helper
├── pages/
│   ├── IndexPage.tsx            # MODIFIED: integrate SnapshotSection
│   ├── SearchPage.tsx           # MODIFIED: add ExportDropdown
│   ├── ComparePage.tsx          # MODIFIED: add ExportDropdown
│   ├── LookupPage.tsx           # MODIFIED: add ExportButton
│   ├── LawBrowserPage.tsx       # MODIFIED: add ExportDropdown
│   └── GraphPage.tsx            # MODIFIED: add ExportDropdown
└── App.tsx                      # MODIFIED: sidebar state, aria-live regions
```

### Pattern 1: Snapshot API Client Methods
**What:** Add 4 methods to the existing `api` object in `api.ts` matching the backend endpoints.
**When to use:** All snapshot operations from SnapshotSection.
**Example:**
```typescript
// In frontend/src/lib/api.ts
export interface SnapshotInfo {
  name: string;
  creation_time: string | null;
  size: number;
}

export interface SnapshotListResponse {
  snapshots: SnapshotInfo[];
  total: number;
}

export interface SnapshotCreateResponse {
  erfolg: boolean;
  name: string;
  nachricht: string;
  geloeschte_snapshots: string[];
}

export interface SnapshotRestoreResponse {
  erfolg: boolean;
  nachricht: string;
}

// Methods on api object:
async createSnapshot(): Promise<SnapshotCreateResponse> {
  const res = await fetch(`${BASE_URL}/api/snapshots`, { method: "POST" });
  if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
  return res.json();
},

async listSnapshots(): Promise<SnapshotListResponse> {
  const res = await fetch(`${BASE_URL}/api/snapshots`);
  if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
  return res.json();
},

async restoreSnapshot(name: string): Promise<SnapshotRestoreResponse> {
  const res = await fetch(`${BASE_URL}/api/snapshots/${encodeURIComponent(name)}/restore`, { method: "POST" });
  if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
  return res.json();
},

async deleteSnapshot(name: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/snapshots/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
},
```

### Pattern 2: jsPDF Programmatic Generation
**What:** Build PDFs line-by-line using jsPDF API. No DOM screenshots.
**When to use:** All PDF exports.
**Example:**
```typescript
// frontend/src/lib/export-pdf.ts
import { jsPDF } from "jspdf";

export function exportSearchResultsPdf(
  results: SearchResultItem[],
  query: string,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.text(`Paragraf – Suchergebnisse`, 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Anfrage: "${query}" | ${new Date().toLocaleDateString("de-DE")}`, 14, y);
  y += 12;

  // Results
  doc.setFontSize(11);
  for (const item of results) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont(undefined, "bold");
    doc.text(`${item.chunk.metadata.gesetz} ${item.chunk.metadata.paragraph}`, 14, y);
    y += 6;
    doc.setFont(undefined, "normal");
    const lines = doc.splitTextToSize(item.chunk.text, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 8;
  }

  // Disclaimer footer
  const disclaimer = "Generiert mit Paragraf – keine individuelle Rechtsberatung (RDG).";
  doc.setFontSize(8);
  doc.text(disclaimer, 14, doc.internal.pageSize.getHeight() - 10);

  doc.save(`paragraf-suchergebnisse-${Date.now()}.pdf`);
}
```

### Pattern 3: Responsive Sidebar with React State
**What:** Sidebar visibility controlled by React state + Tailwind breakpoint classes.
**When to use:** Sidebar responsive conversion.
**Example:**
```typescript
// In App.tsx - add sidebar state
const [sidebarOpen, setSidebarOpen] = useState(false);

// In layout JSX
<div className="flex h-screen overflow-hidden">
  {/* Backdrop overlay for mobile */}
  {sidebarOpen && (
    <div
      className="fixed inset-0 bg-black/50 z-40 lg:hidden"
      onClick={() => setSidebarOpen(false)}
      aria-label="Navigation schliessen"
    />
  )}

  {/* Sidebar: hidden on mobile unless open, always visible on lg+ */}
  <div className={`
    fixed inset-y-0 left-0 z-50 w-56 transform transition-transform duration-200 ease-out
    lg:relative lg:translate-x-0
    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
    motion-reduce:transition-none
  `}>
    <Sidebar currentPage={page} onPageChange={(p) => { setPage(p); setSidebarOpen(false); }} backendState={healthState} />
  </div>

  {/* Hamburger button: visible only below lg */}
  <button
    className="fixed top-3 left-3 z-30 lg:hidden min-h-[44px] min-w-[44px] p-2 rounded-lg bg-white/90 dark:bg-neutral-800/90 shadow-md"
    onClick={() => setSidebarOpen(true)}
    aria-label="Navigation oeffnen"
  >
    <Menu size={24} />
  </button>

  <main ref={mainRef} id="main-content" className="flex-1 overflow-auto lg:ml-0" tabIndex={-1}>
    {renderPage()}
  </main>
</div>
```

### Pattern 4: Relative Time Formatting
**What:** Use built-in `Intl.RelativeTimeFormat` for German "vor X Stunden" format.
**When to use:** Snapshot timestamp display.
**Example:**
```typescript
// frontend/src/lib/relative-time.ts
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
  ["second", 1000],
];

const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

export function relativeTime(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === "second") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "gerade eben";
}
```

### Pattern 5: Markdown Export (String Assembly)
**What:** Assemble Markdown from structured data. No DOM conversion.
**When to use:** All Markdown exports.
**Example:**
```typescript
// frontend/src/lib/export-markdown.ts
export function exportSearchResultsMd(
  results: SearchResultItem[],
  query: string,
): string {
  const lines: string[] = [
    `# Paragraf -- Suchergebnisse`,
    ``,
    `**Anfrage:** ${query}`,
    `**Datum:** ${new Date().toLocaleDateString("de-DE")}`,
    `**Ergebnisse:** ${results.length}`,
    ``,
    `---`,
    ``,
  ];

  for (const item of results) {
    const m = item.chunk.metadata;
    lines.push(`## ${m.gesetz} ${m.paragraph}`);
    if (m.titel) lines.push(`*${m.titel}*`);
    lines.push(``);
    lines.push(item.chunk.text);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  lines.push(`> Generiert mit Paragraf -- keine individuelle Rechtsberatung (RDG).`);
  return lines.join("\n");
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Anti-Patterns to Avoid
- **html2canvas for legal text:** Produces image-based PDFs where text is not selectable or searchable. Unacceptable for a legal application.
- **CSS-only responsive sidebar:** Using `@media` queries alone without React state creates problems with focus management and overlay backdrop. Need React state for accessibility.
- **Inline responsive styles everywhere:** Use a consistent pattern -- Tailwind breakpoint classes (sm:, md:, lg:) not ad-hoc px values.
- **Global aria-live on body:** One aria-live region for everything causes announcement flooding. Use targeted regions per content area.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative time ("vor 2 Stunden") | Custom date math + German strings | `Intl.RelativeTimeFormat("de")` | Built-in, handles all edge cases, proper German grammar |
| Confirmation dialogs | Custom modal with focus trap | Radix Dialog (already installed) | Focus trapping, escape handling, return focus, aria attributes |
| PDF text layout | Manual coordinate math for wrapping | `jsPDF.splitTextToSize()` | Handles word-wrapping, page breaks, unicode |
| File download trigger | Complex Blob/URL management | `jsPDF.save()` / simple Blob+anchor | Standard patterns, browser handles cleanup |
| Touch target sizing | Custom CSS per element | Tailwind `min-h-[44px] min-w-[44px]` | Consistent, auditable, one pattern |

**Key insight:** This phase is primarily UI integration work. Every building block (Dialog, Button, Tooltip, design tokens) already exists from Phase 3. The work is wiring them together correctly, not building new primitives.

## Common Pitfalls

### Pitfall 1: jsPDF Unicode/German Characters
**What goes wrong:** jsPDF default font (Helvetica) does not support German special characters (umlauts) consistently. Some chars render as question marks.
**Why it happens:** jsPDF ships with a limited built-in font set. The default fonts handle basic Latin but can struggle with Unicode.
**How to avoid:** Test early with German text containing umlauts, sharp-s. The built-in Helvetica in jsPDF 4.x should handle standard German chars, but verify. If issues arise, embed a TTF font via `doc.addFont()`.
**Warning signs:** Question marks or blank squares in PDF output for ae/oe/ue/ss characters.

### Pitfall 2: Sidebar z-index Stacking
**What goes wrong:** Hamburger overlay sidebar appears behind modals, dropdowns, or the health overlay.
**Why it happens:** z-index wars between overlay backdrop, sidebar panel, Dialog, and HealthOverlay.
**How to avoid:** Establish clear z-index hierarchy: sidebar backdrop z-40, sidebar panel z-50, Dialog (Radix portals to body) z-[100], HealthOverlay z-[200]. Document in one place.
**Warning signs:** Clicking sidebar backdrop triggers elements underneath, or dialogs appear behind sidebar.

### Pitfall 3: aria-live Announcement Flooding
**What goes wrong:** Screen readers announce every minor state change, making the app unusable for SR users.
**Why it happens:** D-11 requires aria-live on ALL dynamic content, but "polite" announcements still queue and can overwhelm.
**How to avoid:** Use `aria-live="polite"` for most updates. Debounce rapid updates (e.g., filter changes). For search results count, only announce the final count, not intermediate states. Use `aria-live="assertive"` ONLY for errors.
**Warning signs:** Multiple rapid announcements during search/filter operations.

### Pitfall 4: Export Button Proliferation
**What goes wrong:** Every page gets slightly different export logic, leading to 6+ copies of similar but divergent code.
**Why it happens:** Each page has different data shapes (SearchResultItem, CompareResult, LookupResult, etc.).
**How to avoid:** Create a unified export interface. Each page provides an `ExportData` object with `title`, `items: Array<{heading, text, metadata}>`, and optional `disclaimer`. The export-pdf and export-markdown modules consume this single interface.
**Warning signs:** Copy-pasting export logic across pages with minor variations.

### Pitfall 5: Touch Target Audit Incompleteness
**What goes wrong:** Some interactive elements (pagination buttons, filter chips, small icon buttons) are missed during the 44px audit.
**Why it happens:** Easy to check obvious buttons but forget about inline links, chip close buttons, pagination arrows.
**How to avoid:** Systematic component-by-component audit. Check every component that renders `<button>`, `<a>`, or `onClick` handlers. Use DevTools to measure computed dimensions.
**Warning signs:** Tap targets that are visually small (icons, close buttons, filter chips).

### Pitfall 6: Responsive Sidebar Focus Trap
**What goes wrong:** When sidebar overlay is open, user can Tab to elements behind it, or focus gets lost when closing.
**Why it happens:** Simple overlay + sidebar without proper focus management.
**How to avoid:** When sidebar opens: focus the first nav item. When sidebar closes (backdrop click, nav item click, Escape): return focus to hamburger button. Add `inert` attribute on main content when sidebar overlay is open.
**Warning signs:** Tab key reaches elements behind the sidebar overlay.

### Pitfall 7: Auto-Snapshot Race Condition
**What goes wrong:** User clicks "Index starten" while auto-snapshot is creating, causing two concurrent operations.
**Why it happens:** Auto-snapshot triggers before indexing, but if the snapshot POST is slow, the user might click again.
**How to avoid:** Disable the index button while auto-snapshot is in progress. Show a clear "Erstelle Snapshot..." state. Only start indexing after snapshot completes or fails.
**Warning signs:** Error from backend about concurrent Qdrant operations.

## Code Examples

### Snapshot Section Component Structure
```typescript
// frontend/src/components/SnapshotSection.tsx
import React, { useState, useEffect, useCallback } from "react";
import { api, type SnapshotInfo } from "@/lib/api";
import { SnapshotCard } from "./SnapshotCard";
import { Button } from "./ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/Dialog";
import { Camera, Plus } from "lucide-react";

interface SnapshotSectionProps {
  onAutoSnapshotChange?: (enabled: boolean) => void;
}

export function SnapshotSection({ onAutoSnapshotChange }: SnapshotSectionProps) {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [autoSnapshot, setAutoSnapshot] = useState(() => {
    return localStorage.getItem("paragraf-auto-snapshot") === "true";
  });
  // ... confirmation dialog state, CRUD operations
}
```

### Export Data Interface (Unified)
```typescript
// frontend/src/lib/export-types.ts
export interface ExportItem {
  heading: string;
  subheading?: string;
  text: string;
  metadata?: Record<string, string>;
}

export interface ExportData {
  title: string;
  subtitle?: string;
  date: string;
  items: ExportItem[];
  disclaimer: string;
}

// Each page converts its data to ExportData:
function searchToExportData(results: SearchResultItem[], query: string): ExportData {
  return {
    title: "Suchergebnisse",
    subtitle: `Anfrage: "${query}"`,
    date: new Date().toLocaleDateString("de-DE"),
    items: results.map(r => ({
      heading: `${r.chunk.metadata.gesetz} ${r.chunk.metadata.paragraph}`,
      subheading: r.chunk.metadata.titel || undefined,
      text: r.chunk.text,
      metadata: { score: String(r.score) },
    })),
    disclaimer: "Generiert mit Paragraf -- keine individuelle Rechtsberatung (RDG).",
  };
}
```

### Accessibility: aria-live Region Pattern
```typescript
// Reusable live region announcer
const [announcement, setAnnouncement] = useState("");

// After search completes:
setAnnouncement(`${results.length} Ergebnisse gefunden`);

// In JSX:
<div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
  {announcement}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| html2canvas screenshot PDFs | jsPDF 4.x programmatic with fflate | jsPDF 4.0 (2025) | Selectable text, 10-20% smaller files |
| moment.js / date-fns for relative time | `Intl.RelativeTimeFormat` | Browser standard (2020+) | Zero dependency, native German support |
| CSS-only responsive sidebars | React state + Tailwind breakpoints | React 18+ pattern | Proper focus management, accessibility |
| Manual focus trap for overlays | `inert` attribute on background content | HTML spec (2023) | Native focus containment without JS trap library |

**Deprecated/outdated:**
- html2pdf.js: Last updated Oct 2023 (v0.14.0), produces image-based PDFs. Not recommended for text-heavy legal content.
- pako compression in jsPDF: Replaced by fflate in jsPDF 4.x for better performance.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + jsdom + @testing-library/react |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-05 | Snapshot section renders, create/delete/restore calls API | unit | `cd frontend && npx vitest run src/components/__tests__/SnapshotSection.test.tsx` | Wave 0 |
| UI-09 | PDF export produces downloadable file, Markdown assembles correct content | unit | `cd frontend && npx vitest run src/lib/export-pdf.test.ts src/lib/export-markdown.test.ts` | Wave 0 |
| UI-11 | aria-live regions exist, focus management works, heading hierarchy correct | unit | `cd frontend && npx vitest run src/components/__tests__/accessibility.test.tsx` | Wave 0 |
| UI-12 | Snapshot list loads, actions trigger API calls, confirmations shown | unit | `cd frontend && npx vitest run src/components/__tests__/SnapshotSection.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/__tests__/SnapshotSection.test.tsx` -- covers INFRA-05, UI-12
- [ ] `frontend/src/lib/export-pdf.test.ts` -- covers UI-09 (PDF path)
- [ ] `frontend/src/lib/export-markdown.test.ts` -- covers UI-09 (Markdown path)
- [ ] `frontend/src/lib/relative-time.test.ts` -- covers timestamp formatting
- [ ] `frontend/src/components/__tests__/accessibility.test.tsx` -- covers UI-11 (heading hierarchy, aria-live)

## Sources

### Primary (HIGH confidence)
- Backend snapshot API: `backend/src/paragraf/api.py` lines 1354-1447 -- fully implemented CRUD endpoints
- Backend models: `backend/src/paragraf/api_models.py` lines 221-248 -- SnapshotInfo, response models
- Frontend package.json: current dependencies confirmed (Radix Dialog, Tooltip, cva, lucide-react)
- Vitest config: `frontend/vitest.config.ts` -- jsdom environment configured
- npm registry: jsPDF 4.2.1 verified current

### Secondary (MEDIUM confidence)
- [jsPDF npm page](https://www.npmjs.com/package/jspdf) -- version 4.2.1, ES6 module support, fflate compression
- [MDN Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat) -- German locale support, numeric: "auto" option
- [npm-compare: jspdf vs html2pdf.js](https://npm-compare.com/html2pdf.js,jspdf,react-pdf,react-to-pdf) -- library comparison metrics

### Tertiary (LOW confidence)
- [CopyProgramming: jsPDF in React 2026](https://copyprogramming.com/howto/react-transferring-html-elements-to-web-worker-to-generate-pdf-using-jspdf-and-html2canvas) -- web worker patterns (not needed for our scope)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- jsPDF verified on npm, Radix/Tailwind already in project
- Architecture: HIGH -- all integration points verified in existing codebase
- Pitfalls: HIGH -- based on direct code inspection and established patterns
- Export: MEDIUM -- jsPDF German character handling needs runtime verification

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable technologies, 30-day window)

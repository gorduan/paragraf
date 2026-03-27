# Phase 8: Search Results UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 08-search-results-ux
**Areas discussed:** Recommend-Button UX, Grouped vs Flat View, Filter Sidebar/Panel, Pagination & Full-Text

---

## Recommend-Button UX

### Placement of similar paragraphs

| Option | Description | Selected |
|--------|-------------|----------|
| Inline Expansion | Ergebnisse klappen unterhalb der ResultCard auf — kein Kontextwechsel | ✓ |
| Slide-Out Panel | Rechtes Seitenpanel mit aehnlichen Paragraphen | |
| Modal/Dialog | Dialog-Overlay zeigt aehnliche Paragraphen | |

**User's choice:** Inline Expansion
**Notes:** Passt zum bestehenden Expand-Pattern der ResultCard

### Initial result count

| Option | Description | Selected |
|--------|-------------|----------|
| 3 Ergebnisse | Kompakt, schnell ladend, "Mehr laden" fuer weitere | ✓ |
| 5 Ergebnisse | Mehr Kontext auf einen Blick | |
| Du entscheidest | Claude waehlt | |

**User's choice:** 3 Ergebnisse

### Display style

| Option | Description | Selected |
|--------|-------------|----------|
| Mini-Cards | Kompakte Darstellung: Paragraph + Gesetz + Score, aufklappbar | ✓ |
| Volle ResultCards | Dieselbe ResultCard, leicht eingerueckt | |

**User's choice:** Mini-Cards

### Mini-Card actions

| Option | Description | Selected |
|--------|-------------|----------|
| Aufklappen + Vergleichen | Mini-Cards mit Aufklappen und Compare-Button | |
| Alle Aktionen | Aufklappen, Vergleichen UND Bookmark | ✓ |
| Nur Aufklappen | Minimale Interaktion | |

**User's choice:** Alle Aktionen

---

## Grouped vs Flat View

### Toggle mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle-Buttons | Zwei Buttons (Liste / Gruppiert) ueber den Ergebnissen | ✓ |
| Tabs-Komponente | Radix Tabs fuer Ansichtswechsel | |
| Dropdown im SearchBar | Ansichts-Auswahl als Dropdown | |

**User's choice:** Toggle-Buttons

### Group display style

| Option | Description | Selected |
|--------|-------------|----------|
| Accordion | Aufklappbare Sektionen pro Gesetz, erste offen | ✓ |
| Gestapelte Sektionen | Alle Gruppen offen untereinander | |
| Card-Gruppen | Jedes Gesetz als eigene grosse Card | |

**User's choice:** Accordion

### Default view

| Option | Description | Selected |
|--------|-------------|----------|
| Flat List als Default | Flache Liste wie bisher | |
| Gruppiert als Default | Sofort nach Gesetz gruppiert | |
| Letzten Modus merken | localStorage speichert letzte Wahl | ✓ |

**User's choice:** Letzten Modus merken
**Notes:** Konsistent mit bestehendem localStorage-Pattern (Bookmarks, Search History, Dark Mode)

---

## Filter Sidebar/Panel

### Filter layout

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible Panel | Aufklappbar unter SearchBar, Button oeffnet/schliesst | ✓ |
| Sidebar links | Permanente Sidebar neben Ergebnissen | |
| Inline im SearchBar | Filter-Chips im Suchfeld | |

**User's choice:** Collapsible Panel

### Filter apply behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Button "Filter anwenden" | Alle Filter einstellen, dann anwenden | ✓ |
| Sofort bei Aenderung | Jede Aenderung loest neue Suche aus | |
| Du entscheidest | Claude waehlt | |

**User's choice:** Button "Filter anwenden"

### Active filter visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, Filter-Chips | Tags mit X-Button ueber Ergebnissen, "Alle zuruecksetzen" | ✓ |
| Nein, nur im Panel | Filter-Status nur im Panel sichtbar | |

**User's choice:** Filter-Chips

---

## Pagination & Full-Text

### Pagination style

| Option | Description | Selected |
|--------|-------------|----------|
| "Mehr laden" Button | Button am Ende laedt naechste Seite, haengt an | ✓ |
| Seitennummern | Klassische Nummerierung (< 1 2 3 >) | |
| Infinite Scroll | Automatisches Nachladen beim Scrollen | |

**User's choice:** "Mehr laden" Button

### Full-text toggle placement

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle im SearchBar | Segmented-Control direkt im/unter Suchfeld | ✓ |
| Im erweiterten Filter-Panel | Teil der erweiterten Filter | |
| Dropdown neben Suchfeld | Kleines Dropdown-Menu | |

**User's choice:** Toggle im SearchBar

### Search modes

| Option | Description | Selected |
|--------|-------------|----------|
| Semantisch + Volltext + Hybrid | Drei Optionen, Backend unterstuetzt alle | ✓ |
| Nur Semantisch + Volltext | Zwei Optionen ohne Hybrid | |

**User's choice:** Semantisch + Volltext + Hybrid

### Compare wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, verdrahten | onCompare-Prop in SearchPage verdrahten (UI-05) | ✓ |
| Nein, spaeter | Compare-Wiring fuer Phase 10 | |

**User's choice:** Ja, verdrahten

---

## Claude's Discretion

- Styling-Details der Mini-Cards (Einrueckung, Farben, Uebergaenge)
- Accordion-Implementierung (eigene Komponente vs Radix)
- Responsive Breakpoints fuer Filter-Panel
- State-Management fuer Compare-Auswahl
- Genaue deutsche UI-Labels

## Deferred Ideas

None — discussion stayed within phase scope

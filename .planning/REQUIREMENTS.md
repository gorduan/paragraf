# Requirements: Paragraf v2 — Volles Qdrant-Potenzial

**Defined:** 2026-03-27
**Core Value:** Juristen und Buerger finden in Sekunden die relevanten Paragraphen — mit semantischer Suche, Querverweisen zwischen Gesetzen und gruppierten Ergebnissen.

## v1 Requirements

Requirements fuer dieses Milestone. Jedes mapped zu Roadmap-Phasen.

### Qdrant Infrastructure

- [ ] **INFRA-01**: Snapshot API integriert — Backup vor Re-Indexierung erstellen und wiederherstellen
- [ ] **INFRA-02**: Scalar Quantization fuer Dense-Vektoren aktiviert (Sparse unberuehrt)
- [ ] **INFRA-03**: Full-Text Index auf `text`-Feld fuer exakte Wortsuche
- [ ] **INFRA-04**: Payload Range-Filter fuer numerisches `absatz`-Feld
- [ ] **INFRA-05**: Snapshot-Button im Index-Dashboard (Frontend)

### Search Enhancement

- [ ] **SRCH-01**: Qdrant Recommend API — aehnliche Paragraphen zu einem gegebenen Punkt finden
- [ ] **SRCH-02**: Qdrant Discovery API — explorative Suche mit Positiv/Negativ-Beispielen
- [ ] **SRCH-03**: Qdrant Grouping API — Suchergebnisse nach Gesetz gruppiert zurueckgeben
- [ ] **SRCH-04**: Qdrant Scroll API — paginierte Ergebnisse mit Offset/Limit
- [ ] **SRCH-05**: Grouped Recommendations — Empfehlungen nach Gesetz gruppiert
- [ ] **SRCH-06**: Full-Text-Suche als Toggle neben semantischer Suche
- [ ] **SRCH-07**: Query Expansion mit juristischem Synonym-Woerterbuch (konservativ, nur Abkuerzungen + Kernsynonyme)
- [ ] **SRCH-08**: Batch Search Endpoint fuer parallele Queries

### Cross-References

- [ ] **XREF-01**: Regex-basierte Querverweis-Extraktion aus deutschem Gesetzestext (§ X Abs. Y SGB Z, i.V.m., etc.)
- [ ] **XREF-02**: Querverweise als Array im Qdrant-Payload speichern (pro Paragraph)
- [ ] **XREF-03**: Re-Indexierung aller Gesetze mit Querverweis-Daten (nach Snapshot)
- [ ] **XREF-04**: Zitationsnetzwerk-API — zu einem Paragraphen alle referenzierten und referenzierenden Normen abrufen
- [ ] **XREF-05**: Klickbare Querverweis-Links in der Paragraphen-Anzeige
- [ ] **XREF-06**: Interaktive Zitationsgraph-Visualisierung (gerichteter Graph)

### MCP Tools

- [ ] **MCP-01**: MCP-Tool `paragraf_similar` — aehnliche Paragraphen via Recommend API
- [ ] **MCP-02**: MCP-Tool `paragraf_discover` — explorative Suche mit Positiv/Negativ-Beispielen
- [ ] **MCP-03**: MCP-Tool `paragraf_references` — Querverweise eines Paragraphen abrufen
- [ ] **MCP-04**: Multi-Hop MCP-Prompt — Paragraphen finden, Querverweise folgen, Rechtslage zusammenfassen
- [ ] **MCP-05**: Abschnitt-Filter vollstaendig in allen MCP-Such-Tools exponieren
- [ ] **MCP-06**: MCP-Tool `paragraf_snapshot` — Backup erstellen/wiederherstellen
- [ ] **MCP-07**: MCP-Tool `paragraf_grouped_search` — gruppierte Suchergebnisse

### Frontend UX (mit /frontend-design, /ui-ux-pro-max, /ckm-ui-styling)

- [ ] **UI-01**: Design-System mit konsistenten Tokens (Farben, Spacing, Typografie) via TailwindCSS 4
- [ ] **UI-02**: "Aehnliche Paragraphen"-Button auf ResultCard (Recommend API)
- [ ] **UI-03**: Ergebnis-Gruppierung nach Gesetz/Rechtsgebiet in SearchPage
- [ ] **UI-04**: Erweiterte Filter-UI: Abschnitt + Chunk-Typ + Absatz-Range als Sidebar/Panel
- [ ] **UI-05**: Vergleich direkt aus Suchergebnissen (onCompare verdrahten)
- [ ] **UI-06**: Paginierung fuer Suche (Scroll API) und Law Browser
- [ ] **UI-07**: Full-Text-Suche Toggle im SearchBar
- [ ] **UI-08**: Zitationsgraph-Visualisierung (interaktiv, klickbar)
- [ ] **UI-09**: Export: PDF/Markdown-Export von Ergebnissen und Vergleichen
- [ ] **UI-10**: Discovery-Suche UI: Positiv/Negativ-Beispiele per Drag-and-Drop oder Checkbox
- [ ] **UI-11**: Responsive Design-Verbesserungen und Accessibility-Audit (WCAG 2.1 AA)
- [ ] **UI-12**: Snapshot-Management im Index-Dashboard (erstellen, Status, wiederherstellen)

### Semantic Chunking

- [ ] **CHUNK-01**: Parser verbessern — Chunking an juristischen Strukturgrenzen (Absatz, Satz, Nummer)
- [ ] **CHUNK-02**: Re-Indexierung mit verbessertem Chunking (nach Snapshot)

## v2 Requirements

Aufgeschoben fuer zukuenftiges Milestone. Dokumentiert aber nicht in aktueller Roadmap.

### Erweiterte Features

- **V2-01**: ColBERT Multi-Vector Search (bge-m3 unterstuetzt es, aber Storage-Overhead 100x+)
- **V2-02**: PWA Manifest fuer "Add to Home Screen" auf Mobile
- **V2-03**: Bookmark-Export/Import (aktuell nur localStorage)
- **V2-04**: py-openthesaurus Integration fuer breitere Query Expansion (Rate-Limit-Probleme)
- **V2-05**: Gesetzesaenderungs-Tracking (Diff zwischen Versionen)
- **V2-06**: Facet Counts in Suchergebnissen (Anzahl Treffer pro Gesetz/Abschnitt)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Built-in LLM Chat Interface | Claude via MCP ist besser; RDG-Haftung, Halluzinationsrisiko |
| User-Accounts / Authentifizierung | Single-User/internes Tool, Auth bringt null Mehrwert |
| Real-Time Gesetzesaenderungs-Alerts | Keine Change-Feeds verfuegbar, enormer Polling-Aufwand |
| Neo4j Graph-Datenbank | Overkill — Qdrant Payload-Arrays genuegen fuer ~95 Gesetze |
| Mobile Native App | Web-first, responsive genuegt |
| Automatisierte Rechtsanalysen | RDG-Haftung, ueberschreitet Informationsbereitstellung |

## Traceability

Wird waehrend Roadmap-Erstellung befuellt.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmapper) | | |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 0
- Unmapped: 40

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after initial definition*

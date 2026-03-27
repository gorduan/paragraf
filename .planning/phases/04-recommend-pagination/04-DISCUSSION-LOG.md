# Phase 4: Recommend & Pagination - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 04-recommend-pagination
**Areas discussed:** Recommend API Design, Pagination Strategy, Batch Search Endpoint, MCP Tool Strategie

---

## Recommend API Design

### Input-Format

| Option | Description | Selected |
|--------|-------------|----------|
| Point-ID | Endpoint bekommt Qdrant Point-ID. Einfach, kein Extra-Embedding. | |
| Paragraph + Gesetz | Endpoint bekommt paragraph+gesetz, loest intern Point-ID auf. | |
| Beides unterstuetzen | Point-ID primaer, paragraph+gesetz als Alternative mit interner Aufloesung. | ✓ |

**User's choice:** Beides unterstuetzen
**Notes:** Flexibilitaet fuer verschiedene Aufrufer (Frontend hat Point-ID, MCP-User kennt Paragraph+Gesetz).

### Same-Law Exclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Gleiches Gesetz ausschliessen | Nur Paragraphen aus ANDEREN Gesetzen. | |
| Gleiches Gesetz einschliessen | Auch aehnliche aus demselben Gesetz. | |
| Konfigurierbarer Parameter | Optional exclude_same_law=true/false (default: true). | ✓ |

**User's choice:** Konfigurierbarer Parameter
**Notes:** Default exclude, aber Aufrufer kann ueberschreiben.

### Negative Examples

| Option | Description | Selected |
|--------|-------------|----------|
| Nur Positive | Nur "finde aehnliche zu X". Discovery API bringt Negatives spaeter. | ✓ |
| Positiv + Negativ sofort | Auch jetzt schon negative_ids akzeptieren. | |

**User's choice:** Nur Positive (Recommended)
**Notes:** Klare Abgrenzung zu Discovery API in Phase 5.

### Multi-Input

| Option | Description | Selected |
|--------|-------------|----------|
| Einzelne ID | Ein Paragraph rein, aehnliche raus. | |
| Liste von IDs | 1-5 Point-IDs als Input. Qdrant mittelt die Vektoren. | ✓ |

**User's choice:** Liste von IDs
**Notes:** User will Multi-ID-Recommend fuer "finde was zu all diesen passt".

---

## Pagination Strategy

### Strategie

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor-basiert | Qdrant Scroll API mit offset_id. Konsistent, performant. | ✓ |
| Offset/Limit klassisch | Einfaches offset+limit wie SQL. | |
| Beides anbieten | Cursor als Standard, offset/limit als Alternative. | |

**User's choice:** Cursor-basiert (Recommended)
**Notes:** —

### Seitengroesse

| Option | Description | Selected |
|--------|-------------|----------|
| 10 Ergebnisse | Konsistent mit bestehendem final_top_k. Konfigurierbar. | ✓ |
| 20 Ergebnisse | Mehr pro Seite, weniger Blaettern. | |
| Konfigurierbar ohne Default | Aufrufer MUSS page_size angeben. | |

**User's choice:** 10 Ergebnisse (Recommended)
**Notes:** —

### Endpoint-Strategie

| Option | Description | Selected |
|--------|-------------|----------|
| Bestehenden erweitern | SearchRequest bekommt cursor, SearchResponse bekommt next_cursor. | ✓ |
| Separater /api/scroll | Eigener Endpoint nur fuer Pagination. | |

**User's choice:** Bestehenden erweitern (Recommended)
**Notes:** Konsistent mit Phase-2-Muster (extend existing endpoints).

---

## Batch Search Endpoint

### Max Queries

| Option | Description | Selected |
|--------|-------------|----------|
| Max 5 Queries | Genuegt fuer typische Use-Cases. | |
| Max 10 Queries | Mehr Flexibilitaet, hoehere Serverlast. | ✓ (modified) |
| Max 3 Queries | Konservativ. | |

**User's choice:** Max 10, aber konfigurierbar via ENV. Plus Auslastungserkennung mit Frontend-Dialog (Radiobuttons 10/5/3/1 + "Nicht mehr fragen"-Checkbox).
**Notes:** Backend liefert load_warning Signal. UI-Dialog kommt in Phase 8. Alle leistungsrelevanten Settings muessen als Docker ENV-Variablen konfigurierbar sein — auch rueckwirkend fuer bestehende Features.

### Endpoint-Design

| Option | Description | Selected |
|--------|-------------|----------|
| Neuer POST /api/search/batch | Eigener Endpoint, Body = Array von SearchRequests. | ✓ |
| Bestehenden /api/search erweitern | SearchRequest akzeptiert auch Arrays. | |

**User's choice:** Neuer POST /api/search/batch (Recommended)
**Notes:** —

---

## MCP Tool Strategie

### Similar Tool

| Option | Description | Selected |
|--------|-------------|----------|
| Neues paragraf_similar Tool | Eigenes Tool mit klarem Zweck. | ✓ |
| paragraf_search erweitern | Neuer Modus 'aehnlich' im suchmodus-Parameter. | |

**User's choice:** Neues paragraf_similar Tool (Recommended)
**Notes:** Klare Trennung fuer Claude, nicht paragraf_search ueberladen.

### Filter-Parameter

| Option | Description | Selected |
|--------|-------------|----------|
| Gleiche Parameter wie paragraf_search | gesetzbuch, abschnitt, absatz_von, absatz_bis. | ✓ |
| Nur gesetzbuch + abschnitt | Reduzierter Filter-Satz. | |
| Keine Filter | Recommend sucht immer global. | |

**User's choice:** Gleiche Parameter wie paragraf_search (Recommended)
**Notes:** Konsistente API ueber alle MCP-Tools (MCP-05).

### Pagination im MCP

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, mit cursor Parameter | paragraf_search bekommt cursor. Claude kann blaettern. | ✓ |
| Nein, nur REST | MCP gibt nur Top-K zurueck. | |

**User's choice:** Ja, mit cursor Parameter (Recommended)
**Notes:** —

---

## Claude's Discretion

- Genaue Qdrant query_points Parameter fuer Recommend (strategy, score_threshold)
- Interne Point-ID-Aufloesung: Lookup-Strategie
- Error Handling bei nicht gefundenen Point-IDs
- Naming der Pydantic-Modelle
- load_warning als Response-Feld oder HTTP-Header

## Deferred Ideas

- **Batch-Limit UI-Dialog** (Phase 8): Radiobuttons 10/5/3/1 + "Nicht mehr fragen"-Checkbox bei load_warning
- **Rueckwirkende ENV-Audit**: Bestehende Settings pruefen ob in docker-compose.yml exponiert

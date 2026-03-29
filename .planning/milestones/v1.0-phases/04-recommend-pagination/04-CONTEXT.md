# Phase 4: Recommend & Pagination - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-Phase: Aehnliche Paragraphen via Qdrant Recommend API, paginierte Suchergebnisse via Scroll API, paralleler Batch-Search-Endpoint, und MCP-Tools fuer diese Features. Kein Frontend-UI — das kommt in Phase 8.

Requirements: SRCH-01 (Recommend API), SRCH-04 (Scroll/Pagination), SRCH-08 (Batch Search), MCP-01 (paragraf_similar), MCP-05 (Abschnitt-Filter in allen MCP-Tools)

</domain>

<decisions>
## Implementation Decisions

### Recommend API Design
- **D-01:** Dual-Input: Point-ID als primaerer Input UND paragraph+gesetz als Alternative mit interner Aufloesung zu Point-ID. Beides unterstuetzt.
- **D-02:** Konfigurierbarer `exclude_same_law` Parameter (default: true). Aufrufer entscheidet ob Ergebnisse aus dem gleichen Gesetz ein-/ausgeschlossen werden.
- **D-03:** Nur positive Beispiele in Phase 4. Keine Negative Examples — Discovery API (Phase 5) bringt Positiv+Negativ-Kombination.
- **D-04:** Liste von 1-5 Point-IDs als Input unterstuetzt. Qdrant mittelt die Vektoren fuer Multi-ID-Recommend.
- **D-05:** Neuer REST-Endpoint `POST /api/recommend` (nicht auf /api/search aufgesetzt — eigene Semantik).

### Pagination Strategy
- **D-06:** Cursor-basierte Pagination mit Qdrant Scroll API. Response enthaelt `next_cursor` Feld (null = letzte Seite).
- **D-07:** Standard-Seitengroesse 10 Ergebnisse (konsistent mit bestehendem `final_top_k`). Konfigurierbar per Parameter `page_size`.
- **D-08:** Bestehenden `/api/search` Endpoint erweitern: optionaler `cursor` Parameter in SearchRequest. Ohne cursor = erste Seite (wie bisher). SearchResponse bekommt `next_cursor` Feld.

### Batch Search
- **D-09:** Neuer separater Endpoint `POST /api/search/batch`. Body ist Array von SearchRequests. Klare Trennung von Single-Search.
- **D-10:** Maximum 10 parallele Queries (konfigurierbar via ENV). Backend liefert `load_warning: true` im Response wenn Auslastung hoch — Frontend-Dialog mit Reduktions-Optionen kommt in Phase 8.
- **D-11:** Alle Queries werden mit `asyncio.gather()` parallel ausgefuehrt. Gemeinsame Filter moeglich aber nicht erzwungen — jede Query hat eigene Filter.

### MCP Tool Strategie
- **D-12:** Neues eigenes `paragraf_similar` MCP-Tool (MCP-01). Nicht in paragraf_search integriert — klare Trennung fuer Claude.
- **D-13:** paragraf_similar bekommt dieselben Filter-Parameter wie paragraf_search: gesetzbuch, abschnitt, absatz_von, absatz_bis. Konsistente API (MCP-05).
- **D-14:** Pagination auch im MCP exponiert: paragraf_search bekommt optionalen `cursor` Parameter. Response enthaelt `next_cursor`. Claude kann durch grosse Ergebnismengen blaettern.

### ENV-Konfigurierbarkeit (uebergreifend)
- **D-15:** ALLE leistungs- und suchrelevanten Einstellungen muessen als Docker-Umgebungsvariablen in docker-compose.yml konfigurierbar sein. Betrifft:
  - `BATCH_MAX_QUERIES` (default: 10)
  - `SCROLL_PAGE_SIZE` (default: 10)
  - `RECOMMEND_DEFAULT_LIMIT` (default: 10)
  - Bestehende Settings pruefen und ggf. nachziehen
- **D-16:** Alle neuen Einstellungen in Pydantic Settings (`config.py`) mit sinnvollen Defaults. Rueckwirkend pruefen ob alle bestehenden leistungsrelevanten Settings auch in docker-compose.yml exponiert sind.

### Claude's Discretion
- Genaue Qdrant `query_points` Parameter fuer Recommend (strategy, score_threshold)
- Interne Point-ID-Aufloesung: Lookup-Strategie (scroll mit exaktem Filter vs. dedizierter Index)
- Error Handling bei nicht gefundenen Point-IDs oder leeren Recommend-Ergebnissen
- Naming der Pydantic-Modelle fuer Recommend Request/Response
- Ob `load_warning` als Response-Feld oder HTTP-Header zurueckgegeben wird

### Folded Todos
Keine — keine relevanten Todos fuer Phase 4 gefunden.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Service Layer
- `backend/src/paragraf/services/qdrant_store.py` — `query_points()` Usage (lines 324, 343, 373, 422), `scroll()` Fallback (line 436), `_build_filter()` Pattern, Batch-Upsert Pattern (lines 206-216)
- `backend/src/paragraf/api.py` — REST-Endpoint-Patterns, Search-Route, Reranking-Pipeline, SSE-Streaming-Pattern
- `backend/src/paragraf/api_models.py` — SearchRequest/SearchResponse Pydantic-Modelle (erweitern mit cursor, next_cursor)
- `backend/src/paragraf/models/law.py` — SearchFilter (Extend-Pattern), SearchResult, LawChunk, ChunkMetadata

### MCP Tools
- `backend/src/paragraf/tools/search.py` — paragraf_search Tool-Pattern mit German Parameters, _deduplicate_results Utility, DISCLAIMER Pattern
- `backend/src/paragraf/tools/lookup.py` — Simpler MCP Tool als Referenz

### Configuration
- `backend/src/paragraf/config.py` — Pydantic Settings Pattern (neue Settings: batch_max_queries, scroll_page_size, recommend_default_limit)
- `docker-compose.yml` — ENV-Variable Konfiguration, Service-Dependencies

### Prior Phase Context
- `.planning/phases/01-snapshot-safety-net/01-CONTEXT.md` — Async-Pattern, Quantization-Params bei Queries
- `.planning/phases/02-search-indexes-full-text/02-CONTEXT.md` — Extend-existing-endpoints Pattern, SearchFilter Extension, MCP-Tool-Extension

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QdrantStore.query_points()`: Etabliertes Pattern mit prefetch + fusion. Recommend nutzt dasselbe `query_points()` mit `RecommendQuery` statt `FusionQuery`.
- `QdrantStore._build_filter()`: Filter-Builder fuer Qdrant — wiederverwendbar fuer Recommend-Filter und Scroll-Filter.
- `QdrantStore.scroll()`: Bereits als Fallback in fulltext_search genutzt (line 436). Basis fuer Pagination.
- `_deduplicate_results()` in tools/search.py: Deduplizierungs-Logik wiederverwendbar fuer Recommend-Ergebnisse.
- `SearchParams(quantization=...)`: Quantization-Parameter bereits in allen Query-Methoden — fuer Recommend uebernehmen.

### Established Patterns
- **Async throughout**: Alle Service-Methoden async — Recommend/Scroll/Batch folgen dem Pattern.
- **query_points exclusive**: Kein Legacy `search()` oder `recommend()` — nur `query_points()` mit verschiedenen Query-Typen.
- **Extend existing models**: SearchRequest/SearchResponse erweitern (Phase 2 Pattern) statt neue Modelle.
- **Pydantic Settings**: Neue Settings in `config.py` mit ENV-Binding.
- **MCP German params**: Deutsche Parameter-Namen (gesetzbuch, abschnitt, anfrage) in MCP-Tools.

### Integration Points
- `qdrant_store.py`: Neue Methoden `recommend()`, `scroll_search()`. Batch-Search nutzt bestehende `hybrid_search()` parallel.
- `api.py`: Neuer `/api/recommend` Endpoint, `/api/search/batch` Endpoint, `cursor` Parameter in Search-Route.
- `api_models.py`: `RecommendRequest`, `RecommendResponse`, `BatchSearchRequest`, `BatchSearchResponse`. SearchRequest + SearchResponse erweitern.
- `config.py`: `batch_max_queries`, `scroll_page_size`, `recommend_default_limit` Settings.
- `tools/search.py`: `cursor` Parameter zu `paragraf_search` hinzufuegen.
- `tools/` Verzeichnis: Neue Datei `tools/recommend.py` fuer `paragraf_similar` Tool.
- `docker-compose.yml`: Neue ENV-Variablen exponieren.

</code_context>

<specifics>
## Specific Ideas

- **Adaptive Batch-Limit mit UI-Dialog**: User moechte eine Auslastungserkennung die bei hoher Last einen Dialog mit Radiobuttons (10/5/3/1) und "Nicht mehr fragen"-Checkbox anbietet. Backend liefert `load_warning` Signal, Frontend-Dialog kommt in Phase 8.
- **ENV-first Konfiguration**: User betont explizit dass ALLE leistungsrelevanten Einstellungen headless ueber docker-compose.yml konfigurierbar sein muessen — nicht nur neue, auch rueckwirkend pruefen.
- **Multi-ID Recommend**: User will 1-5 IDs gleichzeitig als Input — "finde was zu all diesen passt". Qdrant mittelt intern die Vektoren.

</specifics>

<deferred>
## Deferred Ideas

- **Batch-Limit UI-Dialog** (Phase 8): Frontend-Dialog mit Radiobuttons (10/5/3/1) und "Nicht mehr fragen"-Checkbox wenn Backend `load_warning` signalisiert. Backend-Signal wird in Phase 4 vorbereitet.
- **Rueckwirkende ENV-Audit**: Bestehende Settings aus Phase 1-3 pruefen ob alle in docker-compose.yml exponiert sind. Kann als Quick-Task oder in Phase 4 mit erledigt werden.

</deferred>

---

*Phase: 04-recommend-pagination*
*Context gathered: 2026-03-27*

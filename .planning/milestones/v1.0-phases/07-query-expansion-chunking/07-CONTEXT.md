# Phase 7: Query Expansion & Chunking - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve search recall through legal synonym expansion and smarter paragraph segmentation at legal structure boundaries (Absatz, Satz). Add multi-hop MCP prompts and a backend chain endpoint that combine search with citation traversal. Backend-only phase — no frontend UI (that's Phase 8).

Requirements: SRCH-07 (Query Expansion), MCP-04 (Multi-Hop Prompts), CHUNK-01 (Semantic Chunking), CHUNK-02 (Re-indexing)

</domain>

<decisions>
## Implementation Decisions

### Synonym Dictionary
- **D-01:** LAW_REGISTRY-basiert: Automatisch aus LAW_REGISTRY generiert (Abkuerzung <-> voller Name <-> Tags) plus manuell gepflegte juristische Kern-Synonyme (z.B. GdB <-> Grad der Behinderung, Kuendigung <-> Entlassung).
- **D-02:** Primaer als Python-Dict im Code (eigene Datei, z.B. `synonyms.py`). Zusaetzlich optionale JSON-Datei die das Dict ergaenzt/ueberschreibt — fuer Anpassungen ohne Code-Aenderung.
- **D-03:** Arabische-Zahlen-Normalisierung auch bei der Suche: `_normalize_abkuerzung()` wird zur Suchzeit angewendet (SGB 9 -> SGB IX), nicht nur beim Parsen.

### Expansion Behavior
- **D-04:** Zwei Strategien konfigurierbar per ENV (`QUERY_EXPANSION_STRATEGY`): `append` (Default) haengt Synonyme an den Query-String an, `parallel` fuehrt Original + expandierte Query separat aus und fusioniert per RRF.
- **D-05:** Expansion sichtbar im API-Response: `expanded_terms`-Feld zeigt dem Nutzer welche Synonyme hinzugefuegt wurden. Frontend kann dies in Phase 8 anzeigen.
- **D-06:** Expansion per API-Parameter abschaltbar: `expand: true/false` (Default: true) in SearchRequest. Konsistent mit dem fulltext-Toggle aus Phase 2.

### Chunking Strategy
- **D-07:** Granularitaet: Absatz + Satz. Chunks an Absatz-Grenzen UND an Satz-Grenzen bei langen Absaetzen. Chunk-Typen: `paragraph` (voller Text), `absatz` (einzelne Klausel), `satz` (einzelner Satz bei langen Absaetzen).
- **D-08:** Bestehende `paragraph`-Chunks beibehalten, neue `absatz`- und `satz`-Chunks kommen dazu. Mehr Punkte in der Collection, aber bessere Trefferquote auf verschiedenen Granularitaetsstufen.
- **D-09:** Schwellenwerte konfigurierbar per ENV: `CHUNK_MIN_LENGTH_FOR_SPLIT` (Default: 800 Zeichen) und `CHUNK_SATZ_MIN_LENGTH` fuer minimale Satz-Chunk-Laenge. Konsistent mit ENV-first-Prinzip (Phase 4 D-15/D-16).

### Multi-Hop MCP & Backend
- **D-10:** Beides: MCP-Prompt-Templates fuer Claude UND ein Backend-Endpoint (`POST /api/search/multi-hop`) der intern Search -> References -> Search kettet.
- **D-11:** Traversal-Tiefe bis zu 3 Hops moeglich. Default: 1. Konfigurierbar per ENV (`MULTI_HOP_MAX_DEPTH`), API-Parameter (`tiefe`) und MCP-Parameter.
- **D-12:** Drei MCP-Prompt-Templates:
  - `paragraf_legal_analysis` — Suche + Querverweise folgen + Zusammenfassung der Rechtslage
  - `paragraf_norm_chain` — Verfolgt Kette von Querverweisen ab einem Startparagraphen
  - `paragraf_compare_areas` — Sucht in mehreren Rechtsgebieten parallel und vergleicht Regelungen

### Claude's Discretion
- Interne Implementierung der parallelen Expansion-Strategie (wie RRF-Fusion der zwei Ergebnis-Sets)
- Satz-Erkennung im Parser (Regex oder strukturbasiert)
- Multi-Hop Response-Format und Zwischenergebnis-Darstellung
- Error Handling bei zirkulaeren Querverweisen in der Traversal-Kette
- Pydantic-Modell-Namen fuer Multi-Hop Request/Response
- Ob der Multi-Hop-Endpoint Reranking auf die kombinierten Ergebnisse anwendet

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Synonym & Expansion
- `backend/src/paragraf/models/law.py` — `LAW_REGISTRY` (95+ Gesetze mit `abkuerzung`, `beschreibung`, `tags`), `LawDefinition` dataclass
- `backend/src/paragraf/services/parser.py` — `_normalize_abkuerzung()` (Zeilen 539-579, arabisch -> roemisch Normalisierung)
- `backend/src/paragraf/services/qdrant_store.py` — `hybrid_search()` Methode, Query-Pipeline vor Embedding
- `backend/src/paragraf/services/embedding.py` — `encode_query()` (Zeile 129-132), Query -> Vektor Pipeline

### Chunking
- `backend/src/paragraf/services/parser.py` — Aktuelle Chunking-Logik (Zeilen 220-268), 800-Zeichen-Schwellenwert, `paragraph`/`absatz` Chunk-Typen
- `backend/src/paragraf/models/law.py` — `LawChunk`, `ChunkMetadata` (chunk_typ Feld)

### Multi-Hop & MCP
- `backend/src/paragraf/prompts/__init__.py` — 4 bestehende MCP-Prompts als Pattern
- `backend/src/paragraf/tools/search.py` — `paragraf_search` Tool-Pattern
- `backend/src/paragraf/tools/references.py` — `paragraf_references` Tool (Phase 6)
- `backend/src/paragraf/server.py` — MCP-Server Setup, Tool/Prompt-Registrierung
- `backend/src/paragraf/api.py` — REST-Endpoint-Patterns

### Configuration
- `backend/src/paragraf/config.py` — Pydantic Settings Pattern (neue Settings: QUERY_EXPANSION_STRATEGY, CHUNK_*, MULTI_HOP_*)
- `docker-compose.yml` — ENV-Variable Konfiguration

### Prior Phase Context
- `.planning/phases/04-recommend-pagination/04-CONTEXT.md` — ENV-first Config (D-15/D-16), query_points exclusive
- `.planning/phases/06-cross-reference-pipeline/06-CONTEXT.md` — references_out Payload, paragraf_references Tool, set_payload Pattern
- `.planning/phases/01-snapshot-safety-net/01-CONTEXT.md` — Snapshot vor Re-Indexierung
- `.planning/phases/02-search-indexes-full-text/02-CONTEXT.md` — Fulltext-Toggle Pattern, SearchFilter Extension

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LAW_REGISTRY`: 95+ Eintraege mit `abkuerzung`, `beschreibung`, `tags` — Basis fuer automatische Synonym-Generierung
- `_normalize_abkuerzung()`: Arabisch->Roemisch Mapping — zur Suchzeit wiederverwenden
- `hybrid_search()`: Query-Pipeline die um Expansion-Schritt erweitert wird
- `encode_query()`: Embedding-Methode die den (ggf. expandierten) Query-String verarbeitet
- `paragraf_references`: MCP-Tool fuer Querverweise — wird von Multi-Hop-Prompts aufgerufen
- Parser Chunking-Logik: Absatz-Erkennung existiert, Satz-Erkennung muss ergaenzt werden

### Established Patterns
- **Async throughout**: Alle Service-Methoden async — Expansion-Service und Multi-Hop folgen dem Pattern
- **ENV-first Config**: Alle Settings in Pydantic Settings + docker-compose.yml (Phase 4 D-15/D-16)
- **Toggle-Pattern**: fulltext-Toggle in Phase 2 als Vorlage fuer expand-Toggle
- **Snapshot vor Re-Indexierung**: Automatischer Snapshot vor Collection-Aenderungen (Phase 1)
- **MCP Prompt Pattern**: `@mcp.prompt()` Decorator mit deutschen Parameternamen

### Integration Points
- Neuer `QueryExpander` Service in `backend/src/paragraf/services/` (synonym lookup + expansion)
- `qdrant_store.py`: `hybrid_search()` erhaelt Pre-Processing-Schritt fuer Expansion
- `parser.py`: Chunking-Logik erweitern um Satz-Erkennung
- `api.py`: `expand` Parameter in SearchRequest, neuer `/api/search/multi-hop` Endpoint
- `api_models.py`: `expanded_terms` in SearchResponse, MultiHopRequest/Response Modelle
- `prompts/`: 3 neue Prompt-Templates
- `config.py`: Neue Settings (QUERY_EXPANSION_STRATEGY, CHUNK_MIN_LENGTH_FOR_SPLIT, CHUNK_SATZ_MIN_LENGTH, MULTI_HOP_MAX_DEPTH)
- `docker-compose.yml`: Neue ENV-Variablen

</code_context>

<specifics>
## Specific Ideas

- **Dual-Storage fuer Synonyme**: Python-Dict als Code-Default + optionale JSON-Datei die ergaenzt/ueberschreibt — Nutzer will beide Wege
- **Konfigurierbare Expansion-Strategie**: Nicht nur an/aus, sondern auch WIE (append vs. parallel) per ENV waehlbar
- **3 Hops Maximum**: Nutzer will explizit bis zu 3 Hops in der Zitations-Traversal, nicht nur 1 — sowohl in API als auch MCP und ENV einstellbar
- **Alle 3 Multi-Hop-Prompts**: Legal Analysis, Norm Chain und Compare Areas — nicht nur einer

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-query-expansion-chunking*
*Context gathered: 2026-03-27*

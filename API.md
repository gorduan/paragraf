# Paragraf REST-API

Alle Endpoints sind unter `/api/` erreichbar. Anfragen und Antworten sind JSON-formatiert.

**Zugriffswege:**

| Modus | Basis-URL | Beschreibung |
|-------|-----------|--------------|
| Docker | `http://localhost:3847/api/...` | Ueber nginx-Reverse-Proxy (empfohlen) |
| Lokal | `http://localhost:8000/api/...` | Direkt zum Backend (Entwicklung) |

Alle `curl`-Beispiele verwenden `http://localhost:3847` (Docker-Pfad). Fuer lokale Entwicklung `3847` durch `8000` ersetzen.

---

## Suche

### POST /api/search

Hybride Volltextsuche ueber alle indexierten Gesetze. Kombiniert Dense-Vektoren (semantisch) und Sparse-Vektoren (Keyword-basiert) mit anschliessendem Cross-Encoder-Reranking. Verwenden, wenn eine Rechtsfrage in natuerlicher Sprache gestellt wird.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `anfrage` | string | ja | Suchanfrage in natuerlicher Sprache |
| `gesetzbuch` | string | nein | Filter nach Gesetzbuch (z.B. `"SGB IX"`) |
| `abschnitt` | string | nein | Filter nach Abschnitt |
| `max_ergebnisse` | int | nein | Anzahl Ergebnisse (1-20, Standard: 5) |
| `search_type` | string | nein | `"semantic"` (Standard), `"fulltext"`, `"hybrid_fulltext"` |
| `cursor` | string | nein | Cursor fuer Paginierung (aus `next_cursor` der vorherigen Antwort) |
| `page_size` | int | nein | Ergebnisse pro Seite (1-100, Standard: 10) |
| `expand` | bool | nein | Query Expansion aktivieren (Standard: true) |

```bash
curl -s http://localhost:3847/api/search \
  -H "Content-Type: application/json" \
  -d '{"anfrage": "Kuendigungsschutz bei Schwerbehinderung", "max_ergebnisse": 5}' | jq .
```

**Antwort:** `query`, `results` (Liste mit `paragraph`, `gesetz`, `titel`, `text`, `score`), `total`, `next_cursor`, `expanded_terms`, `disclaimer`.

### POST /api/search/batch

Mehrere Suchanfragen in einem Request ausfuehren. Verwenden, wenn verschiedene Aspekte einer Rechtsfrage gleichzeitig recherchiert werden sollen.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `queries` | list[SearchRequest] | ja | Liste von Suchanfragen (max. 10) |

```bash
curl -s http://localhost:3847/api/search/batch \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      {"anfrage": "Kuendigungsschutz bei Schwerbehinderung"},
      {"anfrage": "Anspruch auf Teilhabeleistungen"}
    ]
  }' | jq .
```

**Antwort:** `results` (Liste von SearchResponse-Objekten), `total_queries`, `load_warning`.

### POST /api/search/grouped

Suchergebnisse nach Gesetzbuch gruppiert. Verwenden, um zu sehen welche Gesetze zu einer Rechtsfrage relevant sind, ohne dass ein Gesetz alle Top-Ergebnisse dominiert.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `anfrage` | string | ja | Suchanfrage in natuerlicher Sprache |
| `gesetzbuch` | string | nein | Filter nach Gesetzbuch |
| `abschnitt` | string | nein | Filter nach Abschnitt |
| `group_size` | int | nein | Ergebnisse pro Gruppe (1-10, Standard: 3) |
| `max_groups` | int | nein | Maximale Anzahl Gruppen (1-20, Standard: 10) |
| `search_type` | string | nein | `"semantic"`, `"fulltext"`, `"hybrid_fulltext"` |

```bash
curl -s http://localhost:3847/api/search/grouped \
  -H "Content-Type: application/json" \
  -d '{"anfrage": "Nachteilsausgleich fuer behinderte Menschen"}' | jq .
```

**Antwort:** `query`, `groups` (Liste mit `gesetz`, `results`, `total`), `total_groups`, `disclaimer`.

### POST /api/search/multi-hop

Mehrstufige Suche, die Querverweisen zwischen Paragraphen folgt. Verwenden bei Rechtsfragen, die mehrere Gesetze betreffen und bei denen Paragraphen aufeinander verweisen (z.B. SGB IX verweist auf SGB XII).

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `anfrage` | string | ja | Suchanfrage in natuerlicher Sprache |
| `gesetzbuch` | string | nein | Filter nach Gesetzbuch (nur fuer initialen Hop) |
| `tiefe` | int | nein | Traversal-Tiefe 1-3 Hops (Standard: 1) |
| `max_ergebnisse_pro_hop` | int | nein | Ergebnisse pro Hop (1-10, Standard: 5) |
| `expand` | bool | nein | Query Expansion aktivieren (Standard: true) |

```bash
curl -s http://localhost:3847/api/search/multi-hop \
  -H "Content-Type: application/json" \
  -d '{"anfrage": "Eingliederungshilfe und Pflegeleistungen", "tiefe": 2}' | jq .
```

**Antwort:** `query`, `hops`, `results` (Liste mit `paragraph`, `gesetz`, `titel`, `text`, `score`, `hop`, `via_reference`), `total`, `visited_paragraphs`, `expanded_terms`, `disclaimer`.

---

## Empfehlungen

### POST /api/recommend

Aehnliche Paragraphen finden, ausgehend von einem bekannten Paragraphen. Verwenden, wenn ein relevanter Paragraph bekannt ist und verwandte Vorschriften in anderen Gesetzen gesucht werden.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `point_ids` | list[string] | nein* | Qdrant Point-IDs (max. 5) |
| `paragraph` | string | nein* | Paragraph als Alternative (z.B. `"§ 2"`) |
| `gesetz` | string | nein* | Gesetz als Alternative (z.B. `"SGB IX"`) |
| `limit` | int | nein | Anzahl Ergebnisse (1-50, Standard: 10) |
| `exclude_same_law` | bool | nein | Gleiches Gesetz ausschliessen (Standard: true) |
| `gesetzbuch` | string | nein | Filter nach Gesetzbuch |

*Entweder `point_ids` oder `paragraph` + `gesetz` angeben.

```bash
curl -s http://localhost:3847/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"paragraph": "§ 2", "gesetz": "SGB IX", "limit": 5}' | jq .
```

**Antwort:** `source_ids`, `results` (Liste mit `paragraph`, `gesetz`, `titel`, `text`, `score`), `total`, `disclaimer`.

### POST /api/recommend/grouped

Aehnliche Paragraphen nach Gesetzbuch gruppiert. Wie `/api/recommend`, aber die Ergebnisse werden nach Gesetz sortiert dargestellt.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `point_ids` | list[string] | nein* | Qdrant Point-IDs (max. 5) |
| `paragraph` | string | nein* | Paragraph als Alternative |
| `gesetz` | string | nein* | Gesetz als Alternative |
| `exclude_same_law` | bool | nein | Gleiches Gesetz ausschliessen (Standard: true) |
| `group_size` | int | nein | Ergebnisse pro Gruppe (1-10, Standard: 3) |
| `max_groups` | int | nein | Maximale Anzahl Gruppen (1-20, Standard: 10) |

```bash
curl -s http://localhost:3847/api/recommend/grouped \
  -H "Content-Type: application/json" \
  -d '{"paragraph": "§ 152", "gesetz": "SGB IX", "max_groups": 5}' | jq .
```

**Antwort:** `source_ids`, `groups` (Liste mit `gesetz`, `results`, `total`), `total_groups`, `disclaimer`.

### POST /api/discover

Thematische Exploration mit Positiv- und Negativ-Beispielen. Verwenden, um ausgehend von bekannten Paragraphen neue relevante Vorschriften zu entdecken. Positiv-Beispiele steuern die Richtung, Negativ-Beispiele grenzen ab.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `positive_ids` | list[string] | nein | Positive Point-IDs (max. 5) |
| `positive_paragraphs` | list[object] | nein | Positive Paragraphen als `{"gesetz": "...", "paragraph": "..."}` |
| `negative_ids` | list[string] | nein | Negative Point-IDs (max. 5) |
| `negative_paragraphs` | list[object] | nein | Negative Paragraphen |
| `limit` | int | nein | Anzahl Ergebnisse (1-50, Standard: 10) |
| `gesetzbuch` | string | nein | Filter nach Gesetzbuch |

```bash
curl -s http://localhost:3847/api/discover \
  -H "Content-Type: application/json" \
  -d '{
    "positive_paragraphs": [
      {"gesetz": "SGB IX", "paragraph": "§ 49"},
      {"gesetz": "SGB IX", "paragraph": "§ 50"}
    ],
    "limit": 10
  }' | jq .
```

**Antwort:** `positive_ids`, `negative_ids`, `results` (Liste mit `paragraph`, `gesetz`, `titel`, `text`, `score`), `total`, `disclaimer`.

---

## Nachschlagen

### POST /api/lookup

Konkreten Paragraphen nachschlagen. Verwenden, wenn Gesetz und Paragraphen-Nummer bekannt sind und der vollstaendige Text benoetigt wird.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `gesetz` | string | ja | Gesetzbuch-Abkuerzung (z.B. `"SGB IX"`) |
| `paragraph` | string | ja | Paragraphen-Nummer (z.B. `"§ 152"`) |

```bash
curl -s http://localhost:3847/api/lookup \
  -H "Content-Type: application/json" \
  -d '{"gesetz": "SGB IX", "paragraph": "§ 152"}' | jq .
```

**Antwort:** `paragraph`, `gesetz`, `titel`, `text`, `abschnitt`, `hierarchie_pfad`, `quelle`, `found`.

### POST /api/compare

Zwei bis fuenf Paragraphen nebeneinander vergleichen. Verwenden, um aehnliche Regelungen in verschiedenen Gesetzen oder aufeinanderfolgende Paragraphen zu vergleichen.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `paragraphen` | list[string] | ja | Paragraphen-Referenzen (2-5), z.B. `["§ 36 SGB XI", "§ 37 SGB XI"]` |

```bash
curl -s http://localhost:3847/api/compare \
  -H "Content-Type: application/json" \
  -d '{"paragraphen": ["§ 36 SGB XI", "§ 37 SGB XI"]}' | jq .
```

**Antwort:** `items` (Liste mit `referenz`, `paragraph`, `gesetz`, `titel`, `text`, `found`).

---

## Querverweise

### POST /api/references/extract

Querverweise aus allen indexierten Paragraphen extrahieren und in der Datenbank speichern. Verwenden nach der Indexierung neuer Gesetze, um das Zitationsnetzwerk aufzubauen.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `gesetz` | string | nein | Nur fuer ein Gesetz extrahieren (leer = alle) |
| `full_reindex` | bool | nein | Vollstaendige Neuindexierung (Standard: false) |

```bash
curl -s http://localhost:3847/api/references/extract \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**Antwort:** `erfolg`, `total_points`, `points_with_refs`, `total_refs`, `snapshot_name`, `nachricht`.

### GET /api/references/{gesetz}/{paragraph}

Zitationsnetzwerk eines Paragraphen anzeigen. Zeigt sowohl ausgehende Querverweise (worauf verweist dieser Paragraph) als auch eingehende (wer zitiert diesen Paragraphen). Verwenden, um die Vernetzung eines Paragraphen im Rechtssystem zu verstehen.

**Pfad-Parameter:**

| Parameter | Beschreibung |
|-----------|--------------|
| `gesetz` | Gesetzbuch-Abkuerzung (z.B. `SGB_IX` — Unterstrich statt Leerzeichen in der URL) |
| `paragraph` | Paragraphen-Nummer (z.B. `2`) |

```bash
curl -s "http://localhost:3847/api/references/SGB_IX/2" | jq .
```

**Antwort:** `gesetz`, `paragraph`, `outgoing` (ausgehende Querverweise), `incoming` (eingehende Querverweise mit Textvorschau), `incoming_count`.

---

## Gesetze

### GET /api/laws

Alle verfuegbaren Gesetze mit Indexierungsstatus auflisten. Verwenden, um zu sehen welche Gesetze im System vorhanden sind und welche bereits indexiert wurden.

**Query-Parameter:**

| Parameter | Beschreibung |
|-----------|--------------|
| `rechtsgebiet` | Optional: Filter nach Rechtsgebiet (z.B. `Sozialrecht`) |

```bash
curl -s "http://localhost:3847/api/laws" | jq .
```

**Antwort:** `gesetze` (Liste mit `abkuerzung`, `beschreibung`, `slug`, `rechtsgebiet`, `tags`), `total_chunks`, `db_status`.

### GET /api/laws/{gesetz}/structure

Hierarchische Gliederung eines Gesetzes (Teile, Kapitel, Abschnitte). Verwenden, um die Struktur eines Gesetzes zu verstehen, bevor einzelne Paragraphen nachgeschlagen werden.

```bash
curl -s "http://localhost:3847/api/laws/SGB_IX/structure" | jq .
```

**Antwort:** `gesetz`, `paragraphen` (Liste mit `paragraph`, `titel`, `abschnitt`, `hierarchie_pfad`), `total`.

### GET /api/laws/{gesetz}/paragraphs

Alle Paragraphen eines Gesetzes mit vollstaendigem Text. Verwenden fuer den Export oder die Anzeige eines gesamten Gesetzes.

```bash
curl -s "http://localhost:3847/api/laws/AGG/paragraphs" | jq .
```

**Antwort:** `gesetz`, `paragraphen` (Liste mit vollstaendigen Paragraphen-Daten), `total`.

---

## Beratung

### POST /api/counseling

EUTB-Beratungsstellen (Ergaenzende Unabhaengige Teilhabeberatung) suchen. Verwenden, um Nutzer an professionelle, kostenlose Beratungsstellen zu verweisen.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `ort` | string | nein | Stadt oder Ort |
| `bundesland` | string | nein | Bundesland |
| `schwerpunkt` | string | nein | Beratungsschwerpunkt |

```bash
curl -s http://localhost:3847/api/counseling \
  -H "Content-Type: application/json" \
  -d '{"ort": "Berlin", "schwerpunkt": "Schwerbehinderung"}' | jq .
```

**Antwort:** `stellen` (Liste mit `name`, `traeger`, `strasse`, `plz`, `ort`, `bundesland`, `telefon`, `email`, `website`, `schwerpunkte`), `total`, `hinweis`.

---

## Index-Verwaltung

### GET /api/index/status

Indexierungsstatus pro Gesetz. Verwenden, um zu pruefen welche Gesetze bereits in Qdrant indexiert sind und wie viele Chunks sie enthalten.

```bash
curl -s "http://localhost:3847/api/index/status" | jq .
```

**Antwort:** `gesetze` (Liste mit `gesetz`, `chunks`, `status`), `total_chunks`, `db_status`.

### POST /api/index

Gesetz in die Qdrant-Datenbank indexieren. Laeuft als SSE-Stream (Server-Sent Events) mit Fortschrittsmeldungen. Verwenden ueber die Web-Oberflaeche oder mit einem SSE-faehigen Client.

**Request-Body:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `gesetzbuch` | string | nein | Gesetzbuch-Abkuerzung (leer = alle Gesetze) |

```bash
curl -N http://localhost:3847/api/index \
  -H "Content-Type: application/json" \
  -d '{"gesetzbuch": "SGB IX"}'
```

**Antwort:** SSE-Stream mit Events vom Typ `IndexProgressEvent`:

```
data: {"gesetz":"SGB IX","schritt":"download","fortschritt":0,"gesamt":0,"nachricht":"Lade XML..."}
data: {"gesetz":"SGB IX","schritt":"parse","fortschritt":50,"gesamt":100,"nachricht":"Parse Paragraphen..."}
data: {"gesetz":"SGB IX","schritt":"embedding","fortschritt":10,"gesamt":200,"nachricht":"Berechne Embeddings..."}
data: {"gesetz":"SGB IX","schritt":"done","fortschritt":200,"gesamt":200,"nachricht":"200 Chunks indexiert"}
```

Hinweis: `curl -N` deaktiviert das Output-Buffering, damit SSE-Events sofort angezeigt werden.

### POST /api/index/eutb

EUTB-Beratungsstellen-Daten indexieren. Laedt die aktuelle EUTB-Excel-Datei herunter und indexiert die Beratungsstellen.

```bash
curl -s http://localhost:3847/api/index/eutb \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**Antwort:** `erfolg`, `verarbeitete_gesetze`, `total_chunks`, `fehler`.

### POST /api/indexes/ensure

Qdrant-Collections anlegen falls nicht vorhanden. Erstellt die benoetigten Collections mit Dense- und Sparse-Vektor-Konfiguration. Wird beim Backend-Start automatisch aufgerufen, kann aber auch manuell ausgeloest werden.

```bash
curl -s -X POST http://localhost:3847/api/indexes/ensure | jq .
```

---

## Snapshots

### POST /api/snapshots

Snapshot der Qdrant-Datenbank erstellen (Backup). Aeltere Snapshots werden automatisch geloescht wenn das Maximum (Standard: 3) ueberschritten wird.

```bash
curl -s -X POST http://localhost:3847/api/snapshots | jq .
```

**Antwort:** `erfolg`, `name`, `nachricht`, `geloeschte_snapshots`.

### GET /api/snapshots

Alle vorhandenen Snapshots auflisten.

```bash
curl -s "http://localhost:3847/api/snapshots" | jq .
```

**Antwort:** `snapshots` (Liste mit `name`, `creation_time`, `size`), `total`.

### POST /api/snapshots/{name}/restore

Snapshot wiederherstellen. Ueberschreibt die aktuelle Datenbank mit dem Stand des Snapshots.

```bash
curl -s -X POST "http://localhost:3847/api/snapshots/paragraf-2026-01-15.snapshot/restore" | jq .
```

**Antwort:** `erfolg`, `nachricht`.

### DELETE /api/snapshots/{name}

Snapshot loeschen.

```bash
curl -s -X DELETE "http://localhost:3847/api/snapshots/paragraf-2026-01-15.snapshot" | jq .
```

---

## System

### GET /api/health

Health-Check. Prueft ob Backend, Qdrant-Verbindung und ML-Modelle bereit sind. Der Frontend-HealthOverlay pollt diesen Endpoint automatisch.

```bash
curl -s "http://localhost:3847/api/health" | jq .
```

**Antwort:**

```json
{
  "status": "ready",
  "embedding_model": "BAAI/bge-m3",
  "embedding_dimension": 1024,
  "embedding_device": "cpu",
  "qdrant_collection": "paragraf",
  "qdrant_status": "green",
  "indexierte_chunks": 5432
}
```

Moegliche Werte fuer `status`: `ready` (bereit), `loading` (ML-Modelle werden geladen), `error` (Fehler).

### GET /api/settings

Aktuelle Konfiguration anzeigen (read-only). Verwenden, um die aktiven Einstellungen des Backends zu pruefen.

```bash
curl -s "http://localhost:3847/api/settings" | jq .
```

**Antwort:** `embedding_device`, `embedding_batch_size`, `embedding_max_length`, `reranker_top_k`, `retrieval_top_k`, `similarity_threshold`, `qdrant_url`, `hf_home`, `torch_home`.

### GET /api/settings/gpu

GPU-Erkennungsstatus. Verwenden, um zu pruefen ob eine NVIDIA-GPU erkannt wurde und ob CUDA verfuegbar ist.

```bash
curl -s "http://localhost:3847/api/settings/gpu" | jq .
```

**Antwort:** `nvidia_smi_available`, `cuda_available`, `gpu_name`, `vram_total_mb`, `current_device`.

### POST /api/models/download

ML-Modelle herunterladen. Laeuft als SSE-Stream mit Fortschrittsmeldungen (Bytes, Geschwindigkeit, ETA). Verwenden beim Erstsetup oder nach Cache-Loeschung.

```bash
curl -N -X POST http://localhost:3847/api/models/download
```

**Antwort:** SSE-Stream mit Events:

```
data: {"type":"start","model":"BAAI/bge-m3","label":"Embedding-Modell"}
data: {"type":"progress","model":"BAAI/bge-m3","downloaded_bytes":104857600,"total_bytes":1258291200,"speed_mbps":52.4,"eta_seconds":22}
data: {"type":"complete","model":"BAAI/bge-m3","message":"Download abgeschlossen"}
data: {"type":"all_complete","message":"Alle Modelle heruntergeladen"}
```

### GET /api/models/status

Download- und Ladestatus der ML-Modelle. Verwenden, um zu pruefen ob die Modelle heruntergeladen und geladen sind.

```bash
curl -s "http://localhost:3847/api/models/status" | jq .
```

**Antwort:** `models_ready`, `models` (Liste mit `name`, `label`, `downloaded`, `size_mb`), `downloading`.

### GET /api/models/cache

Cache-Informationen: Pfad, Gesamtgroesse, freier Speicher. Verwenden fuer Diagnose bei Speicherplatzproblemen.

```bash
curl -s "http://localhost:3847/api/models/cache" | jq .
```

**Antwort:** `cache_path`, `total_size_mb`, `free_space_mb`, `models` (Liste mit `name`, `size_mb`).

### DELETE /api/models/cache

Model-Cache loeschen. Entfernt heruntergeladene ML-Modelle. Die Modelle muessen danach erneut heruntergeladen werden.

```bash
curl -s -X DELETE "http://localhost:3847/api/models/cache" | jq .
```

---

## Rechtlicher Hinweis

Paragraf ist kein Rechtsberatungsdienst im Sinne des Rechtsdienstleistungsgesetzes (RDG). Die Suchergebnisse und Informationen sind allgemeine Rechtsinformationen. Sie ersetzen keine individuelle Rechtsberatung durch eine Rechtsanwaeltin oder einen Rechtsanwalt.

Fuer individuelle Beratung:
- **Rechtsanwaltskammer:** [www.brak.de](https://www.brak.de)
- **EUTB-Beratungsstellen:** [www.teilhabeberatung.de](https://www.teilhabeberatung.de) (kostenlos, Tel: 0800 11 10 111)

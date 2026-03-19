# Paragraf

**Desktop-App & MCP-Server fuer deutsches und europaeisches Recht** – Semantische Suche ueber ~140 Gesetze mit GPU-Beschleunigung.

> **Wichtig:** Dieses System gibt allgemeine Rechtsinformationen, keine individuelle Rechtsberatung im Sinne des RDG. Fuer Einzelfallberatung wenden Sie sich an EUTB-Beratungsstellen (0800 11 10 111) oder Rechtsanwaelte.

---

## Was ist Paragraf?

Paragraf ist ein **Rechtsrecherche-System** mit zwei Nutzungsarten:

1. **Desktop-App** (Electron + React) – Eigenstaendige Anwendung mit grafischer Oberflaeche fuer Suche, Nachschlagen, Vergleich und Gesetzesbrowser
2. **MCP-Server** – Werkzeug fuer KI-Assistenten (Claude Desktop/Code), die im Hintergrund auf Gesetzestexte zugreifen

Die Suche nutzt einen **RAG-Pipeline** (Retrieval-Augmented Generation) mit Hybrid-Search, Cross-Encoder Reranking und hierarchischem Chunking.

### Abgedeckte Rechtsgebiete

| Rechtsgebiet | Beispiele | Anzahl |
|---|---|---|
| Sozialrecht | SGB I–XIV, BKGG | ~20 |
| Behindertenrecht | BGG, AGG, VersMedV | ~5 |
| Steuerrecht | EStG, UStG, AO, KStG, ErbStG | ~10 |
| Buergerliches Recht | BGB, ZPO, FamFG, WEG | ~15 |
| Strafrecht | StGB, StPO, OWiG | ~5 |
| Arbeitsrecht | ArbZG, BetrVG, KSchG, MuSchG | ~10 |
| Verwaltungsrecht | VwVfG, VwGO, BauGB | ~10 |
| Verkehrsrecht | StVO, StVZO, FeV, FZV | ~5 |
| EU-Recht | DSGVO, AI Act, EU-GRCh, AEUV | 9 |
| Weitere | Aufenthaltsrecht, Umwelt, Datenschutz, ... | ~50 |

**Gesamt: ~140 Gesetze** aus 18 Rechtsgebieten (DE: gesetze-im-internet.de, EU: EUR-Lex)

---

## Desktop-App

![Desktop-App](docs/screenshot.png)

### Features

- **Semantische Suche** – Natuerlichsprachliche Anfragen ueber alle Gesetze
- **Paragraph nachschlagen** – Direkter Zugriff auf einzelne Paragraphen
- **Vergleich** – Bis zu 5 Paragraphen nebeneinander
- **Gesetzesbrowser** – Alle Gesetze mit Struktur und Volltext
- **EUTB-Beratungsstellen** – Suche nach Ort, Bundesland, Schwerpunkt
- **Index-Management** – Gesetze auswaehlen und indexieren, mit Echtzeit-Log
- **Einstellungen** – CPU/GPU-Wahl, Suchparameter, MCP-Server, Cache-Verwaltung
- **Setup-Wizard** – Automatische GPU-Erkennung und PyTorch-Installation
- **Tastenkuerzel** – Ctrl+1–7 fuer Seitenwechsel, Ctrl+K fuer Suche

### Einstellungen

Ueber die Settings-Seite konfigurierbar (ohne `.env` manuell bearbeiten):

- **Leistung:** CPU/GPU-Auswahl, Batch-Groesse, Max Token-Laenge
- **Suchqualitaet:** Ergebnisse (Reranking), Kandidaten (Retrieval), Relevanz-Schwelle
- **Verbindung:** Qdrant URL
- **Cache-Verzeichnisse:** HuggingFace/PyTorch-Cache mit Speicheranzeige
- **MCP-Server:** Start/Stop direkt in der App (streamable-http, Port 8001)

---

## MCP-Server (fuer Claude Desktop/Code)

Der MCP-Server stellt Werkzeuge bereit, die Claude automatisch nutzt:

| Werkzeug | Zweck | Beispiel |
|---|---|---|
| `paragraf_search` | Semantische Suche | "Welche Leistungen bei Pflegebeduerftigkeit?" |
| `paragraf_lookup` | Paragraph nachschlagen | "Was steht in § 35a SGB VIII?" |
| `paragraf_compare` | Paragraphen vergleichen | "Vergleiche § 2 SGB IX mit § 3 BGG" |
| `paragraf_laws` | Gesetze auflisten | "Welche Gesetze sind verfuegbar?" |
| `paragraf_counseling` | EUTB-Stellen finden | "Beratungsstelle in Muenchen?" |
| `paragraf_status` | Status pruefen | "Wie viele Chunks indexiert?" |
| `paragraf_index` | Gesetze indexieren | Admin-Tool |
| `paragraf_index_eutb` | EUTB-Daten importieren | Admin-Tool |

### Prompt-Templates

| Prompt | Beschreibung |
|---|---|
| `paragraf_legal_info` | Allgemeine Rechtsauskunft |
| `paragraf_easy_language` | Erklaerung in Leichter Sprache (DIN SPEC 33429) |
| `paragraf_compensation` | Nachteilsausgleiche nach Behinderungsart |
| `paragraf_benefits` | Voraussetzungen fuer Sozialleistungen |

---

## REST-API

Die Desktop-App kommuniziert ueber 13 REST-Endpoints:

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/health` | Server-Status und Modell-Info |
| GET | `/api/settings` | Aktuelle Konfiguration |
| GET | `/api/settings/gpu` | GPU-Verfuegbarkeit pruefen |
| POST | `/api/search` | Hybride semantische Suche |
| POST | `/api/lookup` | Einzelnen Paragraph nachschlagen |
| POST | `/api/compare` | Paragraphen vergleichen |
| GET | `/api/laws` | Alle verfuegbaren Gesetze |
| GET | `/api/laws/{gesetz}/structure` | Struktur eines Gesetzes |
| GET | `/api/laws/{gesetz}/paragraphs` | Alle Paragraphen eines Gesetzes |
| POST | `/api/counseling` | EUTB-Beratungsstellen suchen |
| GET | `/api/index/status` | Indexierungs-Status pro Gesetz |
| POST | `/api/index` | Indexierung starten (SSE-Stream) |
| POST | `/api/index/eutb` | EUTB-Daten importieren |

---

## Tech-Stack

| Komponente | Technologie |
|---|---|
| Desktop | Electron 33 + React 19 + TailwindCSS 4 + Vite 6 |
| Backend | Python 3.12 + FastAPI + Uvicorn |
| MCP | Official Python MCP SDK (FastMCP) |
| Vektordatenbank | Qdrant (nativ, Port 6333) |
| Embedding | BAAI/bge-m3 (Dense + Sparse, 1024-dim) |
| Reranking | BAAI/bge-reranker-v2-m3 (Cross-Encoder) |
| GPU | PyTorch mit CUDA-Support (optional) |
| Package-Manager | uv (Python) + npm (Desktop) |
| Datenquellen | gesetze-im-internet.de (XML) + EUR-Lex (HTML) |

### Such-Pipeline

```
Anfrage → bge-m3 Embedding → Qdrant Hybrid-Search (Dense + Sparse/BM25 via RRF)
       → Cross-Encoder Reranking → Schwellenwert-Filter → Deduplizierung → Ergebnis
```

---

## Installation

### Voraussetzungen

- **Python 3.12+**
- **Node.js 18+** (fuer Desktop-App)
- **Qdrant** – [Download](https://github.com/qdrant/qdrant/releases)
- **uv** – [Installation](https://docs.astral.sh/uv/getting-started/installation/)
- **~8 GB RAM** (Embedding + Reranker + Qdrant)
- **~4 GB Speicher** (Modelle + Gesetze)
- Optional: **NVIDIA GPU** mit CUDA fuer schnellere Suche

### 1. Projekt klonen und installieren

```bash
git clone https://github.com/gorduan/paragraf.git
cd paragraf

# .env erstellen
cp .env.example .env

# Python-Abhaengigkeiten installieren
uv sync
```

**Mit GPU (NVIDIA CUDA):**

PyTorch wird automatisch mit CUDA aus dem konfigurierten Index installiert (`pyproject.toml` → `[tool.uv.sources]`). Falls nur CPU gewuenscht:

```bash
uv pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### 2. Qdrant starten

```bash
# Windows:
E:\qdrant\qdrant.exe

# Linux/macOS:
./qdrant
```

Laeuft auf `http://localhost:6333`.

### 3. Desktop-App starten

```bash
cd desktop
npm install
npm run build    # oder: npm run dev (Entwicklung)
npm start
```

Die App startet Qdrant und das Python-Backend automatisch. Beim ersten Start fuehrt ein **Setup-Wizard** durch:
1. GPU-Erkennung und PyTorch-Variante waehlen (CPU/CUDA)
2. Qdrant-Verbindung pruefen
3. Backend starten (Modelle laden)
4. Gesetze indexieren

### 4. MCP-Server nutzen (ohne Desktop-App)

**Claude Code:**

```bash
# MCP-Server registrieren (streamable-http)
claude mcp add paragraf --url http://localhost:8001/mcp

# Oder per stdio:
claude mcp add paragraf \
  --command "uv" \
  --args "run" "--directory" "/pfad/zu/paragraf" "python" "-m" "paragraf"
```

**Claude Desktop** – `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "paragraf": {
      "command": "uv",
      "args": ["run", "--directory", "/pfad/zu/paragraf", "python", "-m", "paragraf"],
      "env": { "QDRANT_URL": "http://localhost:6333" }
    }
  }
}
```

**Standalone REST-API:**

```bash
uv run python -m paragraf --mode api --port 8000
```

---

## Konfiguration (.env)

| Variable | Standard | Beschreibung |
|---|---|---|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant-URL |
| `QDRANT_COLLECTION` | `paragraf` | Collection-Name |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | Embedding-Modell |
| `EMBEDDING_DEVICE` | `cpu` | `cpu` oder `cuda` |
| `EMBEDDING_BATCH_SIZE` | `8` | Batch-Groesse |
| `EMBEDDING_MAX_LENGTH` | `512` | Max Token pro Chunk |
| `RERANKER_MODEL` | `BAAI/bge-reranker-v2-m3` | Reranker-Modell |
| `RERANKER_TOP_K` | `5` | Ergebnisse nach Reranking |
| `RETRIEVAL_TOP_K` | `20` | Kandidaten vor Reranking |
| `SIMILARITY_THRESHOLD` | `0.35` | Mindest-Relevanz (0–1) |
| `MCP_TRANSPORT` | `stdio` | `stdio` oder `streamable-http` |
| `MCP_PORT` | `8000` | Port (MCP/API) |
| `HF_HOME` | (System) | HuggingFace-Cache-Pfad |
| `TORCH_HOME` | (System) | PyTorch-Cache-Pfad |
| `LOG_LEVEL` | `INFO` | Log-Level |

Alle Werte sind ueber die Settings-Seite der Desktop-App aenderbar.

---

## Projektstruktur

```
paragraf/
├── src/paragraf/                  # Python Backend
│   ├── __main__.py                # Entry Point (--mode mcp|api)
│   ├── server.py                  # FastMCP Server + Lifespan
│   ├── api.py                     # FastAPI REST-Layer (13 Endpoints)
│   ├── api_models.py              # Pydantic Request/Response-Modelle
│   ├── config.py                  # Pydantic Settings (.env)
│   ├── models/
│   │   └── law.py                 # LAW_REGISTRY (~140 Gesetze), Datenmodelle
│   ├── services/
│   │   ├── embedding.py           # bge-m3 Dense + Sparse Embeddings
│   │   ├── qdrant_store.py        # Qdrant Hybrid-Search + Upsert
│   │   ├── reranker.py            # Cross-Encoder Reranking
│   │   ├── parser.py              # XML-Parser (gesetze-im-internet.de)
│   │   ├── eurlex_client.py       # EUR-Lex HTML-Downloader
│   │   └── eurlex_parser.py       # EUR-Lex HTML-Parser
│   ├── tools/                     # MCP Tool-Definitionen
│   └── prompts/                   # MCP Prompt-Templates
├── desktop/                       # Electron Desktop-App
│   ├── src/main/                  # Main-Prozess (Backend, IPC, Qdrant)
│   ├── src/preload/               # Security Bridge (Context Isolation)
│   └── src/renderer/              # React Frontend
│       ├── pages/                 # 7 Seiten (Search, Lookup, Compare, ...)
│       ├── components/            # UI-Komponenten (Sidebar, SetupWizard, ...)
│       ├── hooks/                 # React Hooks (useBackend)
│       └── lib/                   # API-Client (typisiert)
├── data/                          # Gesetze + EUTB-Daten (gitignored)
├── .env                           # Konfiguration
├── pyproject.toml                 # Python-Abhaengigkeiten + uv-Config
└── CLAUDE.md                      # Projekt-Konventionen fuer KI-Assistenten
```

---

## Entwicklung

```bash
# Python-Backend starten
uv run python -m paragraf --mode api --port 8000

# Desktop-App im Dev-Modus
cd desktop && npm run dev

# Tests
uv run pytest tests/ -v

# Linting
uv run ruff check src/
```

---

## Bekannte Einschraenkungen

- **Qdrant auf Windows:** Segment-Optimizer kann auf Windows File-Lock-Probleme haben ([#1](https://github.com/gorduan/paragraf/issues/1)). Workaround: Qdrant-Storage aus Windows Defender ausschliessen oder Qdrant in Docker nutzen.
- **EUR-Lex:** Bot-Protection (AWS WAF) verhindert automatische Downloads. Die Desktop-App nutzt Playwright als Fallback.
- **Speicherplatz:** Embedding- und Reranker-Modelle benoetigen ~4 GB. Cache-Verzeichnisse sind konfigurierbar.

## Rechtliche Hinweise

- **Gesetzestexte** sind nach § 5 Abs. 1 UrhG gemeinfrei
- **Keine Rechtsberatung** im Sinne des RDG – nur allgemeine Rechtsinformation
- **DSGVO:** Lokale Verarbeitung, keine Speicherung von Nutzeranfragen
- **EU AI Act:** Transparenzkennzeichnung als KI-System (Art. 50)

## Lizenz

MIT

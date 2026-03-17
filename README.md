# Paragraf

**MCP-Server fuer deutsches Recht** mit RAG-basierter Rechtsauskunft.

> **Wichtig:** Dieses System gibt allgemeine Rechtsinformationen, keine individuelle Rechtsberatung im Sinne des RDG. Fuer Einzelfallberatung wenden Sie sich an EUTB-Beratungsstellen (0800 11 10 111) oder Rechtsanwaelte.

---

## Was macht dieses Projekt?

### Kurz gesagt
Paragraf ist ein **digitaler Assistent fuer deutsches Recht**. Er kennt alle Sozialgesetzbuecher (SGB I–XIV), das Behindertengleichstellungsgesetz (BGG), das AGG, die Versorgungsmedizin-Verordnung, das Einkommensteuergesetz, das Kraftfahrzeugsteuergesetz und weitere Gesetze – und kann darin intelligent suchen.

Er wird als **MCP-Server** (Model Context Protocol) betrieben – das bedeutet, er wird nicht direkt von einem Menschen bedient, sondern von einem **KI-Assistenten wie Claude** als Werkzeug benutzt. Wenn jemand mit Claude chattet und eine Frage zum deutschen Recht stellt, greift Claude automatisch auf diesen Server zu, um die passenden Gesetzestexte zu finden.

### Wie funktioniert die Nutzung?

Ein Nutzer stellt Claude eine Frage in natuerlicher Sprache. Claude erkennt, dass es um deutsches Recht geht, und ruft im Hintergrund die passenden Werkzeuge des MCP-Servers auf. Der Nutzer merkt davon nichts – er bekommt einfach eine fundierte Antwort mit genauen Paragraphen-Verweisen.

---

## Werkzeug-Uebersicht

| Werkzeug | Zweck | Beispiel-Frage |
|---|---|---|
| `paragraf_search` | Freie Suche in allen Gesetzen | "Welche Leistungen bei Pflegebeduerftigkeit?" |
| `paragraf_lookup` | Einzelnen Paragraphen nachschlagen | "Was steht in § 35a SGB VIII?" |
| `paragraf_compare` | Mehrere Paragraphen gegenueberstellen | "Vergleiche § 2 SGB IX mit § 3 BGG" |
| `paragraf_laws` | Alle verfuegbaren Gesetze anzeigen | "Welche Gesetze sind in der Datenbank?" |
| `paragraf_counseling` | EUTB-Beratungsstellen finden | "Beratungsstelle in Muenchen?" |
| `paragraf_status` | Technischen Status pruefen | "Wie viele Paragraphen sind indexiert?" |

Jede Antwort enthaelt automatisch einen **Rechtshinweis**, dass es sich um allgemeine Information und nicht um individuelle Rechtsberatung handelt (gesetzlich vorgeschrieben nach dem Rechtsdienstleistungsgesetz).

---

## Prompt-Templates

| Prompt | Beschreibung |
|---|---|
| `paragraf_legal_info` | Allgemeine Rechtsauskunft zu einem rechtlichen Thema |
| `paragraf_easy_language` | Erklaerung in Leichter Sprache (DIN SPEC 33429) |
| `paragraf_compensation` | Nachteilsausgleiche nach Behinderungsart |
| `paragraf_benefits` | Voraussetzungen fuer Sozialleistungen pruefen |

---

## Features (technisch)

- **Hybrid-Search:** Kombiniert semantische Suche (Dense Vektoren) mit Keyword-Suche (Sparse/BM25) ueber Reciprocal Rank Fusion
- **Cross-Encoder Reranking:** BAAI/bge-reranker-v2-m3 fuer praezise Relevanz-Bewertung
- **Hierarchisches Chunking:** Respektiert die Struktur deutscher Gesetze (Buch > Teil > Kapitel > § > Absatz)
- **Leichte Sprache:** Prompt-Template nach DIN SPEC 33429
- **EUTB-Integration:** Suche nach Beratungsstellen fuer Menschen mit Behinderungen
- **RDG-konform:** System ist als Rechtsinformationssystem konzipiert, nicht als Rechtsberater

## Tech-Stack

| Komponente | Technologie |
|---|---|
| MCP SDK | `mcp` (Official Python SDK) mit FastMCP |
| Vektordatenbank | Qdrant (Docker) |
| Embedding | BAAI/bge-m3 (Dense + Sparse, 1024-dim) |
| Reranking | BAAI/bge-reranker-v2-m3 (Cross-Encoder) |
| XML-Parsing | lxml + BeautifulSoup4 |
| Datenquelle | gesetze-im-internet.de (XML, gemeinfrei nach § 5 UrhG) |

## Installation

### Voraussetzungen

- **Python 3.12+**
- **Docker** (fuer die Qdrant-Vektordatenbank)
- **~8 GB RAM** (Embedding-Modell + Reranker + Qdrant)
- **uv** als Package-Manager (empfohlen) – [Installation](https://docs.astral.sh/uv/getting-started/installation/)
- **Git** (zum Klonen des Projekts)

### Schritt 1: Projekt herunterladen und installieren

```bash
git clone https://github.com/gorduan/paragraf.git
cd paragraf

# .env Konfiguration erstellen
cp .env.example .env

# Virtual Environment und alle Abhaengigkeiten installieren
uv venv
uv pip install -e ".[dev]"
```

<details>
<summary>Alternative ohne uv (mit pip)</summary>

```bash
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -e ".[dev]"
```

</details>

### Schritt 2: Qdrant-Datenbank starten

```bash
docker compose up -d qdrant
```

Dies startet die Qdrant-Vektordatenbank auf `http://localhost:6333`. Sie koennen pruefen, ob Qdrant laeuft:

```bash
curl http://localhost:6333/healthz
```

### Schritt 3: Gesetze herunterladen und indexieren

```bash
# Ein einzelnes Gesetz (schnell, zum Testen ~2 Min)
uv run python scripts/ingest_gesetze.py --gesetz "SGB IX"

# Alle Gesetze (dauert je nach Rechner 10-30 Min)
uv run python scripts/ingest_gesetze.py --all
```

Dieser Schritt laedt die Gesetzestexte von gesetze-im-internet.de herunter, zerlegt sie in suchbare Abschnitte und speichert sie als Vektoren in Qdrant.

### Schritt 4: Server starten

```bash
# stdio-Modus (fuer Claude Desktop / Claude Code)
uv run python -m paragraf

# HTTP-Modus (fuer Remote-Zugriff)
MCP_TRANSPORT=streamable-http uv run python -m paragraf
```

### Alternative: Alles mit Docker

```bash
# Startet Qdrant + MCP-Server zusammen (HTTP-Modus auf Port 8000)
docker compose up -d
```

---

## Einrichtung fuer Claude Desktop

Claude Desktop verbindet sich per **stdio** – der MCP-Server wird als lokaler Prozess gestartet und kommuniziert direkt mit Claude.

### 1. Konfigurationsdatei oeffnen

| Betriebssystem | Pfad |
|---|---|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |

Falls die Datei nicht existiert, erstelle sie.

### 2. MCP-Server eintragen

**Windows:**

```json
{
  "mcpServers": {
    "paragraf": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "C:\\Users\\DeinName\\paragraf",
        "python",
        "-m",
        "paragraf"
      ],
      "env": {
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

**macOS / Linux:**

```json
{
  "mcpServers": {
    "paragraf": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/home/deinname/paragraf",
        "python",
        "-m",
        "paragraf"
      ],
      "env": {
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

> **Wichtig:** Ersetze den Pfad in `--directory` durch den tatsaechlichen Pfad zu deinem Projekt.

### 3. Claude Desktop neu starten

Nach dem Speichern der Konfiguration Claude Desktop komplett beenden und neu starten. In einem neuen Chat sollte das Werkzeug-Symbol (Hammer) erscheinen und die Paragraf-Tools auflisten.

### 4. Testen

Stelle Claude eine Frage wie:

> "Welche Voraussetzungen brauche ich fuer einen Schwerbehindertenausweis?"

Claude sollte automatisch das `paragraf_search`-Tool verwenden und mit Paragraphen-Verweisen antworten.

---

## Einrichtung fuer Claude Code (Terminal/CLI)

### 1. MCP-Server registrieren

```bash
claude mcp add paragraf \
  --command "uv" \
  --args "run" "--directory" "/pfad/zu/paragraf" "python" "-m" "paragraf" \
  --env "QDRANT_URL=http://localhost:6333"
```

> **Windows-Pfade:** Verwende `/` statt `\`, z.B. `C:/Users/DeinName/paragraf`

### 2. Pruefen ob registriert

```bash
claude mcp list
```

### 3. Alternativ: Projekt-lokale Konfiguration

Erstelle im Projektverzeichnis die Datei `.mcp.json`:

```json
{
  "mcpServers": {
    "paragraf": {
      "command": "uv",
      "args": ["run", "python", "-m", "paragraf"],
      "env": {
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

---

## Umgebungsvariablen (.env)

| Variable | Standard | Beschreibung |
|---|---|---|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant-Datenbank URL |
| `QDRANT_COLLECTION` | `paragraf` | Name der Qdrant-Collection |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | Embedding-Modell (HuggingFace) |
| `EMBEDDING_DEVICE` | `cpu` | `cpu` oder `cuda` (GPU) |
| `EMBEDDING_BATCH_SIZE` | `8` | Batch-Groesse fuer Embedding-Erzeugung |
| `EMBEDDING_MAX_LENGTH` | `512` | Max. Token-Laenge pro Chunk |
| `RERANKER_MODEL` | `BAAI/bge-reranker-v2-m3` | Cross-Encoder Reranker-Modell |
| `RERANKER_TOP_K` | `5` | Anzahl Ergebnisse nach Reranking |
| `MCP_TRANSPORT` | `stdio` | `stdio` oder `streamable-http` |
| `MCP_HOST` | `0.0.0.0` | Host fuer HTTP-Modus |
| `MCP_PORT` | `8000` | Port fuer HTTP-Modus |
| `LOG_LEVEL` | `INFO` | Log-Level (DEBUG, INFO, WARNING, ERROR) |
| `DATA_DIR` | `./data` | Verzeichnis fuer heruntergeladene Gesetze |

## Projektstruktur

```
paragraf/
├── src/paragraf/
│   ├── __main__.py           # Entry Point
│   ├── server.py             # FastMCP + Lifespan
│   ├── config.py             # Pydantic Settings
│   ├── models/
│   │   └── law.py            # Datenmodelle (Chunk, SearchResult, etc.)
│   ├── services/
│   │   ├── embedding.py      # bge-m3 Dense + Sparse
│   │   ├── qdrant_store.py   # Qdrant Hybrid-Search
│   │   ├── parser.py         # XML-Parser fuer gesetze-im-internet.de
│   │   └── reranker.py       # Cross-Encoder Reranking
│   ├── tools/
│   │   ├── search.py         # paragraf_search, paragraf_lookup, paragraf_compare
│   │   ├── lookup.py         # paragraf_laws, paragraf_counseling, paragraf_status
│   │   └── ingest.py         # paragraf_index, paragraf_index_eutb
│   └── prompts/
│       └── __init__.py       # Prompt-Templates
├── scripts/
│   └── ingest_gesetze.py     # Standalone-Indexierung
├── tests/
├── data/                     # Heruntergeladene Gesetze (gitignored)
├── docker-compose.yml        # Qdrant + MCP-Server
├── Dockerfile                # Container-Build
├── CLAUDE.md                 # Projekt-Konventionen
├── pyproject.toml
└── .env.example
```

## Rechtliche Hinweise

- **Gesetzestexte** sind nach § 5 Abs. 1 UrhG gemeinfrei
- **System-Design** ist als Rechtsinformationssystem (nicht Rechtsberatung) konzipiert
- **DSGVO:** Keine Speicherung von Nutzeranfragen, lokale Verarbeitung
- **EU AI Act:** Transparenzkennzeichnung als KI-System erforderlich (Art. 50)

## Lizenz

MIT

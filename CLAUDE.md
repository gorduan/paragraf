# Paragraf – MCP Server fuer deutsches Recht

## Projektbeschreibung
MCP-Server fuer deutsches Recht mit RAG-basierter Rechtsauskunft.
Verwendet BAAI/bge-m3 Embeddings, Qdrant Hybrid-Search (Dense + Sparse mit RRF-Fusion)
und Cross-Encoder Reranking.

## Tech-Stack
- **Python 3.12+** mit FastMCP (Official MCP SDK)
- **Qdrant** als Vektordatenbank (Docker, Port 6333)
- **BAAI/bge-m3** (1024-dim Dense + Sparse Lexical Weights)
- **BAAI/bge-reranker-v2-m3** (Cross-Encoder Reranking)
- **Pydantic v2** fuer Modelle und Settings
- **httpx** fuer async HTTP, **lxml/BeautifulSoup** fuer XML-Parsing
- **uv** als Package-Manager

## Projektstruktur
```
src/paragraf/
  __main__.py        # Entry Point
  server.py          # FastMCP + Lifespan
  config.py          # Pydantic Settings (.env)
  models/law.py      # Datenmodelle (LawChunk, SearchResult, etc.)
  services/
    embedding.py     # bge-m3 Dense+Sparse Embeddings
    qdrant_store.py  # Qdrant Collection + Hybrid Search
    reranker.py      # Cross-Encoder + LongContextReorder
    parser.py        # XML-Parser fuer gesetze-im-internet.de
  tools/
    search.py        # paragraf_search, paragraf_lookup, paragraf_compare
    lookup.py        # paragraf_laws, paragraf_counseling, paragraf_status
    ingest.py        # paragraf_index, paragraf_index_eutb
  prompts/           # MCP Prompt-Templates
```

## MCP Tools
- `paragraf_search` – Semantische Suche ueber alle deutschen Gesetze
- `paragraf_lookup` – Exakten Paragraphen nachschlagen
- `paragraf_compare` – Mehrere Paragraphen gegenueberstellen
- `paragraf_laws` – Alle verfuegbaren Gesetze auflisten
- `paragraf_counseling` – EUTB-Beratungsstellen finden
- `paragraf_status` – Server- und Datenbank-Status
- `paragraf_index` – Gesetze importieren (Admin)
- `paragraf_index_eutb` – EUTB-Daten importieren (Admin)

## Entwicklung

### Setup
```bash
uv venv && uv pip install -e ".[dev]"
docker compose up -d  # Qdrant starten
```

### Tests ausfuehren
```bash
uv run pytest tests/ -v
```

### Server starten (lokal, stdio)
```bash
uv run python -m paragraf
```

### Gesetze indexieren
```bash
uv run python scripts/ingest_gesetze.py --all
```

## Wichtige Konventionen
- Alle Gesetzes-Abkuerzungen in roemischen Zahlen: "SGB IX" nicht "SGB 9"
- RDG-Disclaimer bei jeder Antwort: Keine individuelle Rechtsberatung
- Async/await fuer alle Service-Methoden
- Deutsche Docstrings, englische Variablen-/Funktionsnamen wo sinnvoll
- Structured Logging ueber Python logging-Modul
- Konfiguration via .env und Pydantic Settings (nie hardcoded)
- Tool-Namen mit `paragraf_` Praefix fuer Eindeutigkeit

## Rechtliche Hinweise
- Gesetzestexte: gemeinfrei nach Paragraph 5 UrhG
- Keine Rechtsberatung im Sinne des RDG - nur allgemeine Rechtsinformation
- DSGVO: Stateless, keine Nutzerdatenspeicherung
- EU AI Act Art. 50: KI-Kennzeichnungspflicht ab August 2026

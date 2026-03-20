# Paragraf v2 – Docker Web-App fuer deutsches Recht

Semantische Suche ueber deutsche Gesetze mit RAG-Pipeline (BAAI/bge-m3 Embeddings, Qdrant Hybrid-Search, Cross-Encoder Reranking).

## Quick-Start

```bash
# 1. Repository klonen
git clone <repo-url>
cd "paragraf v2"

# 2. Starten (baut Images beim ersten Mal)
docker compose up --build

# 3. Oeffnen
# http://localhost
```

Das Backend laedt beim ersten Start die ML-Modelle (~2 GB). Dies dauert einige Minuten – der Fortschritt wird im Frontend-Overlay angezeigt.

## Architektur

| Service | Image | Port | Funktion |
|---------|-------|------|----------|
| **qdrant** | qdrant/qdrant:v1.13.2 | 6333 | Vektordatenbank |
| **backend** | Custom (python:3.12-slim) | 8000 | FastAPI + ML-Modelle |
| **frontend** | Custom (nginx:alpine) | 80 | React SPA + API-Proxy |

```
Browser → nginx (:80) → /api/* → backend (:8000) → Qdrant (:6333)
                       → /*    → React SPA (static files)
```

## GPU-Beschleunigung (optional)

Fuer NVIDIA-GPUs mit installiertem [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html):

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## Gesetze indexieren

Nach dem Start muessen die Gesetze erst indexiert werden:

1. Im Frontend die Seite "Index" oeffnen (Ctrl+6)
2. Gewuenschte Gesetze auswaehlen und "Indexieren" klicken
3. Alternativ per API: `curl -X POST http://localhost/api/index -H "Content-Type: application/json" -d '{}'`

## Konfiguration

Alle Einstellungen werden ueber Environment-Variablen in `docker-compose.yml` gesteuert. Siehe `.env.example` fuer alle verfuegbaren Variablen.

## Modelle vorladen (optional)

Um die Modelle einmalig vorzuladen, ohne den Server zu starten:

```bash
docker compose run --rm backend python scripts/download_models.py
```

## Entwicklung

### Backend lokal

```bash
cd backend
pip install -e ".[dev]"
python -m paragraf --mode api --port 8000
```

### Frontend lokal

```bash
cd frontend
npm install
npm run dev
```

Der Vite Dev-Server proxied `/api/*` automatisch zum Backend auf Port 8000.

### Tests

```bash
docker compose exec backend python -m pytest tests/ -v
```

## Rechtliche Hinweise

- Gesetzestexte: gemeinfrei nach Paragraph 5 UrhG
- Keine Rechtsberatung im Sinne des RDG – nur allgemeine Rechtsinformation
- DSGVO: Stateless, keine Nutzerdatenspeicherung

# Paragraf v2 – Docker Web-App fuer deutsches Recht

## Projektbeschreibung
Docker-basierte Web-App fuer deutsches Recht mit RAG-basierter Rechtsauskunft.
Verwendet BAAI/bge-m3 Embeddings, Qdrant Hybrid-Search (Dense + Sparse mit RRF-Fusion)
und Cross-Encoder Reranking. Deployment per `docker compose up`.

## Tech-Stack
- **Python 3.12+** mit FastMCP (Official MCP SDK) + FastAPI (REST-API)
- **React 19** + Vite + TailwindCSS (Web-App, kein Electron)
- **nginx** als Reverse-Proxy + SPA-Hosting
- **Qdrant** als Vektordatenbank (Docker Service, Port 6333)
- **BAAI/bge-m3** (1024-dim Dense + Sparse Lexical Weights)
- **BAAI/bge-reranker-v2-m3** (Cross-Encoder Reranking)
- **Docker Compose** fuer Orchestrierung (3 Services)
- **Pydantic v2** fuer Modelle und Settings

## Projektstruktur
```
paragraf v2/
├── docker-compose.yml          # 3 Services: qdrant, backend, frontend
├── docker-compose.gpu.yml      # GPU-Override (optional)
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── src/paragraf/           # Python Backend (unveraendert von v1)
│   ├── tests/
│   └── scripts/
└── frontend/
    ├── Dockerfile              # Multi-stage: node:22 → nginx:alpine
    ├── nginx.conf              # SPA-Routing + API-Reverse-Proxy
    ├── docker-entrypoint.sh    # Runtime API_BASE_URL injection
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx             # useHealthCheck, HealthOverlay
        ├── lib/api.ts          # REST-Client (leere BASE_URL = nginx-Proxy)
        ├── hooks/
        │   ├── useApi.ts
        │   └── useHealthCheck.ts  # REST-basiertes Health-Polling
        ├── components/
        │   ├── HealthOverlay.tsx   # Verbindungs-/Ladestatus-Overlay
        │   ├── ServerStatus.tsx
        │   ├── Sidebar.tsx
        │   └── ...
        ├── pages/
        │   ├── SearchPage.tsx
        │   ├── SettingsPage.tsx    # Read-only (Env-Vars via docker-compose)
        │   └── ...
        └── styles/index.css
```

## Docker-Services

| Service | Image | Port | Funktion |
|---------|-------|------|----------|
| **qdrant** | qdrant/qdrant:v1.13.2 | 6333 | Vektordatenbank |
| **backend** | Custom (python:3.12-slim) | 8000 (intern) | FastAPI + ML-Modelle |
| **frontend** | Custom (nginx:alpine) | 80 → Host | React SPA + API-Proxy |

## Entwicklung

### Alles starten
```bash
docker compose up --build
```

### Mit GPU
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

### Tests ausfuehren
```bash
docker compose exec backend python -m pytest tests/ -v
```

### Frontend lokal (Dev-Server)
```bash
cd frontend && npm install && npm run dev
```

## Wichtige Konventionen
- Alle Gesetzes-Abkuerzungen in roemischen Zahlen: "SGB IX" nicht "SGB 9"
- RDG-Disclaimer bei jeder Antwort: Keine individuelle Rechtsberatung
- Async/await fuer alle Service-Methoden
- Deutsche Docstrings, englische Variablen-/Funktionsnamen wo sinnvoll
- Konfiguration ueber Environment-Variablen in docker-compose.yml
- Settings-Page ist Read-Only (keine .env-Editor mehr)
- HealthOverlay statt SetupWizard (kein Electron-IPC)

## Unterschiede zu v1
- Kein Electron – reine Web-App via nginx
- Kein `useBackend` Hook – ersetzt durch `useHealthCheck` (REST-Polling)
- Kein `SetupWizard` – ersetzt durch `HealthOverlay` (simpler Verbindungs-Check)
- SettingsPage ist Read-Only (Docker-Env-Vars statt .env-Editor)
- API BASE_URL leer (nginx proxied `/api/*` zum Backend)
- ML-Modelle im Docker Volume gecacht (lazy download beim ersten Start)

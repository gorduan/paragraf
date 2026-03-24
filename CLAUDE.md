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

## Skills & Subagents

### IMPORTANT: Nutze Subagents so oft wie moeglich
Spawn Subagents fuer **jede nicht-triviale Teilaufgabe**:
- **Explore-Agent**: Codebase durchsuchen, Abhaengigkeiten finden, Ist-Zustand analysieren
- **Plan-Agent**: Implementierungsplaene erstellen, Architektur-Entscheidungen vorbereiten
- **Implementierungs-Agent**: Aenderungen an mehreren Dateien parallel ausfuehren
- **Review-Agent**: Code-Reviews, Konsistenz-Checks nach Aenderungen

### Skill-Referenz
| Aufgabe | Skill |
|---------|-------|
| Rechtsrecherche benchmarken | `/paragraf-bench` |
| Neue Skills finden/installieren | `/find-skills` |
| Frontend-UI bauen/aendern | `/frontend-design`, `/ui-ux-pro-max` |
| Styling (Tailwind/shadcn) | `/ckm-ui-styling` |
| Design-System/Tokens/Slides | `/ckm-design-system`, `/ckm-slides` |
| Branding/Logos/Banner | `/ckm-design`, `/ckm-brand`, `/ckm-banner-design` |
| MCP-Server erstellen | `/mcp-builder` |
| Skills erstellen/aendern | `/skill-creator` |
| TDD-Workflow (Red-Green-Refactor) | `/test-driven-development` (obra/superpowers) |
| Security & Codebase Audit | Plugin: `codebase-audit-suite` (OWASP, Architecture, Code Quality) |
| Agile Workflow & Testing | Plugin: `agile-workflow` (TDD, Test-Planner, Quality Gates) |
| E2E Browser-Tests | Plugin: `playwright-skill` (Playwright Automation) |
| Web-App Testing | `/webapp-testing` (Playwright-basiert, Screenshots, Logs) |
| CI/CD Pipelines | Plugin: `ci-cd` (GitHub Actions, Pipeline-Design) |
| Monitoring & Observability | Plugin: `monitoring-observability` (Prometheus, Grafana) |
| Performance-Optimierung | Plugin: `optimization-suite` (Profiling, Dependencies) |
| Projekt-Dokumentation | Plugin: `documentation-pipeline` (CLAUDE.md, README, API-Spec) |
| Projekt-Bootstrap/Docker | Plugin: `project-bootstrap` (Scaffolding, Docker, CI/CD) |
| Security-Guidance | Plugin: `security-guidance` (OWASP Best Practices) |
| PDF-Erstellung/Manipulation | `/pdf` (Erstellen, Mergen, Extrahieren) |
| Code vereinfachen | `/simplify` (Built-in) |

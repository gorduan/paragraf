# Paragraf – RAG-basierte Rechtsrecherche fuer deutsches Recht

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
paragraf/
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

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Paragraf 0.9-beta — RAG-basierte Rechtsrecherche fuer deutsches Recht**

RAG-basierte Rechtsrecherche fuer deutsches und europaeisches Recht. Nutzt BAAI/bge-m3 Embeddings, Qdrant Hybrid-Search (Dense + Sparse mit RRF-Fusion) und Cross-Encoder Reranking. Der MCP-Server fuer Claude Desktop/Code ist die primaere Staerke des Systems; das React-Frontend dient als Demo-Interface. Gruendliche Suche ueber ~100 Gesetze mit Querverweisen und Zitationsnetzwerk.

**Core Value:** Juristen und Buerger finden in Sekunden die relevanten Paragraphen — mit semantischer Suche, Querverweisen zwischen Gesetzen und gruppierten Ergebnissen, die den Kontext einer Rechtsfrage vollstaendig erschliessen.

### Constraints

- **Tech Stack**: Python 3.12 + FastAPI + FastMCP, React 19 + Vite + TailwindCSS — beibehalten
- **Deployment**: Docker Compose only — keine Kubernetes, kein Cloud-Deployment
- **Qdrant Version**: v1.13.2 — Features muessen mit dieser Version kompatibel sein
- **Modelle**: BAAI/bge-m3 + bge-reranker-v2-m3 — keine neuen ML-Modelle einfuehren
- **Sprache**: Deutsche UI, deutsche Docstrings, englische Variablen/Funktionsnamen
- **Branch**: Alle Commits direkt auf `main`
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3.12+ - Backend (FastAPI REST-API, MCP Server, ML pipeline, law parsing)
- TypeScript 5.6+ - Frontend (React SPA)
- Shell (sh) - `frontend/docker-entrypoint.sh` (runtime config injection)
- nginx config - `frontend/nginx.conf` (reverse proxy + SPA routing)
## Runtime
- Python 3.12-slim (Docker, multi-stage build) - `backend/Dockerfile`
- Node.js 22-alpine (build-only, not runtime) - `frontend/Dockerfile` stage 1
- nginx:alpine (runtime for frontend) - `frontend/Dockerfile` stage 2
- pip (Python) - no lockfile, installs from `backend/pyproject.toml`
- npm (Node.js) - lockfile: `frontend/package-lock.json` (optional, `package-lock.json*` glob in Dockerfile)
## Frameworks
- FastAPI >=0.115.0 - REST-API layer (`backend/src/paragraf/api.py`)
- FastMCP (mcp[cli] >=1.0.0) - MCP protocol server (`backend/src/paragraf/server.py`)
- React 19 - Frontend SPA (`frontend/src/`)
- Vite 6 - Frontend build tool + dev server (`frontend/vite.config.ts`)
- TailwindCSS 4 - Utility-first CSS (`frontend/package.json`)
- pytest >=8.0.0 - Python test runner (`backend/pyproject.toml` [dev])
- pytest-asyncio >=0.23.0 - Async test support, `asyncio_mode = "auto"` (`backend/pyproject.toml`)
- Hatchling - Python build backend (`backend/pyproject.toml`)
- Ruff >=0.4.0 - Python linter + formatter, target py312, line-length 100 (`backend/pyproject.toml`)
- mypy >=1.10.0 - Static type checker, strict mode (`backend/pyproject.toml`)
- TypeScript 5.6+ - Frontend type checking, strict mode (`frontend/tsconfig.json`)
- @vitejs/plugin-react >=4.3.0 - React JSX transform for Vite (`frontend/package.json`)
- @tailwindcss/vite >=4.0.0 - Tailwind CSS Vite integration (`frontend/package.json`)
## Key Dependencies
- torch >=2.2.0 - PyTorch (CPU-only in Docker, CUDA optional via `docker-compose.gpu.yml`)
- FlagEmbedding >=1.3.0 - BAAI/bge-m3 native model loader (Dense + Sparse in one pass)
- sentence-transformers >=3.0.0 - Fallback embedding if FlagEmbedding unavailable
- transformers >=4.44.0,<5.0.0 - HuggingFace Transformers (transitive + direct)
- tiktoken >=0.7.0 - Token counting
- qdrant-client >=1.12.0 - Async Qdrant vector DB client (`backend/src/paragraf/services/qdrant_store.py`)
- rank-bm25 >=0.2.2 - BM25 ranking (RAG pipeline)
- uvicorn[standard] >=0.32.0 - ASGI server for FastAPI (`backend/src/paragraf/__main__.py`)
- pydantic >=2.0.0 - Data models and validation
- pydantic-settings >=2.0.0 - Environment-based configuration (`backend/src/paragraf/config.py`)
- httpx >=0.27.0 - Async HTTP client (law downloads, EUTB data)
- structlog >=24.0.0 - Structured logging
- tenacity >=8.2.0 - Retry logic
- lxml >=5.0.0 - XML parsing (law XML from gesetze-im-internet.de)
- beautifulsoup4 >=4.12.0 - HTML/XML parsing (`backend/src/paragraf/services/parser.py`)
- openpyxl >=3.1.0 - Excel parsing (EUTB counseling center data)
- react >=19.0.0 - UI framework
- react-dom >=19.0.0 - DOM rendering
- lucide-react >=0.460.0 - Icon library
- llmlingua >=0.2.0 - Prompt compression (optional `[compression]` extra)
## Configuration
- All configuration via environment variables in `docker-compose.yml`
- Pydantic Settings reads from env vars or `.env` file (`backend/src/paragraf/config.py`)
- `.env.example` provides template - copy to `.env` for local overrides
- Frontend uses `window.__PARAGRAF_API_BASE_URL__` for runtime API URL injection (`frontend/docker-entrypoint.sh`)
- `docker-compose.yml` - Service orchestration + all env vars
- `docker-compose.gpu.yml` - GPU override (NVIDIA, sets `EMBEDDING_DEVICE=cuda`)
- `backend/pyproject.toml` - Python project config, dependencies, tool settings
- `frontend/vite.config.ts` - Vite build config with `@` path alias to `src/`
- `frontend/tsconfig.json` - TypeScript config (ES2022, strict, bundler resolution)
- `frontend/nginx.conf` - nginx reverse proxy + SPA routing + gzip + caching
- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode enabled
- Path alias: `@/*` maps to `src/*` (`frontend/tsconfig.json`)
## Build System
- Build backend: Hatchling (`backend/pyproject.toml`)
- Wheel packages: `src/paragraf` (`[tool.hatch.build.targets.wheel]`)
- Multi-stage Docker: python:3.12-slim builder + runtime
- PyTorch CPU-only installed separately from pytorch.org/whl/cpu to save ~3GB
- Build: `tsc && vite build` (type-check then bundle)
- Multi-stage Docker: node:22-alpine build + nginx:alpine serve
- Output: `frontend/dist/` served by nginx
- Dev proxy: Vite proxies `/api` to `http://localhost:8000` (`frontend/vite.config.ts`)
## Platform Requirements
- Docker + Docker Compose (primary workflow)
- Node.js 22 (only for `cd frontend && npm run dev` local dev)
- Python 3.12+ (only if running backend outside Docker)
- Docker Compose with 4 services: qdrant, backend, mcp, frontend
- ~4-8GB RAM minimum (ML models: bge-m3 ~2GB, bge-reranker-v2-m3 ~2GB)
- Optional: NVIDIA GPU with CUDA for faster inference
- 3847 (host) -> 80 (frontend/nginx)
- 8000 (host) -> 8000 (backend FastAPI)
- 8001 (host) -> 8001 (MCP streamable-http)
- 6333 (host) -> 6333 (Qdrant)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- snake_case for all module files: `embedding.py`, `qdrant_store.py`, `eurlex_parser.py`
- Test files prefixed with `test_`: `test_config.py`, `test_embedding.py`, `test_parser.py`
- Models in dedicated directory: `backend/src/paragraf/models/law.py`
- PascalCase for components and pages: `SearchPage.tsx`, `ResultCard.tsx`, `HealthOverlay.tsx`
- camelCase for utility/hook files: `useApi.ts`, `useHealthCheck.ts`, `api.ts`
- Config files use dot notation: `vite.config.ts`, `tsconfig.json`
- snake_case for functions and variables: `encode_dense()`, `hybrid_search()`, `parse_xml()`
- Private methods prefixed with underscore: `_load_model()`, `_build_filter()`, `_normalize_abkuerzung()`
- Constants in UPPER_SNAKE_CASE: `DENSE_VECTOR_NAME`, `SPARSE_VECTOR_NAME`, `LAW_REGISTRY`
- camelCase for functions and variables: `fetchJson()`, `handleSearch()`, `setResults()`
- PascalCase for React components: `SearchPage`, `ResultCard`, `HealthOverlay`
- PascalCase for TypeScript interfaces/types: `SearchRequest`, `HealthResponse`, `SearchResultItem`
- PascalCase: `EmbeddingService`, `QdrantStore`, `RerankerService`, `GesetzParser`
- Test classes prefixed with `Test`: `TestSettings`, `TestGesetzParser`, `TestEmbeddingService`
- PascalCase for Pydantic models: `LawChunk`, `ChunkMetadata`, `SearchResult`, `SearchFilter`
- PascalCase for dataclasses: `AppContext`, `LawDefinition`
- PascalCase for enums: `Gesetzbuch` (uses `StrEnum`)
- German terms for domain models (law-specific fields): `gesetz`, `paragraph`, `abschnitt`, `titel`, `rechtsgebiet`
- English for technical/infrastructure names: `embedding`, `reranker`, `parser`, `client`
- API field names use German where user-facing: `anfrage`, `gesetzbuch`, `nachricht`, `erfolg`
## Code Style
- Linter: Ruff (configured in `backend/pyproject.toml`)
- Target: Python 3.12
- Line length: 100 characters
- Ruff rules enabled: `E` (pycodestyle errors), `F` (pyflakes), `I` (isort), `N` (pep8-naming), `W` (warnings), `UP` (pyupgrade), `B` (bugbear), `SIM` (simplify)
- Test files exempt from E501 (long lines allowed for XML strings)
- No ESLint or Prettier configured (relies on TypeScript compiler strict checks)
- TypeScript strict mode enabled in `frontend/tsconfig.json`
- Target: ES2022
- `from __future__ import annotations` at top of every Python file (PEP 604 style)
- Use `str | None` instead of `Optional[str]`
- Use `list[str]` instead of `List[str]`
- Mypy configured in strict mode (`backend/pyproject.toml`: `strict = true`)
- Return type annotations on all public methods
- Parameter type annotations on all functions
- `strict: true` in `frontend/tsconfig.json`
- Explicit interface definitions for all API types in `frontend/src/lib/api.ts`
- Props interfaces defined inline above components
## Import Organization
- Use `from` imports for specific items: `from paragraf.models.law import LawChunk, SearchResult`
- Use module-level logger: `logger = logging.getLogger(__name__)`
- Lazy imports for heavy dependencies (torch, FlagEmbedding) inside methods
- TypeScript: `@/*` maps to `src/*` (configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`)
- Python: standard package imports via `paragraf.*` namespace
## Error Handling
- Service methods raise descriptive exceptions with German messages: `raise RuntimeError("Nicht verbunden – await connect() aufrufen")`
- FastAPI validation errors caught via custom exception handler returning structured JSON with German error messages in `backend/src/paragraf/api.py`
- Try/except with specific exception types: `except httpx.HTTPError`, `except ImportError`
- Logger-based error reporting: `logger.exception("Fehler beim Laden der ML-Modelle")`
- Graceful degradation pattern: embedding service falls back from FlagEmbedding to sentence-transformers on ImportError
- Try/catch in async handlers with error state: `setError(e.message || "Suche fehlgeschlagen")`
- Generic `useApi<T>` hook (`frontend/src/hooks/useApi.ts`) manages `{ data, loading, error }` state
- API client throws on non-OK responses: `throw new Error("API Fehler: ${res.status} ${res.statusText}")`
- Error messages displayed in German via `role="alert"` elements
- `asyncio.CancelledError` and `GeneratorExit` caught separately for client disconnect scenarios
- Keepalive mechanism prevents proxy timeout during long operations (`backend/src/paragraf/api.py` lines 744-773)
## Logging
- `logging.basicConfig()` in `create_api()` function in `backend/src/paragraf/api.py`
- Format: `"%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"`
- Date format: `"%H:%M:%S"`
- Log level configurable via `settings.log_level`
- Module-level logger: `logger = logging.getLogger(__name__)` at top of each service module
- Use `logger.info()` for startup/lifecycle events: `"=== Paragraf REST-API startet ==="`
- Use `logger.warning()` for recoverable issues: `"Count-Abfrage fuer %s fehlgeschlagen: %s"`
- Use `logger.error()` for connection failures: `"Qdrant nicht erreichbar: %s"`
- Use `logger.exception()` for unexpected errors (includes traceback): `"Fehler beim Laden der ML-Modelle"`
- Use %-style formatting (not f-strings) in log calls for lazy evaluation
- `console.error()` for API stream errors only
- No structured logging framework
## Comments
- German language docstrings on all classes and public methods
- Triple-quote style: `"""Beschreibung."""`
- Module-level docstrings at top of every file: `"""Embedding-Service – BAAI/bge-m3 fuer Dense + Sparse Vektoren."""`
- Technical details in docstrings explain design decisions (e.g., why ColBERT is not used)
- Heavy use of ASCII section markers in Python and TypeScript:
- Same pattern in TypeScript:
- German for domain-specific explanations: `# Finde Paragraph 1`
- German for test descriptions: `"""Neue Gesetzesabkuerzungen werden korrekt erkannt."""`
- `# noqa:` annotations for intentional linting exceptions: `# noqa: ANN001`
- JSDoc block comment on `frontend/src/lib/api.ts` only
- Not used systematically in frontend code
## Function Design
- All service methods that touch I/O are `async`: `async def connect()`, `async def hybrid_search()`
- CPU-bound work offloaded to threads via `asyncio.to_thread()` or `asyncio.get_event_loop().run_in_executor()`
- Background initialization pattern: `asyncio.create_task(_init_models())` for non-blocking startup
- `AsyncIterator` for streaming responses (SSE)
- `async/await` for API calls in event handlers
- SSE streaming via manual ReadableStream consumption in `api.indexGesetze()`
- Function components only (no class components)
- Named exports for components: `export function SearchPage()`
- Default export only for `App` component: `export default function App()`
- Props interfaces defined directly above the component
- Hooks for shared stateful logic: `useApi<T>()`, `useHealthCheck()`
- Context API for cross-cutting state: `ThemeContext`, `BookmarkContext`
- Keyword arguments with defaults for service constructors
- Pydantic `Field()` with `description` for API models
- `Literal` types for constrained strings: `Literal["stdio", "streamable-http"]`
## Module Design
- `__init__.py` contains only `__version__`
- No barrel files; import directly from specific modules
- Services are classes instantiated in lifespan handlers
- Named exports for components and hooks
- `api` object exported as a namespace from `frontend/src/lib/api.ts`
- Types co-located with API client (interfaces in same file as fetch functions)
- Context exports from `App.tsx`: `ThemeContext`, `BookmarkContext`
- Not used in either Python or TypeScript
## Git Conventions
- All commits and pushes go directly to `main`
- Mix of English and German commit messages
- Prefix patterns observed: `fix:`, `Add`, `Fix`
- Recent examples: `"Fix .gitignore: data/ rule..."`, `"fix: SSE-Stream-Abbruch bei Indexierung..."`
## Accessibility Conventions (Frontend)
- `role="status"` and `aria-live="polite"` on loading indicators
- `role="alert"` on error messages
- `aria-label` on sections and main content area
- `aria-hidden="true"` on decorative icons
- Live region for page change announcements
- Skip-link pattern in `frontend/src/styles/index.css`
- `prefers-reduced-motion` media query disables animations
- `prefers-contrast: more` media query enhances contrast
- Focus-visible outlines on interactive elements (3px solid primary-500)
- `.sr-only` class for screen-reader-only content
- Ctrl+1 through Ctrl+7 keyboard shortcuts for page navigation
- Focus management on page change via `mainRef.current?.focus()`
## Pydantic Conventions
- Inherit from `BaseModel` for API request/response models (in `backend/src/paragraf/api_models.py`)
- Inherit from `BaseModel` for domain models (in `backend/src/paragraf/models/law.py`)
- Use `BaseSettings` with `SettingsConfigDict` for configuration (in `backend/src/paragraf/config.py`)
- Use `@dataclass` for simple data containers: `AppContext`, `LawDefinition`
- Use `Field()` with `description` for API documentation
- Use `Field(default_factory=list)` for mutable defaults
- `Field(ge=1, le=20)` for numeric range constraints
- `Field(min_length=2, max_length=5)` for list length constraints
- German description strings in Field annotations
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- 4 Docker services: Qdrant vector DB, backend (REST API), MCP server (separate container, same image), frontend (nginx SPA)
- Backend serves two protocols from the same codebase: FastAPI REST for the web UI, and MCP (Model Context Protocol) for Claude Desktop/Code
- RAG pipeline: Download law XML -> Parse -> Embed (BAAI/bge-m3 dense+sparse) -> Store in Qdrant -> Hybrid search -> Cross-encoder rerank -> Return results
- Frontend is a static React SPA served by nginx, which also reverse-proxies `/api/*` to the backend
- All configuration via environment variables in `docker-compose.yml` (no `.env` editor, settings page is read-only)
## Layers
- Purpose: React SPA providing search, lookup, compare, law browsing, counseling lookup, index management, and settings views
- Location: `frontend/src/`
- Contains: React components, pages, hooks, API client, styles
- Depends on: Backend REST API via nginx reverse proxy
- Used by: End users via browser
- Purpose: JSON REST endpoints for the web frontend
- Location: `backend/src/paragraf/api.py` (routes), `backend/src/paragraf/api_models.py` (Pydantic request/response models)
- Contains: FastAPI route definitions, request validation, response serialization
- Depends on: Service layer (AppContext with embedding, qdrant, reranker, parser)
- Used by: Frontend via nginx proxy at `/api/*`
- Purpose: MCP protocol interface for Claude Desktop/Code integration
- Location: `backend/src/paragraf/server.py` (server setup, lifespan), `backend/src/paragraf/tools/` (tool definitions), `backend/src/paragraf/prompts/` (prompt templates)
- Contains: FastMCP server, tool registrations (search, lookup, ingest), prompt templates
- Depends on: Same service layer as REST (AppContext)
- Used by: Claude Desktop/Code via MCP protocol (stdio or streamable-http transport)
- Purpose: Core business logic for embedding, search, reranking, parsing
- Location: `backend/src/paragraf/services/`
- Contains: `embedding.py` (BAAI/bge-m3), `qdrant_store.py` (vector DB operations), `reranker.py` (cross-encoder), `parser.py` (German law XML parser), `eurlex_client.py` (EU law downloader), `eurlex_parser.py` (EU law HTML parser)
- Depends on: ML models (FlagEmbedding, sentence-transformers), Qdrant client, external law data sources
- Used by: Both API layers (REST and MCP)
- Purpose: Data models, law registry, search types
- Location: `backend/src/paragraf/models/law.py`
- Contains: `LawDefinition`, `LAW_REGISTRY` (95+ German/EU laws), `LawChunk`, `ChunkMetadata`, `SearchFilter`, `SearchResult`, `Gesetzbuch` enum
- Depends on: Pydantic
- Used by: All other layers
- Purpose: Centralized settings from environment variables
- Location: `backend/src/paragraf/config.py`
- Contains: `Settings` (Pydantic BaseSettings), singleton `settings` instance
- Depends on: pydantic-settings, environment variables
- Used by: All backend layers
## Data Flow
- No client-side state management library (React useState + Context only)
- `ThemeContext` for dark/light mode (persisted in localStorage)
- `BookmarkContext` for paragraph bookmarks (persisted in localStorage)
- `useHealthCheck` hook polls `/api/health` every 3s (30s when ready)
- `useApi` generic hook for request lifecycle (loading, data, error)
## Key Abstractions
- Purpose: Holds all initialized services; shared between REST and MCP modes
- Defined in: `backend/src/paragraf/server.py`
- Pattern: Dataclass with lazy initialization via `ensure_ready()`. Services are configured at startup but ML models load on first use to meet MCP handshake timeout.
- Contains: `EmbeddingService`, `QdrantStore`, `RerankerService`, `GesetzParser`, `data_dir`
- Purpose: Central registry of all 95+ supported German and EU laws
- Defined in: `backend/src/paragraf/models/law.py`
- Pattern: `dict[str, LawDefinition]` mapping abbreviation to metadata (slug, source URL, legal area, tags)
- Drives: Indexing, law browsing, filtering
- Purpose: Atomic unit of law text for embedding and search
- Defined in: `backend/src/paragraf/models/law.py`
- Pattern: Pydantic model with `id`, `text`, `ChunkMetadata`. Two chunk types: "paragraph" (full paragraph) and "absatz" (individual clause for long paragraphs >800 chars)
- Purpose: A ranked search result wrapping a LawChunk with score
- Defined in: `backend/src/paragraf/models/law.py`
- Pattern: Pydantic model with `chunk`, `score`, `rank`
## Entry Points
- Location: `backend/src/paragraf/__main__.py` -> `_run_api()`
- Triggers: `CMD ["python", "-m", "paragraf", "--mode", "api", "--port", "8000"]` in `backend/Dockerfile`
- Creates FastAPI app via `backend/src/paragraf/api.py` `create_api()`, runs with uvicorn
- Location: `backend/src/paragraf/__main__.py` -> `_run_mcp()`
- Triggers: `command: ["python", "-m", "paragraf", "--mode", "mcp"]` in `docker-compose.yml` (mcp service)
- Creates FastMCP server via `backend/src/paragraf/server.py` `create_server()`, runs with configured transport (streamable-http on port 8001)
- Location: `frontend/src/main.tsx` -> `frontend/src/App.tsx`
- Triggers: Browser loads SPA from nginx
- Responsibilities: Page routing (client-side), health check overlay, dark mode, bookmarks
## Error Handling
- **Hybrid search fallback:** If RRF fusion fails, falls back to dense-only search (`backend/src/paragraf/services/qdrant_store.py` line 280-293)
- **Embedding model fallback:** If FlagEmbedding (bge-m3) import fails, falls back to sentence-transformers (`backend/src/paragraf/services/embedding.py` line 47-53)
- **Reranker fallback:** If reranker loading fails or scoring throws, returns original ranking (`backend/src/paragraf/services/reranker.py` line 78-80, 87-89)
- **Lookup fallback:** If exact paragraph+gesetz filter finds nothing, retries with broader gesetz-only filter via hybrid search (`backend/src/paragraf/api.py` line 345-349)
- **SSE stream cancellation:** Handles `asyncio.CancelledError` and `GeneratorExit` for client disconnects during indexing (`backend/src/paragraf/api.py` line 675-677)
- **Frontend health states:** 4-state model (connecting -> loading -> ready, or error) with automatic retry polling (`frontend/src/hooks/useHealthCheck.ts`)
- **Validation errors:** Custom 422 handler returns German error messages (`backend/src/paragraf/api.py` line 161-176)
## Cross-Cutting Concerns
- Backend uses Python `logging` module with structured format: `%(asctime)s | %(levelname)-8s | %(name)s | %(message)s`
- Log level configurable via `LOG_LEVEL` environment variable
- structlog is a dependency but not actively used (standard logging configured in `create_server()` and `create_api()`)
- All request/response models use Pydantic v2 (`backend/src/paragraf/api_models.py`)
- Domain models use Pydantic BaseModel (`backend/src/paragraf/models/law.py`)
- Settings use pydantic-settings with env var binding (`backend/src/paragraf/config.py`)
- None. The application has no auth layer. It is designed as a local/internal tool.
- Backend allows all origins (`allow_origins=["*"]`) for development flexibility (`backend/src/paragraf/api.py` line 153-159)
- RDG (Rechtsdienstleistungsgesetz) disclaimer appended to every search response in both REST (`backend/src/paragraf/api_models.py` `SearchResponse.disclaimer`) and MCP (`backend/src/paragraf/tools/search.py` `DISCLAIMER`) interfaces
- MCP server instructions explicitly state it is not a legal advisor (`backend/src/paragraf/server.py` line 132-141)
## Deployment Architecture
| Service | Image | Internal Port | External Port | Purpose |
|---------|-------|---------------|---------------|---------|
| `qdrant` | `qdrant/qdrant:v1.13.2` | 6333 | 6333 | Vector database with persistent volume |
| `backend` | Custom (python:3.12-slim, 2-stage) | 8000 | 8000 | REST API + ML models |
| `mcp` | Same image as backend | 8001 | 8001 | MCP server (streamable-http transport) |
| `frontend` | Custom (node:22 build -> nginx:alpine) | 80 | 3847 | SPA + reverse proxy |
- `qdrant_data` - Qdrant persistent storage
- `model_cache` - HuggingFace model cache (`/models`), shared between backend and mcp services
- `law_data` - Downloaded law XML/HTML files and processed JSON (`/data`)
- `backend` depends on `qdrant` (healthcheck condition)
- `mcp` depends on `qdrant` (healthcheck condition)
- `frontend` depends on `backend`
- Optional overlay: `docker-compose.gpu.yml` adds NVIDIA GPU reservation and sets `EMBEDDING_DEVICE=cuda`
- Usage: `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build`
- SPA routing: all unknown paths -> `index.html`
- API proxy: `/api/*` -> `http://backend:8000/api/*`
- SSE support: `proxy_buffering off`, `proxy_http_version 1.1`, 1-hour timeout
- Static asset caching: 1 year with immutable header
- Docker DNS resolver with 10s TTL for backend IP changes
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

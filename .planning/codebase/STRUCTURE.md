---
generated: 2026-03-27
focus: arch
status: current
---

# Codebase Structure

**Analysis Date:** 2026-03-27

## Directory Layout

```
paragraf v2/
├── backend/
│   ├── Dockerfile                    # Multi-stage: python:3.12-slim builder -> runtime
│   ├── pyproject.toml                # Python project config (hatchling build)
│   ├── src/
│   │   └── paragraf/                 # Main Python package
│   │       ├── __init__.py
│   │       ├── __main__.py           # Entry point: --mode api|mcp
│   │       ├── api.py                # FastAPI REST routes (all /api/* endpoints)
│   │       ├── api_models.py         # Pydantic request/response models for REST
│   │       ├── config.py             # Settings (pydantic-settings, env vars)
│   │       ├── server.py             # MCP server setup, AppContext, lifespan
│   │       ├── models/
│   │       │   ├── __init__.py
│   │       │   └── law.py            # Domain models: LAW_REGISTRY, LawChunk, SearchResult
│   │       ├── services/
│   │       │   ├── __init__.py
│   │       │   ├── embedding.py      # BAAI/bge-m3 dense+sparse embeddings
│   │       │   ├── qdrant_store.py   # Qdrant collection mgmt, hybrid search, upsert
│   │       │   ├── reranker.py       # Cross-encoder reranking (bge-reranker-v2-m3)
│   │       │   ├── parser.py         # German law XML parser (gesetze-im-internet.de)
│   │       │   ├── eurlex_client.py  # EU law HTML downloader (eur-lex.europa.eu)
│   │       │   └── eurlex_parser.py  # EU law HTML parser
│   │       ├── tools/
│   │       │   ├── __init__.py
│   │       │   ├── search.py         # MCP tools: paragraf_search, paragraf_lookup, paragraf_compare
│   │       │   ├── lookup.py         # MCP tools: additional lookup tools
│   │       │   └── ingest.py         # MCP tools: paragraf_index, paragraf_index_eutb
│   │       └── prompts/
│   │           └── __init__.py       # MCP prompts: legal_info, easy_language, compensation, benefits
│   ├── tests/                        # pytest test suite
│   └── scripts/                      # Utility scripts
├── frontend/
│   ├── Dockerfile                    # Multi-stage: node:22-alpine -> nginx:alpine
│   ├── docker-entrypoint.sh          # Runtime API_BASE_URL injection into built JS
│   ├── nginx.conf                    # SPA routing + /api/* reverse proxy to backend
│   ├── package.json                  # React 19, Vite, TailwindCSS dependencies
│   ├── package-lock.json
│   ├── vite.config.ts                # Vite build config
│   ├── tsconfig.json                 # TypeScript config
│   └── src/
│       ├── main.tsx                  # React DOM render entry
│       ├── App.tsx                   # Root component: routing, contexts, health overlay
│       ├── vite-env.d.ts             # Vite type declarations
│       ├── styles/
│       │   └── index.css             # TailwindCSS entry + custom styles
│       ├── lib/
│       │   └── api.ts                # Typed REST client (all API calls + SSE streaming)
│       ├── hooks/
│       │   ├── useApi.ts             # Generic async request hook (loading/data/error)
│       │   └── useHealthCheck.ts     # Health polling hook (3s/30s intervals)
│       ├── components/
│       │   ├── Sidebar.tsx           # Navigation sidebar with page links
│       │   ├── HealthOverlay.tsx     # Connection/loading status overlay
│       │   ├── ServerStatus.tsx      # Backend status indicator
│       │   ├── SearchBar.tsx         # Search input component
│       │   ├── ResultCard.tsx        # Search result display card
│       │   ├── Disclaimer.tsx        # RDG legal disclaimer component
│       │   ├── ProgressBar.tsx       # Progress bar component
│       │   └── IndexDashboard.tsx    # Index status dashboard
│       └── pages/
│           ├── SearchPage.tsx        # Semantic search page
│           ├── LookupPage.tsx        # Direct paragraph lookup
│           ├── ComparePage.tsx       # Side-by-side paragraph comparison
│           ├── LawBrowserPage.tsx    # Browse laws by legal area
│           ├── CounselingPage.tsx    # EUTB counseling center search
│           ├── IndexPage.tsx         # Index management (trigger indexing, view status)
│           └── SettingsPage.tsx      # Read-only settings display
├── docker-compose.yml                # 4 services: qdrant, backend, mcp, frontend
├── docker-compose.gpu.yml            # GPU override (NVIDIA, CUDA)
├── CLAUDE.md                         # Project instructions for Claude Code
├── README.md                         # Project documentation
└── skills-lock.json                  # Claude Code skills lockfile
```

## Directory Purposes

**`backend/src/paragraf/`:**
- Purpose: Complete Python backend package
- Contains: Entry point, REST API, MCP server, services, models, tools, prompts
- Key files: `__main__.py` (entry), `api.py` (REST routes), `server.py` (MCP setup), `config.py` (settings)

**`backend/src/paragraf/models/`:**
- Purpose: Domain models and law registry
- Contains: Pydantic models for law chunks, search results, metadata; central LAW_REGISTRY dict
- Key files: `law.py` (the only file, contains everything)

**`backend/src/paragraf/services/`:**
- Purpose: Core business logic services
- Contains: ML model wrappers, vector DB operations, law text parsers
- Key files: `embedding.py`, `qdrant_store.py`, `reranker.py`, `parser.py`

**`backend/src/paragraf/tools/`:**
- Purpose: MCP tool definitions (registered on the FastMCP server)
- Contains: Search tools, lookup tools, ingestion tools
- Key files: `search.py` (3 tools), `ingest.py` (2 tools), `lookup.py`

**`backend/src/paragraf/prompts/`:**
- Purpose: MCP prompt templates for common legal queries
- Contains: 4 predefined prompts (legal_info, easy_language, compensation, benefits)
- Key files: `__init__.py` (all prompts in one file)

**`frontend/src/pages/`:**
- Purpose: Top-level page components (one per route/view)
- Contains: 7 page components matching sidebar navigation
- Key files: `SearchPage.tsx` (main feature), `IndexPage.tsx` (data management)

**`frontend/src/components/`:**
- Purpose: Reusable UI components shared across pages
- Contains: Navigation, status indicators, search UI, result display
- Key files: `Sidebar.tsx`, `HealthOverlay.tsx`, `ResultCard.tsx`

**`frontend/src/hooks/`:**
- Purpose: Custom React hooks for API interaction and health monitoring
- Contains: 2 hooks
- Key files: `useApi.ts` (generic), `useHealthCheck.ts` (specific)

**`frontend/src/lib/`:**
- Purpose: API client and shared utilities
- Contains: Typed REST client with all endpoint methods
- Key files: `api.ts` (the only file, ~307 lines)

## Key File Locations

**Entry Points:**
- `backend/src/paragraf/__main__.py`: Backend entry point, decides API vs MCP mode
- `frontend/src/main.tsx`: React DOM render root
- `frontend/src/App.tsx`: Root React component with routing and contexts

**Configuration:**
- `backend/src/paragraf/config.py`: Pydantic Settings (all env var bindings)
- `docker-compose.yml`: Service definitions, environment variables, volumes, ports
- `docker-compose.gpu.yml`: NVIDIA GPU override
- `frontend/vite.config.ts`: Vite build configuration
- `frontend/nginx.conf`: nginx reverse proxy and SPA routing
- `frontend/docker-entrypoint.sh`: Runtime API_BASE_URL injection

**Core Logic:**
- `backend/src/paragraf/api.py`: All REST endpoint definitions (~870 lines)
- `backend/src/paragraf/services/qdrant_store.py`: Vector DB operations, hybrid search (~367 lines)
- `backend/src/paragraf/services/embedding.py`: Embedding model wrapper (~154 lines)
- `backend/src/paragraf/services/reranker.py`: Cross-encoder reranking (~154 lines)
- `backend/src/paragraf/services/parser.py`: German law XML parsing (~595 lines)
- `backend/src/paragraf/models/law.py`: Law registry with 95+ laws, domain models (~273 lines)

**API Contract:**
- `backend/src/paragraf/api_models.py`: All Pydantic request/response models (~205 lines)
- `frontend/src/lib/api.ts`: TypeScript interfaces mirroring backend models + fetch client (~307 lines)

**Testing:**
- `backend/tests/`: pytest test directory (asyncio_mode=auto)

## Naming Conventions

**Files:**
- Python: `snake_case.py` (e.g., `qdrant_store.py`, `eurlex_client.py`)
- TypeScript/React: `PascalCase.tsx` for components/pages (e.g., `SearchPage.tsx`, `ResultCard.tsx`)
- TypeScript utilities: `camelCase.ts` (e.g., `useApi.ts`, `api.ts`)

**Directories:**
- Python packages: `snake_case` (e.g., `services/`, `models/`, `tools/`, `prompts/`)
- Frontend: `lowercase` (e.g., `components/`, `pages/`, `hooks/`, `lib/`)

**Frontend Page Components:**
- Pattern: `{Feature}Page.tsx` (e.g., `SearchPage.tsx`, `LookupPage.tsx`, `IndexPage.tsx`)
- Each page maps 1:1 to a sidebar navigation item

**Frontend Feature Components:**
- Pattern: `{Feature}.tsx` (e.g., `Sidebar.tsx`, `HealthOverlay.tsx`, `ResultCard.tsx`)

## Where to Add New Code

**New REST API Endpoint:**
1. Add request/response Pydantic models in `backend/src/paragraf/api_models.py`
2. Add route in the `_register_routes()` function in `backend/src/paragraf/api.py`
3. Add TypeScript types and fetch method in `frontend/src/lib/api.ts`
4. URL pattern: `/api/{resource}` for GET, POST

**New MCP Tool:**
1. Create or extend a file in `backend/src/paragraf/tools/`
2. Define a `register_*_tools(mcp: FastMCP)` function
3. Register it in `backend/src/paragraf/server.py` `create_server()` after line 149
4. Access services via `ctx.request_context.lifespan_context` (the `AppContext`)

**New Frontend Page:**
1. Create `frontend/src/pages/{Feature}Page.tsx`
2. Add the page type to the `Page` union type in `frontend/src/components/Sidebar.tsx`
3. Add the page to `Sidebar.tsx` navigation items
4. Add the case to `renderPage()` switch in `frontend/src/App.tsx`
5. Add page label to `PAGE_LABELS` record in `frontend/src/App.tsx`

**New Frontend Component:**
- Shared/reusable: `frontend/src/components/{Component}.tsx`
- Page-specific: Can be defined within the page file or in components/

**New Service (Backend):**
1. Create `backend/src/paragraf/services/{service_name}.py`
2. Instantiate in `app_lifespan()` in `backend/src/paragraf/server.py` and `api_lifespan()` in `backend/src/paragraf/api.py`
3. Add as field to `AppContext` dataclass in `backend/src/paragraf/server.py`

**New Law to the Registry:**
- Add entry to `LAW_REGISTRY` dict in `backend/src/paragraf/models/law.py`
- Follow pattern: `"ABBR": LawDefinition("ABBR", "slug", "Description", "Legal Area", "source-domain")`
- For EU law: use CELEX number as slug, `"eur-lex.europa.eu"` as source

**New Domain Model:**
- Add Pydantic model to `backend/src/paragraf/models/law.py`

**New Custom Hook:**
- Create `frontend/src/hooks/use{Feature}.ts`

## Special Directories

**`backend/tests/`:**
- Purpose: pytest test suite
- Generated: No
- Committed: Yes
- Config: `asyncio_mode = "auto"` in `backend/pyproject.toml`

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `npm run build`)
- Committed: No (built in Docker)

**`frontend/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No

**Docker Volumes (runtime only, not in repo):**
- `/models` (model_cache volume): HuggingFace model cache for bge-m3 and reranker
- `/data` (law_data volume): Downloaded law XMLs (`/data/raw/`), processed JSON (`/data/processed/`)
- Qdrant storage (qdrant_data volume): Vector database files

**`.agents/` and `.claude/`:**
- Purpose: Claude Code agent definitions, skills, and command configurations
- Generated: Partially (skills-lock.json is generated)
- Committed: Yes
- Note: Not part of the application runtime; used for AI-assisted development workflows

---

*Structure analysis: 2026-03-27*

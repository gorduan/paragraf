---
generated: 2026-03-27
focus: arch
status: current
---

# Architecture

**Analysis Date:** 2026-03-27

## Pattern Overview

**Overall:** Docker Compose multi-service architecture with dual-interface backend (REST API + MCP Server)

**Key Characteristics:**
- 4 Docker services: Qdrant vector DB, backend (REST API), MCP server (separate container, same image), frontend (nginx SPA)
- Backend serves two protocols from the same codebase: FastAPI REST for the web UI, and MCP (Model Context Protocol) for Claude Desktop/Code
- RAG pipeline: Download law XML -> Parse -> Embed (BAAI/bge-m3 dense+sparse) -> Store in Qdrant -> Hybrid search -> Cross-encoder rerank -> Return results
- Frontend is a static React SPA served by nginx, which also reverse-proxies `/api/*` to the backend
- All configuration via environment variables in `docker-compose.yml` (no `.env` editor, settings page is read-only)

## Layers

**Presentation Layer (Frontend):**
- Purpose: React SPA providing search, lookup, compare, law browsing, counseling lookup, index management, and settings views
- Location: `frontend/src/`
- Contains: React components, pages, hooks, API client, styles
- Depends on: Backend REST API via nginx reverse proxy
- Used by: End users via browser

**API Layer (REST):**
- Purpose: JSON REST endpoints for the web frontend
- Location: `backend/src/paragraf/api.py` (routes), `backend/src/paragraf/api_models.py` (Pydantic request/response models)
- Contains: FastAPI route definitions, request validation, response serialization
- Depends on: Service layer (AppContext with embedding, qdrant, reranker, parser)
- Used by: Frontend via nginx proxy at `/api/*`

**API Layer (MCP):**
- Purpose: MCP protocol interface for Claude Desktop/Code integration
- Location: `backend/src/paragraf/server.py` (server setup, lifespan), `backend/src/paragraf/tools/` (tool definitions), `backend/src/paragraf/prompts/` (prompt templates)
- Contains: FastMCP server, tool registrations (search, lookup, ingest), prompt templates
- Depends on: Same service layer as REST (AppContext)
- Used by: Claude Desktop/Code via MCP protocol (stdio or streamable-http transport)

**Service Layer:**
- Purpose: Core business logic for embedding, search, reranking, parsing
- Location: `backend/src/paragraf/services/`
- Contains: `embedding.py` (BAAI/bge-m3), `qdrant_store.py` (vector DB operations), `reranker.py` (cross-encoder), `parser.py` (German law XML parser), `eurlex_client.py` (EU law downloader), `eurlex_parser.py` (EU law HTML parser)
- Depends on: ML models (FlagEmbedding, sentence-transformers), Qdrant client, external law data sources
- Used by: Both API layers (REST and MCP)

**Domain Layer:**
- Purpose: Data models, law registry, search types
- Location: `backend/src/paragraf/models/law.py`
- Contains: `LawDefinition`, `LAW_REGISTRY` (95+ German/EU laws), `LawChunk`, `ChunkMetadata`, `SearchFilter`, `SearchResult`, `Gesetzbuch` enum
- Depends on: Pydantic
- Used by: All other layers

**Configuration Layer:**
- Purpose: Centralized settings from environment variables
- Location: `backend/src/paragraf/config.py`
- Contains: `Settings` (Pydantic BaseSettings), singleton `settings` instance
- Depends on: pydantic-settings, environment variables
- Used by: All backend layers

## Data Flow

**Search Request (Frontend -> Backend):**

1. User enters query in `frontend/src/pages/SearchPage.tsx`
2. `frontend/src/lib/api.ts` sends POST to `/api/search` (via nginx proxy)
3. nginx at `frontend/nginx.conf` proxies to `http://backend:8000/api/search`
4. `backend/src/paragraf/api.py` `search()` route receives `SearchRequest`
5. `QdrantStore.hybrid_search()` encodes query via `EmbeddingService.encode_query()` -> dense+sparse vectors
6. Qdrant executes Dense + Sparse prefetch with RRF fusion (`backend/src/paragraf/services/qdrant_store.py`)
7. `RerankerService.arerank()` re-scores top-K results with cross-encoder in thread executor (`backend/src/paragraf/services/reranker.py`)
8. Results filtered by similarity threshold, deduplicated, serialized as `SearchResponse`

**Indexing Flow (SSE Streaming):**

1. User triggers indexing from `frontend/src/pages/IndexPage.tsx`
2. `api.indexGesetze()` in `frontend/src/lib/api.ts` sends POST to `/api/index` and reads SSE stream
3. Backend streams `IndexProgressEvent` objects as SSE via `StreamingResponse`
4. For each law: Download XML/HTML -> Parse to `LawChunk` list -> Embed in batches -> Upsert to Qdrant
5. Each batch yields an SSE event with progress (download/parse/embedding/done/error)
6. SSE keepalive mechanism prevents proxy timeout during long embedding operations (`_with_keepalive()` in `backend/src/paragraf/api.py`)

**MCP Tool Call Flow:**

1. Claude Desktop/Code sends MCP tool call (e.g., `paragraf_search`)
2. `backend/src/paragraf/server.py` FastMCP server routes to registered tool in `backend/src/paragraf/tools/search.py`
3. Tool accesses `AppContext` via `ctx.request_context.lifespan_context`
4. Calls `ensure_ready()` for lazy ML model initialization on first use
5. Executes same search pipeline as REST (hybrid search -> rerank -> format as Markdown)
6. Returns formatted Markdown with law citations and RDG disclaimer

**State Management:**
- No client-side state management library (React useState + Context only)
- `ThemeContext` for dark/light mode (persisted in localStorage)
- `BookmarkContext` for paragraph bookmarks (persisted in localStorage)
- `useHealthCheck` hook polls `/api/health` every 3s (30s when ready)
- `useApi` generic hook for request lifecycle (loading, data, error)

## Key Abstractions

**AppContext:**
- Purpose: Holds all initialized services; shared between REST and MCP modes
- Defined in: `backend/src/paragraf/server.py`
- Pattern: Dataclass with lazy initialization via `ensure_ready()`. Services are configured at startup but ML models load on first use to meet MCP handshake timeout.
- Contains: `EmbeddingService`, `QdrantStore`, `RerankerService`, `GesetzParser`, `data_dir`

**LAW_REGISTRY:**
- Purpose: Central registry of all 95+ supported German and EU laws
- Defined in: `backend/src/paragraf/models/law.py`
- Pattern: `dict[str, LawDefinition]` mapping abbreviation to metadata (slug, source URL, legal area, tags)
- Drives: Indexing, law browsing, filtering

**LawChunk:**
- Purpose: Atomic unit of law text for embedding and search
- Defined in: `backend/src/paragraf/models/law.py`
- Pattern: Pydantic model with `id`, `text`, `ChunkMetadata`. Two chunk types: "paragraph" (full paragraph) and "absatz" (individual clause for long paragraphs >800 chars)

**SearchResult:**
- Purpose: A ranked search result wrapping a LawChunk with score
- Defined in: `backend/src/paragraf/models/law.py`
- Pattern: Pydantic model with `chunk`, `score`, `rank`

## Entry Points

**Backend (REST API mode - default in Docker):**
- Location: `backend/src/paragraf/__main__.py` -> `_run_api()`
- Triggers: `CMD ["python", "-m", "paragraf", "--mode", "api", "--port", "8000"]` in `backend/Dockerfile`
- Creates FastAPI app via `backend/src/paragraf/api.py` `create_api()`, runs with uvicorn

**Backend (MCP mode):**
- Location: `backend/src/paragraf/__main__.py` -> `_run_mcp()`
- Triggers: `command: ["python", "-m", "paragraf", "--mode", "mcp"]` in `docker-compose.yml` (mcp service)
- Creates FastMCP server via `backend/src/paragraf/server.py` `create_server()`, runs with configured transport (streamable-http on port 8001)

**Frontend:**
- Location: `frontend/src/main.tsx` -> `frontend/src/App.tsx`
- Triggers: Browser loads SPA from nginx
- Responsibilities: Page routing (client-side), health check overlay, dark mode, bookmarks

## Error Handling

**Strategy:** Graceful degradation with fallbacks at multiple levels

**Patterns:**
- **Hybrid search fallback:** If RRF fusion fails, falls back to dense-only search (`backend/src/paragraf/services/qdrant_store.py` line 280-293)
- **Embedding model fallback:** If FlagEmbedding (bge-m3) import fails, falls back to sentence-transformers (`backend/src/paragraf/services/embedding.py` line 47-53)
- **Reranker fallback:** If reranker loading fails or scoring throws, returns original ranking (`backend/src/paragraf/services/reranker.py` line 78-80, 87-89)
- **Lookup fallback:** If exact paragraph+gesetz filter finds nothing, retries with broader gesetz-only filter via hybrid search (`backend/src/paragraf/api.py` line 345-349)
- **SSE stream cancellation:** Handles `asyncio.CancelledError` and `GeneratorExit` for client disconnects during indexing (`backend/src/paragraf/api.py` line 675-677)
- **Frontend health states:** 4-state model (connecting -> loading -> ready, or error) with automatic retry polling (`frontend/src/hooks/useHealthCheck.ts`)
- **Validation errors:** Custom 422 handler returns German error messages (`backend/src/paragraf/api.py` line 161-176)

## Cross-Cutting Concerns

**Logging:**
- Backend uses Python `logging` module with structured format: `%(asctime)s | %(levelname)-8s | %(name)s | %(message)s`
- Log level configurable via `LOG_LEVEL` environment variable
- structlog is a dependency but not actively used (standard logging configured in `create_server()` and `create_api()`)

**Validation:**
- All request/response models use Pydantic v2 (`backend/src/paragraf/api_models.py`)
- Domain models use Pydantic BaseModel (`backend/src/paragraf/models/law.py`)
- Settings use pydantic-settings with env var binding (`backend/src/paragraf/config.py`)

**Authentication:**
- None. The application has no auth layer. It is designed as a local/internal tool.

**CORS:**
- Backend allows all origins (`allow_origins=["*"]`) for development flexibility (`backend/src/paragraf/api.py` line 153-159)

**Legal Compliance:**
- RDG (Rechtsdienstleistungsgesetz) disclaimer appended to every search response in both REST (`backend/src/paragraf/api_models.py` `SearchResponse.disclaimer`) and MCP (`backend/src/paragraf/tools/search.py` `DISCLAIMER`) interfaces
- MCP server instructions explicitly state it is not a legal advisor (`backend/src/paragraf/server.py` line 132-141)

## Deployment Architecture

**Docker Compose Services (4 containers):**

| Service | Image | Internal Port | External Port | Purpose |
|---------|-------|---------------|---------------|---------|
| `qdrant` | `qdrant/qdrant:v1.13.2` | 6333 | 6333 | Vector database with persistent volume |
| `backend` | Custom (python:3.12-slim, 2-stage) | 8000 | 8000 | REST API + ML models |
| `mcp` | Same image as backend | 8001 | 8001 | MCP server (streamable-http transport) |
| `frontend` | Custom (node:22 build -> nginx:alpine) | 80 | 3847 | SPA + reverse proxy |

**Docker Volumes (3 named volumes):**
- `qdrant_data` - Qdrant persistent storage
- `model_cache` - HuggingFace model cache (`/models`), shared between backend and mcp services
- `law_data` - Downloaded law XML/HTML files and processed JSON (`/data`)

**Service Dependencies:**
- `backend` depends on `qdrant` (healthcheck condition)
- `mcp` depends on `qdrant` (healthcheck condition)
- `frontend` depends on `backend`

**GPU Support:**
- Optional overlay: `docker-compose.gpu.yml` adds NVIDIA GPU reservation and sets `EMBEDDING_DEVICE=cuda`
- Usage: `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build`

**nginx Reverse Proxy:**
- SPA routing: all unknown paths -> `index.html`
- API proxy: `/api/*` -> `http://backend:8000/api/*`
- SSE support: `proxy_buffering off`, `proxy_http_version 1.1`, 1-hour timeout
- Static asset caching: 1 year with immutable header
- Docker DNS resolver with 10s TTL for backend IP changes

---

*Architecture analysis: 2026-03-27*

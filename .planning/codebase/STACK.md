---
generated: 2026-03-27
focus: tech
status: current
---

# Technology Stack

**Analysis Date:** 2026-03-27

## Languages

**Primary:**
- Python 3.12+ - Backend (FastAPI REST-API, MCP Server, ML pipeline, law parsing)
- TypeScript 5.6+ - Frontend (React SPA)

**Secondary:**
- Shell (sh) - `frontend/docker-entrypoint.sh` (runtime config injection)
- nginx config - `frontend/nginx.conf` (reverse proxy + SPA routing)

## Runtime

**Environment:**
- Python 3.12-slim (Docker, multi-stage build) - `backend/Dockerfile`
- Node.js 22-alpine (build-only, not runtime) - `frontend/Dockerfile` stage 1
- nginx:alpine (runtime for frontend) - `frontend/Dockerfile` stage 2

**Package Manager:**
- pip (Python) - no lockfile, installs from `backend/pyproject.toml`
- npm (Node.js) - lockfile: `frontend/package-lock.json` (optional, `package-lock.json*` glob in Dockerfile)

## Frameworks

**Core:**
- FastAPI >=0.115.0 - REST-API layer (`backend/src/paragraf/api.py`)
- FastMCP (mcp[cli] >=1.0.0) - MCP protocol server (`backend/src/paragraf/server.py`)
- React 19 - Frontend SPA (`frontend/src/`)
- Vite 6 - Frontend build tool + dev server (`frontend/vite.config.ts`)
- TailwindCSS 4 - Utility-first CSS (`frontend/package.json`)

**Testing:**
- pytest >=8.0.0 - Python test runner (`backend/pyproject.toml` [dev])
- pytest-asyncio >=0.23.0 - Async test support, `asyncio_mode = "auto"` (`backend/pyproject.toml`)

**Build/Dev:**
- Hatchling - Python build backend (`backend/pyproject.toml`)
- Ruff >=0.4.0 - Python linter + formatter, target py312, line-length 100 (`backend/pyproject.toml`)
- mypy >=1.10.0 - Static type checker, strict mode (`backend/pyproject.toml`)
- TypeScript 5.6+ - Frontend type checking, strict mode (`frontend/tsconfig.json`)
- @vitejs/plugin-react >=4.3.0 - React JSX transform for Vite (`frontend/package.json`)
- @tailwindcss/vite >=4.0.0 - Tailwind CSS Vite integration (`frontend/package.json`)

## Key Dependencies

**Critical (ML Pipeline):**
- torch >=2.2.0 - PyTorch (CPU-only in Docker, CUDA optional via `docker-compose.gpu.yml`)
- FlagEmbedding >=1.3.0 - BAAI/bge-m3 native model loader (Dense + Sparse in one pass)
- sentence-transformers >=3.0.0 - Fallback embedding if FlagEmbedding unavailable
- transformers >=4.44.0,<5.0.0 - HuggingFace Transformers (transitive + direct)
- tiktoken >=0.7.0 - Token counting

**Critical (Search):**
- qdrant-client >=1.12.0 - Async Qdrant vector DB client (`backend/src/paragraf/services/qdrant_store.py`)
- rank-bm25 >=0.2.2 - BM25 ranking (RAG pipeline)

**Infrastructure:**
- uvicorn[standard] >=0.32.0 - ASGI server for FastAPI (`backend/src/paragraf/__main__.py`)
- pydantic >=2.0.0 - Data models and validation
- pydantic-settings >=2.0.0 - Environment-based configuration (`backend/src/paragraf/config.py`)
- httpx >=0.27.0 - Async HTTP client (law downloads, EUTB data)
- structlog >=24.0.0 - Structured logging
- tenacity >=8.2.0 - Retry logic

**Data Processing:**
- lxml >=5.0.0 - XML parsing (law XML from gesetze-im-internet.de)
- beautifulsoup4 >=4.12.0 - HTML/XML parsing (`backend/src/paragraf/services/parser.py`)
- openpyxl >=3.1.0 - Excel parsing (EUTB counseling center data)

**Frontend:**
- react >=19.0.0 - UI framework
- react-dom >=19.0.0 - DOM rendering
- lucide-react >=0.460.0 - Icon library

**Optional:**
- llmlingua >=0.2.0 - Prompt compression (optional `[compression]` extra)

## Configuration

**Environment:**
- All configuration via environment variables in `docker-compose.yml`
- Pydantic Settings reads from env vars or `.env` file (`backend/src/paragraf/config.py`)
- `.env.example` provides template - copy to `.env` for local overrides
- Frontend uses `window.__PARAGRAF_API_BASE_URL__` for runtime API URL injection (`frontend/docker-entrypoint.sh`)

**Key Config Files:**
- `docker-compose.yml` - Service orchestration + all env vars
- `docker-compose.gpu.yml` - GPU override (NVIDIA, sets `EMBEDDING_DEVICE=cuda`)
- `backend/pyproject.toml` - Python project config, dependencies, tool settings
- `frontend/vite.config.ts` - Vite build config with `@` path alias to `src/`
- `frontend/tsconfig.json` - TypeScript config (ES2022, strict, bundler resolution)
- `frontend/nginx.conf` - nginx reverse proxy + SPA routing + gzip + caching

**TypeScript Config:**
- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode enabled
- Path alias: `@/*` maps to `src/*` (`frontend/tsconfig.json`)

## Build System

**Backend:**
- Build backend: Hatchling (`backend/pyproject.toml`)
- Wheel packages: `src/paragraf` (`[tool.hatch.build.targets.wheel]`)
- Multi-stage Docker: python:3.12-slim builder + runtime
- PyTorch CPU-only installed separately from pytorch.org/whl/cpu to save ~3GB

**Frontend:**
- Build: `tsc && vite build` (type-check then bundle)
- Multi-stage Docker: node:22-alpine build + nginx:alpine serve
- Output: `frontend/dist/` served by nginx
- Dev proxy: Vite proxies `/api` to `http://localhost:8000` (`frontend/vite.config.ts`)

## Platform Requirements

**Development:**
- Docker + Docker Compose (primary workflow)
- Node.js 22 (only for `cd frontend && npm run dev` local dev)
- Python 3.12+ (only if running backend outside Docker)

**Production:**
- Docker Compose with 4 services: qdrant, backend, mcp, frontend
- ~4-8GB RAM minimum (ML models: bge-m3 ~2GB, bge-reranker-v2-m3 ~2GB)
- Optional: NVIDIA GPU with CUDA for faster inference

**Ports:**
- 3847 (host) -> 80 (frontend/nginx)
- 8000 (host) -> 8000 (backend FastAPI)
- 8001 (host) -> 8001 (MCP streamable-http)
- 6333 (host) -> 6333 (Qdrant)

---

*Stack analysis: 2026-03-27*

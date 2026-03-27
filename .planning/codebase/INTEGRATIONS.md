---
generated: 2026-03-27
focus: tech
status: current
---

# External Integrations

**Analysis Date:** 2026-03-27

## APIs & External Services

**Law Data Sources:**
- gesetze-im-internet.de - Primary source for German law XML data
  - Client: `backend/src/paragraf/services/parser.py` (`GesetzParser`)
  - Base URL: `https://www.gesetze-im-internet.de`
  - TOC URL: `https://www.gesetze-im-internet.de/gii-toc.xml`
  - Downloads ZIP files containing XML, parses with BeautifulSoup + lxml
  - Auth: None (public)

- EUR-Lex (eur-lex.europa.eu) - EU law HTML data (e.g., DSGVO)
  - Client: `backend/src/paragraf/services/eurlex_client.py` (`EurLexClient`)
  - Base URL: `https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/`
  - Downloads HTML by CELEX number (e.g., `32016R0679`)
  - Auth: None (public, but has AWS WAF bot protection)
  - Retry logic: Handles 202 "waiting page" responses with exponential backoff
  - Parser: `backend/src/paragraf/services/eurlex_parser.py` (`EurLexParser`)
  - Caveat: Bot protection may require manual HTML download in browser

- EUTB (teilhabeberatung.de) - Counseling center directory
  - Endpoint: `https://www.teilhabeberatung.de/beratung/export?_format=xlsx`
  - Downloads XLSX, parses with openpyxl, stores as JSON
  - Triggered via: `POST /api/index/eutb`
  - Output: `data/processed/eutb_beratungsstellen.json`
  - Auth: None (public)

**ML Model Registry (HuggingFace Hub):**
- BAAI/bge-m3 - Embedding model (1024-dim dense + sparse lexical weights)
  - Loaded by: `backend/src/paragraf/services/embedding.py` (`EmbeddingService`)
  - Library: FlagEmbedding (primary), sentence-transformers (fallback)
  - Cached at: `/models` (Docker volume `model_cache`, env `HF_HOME`)

- BAAI/bge-reranker-v2-m3 - Cross-encoder reranker (568M params)
  - Loaded by: `backend/src/paragraf/services/reranker.py` (`RerankerService`)
  - Library: FlagEmbedding (`FlagReranker`)
  - Cached at: `/models` (Docker volume `model_cache`, env `HF_HOME`)

## Data Storage

**Vector Database:**
- Qdrant v1.13.2
  - Docker image: `qdrant/qdrant:v1.13.2`
  - Connection: env var `QDRANT_URL` (default: `http://qdrant:6333`)
  - Collection: env var `QDRANT_COLLECTION` (default: `paragraf`)
  - Client: `qdrant-client` (AsyncQdrantClient) in `backend/src/paragraf/services/qdrant_store.py`
  - Vector config: Dense (1024-dim, cosine) + Sparse (lexical weights, in-memory)
  - Payload indexes: `gesetz`, `paragraph`, `abschnitt`, `chunk_typ` (keyword type)
  - Persistence: Docker volume `qdrant_data` mounted at `/qdrant/storage`
  - Healthcheck: TCP port check on 6333

**File Storage:**
- Local filesystem only (Docker volumes)
  - `model_cache` volume -> `/models` (HuggingFace + PyTorch model cache)
  - `law_data` volume -> `/data` (raw downloads + processed JSON)
  - Raw law data: `/data/raw/` (ZIP/XML from gesetze-im-internet.de, HTML from EUR-Lex)
  - Processed data: `/data/processed/` (EUTB counseling JSON)
  - EUR-Lex cache: `/data/raw/eurlex/` (HTML files by CELEX number)

**Caching:**
- No dedicated cache service (Redis, Memcached, etc.)
- ML models cached on disk via HuggingFace Hub (`HF_HOME=/models`)
- PyTorch cache: `TORCH_HOME=/models/torch`
- Downloaded law data cached on filesystem (re-used on subsequent indexing)

## Authentication & Identity

**Auth Provider:**
- None - No authentication or user management
- CORS: Allow all origins (`allow_origins=["*"]`) in `backend/src/paragraf/api.py`
- Designed for local/private network deployment

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logging:**
- Python `logging` module with basic format: `%(asctime)s | %(levelname)-8s | %(name)s | %(message)s`
- `structlog` available as dependency but standard logging used in practice
- Log level configurable via `LOG_LEVEL` env var (default: `INFO`)
- Configured in `backend/src/paragraf/api.py` (`create_api()`) and `backend/src/paragraf/server.py` (`create_server()`)

**Health Checks:**
- Backend: `GET /api/health` returns model status, Qdrant connection, indexed chunk count
  - Returns `status: "loading"` while ML models initialize in background
  - Returns `status: "ready"` once all services initialized
  - Docker healthcheck: Python urllib to `http://localhost:8000/api/health` every 15s
- Qdrant: TCP port check via Docker healthcheck (every 10s, 5 retries)
- Frontend: `frontend/src/hooks/useHealthCheck.ts` polls `/api/health` for connection overlay

## CI/CD & Deployment

**Hosting:**
- Docker Compose (self-hosted)
- 4 services: `qdrant`, `backend`, `mcp`, `frontend`

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, etc.)

**Deployment:**
```bash
# Standard (CPU)
docker compose up --build

# With GPU
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## Docker Services & Networking

**Service Topology:**

| Service | Image | Internal Port | External Port | Depends On |
|---------|-------|---------------|---------------|------------|
| `qdrant` | qdrant/qdrant:v1.13.2 | 6333 | 6333 | - |
| `backend` | Custom (python:3.12-slim) | 8000 | 8000 | qdrant (healthy) |
| `mcp` | Custom (python:3.12-slim) | 8001 | 8001 | qdrant (healthy) |
| `frontend` | Custom (nginx:alpine) | 80 | 3847 | backend |

**Internal Networking:**
- All services on default Docker Compose network
- Frontend nginx proxies `/api/*` to `http://backend:8000` (`frontend/nginx.conf`)
- nginx uses Docker DNS resolver (`127.0.0.11`) with 10s TTL for backend discovery
- Backend connects to Qdrant via `http://qdrant:6333` (Docker DNS)
- MCP service is identical backend image but runs in `--mode mcp` with streamable-http transport

**Docker Volumes:**
- `qdrant_data` - Qdrant persistent storage
- `model_cache` - HuggingFace + PyTorch model cache (shared between `backend` and `mcp`)
- `law_data` - Downloaded and processed law data (shared between `backend` and `mcp`)

**SSE Streaming:**
- nginx configured for SSE: `proxy_buffering off`, `proxy_cache off`, HTTP/1.1, empty Connection header
- Read/send timeout: 3600s (1 hour) for long indexing operations
- Keepalive comments sent every 15s during inactivity (`backend/src/paragraf/api.py`, `_with_keepalive()`)

## Environment Configuration

**Required env vars (all have defaults in `backend/Dockerfile` and `docker-compose.yml`):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `QDRANT_URL` | `http://qdrant:6333` | Qdrant connection URL |
| `QDRANT_COLLECTION` | `paragraf` | Qdrant collection name |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | HuggingFace embedding model |
| `EMBEDDING_DEVICE` | `cpu` | PyTorch device (cpu/cuda) |
| `EMBEDDING_BATCH_SIZE` | `8` | Embedding batch size |
| `EMBEDDING_MAX_LENGTH` | `512` | Max token length for embeddings |
| `RERANKER_MODEL` | `BAAI/bge-reranker-v2-m3` | HuggingFace reranker model |
| `RERANKER_TOP_K` | `5` | Reranker output count |
| `RETRIEVAL_TOP_K` | `20` | Initial retrieval count before reranking |
| `FINAL_TOP_K` | `5` | Final result count |
| `SIMILARITY_THRESHOLD` | `0.35` | Minimum score threshold |
| `LOG_LEVEL` | `INFO` | Python logging level |
| `HF_HOME` | `/models` | HuggingFace model cache directory |
| `TORCH_HOME` | `/models/torch` | PyTorch model cache directory |
| `DATA_DIR` | `/data` | Law data storage directory |
| `MCP_HOST` | `0.0.0.0` | Server bind host |
| `MCP_PORT` | `8000` (backend) / `8001` (mcp) | Server port |
| `MCP_TRANSPORT` | `stdio` (default) / `streamable-http` (mcp service) | MCP transport mode |

**Optional env vars:**
| Variable | Default | Purpose |
|----------|---------|---------|
| `API_BASE_URL` | (empty) | Frontend: override API URL (empty = nginx proxy) |

**Secrets:**
- No secrets required - all external services are public/unauthenticated
- `.env.example` provided at project root for local configuration

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## MCP (Model Context Protocol) Integration

**MCP Server:**
- Implementation: `backend/src/paragraf/server.py` using FastMCP SDK
- Transport modes: `stdio` (for Claude Desktop) or `streamable-http` (for Claude Code, port 8001)
- Registered tools: search, lookup, ingest (`backend/src/paragraf/tools/`)
- Registered prompts: `backend/src/paragraf/prompts/`
- Lifespan: Lazy ML model loading on first tool call (avoids Claude Desktop timeout)
- Separate Docker service (`mcp`) runs on port 8001 with streamable-http transport

## REST API Endpoints

**Base path:** `/api`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Service health + model status |
| GET | `/api/settings` | Current configuration (read-only) |
| GET | `/api/settings/gpu` | GPU/CUDA availability |
| POST | `/api/search` | Semantic hybrid search (Dense + Sparse + RRF + Reranking) |
| POST | `/api/lookup` | Direct paragraph lookup |
| POST | `/api/compare` | Compare multiple paragraphs |
| GET | `/api/laws` | List all available laws (optional `rechtsgebiet` filter) |
| GET | `/api/laws/{gesetz}/structure` | Law table of contents |
| GET | `/api/laws/{gesetz}/paragraphs` | All paragraphs of a law |
| POST | `/api/counseling` | EUTB counseling center search |
| GET | `/api/index/status` | Indexing status per law |
| POST | `/api/index` | Index laws (SSE streaming progress) |
| POST | `/api/index/eutb` | Import EUTB counseling data |

---

*Integration audit: 2026-03-27*

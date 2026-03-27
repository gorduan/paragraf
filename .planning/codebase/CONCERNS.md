---
generated: 2026-03-27
focus: concerns
status: current
---

# Codebase Concerns

**Analysis Date:** 2026-03-27

## Tech Debt

**Massive `api.py` file (871 lines) with all routes in one function:**
- Issue: All API routes are registered inside a single `_register_routes()` function in `backend/src/paragraf/api.py`. This monolith includes health, settings, search, lookup, compare, laws, structure, counseling, index status, SSE indexing, and EUTB import -- all in one file.
- Files: `backend/src/paragraf/api.py`
- Impact: Difficult to navigate, test individual routes, or split responsibilities. Adding new endpoints increases complexity further.
- Fix approach: Extract route groups into separate router modules (FastAPI `APIRouter`) -- e.g., `api/routes/search.py`, `api/routes/index.py`, `api/routes/laws.py`.

**IndexPage.tsx is 965 lines:**
- Issue: The largest frontend file contains all indexing UI logic, log rendering, progress tracking, and control flow in a single component.
- Files: `frontend/src/pages/IndexPage.tsx`
- Impact: Hard to maintain, test, or reuse portions of the indexing UI.
- Fix approach: Extract log viewer, law selector, and progress tracker into dedicated components.

**Duplicated code between MCP tools and REST API:**
- Issue: The indexing logic (download, parse, embed, upsert) is implemented twice -- once in `backend/src/paragraf/tools/ingest.py` (MCP tools) and once in `backend/src/paragraf/api.py` (REST SSE endpoint). The EUTB import logic is also duplicated across both. The search/lookup/compare logic is similarly mirrored.
- Files: `backend/src/paragraf/tools/ingest.py`, `backend/src/paragraf/tools/search.py`, `backend/src/paragraf/tools/lookup.py`, `backend/src/paragraf/api.py`
- Impact: Bug fixes or logic changes must be applied in two places. Divergence risk is high.
- Fix approach: Extract shared business logic into a service layer (e.g., `services/indexing.py`, `services/search_pipeline.py`) that both MCP tools and REST endpoints call.

**Duplicated EUTB Excel parsing logic:**
- Issue: The EUTB Excel-to-JSON parsing code is copy-pasted verbatim between `backend/src/paragraf/api.py` (lines 802-866) and `backend/src/paragraf/tools/ingest.py` (lines 166-250).
- Files: `backend/src/paragraf/api.py`, `backend/src/paragraf/tools/ingest.py`
- Impact: Any change to the parsing logic must be synchronized manually.
- Fix approach: Extract into a shared `services/eutb.py` module.

**Gesetzbuch enum out of sync with LAW_REGISTRY:**
- Issue: The `Gesetzbuch` StrEnum in `backend/src/paragraf/models/law.py` (lines 166-189) contains only ~19 entries including `UN_BRK` and `BTHG`, while `LAW_REGISTRY` has 70+ entries. The enum includes entries not in the registry (`UN-BRK`, `BTHG`) and is missing most of the registry entries.
- Files: `backend/src/paragraf/models/law.py` (lines 166-189)
- Impact: The enum is unused in the current codebase but misleading for future development. It claims to represent "supported" laws but is incomplete and inconsistent.
- Fix approach: Either remove the enum (it appears unused) or auto-generate it from `LAW_REGISTRY`.

## Security Considerations

**Wildcard CORS policy:**
- Risk: `allow_origins=["*"]` permits any origin to make API requests, including sending cookies (`allow_credentials=True` combined with wildcard).
- Files: `backend/src/paragraf/api.py` (line 155)
- Current mitigation: The app runs in Docker and is only exposed via nginx reverse proxy.
- Recommendations: Restrict `allow_origins` to the frontend's actual origin (e.g., `http://localhost:3847`). At minimum, do not combine `allow_credentials=True` with `allow_origins=["*"]` -- most browsers reject this combination, but it signals misconfiguration.

**No authentication or authorization:**
- Risk: All API endpoints are fully public with no authentication. The `/api/index` endpoint can trigger heavy ML workloads (downloading all ~70 laws, generating embeddings). The `/api/index/eutb` endpoint downloads external files to the server.
- Files: `backend/src/paragraf/api.py`
- Current mitigation: Docker-only deployment, not intended for public internet exposure.
- Recommendations: If ever exposed publicly, add at minimum an API key or basic auth to mutation endpoints (`/api/index`, `/api/index/eutb`). Consider rate limiting.

**No rate limiting:**
- Risk: Any client can trigger unlimited search queries (each involving ML inference) or indexing operations, potentially causing resource exhaustion.
- Files: `backend/src/paragraf/api.py`
- Current mitigation: None.
- Recommendations: Add rate limiting middleware (e.g., `slowapi`) especially for `/api/search`, `/api/index`, and `/api/compare` endpoints which involve ML inference.

**No input sanitization on `gesetz` path parameter:**
- Risk: The `gesetz` parameter in `/api/laws/{gesetz}/structure` and `/api/laws/{gesetz}/paragraphs` is passed directly to Qdrant filter queries. While Qdrant's filter model likely prevents injection, there is no validation that the value is a known law abbreviation.
- Files: `backend/src/paragraf/api.py` (lines 457-521)
- Current mitigation: Qdrant uses typed filter models, not raw strings.
- Recommendations: Validate `gesetz` against `LAW_REGISTRY` keys before querying.

**Qdrant exposed on host port 6333:**
- Risk: The Qdrant vector database is port-mapped to the host (`ports: "6333:6333"`), allowing direct unauthenticated access to the database from outside Docker.
- Files: `docker-compose.yml` (line 5)
- Current mitigation: None -- Qdrant has no built-in authentication by default.
- Recommendations: Remove the port mapping or restrict to `127.0.0.1:6333:6333` for local access only. In production, Qdrant should only be reachable within the Docker network.

**Backend exposed on host port 8000:**
- Risk: The backend is both proxied by nginx (via Docker network) and directly exposed on port 8000, bypassing nginx's proxy layer.
- Files: `docker-compose.yml` (backend service, line 21)
- Current mitigation: None.
- Recommendations: Remove `ports: - "8000:8000"` from the backend service so it is only reachable via nginx. Keep it only for development.

## Performance Bottlenecks

**Blocking embedding calls on CPU:**
- Problem: Embedding inference runs synchronously via `run_in_executor(None, ...)` which uses the default `ThreadPoolExecutor`. On CPU, each batch takes 10-15 seconds. During indexing of ~70 laws, this can take hours.
- Files: `backend/src/paragraf/services/qdrant_store.py` (line 142), `backend/src/paragraf/services/reranker.py` (line 120)
- Cause: CPU-only ML inference is inherently slow. The thread executor helps keep the event loop responsive but does not speed up inference.
- Improvement path: GPU support is already available via `docker-compose.gpu.yml`. Document expected indexing times for CPU vs GPU. Consider pre-built index snapshots for common law sets.

**N+1 query pattern in index status endpoint:**
- Problem: `/api/index/status` issues one Qdrant `count` query per law in `LAW_REGISTRY` (70+ individual requests).
- Files: `backend/src/paragraf/api.py` (lines 576-611)
- Cause: No batch count API available; each law checked individually.
- Improvement path: Cache the index status with a TTL (e.g., 60 seconds) since it changes infrequently. Or use a single scroll/aggregation query to count all laws at once.

**Law structure/paragraphs endpoint fetches up to 500 results:**
- Problem: `/api/laws/{gesetz}/structure` and `/api/laws/{gesetz}/paragraphs` use `top_k=500` for dense search, which generates an embedding for the law abbreviation query and retrieves 500 points. For large laws (BGB has hundreds of paragraphs), this may miss entries.
- Files: `backend/src/paragraf/api.py` (lines 457-521)
- Cause: Dense search is used where a payload-filter scroll would be more appropriate.
- Improvement path: Use `client.scroll()` with a filter on `gesetz` and `chunk_typ` instead of dense search. This would be faster and return all matching entries regardless of count.

**Synchronous embedding encode_query blocks during search:**
- Problem: `EmbeddingService.encode_query()` is synchronous but called from async `hybrid_search()` without `run_in_executor`. The query encoding itself is fast (single text) but still blocks the event loop briefly.
- Files: `backend/src/paragraf/services/qdrant_store.py` (line 241), `backend/src/paragraf/services/embedding.py` (line 130)
- Cause: Query encoding was considered fast enough to skip the executor wrapper.
- Improvement path: Wrap `encode_query` in `run_in_executor` for consistency, especially under concurrent load.

## Fragile Areas

**Background model initialization with silent failure:**
- Files: `backend/src/paragraf/api.py` (lines 111-120)
- Why fragile: If ML model loading fails (OOM, corrupt cache, network timeout for Hugging Face download), the exception is logged but `_initialized` stays `False`. The server continues running but every request will see `status='loading'` forever. There is no retry mechanism and no way to trigger re-initialization.
- Safe modification: Add a `_init_error` field to `AppContext` that stores the exception. Make `/api/health` return `status='error'` with the error message. Add a `/api/retry-init` endpoint.
- Test coverage: No tests for initialization failure scenarios.

**Downloaded law files are cached permanently with no invalidation:**
- Files: `backend/src/paragraf/services/parser.py` (lines 65-81), `backend/src/paragraf/services/eurlex_client.py` (lines 24-80)
- Why fragile: Both `download_gesetz()` and `EurLexClient.download()` skip re-download if the file exists. Laws are updated periodically (especially SGB amendments). There is no mechanism to force re-download or check for updates.
- Safe modification: Add a `force_download` parameter or check file age. The indexing API could accept a `force_refresh` flag.
- Test coverage: Download caching logic is not tested.

**EUR-Lex bot protection causes flaky downloads:**
- Files: `backend/src/paragraf/services/eurlex_client.py` (lines 24-80)
- Why fragile: EUR-Lex uses AWS WAF bot protection. The client retries up to 5 times with linear backoff (3s, 6s, 9s, 12s, 15s = 45s total) but can still fail. The error message instructs the user to manually download the HTML file.
- Safe modification: Consider adding the manual download path as a documented fallback in the UI rather than just an error message.
- Test coverage: No tests for retry logic or failure modes.

## Code Duplication

**EUTB parsing logic duplicated verbatim:**
- What's duplicated: ~65 lines of Excel-to-JSON parsing code
- Files: `backend/src/paragraf/api.py` (lines 802-870), `backend/src/paragraf/tools/ingest.py` (lines 126-250)
- Impact: Maintenance burden, divergence risk
- Fix: Extract to `backend/src/paragraf/services/eutb.py`

**Indexing flow duplicated between REST SSE and MCP tool:**
- What's duplicated: Download -> parse -> embed -> upsert pipeline with per-law error handling
- Files: `backend/src/paragraf/api.py` (lines 615-777), `backend/src/paragraf/tools/ingest.py` (lines 18-123)
- Impact: SSE version has keepalive handling that MCP version lacks; logic may diverge over time
- Fix: Extract to a shared `services/indexing_pipeline.py`

**Search deduplication logic duplicated:**
- What's duplicated: The paragraph deduplication + deferred absatz fill-up logic (~15 lines)
- Files: `backend/src/paragraf/api.py` (lines 307-321), `backend/src/paragraf/tools/search.py` (lines 102-116)
- Impact: Minor, but any dedup logic change must be applied twice
- Fix: Extract to a shared function in the search service

## Test Coverage Gaps

**Zero frontend tests:**
- What's not tested: The entire React frontend (21 component/page files, ~3500 lines)
- Files: `frontend/src/` (all `.tsx` and `.ts` files)
- Risk: UI regressions go unnoticed. No validation of API client behavior, component rendering, or user interaction flows.
- Priority: Medium -- the frontend is a thin UI layer, but the IndexPage (965 lines) and API client contain non-trivial logic.

**REST API layer not tested:**
- What's not tested: All FastAPI endpoints in `backend/src/paragraf/api.py` (871 lines). No integration tests with `TestClient`.
- Files: `backend/src/paragraf/api.py`
- Risk: Endpoint behavior, error responses, SSE streaming, request validation, and CORS configuration are untested.
- Priority: High -- this is the primary user-facing interface.

**SSE indexing stream not tested:**
- What's not tested: The SSE streaming endpoint (`/api/index`) and its keepalive mechanism
- Files: `backend/src/paragraf/api.py` (lines 615-777)
- Risk: SSE stream handling, keepalive timing, client disconnection, and error propagation during indexing are all untested.
- Priority: High -- this is the most complex endpoint.

**EUR-Lex client and parser not integration-tested:**
- What's not tested: `EurLexClient.download()` retry logic, `EurLexParser.parse_html()` with real EU law HTML
- Files: `backend/src/paragraf/services/eurlex_client.py`, `backend/src/paragraf/services/eurlex_parser.py`
- Risk: EUR-Lex HTML format changes could silently break parsing.
- Priority: Medium -- there is a unit test for the parser (`test_eurlex_parser.py`, 91 lines) but no test for the client.

**No test for initialization failure or recovery:**
- What's not tested: What happens when embedding model download fails, Qdrant is unreachable at startup, or reranker loading fails
- Files: `backend/src/paragraf/api.py` (lines 111-120), `backend/src/paragraf/server.py` (lines 41-58)
- Risk: Silent failure in production with no recovery path
- Priority: Medium

## Scaling Limits

**Single-threaded embedding inference:**
- Current capacity: ~8 texts per batch, ~10-15 seconds per batch on CPU
- Limit: Indexing all ~70 laws takes hours on CPU. Concurrent search requests queue behind each other for embedding.
- Scaling path: GPU support exists (`docker-compose.gpu.yml`). For horizontal scaling, would need to separate the embedding service.

**Qdrant single-node deployment:**
- Current capacity: Handles ~70 laws (~50k-100k chunks estimated) on a single Qdrant instance
- Limit: No replication, no sharding. Single point of failure for all search functionality.
- Scaling path: Qdrant supports clustering but `docker-compose.yml` only defines one node.

**All ML models loaded in a single backend process:**
- Current capacity: bge-m3 (~600MB) + bge-reranker-v2-m3 (~560MB) loaded together in one process
- Limit: ~1.2GB+ RAM for models alone. On CPU, inference for both models shares the same thread pool.
- Scaling path: Could separate embedding and reranker into microservices or use a model serving framework.

## Dependencies at Risk

**FlagEmbedding package:**
- Risk: The primary embedding and reranker package (`FlagEmbedding>=1.3.0`) has fallback handling for import failures (falls back to `sentence-transformers`), but the sparse vector functionality is lost in fallback mode, degrading hybrid search to dense-only.
- Files: `backend/src/paragraf/services/embedding.py` (lines 38-54), `backend/src/paragraf/services/reranker.py` (lines 38-49)
- Impact: If FlagEmbedding breaks or is unavailable, search quality degrades silently.
- Migration plan: The fallback to sentence-transformers is already implemented, but it should be more visible (logged as warning, shown in health endpoint).

**No pinned dependency versions in pyproject.toml:**
- Risk: All Python dependencies use `>=` minimum versions with no upper bounds (except `transformers>=4.44.0,<5.0.0`). A `pip install` could pull incompatible newer versions.
- Files: `backend/pyproject.toml`
- Impact: Builds may break unexpectedly when dependencies release breaking changes.
- Migration plan: Add upper bounds or use a lockfile (`pip-compile`, `uv lock`). The Dockerfile does not use `--constraint` or lockfiles.

## Missing Critical Features

**No data backup or export mechanism:**
- Problem: Qdrant data is stored in a Docker volume (`qdrant_data`) with no backup, export, or snapshot facility exposed through the API.
- Blocks: Users cannot migrate data, recover from volume loss, or replicate the setup.

**No law update/re-index detection:**
- Problem: No mechanism to detect when a law has been amended on gesetze-im-internet.de and needs re-indexing. Downloaded files are cached indefinitely.
- Blocks: Users may be searching outdated law text without knowing it.

**No error state in health endpoint:**
- Problem: `/api/health` only returns `status: "ready"` or `status: "loading"`. If initialization fails, it returns "loading" forever.
- Files: `backend/src/paragraf/api.py` (lines 221-243)
- Blocks: Frontend `HealthOverlay` shows permanent loading spinner with no actionable information.

---

*Concerns audit: 2026-03-27*

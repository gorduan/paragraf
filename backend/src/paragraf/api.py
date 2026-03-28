"""FastAPI REST-Layer – Strukturiertes JSON statt MCP/Markdown."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from paragraf.api_models import (
    BatchSearchRequest,
    BatchSearchResponse,
    CompareItem,
    CompareRequest,
    CompareResponse,
    CounselingItem,
    CounselingRequest,
    CounselingResponse,
    DiscoverRequest,
    DiscoverResponse,
    GpuInfoResponse,
    GroupedRecommendRequest,
    GroupedRecommendResponse,
    GroupedResultGroup,
    GroupedSearchRequest,
    GroupedSearchResponse,
    HealthResponse,
    HopResultItem,
    IndexProgressEvent,
    IndexRequest,
    IndexResultResponse,
    IndexStatusItem,
    IndexStatusResponse,
    LawInfo,
    LawParagraphsResponse,
    LawsResponse,
    LawStructureEntry,
    LawStructureResponse,
    LookupRequest,
    LookupResponse,
    MultiHopRequest,
    MultiHopResponse,
    RecommendRequest,
    RecommendResponse,
    SearchRequest,
    IncomingReferenceItem,
    ReferenceExtractRequest,
    ReferenceExtractResponse,
    ReferenceItem,
    ReferenceNetworkResponse,
    SearchResponse,
    SearchResultItem,
    SettingsResponse,
    SnapshotCreateResponse,
    SnapshotInfo,
    SnapshotListResponse,
    SnapshotRestoreResponse,
)
from qdrant_client import models as qdrant_models

from paragraf.config import settings
from paragraf.models.law import (
    BESCHREIBUNGEN,
    EURLEX_LAWS,
    GESETZ_DOWNLOAD_SLUGS,
    LAW_REGISTRY,
    SearchFilter,
    SearchResult,
)
from paragraf.server import AppContext
from paragraf.services.embedding import EmbeddingService
from paragraf.services.multi_hop import MultiHopService
from paragraf.services.parser import GesetzParser
from paragraf.services.qdrant_store import QdrantStore
from paragraf.services.query_expander import QueryExpander
from paragraf.services.reranker import RerankerService

logger = logging.getLogger(__name__)

# ── Lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def api_lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Erstellt Services sofort, laedt ML-Modelle lazy im Hintergrund.

    Der Server antwortet sofort auf /api/health (status='loading'),
    waehrend Embedding- und Reranker-Modelle im Hintergrund geladen werden.
    """
    logger.info("=== Paragraf REST-API startet ===")

    data_dir = settings.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "raw").mkdir(exist_ok=True)
    (data_dir / "processed").mkdir(exist_ok=True)

    # Services konfigurieren (noch nicht initialisieren!)
    embedding = EmbeddingService(
        model_name=settings.embedding_model,
        device=settings.embedding_device,
        use_fp16=settings.embedding_device != "cpu",
        batch_size=settings.embedding_batch_size,
        max_length=settings.embedding_max_length,
    )

    qdrant = QdrantStore(
        url=settings.qdrant_url,
        collection_name=settings.qdrant_collection,
        embedding_service=embedding,
    )

    reranker = RerankerService(
        model_name=settings.reranker_model,
        device=settings.embedding_device,
        use_fp16=settings.embedding_device != "cpu",
        top_k=settings.reranker_top_k,
    )

    parser = GesetzParser(data_dir=data_dir)

    app.state.ctx = AppContext(
        embedding=embedding,
        qdrant=qdrant,
        reranker=reranker,
        parser=parser,
        data_dir=data_dir,
    )

    # Modelle im Hintergrund laden
    async def _init_models() -> None:
        try:
            await embedding.initialize()
            await qdrant.connect()
            await qdrant.ensure_collection(vector_size=embedding.dimension)
            await qdrant.enable_scalar_quantization()
            logger.info("Scalar Quantization aktiviert (Int8, Dense-Vektoren)")
            await reranker.initialize()
            app.state.ctx._initialized = True
            logger.info("=== Alle Services initialisiert ===")
        except Exception:
            logger.exception("Fehler beim Laden der ML-Modelle")

    init_task = asyncio.create_task(_init_models())

    logger.info("=== Server bereit (Modelle werden im Hintergrund geladen) ===")

    try:
        yield
    finally:
        init_task.cancel()
        if app.state.ctx._initialized:
            await qdrant.close()
        logger.info("=== Paragraf REST-API gestoppt ===")


# ── App erstellen ─────────────────────────────────────────────────────────────


def create_api() -> FastAPI:
    """Erstellt und konfiguriert die FastAPI-App."""
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    app = FastAPI(
        title="Paragraf API",
        description="REST-API fuer deutsches Recht und EU-Recht – Semantische Suche ueber ~95 Gesetze",
        version="0.2.0",
        lifespan=api_lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError,
    ) -> JSONResponse:
        errors = []
        for err in exc.errors():
            field = " -> ".join(str(loc) for loc in err.get("loc", []))
            msg = err.get("msg", "Validierungsfehler")
            errors.append(f"{field}: {msg}")
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Ungueltige Anfrage",
                "errors": errors,
            },
        )

    _register_routes(app)
    return app


# ── Hilfsfunktionen ──────────────────────────────────────────────────────────


def _get_ctx(request: Request) -> AppContext:
    return request.app.state.ctx


def _normalize_paragraph_input(text: str) -> str:
    """Normalisiert §-Zeichen-Varianten in Benutzereingaben."""
    # Unicode \u00a7 ist das normale §, aber manchmal kommen andere Varianten
    text = text.replace("\u00a7", "§")
    # '§152' -> '§ 152'
    text = re.sub(r"§(\d)", r"§ \1", text)
    return text


def _result_to_item(r) -> SearchResultItem:  # noqa: ANN001
    meta = r.chunk.metadata
    refs_out: list[ReferenceItem] | None = None
    if meta.references_out:
        refs_out = [
            ReferenceItem(
                gesetz=ref.gesetz,
                paragraph=ref.paragraph,
                absatz=ref.absatz,
                raw=ref.raw,
                verified=ref.verified,
                kontext=ref.kontext,
            )
            for ref in meta.references_out
        ]
    return SearchResultItem(
        paragraph=meta.paragraph,
        gesetz=meta.gesetz,
        titel=meta.titel,
        text=r.chunk.text,
        score=round(r.score, 4),
        abschnitt=meta.abschnitt,
        hierarchie_pfad=meta.hierarchie_pfad,
        quelle=meta.quelle,
        chunk_typ=meta.chunk_typ,
        absatz=meta.absatz,
        references_out=refs_out,
    )


def _rrf_merge(
    results_a: list[SearchResult],
    results_b: list[SearchResult],
    k: int = 60,
) -> list[SearchResult]:
    """Reciprocal Rank Fusion zweier Ergebnis-Listen."""
    scores: dict[str, float] = {}
    result_map: dict[str, SearchResult] = {}
    for rank, r in enumerate(results_a):
        scores[r.chunk.id] = scores.get(r.chunk.id, 0) + 1 / (k + rank + 1)
        result_map[r.chunk.id] = r
    for rank, r in enumerate(results_b):
        scores[r.chunk.id] = scores.get(r.chunk.id, 0) + 1 / (k + rank + 1)
        result_map[r.chunk.id] = r
    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
    return [
        SearchResult(chunk=result_map[cid].chunk, score=scores[cid], rank=i)
        for i, cid in enumerate(sorted_ids)
    ]


# ── Routes ────────────────────────────────────────────────────────────────────


def _register_routes(app: FastAPI) -> None:

    # Query Expander (CPU-only, instantiate once)
    query_expander = QueryExpander()

    # ── Health ────────────────────────────────────────────────────────────

    @app.get("/api/health", response_model=HealthResponse)
    async def health(request: Request) -> HealthResponse:
        ctx = _get_ctx(request)
        if not ctx._initialized:
            return HealthResponse(
                status="loading",
                embedding_model=ctx.embedding.model_name,
                embedding_dimension=0,
                embedding_device=ctx.embedding.device,
                qdrant_collection="",
                qdrant_status="loading",
                indexierte_chunks=0,
            )
        info = await ctx.qdrant.get_collection_info()
        return HealthResponse(
            status="ready",
            embedding_model=ctx.embedding.model_name,
            embedding_dimension=ctx.embedding.dimension,
            embedding_device=ctx.embedding.device,
            qdrant_collection=info.get("name", ""),
            qdrant_status=info.get("status", "unknown"),
            indexierte_chunks=info.get("points_count", 0),
        )

    # ── Settings ───────────────────────────────────────────────────────────

    @app.get("/api/settings", response_model=SettingsResponse)
    async def get_settings() -> SettingsResponse:
        import os

        return SettingsResponse(
            embedding_device=settings.embedding_device,
            embedding_batch_size=settings.embedding_batch_size,
            embedding_max_length=settings.embedding_max_length,
            reranker_top_k=settings.reranker_top_k,
            retrieval_top_k=settings.retrieval_top_k,
            similarity_threshold=settings.similarity_threshold,
            qdrant_url=settings.qdrant_url,
            hf_home=os.environ.get("HF_HOME", ""),
            torch_home=os.environ.get("TORCH_HOME", ""),
        )

    @app.get("/api/settings/gpu", response_model=GpuInfoResponse)
    async def get_gpu_info() -> GpuInfoResponse:
        try:
            import torch

            if torch.cuda.is_available():
                name = torch.cuda.get_device_name(0)
                vram = int(torch.cuda.get_device_properties(0).total_memory / 1024 / 1024)
                return GpuInfoResponse(cuda_available=True, gpu_name=name, vram_total_mb=vram)
        except Exception:
            pass
        return GpuInfoResponse()

    # ── Semantische Suche ─────────────────────────────────────────────────

    @app.post("/api/search", response_model=SearchResponse)
    async def search(body: SearchRequest, request: Request) -> SearchResponse:
        ctx = _get_ctx(request)
        max_ergebnisse = max(1, min(20, body.max_ergebnisse))

        search_filter = SearchFilter(
            gesetz=body.gesetzbuch,
            abschnitt=body.abschnitt,
            absatz_von=body.absatz_von,
            absatz_bis=body.absatz_bis,
        )

        # Query Expansion
        expanded_terms: list[str] = []
        search_query = body.anfrage
        if body.expand and settings.query_expansion_enabled:
            search_query, expanded_terms = query_expander.expand(body.anfrage)

        # Per D-08: Cursor-basierte Pagination via Scroll API (kein Reranking)
        if body.cursor is not None:
            results, next_cursor = await ctx.qdrant.scroll_search(
                search_filter=search_filter,
                limit=body.page_size,
                cursor=body.cursor,
            )
            items = [_result_to_item(r) for r in results]
            return SearchResponse(
                query=body.anfrage,
                results=items,
                total=len(items),
                search_type="scroll",
                next_cursor=next_cursor,
            )

        if body.search_type == "fulltext":
            # Fulltext-Suche: MatchText + Sparse Scoring, kein Reranking
            raw_results = await ctx.qdrant.fulltext_search(
                query=search_query,
                top_k=max_ergebnisse,
                search_filter=search_filter,
            )
            items = [_result_to_item(r) for r in raw_results]
            return SearchResponse(
                query=body.anfrage,
                results=items,
                total=len(items),
                search_type="fulltext",
                expanded_terms=expanded_terms,
            )

        elif body.search_type == "hybrid_fulltext":
            # Hybrid: Semantische + Fulltext-Suche unabhaengig, Merge, Reranking
            semantic_results = await ctx.qdrant.hybrid_search(
                query=search_query,
                top_k=settings.retrieval_top_k,
                search_filter=search_filter,
            )
            fulltext_results = await ctx.qdrant.fulltext_search(
                query=search_query,
                top_k=settings.retrieval_top_k,
                search_filter=search_filter,
            )
            # Merge: Semantisch zuerst, dann einzigartige Fulltext-Ergebnisse
            seen_ids: set[str] = set()
            merged: list[SearchResult] = []
            for r in semantic_results:
                rid = r.chunk.id
                if rid not in seen_ids:
                    seen_ids.add(rid)
                    merged.append(r)
            for r in fulltext_results:
                rid = r.chunk.id
                if rid not in seen_ids:
                    seen_ids.add(rid)
                    merged.append(r)

            # Reranking der zusammengefuehrten Ergebnisse
            if merged:
                reranked = await ctx.reranker.arerank(
                    body.anfrage, merged, top_k=max_ergebnisse,
                )
                reranked = [r for r in reranked if r.score >= settings.similarity_threshold]
            else:
                reranked = []

            # Deduplizierung nach Paragraph+Gesetz
            seen_keys: set[str] = set()
            deduplicated: list[SearchResult] = []
            for r in reranked:
                key = f"{r.chunk.metadata.paragraph}|{r.chunk.metadata.gesetz}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    deduplicated.append(r)

            items = [_result_to_item(r) for r in deduplicated[:max_ergebnisse]]
            return SearchResponse(
                query=body.anfrage,
                results=items,
                total=len(items),
                search_type="hybrid_fulltext",
                expanded_terms=expanded_terms,
            )

        else:
            # Standard: Semantische Suche (bestehende Logik)
            # Parallel strategy: run original + expanded query, merge with RRF
            if (
                settings.query_expansion_strategy == "parallel"
                and expanded_terms
            ):
                original_results, expanded_results = await asyncio.gather(
                    ctx.qdrant.hybrid_search(
                        body.anfrage, top_k=settings.retrieval_top_k,
                        search_filter=search_filter,
                    ),
                    ctx.qdrant.hybrid_search(
                        search_query, top_k=settings.retrieval_top_k,
                        search_filter=search_filter,
                    ),
                )
                raw_results = _rrf_merge(original_results, expanded_results, k=60)
            else:
                raw_results = await ctx.qdrant.hybrid_search(
                    query=search_query,
                    top_k=settings.retrieval_top_k,
                    search_filter=search_filter,
                )

            if not raw_results:
                return SearchResponse(
                    query=body.anfrage, results=[], total=0, search_type="semantic",
                    expanded_terms=expanded_terms,
                )

            reranked = await ctx.reranker.arerank(
                body.anfrage, raw_results, top_k=max_ergebnisse,
            )
            reranked = [r for r in reranked if r.score >= settings.similarity_threshold]

            if not reranked:
                return SearchResponse(
                    query=body.anfrage, results=[], total=0, search_type="semantic",
                    expanded_terms=expanded_terms,
                )

            # Deduplizierung
            seen_keys: set[str] = set()
            deduplicated: list[SearchResult] = []
            deferred: list[SearchResult] = []
            for r in reranked:
                key = f"{r.chunk.metadata.paragraph}|{r.chunk.metadata.gesetz}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    deduplicated.append(r)
                elif r.chunk.metadata.chunk_typ == "absatz" and len(deduplicated) < max_ergebnisse:
                    deferred.append(r)
            if len(deduplicated) < max_ergebnisse and deferred:
                deduplicated.extend(deferred[: max_ergebnisse - len(deduplicated)])

            items = [_result_to_item(r) for r in deduplicated]
            return SearchResponse(
                query=body.anfrage, results=items, total=len(items),
                search_type="semantic", expanded_terms=expanded_terms,
            )

    # ── Recommend ──────────────────────────────────────────────────────────

    @app.post("/api/recommend", response_model=RecommendResponse)
    async def recommend(body: RecommendRequest, request: Request) -> RecommendResponse:
        """Findet aehnliche Paragraphen via Qdrant Recommend API."""
        ctx = _get_ctx(request)

        # Resolve point_ids from paragraph+gesetz if not provided
        point_ids = body.point_ids
        source_gesetz: str | None = None

        if not point_ids:
            if not body.paragraph or not body.gesetz:
                raise HTTPException(
                    status_code=400,
                    detail="Entweder point_ids oder paragraph+gesetz muss angegeben werden.",
                )
            resolved_id = await ctx.qdrant._resolve_point_id(body.paragraph, body.gesetz)
            if resolved_id is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Paragraph {body.paragraph} in {body.gesetz} nicht gefunden.",
                )
            point_ids = [resolved_id]
            source_gesetz = body.gesetz
        else:
            source_gesetz = None

        # exclude_same_law filter
        exclude_gesetz_value: str | None = None
        if body.exclude_same_law and source_gesetz:
            exclude_gesetz_value = source_gesetz

        # Build search filter from optional filter params
        search_filter = SearchFilter(
            gesetz=body.gesetzbuch,
            abschnitt=body.abschnitt,
            absatz_von=body.absatz_von,
            absatz_bis=body.absatz_bis,
        )

        results = await ctx.qdrant.recommend(
            point_ids=point_ids,
            limit=body.limit,
            search_filter=search_filter,
            exclude_gesetz=exclude_gesetz_value,
        )

        items = [_result_to_item(r) for r in results]
        return RecommendResponse(
            source_ids=point_ids,
            results=items,
            total=len(items),
        )

    # ── Batch Search ──────────────────────────────────────────────────────

    @app.post("/api/search/batch", response_model=BatchSearchResponse)
    async def search_batch(body: BatchSearchRequest, request: Request) -> BatchSearchResponse:
        """Fuehrt mehrere Suchanfragen parallel aus."""
        ctx = _get_ctx(request)

        # Validate against max queries from settings
        if len(body.queries) > settings.batch_max_queries:
            raise HTTPException(
                status_code=400,
                detail=f"Maximal {settings.batch_max_queries} parallele Queries erlaubt.",
            )

        # load_warning heuristic
        load_warning = len(body.queries) >= int(settings.batch_max_queries * 0.8)

        async def _execute_single(query: SearchRequest) -> SearchResponse:
            """Fuehrt eine einzelne Suche aus (wiederverwendet search-Logik)."""
            search_filter_inner = SearchFilter(
                gesetz=query.gesetzbuch,
                abschnitt=query.abschnitt,
                absatz_von=query.absatz_von,
                absatz_bis=query.absatz_bis,
            )
            raw_results = await ctx.qdrant.hybrid_search(
                query=query.anfrage,
                top_k=settings.retrieval_top_k,
                search_filter=search_filter_inner,
            )
            if raw_results:
                reranked = await ctx.reranker.arerank(
                    query.anfrage, raw_results, top_k=query.max_ergebnisse,
                )
                reranked = [r for r in reranked if r.score >= settings.similarity_threshold]
            else:
                reranked = []

            items = [_result_to_item(r) for r in reranked]
            return SearchResponse(
                query=query.anfrage,
                results=items,
                total=len(items),
                search_type=query.search_type,
            )

        # Execute all queries in parallel with return_exceptions=True
        tasks = [_execute_single(q) for q in body.queries]
        gathered = await asyncio.gather(*tasks, return_exceptions=True)

        responses: list[SearchResponse] = []
        for i, result in enumerate(gathered):
            if isinstance(result, Exception):
                logger.warning("Batch query %d fehlgeschlagen: %s", i, result)
                responses.append(SearchResponse(
                    query=body.queries[i].anfrage,
                    results=[],
                    total=0,
                    search_type=body.queries[i].search_type,
                ))
            else:
                responses.append(result)

        return BatchSearchResponse(
            results=responses,
            total_queries=len(responses),
            load_warning=load_warning,
        )

    # ── Discovery ─────────────────────────────────────────────────────────

    @app.post("/api/discover", response_model=DiscoverResponse)
    async def discover(body: DiscoverRequest, request: Request) -> DiscoverResponse:
        """Explorative Suche mit Positiv/Negativ-Beispielen via Discovery API."""
        ctx = _get_ctx(request)

        # Resolve positive IDs: collect from point_ids + paragraph resolution
        positive_ids: list[str] = list(body.positive_ids or [])
        if body.positive_paragraphs:
            resolved = await asyncio.gather(
                *[ctx.qdrant._resolve_point_id(p.paragraph, p.gesetz) for p in body.positive_paragraphs]
            )
            for i, rid in enumerate(resolved):
                if rid is None:
                    p = body.positive_paragraphs[i]
                    raise HTTPException(404, f"Paragraph {p.paragraph} in {p.gesetz} nicht gefunden.")
                positive_ids.append(rid)

        if not positive_ids:
            raise HTTPException(400, "Mindestens ein positives Beispiel erforderlich (positive_ids oder positive_paragraphs).")

        # Resolve negative IDs
        negative_ids: list[str] = list(body.negative_ids or [])
        if body.negative_paragraphs:
            resolved_neg = await asyncio.gather(
                *[ctx.qdrant._resolve_point_id(p.paragraph, p.gesetz) for p in body.negative_paragraphs]
            )
            for i, rid in enumerate(resolved_neg):
                if rid is None:
                    p = body.negative_paragraphs[i]
                    raise HTTPException(404, f"Paragraph {p.paragraph} in {p.gesetz} nicht gefunden.")
                negative_ids.append(rid)

        # Build context pairs per Research Pattern 2
        # target = first positive, remaining positives paired with negatives
        target_id = positive_ids[0]
        context_pairs: list[tuple[str, str]] = []
        remaining_pos = positive_ids[1:]
        if negative_ids:
            # Cartesian: each remaining positive paired with each negative
            for pos in remaining_pos:
                for neg in negative_ids:
                    context_pairs.append((pos, neg))
            # Also pair target-associated positives if only negatives exist
            if not remaining_pos:
                for neg in negative_ids:
                    context_pairs.append((target_id, neg))

        search_filter = SearchFilter(gesetz=body.gesetzbuch, abschnitt=body.abschnitt)

        results = await ctx.qdrant.discover(
            target_id=target_id,
            context_pairs=context_pairs,
            limit=body.limit,
            search_filter=search_filter,
        )

        items = [_result_to_item(r) for r in results]
        return DiscoverResponse(
            positive_ids=positive_ids,
            negative_ids=negative_ids,
            results=items,
            total=len(items),
        )

    # ── Grouped Search ────────────────────────────────────────────────────

    @app.post("/api/search/grouped", response_model=GroupedSearchResponse)
    async def search_grouped(body: GroupedSearchRequest, request: Request) -> GroupedSearchResponse:
        """Suchergebnisse nach Gesetz gruppiert via query_points_groups."""
        ctx = _get_ctx(request)

        search_filter = SearchFilter(gesetz=body.gesetzbuch, abschnitt=body.abschnitt)

        grouped = await ctx.qdrant.grouped_search(
            query=body.anfrage,
            group_size=body.group_size,
            max_groups=body.max_groups,
            search_filter=search_filter,
        )

        groups = [
            GroupedResultGroup(
                gesetz=gesetz,
                results=[_result_to_item(r) for r in results],
                total=len(results),
            )
            for gesetz, results in grouped
        ]
        return GroupedSearchResponse(
            query=body.anfrage,
            groups=groups,
            total_groups=len(groups),
        )

    # ── Grouped Recommend ─────────────────────────────────────────────────

    @app.post("/api/recommend/grouped", response_model=GroupedRecommendResponse)
    async def recommend_grouped(body: GroupedRecommendRequest, request: Request) -> GroupedRecommendResponse:
        """Empfehlungen nach Gesetz gruppiert."""
        ctx = _get_ctx(request)

        # Resolve point_ids (same pattern as /api/recommend)
        point_ids = body.point_ids
        source_gesetz: str | None = None
        if not point_ids:
            if not body.paragraph or not body.gesetz:
                raise HTTPException(400, "Entweder point_ids oder paragraph+gesetz muss angegeben werden.")
            resolved_id = await ctx.qdrant._resolve_point_id(body.paragraph, body.gesetz)
            if resolved_id is None:
                raise HTTPException(404, f"Paragraph {body.paragraph} in {body.gesetz} nicht gefunden.")
            point_ids = [resolved_id]
            source_gesetz = body.gesetz
        else:
            source_gesetz = None

        exclude_gesetz_value: str | None = None
        if body.exclude_same_law and source_gesetz:
            exclude_gesetz_value = source_gesetz

        search_filter = SearchFilter(
            gesetz=body.gesetzbuch, abschnitt=body.abschnitt,
            absatz_von=body.absatz_von, absatz_bis=body.absatz_bis,
        )

        grouped = await ctx.qdrant.grouped_recommend(
            point_ids=point_ids,
            group_size=body.group_size,
            max_groups=body.max_groups,
            search_filter=search_filter,
            exclude_gesetz=exclude_gesetz_value,
        )

        groups = [
            GroupedResultGroup(
                gesetz=gesetz,
                results=[_result_to_item(r) for r in results],
                total=len(results),
            )
            for gesetz, results in grouped
        ]
        return GroupedRecommendResponse(
            source_ids=point_ids,
            groups=groups,
            total_groups=len(groups),
        )

    # ── Paragraph nachschlagen ────────────────────────────────────────────

    @app.post("/api/lookup", response_model=LookupResponse)
    async def lookup(body: LookupRequest, request: Request) -> LookupResponse:
        ctx = _get_ctx(request)
        paragraph = _normalize_paragraph_input(body.paragraph)

        search_filter = SearchFilter(
            gesetz=body.gesetz,
            paragraph=paragraph,
            chunk_typ="paragraph",
        )

        results = await ctx.qdrant.dense_search(
            query=f"{paragraph} {body.gesetz}",
            top_k=3,
            search_filter=search_filter,
        )

        if not results:
            fallback_filter = SearchFilter(gesetz=body.gesetz)
            results = await ctx.qdrant.hybrid_search(
                query=f"{paragraph} {body.gesetz}",
                top_k=3,
                search_filter=fallback_filter,
            )

        if not results:
            return LookupResponse(
                paragraph=paragraph,
                gesetz=body.gesetz,
                titel="",
                text="",
                found=False,
                error=f"Der Paragraph {paragraph} {body.gesetz} wurde nicht gefunden.",
            )

        best = results[0]
        meta = best.chunk.metadata
        return LookupResponse(
            paragraph=meta.paragraph,
            gesetz=meta.gesetz,
            titel=meta.titel,
            text=best.chunk.text,
            abschnitt=meta.abschnitt,
            hierarchie_pfad=meta.hierarchie_pfad,
            quelle=meta.quelle,
            stand=meta.stand,
        )

    # ── Paragraphen vergleichen ───────────────────────────────────────────

    @app.post("/api/compare", response_model=CompareResponse)
    async def compare(body: CompareRequest, request: Request) -> CompareResponse:
        ctx = _get_ctx(request)
        items: list[CompareItem] = []

        for ref in body.paragraphen[:5]:
            ref_normalized = _normalize_paragraph_input(ref.strip())
            match = re.match(r"(§\s*\d+\w*)\s+(.+)", ref_normalized)
            if match:
                paragraph = match.group(1)
                gesetz = match.group(2).strip()
                search_filter = SearchFilter(
                    gesetz=gesetz,
                    paragraph=paragraph,
                    chunk_typ="paragraph",
                )
                results = await ctx.qdrant.dense_search(
                    query=f"{paragraph} {gesetz}",
                    top_k=1,
                    search_filter=search_filter,
                )
                if not results:
                    search_filter = SearchFilter(gesetz=gesetz)
                    results = await ctx.qdrant.hybrid_search(
                        query=f"{paragraph} {gesetz}",
                        top_k=1,
                        search_filter=search_filter,
                    )
            else:
                results = await ctx.qdrant.hybrid_search(query=ref, top_k=1)

            if results:
                r = results[0]
                meta = r.chunk.metadata
                items.append(CompareItem(
                    referenz=ref,
                    paragraph=meta.paragraph,
                    gesetz=meta.gesetz,
                    titel=meta.titel,
                    text=r.chunk.text,
                ))
            else:
                items.append(CompareItem(referenz=ref, found=False))

        return CompareResponse(items=items)

    # ── Gesetze auflisten ─────────────────────────────────────────────────

    @app.get("/api/laws", response_model=LawsResponse)
    async def laws(request: Request, rechtsgebiet: str | None = None) -> LawsResponse:
        ctx = _get_ctx(request)
        info = await ctx.qdrant.get_collection_info()

        gesetze = []
        for abk, law_def in LAW_REGISTRY.items():
            # Filter nach Rechtsgebiet (case-insensitive, matcht auch tags)
            if rechtsgebiet:
                rg_lower = rechtsgebiet.lower()
                matches_rechtsgebiet = rg_lower in law_def.rechtsgebiet.lower()
                matches_tags = any(rg_lower in t.lower() for t in law_def.tags)
                if not matches_rechtsgebiet and not matches_tags:
                    continue

            gesetze.append(LawInfo(
                abkuerzung=abk,
                beschreibung=law_def.beschreibung,
                slug=law_def.slug,
                rechtsgebiet=law_def.rechtsgebiet,
                quelle=law_def.quelle,
                tags=list(law_def.tags),
            ))

        return LawsResponse(
            gesetze=gesetze,
            total_chunks=info.get("points_count", 0),
            db_status=info.get("status", "unknown"),
        )

    # ── Gesetzesstruktur ──────────────────────────────────────────────────

    @app.get("/api/laws/{gesetz}/structure", response_model=LawStructureResponse)
    async def law_structure(gesetz: str, request: Request) -> LawStructureResponse:
        ctx = _get_ctx(request)

        search_filter = SearchFilter(gesetz=gesetz, chunk_typ="paragraph")
        results = await ctx.qdrant.dense_search(
            query=gesetz,
            top_k=500,
            search_filter=search_filter,
        )

        seen: set[str] = set()
        entries: list[LawStructureEntry] = []
        for r in results:
            meta = r.chunk.metadata
            key = f"{meta.paragraph}|{meta.gesetz}"
            if key not in seen:
                seen.add(key)
                entries.append(LawStructureEntry(
                    paragraph=meta.paragraph,
                    titel=meta.titel,
                    abschnitt=meta.abschnitt,
                    hierarchie_pfad=meta.hierarchie_pfad,
                ))

        # Sortierung nach Paragraphen-Nummer (numerisch)
        def _sort_key(entry: LawStructureEntry) -> tuple[int, str]:
            match = re.search(r"(\d+)", entry.paragraph)
            return (int(match.group(1)) if match else 9999, entry.paragraph)

        entries.sort(key=_sort_key)

        return LawStructureResponse(
            gesetz=gesetz,
            paragraphen=entries,
            total=len(entries),
        )

    # ── Alle Paragraphen eines Gesetzes ───────────────────────────────────

    @app.get("/api/laws/{gesetz}/paragraphs", response_model=LawParagraphsResponse)
    async def law_paragraphs(gesetz: str, request: Request) -> LawParagraphsResponse:
        ctx = _get_ctx(request)

        search_filter = SearchFilter(gesetz=gesetz, chunk_typ="paragraph")
        results = await ctx.qdrant.dense_search(
            query=gesetz,
            top_k=500,
            search_filter=search_filter,
        )

        seen: set[str] = set()
        items: list[SearchResultItem] = []
        for r in results:
            meta = r.chunk.metadata
            key = f"{meta.paragraph}|{meta.gesetz}"
            if key not in seen:
                seen.add(key)
                items.append(_result_to_item(r))

        return LawParagraphsResponse(
            gesetz=gesetz,
            paragraphen=items,
            total=len(items),
        )

    # ── EUTB-Beratungsstellen ─────────────────────────────────────────────

    @app.post("/api/counseling", response_model=CounselingResponse)
    async def counseling(body: CounselingRequest, request: Request) -> CounselingResponse:
        ctx = _get_ctx(request)
        eutb_file = ctx.data_dir / "processed" / "eutb_beratungsstellen.json"

        if not eutb_file.exists():
            return CounselingResponse(
                stellen=[],
                total=0,
                hinweis="EUTB-Daten noch nicht importiert. Bitte zuerst ueber /api/index/eutb importieren.",
            )

        stellen = json.loads(eutb_file.read_text(encoding="utf-8"))

        # Filtern
        if body.ort:
            ort_lower = body.ort.lower()
            stellen = [
                s for s in stellen
                if ort_lower in s.get("ort", "").lower()
                or ort_lower in s.get("name", "").lower()
            ]
        if body.bundesland:
            bl_lower = body.bundesland.lower()
            stellen = [
                s for s in stellen
                if bl_lower in s.get("bundesland", "").lower()
            ]
        if body.schwerpunkt:
            sp_lower = body.schwerpunkt.lower()
            stellen = [
                s for s in stellen
                if any(sp_lower in sp.lower() for sp in s.get("schwerpunkte", []))
                or sp_lower in s.get("name", "").lower()
            ]

        items = [
            CounselingItem(
                **{
                    k: s.get(k, "" if k not in ("schwerpunkte", "barrierefreiheit") else [])
                    for k in CounselingItem.model_fields
                }
            )
            for s in stellen[:50]
        ]

        return CounselingResponse(stellen=items, total=len(stellen))

    # ── Index-Status ──────────────────────────────────────────────────────

    @app.get("/api/index/status", response_model=IndexStatusResponse)
    async def index_status(request: Request) -> IndexStatusResponse:
        ctx = _get_ctx(request)
        info = await ctx.qdrant.get_collection_info()
        total_chunks = info.get("points_count", 0)

        # Pro Gesetz Chunk-Anzahl ermitteln via Qdrant count
        gesetze_status: list[IndexStatusItem] = []
        for abk in LAW_REGISTRY:
            try:
                count_result = await ctx.qdrant.client.count(
                    collection_name=ctx.qdrant.collection_name,
                    count_filter=qdrant_models.Filter(
                        must=[
                            qdrant_models.FieldCondition(
                                key="gesetz",
                                match=qdrant_models.MatchValue(value=abk),
                            )
                        ]
                    ),
                )
                chunks = count_result.count
            except Exception as e:
                logger.warning("Count-Abfrage fuer %s fehlgeschlagen: %s", abk, e)
                chunks = 0

            gesetze_status.append(IndexStatusItem(
                gesetz=abk,
                chunks=chunks,
                status="indexiert" if chunks > 0 else "nicht_indexiert",
            ))

        return IndexStatusResponse(
            gesetze=gesetze_status,
            total_chunks=total_chunks,
            db_status=info.get("status", "unknown"),
        )

    # ── Indexierung (SSE fuer Fortschritt) ─────────────────────────────────

    @app.post("/api/index")
    async def index_gesetze(body: IndexRequest, request: Request) -> StreamingResponse:
        ctx = _get_ctx(request)

        async def _stream() -> AsyncIterator[str]:
            def _event(data: IndexProgressEvent) -> str:
                return f"data: {data.model_dump_json()}\n\n"

            # Auto-Snapshot vor Indexierung (per D-03)
            try:
                snapshot_name = await ctx.qdrant.create_snapshot()
                await ctx.qdrant.delete_oldest_snapshots(
                    max_count=settings.snapshot_max_count,
                )
                logger.info("Auto-Snapshot erstellt: %s", snapshot_name)
                yield _event(IndexProgressEvent(
                    gesetz="system",
                    schritt="snapshot",
                    nachricht=f"Sicherungs-Snapshot erstellt: {snapshot_name}",
                ))
            except Exception as e:
                logger.warning("Auto-Snapshot fehlgeschlagen: %s (Indexierung wird fortgesetzt)", e)

            if body.gesetzbuch:
                law_def = LAW_REGISTRY.get(body.gesetzbuch)
                if not law_def:
                    yield _event(IndexProgressEvent(
                        gesetz=body.gesetzbuch or "",
                        schritt="error",
                        nachricht=f"Unbekanntes Gesetzbuch: {body.gesetzbuch}",
                    ))
                    return

                yield _event(IndexProgressEvent(
                    gesetz=body.gesetzbuch, schritt="download", nachricht="Lade herunter...",
                ))
                try:
                    if law_def.quelle == "eur-lex.europa.eu":
                        from paragraf.services.eurlex_client import EurLexClient
                        from paragraf.services.eurlex_parser import EurLexParser
                        eurlex_client = EurLexClient(data_dir=ctx.data_dir)
                        html_path = await eurlex_client.download(law_def.slug)
                        yield _event(IndexProgressEvent(
                            gesetz=body.gesetzbuch, schritt="parse", nachricht="Parse HTML...",
                        ))
                        eurlex_parser = EurLexParser()
                        chunks = eurlex_parser.parse_html(
                            html_path.read_text(encoding="utf-8"),
                            gesetz_abk=body.gesetzbuch,
                        )
                    else:
                        path = await ctx.parser.download_gesetz(law_def.slug)
                        yield _event(IndexProgressEvent(
                            gesetz=body.gesetzbuch, schritt="parse", nachricht="Parse XML...",
                        ))
                        chunks = ctx.parser.parse_zip(path, gesetz_abk=body.gesetzbuch)

                    total_chunks = len(chunks)
                    yield _event(IndexProgressEvent(
                        gesetz=body.gesetzbuch, schritt="embedding",
                        fortschritt=0, gesamt=total_chunks,
                        nachricht=f"{total_chunks} Chunks werden eingebettet...",
                    ))
                    async for embedded, total in ctx.qdrant.upsert_chunks_stream(chunks):
                        yield _event(IndexProgressEvent(
                            gesetz=body.gesetzbuch, schritt="embedding",
                            fortschritt=embedded, gesamt=total,
                            nachricht=f"{embedded}/{total} Chunks eingebettet...",
                        ))

                    yield _event(IndexProgressEvent(
                        gesetz=body.gesetzbuch, schritt="done",
                        fortschritt=total_chunks, gesamt=total_chunks,
                        nachricht=f"{total_chunks} Chunks indexiert",
                    ))
                except (asyncio.CancelledError, GeneratorExit):
                    logger.warning("Stream fuer %s abgebrochen (Client-Disconnect)", body.gesetzbuch)
                    return
                except Exception as e:
                    yield _event(IndexProgressEvent(
                        gesetz=body.gesetzbuch, schritt="error",
                        nachricht=str(e),
                    ))
            else:
                total = len(LAW_REGISTRY)
                for i, (name, law_def) in enumerate(LAW_REGISTRY.items()):
                    yield _event(IndexProgressEvent(
                        gesetz=name, schritt="download",
                        fortschritt=i, gesamt=total,
                        nachricht=f"[{i+1}/{total}] Lade {name}...",
                    ))
                    try:
                        if law_def.quelle == "eur-lex.europa.eu":
                            from paragraf.services.eurlex_client import EurLexClient
                            from paragraf.services.eurlex_parser import EurLexParser
                            eurlex_client = EurLexClient(data_dir=ctx.data_dir)
                            html_path = await eurlex_client.download(law_def.slug)
                            yield _event(IndexProgressEvent(
                                gesetz=name, schritt="parse",
                                fortschritt=i, gesamt=total,
                                nachricht=f"Parse {name}...",
                            ))
                            eurlex_parser = EurLexParser()
                            chunks = eurlex_parser.parse_html(
                                html_path.read_text(encoding="utf-8"),
                                gesetz_abk=name,
                            )
                        else:
                            path = await ctx.parser.download_gesetz(law_def.slug)
                            yield _event(IndexProgressEvent(
                                gesetz=name, schritt="parse",
                                fortschritt=i, gesamt=total,
                                nachricht=f"Parse {name}...",
                            ))
                            chunks = ctx.parser.parse_zip(path, gesetz_abk=name)

                        num_chunks = len(chunks)
                        yield _event(IndexProgressEvent(
                            gesetz=name, schritt="embedding",
                            fortschritt=i, gesamt=total,
                            nachricht=f"{name}: {num_chunks} Chunks einbetten...",
                        ))
                        async for embedded, chunk_total in ctx.qdrant.upsert_chunks_stream(chunks):
                            yield _event(IndexProgressEvent(
                                gesetz=name, schritt="embedding",
                                fortschritt=i, gesamt=total,
                                nachricht=f"{name}: {embedded}/{chunk_total} Chunks eingebettet...",
                            ))

                        yield _event(IndexProgressEvent(
                            gesetz=name, schritt="done",
                            fortschritt=i + 1, gesamt=total,
                            nachricht=f"{name}: {num_chunks} Chunks indexiert",
                        ))
                    except (asyncio.CancelledError, GeneratorExit):
                        logger.warning("Stream fuer %s abgebrochen (Client-Disconnect)", name)
                        return
                    except Exception as e:
                        yield _event(IndexProgressEvent(
                            gesetz=name, schritt="error",
                            fortschritt=i + 1, gesamt=total,
                            nachricht=f"{name}: {e}",
                        ))

        async def _with_keepalive(
            gen: AsyncIterator[str], interval: float = 15.0
        ) -> AsyncIterator[str]:
            """Sendet SSE-Keepalive-Kommentare bei Inaktivitaet.

            Verhindert, dass Proxies/Docker-Networking idle Connections droppen,
            z.B. waehrend langer Embedding-Batches auf CPU.
            """
            queue: asyncio.Queue[str | None] = asyncio.Queue()

            async def _produce() -> None:
                try:
                    async for chunk in gen:
                        await queue.put(chunk)
                finally:
                    await queue.put(None)

            task = asyncio.create_task(_produce())
            try:
                while True:
                    try:
                        item = await asyncio.wait_for(queue.get(), timeout=interval)
                        if item is None:
                            break
                        yield item
                    except asyncio.TimeoutError:
                        yield ": keepalive\n\n"
            finally:
                if not task.done():
                    task.cancel()

        return StreamingResponse(
            _with_keepalive(_stream()), media_type="text/event-stream"
        )

    # ── EUTB indexieren ───────────────────────────────────────────────────

    @app.post("/api/index/eutb", response_model=IndexResultResponse)
    async def index_eutb(request: Request) -> IndexResultResponse:
        import httpx

        ctx = _get_ctx(request)
        processed_dir = ctx.data_dir / "processed"
        processed_dir.mkdir(parents=True, exist_ok=True)

        url = "https://www.teilhabeberatung.de/beratung/export?_format=xlsx"
        xlsx_path = ctx.data_dir / "raw" / "eutb_export.xlsx"
        json_path = processed_dir / "eutb_beratungsstellen.json"

        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                resp = await client.get(url)
                resp.raise_for_status()
            xlsx_path.parent.mkdir(parents=True, exist_ok=True)
            xlsx_path.write_bytes(resp.content)
        except httpx.HTTPError as e:
            return IndexResultResponse(erfolg=False, fehler=[f"Download fehlgeschlagen: {e}"])

        try:
            import openpyxl

            wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
            ws = wb.active
            if ws is None:
                return IndexResultResponse(erfolg=False, fehler=["Kein aktives Worksheet"])

            rows = list(ws.iter_rows(values_only=True))
            if len(rows) < 2:
                return IndexResultResponse(erfolg=False, fehler=["Keine Daten in Excel"])

            headers = [str(h).lower().strip() if h else "" for h in rows[0]]
            stellen: list[dict] = []
            for row in rows[1:]:
                if not row or not any(row):
                    continue
                data = dict(zip(headers, row, strict=False))

                # Schwerpunkte extrahieren
                schwerpunkte_raw = ""
                for sp_key in ("schwerpunkte", "beratungsschwerpunkte",
                               "schwerpunkt", "beratungsschwerpunkt", "themen"):
                    val = data.get(sp_key, "")
                    if val and str(val).strip() and str(val).strip() != "None":
                        schwerpunkte_raw = str(val).strip()
                        break

                schwerpunkte: list[str] = []
                if schwerpunkte_raw:
                    for sep in (";", ",", "|"):
                        if sep in schwerpunkte_raw:
                            schwerpunkte = [
                                s.strip() for s in schwerpunkte_raw.split(sep)
                                if s.strip()
                            ]
                            break
                    if not schwerpunkte:
                        schwerpunkte = [schwerpunkte_raw]

                stelle = {
                    "name": str(data.get("name", data.get("bezeichnung", ""))).strip(),
                    "traeger": str(data.get("träger", data.get("traeger", ""))).strip(),
                    "strasse": str(data.get("straße", data.get("strasse", ""))).strip(),
                    "plz": str(data.get("plz", "")).strip(),
                    "ort": str(data.get("ort", data.get("stadt", ""))).strip(),
                    "bundesland": str(data.get("bundesland", "")).strip(),
                    "telefon": str(data.get("telefon", "")).strip(),
                    "email": str(data.get("e-mail", data.get("email", ""))).strip(),
                    "website": str(data.get("homepage", data.get("website", ""))).strip(),
                    "schwerpunkte": schwerpunkte,
                }
                for k, v in stelle.items():
                    if v == "None" or v is None:
                        stelle[k] = "" if isinstance(v, str) else []
                if stelle["name"]:
                    stellen.append(stelle)
            wb.close()

            json_path.write_text(
                json.dumps(stellen, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            return IndexResultResponse(erfolg=True, total_chunks=len(stellen))

        except ImportError:
            return IndexResultResponse(erfolg=False, fehler=["openpyxl nicht installiert"])
        except Exception as e:
            return IndexResultResponse(erfolg=False, fehler=[str(e)])

    # ── Index-Migration ──────────────────────────────────────────────────────

    @app.post("/api/indexes/ensure")
    async def ensure_indexes(request: Request) -> dict:
        """Erstellt fehlende Payload-Indexes (Full-Text, Integer Range)."""
        ctx = _get_ctx(request)
        created: list[str] = []
        errors: list[str] = []
        try:
            await ctx.qdrant.create_text_index()
            created.append("text_fulltext")
        except Exception as e:
            logger.warning("Text-Index Erstellung fehlgeschlagen: %s", e)
            errors.append(f"text_fulltext: {e}")
        try:
            await ctx.qdrant.create_absatz_index()
            created.append("absatz_integer")
        except Exception as e:
            logger.warning("Absatz-Index Erstellung fehlgeschlagen: %s", e)
            errors.append(f"absatz_integer: {e}")
        return {"created": created, "errors": errors, "erfolg": len(errors) == 0}

    # ── Snapshot-Endpunkte ────────────────────────────────────────────────────

    @app.post("/api/snapshots", response_model=SnapshotCreateResponse)
    async def create_snapshot(request: Request) -> SnapshotCreateResponse | JSONResponse:
        """Erstellt einen Snapshot der Qdrant-Collection."""
        ctx = _get_ctx(request)
        try:
            name = await ctx.qdrant.create_snapshot()
            deleted = await ctx.qdrant.delete_oldest_snapshots(
                max_count=settings.snapshot_max_count,
            )
            logger.info("Snapshot erstellt: %s (geloescht: %s)", name, deleted)
            return SnapshotCreateResponse(
                erfolg=True,
                name=name,
                nachricht=f"Snapshot '{name}' erfolgreich erstellt",
                geloeschte_snapshots=deleted,
            )
        except Exception as e:
            logger.error("Snapshot-Erstellung fehlgeschlagen: %s", e)
            return JSONResponse(status_code=500, content={"detail": str(e)})

    @app.get("/api/snapshots", response_model=SnapshotListResponse)
    async def list_snapshots(request: Request) -> SnapshotListResponse | JSONResponse:
        """Listet alle Snapshots der Collection."""
        ctx = _get_ctx(request)
        try:
            snapshots = await ctx.qdrant.list_snapshots()
            return SnapshotListResponse(
                snapshots=[
                    SnapshotInfo(
                        name=s.name,
                        creation_time=str(s.creation_time) if s.creation_time else None,
                        size=s.size if hasattr(s, "size") else 0,
                    )
                    for s in snapshots
                ],
                total=len(snapshots),
            )
        except Exception as e:
            logger.error("Snapshot-Liste fehlgeschlagen: %s", e)
            return JSONResponse(status_code=500, content={"detail": str(e)})

    @app.post("/api/snapshots/{snapshot_name}/restore", response_model=SnapshotRestoreResponse)
    async def restore_snapshot(
        snapshot_name: str, request: Request,
    ) -> SnapshotRestoreResponse | JSONResponse:
        """Stellt die Collection aus einem Snapshot wieder her."""
        ctx = _get_ctx(request)
        try:
            # Validate snapshot exists
            snapshots = await ctx.qdrant.list_snapshots()
            names = [s.name for s in snapshots]
            if snapshot_name not in names:
                return JSONResponse(
                    status_code=404,
                    content={
                        "detail": f"Snapshot '{snapshot_name}' nicht gefunden."
                        f" Verfuegbar: {', '.join(names)}"
                    },
                )
            await ctx.qdrant.restore_snapshot(snapshot_name)
            logger.info("Snapshot wiederhergestellt: %s", snapshot_name)
            return SnapshotRestoreResponse(
                erfolg=True,
                nachricht=f"Collection aus Snapshot '{snapshot_name}' wiederhergestellt",
            )
        except Exception as e:
            logger.error("Snapshot-Wiederherstellung fehlgeschlagen: %s", e)
            return JSONResponse(status_code=500, content={"detail": str(e)})

    @app.delete("/api/snapshots/{snapshot_name}")
    async def delete_snapshot(
        snapshot_name: str, request: Request,
    ) -> JSONResponse:
        """Loescht einen Snapshot."""
        ctx = _get_ctx(request)
        try:
            snapshots = await ctx.qdrant.list_snapshots()
            names = [s.name for s in snapshots]
            if snapshot_name not in names:
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"Snapshot '{snapshot_name}' nicht gefunden"},
                )
            await ctx.qdrant.delete_snapshot(snapshot_name)
            logger.info("Snapshot geloescht: %s", snapshot_name)
            return JSONResponse(
                content={
                    "erfolg": True,
                    "nachricht": f"Snapshot '{snapshot_name}' geloescht",
                }
            )
        except Exception as e:
            logger.error("Snapshot-Loeschung fehlgeschlagen: %s", e)
            return JSONResponse(status_code=500, content={"detail": str(e)})

    # ── Multi-Hop Search ────────────────────────────────────────────────────

    @app.post("/api/search/multi-hop", response_model=MultiHopResponse)
    async def search_multi_hop(
        body: MultiHopRequest, request: Request,
    ) -> MultiHopResponse:
        """Mehrstufige Suche mit Querverweis-Traversal."""
        ctx = _get_ctx(request)
        await ctx.ensure_ready()
        multi_hop = MultiHopService(ctx.qdrant, ctx.reranker, query_expander)
        sf = SearchFilter(gesetz=body.gesetzbuch) if body.gesetzbuch else None
        result = await multi_hop.search_with_hops(
            query=body.anfrage,
            tiefe=body.tiefe,
            max_per_hop=body.max_ergebnisse_pro_hop,
            search_filter=sf,
            expand=body.expand,
        )
        return MultiHopResponse(
            query=result["query"],
            expanded_terms=result["expanded_terms"],
            hops=result["hops"],
            results=[HopResultItem(**r) for r in result["results"]],
            total=result["total"],
            visited_paragraphs=result["visited_paragraphs"],
        )

    # ── Cross-Reference Endpoints ────────────────────────────────────────────

    @app.post("/api/references/extract", response_model=ReferenceExtractResponse)
    async def extract_references(
        body: ReferenceExtractRequest, request: Request,
    ) -> ReferenceExtractResponse | JSONResponse:
        """Extrahiert Querverweise aus allen Punkten und speichert sie als Payload."""
        ctx = _get_ctx(request)
        try:
            # D-09: Snapshot vor Extraktion erstellen
            snapshot_name = await ctx.qdrant.create_snapshot()
            logger.info("Sicherungs-Snapshot vor Extraktion: %s", snapshot_name)

            from paragraf.services.cross_reference import CrossReferenceExtractor

            extractor = CrossReferenceExtractor()
            stats = await ctx.qdrant.extract_all_references(
                extractor, gesetz_filter=body.gesetz
            )

            # Nested-Indizes sicherstellen
            await ctx.qdrant.create_reference_indexes()

            modus = "Vollstaendige Neuindexierung" if body.full_reindex else "Inkrementelle Extraktion"
            nachricht = (
                f"{modus} abgeschlossen: {stats['points_with_refs']} von "
                f"{stats['total_points']} Punkten mit Querverweisen "
                f"({stats['total_refs']} Querverweise gesamt)"
            )

            return ReferenceExtractResponse(
                erfolg=True,
                total_points=stats["total_points"],
                points_with_refs=stats["points_with_refs"],
                total_refs=stats["total_refs"],
                snapshot_name=snapshot_name,
                nachricht=nachricht,
            )
        except Exception as e:
            logger.error("Querverweis-Extraktion fehlgeschlagen: %s", e)
            return JSONResponse(
                status_code=500,
                content={"detail": f"Querverweis-Extraktion fehlgeschlagen: {e}"},
            )

    @app.get("/api/references/{gesetz}/{paragraph}", response_model=ReferenceNetworkResponse)
    async def get_reference_network(
        gesetz: str, paragraph: str, request: Request,
    ) -> ReferenceNetworkResponse | JSONResponse:
        """Gibt das Zitationsnetzwerk eines Paragraphen zurueck."""
        ctx = _get_ctx(request)
        try:
            paragraph = _normalize_paragraph_input(paragraph)

            outgoing_raw = await ctx.qdrant.get_outgoing_references(gesetz, paragraph)
            incoming_raw = await ctx.qdrant.get_incoming_references(gesetz, paragraph)
            incoming_count = await ctx.qdrant.count_incoming_references(gesetz, paragraph)

            outgoing = [
                ReferenceItem(
                    gesetz=ref.get("gesetz", ""),
                    paragraph=ref.get("paragraph", ""),
                    absatz=ref.get("absatz"),
                    raw=ref.get("raw", ""),
                    verified=ref.get("verified", False),
                    kontext=ref.get("kontext"),
                )
                for ref in outgoing_raw
            ]
            incoming = [
                IncomingReferenceItem(
                    gesetz=ref.get("gesetz", ""),
                    paragraph=ref.get("paragraph", ""),
                    chunk_id=ref.get("chunk_id", ""),
                    text_preview=ref.get("text_preview", ""),
                )
                for ref in incoming_raw
            ]

            return ReferenceNetworkResponse(
                gesetz=gesetz,
                paragraph=paragraph,
                outgoing=outgoing,
                incoming=incoming,
                incoming_count=incoming_count,
            )
        except Exception as e:
            logger.error("Zitationsnetzwerk-Abfrage fehlgeschlagen: %s", e)
            return JSONResponse(
                status_code=500,
                content={"detail": f"Zitationsnetzwerk-Abfrage fehlgeschlagen: {e}"},
            )

"""Qdrant-Service – Collection-Management, Upsert, Hybrid-Search."""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator, Callable
from typing import Any

from qdrant_client import AsyncQdrantClient, models
from qdrant_client.http.exceptions import ResponseHandlingException

from paragraf.models.law import ChunkMetadata, LawChunk, SearchFilter, SearchResult
from paragraf.services.embedding import EmbeddingService

logger = logging.getLogger(__name__)

DENSE_VECTOR_NAME = "dense"
SPARSE_VECTOR_NAME = "sparse"


class QdrantStore:
    """Verwaltet die Qdrant-Collection fuer Rechtstexte mit Hybrid-Search."""

    def __init__(
        self,
        url: str = "http://localhost:6333",
        collection_name: str = "paragraf",
        embedding_service: EmbeddingService | None = None,
    ) -> None:
        self.url = url
        self.collection_name = collection_name
        self.embedding = embedding_service
        self._client: AsyncQdrantClient | None = None

    async def connect(self) -> None:
        """Stellt Verbindung zu Qdrant her."""
        logger.info("Verbinde mit Qdrant: %s", self.url)
        self._client = AsyncQdrantClient(url=self.url, timeout=30)

        # Health-Check
        try:
            info = await self._client.get_collections()
            logger.info("Qdrant erreichbar – %d Collections", len(info.collections))
        except Exception as e:
            logger.error("Qdrant nicht erreichbar: %s", e)
            raise ConnectionError(f"Qdrant unter {self.url} nicht erreichbar") from e

    @property
    def client(self) -> AsyncQdrantClient:
        if self._client is None:
            raise RuntimeError("Nicht verbunden – await connect() aufrufen")
        return self._client

    async def ensure_collection(self, vector_size: int = 1024) -> None:
        """Erstellt die Collection mit Dense + Sparse Vektoren, falls nicht vorhanden.

        Prueft ob der Name als Collection oder Alias existiert, bevor eine neue
        Collection erstellt wird.
        """
        # Pruefen ob Collection oder Alias bereits erreichbar ist
        try:
            info = await self.client.get_collection(self.collection_name)
            logger.info(
                "Collection '%s' existiert bereits (%d Punkte)",
                self.collection_name,
                info.points_count,
            )
            return
        except Exception:
            pass  # Collection/Alias existiert nicht -> erstellen

        logger.info("Erstelle Collection '%s' mit Hybrid-Vektoren", self.collection_name)
        await self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config={
                DENSE_VECTOR_NAME: models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE,
                ),
            },
            sparse_vectors_config={
                SPARSE_VECTOR_NAME: models.SparseVectorParams(
                    index=models.SparseIndexParams(on_disk=False),
                ),
            },
        )

        # Payload-Indizes fuer schnelles Filtern
        for field in ["gesetz", "paragraph", "abschnitt", "chunk_typ"]:
            await self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name=field,
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
        logger.info("Collection '%s' erstellt mit Payload-Indizes", self.collection_name)

    async def create_text_index(self) -> None:
        """Erstellt Full-Text Index auf dem text-Feld."""
        await self.client.create_payload_index(
            collection_name=self.collection_name,
            field_name="text",
            field_schema=models.TextIndexParams(
                type=models.TextIndexType.TEXT,
                tokenizer=models.TokenizerType.WORD,
                min_token_len=2,
                max_token_len=40,
                lowercase=True,
            ),
            wait=True,
        )
        logger.info("Full-Text Index auf 'text' erstellt")

    async def create_absatz_index(self) -> None:
        """Erstellt Integer-Index auf dem absatz-Feld fuer Range-Queries."""
        await self.client.create_payload_index(
            collection_name=self.collection_name,
            field_name="absatz",
            field_schema=models.IntegerIndexParams(
                type=models.IntegerIndexType.INTEGER,
                lookup=True,
                range=True,
            ),
            wait=True,
        )
        logger.info("Integer-Index auf 'absatz' erstellt")

    async def upsert_chunks(
        self,
        chunks: list[LawChunk],
        on_progress: Callable[[int, int], None] | None = None,
    ) -> int:
        """Fuegt Chunks mit Dense + Sparse Vektoren ein (nicht-streaming)."""
        count = 0
        async for embedded, total in self.upsert_chunks_stream(chunks):
            if on_progress:
                on_progress(embedded, total)
            count = total
        return count

    async def upsert_chunks_stream(
        self, chunks: list[LawChunk]
    ) -> AsyncIterator[tuple[int, int]]:
        """Fuegt Chunks batch-weise ein und yielded (embedded_so_far, total) nach jedem Batch.

        Ermoeglicht SSE-Progress-Events waehrend langer Embedding-Operationen.
        """
        if not chunks:
            return
        if self.embedding is None:
            raise RuntimeError("Kein EmbeddingService konfiguriert")

        total = len(chunks)
        # Use the model's configured batch size so each run_in_executor call
        # completes one forward pass (~10-15s on CPU) instead of multiple,
        # yielding progress events more frequently for SSE streaming.
        embed_batch_size = self.embedding.batch_size if self.embedding else 32
        upsert_batch_size = 100

        logger.info("Erzeuge Embeddings fuer %d Chunks in Batches à %d...", total, embed_batch_size)

        all_points: list[models.PointStruct] = []

        loop = asyncio.get_running_loop()

        for start in range(0, total, embed_batch_size):
            batch_chunks = chunks[start : start + embed_batch_size]
            texts = [c.text for c in batch_chunks]

            # Run CPU-intensive embedding in thread executor to keep event loop free for SSE
            dense_vecs, sparse_vecs = await loop.run_in_executor(
                None, self.embedding.encode_dense_and_sparse, texts
            )

            for i, chunk in enumerate(batch_chunks):
                sparse_indices, sparse_values = EmbeddingService.sparse_to_qdrant(
                    sparse_vecs[i]
                )

                named_vectors: dict[str, Any] = {
                    DENSE_VECTOR_NAME: dense_vecs[i],
                }
                named_sparse: dict[str, models.SparseVector] = {}
                if sparse_indices:
                    named_sparse[SPARSE_VECTOR_NAME] = models.SparseVector(
                        indices=sparse_indices,
                        values=sparse_values,
                    )

                point = models.PointStruct(
                    id=str(uuid.uuid5(uuid.NAMESPACE_URL, chunk.id)),
                    vector={**named_vectors, **named_sparse},
                    payload={
                        "chunk_id": chunk.id,
                        "text": chunk.text,
                        **chunk.metadata.model_dump(),
                    },
                )
                all_points.append(point)

            embedded = min(start + embed_batch_size, total)
            logger.debug("Embedding Batch %d–%d / %d", start, embedded, total)
            yield embedded, total

        # Batch-Upsert in Gruppen
        upserted = 0
        for start in range(0, len(all_points), upsert_batch_size):
            batch = all_points[start : start + upsert_batch_size]
            await self.client.upsert(
                collection_name=self.collection_name,
                points=batch,
                wait=True,
            )
            upserted += len(batch)
            logger.debug("Upsert Batch %d–%d", start, start + len(batch))

        logger.info("%d Chunks in Qdrant eingefuegt", upserted)

    def _build_filter(
        self, search_filter: SearchFilter | None
    ) -> models.Filter | None:
        """Baut Qdrant-Filter aus SearchFilter."""
        if search_filter is None:
            return None

        conditions: list[models.FieldCondition] = []
        if search_filter.gesetz:
            conditions.append(
                models.FieldCondition(
                    key="gesetz",
                    match=models.MatchValue(value=search_filter.gesetz),
                )
            )
        if search_filter.paragraph:
            conditions.append(
                models.FieldCondition(
                    key="paragraph",
                    match=models.MatchValue(value=search_filter.paragraph),
                )
            )
        if search_filter.abschnitt:
            conditions.append(
                models.FieldCondition(
                    key="abschnitt",
                    match=models.MatchValue(value=search_filter.abschnitt),
                )
            )
        if search_filter.chunk_typ:
            conditions.append(
                models.FieldCondition(
                    key="chunk_typ",
                    match=models.MatchValue(value=search_filter.chunk_typ),
                )
            )

        if search_filter.absatz_von is not None or search_filter.absatz_bis is not None:
            range_params: dict[str, int] = {}
            if search_filter.absatz_von is not None:
                range_params["gte"] = search_filter.absatz_von
            if search_filter.absatz_bis is not None:
                range_params["lte"] = search_filter.absatz_bis
            conditions.append(
                models.FieldCondition(
                    key="absatz",
                    range=models.Range(**range_params),
                )
            )
            # D-05: Nur Absatz-Chunks wenn Range-Filter aktiv
            if not search_filter.chunk_typ:
                conditions.append(
                    models.FieldCondition(
                        key="chunk_typ",
                        match=models.MatchValue(value="absatz"),
                    )
                )

        if not conditions:
            return None
        return models.Filter(must=conditions)

    async def hybrid_search(
        self,
        query: str,
        top_k: int = 20,
        search_filter: SearchFilter | None = None,
    ) -> list[SearchResult]:
        """Hybrid-Search: Dense + Sparse mit Reciprocal Rank Fusion."""
        if self.embedding is None:
            raise RuntimeError("Kein EmbeddingService konfiguriert")

        dense_vec, sparse_weights = self.embedding.encode_query(query)
        sparse_indices, sparse_values = EmbeddingService.sparse_to_qdrant(
            sparse_weights
        )

        qdrant_filter = self._build_filter(search_filter)

        # Qdrant Hybrid Query mit RRF Fusion
        prefetch_queries = [
            models.Prefetch(
                query=dense_vec,
                using=DENSE_VECTOR_NAME,
                limit=top_k,
                filter=qdrant_filter,
            ),
        ]

        # Sparse-Prefetch nur wenn Sparse-Vektoren vorhanden
        if sparse_indices:
            prefetch_queries.append(
                models.Prefetch(
                    query=models.SparseVector(
                        indices=sparse_indices,
                        values=sparse_values,
                    ),
                    using=SPARSE_VECTOR_NAME,
                    limit=top_k,
                    filter=qdrant_filter,
                )
            )

        try:
            results = await self.client.query_points(
                collection_name=self.collection_name,
                prefetch=prefetch_queries,
                query=models.FusionQuery(fusion=models.Fusion.RRF),
                limit=top_k,
                with_payload=True,
                search_params=models.SearchParams(
                    quantization=models.QuantizationSearchParams(
                        rescore=True,
                        oversampling=1.5,
                    ),
                ),
            )
        except (ResponseHandlingException, Exception) as exc:
            # Fallback: nur Dense-Search wenn Hybrid fehlschlaegt
            logger.warning(
                "Hybrid-Search fehlgeschlagen (%s) – Fallback auf Dense-only",
                type(exc).__name__,
            )
            results = await self.client.query_points(
                collection_name=self.collection_name,
                query=dense_vec,
                using=DENSE_VECTOR_NAME,
                limit=top_k,
                query_filter=qdrant_filter,
                with_payload=True,
                search_params=models.SearchParams(
                    quantization=models.QuantizationSearchParams(
                        rescore=True,
                        oversampling=1.5,
                    ),
                ),
            )

        return self._points_to_results(results)

    async def dense_search(
        self,
        query: str,
        top_k: int = 10,
        search_filter: SearchFilter | None = None,
    ) -> list[SearchResult]:
        """Reine Dense-Vektor-Suche (fuer einfache Anfragen)."""
        if self.embedding is None:
            raise RuntimeError("Kein EmbeddingService konfiguriert")

        dense_vec, _ = self.embedding.encode_query(query)
        qdrant_filter = self._build_filter(search_filter)

        results = await self.client.query_points(
            collection_name=self.collection_name,
            query=dense_vec,
            using=DENSE_VECTOR_NAME,
            limit=top_k,
            query_filter=qdrant_filter,
            with_payload=True,
            search_params=models.SearchParams(
                quantization=models.QuantizationSearchParams(
                    rescore=True,
                    oversampling=1.5,
                ),
            ),
        )

        return self._points_to_results(results)

    async def fulltext_search(
        self,
        query: str,
        top_k: int = 20,
        search_filter: SearchFilter | None = None,
    ) -> list[SearchResult]:
        """Full-Text-Suche: MatchText-Filter + Sparse-Vektor-Scoring."""
        if self.embedding is None:
            raise RuntimeError("Kein EmbeddingService konfiguriert")

        # MatchText filter on text field
        text_condition = models.FieldCondition(
            key="text",
            match=models.MatchText(text=query),
        )

        # Combine with existing filters
        base_filter = self._build_filter(search_filter)
        must_conditions: list[models.FieldCondition] = [text_condition]
        if base_filter and base_filter.must:
            must_conditions.extend(base_filter.must)

        combined_filter = models.Filter(must=must_conditions)

        # Encode query for sparse vector scoring
        loop = asyncio.get_running_loop()
        _, sparse_weights = await loop.run_in_executor(
            None, self.embedding.encode_query, query
        )
        sparse_indices, sparse_values = EmbeddingService.sparse_to_qdrant(sparse_weights)

        if sparse_indices:
            results = await self.client.query_points(
                collection_name=self.collection_name,
                query=models.SparseVector(
                    indices=sparse_indices,
                    values=sparse_values,
                ),
                using=SPARSE_VECTOR_NAME,
                limit=top_k,
                query_filter=combined_filter,
                with_payload=True,
            )
            return self._points_to_results(results)
        else:
            # Fallback: scroll with filter if no sparse vectors
            records, _ = await self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=combined_filter,
                limit=top_k,
                with_payload=True,
            )
            return self._records_to_results(records)

    # ── Recommend & Pagination ────────────────────────────────────────────────

    async def _resolve_point_id(self, paragraph: str, gesetz: str) -> str | None:
        """Loest paragraph+gesetz zu Qdrant Point-UUID auf."""
        search_filter = SearchFilter(gesetz=gesetz, paragraph=paragraph, chunk_typ="paragraph")
        qdrant_filter = self._build_filter(search_filter)
        records, _ = await self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=qdrant_filter,
            limit=1,
            with_payload=["chunk_id"],
        )
        if not records:
            return None
        chunk_id = records[0].payload.get("chunk_id", "")
        return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))

    async def recommend(
        self,
        point_ids: list[str],
        limit: int = 10,
        search_filter: SearchFilter | None = None,
        exclude_gesetz: str | None = None,
        score_threshold: float | None = None,
    ) -> list[SearchResult]:
        """Findet aehnliche Paragraphen via Qdrant Recommend API.

        Verwendet query_points mit RecommendQuery und AVERAGE_VECTOR Strategie.
        Per D-03: Nur positive Beispiele (keine Negative Examples).
        """
        qdrant_filter = self._build_filter(search_filter)

        # Per D-02: exclude_same_law via must_not Bedingung
        if exclude_gesetz:
            must_not = [
                models.FieldCondition(
                    key="gesetz",
                    match=models.MatchValue(value=exclude_gesetz),
                )
            ]
            if qdrant_filter is None:
                qdrant_filter = models.Filter(must_not=must_not)
            else:
                qdrant_filter.must_not = must_not

        results = await self.client.query_points(
            collection_name=self.collection_name,
            query=models.RecommendQuery(
                recommend=models.RecommendInput(
                    positive=point_ids,
                    strategy=models.RecommendStrategy.AVERAGE_VECTOR,
                ),
            ),
            using=DENSE_VECTOR_NAME,
            query_filter=qdrant_filter,
            limit=limit,
            with_payload=True,
            score_threshold=score_threshold,
            search_params=models.SearchParams(
                quantization=models.QuantizationSearchParams(
                    rescore=True,
                    oversampling=1.5,
                ),
            ),
        )
        return self._points_to_results(results)

    async def scroll_search(
        self,
        search_filter: SearchFilter | None = None,
        limit: int = 10,
        cursor: str | None = None,
    ) -> tuple[list[SearchResult], str | None]:
        """Paginierte Suche via Qdrant Scroll API.

        Per D-06: Cursor-basierte Pagination. Cursor ist eine Point-ID (UUID-String).
        Per Pitfall 3: Ergebnisse sind nach ID sortiert, nicht nach Relevanz.
        """
        qdrant_filter = self._build_filter(search_filter)
        records, next_offset = await self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=qdrant_filter,
            limit=limit,
            offset=cursor,
            with_payload=True,
        )
        results = self._records_to_results(records)
        next_cursor = str(next_offset) if next_offset is not None else None
        return results, next_cursor

    @staticmethod
    def _records_to_results(records: list[Any]) -> list[SearchResult]:
        """Konvertiert Qdrant-Scroll-Records zu SearchResult-Liste (score=0.0)."""
        search_results = []
        for rank, record in enumerate(records, start=1):
            payload = record.payload or {}
            metadata = ChunkMetadata(
                gesetz=payload.get("gesetz", ""),
                paragraph=payload.get("paragraph", ""),
                absatz=payload.get("absatz"),
                titel=payload.get("titel", ""),
                abschnitt=payload.get("abschnitt", ""),
                hierarchie_pfad=payload.get("hierarchie_pfad", ""),
                norm_id=payload.get("norm_id", ""),
                stand=payload.get("stand"),
                quelle=payload.get("quelle", "gesetze-im-internet.de"),
                chunk_typ=payload.get("chunk_typ", "paragraph"),
            )
            chunk = LawChunk(
                id=payload.get("chunk_id", ""),
                text=payload.get("text", ""),
                metadata=metadata,
            )
            search_results.append(
                SearchResult(chunk=chunk, score=0.0, rank=rank)
            )
        return search_results

    # ── Snapshot-CRUD ────────────────────────────────────────────────────────────

    async def create_snapshot(self) -> str:
        """Erstellt einen Snapshot der Collection und gibt den Namen zurueck."""
        snapshot = await self.client.create_snapshot(
            collection_name=self.collection_name, wait=True
        )
        logger.info("Snapshot erstellt: %s", snapshot.name)
        return snapshot.name

    async def list_snapshots(self) -> list:
        """Listet alle Snapshots der Collection auf."""
        return await self.client.list_snapshots(
            collection_name=self.collection_name
        )

    async def restore_snapshot(self, snapshot_name: str) -> bool:
        """Stellt einen Snapshot wieder her."""
        location = f"file:///qdrant/snapshots/{self.collection_name}/{snapshot_name}"
        await self.client.recover_snapshot(
            collection_name=self.collection_name,
            location=location,
            wait=True,
        )
        logger.info("Snapshot wiederhergestellt: %s", snapshot_name)
        return True

    async def delete_snapshot(self, snapshot_name: str) -> bool:
        """Loescht einen Snapshot."""
        await self.client.delete_snapshot(
            collection_name=self.collection_name,
            snapshot_name=snapshot_name,
            wait=True,
        )
        logger.info("Snapshot geloescht: %s", snapshot_name)
        return True

    async def delete_oldest_snapshots(self, max_count: int = 3) -> list[str]:
        """Loescht die aeltesten Snapshots, wenn mehr als max_count vorhanden sind."""
        snapshots = await self.list_snapshots()
        if len(snapshots) <= max_count:
            return []

        sorted_snapshots = sorted(snapshots, key=lambda s: s.creation_time)
        to_delete = sorted_snapshots[: len(snapshots) - max_count]
        deleted_names: list[str] = []

        for snap in to_delete:
            await self.delete_snapshot(snap.name)
            deleted_names.append(snap.name)

        logger.info(
            "%d alte Snapshots geloescht (max_count=%d)", len(deleted_names), max_count
        )
        return deleted_names

    # ── Quantization ─────────────────────────────────────────────────────────────

    async def enable_scalar_quantization(self) -> None:
        """Aktiviert Scalar Quantization (INT8) fuer die Collection.

        Idempotent: ueberspringt, wenn Quantization bereits aktiv ist.
        """
        collection_info = await self.client.get_collection(self.collection_name)
        if collection_info.config.quantization_config is not None:
            logger.info(
                "Scalar Quantization bereits aktiv fuer '%s'", self.collection_name
            )
            return

        await self.client.update_collection(
            collection_name=self.collection_name,
            quantization_config=models.ScalarQuantization(
                scalar=models.ScalarQuantizationConfig(
                    type=models.ScalarType.INT8,
                    quantile=0.99,
                    always_ram=True,
                ),
            ),
        )
        logger.info("Scalar Quantization aktiviert fuer '%s'", self.collection_name)

    @staticmethod
    def _points_to_results(results: Any) -> list[SearchResult]:
        """Konvertiert Qdrant-QueryResponse zu SearchResult-Liste."""
        search_results = []
        for rank, point in enumerate(results.points, start=1):
            payload = point.payload or {}
            metadata = ChunkMetadata(
                gesetz=payload.get("gesetz", ""),
                paragraph=payload.get("paragraph", ""),
                absatz=payload.get("absatz"),
                titel=payload.get("titel", ""),
                abschnitt=payload.get("abschnitt", ""),
                hierarchie_pfad=payload.get("hierarchie_pfad", ""),
                norm_id=payload.get("norm_id", ""),
                stand=payload.get("stand"),
                quelle=payload.get("quelle", "gesetze-im-internet.de"),
                chunk_typ=payload.get("chunk_typ", "paragraph"),
            )
            chunk = LawChunk(
                id=payload.get("chunk_id", ""),
                text=payload.get("text", ""),
                metadata=metadata,
            )
            search_results.append(
                SearchResult(chunk=chunk, score=point.score or 0.0, rank=rank)
            )
        return search_results

    async def get_collection_info(self) -> dict:
        """Gibt Statistiken zur Collection zurueck."""
        try:
            info = await self.client.get_collection(self.collection_name)
            return {
                "name": self.collection_name,
                "points_count": info.points_count,
                "status": info.status.value if hasattr(info.status, "value") else str(info.status),
            }
        except Exception as e:
            return {"error": str(e)}

    async def close(self) -> None:
        """Schliesst die Qdrant-Verbindung."""
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Qdrant-Verbindung geschlossen")

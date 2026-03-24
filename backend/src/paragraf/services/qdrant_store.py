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
        embed_batch_size = 32
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
        )

        return self._points_to_results(results)

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

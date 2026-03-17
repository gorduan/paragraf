"""Tests fuer den QdrantStore (Unit-Tests ohne laufende Qdrant-Instanz)."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from paragraf.models.law import SearchFilter
from paragraf.services.qdrant_store import (
    DENSE_VECTOR_NAME,
    SPARSE_VECTOR_NAME,
    QdrantStore,
)


class TestQdrantStore:
    """Unit-Tests fuer QdrantStore."""

    def test_init_defaults(self):
        store = QdrantStore()
        assert store.url == "http://localhost:6333"
        assert store.collection_name == "paragraf"
        assert store._client is None

    def test_client_property_raises_without_connect(self):
        store = QdrantStore()
        with pytest.raises(RuntimeError, match="Nicht verbunden"):
            _ = store.client

    @pytest.mark.asyncio
    async def test_upsert_empty_chunks(self):
        store = QdrantStore()
        count = await store.upsert_chunks([])
        assert count == 0

    @pytest.mark.asyncio
    async def test_upsert_without_embedding_raises(self):
        store = QdrantStore(embedding_service=None)
        store._client = AsyncMock()
        from paragraf.models.law import ChunkMetadata, LawChunk

        chunks = [
            LawChunk(
                id="test",
                text="Test",
                metadata=ChunkMetadata(gesetz="SGB IX", paragraph="\u00a7 1"),
            )
        ]
        with pytest.raises(RuntimeError, match="Kein EmbeddingService"):
            await store.upsert_chunks(chunks)

    def test_build_filter_none(self):
        store = QdrantStore()
        result = store._build_filter(None)
        assert result is None

    def test_build_filter_empty(self):
        store = QdrantStore()
        f = SearchFilter()
        result = store._build_filter(f)
        assert result is None

    def test_build_filter_gesetz(self):
        store = QdrantStore()
        f = SearchFilter(gesetz="SGB IX")
        result = store._build_filter(f)
        assert result is not None
        assert len(result.must) == 1
        assert result.must[0].key == "gesetz"

    def test_build_filter_multiple(self):
        store = QdrantStore()
        f = SearchFilter(
            gesetz="SGB IX", paragraph="\u00a7 152", abschnitt="Teil 3"
        )
        result = store._build_filter(f)
        assert result is not None
        assert len(result.must) == 3

    def test_build_filter_all_fields(self):
        store = QdrantStore()
        f = SearchFilter(
            gesetz="SGB IX",
            paragraph="\u00a7 152",
            abschnitt="Teil 3",
            chunk_typ="paragraph",
        )
        result = store._build_filter(f)
        assert result is not None
        assert len(result.must) == 4

    @pytest.mark.asyncio
    async def test_get_collection_info_error(self):
        store = QdrantStore()
        mock_client = AsyncMock()
        mock_client.get_collection.side_effect = Exception("Not found")
        store._client = mock_client
        info = await store.get_collection_info()
        assert "error" in info

    @pytest.mark.asyncio
    async def test_close_resets_client(self):
        store = QdrantStore()
        store._client = AsyncMock()
        await store.close()
        assert store._client is None

    @pytest.mark.asyncio
    async def test_close_noop_when_not_connected(self):
        store = QdrantStore()
        await store.close()
        assert store._client is None


class TestQdrantStoreConstants:
    """Tests fuer Konstanten."""

    def test_vector_names(self):
        assert DENSE_VECTOR_NAME == "dense"
        assert SPARSE_VECTOR_NAME == "sparse"

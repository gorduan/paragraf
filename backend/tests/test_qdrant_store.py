"""Tests fuer den QdrantStore (Unit-Tests ohne laufende Qdrant-Instanz)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from qdrant_client import models

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


class TestQdrantStoreSnapshots:
    """Tests fuer Snapshot-CRUD-Methoden."""

    @pytest.mark.asyncio
    async def test_create_snapshot(self):
        """create_snapshot() ruft client.create_snapshot auf und gibt den Namen zurueck."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_snapshot = MagicMock()
        mock_snapshot.name = "paragraf-2024-01-15.snapshot"
        store._client.create_snapshot.return_value = mock_snapshot

        result = await store.create_snapshot()

        store._client.create_snapshot.assert_called_once_with(
            collection_name="paragraf", wait=True
        )
        assert result == "paragraf-2024-01-15.snapshot"

    @pytest.mark.asyncio
    async def test_list_snapshots(self):
        """list_snapshots() ruft client.list_snapshots auf und gibt die Liste zurueck."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_snapshots = [MagicMock(name="snap1"), MagicMock(name="snap2")]
        store._client.list_snapshots.return_value = mock_snapshots

        result = await store.list_snapshots()

        store._client.list_snapshots.assert_called_once_with(
            collection_name="paragraf"
        )
        assert result == mock_snapshots

    @pytest.mark.asyncio
    async def test_restore_snapshot(self):
        """restore_snapshot() ruft client.recover_snapshot mit korrektem Pfad auf."""
        store = QdrantStore()
        store._client = AsyncMock()

        result = await store.restore_snapshot("snap.snapshot")

        store._client.recover_snapshot.assert_called_once_with(
            collection_name="paragraf",
            location="file:///qdrant/snapshots/paragraf/snap.snapshot",
            wait=True,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_delete_snapshot(self):
        """delete_snapshot() ruft client.delete_snapshot auf."""
        store = QdrantStore()
        store._client = AsyncMock()

        result = await store.delete_snapshot("snap.snapshot")

        store._client.delete_snapshot.assert_called_once_with(
            collection_name="paragraf",
            snapshot_name="snap.snapshot",
            wait=True,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_delete_oldest_snapshots_under_limit(self):
        """Wenn weniger Snapshots als max_count existieren, wird nichts geloescht."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_snapshots = [
            MagicMock(name="snap1", creation_time="2024-01-01"),
            MagicMock(name="snap2", creation_time="2024-01-02"),
        ]
        # MagicMock name attribute is special, set it via configure_mock
        mock_snapshots[0].configure_mock(name="snap1")
        mock_snapshots[1].configure_mock(name="snap2")
        store._client.list_snapshots.return_value = mock_snapshots

        result = await store.delete_oldest_snapshots(max_count=3)

        assert result == []
        store._client.delete_snapshot.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_oldest_snapshots_over_limit(self):
        """Wenn mehr Snapshots als max_count existieren, werden die aeltesten geloescht."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_snapshots = []
        for i in range(5):
            snap = MagicMock()
            snap.configure_mock(name=f"snap{i + 1}")
            snap.creation_time = f"2024-01-0{i + 1}"
            mock_snapshots.append(snap)
        store._client.list_snapshots.return_value = mock_snapshots

        result = await store.delete_oldest_snapshots(max_count=3)

        assert len(result) == 2
        assert "snap1" in result
        assert "snap2" in result
        assert store._client.delete_snapshot.call_count == 2


class TestQdrantStoreQuantization:
    """Tests fuer Scalar-Quantization und quantization-aware Search."""

    @pytest.mark.asyncio
    async def test_enable_scalar_quantization(self):
        """enable_scalar_quantization() ruft update_collection mit INT8-Quantization auf."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_collection = MagicMock()
        mock_collection.config.quantization_config = None
        store._client.get_collection.return_value = mock_collection

        await store.enable_scalar_quantization()

        store._client.update_collection.assert_called_once_with(
            collection_name="paragraf",
            quantization_config=models.ScalarQuantization(
                scalar=models.ScalarQuantizationConfig(
                    type=models.ScalarType.INT8,
                    quantile=0.99,
                    always_ram=True,
                ),
            ),
        )

    @pytest.mark.asyncio
    async def test_enable_quantization_idempotent(self):
        """Wenn Quantization bereits aktiv ist, wird update_collection nicht aufgerufen."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_collection = MagicMock()
        mock_collection.config.quantization_config = MagicMock()  # not None = already active
        store._client.get_collection.return_value = mock_collection

        await store.enable_scalar_quantization()

        store._client.update_collection.assert_not_called()

    @pytest.mark.asyncio
    async def test_hybrid_search_passes_quantization_params(self):
        """hybrid_search() uebergibt QuantizationSearchParams an query_points."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_embedding = MagicMock()
        mock_embedding.encode_query.return_value = ([0.1] * 1024, {"word": 0.5})
        store.embedding = mock_embedding

        from paragraf.services.embedding import EmbeddingService

        with patch.object(
            EmbeddingService, "sparse_to_qdrant", return_value=([1], [0.5])
        ):
            mock_response = MagicMock()
            mock_response.points = []
            store._client.query_points.return_value = mock_response

            await store.hybrid_search("test")

            call_kwargs = store._client.query_points.call_args.kwargs
            assert "search_params" in call_kwargs
            search_params = call_kwargs["search_params"]
            assert search_params.quantization.rescore is True
            assert search_params.quantization.oversampling == 1.5

    @pytest.mark.asyncio
    async def test_dense_search_passes_quantization_params(self):
        """dense_search() uebergibt QuantizationSearchParams an query_points."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_embedding = MagicMock()
        mock_embedding.encode_query.return_value = ([0.1] * 1024, {})
        store.embedding = mock_embedding

        mock_response = MagicMock()
        mock_response.points = []
        store._client.query_points.return_value = mock_response

        await store.dense_search("test")

        call_kwargs = store._client.query_points.call_args.kwargs
        assert "search_params" in call_kwargs
        search_params = call_kwargs["search_params"]
        assert search_params.quantization.rescore is True
        assert search_params.quantization.oversampling == 1.5

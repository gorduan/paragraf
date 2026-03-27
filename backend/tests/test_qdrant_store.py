"""Tests fuer den QdrantStore (Unit-Tests ohne laufende Qdrant-Instanz)."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from qdrant_client import models

from paragraf.models.law import SearchFilter
from paragraf.services.embedding import EmbeddingService
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


class TestQdrantStoreIndexes:
    """Tests fuer create_text_index und create_absatz_index."""

    @pytest.mark.asyncio
    async def test_create_text_index(self):
        """create_text_index() ruft create_payload_index mit TextIndexParams auf."""
        store = QdrantStore()
        store._client = AsyncMock()

        await store.create_text_index()

        store._client.create_payload_index.assert_called_once()
        call_kwargs = store._client.create_payload_index.call_args.kwargs
        assert call_kwargs["collection_name"] == "paragraf"
        assert call_kwargs["field_name"] == "text"
        assert call_kwargs["wait"] is True
        schema = call_kwargs["field_schema"]
        assert isinstance(schema, models.TextIndexParams)
        assert schema.tokenizer == models.TokenizerType.WORD
        assert schema.min_token_len == 2
        assert schema.max_token_len == 40
        assert schema.lowercase is True

    @pytest.mark.asyncio
    async def test_create_absatz_index(self):
        """create_absatz_index() ruft create_payload_index mit IntegerIndexParams auf."""
        store = QdrantStore()
        store._client = AsyncMock()

        await store.create_absatz_index()

        store._client.create_payload_index.assert_called_once()
        call_kwargs = store._client.create_payload_index.call_args.kwargs
        assert call_kwargs["collection_name"] == "paragraf"
        assert call_kwargs["field_name"] == "absatz"
        assert call_kwargs["wait"] is True
        schema = call_kwargs["field_schema"]
        assert isinstance(schema, models.IntegerIndexParams)
        assert schema.lookup is True
        assert schema.range is True


class TestBuildFilterRange:
    """Tests fuer _build_filter mit absatz Range-Parametern."""

    def test_absatz_von_and_bis(self):
        """absatz_von=1, absatz_bis=5 erzeugt Range(gte=1, lte=5) Bedingung."""
        store = QdrantStore()
        f = SearchFilter(absatz_von=1, absatz_bis=5)
        result = store._build_filter(f)
        assert result is not None
        # Should have Range on "absatz" + MatchValue on "chunk_typ" (D-05)
        keys = [c.key for c in result.must]
        assert "absatz" in keys
        assert "chunk_typ" in keys
        absatz_cond = [c for c in result.must if c.key == "absatz"][0]
        assert absatz_cond.range.gte == 1
        assert absatz_cond.range.lte == 5

    def test_absatz_von_adds_chunk_typ(self):
        """absatz_von setzt automatisch chunk_typ='absatz' (D-05)."""
        store = QdrantStore()
        f = SearchFilter(absatz_von=1)
        result = store._build_filter(f)
        assert result is not None
        chunk_typ_conds = [c for c in result.must if c.key == "chunk_typ"]
        assert len(chunk_typ_conds) == 1
        assert chunk_typ_conds[0].match.value == "absatz"

    def test_absatz_von_only_no_lte(self):
        """absatz_von=3, absatz_bis=None erzeugt Range(gte=3) ohne lte."""
        store = QdrantStore()
        f = SearchFilter(absatz_von=3)
        result = store._build_filter(f)
        absatz_cond = [c for c in result.must if c.key == "absatz"][0]
        assert absatz_cond.range.gte == 3
        assert absatz_cond.range.lte is None

    def test_explicit_chunk_typ_not_overridden(self):
        """Wenn chunk_typ explizit gesetzt ist, wird kein zweites chunk_typ hinzugefuegt."""
        store = QdrantStore()
        f = SearchFilter(absatz_von=1, absatz_bis=5, chunk_typ="paragraph")
        result = store._build_filter(f)
        chunk_typ_conds = [c for c in result.must if c.key == "chunk_typ"]
        # Only one chunk_typ condition (the explicit one)
        assert len(chunk_typ_conds) == 1
        assert chunk_typ_conds[0].match.value == "paragraph"


class TestQdrantStoreFulltext:
    """Tests fuer fulltext_search."""

    @pytest.mark.asyncio
    async def test_fulltext_search_with_sparse(self):
        """fulltext_search() ruft query_points mit MatchText und Sparse-Vektor auf."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_embedding = MagicMock()
        mock_embedding.encode_query.return_value = ([0.1] * 1024, {"word": 0.5})
        store.embedding = mock_embedding

        with patch.object(
            EmbeddingService, "sparse_to_qdrant", return_value=([1], [0.5])
        ):
            mock_response = MagicMock()
            mock_response.points = []
            store._client.query_points.return_value = mock_response

            results = await store.fulltext_search("Paragraph Test")

            assert results == []
            store._client.query_points.assert_called_once()
            call_kwargs = store._client.query_points.call_args.kwargs
            assert call_kwargs["using"] == SPARSE_VECTOR_NAME
            # Verify MatchText in filter
            query_filter = call_kwargs["query_filter"]
            text_conditions = [
                c for c in query_filter.must
                if hasattr(c, "match") and isinstance(getattr(c.match, "text", None), str)
            ]
            assert len(text_conditions) == 1
            assert text_conditions[0].key == "text"

    @pytest.mark.asyncio
    async def test_fulltext_search_with_filter(self):
        """fulltext_search() kombiniert MatchText mit zusaetzlichem SearchFilter."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_embedding = MagicMock()
        mock_embedding.encode_query.return_value = ([0.1] * 1024, {"word": 0.5})
        store.embedding = mock_embedding

        with patch.object(
            EmbeddingService, "sparse_to_qdrant", return_value=([1], [0.5])
        ):
            mock_response = MagicMock()
            mock_response.points = []
            store._client.query_points.return_value = mock_response

            await store.fulltext_search(
                "Test", search_filter=SearchFilter(gesetz="SGB IX")
            )

            call_kwargs = store._client.query_points.call_args.kwargs
            query_filter = call_kwargs["query_filter"]
            keys = [c.key for c in query_filter.must]
            assert "text" in keys
            assert "gesetz" in keys

    @pytest.mark.asyncio
    async def test_fulltext_search_fallback_scroll(self):
        """fulltext_search() faellt auf scroll zurueck wenn keine Sparse-Vektoren."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_embedding = MagicMock()
        mock_embedding.encode_query.return_value = ([0.1] * 1024, {})
        store.embedding = mock_embedding

        with patch.object(
            EmbeddingService, "sparse_to_qdrant", return_value=([], [])
        ):
            store._client.scroll.return_value = ([], None)

            results = await store.fulltext_search("Test")

            assert results == []
            store._client.scroll.assert_called_once()
            store._client.query_points.assert_not_called()

    @pytest.mark.asyncio
    async def test_fulltext_search_without_embedding_raises(self):
        """fulltext_search() ohne EmbeddingService wirft RuntimeError."""
        store = QdrantStore(embedding_service=None)
        store._client = AsyncMock()
        with pytest.raises(RuntimeError, match="Kein EmbeddingService"):
            await store.fulltext_search("Test")


class TestQdrantStoreRecommend:
    """Tests fuer die recommend() Methode."""

    @pytest.mark.asyncio
    async def test_recommend_calls_query_points_with_recommend_query(self):
        """recommend() ruft query_points mit RecommendQuery und AVERAGE_VECTOR auf."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = []
        store._client.query_points.return_value = mock_response

        await store.recommend(point_ids=["uuid-1"], limit=5)

        store._client.query_points.assert_called_once()
        call_kwargs = store._client.query_points.call_args.kwargs
        assert call_kwargs["using"] == DENSE_VECTOR_NAME
        assert call_kwargs["limit"] == 5
        assert call_kwargs["with_payload"] is True
        # Verify RecommendQuery
        query = call_kwargs["query"]
        assert isinstance(query, models.RecommendQuery)
        assert query.recommend.positive == ["uuid-1"]
        assert query.recommend.strategy == models.RecommendStrategy.AVERAGE_VECTOR

    @pytest.mark.asyncio
    async def test_recommend_exclude_same_law(self):
        """Wenn exclude_gesetz gesetzt ist, enthaelt der Filter must_not."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = []
        store._client.query_points.return_value = mock_response

        await store.recommend(point_ids=["uuid-1"], exclude_gesetz="SGB IX")

        call_kwargs = store._client.query_points.call_args.kwargs
        query_filter = call_kwargs["query_filter"]
        assert query_filter is not None
        assert len(query_filter.must_not) == 1
        assert query_filter.must_not[0].key == "gesetz"
        assert query_filter.must_not[0].match.value == "SGB IX"

    @pytest.mark.asyncio
    async def test_recommend_with_search_filter(self):
        """Wenn search_filter gesetzt ist, wird _build_filter aufgerufen und kombiniert."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = []
        store._client.query_points.return_value = mock_response

        await store.recommend(
            point_ids=["uuid-1"],
            search_filter=SearchFilter(gesetz="BGB"),
            exclude_gesetz="SGB IX",
        )

        call_kwargs = store._client.query_points.call_args.kwargs
        query_filter = call_kwargs["query_filter"]
        assert query_filter is not None
        # Must have must condition for gesetz=BGB
        assert any(c.key == "gesetz" and c.match.value == "BGB" for c in query_filter.must)
        # Must have must_not for SGB IX
        assert any(c.key == "gesetz" and c.match.value == "SGB IX" for c in query_filter.must_not)

    @pytest.mark.asyncio
    async def test_recommend_quantization_params(self):
        """recommend() uebergibt QuantizationSearchParams an query_points."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = []
        store._client.query_points.return_value = mock_response

        await store.recommend(point_ids=["uuid-1"])

        call_kwargs = store._client.query_points.call_args.kwargs
        search_params = call_kwargs["search_params"]
        assert search_params.quantization.rescore is True
        assert search_params.quantization.oversampling == 1.5


class TestResolvePointId:
    """Tests fuer die _resolve_point_id() Methode."""

    @pytest.mark.asyncio
    async def test_resolve_point_id_found(self):
        """_resolve_point_id findet Record und gibt uuid5 des chunk_id zurueck."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_record = MagicMock()
        mock_record.payload = {"chunk_id": "SGB_IX_§152"}
        store._client.scroll.return_value = ([mock_record], None)

        result = await store._resolve_point_id(paragraph="§ 152", gesetz="SGB IX")

        expected = str(uuid.uuid5(uuid.NAMESPACE_URL, "SGB_IX_§152"))
        assert result == expected
        store._client.scroll.assert_called_once()
        call_kwargs = store._client.scroll.call_args.kwargs
        assert call_kwargs["limit"] == 1

    @pytest.mark.asyncio
    async def test_resolve_point_id_not_found(self):
        """_resolve_point_id gibt None zurueck wenn kein Record gefunden."""
        store = QdrantStore()
        store._client = AsyncMock()
        store._client.scroll.return_value = ([], None)

        result = await store._resolve_point_id(paragraph="§ 999", gesetz="UNKNOWN")

        assert result is None


class TestQdrantStoreScroll:
    """Tests fuer die scroll_search() Methode."""

    @pytest.mark.asyncio
    async def test_scroll_search_first_page(self):
        """scroll_search mit cursor=None ruft scroll mit offset=None auf."""
        store = QdrantStore()
        store._client = AsyncMock()
        mock_record = MagicMock()
        mock_record.payload = {
            "chunk_id": "test",
            "text": "Test text",
            "gesetz": "SGB IX",
            "paragraph": "§ 1",
            "titel": "Test",
            "abschnitt": "",
            "hierarchie_pfad": "",
            "norm_id": "",
            "stand": None,
            "quelle": "gesetze-im-internet.de",
            "chunk_typ": "paragraph",
            "absatz": None,
        }
        store._client.scroll.return_value = ([mock_record], "next-uuid")

        results, next_cursor = await store.scroll_search(
            search_filter=SearchFilter(gesetz="SGB IX"),
            limit=10,
            cursor=None,
        )

        assert next_cursor == "next-uuid"
        assert len(results) == 1
        call_kwargs = store._client.scroll.call_args.kwargs
        assert call_kwargs["offset"] is None
        assert call_kwargs["limit"] == 10

    @pytest.mark.asyncio
    async def test_scroll_search_with_cursor(self):
        """scroll_search mit cursor uebergibt diesen als offset."""
        store = QdrantStore()
        store._client = AsyncMock()
        store._client.scroll.return_value = ([], None)

        await store.scroll_search(cursor="some-uuid")

        call_kwargs = store._client.scroll.call_args.kwargs
        assert call_kwargs["offset"] == "some-uuid"

    @pytest.mark.asyncio
    async def test_scroll_search_last_page(self):
        """Wenn scroll next_offset=None zurueckgibt, ist next_cursor None."""
        store = QdrantStore()
        store._client = AsyncMock()
        store._client.scroll.return_value = ([], None)

        results, next_cursor = await store.scroll_search()

        assert next_cursor is None
        assert results == []

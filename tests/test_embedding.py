"""Tests fuer den Embedding-Service."""

from __future__ import annotations

import pytest

from paragraf.services.embedding import EmbeddingService


class TestEmbeddingService:
    """Tests fuer EmbeddingService ohne echtes Modell (Unit-Tests)."""

    def test_init_defaults(self):
        svc = EmbeddingService()
        assert svc.model_name == "BAAI/bge-m3"
        assert svc.device == "cpu"
        assert svc.use_fp16 is False
        assert svc.batch_size == 8
        assert svc.max_length == 512

    def test_cpu_forces_fp16_off(self):
        svc = EmbeddingService(device="cpu", use_fp16=True)
        assert svc.use_fp16 is False

    def test_gpu_allows_fp16(self):
        svc = EmbeddingService(device="cuda", use_fp16=True)
        assert svc.use_fp16 is True

    def test_dimension_bge_m3(self):
        svc = EmbeddingService(model_name="BAAI/bge-m3")
        assert svc.dimension == 1024

    def test_dimension_other_model(self):
        svc = EmbeddingService(model_name="some-other-model")
        assert svc.dimension == 768

    def test_encode_without_init_raises(self):
        svc = EmbeddingService()
        with pytest.raises(RuntimeError, match="nicht initialisiert"):
            svc.encode_dense(["test"])

    def test_encode_query_without_init_raises(self):
        svc = EmbeddingService()
        with pytest.raises(RuntimeError, match="nicht initialisiert"):
            svc.encode_query("test")

    def test_sparse_to_qdrant_empty(self):
        indices, values = EmbeddingService.sparse_to_qdrant({})
        assert indices == []
        assert values == []

    def test_sparse_to_qdrant_conversion(self):
        lexical_weights = {"101": 0.5, "202": 1.2, "303": 0.1}
        indices, values = EmbeddingService.sparse_to_qdrant(lexical_weights)
        assert len(indices) == 3
        assert len(values) == 3
        assert all(isinstance(i, int) for i in indices)
        assert all(isinstance(v, float) for v in values)
        assert 101 in indices
        assert 0.5 in values

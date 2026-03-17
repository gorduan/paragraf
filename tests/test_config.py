"""Tests fuer die Konfiguration."""

from __future__ import annotations

from pathlib import Path

from paragraf.config import Settings


class TestSettings:
    """Tests fuer die Pydantic-Settings-Konfiguration."""

    def test_defaults(self):
        s = Settings()
        assert s.qdrant_url == "http://localhost:6333"
        assert s.qdrant_collection == "paragraf"
        assert s.embedding_model == "BAAI/bge-m3"
        assert s.embedding_device == "cpu"
        assert s.embedding_batch_size == 8
        assert s.embedding_max_length == 512
        assert s.reranker_model == "BAAI/bge-reranker-v2-m3"
        assert s.reranker_top_k == 5
        assert s.retrieval_top_k == 20
        assert s.final_top_k == 5
        assert s.similarity_threshold == 0.35
        assert s.mcp_transport == "stdio"
        assert s.mcp_host == "0.0.0.0"
        assert s.mcp_port == 8000
        assert s.log_level == "INFO"

    def test_raw_dir(self):
        s = Settings(data_dir=Path("/tmp/test"))
        assert s.raw_dir == Path("/tmp/test/raw")

    def test_processed_dir(self):
        s = Settings(data_dir=Path("/tmp/test"))
        assert s.processed_dir == Path("/tmp/test/processed")

    def test_transport_literal(self):
        s = Settings(mcp_transport="streamable-http")
        assert s.mcp_transport == "streamable-http"

"""Paragraf MCP Server – Konfiguration via Pydantic Settings."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Zentrale Konfiguration – Werte aus .env oder Umgebungsvariablen."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Qdrant ──────────────────────────────────────────────
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "paragraf"

    # ── Embedding ───────────────────────────────────────────
    embedding_model: str = "BAAI/bge-m3"
    embedding_device: str = "cpu"
    embedding_batch_size: int = 8
    embedding_max_length: int = 512

    # ── Reranker ────────────────────────────────────────────
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    reranker_top_k: int = 5

    # ── RAG Pipeline ────────────────────────────────────────
    retrieval_top_k: int = 20
    final_top_k: int = 5
    similarity_threshold: float = 0.35

    # ── Server ──────────────────────────────────────────────
    mcp_transport: Literal["stdio", "streamable-http"] = "stdio"
    mcp_host: str = "0.0.0.0"
    mcp_port: int = 8000

    # ── Logging ─────────────────────────────────────────────
    log_level: str = "INFO"

    # ── Daten ───────────────────────────────────────────────
    data_dir: Path = Path("./data")

    # ── Snapshots ─────────────────────────────────────────
    snapshot_max_count: int = 3

    # ── Recommend & Pagination ───────────────────────────────────
    batch_max_queries: int = 10
    scroll_page_size: int = 10
    recommend_default_limit: int = 10

    # ── Grouping & Discovery ─────────────────────────────────────
    group_size_default: int = 3
    group_max_groups: int = 10
    discovery_max_positive: int = 5
    discovery_max_negative: int = 5

    # ── Cross-References ─────────────────────────────────────────
    xref_resolution_strategy: Literal["filter", "precomputed"] = "filter"

    # ── Query Expansion ──────────────────────────────────────────
    query_expansion_strategy: Literal["append", "parallel"] = "append"
    query_expansion_enabled: bool = True
    synonyms_json_path: str = ""

    # ── Chunking ─────────────────────────────────────────────
    chunk_min_length_for_split: int = 800
    chunk_satz_min_length: int = 100

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def processed_dir(self) -> Path:
        return self.data_dir / "processed"


settings = Settings()

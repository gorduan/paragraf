"""Pydantic-Datenmodelle fuer Gesetze, Chunks und Suchergebnisse."""

from paragraf.models.law import (
    BESCHREIBUNGEN,
    EURLEX_LAWS,
    GESETZ_DOWNLOAD_SLUGS,
    LAW_REGISTRY,
    RECHTSGEBIETE,
    ChunkMetadata,
    GesetzInfo,
    LawChunk,
    LawDefinition,
    SearchFilter,
    SearchResult,
)

__all__ = [
    "BESCHREIBUNGEN",
    "EURLEX_LAWS",
    "GESETZ_DOWNLOAD_SLUGS",
    "LAW_REGISTRY",
    "LawDefinition",
    "RECHTSGEBIETE",
    "ChunkMetadata",
    "GesetzInfo",
    "LawChunk",
    "SearchFilter",
    "SearchResult",
]

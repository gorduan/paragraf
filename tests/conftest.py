"""Pytest-Konfiguration und shared Fixtures."""

from __future__ import annotations

from pathlib import Path

import pytest

from paragraf.models.law import ChunkMetadata, LawChunk, SearchResult


@pytest.fixture
def sample_chunk() -> LawChunk:
    """Ein Beispiel-LawChunk fuer Tests."""
    return LawChunk(
        id="SGB_IX_§152",
        text=(
            "§ 152 SGB IX – Feststellung der Behinderung\n\n"
            "Auf Antrag des behinderten Menschen..."
        ),
        metadata=ChunkMetadata(
            gesetz="SGB IX",
            paragraph="§ 152",
            absatz=None,
            titel="Feststellung der Behinderung, Ausweise",
            abschnitt="Teil 3 – Schwerbehindertenrecht",
            hierarchie_pfad="SGB IX > Teil 3 > § 152",
            norm_id="BJNR323410016BJNE015201126",
            quelle="gesetze-im-internet.de",
            chunk_typ="paragraph",
        ),
    )


@pytest.fixture
def sample_results() -> list[SearchResult]:
    """Beispiel-Suchergebnisse fuer Tests."""
    results = []
    for i in range(5):
        results.append(
            SearchResult(
                chunk=LawChunk(
                    id=f"SGB_IX_§{i+1}",
                    text=f"Testtext zu § {i+1} SGB IX",
                    metadata=ChunkMetadata(
                        gesetz="SGB IX",
                        paragraph=f"§ {i+1}",
                        titel=f"Titel {i+1}",
                    ),
                ),
                score=1.0 - i * 0.1,
                rank=i + 1,
            )
        )
    return results


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    """Temporaeres Datenverzeichnis."""
    raw = tmp_path / "raw"
    processed = tmp_path / "processed"
    raw.mkdir()
    processed.mkdir()
    return tmp_path

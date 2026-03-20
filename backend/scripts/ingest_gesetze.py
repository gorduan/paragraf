"""Standalone-Skript: Gesetze herunterladen, parsen und in Qdrant indexieren.

Kann unabhaengig vom MCP-Server ausgefuehrt werden:
    python scripts/ingest_gesetze.py
    python scripts/ingest_gesetze.py --gesetz "SGB IX"
    python scripts/ingest_gesetze.py --all
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Projekt-Root zum Path hinzufuegen
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from paragraf.config import settings
from paragraf.models.law import GESETZ_DOWNLOAD_SLUGS
from paragraf.services.embedding import EmbeddingService
from paragraf.services.parser import GesetzParser
from paragraf.services.qdrant_store import QdrantStore


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ingest")


async def ingest(gesetz: str | None = None) -> None:
    """Hauptfunktion fuer die Gesetzesindexierung."""

    # Services initialisieren
    logger.info("Initialisiere Services...")

    embedding = EmbeddingService(
        model_name=settings.embedding_model,
        device=settings.embedding_device,
        batch_size=settings.embedding_batch_size,
        max_length=settings.embedding_max_length,
    )
    await embedding.initialize()

    qdrant = QdrantStore(
        url=settings.qdrant_url,
        collection_name=settings.qdrant_collection,
        embedding_service=embedding,
    )
    await qdrant.connect()
    await qdrant.ensure_collection(vector_size=embedding.dimension)

    parser = GesetzParser(data_dir=settings.data_dir)

    # Gesetze auswaehlen
    if gesetz:
        slugs = {gesetz: GESETZ_DOWNLOAD_SLUGS[gesetz]}
    else:
        slugs = GESETZ_DOWNLOAD_SLUGS

    total_chunks = 0
    errors: list[str] = []

    for name, slug in slugs.items():
        logger.info("=== %s (%s) ===", name, slug)

        try:
            # Download
            path = await parser.download_gesetz(slug)
            logger.info("  Heruntergeladen: %s", path)

            # Parse
            chunks = parser.parse_zip(path)
            logger.info("  Geparst: %d Chunks", len(chunks))

            if not chunks:
                logger.warning("  Keine Chunks – ueberspringe")
                continue

            # Token-Statistik
            lengths = [len(c.text) for c in chunks]
            logger.info(
                "  Textlaengen: min=%d, max=%d, avg=%d Zeichen",
                min(lengths), max(lengths), sum(lengths) // len(lengths),
            )

            # Embedding + Upsert
            count = await qdrant.upsert_chunks(chunks)
            total_chunks += count
            logger.info("  In Qdrant: %d Chunks", count)

        except Exception as e:
            errors.append(f"{name}: {e}")
            logger.error("  FEHLER: %s", e)

    # Zusammenfassung
    logger.info("================================")
    logger.info("Indexierung abgeschlossen!")
    logger.info("  Gesamt-Chunks: %d", total_chunks)
    if errors:
        logger.warning("  Fehler: %d", len(errors))
        for e in errors:
            logger.warning("    - %s", e)

    # Collection-Info
    info = await qdrant.get_collection_info()
    logger.info("  Collection '%s': %s Punkte", info.get("name"), info.get("points_count"))

    await qdrant.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Gesetze in Qdrant indexieren")
    parser.add_argument(
        "--gesetz", "-g",
        type=str,
        default=None,
        help=f"Einzelnes Gesetzbuch, z.B. 'SGB IX'. Verfuegbar: {', '.join(GESETZ_DOWNLOAD_SLUGS)}",
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="Alle Gesetze indexieren",
    )
    args = parser.parse_args()

    if args.gesetz and args.gesetz not in GESETZ_DOWNLOAD_SLUGS:
        print(f"Unbekanntes Gesetzbuch: {args.gesetz}")
        print(f"Verfuegbar: {', '.join(GESETZ_DOWNLOAD_SLUGS)}")
        sys.exit(1)

    asyncio.run(ingest(args.gesetz))


if __name__ == "__main__":
    main()

"""Paragraf MCP Server – Hauptmodul mit Lifespan-Management."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from paragraf.config import settings
from paragraf.prompts import register_prompts
from paragraf.services.embedding import EmbeddingService
from paragraf.services.parser import GesetzParser
from paragraf.services.qdrant_store import QdrantStore
from paragraf.services.reranker import RerankerService
from paragraf.tools.ingest import register_ingest_tools
from paragraf.tools.lookup import register_lookup_tools
from paragraf.tools.search import register_search_tools

logger = logging.getLogger(__name__)


@dataclass
class AppContext:
    """Anwendungskontext – wird ueber Lifespan initialisiert und an Tools uebergeben."""

    embedding: EmbeddingService
    qdrant: QdrantStore
    reranker: RerankerService
    parser: GesetzParser
    data_dir: Path


@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    """Initialisiert alle Services beim Serverstart, raeumt beim Stop auf.

    Lifecycle:
    1. Embedding-Modell laden (bge-m3)
    2. Mit Qdrant verbinden, Collection sicherstellen
    3. Reranker laden (bge-reranker-v2-m3)
    4. Parser initialisieren
    """
    logger.info("=== Paragraf MCP Server startet ===")

    # Datenverzeichnisse anlegen
    data_dir = settings.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "raw").mkdir(exist_ok=True)
    (data_dir / "processed").mkdir(exist_ok=True)

    # 1. Embedding-Service
    embedding = EmbeddingService(
        model_name=settings.embedding_model,
        device=settings.embedding_device,
        use_fp16=settings.embedding_device != "cpu",
        batch_size=settings.embedding_batch_size,
        max_length=settings.embedding_max_length,
    )
    await embedding.initialize()

    # 2. Qdrant
    qdrant = QdrantStore(
        url=settings.qdrant_url,
        collection_name=settings.qdrant_collection,
        embedding_service=embedding,
    )
    await qdrant.connect()
    await qdrant.ensure_collection(vector_size=embedding.dimension)

    # 3. Reranker
    reranker = RerankerService(
        model_name=settings.reranker_model,
        device=settings.embedding_device,
        use_fp16=settings.embedding_device != "cpu",
        top_k=settings.reranker_top_k,
    )
    await reranker.initialize()

    # 4. Parser
    parser = GesetzParser(data_dir=data_dir)

    logger.info("=== Alle Services initialisiert ===")

    ctx = AppContext(
        embedding=embedding,
        qdrant=qdrant,
        reranker=reranker,
        parser=parser,
        data_dir=data_dir,
    )

    try:
        yield ctx
    finally:
        await qdrant.close()
        logger.info("=== Paragraf MCP Server gestoppt ===")


def create_server() -> FastMCP:
    """Erstellt und konfiguriert den MCP-Server."""

    # Logging konfigurieren
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    mcp = FastMCP(
        name="Paragraf",
        instructions=(
            "Du bist ein Assistent fuer deutsches Recht. "
            "Du gibst allgemeine Rechtsinformationen basierend auf deutschen Gesetzen "
            "(SGB I-XIV, BGG, AGG, VersMedV, EStG, KraftStG und weitere). "
            "Du bist KEIN Rechtsberater im Sinne des RDG. "
            "Du gibst KEINE individuelle Rechtsberatung und pruefst KEINE Einzelfaelle. "
            "Du verweist bei individuellen Fragen IMMER auf Rechtsanwaelte oder "
            "EUTB-Beratungsstellen (www.teilhabeberatung.de, Tel: 0800 11 10 111). "
            "Gib bei jeder Antwort die exakten Paragraphen-Referenzen an. "
            "Bei Anfragen zu Leichter Sprache: folge der DIN SPEC 33429."
        ),
        lifespan=app_lifespan,
    )

    # Tools registrieren
    register_search_tools(mcp)
    register_lookup_tools(mcp)
    register_ingest_tools(mcp)

    # Prompts registrieren
    register_prompts(mcp)

    return mcp

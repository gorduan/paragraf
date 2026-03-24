"""Cross-Encoder Reranker – BAAI/bge-reranker-v2-m3."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from paragraf.models.law import SearchResult

logger = logging.getLogger(__name__)


class RerankerService:
    """Cross-Encoder Reranker fuer praezises Re-Ranking nach Retrieval.

    Verwendet BAAI/bge-reranker-v2-m3 (multilingual, 568M Parameter).
    Der Cross-Encoder verarbeitet Query-Dokument-Paare gemeinsam durch
    alle Transformer-Layer -> deutlich feinere Relevanz-Scores als Bi-Encoder.
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-reranker-v2-m3",
        device: str = "cpu",
        use_fp16: bool = False,
        top_k: int = 5,
    ) -> None:
        self.model_name = model_name
        self.device = device
        self.use_fp16 = use_fp16 if device != "cpu" else False
        self.top_k = top_k
        self._reranker: Any = None

    def _load_model(self) -> None:
        """Synchrones Laden des Rerankers (wird in Thread ausgefuehrt)."""
        logger.info("Lade Reranker: %s", self.model_name)
        try:
            from FlagEmbedding import FlagReranker

            self._reranker = FlagReranker(
                self.model_name,
                use_fp16=self.use_fp16,
                device=self.device,
            )
            logger.info("Reranker geladen: %s", self.model_name)
        except ImportError:
            logger.warning("FlagEmbedding nicht installiert – Reranking deaktiviert")
            self._reranker = None

    async def initialize(self) -> None:
        """Laedt den Reranker in einem Thread (blockiert nicht die Event-Loop)."""
        if self._reranker is not None:
            return
        await asyncio.to_thread(self._load_model)

    def rerank(
        self,
        query: str,
        results: list[SearchResult],
        top_k: int | None = None,
    ) -> list[SearchResult]:
        """Rerankt Suchergebnisse mit Cross-Encoder.

        Args:
            query: Die Suchanfrage
            results: Vorherige Suchergebnisse
            top_k: Anzahl zurueckzugebender Ergebnisse (default: self.top_k)

        Returns:
            Re-gerankte Ergebnisse, sortiert nach neuem Score
        """
        if not results:
            return results

        k = top_k or self.top_k

        if self._reranker is None:
            logger.debug("Kein Reranker geladen – ueberspringe Reranking")
            return results[:k]

        # Query-Document-Paare
        pairs = [[query, r.chunk.text] for r in results]

        try:
            scores = self._reranker.compute_score(pairs, normalize=True)
        except Exception:
            logger.warning("Reranking fehlgeschlagen – Fallback auf Original-Reihenfolge", exc_info=True)
            return results[:k]

        # Scores koennen ein einzelner Float oder eine Liste sein
        if isinstance(scores, float):
            scores = [scores]

        # Scores zuordnen und sortieren
        scored_results = list(zip(results, scores, strict=False))
        scored_results.sort(key=lambda x: x[1], reverse=True)

        reranked = []
        for rank, (result, score) in enumerate(scored_results[:k], start=1):
            reranked.append(
                SearchResult(
                    chunk=result.chunk,
                    score=float(score),
                    rank=rank,
                )
            )

        return reranked

    async def arerank(
        self,
        query: str,
        results: list[SearchResult],
        top_k: int | None = None,
    ) -> list[SearchResult]:
        """Async-Wrapper: fuehrt synchrones Reranking im Thread-Executor aus,
        damit die asyncio Event-Loop nicht blockiert wird."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.rerank, query, results, top_k)


def long_context_reorder(results: list[SearchResult]) -> list[SearchResult]:
    """LongContextReorder – platziert relevanteste Chunks an Anfang und Ende.

    LLMs zeigen eine U-foermige Aufmerksamkeit: Informationen am Anfang und
    Ende des Kontexts werden besser verarbeitet als in der Mitte.
    Dieses Reordering minimiert den 'Lost in the Middle'-Effekt.

    Strategie: Abwechselnd von Anfang und Ende der sortierten Liste befuellen.
    """
    if len(results) <= 2:
        return results

    reordered = []
    left = 0
    right = len(results) - 1
    toggle = True

    while left <= right:
        if toggle:
            reordered.append(results[left])
            left += 1
        else:
            reordered.append(results[right])
            right -= 1
        toggle = not toggle

    # Raenge neu vergeben
    for i, r in enumerate(reordered):
        r.rank = i + 1

    return reordered

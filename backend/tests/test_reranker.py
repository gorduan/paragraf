"""Tests fuer den Reranker-Service."""

from __future__ import annotations

from paragraf.models.law import ChunkMetadata, LawChunk, SearchResult
from paragraf.services.reranker import RerankerService, long_context_reorder


def _make_result(rank: int, score: float, text: str = "text") -> SearchResult:
    """Erzeugt ein Test-SearchResult."""
    return SearchResult(
        chunk=LawChunk(
            id=f"test_{rank}",
            text=text,
            metadata=ChunkMetadata(
                gesetz="SGB IX",
                paragraph=f"§ {rank}",
            ),
        ),
        score=score,
        rank=rank,
    )


class TestRerankerService:
    """Tests fuer RerankerService ohne echtes Modell."""

    def test_init_defaults(self):
        svc = RerankerService()
        assert svc.model_name == "BAAI/bge-reranker-v2-m3"
        assert svc.top_k == 5

    def test_rerank_empty_results(self):
        svc = RerankerService()
        result = svc.rerank("query", [])
        assert result == []

    def test_rerank_without_model_returns_top_k(self):
        """Ohne geladenes Modell sollte rerank die Top-k Ergebnisse unveraendert zurueckgeben."""
        svc = RerankerService(top_k=2)
        results = [_make_result(i, 1.0 - i * 0.1) for i in range(5)]
        reranked = svc.rerank("query", results, top_k=2)
        assert len(reranked) == 2
        assert reranked[0].chunk.id == "test_0"

    def test_rerank_respects_custom_top_k(self):
        svc = RerankerService(top_k=5)
        results = [_make_result(i, 1.0 - i * 0.1) for i in range(10)]
        reranked = svc.rerank("query", results, top_k=3)
        assert len(reranked) == 3


class TestLongContextReorder:
    """Tests fuer die LongContextReorder-Funktion."""

    def test_empty_list(self):
        assert long_context_reorder([]) == []

    def test_single_item(self):
        results = [_make_result(1, 0.9)]
        reordered = long_context_reorder(results)
        assert len(reordered) == 1

    def test_two_items(self):
        results = [_make_result(1, 0.9), _make_result(2, 0.8)]
        reordered = long_context_reorder(results)
        assert len(reordered) == 2

    def test_reorder_alternates(self):
        """Die Ergebnisse sollten abwechselnd von Anfang und Ende platziert werden."""
        results = [_make_result(i, 1.0 - i * 0.1) for i in range(5)]
        reordered = long_context_reorder(results)
        assert len(reordered) == 5
        assert reordered[0].chunk.id == "test_0"
        assert reordered[1].chunk.id == "test_4"

    def test_reorder_preserves_all_items(self):
        results = [_make_result(i, 1.0 - i * 0.1) for i in range(7)]
        reordered = long_context_reorder(results)
        original_ids = {r.chunk.id for r in results}
        reordered_ids = {r.chunk.id for r in reordered}
        assert original_ids == reordered_ids

    def test_ranks_reassigned(self):
        results = [_make_result(i, 1.0 - i * 0.1) for i in range(4)]
        reordered = long_context_reorder(results)
        ranks = [r.rank for r in reordered]
        assert ranks == [1, 2, 3, 4]

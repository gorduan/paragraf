"""Tests fuer Multi-Hop Suche und zugehoerige API-Modelle."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from pydantic import ValidationError

from paragraf.api_models import MultiHopRequest, SearchRequest, SearchResponse
from paragraf.models.law import ChunkMetadata, LawChunk, SearchFilter, SearchResult
from paragraf.services.multi_hop import MultiHopService


def _make_search_result(
    gesetz: str = "SGB IX",
    paragraph: str = "152",
    titel: str = "Feststellung",
    text: str = "Testtext",
    score: float = 0.9,
) -> SearchResult:
    """Erstellt ein Mock-SearchResult fuer Tests."""
    chunk = LawChunk(
        id=f"{gesetz}_{paragraph}",
        text=text,
        metadata=ChunkMetadata(
            gesetz=gesetz,
            paragraph=paragraph,
            titel=titel,
            abschnitt="",
            hierarchie_pfad="",
            quelle="test",
            chunk_typ="paragraph",
        ),
    )
    return SearchResult(chunk=chunk, score=score, rank=0)


class TestMultiHopService:
    """Tests fuer die Grundfunktionalitaet des MultiHopService."""

    @pytest.fixture
    def mock_qdrant(self):
        qdrant = AsyncMock()
        qdrant.hybrid_search = AsyncMock(
            return_value=[
                _make_search_result("SGB IX", "152", "Feststellung"),
                _make_search_result("SGB IX", "153", "Ausweise"),
            ]
        )
        qdrant.get_outgoing_references = AsyncMock(return_value=[])
        return qdrant

    @pytest.fixture
    def mock_reranker(self):
        reranker = AsyncMock()
        reranker.arerank = AsyncMock(side_effect=lambda q, r, top_k: r[:top_k])
        return reranker

    @pytest.fixture
    def mock_expander(self):
        expander = MagicMock()
        expander.expand = MagicMock(return_value=("test erweitert", ["erweitert"]))
        return expander

    @pytest.fixture
    def service(self, mock_qdrant, mock_reranker, mock_expander):
        return MultiHopService(mock_qdrant, mock_reranker, mock_expander)

    @pytest.mark.asyncio
    async def test_returns_correct_structure(self, service):
        """search_with_hops gibt dict mit allen erforderlichen Keys zurueck."""
        result = await service.search_with_hops("test", tiefe=1)
        assert "query" in result
        assert "expanded_terms" in result
        assert "hops" in result
        assert "results" in result
        assert "total" in result
        assert "visited_paragraphs" in result

    @pytest.mark.asyncio
    async def test_hop_0_has_no_via_reference(self, service):
        """Ergebnisse aus Hop 0 haben via_reference=None."""
        result = await service.search_with_hops("test", tiefe=0)
        for r in result["results"]:
            if r["hop"] == 0:
                assert r["via_reference"] is None

    @pytest.mark.asyncio
    async def test_hop_1_has_via_reference(self, mock_qdrant, mock_reranker, mock_expander):
        """Ergebnisse aus Hop 1+ haben via_reference gesetzt."""
        mock_qdrant.get_outgoing_references = AsyncMock(
            return_value=[{"gesetz": "SGB IX", "paragraph": "153", "raw": "153 SGB IX"}]
        )
        # Return different result for reference search
        ref_result = _make_search_result("SGB IX", "153", "Ausweise", score=0.8)
        mock_qdrant.hybrid_search = AsyncMock(
            side_effect=[
                [_make_search_result("SGB IX", "152", "Feststellung")],
                [ref_result],
            ]
        )
        service = MultiHopService(mock_qdrant, mock_reranker, mock_expander)
        result = await service.search_with_hops("test", tiefe=1)
        hop_1_results = [r for r in result["results"] if r["hop"] == 1]
        assert len(hop_1_results) > 0
        for r in hop_1_results:
            assert r["via_reference"] is not None


class TestMultiHopCircular:
    """Tests fuer Erkennung zirkulaerer Querverweise."""

    @pytest.mark.asyncio
    async def test_circular_reference_detection(self):
        """Zirkulaere Referenzen A->B->A werden erkannt und nicht dupliziert."""
        qdrant = AsyncMock()
        reranker = AsyncMock()
        expander = MagicMock()
        expander.expand = MagicMock(return_value=("test", []))

        result_a = _make_search_result("SGB IX", "152", "A")
        result_b = _make_search_result("SGB IX", "153", "B")

        # Initial search returns A
        # Reference search for A returns ref to B
        # Reference search for B returns ref to A (circular!)
        qdrant.hybrid_search = AsyncMock(
            side_effect=[
                [result_a],          # initial search
                [result_b],          # search for ref B
                [result_a],          # search for ref A (should be skipped)
            ]
        )
        qdrant.get_outgoing_references = AsyncMock(
            side_effect=[
                [{"gesetz": "SGB IX", "paragraph": "153", "raw": "153 SGB IX"}],  # A -> B
                [{"gesetz": "SGB IX", "paragraph": "152", "raw": "152 SGB IX"}],  # B -> A
            ]
        )
        reranker.arerank = AsyncMock(side_effect=lambda q, r, top_k: r[:top_k])

        service = MultiHopService(qdrant, reranker, expander)
        result = await service.search_with_hops("test", tiefe=2, expand=False)

        # Both should be visited
        assert "SGB IX_152" in result["visited_paragraphs"]
        assert "SGB IX_153" in result["visited_paragraphs"]

        # No duplicates in results
        result_keys = [(r["gesetz"], r["paragraph"]) for r in result["results"]]
        assert len(result_keys) == len(set(result_keys))

    @pytest.mark.asyncio
    async def test_max_depth_respected(self):
        """Tiefe wird auf settings.multi_hop_max_depth begrenzt."""
        qdrant = AsyncMock()
        reranker = AsyncMock()
        expander = MagicMock()
        expander.expand = MagicMock(return_value=("test", []))

        qdrant.hybrid_search = AsyncMock(return_value=[_make_search_result()])
        qdrant.get_outgoing_references = AsyncMock(return_value=[])
        reranker.arerank = AsyncMock(side_effect=lambda q, r, top_k: r[:top_k])

        service = MultiHopService(qdrant, reranker, expander)
        result = await service.search_with_hops("test", tiefe=3, expand=False)
        assert result["hops"] <= 3


class TestExpandedTermsModel:
    """Tests fuer die API-Modell-Felder rund um Query Expansion."""

    def test_multi_hop_request_tiefe_valid(self):
        """MultiHopRequest akzeptiert tiefe 1-3."""
        req1 = MultiHopRequest(anfrage="test", tiefe=1)
        assert req1.tiefe == 1
        req3 = MultiHopRequest(anfrage="test", tiefe=3)
        assert req3.tiefe == 3

    def test_multi_hop_request_tiefe_0_rejected(self):
        """MultiHopRequest lehnt tiefe=0 ab."""
        with pytest.raises(ValidationError):
            MultiHopRequest(anfrage="test", tiefe=0)

    def test_multi_hop_request_tiefe_4_rejected(self):
        """MultiHopRequest lehnt tiefe=4 ab."""
        with pytest.raises(ValidationError):
            MultiHopRequest(anfrage="test", tiefe=4)

    def test_search_request_expand_default(self):
        """SearchRequest hat expand-Feld mit Default True."""
        req = SearchRequest(anfrage="test")
        assert req.expand is True

    def test_search_response_expanded_terms_default(self):
        """SearchResponse hat expanded_terms-Feld mit Default leere Liste."""
        resp = SearchResponse(query="test", results=[], total=0)
        assert resp.expanded_terms == []

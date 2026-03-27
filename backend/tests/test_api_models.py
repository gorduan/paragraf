"""Tests fuer Recommend & Pagination und Grouping & Discovery Pydantic-Modelle."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from paragraf.api_models import (
    BatchSearchRequest,
    BatchSearchResponse,
    DiscoverRequest,
    DiscoverResponse,
    GroupedRecommendRequest,
    GroupedRecommendResponse,
    GroupedResultGroup,
    GroupedSearchRequest,
    GroupedSearchResponse,
    LookupRequest,
    RecommendRequest,
    RecommendResponse,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
)


class TestRecommendRequest:
    def test_defaults(self):
        req = RecommendRequest()
        assert req.point_ids is None
        assert req.limit == 10
        assert req.exclude_same_law is True

    def test_point_ids_max_5(self):
        with pytest.raises(ValidationError):
            RecommendRequest(point_ids=["a", "b", "c", "d", "e", "f"])

    def test_point_ids_min_1(self):
        with pytest.raises(ValidationError):
            RecommendRequest(point_ids=[])

    def test_limit_range(self):
        with pytest.raises(ValidationError):
            RecommendRequest(limit=0)
        with pytest.raises(ValidationError):
            RecommendRequest(limit=51)

    def test_alternative_input(self):
        req = RecommendRequest(paragraph="§ 152", gesetz="SGB IX")
        assert req.paragraph == "§ 152"
        assert req.gesetz == "SGB IX"


class TestBatchSearchRequest:
    def test_max_queries(self):
        queries = [SearchRequest(anfrage=f"q{i}") for i in range(11)]
        with pytest.raises(ValidationError):
            BatchSearchRequest(queries=queries)

    def test_min_queries(self):
        with pytest.raises(ValidationError):
            BatchSearchRequest(queries=[])

    def test_valid(self):
        req = BatchSearchRequest(queries=[SearchRequest(anfrage="test")])
        assert len(req.queries) == 1


class TestSearchRequestPagination:
    def test_cursor_default_none(self):
        req = SearchRequest(anfrage="test")
        assert req.cursor is None

    def test_page_size_default(self):
        req = SearchRequest(anfrage="test")
        assert req.page_size == 10

    def test_page_size_range(self):
        with pytest.raises(ValidationError):
            SearchRequest(anfrage="test", page_size=0)
        with pytest.raises(ValidationError):
            SearchRequest(anfrage="test", page_size=101)


class TestSearchResponsePagination:
    def test_next_cursor_default_none(self):
        resp = SearchResponse(query="test", results=[], total=0)
        assert resp.next_cursor is None


# ── Grouping & Discovery Tests ──────────────────────────────────────────────


class TestGroupedSearchRequest:
    def test_defaults(self):
        req = GroupedSearchRequest(anfrage="test")
        assert req.group_size == 3
        assert req.max_groups == 10
        assert req.search_type == "semantic"
        assert req.gesetzbuch is None
        assert req.abschnitt is None

    def test_group_size_range(self):
        with pytest.raises(ValidationError):
            GroupedSearchRequest(anfrage="test", group_size=0)
        with pytest.raises(ValidationError):
            GroupedSearchRequest(anfrage="test", group_size=11)

    def test_max_groups_range(self):
        with pytest.raises(ValidationError):
            GroupedSearchRequest(anfrage="test", max_groups=0)
        with pytest.raises(ValidationError):
            GroupedSearchRequest(anfrage="test", max_groups=21)

    def test_anfrage_required(self):
        with pytest.raises(ValidationError):
            GroupedSearchRequest()


class TestDiscoverRequest:
    def test_valid_with_positive_ids(self):
        req = DiscoverRequest(positive_ids=["id1", "id2"])
        assert req.positive_ids == ["id1", "id2"]
        assert req.limit == 10

    def test_valid_with_positive_paragraphs(self):
        req = DiscoverRequest(
            positive_paragraphs=[LookupRequest(gesetz="SGB IX", paragraph="§ 1")]
        )
        assert len(req.positive_paragraphs) == 1

    def test_max_length_positive_ids(self):
        with pytest.raises(ValidationError):
            DiscoverRequest(positive_ids=["a", "b", "c", "d", "e", "f"])

    def test_max_length_negative_ids(self):
        with pytest.raises(ValidationError):
            DiscoverRequest(negative_ids=["a", "b", "c", "d", "e", "f"])

    def test_limit_range(self):
        with pytest.raises(ValidationError):
            DiscoverRequest(limit=0)
        with pytest.raises(ValidationError):
            DiscoverRequest(limit=51)


class TestGroupedRecommendRequest:
    def test_valid_with_point_ids(self):
        req = GroupedRecommendRequest(point_ids=["id-1"], group_size=5, max_groups=15)
        assert req.point_ids == ["id-1"]
        assert req.group_size == 5
        assert req.max_groups == 15

    def test_defaults(self):
        req = GroupedRecommendRequest()
        assert req.group_size == 3
        assert req.max_groups == 10
        assert req.exclude_same_law is True

    def test_group_size_range(self):
        with pytest.raises(ValidationError):
            GroupedRecommendRequest(group_size=0)
        with pytest.raises(ValidationError):
            GroupedRecommendRequest(group_size=11)

    def test_max_groups_range(self):
        with pytest.raises(ValidationError):
            GroupedRecommendRequest(max_groups=0)
        with pytest.raises(ValidationError):
            GroupedRecommendRequest(max_groups=21)


class TestGroupedResponses:
    def test_grouped_result_group(self):
        item = SearchResultItem(
            paragraph="§ 1", gesetz="SGB IX", titel="Test", text="text", score=0.9
        )
        group = GroupedResultGroup(gesetz="SGB IX", results=[item], total=1)
        assert group.gesetz == "SGB IX"
        assert len(group.results) == 1
        assert group.total == 1

    def test_grouped_search_response(self):
        resp = GroupedSearchResponse(query="test", groups=[], total_groups=0)
        assert resp.query == "test"
        assert resp.groups == []
        assert resp.total_groups == 0
        assert "Rechtsberatung" in resp.disclaimer

    def test_discover_response(self):
        resp = DiscoverResponse(
            positive_ids=["id1"], negative_ids=["id2"], results=[], total=0
        )
        assert resp.positive_ids == ["id1"]
        assert resp.negative_ids == ["id2"]
        assert "Rechtsberatung" in resp.disclaimer

    def test_grouped_recommend_response(self):
        resp = GroupedRecommendResponse(
            source_ids=["id1"], groups=[], total_groups=0
        )
        assert resp.source_ids == ["id1"]
        assert resp.total_groups == 0
        assert "Rechtsberatung" in resp.disclaimer

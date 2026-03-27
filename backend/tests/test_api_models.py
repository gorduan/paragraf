"""Tests fuer Recommend & Pagination Pydantic-Modelle."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from paragraf.api_models import (
    BatchSearchRequest,
    BatchSearchResponse,
    RecommendRequest,
    RecommendResponse,
    SearchRequest,
    SearchResponse,
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

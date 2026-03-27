"""Tests fuer paragraf_grouped_search und paragraf_similar_grouped MCP-Tools."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from paragraf.models.law import ChunkMetadata, LawChunk, SearchFilter, SearchResult
from paragraf.tools.grouped_search import register_grouped_search_tools


@dataclass
class MockAppContext:
    qdrant: AsyncMock
    reranker: AsyncMock
    embedding: AsyncMock
    parser: MagicMock
    data_dir: Path = field(default_factory=lambda: Path("/tmp"))
    _initialized: bool = True

    async def ensure_ready(self) -> None:
        pass


def _make_result(paragraph: str, gesetz: str, text: str, score: float = 0.8) -> SearchResult:
    return SearchResult(
        chunk=LawChunk(
            id=f"{gesetz}_{paragraph}",
            text=text,
            metadata=ChunkMetadata(gesetz=gesetz, paragraph=paragraph, titel="Test"),
        ),
        score=score,
        rank=1,
    )


def _make_mcp_and_tools():
    """Creates mock MCP server and registers grouped search tools."""
    mcp = MagicMock()
    tools = {}

    def mock_tool():
        def decorator(fn):
            tools[fn.__name__] = fn
            return fn
        return decorator

    mcp.tool = mock_tool
    register_grouped_search_tools(mcp)
    return tools


def _make_ctx(app: MockAppContext):
    ctx = AsyncMock()
    ctx.request_context.lifespan_context = app
    ctx.info = AsyncMock()
    ctx.report_progress = AsyncMock()
    return ctx


class TestParagrafGroupedSearch:
    @pytest.fixture
    def tools(self):
        return _make_mcp_and_tools()

    @pytest.fixture
    def app(self):
        return MockAppContext(
            qdrant=AsyncMock(),
            reranker=AsyncMock(),
            embedding=AsyncMock(),
            parser=MagicMock(),
        )

    @pytest.mark.asyncio
    async def test_grouped_search_calls_qdrant(self, tools, app):
        """Gruppierte Suche ruft qdrant.grouped_search mit korrekten Parametern auf."""
        app.qdrant.grouped_search = AsyncMock(return_value=[
            ("SGB IX", [_make_result("§ 152", "SGB IX", "Schwerbehinderung")]),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_grouped_search"](ctx, anfrage="Behinderung")
        assert "SGB IX" in result
        assert "§ 152" in result
        app.qdrant.grouped_search.assert_called_once()
        call_kwargs = app.qdrant.grouped_search.call_args.kwargs
        assert call_kwargs["query"] == "Behinderung"

    @pytest.mark.asyncio
    async def test_grouped_search_custom_params(self, tools, app):
        """Benutzerdefinierte group_size und max_groups werden weitergegeben."""
        app.qdrant.grouped_search = AsyncMock(return_value=[])
        ctx = _make_ctx(app)

        await tools["paragraf_grouped_search"](
            ctx, anfrage="Test", group_size=5, max_groups=15,
        )
        call_kwargs = app.qdrant.grouped_search.call_args.kwargs
        assert call_kwargs["group_size"] == 5
        assert call_kwargs["max_groups"] == 15

    @pytest.mark.asyncio
    async def test_grouped_search_no_results(self, tools, app):
        """Leere Ergebnisse geben entsprechende Nachricht zurueck."""
        app.qdrant.grouped_search = AsyncMock(return_value=[])
        ctx = _make_ctx(app)

        result = await tools["paragraf_grouped_search"](ctx, anfrage="Nichts")
        assert "Keine Ergebnisse" in result

    @pytest.mark.asyncio
    async def test_grouped_search_returns_disclaimer(self, tools, app):
        """Ergebnisse enthalten RDG-Disclaimer."""
        app.qdrant.grouped_search = AsyncMock(return_value=[
            ("BGB", [_make_result("§ 1", "BGB", "Rechtssubjekt")]),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_grouped_search"](ctx, anfrage="Test")
        assert "Hinweis" in result
        assert "Rechtsberatung" in result


class TestParagrafSimilarGrouped:
    @pytest.fixture
    def tools(self):
        return _make_mcp_and_tools()

    @pytest.fixture
    def app(self):
        return MockAppContext(
            qdrant=AsyncMock(),
            reranker=AsyncMock(),
            embedding=AsyncMock(),
            parser=MagicMock(),
        )

    @pytest.mark.asyncio
    async def test_similar_grouped_with_punkt_id(self, tools, app):
        """punkt_id wird direkt an grouped_recommend weitergegeben."""
        app.qdrant.grouped_recommend = AsyncMock(return_value=[
            ("BGB", [_make_result("§ 1", "BGB", "Rechtssubjekt")]),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar_grouped"](
            ctx, punkt_id="some-uuid-1234",
        )
        assert "BGB" in result
        app.qdrant.grouped_recommend.assert_called_once()
        call_kwargs = app.qdrant.grouped_recommend.call_args.kwargs
        assert call_kwargs["point_ids"] == ["some-uuid-1234"]

    @pytest.mark.asyncio
    async def test_similar_grouped_with_paragraph_gesetz(self, tools, app):
        """paragraph+gesetz wird zuerst aufgeloest, dann an grouped_recommend weitergegeben."""
        app.qdrant._resolve_point_id = AsyncMock(return_value="resolved-id")
        app.qdrant.grouped_recommend = AsyncMock(return_value=[
            ("BGB", [_make_result("§ 1", "BGB", "Rechtssubjekt")]),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar_grouped"](
            ctx, paragraph="§ 152", gesetz="SGB IX",
        )
        assert "BGB" in result
        app.qdrant._resolve_point_id.assert_called_once_with("§ 152", "SGB IX")
        app.qdrant.grouped_recommend.assert_called_once()

    @pytest.mark.asyncio
    async def test_similar_grouped_no_input_returns_error(self, tools, app):
        """Ohne punkt_id und ohne paragraph gibt Fehlermeldung zurueck."""
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar_grouped"](ctx)
        assert "punkt_id" in result
        assert "paragraph" in result

    @pytest.mark.asyncio
    async def test_similar_grouped_exclude_gesetz(self, tools, app):
        """gleiches_gesetz_ausschliessen setzt exclude_gesetz korrekt."""
        app.qdrant._resolve_point_id = AsyncMock(return_value="resolved-id")
        app.qdrant.grouped_recommend = AsyncMock(return_value=[])
        ctx = _make_ctx(app)

        await tools["paragraf_similar_grouped"](
            ctx,
            paragraph="§ 152",
            gesetz="SGB IX",
            gleiches_gesetz_ausschliessen=True,
        )
        call_kwargs = app.qdrant.grouped_recommend.call_args.kwargs
        assert call_kwargs["exclude_gesetz"] == "SGB IX"

    @pytest.mark.asyncio
    async def test_similar_grouped_not_found(self, tools, app):
        """Nicht-aufloesbare Paragraphen geben Fehlermeldung zurueck."""
        app.qdrant._resolve_point_id = AsyncMock(return_value=None)
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar_grouped"](
            ctx, paragraph="§ 999", gesetz="SGB IX",
        )
        assert "nicht in der Datenbank gefunden" in result

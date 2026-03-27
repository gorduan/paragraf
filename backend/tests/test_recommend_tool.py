"""Tests fuer das paragraf_similar MCP-Tool."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from paragraf.models.law import ChunkMetadata, LawChunk, SearchFilter, SearchResult
from paragraf.tools.recommend import register_recommend_tools


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


def _make_mcp_and_tool():
    """Creates mock MCP server and registers recommend tools."""
    mcp = MagicMock()
    tools = {}

    def mock_tool():
        def decorator(fn):
            tools[fn.__name__] = fn
            return fn
        return decorator

    mcp.tool = mock_tool
    register_recommend_tools(mcp)
    return tools


def _make_ctx(app: MockAppContext):
    ctx = AsyncMock()
    ctx.request_context.lifespan_context = app
    ctx.info = AsyncMock()
    ctx.report_progress = AsyncMock()
    return ctx


class TestParagrafSimilar:
    @pytest.fixture
    def tools(self):
        return _make_mcp_and_tool()

    @pytest.fixture
    def app(self):
        return MockAppContext(
            qdrant=AsyncMock(),
            reranker=AsyncMock(),
            embedding=AsyncMock(),
            parser=MagicMock(),
        )

    @pytest.mark.asyncio
    async def test_with_punkt_id(self, tools, app):
        app.qdrant.recommend = AsyncMock(return_value=[
            _make_result("§ 35a", "SGB VIII", "Eingliederungshilfe"),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar"](ctx, punkt_id="some-uuid-123")
        assert "§ 35a" in result
        assert "SGB VIII" in result
        assert "Eingliederungshilfe" in result
        assert "Hinweis" in result  # DISCLAIMER
        app.qdrant.recommend.assert_called_once()

    @pytest.mark.asyncio
    async def test_with_paragraph_gesetz(self, tools, app):
        app.qdrant._resolve_point_id = AsyncMock(return_value="resolved-uuid")
        app.qdrant.recommend = AsyncMock(return_value=[
            _make_result("§ 35a", "SGB VIII", "Eingliederungshilfe"),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar"](
            ctx, paragraph="§ 152", gesetz="SGB IX",
        )
        assert "§ 35a" in result
        app.qdrant._resolve_point_id.assert_called_once_with("§ 152", "SGB IX")
        # exclude_same_law should pass source_gesetz
        call_kwargs = app.qdrant.recommend.call_args
        assert call_kwargs.kwargs.get("exclude_gesetz") == "SGB IX"

    @pytest.mark.asyncio
    async def test_not_found(self, tools, app):
        app.qdrant._resolve_point_id = AsyncMock(return_value=None)
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar"](
            ctx, paragraph="§ 999", gesetz="SGB IX",
        )
        assert "nicht in der Datenbank gefunden" in result
        app.qdrant.recommend.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_results(self, tools, app):
        app.qdrant.recommend = AsyncMock(return_value=[])
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar"](ctx, punkt_id="some-uuid")
        assert "Keine aehnlichen Paragraphen" in result
        assert "Hinweis" in result  # DISCLAIMER

    @pytest.mark.asyncio
    async def test_missing_input(self, tools, app):
        ctx = _make_ctx(app)

        result = await tools["paragraf_similar"](ctx)
        assert "punkt_id" in result
        assert "paragraph" in result

    @pytest.mark.asyncio
    async def test_abschnitt_filter(self, tools, app):
        app.qdrant.recommend = AsyncMock(return_value=[])
        ctx = _make_ctx(app)

        await tools["paragraf_similar"](
            ctx, punkt_id="some-uuid", abschnitt="Teil 3",
        )
        call_kwargs = app.qdrant.recommend.call_args
        search_filter = call_kwargs.kwargs.get("search_filter")
        assert search_filter is not None
        assert search_filter.abschnitt == "Teil 3"

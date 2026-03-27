"""Tests fuer das paragraf_discover MCP-Tool."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from paragraf.models.law import ChunkMetadata, LawChunk, SearchFilter, SearchResult
from paragraf.tools.discover import register_discover_tools


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
    """Creates mock MCP server and registers discover tools."""
    mcp = MagicMock()
    tools = {}

    def mock_tool():
        def decorator(fn):
            tools[fn.__name__] = fn
            return fn
        return decorator

    mcp.tool = mock_tool
    register_discover_tools(mcp)
    return tools


def _make_ctx(app: MockAppContext):
    ctx = AsyncMock()
    ctx.request_context.lifespan_context = app
    ctx.info = AsyncMock()
    ctx.report_progress = AsyncMock()
    return ctx


class TestParagrafDiscover:
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
    async def test_discover_with_uuid_positives(self, tools, app):
        """UUID-Eingabe wird direkt als target_id verwendet."""
        uuid = "abcdef01-2345-6789-abcd-ef0123456789"
        app.qdrant.discover = AsyncMock(return_value=[
            _make_result("§ 152", "SGB IX", "Schwerbehinderung"),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_discover"](
            ctx, positiv_beispiele=[uuid],
        )
        assert "§ 152" in result
        assert "SGB IX" in result
        app.qdrant.discover.assert_called_once()
        call_kwargs = app.qdrant.discover.call_args.kwargs
        assert call_kwargs["target_id"] == uuid

    @pytest.mark.asyncio
    async def test_discover_with_paragraph_string(self, tools, app):
        """'§ 152 SGB IX' wird ueber _resolve_point_id aufgeloest."""
        app.qdrant._resolve_point_id = AsyncMock(return_value="resolved-uuid")
        app.qdrant.discover = AsyncMock(return_value=[
            _make_result("§ 35a", "SGB VIII", "Eingliederungshilfe"),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_discover"](
            ctx, positiv_beispiele=["§ 152 SGB IX"],
        )
        assert "§ 35a" in result
        app.qdrant._resolve_point_id.assert_called_once_with("§ 152", "SGB IX")

    @pytest.mark.asyncio
    async def test_discover_with_negatives_builds_context(self, tools, app):
        """Negative Beispiele erzeugen Context-Paare fuer Discovery."""
        id1 = "abcdef01-2345-6789-abcd-ef0123456789"
        id2 = "12345678-abcd-ef01-2345-6789abcdef01"
        id3 = "fedcba98-7654-3210-fedc-ba9876543210"

        app.qdrant.discover = AsyncMock(return_value=[
            _make_result("§ 1", "BGB", "Rechtssubjekt"),
        ])
        ctx = _make_ctx(app)

        await tools["paragraf_discover"](
            ctx,
            positiv_beispiele=[id1, id2],
            negativ_beispiele=[id3],
        )

        call_kwargs = app.qdrant.discover.call_args.kwargs
        assert call_kwargs["target_id"] == id1
        # id2 (remaining positive) paired with id3 (negative)
        assert (id2, id3) in call_kwargs["context_pairs"]

    @pytest.mark.asyncio
    async def test_discover_empty_positives_returns_error(self, tools, app):
        """Leere positiv_beispiele gibt Fehlermeldung zurueck."""
        ctx = _make_ctx(app)

        result = await tools["paragraf_discover"](ctx, positiv_beispiele=[])
        assert "Mindestens ein positives Beispiel" in result

    @pytest.mark.asyncio
    async def test_discover_returns_disclaimer(self, tools, app):
        """Ergebnisse enthalten RDG-Disclaimer."""
        uuid = "abcdef01-2345-6789-abcd-ef0123456789"
        app.qdrant.discover = AsyncMock(return_value=[
            _make_result("§ 1", "BGB", "Rechtssubjekt"),
        ])
        ctx = _make_ctx(app)

        result = await tools["paragraf_discover"](ctx, positiv_beispiele=[uuid])
        assert "Hinweis" in result
        assert "Rechtsberatung" in result

    @pytest.mark.asyncio
    async def test_discover_unresolvable_returns_error(self, tools, app):
        """Nicht-aufloesbare Paragraphen geben Fehlermeldung zurueck."""
        app.qdrant._resolve_point_id = AsyncMock(return_value=None)
        ctx = _make_ctx(app)

        result = await tools["paragraf_discover"](
            ctx, positiv_beispiele=["§ 999 BGB"],
        )
        assert "nicht in der Datenbank" in result

"""Tests fuer das paragraf_references MCP-Tool."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from paragraf.tools.references import register_reference_tools


SAMPLE_OUTGOING = [
    {
        "gesetz": "SGB IX",
        "paragraph": "§ 152",
        "absatz": 1,
        "raw": "§ 152 Abs. 1 SGB IX",
        "verified": True,
        "kontext": "gemaess",
    },
    {
        "gesetz": "GG",
        "paragraph": "Art. 3",
        "absatz": None,
        "raw": "Art. 3 GG",
        "verified": True,
        "kontext": None,
    },
]

SAMPLE_INCOMING = [
    {
        "gesetz": "SGB XII",
        "paragraph": "§ 41",
        "chunk_id": "SGB XII_§ 41_paragraph",
        "text_preview": "Die Leistungen nach § 5 SGB IX...",
    },
]


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


def _make_mcp_and_tools():
    """Creates mock MCP server and registers reference tools."""
    mcp = MagicMock()
    tools = {}

    def mock_tool():
        def decorator(fn):
            tools[fn.__name__] = fn
            return fn
        return decorator

    mcp.tool = mock_tool
    register_reference_tools(mcp)
    return tools


def _make_ctx(app: MockAppContext):
    ctx = AsyncMock()
    ctx.request_context.lifespan_context = app
    return ctx


class TestParagrafReferences:
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
    async def test_references_ausgehend_only(self, tools, app):
        """richtung=ausgehend ruft nur get_outgoing_references auf."""
        app.qdrant.get_outgoing_references = AsyncMock(return_value=SAMPLE_OUTGOING)
        app.qdrant.get_incoming_references = AsyncMock(return_value=[])
        app.qdrant.count_incoming_references = AsyncMock(return_value=0)
        ctx = _make_ctx(app)

        result = await tools["paragraf_references"](
            ctx, paragraph="§ 5", gesetz="SGB IX", richtung="ausgehend",
        )
        assert "Ausgehende" in result
        assert "§ 152 Abs. 1 SGB IX" in result
        assert "[verifiziert]" in result
        assert "(Kontext: gemaess)" in result
        app.qdrant.get_outgoing_references.assert_called_once()
        app.qdrant.get_incoming_references.assert_not_called()

    @pytest.mark.asyncio
    async def test_references_eingehend_only(self, tools, app):
        """richtung=eingehend ruft nur get_incoming_references auf."""
        app.qdrant.get_outgoing_references = AsyncMock(return_value=[])
        app.qdrant.get_incoming_references = AsyncMock(return_value=SAMPLE_INCOMING)
        app.qdrant.count_incoming_references = AsyncMock(return_value=1)
        ctx = _make_ctx(app)

        result = await tools["paragraf_references"](
            ctx, paragraph="§ 5", gesetz="SGB IX", richtung="eingehend",
        )
        assert "Eingehende" in result
        assert "§ 41" in result
        assert "SGB XII" in result
        app.qdrant.get_incoming_references.assert_called_once()
        app.qdrant.get_outgoing_references.assert_not_called()

    @pytest.mark.asyncio
    async def test_references_beide(self, tools, app):
        """richtung=beide ruft beide Methoden auf."""
        app.qdrant.get_outgoing_references = AsyncMock(return_value=SAMPLE_OUTGOING)
        app.qdrant.get_incoming_references = AsyncMock(return_value=SAMPLE_INCOMING)
        app.qdrant.count_incoming_references = AsyncMock(return_value=1)
        ctx = _make_ctx(app)

        result = await tools["paragraf_references"](
            ctx, paragraph="§ 5", gesetz="SGB IX", richtung="beide",
        )
        assert "Ausgehende" in result
        assert "Eingehende" in result
        app.qdrant.get_outgoing_references.assert_called_once()
        app.qdrant.get_incoming_references.assert_called_once()

    @pytest.mark.asyncio
    async def test_references_empty(self, tools, app):
        """Leere Ergebnisse zeigen 'Keine ... gefunden' Meldungen."""
        app.qdrant.get_outgoing_references = AsyncMock(return_value=[])
        app.qdrant.get_incoming_references = AsyncMock(return_value=[])
        app.qdrant.count_incoming_references = AsyncMock(return_value=0)
        ctx = _make_ctx(app)

        result = await tools["paragraf_references"](
            ctx, paragraph="§ 999", gesetz="BGB", richtung="beide",
        )
        assert "Keine ausgehenden Querverweise gefunden" in result
        assert "Keine eingehenden Querverweise gefunden" in result

    @pytest.mark.asyncio
    async def test_references_disclaimer(self, tools, app):
        """Ausgabe endet mit RDG-Disclaimer."""
        app.qdrant.get_outgoing_references = AsyncMock(return_value=[])
        app.qdrant.get_incoming_references = AsyncMock(return_value=[])
        app.qdrant.count_incoming_references = AsyncMock(return_value=0)
        ctx = _make_ctx(app)

        result = await tools["paragraf_references"](
            ctx, paragraph="§ 1", gesetz="BGB", richtung="beide",
        )
        assert "§ 2 RDG" in result

    @pytest.mark.asyncio
    async def test_references_incoming_count(self, tools, app):
        """Eingehende Querverweise zeigen Gesamtzahl an."""
        app.qdrant.get_incoming_references = AsyncMock(return_value=SAMPLE_INCOMING)
        app.qdrant.count_incoming_references = AsyncMock(return_value=42)
        ctx = _make_ctx(app)

        result = await tools["paragraf_references"](
            ctx, paragraph="§ 5", gesetz="SGB IX", richtung="eingehend",
        )
        assert "42 gesamt" in result

    @pytest.mark.asyncio
    async def test_references_max_ergebnisse_clamped(self, tools, app):
        """max_ergebnisse wird auf 1-50 begrenzt."""
        app.qdrant.get_outgoing_references = AsyncMock(return_value=[])
        app.qdrant.get_incoming_references = AsyncMock(return_value=[])
        app.qdrant.count_incoming_references = AsyncMock(return_value=0)
        ctx = _make_ctx(app)

        await tools["paragraf_references"](
            ctx, paragraph="§ 1", gesetz="BGB", richtung="eingehend",
            max_ergebnisse=100,
        )
        # get_incoming_references should be called with limit=50 (clamped)
        call_kwargs = app.qdrant.get_incoming_references.call_args.kwargs
        assert call_kwargs["limit"] == 50

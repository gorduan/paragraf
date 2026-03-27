"""Tests fuer das MCP Snapshot-Tool."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture
def mock_app_context():
    """Erstellt einen Mock-AppContext mit QdrantStore."""
    ctx = MagicMock()
    ctx.qdrant = AsyncMock()
    ctx.qdrant.create_snapshot = AsyncMock(return_value="paragraf-2024-01-01.snapshot")
    ctx.qdrant.list_snapshots = AsyncMock(return_value=[
        MagicMock(name="snap1.snapshot", creation_time="2024-01-01"),
        MagicMock(name="snap2.snapshot", creation_time="2024-01-02"),
    ])
    ctx.qdrant.restore_snapshot = AsyncMock(return_value=True)
    ctx.qdrant.delete_snapshot = AsyncMock(return_value=True)
    ctx.qdrant.delete_oldest_snapshots = AsyncMock(return_value=[])
    ctx.ensure_ready = AsyncMock()
    return ctx


@pytest.fixture
def snapshot_tool(mock_app_context):
    """Captures the registered paragraf_snapshot function."""
    from paragraf.tools.snapshot import register_snapshot_tools

    captured = {}
    mock_mcp = MagicMock()

    def capture_tool():
        def decorator(fn):
            captured["fn"] = fn
            return fn
        return decorator

    mock_mcp.tool = capture_tool
    register_snapshot_tools(mock_mcp)
    return captured["fn"]


@pytest.fixture
def mock_ctx(mock_app_context):
    """Erstellt einen Mock MCP Context."""
    ctx = MagicMock()
    ctx.request_context.lifespan_context = mock_app_context
    ctx.info = AsyncMock()
    return ctx


class TestSnapshotTool:
    """Tests fuer paragraf_snapshot MCP Tool."""

    async def test_snapshot_erstellen(self, snapshot_tool, mock_ctx):
        """Erstellen-Aktion gibt Snapshot-Namen zurueck."""
        result = await snapshot_tool(ctx=mock_ctx, aktion="erstellen")
        assert "paragraf-2024-01-01.snapshot" in result

    async def test_snapshot_auflisten(self, snapshot_tool, mock_ctx):
        """Auflisten-Aktion zeigt alle Snapshot-Namen."""
        result = await snapshot_tool(ctx=mock_ctx, aktion="auflisten")
        assert "snap1.snapshot" in result
        assert "snap2.snapshot" in result

    async def test_snapshot_wiederherstellen(self, snapshot_tool, mock_ctx, mock_app_context):
        """Wiederherstellen mit Name ruft restore_snapshot auf."""
        result = await snapshot_tool(ctx=mock_ctx, aktion="wiederherstellen", name="test.snapshot")
        mock_app_context.qdrant.restore_snapshot.assert_called_once_with("test.snapshot")
        assert "wiederhergestellt" in result

    async def test_snapshot_wiederherstellen_without_name(self, snapshot_tool, mock_ctx):
        """Wiederherstellen ohne Name gibt Fehlermeldung zurueck."""
        result = await snapshot_tool(ctx=mock_ctx, aktion="wiederherstellen", name=None)
        assert "Name" in result or "name" in result

    async def test_snapshot_loeschen(self, snapshot_tool, mock_ctx, mock_app_context):
        """Loeschen mit Name ruft delete_snapshot auf."""
        result = await snapshot_tool(ctx=mock_ctx, aktion="loeschen", name="test.snapshot")
        mock_app_context.qdrant.delete_snapshot.assert_called_once_with("test.snapshot")
        assert "geloescht" in result.lower() or "gelöscht" in result.lower()

    async def test_snapshot_invalid_action(self, snapshot_tool, mock_ctx):
        """Ungueltige Aktion gibt Fehlermeldung mit gueltige Aktionen zurueck."""
        result = await snapshot_tool(ctx=mock_ctx, aktion="invalid")
        assert "Unbekannte Aktion" in result

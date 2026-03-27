"""MCP Snapshot Tools -- Backup und Wiederherstellung der Qdrant-Collection."""
from __future__ import annotations

import logging

from mcp.server.fastmcp import Context, FastMCP

from paragraf.config import settings

logger = logging.getLogger(__name__)

VALID_ACTIONS = ("erstellen", "auflisten", "wiederherstellen", "loeschen")


def register_snapshot_tools(mcp: FastMCP) -> None:
    """Registriert Snapshot-Tools."""

    @mcp.tool()
    async def paragraf_snapshot(
        ctx: Context,
        aktion: str,
        name: str | None = None,
    ) -> str:
        """Verwaltet Snapshots der Qdrant-Collection fuer Backup und Wiederherstellung.

        Aktionen:
        - 'erstellen': Neuen Snapshot erstellen (automatisch benannt)
        - 'auflisten': Alle vorhandenen Snapshots anzeigen
        - 'wiederherstellen': Collection aus einem Snapshot wiederherstellen (name erforderlich)
        - 'loeschen': Einen Snapshot loeschen (name erforderlich)

        Args:
            aktion: Eine der Aktionen: erstellen, auflisten, wiederherstellen, loeschen
            name: Snapshot-Name (erforderlich fuer wiederherstellen und loeschen)

        Returns:
            Statusmeldung mit Ergebnis der Aktion.
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant

        if aktion == "erstellen":
            snapshot_name = await qdrant.create_snapshot()
            deleted = await qdrant.delete_oldest_snapshots(
                max_count=settings.snapshot_max_count,
            )
            result = f"Snapshot erstellt: {snapshot_name}"
            if deleted:
                result += f"\nAelteste Snapshots geloescht: {', '.join(deleted)}"
            return result

        elif aktion == "auflisten":
            snapshots = await qdrant.list_snapshots()
            if not snapshots:
                return "Keine Snapshots vorhanden."
            lines = ["## Vorhandene Snapshots\n"]
            for s in snapshots:
                time_str = str(s.creation_time) if s.creation_time else "unbekannt"
                lines.append(f"- **{s.name}** (erstellt: {time_str})")
            return "\n".join(lines)

        elif aktion == "wiederherstellen":
            if not name:
                return (
                    "Fehler: 'name' ist erforderlich fuer die Wiederherstellung. "
                    "Nutze 'auflisten' um verfuegbare Snapshots zu sehen."
                )
            await qdrant.restore_snapshot(name)
            return f"Collection aus Snapshot '{name}' wiederhergestellt."

        elif aktion == "loeschen":
            if not name:
                return (
                    "Fehler: 'name' ist erforderlich zum Loeschen. "
                    "Nutze 'auflisten' um verfuegbare Snapshots zu sehen."
                )
            await qdrant.delete_snapshot(name)
            return f"Snapshot '{name}' geloescht."

        else:
            return (
                f"Unbekannte Aktion: '{aktion}'. "
                f"Gueltige Aktionen: {', '.join(VALID_ACTIONS)}"
            )

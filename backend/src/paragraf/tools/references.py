"""MCP-Tool fuer Querverweis-Abfragen."""

from __future__ import annotations

import logging

from mcp.server.fastmcp import Context, FastMCP

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "\n\n---\n"
    "Hinweis: Diese Informationen dienen der allgemeinen Orientierung "
    "und stellen keine individuelle Rechtsberatung dar (§ 2 RDG)."
)


def register_reference_tools(mcp: FastMCP) -> None:
    """Registriert Querverweis-Tools am MCP-Server."""

    @mcp.tool()
    async def paragraf_references(
        ctx: Context,
        paragraph: str,
        gesetz: str,
        richtung: str = "beide",
        max_ergebnisse: int = 20,
    ) -> str:
        """Querverweise eines Paragraphen abrufen.

        Zeigt ausgehende Referenzen (was dieser Paragraph zitiert) und/oder
        eingehende Referenzen (was diesen Paragraphen zitiert).

        Args:
            paragraph: Paragraph-Bezeichnung, z.B. '§ 152' oder '§ 5'
            gesetz: Gesetzbuch-Abkuerzung, z.B. 'SGB IX', 'BGB', 'GG'
            richtung: 'ausgehend', 'eingehend', oder 'beide' (Standard: 'beide')
            max_ergebnisse: Maximale Ergebnisse pro Richtung (1-50, Standard: 20)
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()

        # Normalize paragraph input (add § if missing)
        if not paragraph.startswith("§") and not paragraph.startswith("Art"):
            paragraph = f"§ {paragraph}"

        max_ergebnisse = max(1, min(50, max_ergebnisse))
        parts: list[str] = [f"# Querverweise: {paragraph} {gesetz}\n"]

        if richtung in ("ausgehend", "beide"):
            outgoing = await app.qdrant.get_outgoing_references(gesetz, paragraph)
            parts.append(f"## Ausgehende Querverweise ({len(outgoing)})\n")
            if outgoing:
                for ref in outgoing[:max_ergebnisse]:
                    line = f"- {ref.get('raw', '')} "
                    if ref.get("verified"):
                        line += "[verifiziert]"
                    else:
                        line += "[nicht verifiziert]"
                    if ref.get("kontext"):
                        line += f" (Kontext: {ref['kontext']})"
                    parts.append(line)
            else:
                parts.append("Keine ausgehenden Querverweise gefunden.")

        if richtung in ("eingehend", "beide"):
            incoming = await app.qdrant.get_incoming_references(
                gesetz, paragraph, limit=max_ergebnisse
            )
            incoming_count = await app.qdrant.count_incoming_references(gesetz, paragraph)
            parts.append(f"\n## Eingehende Querverweise ({incoming_count} gesamt)\n")
            if incoming:
                for ref in incoming[:max_ergebnisse]:
                    parts.append(
                        f"- {ref.get('paragraph', '')} {ref.get('gesetz', '')}: "
                        f"{ref.get('text_preview', '')}"
                    )
                if incoming_count > max_ergebnisse:
                    parts.append(f"\n... und {incoming_count - max_ergebnisse} weitere")
            else:
                parts.append("Keine eingehenden Querverweise gefunden.")

        parts.append(DISCLAIMER)
        return "\n".join(parts)

"""MCP Recommend Tools -- Aehnliche Paragraphen finden."""

from __future__ import annotations

import logging

from mcp.server.fastmcp import Context, FastMCP

from paragraf.config import settings
from paragraf.models.law import SearchFilter

logger = logging.getLogger(__name__)

# RDG-Disclaimer (same as search.py)
DISCLAIMER = (
    "\n\n---\n"
    "\u26a0\ufe0f **Hinweis:** Dies ist eine allgemeine Rechtsinformation, keine Rechtsberatung "
    "im Sinne des Rechtsdienstleistungsgesetzes (RDG). Fuer eine individuelle Beratung "
    "wenden Sie sich bitte an eine Rechtsanwaeltin/einen Rechtsanwalt oder eine "
    "EUTB-Beratungsstelle (www.teilhabeberatung.de)."
)


def register_recommend_tools(mcp: FastMCP) -> None:
    """Registriert Recommend-Tools am MCP-Server."""

    @mcp.tool()
    async def paragraf_similar(
        ctx: Context,
        punkt_id: str | None = None,
        paragraph: str | None = None,
        gesetz: str | None = None,
        gesetzbuch: str | None = None,
        abschnitt: str | None = None,
        absatz_von: int | None = None,
        absatz_bis: int | None = None,
        max_ergebnisse: int = settings.recommend_default_limit,
        gleiches_gesetz_ausschliessen: bool = True,
    ) -> str:
        """Findet aehnliche Paragraphen zu einem gegebenen Paragraphen.

        Nutze dieses Tool um thematisch verwandte Paragraphen zu finden,
        z.B. "Was ist aehnlich wie § 152 SGB IX?". Gibt Paragraphen aus
        anderen Gesetzen zurueck, die aehnliche Themen behandeln.

        Args:
            punkt_id: Qdrant Point-ID (UUID-String). Alternative zu paragraph+gesetz.
            paragraph: Paragraph-Nummer, z.B. '§ 152'. Zusammen mit gesetz verwenden.
            gesetz: Gesetzbuch-Abkuerzung, z.B. 'SGB IX'. Zusammen mit paragraph verwenden.
            gesetzbuch: Optional: Ergebnisse auf ein Gesetzbuch einschraenken.
            abschnitt: Optional: Ergebnisse auf einen Abschnitt einschraenken.
            absatz_von: Optional: Minimum Absatz-Nummer (1-basiert).
            absatz_bis: Optional: Maximum Absatz-Nummer (1-basiert).
            max_ergebnisse: Anzahl aehnlicher Ergebnisse (1-20, Standard: 10).
            gleiches_gesetz_ausschliessen: Ergebnisse aus dem Quell-Gesetz
                ausschliessen (Standard: ja).

        Returns:
            Aehnliche Paragraphen mit Relevanz-Scores und RDG-Disclaimer.
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant

        max_ergebnisse = max(1, min(20, max_ergebnisse))

        # Per D-01: Resolve point ID from paragraph+gesetz if not provided
        point_ids: list[str] = []
        source_gesetz: str | None = None

        if punkt_id:
            point_ids = [punkt_id]
        elif paragraph and gesetz:
            resolved = await qdrant._resolve_point_id(paragraph, gesetz)
            if resolved is None:
                return (
                    f"Paragraph {paragraph} in {gesetz} nicht in der Datenbank gefunden.\n"
                    "Pruefen Sie die Schreibweise oder indexieren Sie das Gesetz zuerst."
                )
            point_ids = [resolved]
            source_gesetz = gesetz
        else:
            return (
                "Bitte geben Sie entweder eine punkt_id ODER paragraph+gesetz an.\n"
                "Beispiel: paragraph='§ 152', gesetz='SGB IX'"
            )

        await ctx.info(
            f"Suche aehnliche Paragraphen"
            + (f" zu {paragraph} {gesetz}" if paragraph else f" zu ID {punkt_id}")
        )

        # Per D-02: exclude_same_law
        exclude_gesetz_value: str | None = None
        if gleiches_gesetz_ausschliessen and source_gesetz:
            exclude_gesetz_value = source_gesetz

        # Per MCP-05 / D-13: Same filter params as paragraf_search
        search_filter = SearchFilter(
            gesetz=gesetzbuch,
            abschnitt=abschnitt,
            absatz_von=absatz_von,
            absatz_bis=absatz_bis,
        )

        await ctx.report_progress(progress=1, total=2)

        results = await qdrant.recommend(
            point_ids=point_ids,
            limit=max_ergebnisse,
            search_filter=search_filter,
            exclude_gesetz=exclude_gesetz_value,
        )

        await ctx.report_progress(progress=2, total=2)

        if not results:
            source_desc = f"{paragraph} {gesetz}" if paragraph else punkt_id
            return (
                f"Keine aehnlichen Paragraphen zu {source_desc} gefunden."
                + (f" (Filter: {gesetzbuch})" if gesetzbuch else "")
                + DISCLAIMER
            )

        # Format results (same pattern as tools/search.py)
        output = f"## Aehnliche Paragraphen"
        if paragraph and gesetz:
            output += f" zu {paragraph} {gesetz}"
        output += f"\n\n**{len(results)} Ergebnisse:**\n\n"

        for r in results:
            meta = r.chunk.metadata
            output += f"### {meta.paragraph} {meta.gesetz}"
            if meta.titel:
                output += f" – {meta.titel}"
            output += "\n"
            if meta.abschnitt:
                output += f"*Abschnitt: {meta.abschnitt}*\n"
            output += f"*Relevanz: {r.score:.4f}*\n\n"
            output += r.chunk.text + "\n\n"
            output += f"*Quelle: {meta.quelle}*\n\n---\n\n"

        output += DISCLAIMER
        return output

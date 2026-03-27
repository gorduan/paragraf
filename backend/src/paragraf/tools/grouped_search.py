"""MCP Grouped Search Tools -- Gruppierte Suche und Empfehlungen."""

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


def register_grouped_search_tools(mcp: FastMCP) -> None:
    """Registriert Grouped-Search-Tools am MCP-Server."""

    @mcp.tool()
    async def paragraf_grouped_search(
        ctx: Context,
        anfrage: str,
        gesetzbuch: str | None = None,
        abschnitt: str | None = None,
        group_size: int = settings.group_size_default,
        max_groups: int = settings.group_max_groups,
    ) -> str:
        """Sucht Paragraphen und gruppiert Ergebnisse nach Gesetz.

        Nutze dieses Tool wenn du einen Ueberblick ueber mehrere Gesetze
        zu einem Thema brauchst. Statt einer flachen Liste bekommst du
        Ergebnisse sortiert nach Gesetzbuch.

        Args:
            anfrage: Suchanfrage in natuerlicher Sprache.
            gesetzbuch: Optional: Ergebnisse auf ein Gesetzbuch einschraenken.
            abschnitt: Optional: Ergebnisse auf einen Abschnitt einschraenken.
            group_size: Ergebnisse pro Gesetz (1-10, Standard: 3).
            max_groups: Maximale Anzahl Gesetze (1-20, Standard: 10).

        Returns:
            Nach Gesetz gruppierte Suchergebnisse mit RDG-Disclaimer.
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant

        group_size = max(1, min(10, group_size))
        max_groups = max(1, min(20, max_groups))

        search_filter = SearchFilter(gesetz=gesetzbuch, abschnitt=abschnitt)

        await ctx.info(f"Gruppierte Suche: '{anfrage}'")
        await ctx.report_progress(progress=1, total=2)

        grouped = await qdrant.grouped_search(
            query=anfrage,
            group_size=group_size,
            max_groups=max_groups,
            search_filter=search_filter,
        )

        await ctx.report_progress(progress=2, total=2)

        if not grouped:
            return f"Keine Ergebnisse fuer '{anfrage}'." + DISCLAIMER

        output = f"## Gruppierte Suche: {anfrage}\n\n"
        output += f"**{len(grouped)} Gesetze gefunden:**\n\n"

        for gesetz, results in grouped:
            output += f"### {gesetz} ({len(results)} Treffer)\n\n"
            for r in results:
                meta = r.chunk.metadata
                output += f"**{meta.paragraph}**"
                if meta.titel:
                    output += f" – {meta.titel}"
                output += f" *(Relevanz: {r.score:.4f})*\n"
                output += r.chunk.text[:300]
                if len(r.chunk.text) > 300:
                    output += "..."
                output += "\n\n"
            output += "---\n\n"

        output += DISCLAIMER
        return output

    @mcp.tool()
    async def paragraf_similar_grouped(
        ctx: Context,
        punkt_id: str | None = None,
        paragraph: str | None = None,
        gesetz: str | None = None,
        gesetzbuch: str | None = None,
        abschnitt: str | None = None,
        absatz_von: int | None = None,
        absatz_bis: int | None = None,
        group_size: int = settings.group_size_default,
        max_groups: int = settings.group_max_groups,
        gleiches_gesetz_ausschliessen: bool = True,
    ) -> str:
        """Findet aehnliche Paragraphen, gruppiert nach Gesetz.

        Wie paragraf_similar, aber die Ergebnisse werden nach Gesetzbuch
        gruppiert zurueckgegeben. Ideal um zu sehen, welche Gesetze
        aehnliche Regelungen enthalten.

        Args:
            punkt_id: Qdrant Point-ID (UUID-String). Alternative zu paragraph+gesetz.
            paragraph: Paragraph-Nummer, z.B. '§ 152'. Zusammen mit gesetz verwenden.
            gesetz: Gesetzbuch-Abkuerzung, z.B. 'SGB IX'. Zusammen mit paragraph verwenden.
            gesetzbuch: Optional: Ergebnisse auf ein Gesetzbuch einschraenken.
            abschnitt: Optional: Ergebnisse auf einen Abschnitt einschraenken.
            absatz_von: Optional: Minimum Absatz-Nummer (1-basiert).
            absatz_bis: Optional: Maximum Absatz-Nummer (1-basiert).
            group_size: Ergebnisse pro Gesetz (1-10, Standard: 3).
            max_groups: Maximale Anzahl Gesetze (1-20, Standard: 10).
            gleiches_gesetz_ausschliessen: Quell-Gesetz ausschliessen (Standard: ja).

        Returns:
            Nach Gesetz gruppierte aehnliche Paragraphen mit RDG-Disclaimer.
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant

        group_size = max(1, min(10, group_size))
        max_groups = max(1, min(20, max_groups))

        # Resolve point ID (same pattern as paragraf_similar)
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
            "Gruppierte Empfehlungen"
            + (f" zu {paragraph} {gesetz}" if paragraph else f" zu ID {punkt_id}")
        )

        exclude_gesetz_value: str | None = None
        if gleiches_gesetz_ausschliessen and source_gesetz:
            exclude_gesetz_value = source_gesetz

        search_filter = SearchFilter(
            gesetz=gesetzbuch,
            abschnitt=abschnitt,
            absatz_von=absatz_von,
            absatz_bis=absatz_bis,
        )

        await ctx.report_progress(progress=1, total=2)

        grouped = await qdrant.grouped_recommend(
            point_ids=point_ids,
            group_size=group_size,
            max_groups=max_groups,
            search_filter=search_filter,
            exclude_gesetz=exclude_gesetz_value,
        )

        await ctx.report_progress(progress=2, total=2)

        if not grouped:
            source_desc = f"{paragraph} {gesetz}" if paragraph else punkt_id
            return (
                f"Keine gruppierten Empfehlungen zu {source_desc} gefunden." + DISCLAIMER
            )

        output = "## Gruppierte Empfehlungen"
        if paragraph and gesetz:
            output += f" zu {paragraph} {gesetz}"
        output += f"\n\n**{len(grouped)} Gesetze:**\n\n"

        for law, results in grouped:
            output += f"### {law} ({len(results)} Treffer)\n\n"
            for r in results:
                meta = r.chunk.metadata
                output += f"**{meta.paragraph}**"
                if meta.titel:
                    output += f" – {meta.titel}"
                output += f" *(Relevanz: {r.score:.4f})*\n"
                output += r.chunk.text[:300]
                if len(r.chunk.text) > 300:
                    output += "..."
                output += "\n\n"
            output += "---\n\n"

        output += DISCLAIMER
        return output

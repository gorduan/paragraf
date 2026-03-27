"""MCP Discovery Tools -- Explorative Suche mit Positiv/Negativ-Beispielen."""

from __future__ import annotations

import asyncio
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


def register_discover_tools(mcp: FastMCP) -> None:
    """Registriert Discovery-Tools am MCP-Server."""

    @mcp.tool()
    async def paragraf_discover(
        ctx: Context,
        positiv_beispiele: list[str],
        negativ_beispiele: list[str] | None = None,
        gesetzbuch: str | None = None,
        abschnitt: str | None = None,
        max_ergebnisse: int = 10,
    ) -> str:
        """Explorative Suche mit Positiv/Negativ-Beispielen.

        Nutze dieses Tool um den Rechtsraum zu erkunden: Gib Paragraphen an,
        die relevant sind (positiv) und solche, die irrelevant sind (negativ).
        Das Tool findet Paragraphen, die den positiven aehnlich und von den
        negativen verschieden sind.

        Args:
            positiv_beispiele: Liste von Punkt-IDs (UUID) oder 'paragraph gesetz'
                Strings (z.B. '§ 152 SGB IX'). Mindestens 1 erforderlich.
            negativ_beispiele: Liste von Punkt-IDs (UUID) oder 'paragraph gesetz'
                Strings (optional). Steuert, wovon sich Ergebnisse unterscheiden sollen.
            gesetzbuch: Optional: Ergebnisse auf ein Gesetzbuch einschraenken.
            abschnitt: Optional: Ergebnisse auf einen Abschnitt einschraenken.
            max_ergebnisse: Anzahl Ergebnisse (1-20, Standard: 10).

        Returns:
            Explorative Suchergebnisse mit Relevanz-Scores und RDG-Disclaimer.
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant

        max_ergebnisse = max(1, min(20, max_ergebnisse))

        # Resolve positive IDs (dual-input: UUID or "paragraph gesetz" string)
        positive_ids = await _resolve_examples(qdrant, positiv_beispiele)
        if isinstance(positive_ids, str):
            return positive_ids  # Error message

        if not positive_ids:
            return "Mindestens ein positives Beispiel erforderlich." + DISCLAIMER

        # Resolve negative IDs
        negative_ids: list[str] = []
        if negativ_beispiele:
            neg_result = await _resolve_examples(qdrant, negativ_beispiele)
            if isinstance(neg_result, str):
                return neg_result
            negative_ids = neg_result

        await ctx.info(
            f"Discovery-Suche mit {len(positive_ids)} positiven"
            + (
                f" und {len(negative_ids)} negativen Beispielen"
                if negative_ids
                else " Beispielen"
            )
        )

        # Build context pairs per Research Pattern 2
        target_id = positive_ids[0]
        context_pairs: list[tuple[str, str]] = []
        remaining_pos = positive_ids[1:]
        if negative_ids:
            for pos in remaining_pos:
                for neg in negative_ids:
                    context_pairs.append((pos, neg))
            if not remaining_pos:
                for neg in negative_ids:
                    context_pairs.append((target_id, neg))

        search_filter = SearchFilter(gesetz=gesetzbuch, abschnitt=abschnitt)

        await ctx.report_progress(progress=1, total=2)

        results = await qdrant.discover(
            target_id=target_id,
            context_pairs=context_pairs,
            limit=max_ergebnisse,
            search_filter=search_filter,
        )

        await ctx.report_progress(progress=2, total=2)

        if not results:
            return "Keine Ergebnisse fuer die Discovery-Suche gefunden." + DISCLAIMER

        output = "## Discovery-Ergebnisse\n\n"
        output += f"**{len(positive_ids)} positive, {len(negative_ids)} negative Beispiele**\n"
        output += f"**{len(results)} Ergebnisse:**\n\n"

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


async def _resolve_examples(qdrant, examples: list[str]) -> list[str] | str:
    """Loest eine Liste von Beispielen auf (UUID oder 'paragraph gesetz' String).

    Returns list of point IDs on success, or error message string on failure.
    """
    ids: list[str] = []
    resolve_tasks = []
    resolve_indices: list[tuple[int, str, str, str]] = []

    for i, example in enumerate(examples):
        example = example.strip()
        # Check if it looks like a UUID (contains dashes and is 36 chars)
        if len(example) == 36 and example.count("-") == 4:
            ids.append(example)
        else:
            # Parse "§ 152 SGB IX" or "paragraph gesetz" format
            if "§" in example:
                # "§ 152 SGB IX" -> paragraph="§ 152", gesetz="SGB IX"
                idx = example.index("§")
                rest = example[idx:]
                tokens = rest.split()
                if len(tokens) >= 3:
                    paragraph = " ".join(tokens[:2])  # "§ 152"
                    gesetz = " ".join(tokens[2:])  # "SGB IX"
                else:
                    return (
                        f"Ungueltig: '{example}'. Erwartet: UUID oder "
                        "'§ NR GESETZ' (z.B. '§ 152 SGB IX')."
                    )
            else:
                parts = example.rsplit(" ", 1)
                if len(parts) == 2:
                    paragraph, gesetz = parts[0].strip(), parts[1].strip()
                else:
                    return (
                        f"Ungueltig: '{example}'. Erwartet: UUID oder "
                        "'§ NR GESETZ' (z.B. '§ 152 SGB IX')."
                    )
            resolve_tasks.append(qdrant._resolve_point_id(paragraph, gesetz))
            resolve_indices.append((i, example, paragraph, gesetz))

    if resolve_tasks:
        # Per Pitfall 5: Resolve all IDs in parallel with asyncio.gather
        resolved = await asyncio.gather(*resolve_tasks)
        for (idx, orig, para, ges), rid in zip(resolve_indices, resolved):
            if rid is None:
                return f"Paragraph {para} in {ges} nicht in der Datenbank gefunden."
            ids.append(rid)

    return ids

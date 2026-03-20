"""MCP Search Tools – Semantische Suche in deutschen Gesetzen."""

from __future__ import annotations

import logging

from mcp.server.fastmcp import Context, FastMCP

from paragraf.config import settings
from paragraf.models.law import SearchFilter
from paragraf.services.reranker import long_context_reorder

logger = logging.getLogger(__name__)

# ── RDG-Disclaimer ──────────────────────────────────────────────────────────
DISCLAIMER = (
    "\n\n---\n"
    "⚠️ **Hinweis:** Dies ist eine allgemeine Rechtsinformation, keine Rechtsberatung "
    "im Sinne des Rechtsdienstleistungsgesetzes (RDG). Fuer eine individuelle Beratung "
    "wenden Sie sich bitte an eine Rechtsanwaeltin/einen Rechtsanwalt oder eine "
    "EUTB-Beratungsstelle (www.teilhabeberatung.de)."
)


def register_search_tools(mcp: FastMCP) -> None:
    """Registriert alle Such-Tools am MCP-Server."""

    @mcp.tool()
    async def paragraf_search(
        ctx: Context,
        anfrage: str,
        gesetzbuch: str | None = None,
        abschnitt: str | None = None,
        max_ergebnisse: int = settings.final_top_k,
    ) -> str:
        """Durchsucht deutsche Gesetze nach relevanten Paragraphen.

        Nutze dieses Tool fuer Fragen zum deutschen Recht, z.B. Sozialrecht,
        Behindertenrecht, Krankenversicherung, Pflegeversicherung, Rentenversicherung,
        Arbeitfoerderung, Sozialhilfe, Rehabilitation, Teilhabe, Steuern und mehr.

        Args:
            anfrage: Suchanfrage in natuerlicher Sprache,
                     z.B. "Welche Leistungen gibt es bei Schwerbehinderung?"
            gesetzbuch: Optional: Filter nach Gesetzbuch.
                        Erlaubte Werte: SGB I, SGB II, SGB III, SGB IV, SGB V,
                        SGB VI, SGB VII, SGB VIII, SGB IX, SGB X, SGB XI,
                        SGB XII, SGB XIV, BGG, AGG, VersMedV, EStG, KraftStG
            abschnitt: Optional: Filter nach Abschnitt/Kapitel
            max_ergebnisse: Anzahl zurueckzugebender Ergebnisse (1-10, Standard: 5)

        Returns:
            Relevante Gesetzestexte mit Quellenangaben und RDG-Disclaimer.
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant
        reranker = app.reranker

        max_ergebnisse = max(1, min(10, max_ergebnisse))

        await ctx.info(f"Suche: '{anfrage}'" + (f" in {gesetzbuch}" if gesetzbuch else ""))

        # 1. Filter aufbauen
        search_filter = SearchFilter(
            gesetz=gesetzbuch,
            abschnitt=abschnitt,
        )

        # 2. Hybrid-Search (Dense + Sparse)
        await ctx.report_progress(progress=1, total=4)
        raw_results = await qdrant.hybrid_search(
            query=anfrage,
            top_k=settings.retrieval_top_k,
            search_filter=search_filter,
        )

        if not raw_results:
            return (
                f"Keine Ergebnisse fuer '{anfrage}' gefunden."
                + (f" (Filter: {gesetzbuch})" if gesetzbuch else "")
                + "\n\nVersuchen Sie eine allgemeinere Formulierung oder "
                "entfernen Sie den Gesetzbuch-Filter."
            )

        # 3. Cross-Encoder Reranking -> Top k
        await ctx.report_progress(progress=2, total=4)
        reranked = reranker.rerank(anfrage, raw_results, top_k=max_ergebnisse)

        # Ergebnisse unter Schwellenwert entfernen
        reranked = [r for r in reranked if r.score >= settings.similarity_threshold]

        if not reranked:
            return (
                f"Keine ausreichend relevanten Ergebnisse fuer '{anfrage}' gefunden "
                f"(Schwellenwert: {settings.similarity_threshold})."
                + (f" (Filter: {gesetzbuch})" if gesetzbuch else "")
                + "\n\nVersuchen Sie eine allgemeinere Formulierung."
            )

        # 4. Deduplizierung: Paragraph-Chunks bevorzugen, Absatz-Duplikate entfernen
        await ctx.report_progress(progress=3, total=4)
        seen_paragraphs: set[str] = set()
        deduplicated = []
        deferred_absaetze = []
        for r in reranked:
            key = f"{r.chunk.metadata.paragraph}|{r.chunk.metadata.gesetz}"
            if key not in seen_paragraphs:
                seen_paragraphs.add(key)
                deduplicated.append(r)
            elif r.chunk.metadata.chunk_typ == "absatz" and len(deduplicated) < max_ergebnisse:
                deferred_absaetze.append(r)

        # Wenn nach Deduplizierung zu wenig Ergebnisse, Absatz-Chunks nachruecken
        if len(deduplicated) < max_ergebnisse and deferred_absaetze:
            deduplicated.extend(deferred_absaetze[: max_ergebnisse - len(deduplicated)])

        # 5. LongContextReorder
        reordered = long_context_reorder(deduplicated)

        # 6. Ergebnisse formatieren
        await ctx.report_progress(progress=4, total=4)
        output_parts = [f"## Ergebnisse fuer: {anfrage}\n"]

        for r in reordered:
            meta = r.chunk.metadata
            header = f"### {meta.paragraph} {meta.gesetz}"
            if meta.titel:
                header += f" – {meta.titel}"
            header += f" (Score: {r.score:.2f})"

            source = f"Quelle: {meta.quelle} | {meta.hierarchie_pfad}"

            output_parts.append(f"{header}\n\n{r.chunk.text}\n\n{source}\n")

        output_parts.append(DISCLAIMER)
        return "\n".join(output_parts)

    @mcp.tool()
    async def paragraf_lookup(
        ctx: Context,
        gesetz: str,
        paragraph: str,
    ) -> str:
        """Gibt den vollstaendigen Text eines bestimmten Paragraphen zurueck.

        Args:
            gesetz: Gesetzbuch-Abkuerzung, z.B. "SGB IX", "SGB V", "BGG", "EStG"
            paragraph: Paragraphen-Nummer, z.B. "§ 152", "§ 35a", "§ 2"

        Returns:
            Vollstaendiger Gesetzestext mit Metadaten.
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant

        # Exakte Suche nach Gesetz + Paragraph
        search_filter = SearchFilter(
            gesetz=gesetz,
            paragraph=paragraph,
            chunk_typ="paragraph",
        )

        # Dense-Suche mit exaktem Text des Paragraphen als Query
        results = await qdrant.dense_search(
            query=f"{paragraph} {gesetz}",
            top_k=3,
            search_filter=search_filter,
        )

        if not results:
            # Fallback: Hybrid-Search mit Gesetz-Filter (ohne Paragraph-Filter)
            fallback_filter = SearchFilter(gesetz=gesetz)
            results = await qdrant.hybrid_search(
                query=f"{paragraph} {gesetz}",
                top_k=3,
                search_filter=fallback_filter,
            )

        if not results:
            return (
                f"Der Paragraph {paragraph} {gesetz} wurde nicht gefunden.\n\n"
                "Moegliche Gruende:\n"
                "- Das Gesetz ist nicht in der Datenbank indexiert\n"
                "- Die Schreibweise weicht ab (versuchen Sie z.B. '§ 152' statt '§152')\n"
                f"- {gesetz} enthaelt keinen {paragraph}"
            )

        # Besten Match zurueckgeben
        best = results[0]
        meta = best.chunk.metadata

        output = f"## {meta.paragraph} {meta.gesetz}"
        if meta.titel:
            output += f" – {meta.titel}"
        output += f"\n\n**Hierarchie:** {meta.hierarchie_pfad}"
        output += f"\n**Abschnitt:** {meta.abschnitt}" if meta.abschnitt else ""
        output += f"\n**Quelle:** {meta.quelle}"
        if meta.stand:
            output += f"\n**Stand:** {meta.stand}"
        output += f"\n\n---\n\n{best.chunk.text}"
        output += DISCLAIMER

        return output

    @mcp.tool()
    async def paragraf_compare(
        ctx: Context,
        paragraphen: list[str],
    ) -> str:
        """Vergleicht mehrere Paragraphen nebeneinander.

        Nuetzlich um z.B. Leistungsansprueche aus verschiedenen Gesetzbuechern
        oder verwandte Vorschriften zu vergleichen.

        Args:
            paragraphen: Liste von Paragraphen-Referenzen,
                        z.B. ["§ 2 SGB IX", "§ 152 SGB IX", "§ 3 BGG"]

        Returns:
            Gegenueberstellung der Gesetzestexte.
        """
        import re

        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        qdrant = app.qdrant

        output_parts = ["## Vergleich\n"]

        for ref in paragraphen[:5]:  # Max 5 Paragraphen
            # Referenz parsen: "§ 36 SGB XI" -> paragraph="§ 36", gesetz="SGB XI"
            match = re.match(
                r"(§\s*\d+\w*)\s+(.+)", ref.strip()
            )
            if match:
                paragraph = match.group(1)
                gesetz = match.group(2).strip()
                search_filter = SearchFilter(
                    gesetz=gesetz,
                    paragraph=paragraph,
                    chunk_typ="paragraph",
                )
                results = await qdrant.dense_search(
                    query=f"{paragraph} {gesetz}",
                    top_k=1,
                    search_filter=search_filter,
                )
                if not results:
                    # Fallback ohne chunk_typ-Filter
                    search_filter = SearchFilter(gesetz=gesetz)
                    results = await qdrant.hybrid_search(
                        query=f"{paragraph} {gesetz}",
                        top_k=1,
                        search_filter=search_filter,
                    )
            else:
                # Kein erkanntes Format -> freie Suche
                results = await qdrant.hybrid_search(query=ref, top_k=1)

            if results:
                r = results[0]
                meta = r.chunk.metadata
                output_parts.append(
                    f"### {meta.paragraph} {meta.gesetz}"
                    + (f" – {meta.titel}" if meta.titel else "")
                    + f"\n\n{r.chunk.text}\n"
                )
            else:
                output_parts.append(f"### {ref}\n\n*Nicht gefunden.*\n")

        output_parts.append(DISCLAIMER)
        return "\n---\n".join(output_parts)

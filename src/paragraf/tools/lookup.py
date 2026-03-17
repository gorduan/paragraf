"""MCP Lookup Tools – EUTB-Beratungsstellen, Gesetzes-Uebersicht, Statistiken."""

from __future__ import annotations

import json
import logging

from mcp.server.fastmcp import Context, FastMCP

from paragraf.models.law import GESETZ_DOWNLOAD_SLUGS

logger = logging.getLogger(__name__)


def register_lookup_tools(mcp: FastMCP) -> None:
    """Registriert Lookup-/Nachschlage-Tools."""

    @mcp.tool()
    async def paragraf_laws(ctx: Context) -> str:
        """Listet alle verfuegbaren Gesetze und deren Status.

        Gibt eine Uebersicht aller indexierten Gesetze mit Anzahl der
        Paragraphen und Abschnitte zurueck.

        Returns:
            Tabellarische Uebersicht aller verfuegbaren Gesetze.
        """
        app = ctx.request_context.lifespan_context
        qdrant = app.qdrant

        info = await qdrant.get_collection_info()

        output = "## Verfuegbare Gesetze\n\n"
        output += f"**Datenbank-Status:** {info.get('status', 'unbekannt')}\n"
        output += f"**Gesamt-Chunks:** {info.get('points_count', 0):,}\n\n"

        output += "| Gesetz | Beschreibung |\n|---|---|\n"

        beschreibungen = {
            "SGB I": "Allgemeiner Teil – Grundsaetze des Sozialrechts",
            "SGB II": "Grundsicherung fuer Arbeitsuchende (Buergergeld)",
            "SGB III": "Arbeitsfoerderung",
            "SGB IV": "Gemeinsame Vorschriften fuer die Sozialversicherung",
            "SGB V": "Gesetzliche Krankenversicherung",
            "SGB VI": "Gesetzliche Rentenversicherung",
            "SGB VII": "Gesetzliche Unfallversicherung",
            "SGB VIII": "Kinder- und Jugendhilfe",
            "SGB IX": "Rehabilitation und Teilhabe von Menschen mit Behinderungen",
            "SGB X": "Sozialverwaltungsverfahren und Sozialdatenschutz",
            "SGB XI": "Soziale Pflegeversicherung",
            "SGB XII": "Sozialhilfe",
            "SGB XIV": "Soziale Entschaedigung",
            "BGG": "Behindertengleichstellungsgesetz",
            "AGG": "Allgemeines Gleichbehandlungsgesetz",
            "VersMedV": "Versorgungsmedizin-Verordnung (GdB-Feststellung)",
            "EStG": "Einkommensteuergesetz (u.a. Behinderten-Pauschbetrag § 33b)",
            "KraftStG": "Kraftfahrzeugsteuergesetz (u.a. Kfz-Steuerbefreiung § 3a)",
        }

        for abk in GESETZ_DOWNLOAD_SLUGS:
            beschreibung = beschreibungen.get(abk, "")
            output += f"| **{abk}** | {beschreibung} |\n"

        return output

    @mcp.tool()
    async def paragraf_counseling(
        ctx: Context,
        ort: str | None = None,
        bundesland: str | None = None,
        schwerpunkt: str | None = None,
    ) -> str:
        """Sucht EUTB-Beratungsstellen fuer Menschen mit Behinderungen.

        Die EUTB (Ergaenzende unabhaengige Teilhabeberatung) bietet kostenlose
        Beratung zu Rehabilitation und Teilhabe, unabhaengig von Leistungstraegern.

        Args:
            ort: Stadt oder Ort fuer die Suche, z.B. "Berlin", "Muenchen"
            bundesland: Bundesland, z.B. "Nordrhein-Westfalen", "Bayern"
            schwerpunkt: Beratungsschwerpunkt, z.B. "psychische Erkrankung",
                        "Sehbehinderung", "Lernschwierigkeiten"

        Returns:
            Liste passender Beratungsstellen mit Kontaktdaten.
        """
        # EUTB-Daten aus lokaler JSON-Datei laden (nach Ingestion verfuegbar)
        app = ctx.request_context.lifespan_context
        data_dir = app.data_dir

        eutb_file = data_dir / "processed" / "eutb_beratungsstellen.json"

        if not eutb_file.exists():
            return (
                "## EUTB-Beratungsstellensuche\n\n"
                "Die EUTB-Daten wurden noch nicht importiert. "
                "Bitte fuehren Sie zuerst `paragraf_index_eutb()` aus.\n\n"
                "**Alternativ koennen Sie direkt suchen unter:**\n"
                "https://www.teilhabeberatung.de/beratung/beratungsangebote-der-eutb\n\n"
                "**Telefon:** 0800 11 10 111 (kostenfrei)"
            )

        stellen = json.loads(eutb_file.read_text(encoding="utf-8"))

        # Filtern
        gefiltert = stellen
        if ort:
            ort_lower = ort.lower()
            gefiltert = [
                s for s in gefiltert
                if ort_lower in s.get("ort", "").lower()
                or ort_lower in s.get("name", "").lower()
            ]
        if bundesland:
            bl_lower = bundesland.lower()
            gefiltert = [
                s for s in gefiltert
                if bl_lower in s.get("bundesland", "").lower()
            ]
        if schwerpunkt:
            sp_lower = schwerpunkt.lower()
            gefiltert = [
                s for s in gefiltert
                if any(sp_lower in sp.lower() for sp in s.get("schwerpunkte", []))
                or sp_lower in s.get("name", "").lower()
            ]

        if not gefiltert:
            filter_info = []
            if ort:
                filter_info.append(f"Ort: {ort}")
            if bundesland:
                filter_info.append(f"Bundesland: {bundesland}")
            if schwerpunkt:
                filter_info.append(f"Schwerpunkt: {schwerpunkt}")
            return (
                f"Keine EUTB-Beratungsstellen gefunden fuer: {', '.join(filter_info)}.\n\n"
                "**Ueberregionale Suche:**\n"
                "https://www.teilhabeberatung.de/beratung/beratungsangebote-der-eutb\n"
                "Telefon: 0800 11 10 111 (kostenfrei)"
            )

        output = f"## EUTB-Beratungsstellen ({len(gefiltert)} Treffer)\n\n"

        for stelle in gefiltert[:10]:  # Max 10 anzeigen
            output += f"### {stelle.get('name', 'Unbekannt')}\n"
            if stelle.get("traeger"):
                output += f"**Traeger:** {stelle['traeger']}\n"
            adresse = ", ".join(
                filter(None, [
                    stelle.get("strasse"),
                    f"{stelle.get('plz', '')} {stelle.get('ort', '')}".strip(),
                ])
            )
            if adresse:
                output += f"Adresse: {adresse}\n"
            if stelle.get("telefon"):
                output += f"Telefon: {stelle['telefon']}\n"
            if stelle.get("email"):
                output += f"E-Mail: {stelle['email']}\n"
            if stelle.get("website"):
                output += f"Website: {stelle['website']}\n"
            if stelle.get("schwerpunkte"):
                output += f"**Schwerpunkte:** {', '.join(stelle['schwerpunkte'])}\n"
            output += "\n"

        if len(gefiltert) > 10:
            output += f"\n*... und {len(gefiltert) - 10} weitere Stellen.*\n"

        output += (
            "\n---\n"
            "Alle EUTB-Beratungen sind **kostenlos und unabhaengig**.\n"
            "Ueberregionale Hotline: 0800 11 10 111"
        )
        return output

    @mcp.tool()
    async def paragraf_status(ctx: Context) -> str:
        """Gibt den Status des Paragraf-MCP-Servers zurueck.

        Zeigt Informationen ueber die Datenbank, Modelle und verfuegbare Daten.

        Returns:
            Server-Status mit Statistiken.
        """
        app = ctx.request_context.lifespan_context
        qdrant = app.qdrant
        embedding = app.embedding

        info = await qdrant.get_collection_info()

        return (
            "## Paragraf MCP Server Status\n\n"
            f"**Embedding-Modell:** {embedding.model_name}\n"
            f"**Vektor-Dimension:** {embedding.dimension}\n"
            f"**Device:** {embedding.device}\n\n"
            f"**Qdrant-Collection:** {info.get('name', 'N/A')}\n"
            f"**Status:** {info.get('status', 'N/A')}\n"
            f"**Indexierte Chunks:** {info.get('points_count', 0):,}\n"
        )

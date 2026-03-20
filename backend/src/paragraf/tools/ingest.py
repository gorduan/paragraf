"""MCP Ingest Tools – Gesetze herunterladen und in Qdrant indexieren."""

from __future__ import annotations

import json
import logging

from mcp.server.fastmcp import Context, FastMCP

from paragraf.models.law import GESETZ_DOWNLOAD_SLUGS, LAW_REGISTRY

logger = logging.getLogger(__name__)


def register_ingest_tools(mcp: FastMCP) -> None:
    """Registriert Tools fuer Daten-Ingestion."""

    @mcp.tool()
    async def paragraf_index(
        ctx: Context,
        gesetzbuch: str | None = None,
    ) -> str:
        """Laedt Gesetze von gesetze-im-internet.de und indexiert sie in Qdrant.

        Dieser Vorgang laedt die XML-Dateien herunter, parst sie zu Chunks
        und erzeugt Embeddings. Das kann je nach Hardware einige Minuten dauern.

        Args:
            gesetzbuch: Optional: Nur ein bestimmtes Gesetzbuch indexieren,
                        z.B. "SGB IX". Ohne Angabe werden alle Gesetze indexiert.

        Returns:
            Status der Indexierung mit Statistiken.
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        parser = app.parser
        qdrant = app.qdrant

        await ctx.info("Starte Indexierung...")

        if gesetzbuch:
            law_def = LAW_REGISTRY.get(gesetzbuch)
            if not law_def:
                return (
                    f"Unbekanntes Gesetzbuch: {gesetzbuch}\n"
                    f"Verfuegbar: {', '.join(LAW_REGISTRY.keys())}"
                )

            await ctx.info(f"Lade {gesetzbuch}...")
            await ctx.report_progress(progress=1, total=3)

            if law_def.quelle == "eur-lex.europa.eu":
                from paragraf.services.eurlex_client import EurLexClient
                from paragraf.services.eurlex_parser import EurLexParser
                eurlex_client = EurLexClient(data_dir=app.data_dir)
                html_path = await eurlex_client.download(law_def.slug)
                eurlex_parser = EurLexParser()
                chunks = eurlex_parser.parse_html(
                    html_path.read_text(encoding="utf-8"),
                    gesetz_abk=gesetzbuch,
                )
            else:
                path = await parser.download_gesetz(law_def.slug)
                chunks = parser.parse_zip(path)

            await ctx.info(f"{len(chunks)} Chunks geparst – starte Embedding...")
            await ctx.report_progress(progress=2, total=3)

            count = await qdrant.upsert_chunks(chunks)
            await ctx.report_progress(progress=3, total=3)

            return (
                f"## Indexierung abgeschlossen: {gesetzbuch}\n\n"
                f"- **Geparste Chunks:** {len(chunks)}\n"
                f"- **In Qdrant eingefuegt:** {count}\n"
            )

        else:
            total_gesetze = len(LAW_REGISTRY)
            total_chunks = 0
            errors: list[str] = []

            for i, (name, law_def) in enumerate(LAW_REGISTRY.items()):
                await ctx.info(f"[{i+1}/{total_gesetze}] Verarbeite {name}...")
                await ctx.report_progress(progress=i + 1, total=total_gesetze)

                try:
                    if law_def.quelle == "eur-lex.europa.eu":
                        from paragraf.services.eurlex_client import EurLexClient
                        from paragraf.services.eurlex_parser import EurLexParser
                        eurlex_client = EurLexClient(data_dir=app.data_dir)
                        html_path = await eurlex_client.download(law_def.slug)
                        eurlex_parser = EurLexParser()
                        chunks = eurlex_parser.parse_html(
                            html_path.read_text(encoding="utf-8"),
                            gesetz_abk=name,
                        )
                    else:
                        path = await parser.download_gesetz(law_def.slug)
                        chunks = parser.parse_zip(path)

                    if chunks:
                        count = await qdrant.upsert_chunks(chunks)
                        total_chunks += count
                        logger.info("%s: %d Chunks indexiert", name, count)
                    else:
                        logger.warning("%s: Keine Chunks extrahiert", name)
                except Exception as e:
                    errors.append(f"{name}: {e}")
                    logger.error("Fehler bei %s: %s", name, e)

            output = (
                f"## Indexierung abgeschlossen\n\n"
                f"- **Verarbeitete Gesetze:** {total_gesetze}\n"
                f"- **Gesamt-Chunks:** {total_chunks:,}\n"
            )
            if errors:
                output += f"\n**Fehler ({len(errors)}):**\n"
                for err in errors:
                    output += f"- {err}\n"

            return output

    @mcp.tool()
    async def paragraf_index_eutb(ctx: Context) -> str:
        """Laedt EUTB-Beratungsstellen-Daten herunter und speichert sie lokal.

        Quelle: teilhabeberatung.de (Excel-Export)
        Die Daten werden als JSON fuer schnellen Zugriff gespeichert.

        Returns:
            Status des Imports mit Anzahl der Beratungsstellen.
        """
        import httpx

        # EUTB-Import braucht kein ML-Modell, aber data_dir
        app = ctx.request_context.lifespan_context
        data_dir = app.data_dir
        processed_dir = data_dir / "processed"
        processed_dir.mkdir(parents=True, exist_ok=True)

        await ctx.info("Lade EUTB-Daten von teilhabeberatung.de...")

        url = "https://www.teilhabeberatung.de/beratung/export?_format=xlsx"
        xlsx_path = data_dir / "raw" / "eutb_export.xlsx"
        json_path = processed_dir / "eutb_beratungsstellen.json"

        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                resp = await client.get(url)
                resp.raise_for_status()

            xlsx_path.parent.mkdir(parents=True, exist_ok=True)
            xlsx_path.write_bytes(resp.content)
            await ctx.info(f"Excel-Datei gespeichert ({len(resp.content) // 1024} KB)")

        except httpx.HTTPError as e:
            return (
                f"Fehler beim Download der EUTB-Daten: {e}\n\n"
                "Die Excel-Datei kann auch manuell heruntergeladen werden:\n"
                f"{url}\n"
                f"Speichern unter: {xlsx_path}"
            )

        # Excel parsen
        await ctx.info("Parse Excel-Datei...")
        try:
            import openpyxl

            wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
            ws = wb.active

            if ws is None:
                return "Fehler: Kein aktives Worksheet in der Excel-Datei."

            rows = list(ws.iter_rows(values_only=True))
            if len(rows) < 2:
                return "Fehler: Excel-Datei enthaelt keine Daten."

            headers = [str(h).lower().strip() if h else "" for h in rows[0]]

            stellen: list[dict] = []
            for row in rows[1:]:
                if not row or not any(row):
                    continue

                data = dict(zip(headers, row, strict=False))
                # Schwerpunkte aus verschiedenen moeglichen Spalten extrahieren
                schwerpunkte_raw = ""
                for sp_key in ("schwerpunkte", "beratungsschwerpunkte",
                               "schwerpunkt", "beratungsschwerpunkt", "themen"):
                    val = data.get(sp_key, "")
                    if val and str(val).strip() and str(val).strip() != "None":
                        schwerpunkte_raw = str(val).strip()
                        break

                # Komma- oder semikolon-getrennte Liste parsen
                schwerpunkte: list[str] = []
                if schwerpunkte_raw:
                    for sep in (";", ",", "|"):
                        if sep in schwerpunkte_raw:
                            schwerpunkte = [
                                s.strip() for s in schwerpunkte_raw.split(sep)
                                if s.strip()
                            ]
                            break
                    if not schwerpunkte:
                        schwerpunkte = [schwerpunkte_raw]

                stelle = {
                    "name": str(data.get("name", data.get("bezeichnung", ""))).strip(),
                    "traeger": str(data.get("träger", data.get("traeger", ""))).strip(),
                    "strasse": str(data.get("straße", data.get("strasse", ""))).strip(),
                    "plz": str(data.get("plz", "")).strip(),
                    "ort": str(data.get("ort", data.get("stadt", ""))).strip(),
                    "bundesland": str(data.get("bundesland", "")).strip(),
                    "telefon": str(data.get("telefon", "")).strip(),
                    "email": str(data.get("e-mail", data.get("email", ""))).strip(),
                    "website": str(data.get("homepage", data.get("website", ""))).strip(),
                    "schwerpunkte": schwerpunkte,
                }

                # None-Werte bereinigen
                for k, v in stelle.items():
                    if v == "None" or v is None:
                        stelle[k] = "" if isinstance(v, str) else []

                if stelle["name"]:
                    stellen.append(stelle)

            wb.close()

        except ImportError:
            return (
                "Fehler: openpyxl ist nicht installiert.\n"
                "Installation: `pip install openpyxl`"
            )

        # Als JSON speichern
        json_path.write_text(
            json.dumps(stellen, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        return (
            f"## EUTB-Import abgeschlossen\n\n"
            f"- **Beratungsstellen:** {len(stellen)}\n"
            f"- **Gespeichert:** {json_path}\n"
        )

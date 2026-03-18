"""EUR-Lex Client – Download deutscher HTML-Versionen von EU-Rechtsakten."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

EURLEX_BASE = "https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/"


class EurLexClient:
    """Laedt EU-Rechtsakte von EUR-Lex als HTML herunter."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or Path("./data")
        self.cache_dir = self.data_dir / "raw" / "eurlex"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    async def download(self, celex: str, max_retries: int = 5) -> Path:
        """Laedt einen EU-Rechtsakt als HTML herunter und cached ihn.

        EUR-Lex gibt oft 202 (Accepted) zurueck mit einer Wartseite.
        In diesem Fall wird mit Backoff wiederholt bis der volle Content kommt.

        Args:
            celex: CELEX-Nummer, z.B. '32016R0679' (DSGVO)
            max_retries: Maximale Anzahl Wiederholungen bei 202

        Returns:
            Pfad zur gespeicherten HTML-Datei
        """
        safe_name = celex.replace("/", "_")
        target = self.cache_dir / f"{safe_name}.html"

        if target.exists() and target.stat().st_size > 5000:
            logger.debug("Bereits vorhanden: %s", target)
            return target

        url = f"{EURLEX_BASE}?uri=CELEX:{celex}"
        logger.info("Lade EUR-Lex herunter: %s", url)

        headers = {"Accept": "text/html", "Accept-Language": "de"}
        resp = None
        async with httpx.AsyncClient(
            timeout=90, follow_redirects=True, headers=headers
        ) as client:
            for attempt in range(max_retries):
                resp = await client.get(url)

                if resp.status_code == 200 and len(resp.text) > 5000:
                    target.write_text(resp.text, encoding="utf-8")
                    logger.info(
                        "Gespeichert: %s (%d KB)", target, len(resp.text) // 1024
                    )
                    return target

                if resp.status_code in (200, 202) and len(resp.text) < 5000:
                    wait = 3 * (attempt + 1)
                    logger.info(
                        "EUR-Lex 202/Wartseite, Retry %d/%d in %ds...",
                        attempt + 1, max_retries, wait,
                    )
                    await asyncio.sleep(wait)
                    continue

                resp.raise_for_status()

        msg = (
            f"EUR-Lex lieferte keinen Content fuer CELEX:{celex} nach {max_retries} Versuchen. "
            f"EUR-Lex nutzt Bot-Protection (AWS WAF). Bitte die HTML-Datei manuell herunterladen:\n"
            f"  1. Im Browser oeffnen: {url}\n"
            f"  2. Seite speichern als: {target}\n"
            f"  3. Indexierung erneut starten."
        )
        raise RuntimeError(msg)

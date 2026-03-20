"""Validiert alle Download-Slugs und CELEX-Nummern via HTTP HEAD/GET.

Aufruf: uv run python scripts/validate_slugs.py
"""

from __future__ import annotations

import asyncio
import sys

import httpx

from paragraf.models.law import EURLEX_LAWS, GESETZ_DOWNLOAD_SLUGS

GII_BASE = "https://www.gesetze-im-internet.de"
EURLEX_BASE = "https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/"


async def validate_gii_slugs() -> list[str]:
    """Prueft alle gesetze-im-internet.de Slugs via HTTP HEAD."""
    errors: list[str] = []
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for abk, slug in sorted(GESETZ_DOWNLOAD_SLUGS.items()):
            url = f"{GII_BASE}/{slug}/xml.zip"
            try:
                resp = await client.head(url)
                if resp.status_code == 200:
                    print(f"  OK  {abk:20s} -> {slug}")
                else:
                    msg = f"FAIL {abk:20s} -> {slug} (HTTP {resp.status_code})"
                    print(f"  {msg}")
                    errors.append(msg)
            except httpx.HTTPError as e:
                msg = f"ERR  {abk:20s} -> {slug} ({e})"
                print(f"  {msg}")
                errors.append(msg)
    return errors


async def validate_eurlex_celex() -> list[str]:
    """Prueft alle EUR-Lex CELEX-Nummern via HTTP GET."""
    errors: list[str] = []
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for abk, celex in sorted(EURLEX_LAWS.items()):
            url = f"{EURLEX_BASE}?uri=CELEX:{celex}"
            try:
                resp = await client.get(url)
                # EUR-Lex returns 200 or 202 for valid documents
                if resp.status_code in (200, 202):
                    print(f"  OK  {abk:20s} -> {celex}")
                else:
                    msg = f"FAIL {abk:20s} -> {celex} (HTTP {resp.status_code})"
                    print(f"  {msg}")
                    errors.append(msg)
            except httpx.HTTPError as e:
                msg = f"ERR  {abk:20s} -> {celex} ({e})"
                print(f"  {msg}")
                errors.append(msg)
    return errors


async def main() -> int:
    print("=== Validiere gesetze-im-internet.de Slugs ===")
    print(f"    ({len(GESETZ_DOWNLOAD_SLUGS)} deutsche Gesetze)")
    gii_errors = await validate_gii_slugs()

    print()
    print("=== Validiere EUR-Lex CELEX-Nummern ===")
    print(f"    ({len(EURLEX_LAWS)} EU-Rechtsakte)")
    eurlex_errors = await validate_eurlex_celex()

    all_errors = gii_errors + eurlex_errors
    print()
    if all_errors:
        print(f"FEHLER: {len(all_errors)} Slugs/CELEX nicht erreichbar:")
        for e in all_errors:
            print(f"  - {e}")
        return 1
    else:
        total = len(GESETZ_DOWNLOAD_SLUGS) + len(EURLEX_LAWS)
        print(f"Alle {total} Slugs/CELEX erfolgreich validiert!")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

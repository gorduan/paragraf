"""EUR-Lex HTML Parser – Parst EU-Rechtsakte zu LawChunk-Listen."""

from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup, Tag

from paragraf.models.law import ChunkMetadata, LawChunk

logger = logging.getLogger(__name__)


class EurLexParser:
    """Parst EUR-Lex HTML-Dokumente zu LawChunk-Listen."""

    def parse_html(self, html: str, gesetz_abk: str) -> list[LawChunk]:
        """Parst ein EUR-Lex HTML-Dokument und extrahiert Artikel als Chunks.

        Args:
            html: HTML-Inhalt des EUR-Lex Dokuments
            gesetz_abk: Abkuerzung des Gesetzes, z.B. 'DSGVO'

        Returns:
            Liste von LawChunk-Objekten
        """
        soup = BeautifulSoup(html, "html.parser")
        chunks: list[LawChunk] = []

        # EUR-Lex nutzt verschiedene Strukturen, versuche mehrere Strategien

        # Strategie 1: eli-subdivision Divs (neueres Format)
        subdivisions = soup.find_all("div", class_="eli-subdivision")
        if subdivisions:
            chunks = self._parse_eli_subdivisions(subdivisions, gesetz_abk)

        # Strategie 2: Artikel-Titel im Text finden (aelteres Format)
        if not chunks:
            chunks = self._parse_by_article_headings(soup, gesetz_abk)

        # Strategie 3: Fallback – Text in grosse Bloecke splitten
        if not chunks:
            chunks = self._parse_fallback(soup, gesetz_abk)

        logger.info("EUR-Lex %s: %d Chunks extrahiert", gesetz_abk, len(chunks))
        return chunks

    def _parse_eli_subdivisions(
        self, subdivisions: list[Tag], gesetz_abk: str
    ) -> list[LawChunk]:
        """Parst eli-subdivision Struktur."""
        chunks: list[LawChunk] = []
        current_abschnitt = ""

        for div in subdivisions:
            # Abschnitt/Kapitel/Titel identifizieren
            heading = div.find(["h1", "h2", "h3", "h4"])
            if heading:
                heading_text = heading.get_text(strip=True)
                # Pruefen ob es ein Artikel ist
                art_match = re.match(
                    r"(Art(?:ikel)?\.?\s*\d+[a-z]*)", heading_text, re.IGNORECASE
                )
                if art_match:
                    artikel_bez = art_match.group(1)
                    # Artikel-Titel (Rest nach Nummer)
                    titel = heading_text[len(art_match.group(0)):].strip(" -–\n")

                    # Text des Artikels extrahieren
                    text_parts: list[str] = []
                    for sibling in div.children:
                        if isinstance(sibling, Tag) and sibling != heading:
                            t = sibling.get_text(separator=" ", strip=True)
                            if t:
                                text_parts.append(t)
                        elif isinstance(sibling, str) and sibling.strip():
                            text_parts.append(sibling.strip())

                    article_text = "\n\n".join(text_parts)
                    if len(article_text.strip()) < 10:
                        continue

                    chunk_id = f"{gesetz_abk}_{artikel_bez}".replace(" ", "_")
                    full_text = f"{artikel_bez} {gesetz_abk}"
                    if titel:
                        full_text += f" – {titel}"
                    full_text += f"\n\n{article_text}"

                    chunks.append(LawChunk(
                        id=chunk_id,
                        text=full_text,
                        metadata=ChunkMetadata(
                            gesetz=gesetz_abk,
                            paragraph=artikel_bez,
                            titel=titel,
                            abschnitt=current_abschnitt,
                            hierarchie_pfad=" > ".join(
                                p for p in [gesetz_abk, current_abschnitt, artikel_bez] if p
                            ),
                            quelle="eur-lex.europa.eu",
                            chunk_typ="paragraph",
                        ),
                    ))
                else:
                    # Abschnitt/Kapitel-Ueberschrift
                    current_abschnitt = heading_text[:120]

        return chunks

    def _parse_by_article_headings(
        self, soup: BeautifulSoup, gesetz_abk: str
    ) -> list[LawChunk]:
        """Parst EUR-Lex HTML anhand von Artikel-Ueberschriften im Text."""
        chunks: list[LawChunk] = []

        # Alle Elemente die Artikelnummern enthalten
        article_pattern = re.compile(
            r"^Art(?:ikel)?\.?\s*(\d+[a-z]*)", re.IGNORECASE
        )

        # Finde alle <p> oder <div> die mit "Artikel" beginnen
        body = soup.find("body") or soup
        all_elements = body.find_all(["p", "div", "span", "td"])

        article_starts: list[tuple[int, str, str, Tag]] = []
        for i, elem in enumerate(all_elements):
            text = elem.get_text(strip=True)
            match = article_pattern.match(text)
            if match and len(text) < 200:
                article_starts.append((i, f"Art. {match.group(1)}", text, elem))

        current_abschnitt = ""
        for idx, (start_i, art_bez, heading_text, start_elem) in enumerate(article_starts):
            titel = heading_text[len(art_bez):].strip(" -–.\n")

            # Sammle Text bis zum naechsten Artikel
            end_i = article_starts[idx + 1][0] if idx + 1 < len(article_starts) else len(all_elements)
            text_parts: list[str] = []
            for j in range(start_i + 1, min(end_i, start_i + 100)):
                t = all_elements[j].get_text(separator=" ", strip=True)
                if t and t != heading_text:
                    text_parts.append(t)

            article_text = "\n\n".join(text_parts)
            if len(article_text.strip()) < 10:
                continue

            chunk_id = f"{gesetz_abk}_{art_bez}".replace(" ", "_").replace(".", "")
            full_text = f"{art_bez} {gesetz_abk}"
            if titel:
                full_text += f" – {titel}"
            full_text += f"\n\n{article_text}"

            chunks.append(LawChunk(
                id=chunk_id,
                text=full_text,
                metadata=ChunkMetadata(
                    gesetz=gesetz_abk,
                    paragraph=art_bez,
                    titel=titel,
                    abschnitt=current_abschnitt,
                    hierarchie_pfad=" > ".join(
                        p for p in [gesetz_abk, current_abschnitt, art_bez] if p
                    ),
                    quelle="eur-lex.europa.eu",
                    chunk_typ="paragraph",
                ),
            ))

        return chunks

    def _parse_fallback(
        self, soup: BeautifulSoup, gesetz_abk: str
    ) -> list[LawChunk]:
        """Fallback: Gesamten Text in Bloecke aufteilen."""
        body = soup.find("body") or soup
        full_text = body.get_text(separator="\n", strip=True)

        if len(full_text) < 50:
            return []

        chunks: list[LawChunk] = []
        max_size = 1500
        paragraphs = full_text.split("\n")
        current: list[str] = []
        current_size = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if current_size + len(para) > max_size and current:
                chunk_text = "\n".join(current)
                chunk_id = f"{gesetz_abk}_block_{len(chunks)}"
                chunks.append(LawChunk(
                    id=chunk_id,
                    text=f"{gesetz_abk}\n\n{chunk_text}",
                    metadata=ChunkMetadata(
                        gesetz=gesetz_abk,
                        paragraph=f"Block {len(chunks) + 1}",
                        quelle="eur-lex.europa.eu",
                        chunk_typ="abschnitt",
                    ),
                ))
                current = []
                current_size = 0
            current.append(para)
            current_size += len(para)

        if current:
            chunk_text = "\n".join(current)
            chunk_id = f"{gesetz_abk}_block_{len(chunks)}"
            chunks.append(LawChunk(
                id=chunk_id,
                text=f"{gesetz_abk}\n\n{chunk_text}",
                metadata=ChunkMetadata(
                    gesetz=gesetz_abk,
                    paragraph=f"Block {len(chunks) + 1}",
                    quelle="eur-lex.europa.eu",
                    chunk_typ="abschnitt",
                ),
            ))

        return chunks

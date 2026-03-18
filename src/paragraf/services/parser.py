"""XML-Parser fuer Gesetze von gesetze-im-internet.de."""

from __future__ import annotations

import logging
import re
import zipfile
from pathlib import Path

import httpx
from bs4 import BeautifulSoup, Tag

from paragraf.models.law import (
    GESETZ_DOWNLOAD_SLUGS,
    ChunkMetadata,
    LawChunk,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gesetze-im-internet.de"
TOC_URL = f"{BASE_URL}/gii-toc.xml"


class GesetzParser:
    """Parst deutsche Gesetze von gesetze-im-internet.de (XML-Format).

    Die XML-Struktur folgt der juris-DTD (Version 1.01):
    - <dokumente> -> Wurzelelement mit builddate und doknr
    - <norm> -> Einzelne Norm (Paragraph, Artikel, etc.)
    - <metadaten> -> jurabk, enbez (Paragraph-Nummer), titel, gliederungseinheit
    - <textdaten><text format="XML"><Content><P> -> Gesetzestext
    """

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or Path("./data")
        self.raw_dir = self.data_dir / "raw"
        self.raw_dir.mkdir(parents=True, exist_ok=True)

    async def download_gesetz(self, slug: str) -> Path:
        """Laedt ein Gesetz als ZIP von gesetze-im-internet.de herunter."""
        url = f"{BASE_URL}/{slug}/xml.zip"
        target = self.raw_dir / f"{slug}.zip"

        if target.exists():
            logger.debug("Bereits vorhanden: %s", target)
            return target

        logger.info("Lade herunter: %s", url)
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        target.write_bytes(resp.content)
        logger.info("Gespeichert: %s (%d KB)", target, len(resp.content) // 1024)
        return target

    async def download_all_sgb(self) -> list[Path]:
        """Laedt alle konfigurierten Gesetze herunter."""
        paths = []
        for name, slug in GESETZ_DOWNLOAD_SLUGS.items():
            try:
                path = await self.download_gesetz(slug)
                paths.append(path)
            except httpx.HTTPStatusError as e:
                logger.warning("Fehler beim Download von %s: %s", name, e)
        return paths

    def parse_zip(self, zip_path: Path) -> list[LawChunk]:
        """Parst eine ZIP-Datei und extrahiert alle Norm-Chunks."""
        with zipfile.ZipFile(zip_path) as zf:
            xml_files = [f for f in zf.namelist() if f.endswith(".xml")]
            if not xml_files:
                logger.warning("Keine XML-Datei in %s", zip_path)
                return []

            xml_content = zf.read(xml_files[0])

        return self.parse_xml(xml_content)

    def parse_xml(self, xml_bytes: bytes) -> list[LawChunk]:
        """Parst XML-Bytes und extrahiert Chunks auf Paragraph-Ebene."""
        soup = BeautifulSoup(xml_bytes, "lxml-xml")

        # Gesetzesname aus erster Norm (Eingangsformel) extrahieren
        gesetz_abk = ""
        erste_norm = soup.find("norm")
        if erste_norm:
            jurabk_tag = erste_norm.find("jurabk")
            if jurabk_tag:
                gesetz_abk = self._normalize_abkuerzung(jurabk_tag.get_text(strip=True))

        chunks: list[LawChunk] = []
        current_abschnitt = ""

        for norm in soup.find_all("norm"):
            try:
                # Gliederungseinheit tracken (Buch, Teil, Kapitel, Abschnitt)
                meta = norm.find("metadaten")
                if meta:
                    gliederung = meta.find("gliederungseinheit")
                    if gliederung:
                        gl_bez = gliederung.find("gliederungsbez")
                        gl_titel = gliederung.find("gliederungstitel")
                        if gl_bez and gl_titel:
                            current_abschnitt = (
                                f"{gl_bez.get_text(strip=True)} – "
                                f"{gl_titel.get_text(strip=True)}"
                            )

                norm_chunks = self._parse_single_norm(
                    norm, gesetz_abk, current_abschnitt
                )
                chunks.extend(norm_chunks)
            except Exception as e:
                norm_id = norm.get("doknr", "unbekannt")
                logger.warning(
                    "Fehler beim Parsen von Norm %s in %s: %s",
                    norm_id, gesetz_abk, e,
                )

        logger.info("Geparst: %s -> %d Chunks", gesetz_abk or "unbekannt", len(chunks))
        return chunks

    def _parse_single_norm(
        self, norm: Tag, gesetz_abk: str, current_abschnitt: str
    ) -> list[LawChunk]:
        """Parst eine einzelne Norm und gibt Chunks zurueck."""
        meta = norm.find("metadaten")
        if not meta:
            return []

        # Normen mit Paragraph/Art.-Bezeichnung ODER Anlagen
        enbez_tag = meta.find("enbez")
        if not enbez_tag:
            return []
        enbez = enbez_tag.get_text(strip=True)

        # Anlage erkennen und separat parsen
        if enbez.startswith("Anlage"):
            return self._parse_anlage(norm, gesetz_abk, current_abschnitt)

        if not (enbez.startswith("§") or enbez.startswith("Art")):
            return []

        # Titel extrahieren
        titel_tag = meta.find("titel", attrs={"format": "parat"})
        if not titel_tag:
            titel_tag = meta.find("titel")
        titel = titel_tag.get_text(strip=True) if titel_tag else ""

        # Norm-ID
        norm_id = norm.get("doknr", "")

        # Jurabk dieser Norm (kann sich bei Sammelnormen unterscheiden)
        norm_jurabk_tag = meta.find("jurabk")
        norm_abk = gesetz_abk
        if norm_jurabk_tag:
            norm_abk = self._normalize_abkuerzung(norm_jurabk_tag.get_text(strip=True))

        # Gesetzestext extrahieren
        textdaten = norm.find("textdaten")
        if not textdaten:
            return []

        text_tag = textdaten.find("text")
        if not text_tag:
            return []

        content = text_tag.find("Content")
        if not content:
            return []

        # Absaetze extrahieren
        absaetze = self._extract_absaetze(content)

        if not absaetze:
            return []

        # Hierarchie-Pfad
        hierarchie = " > ".join(
            [p for p in [norm_abk, current_abschnitt, enbez] if p]
        )

        # Kompletter Paragraph-Text als ein Chunk
        full_text = "\n\n".join(absaetze)
        if len(full_text.strip()) < 10:
            return []

        chunks: list[LawChunk] = []
        paragraph_id = f"{norm_abk}_{enbez}".replace(" ", "_").replace("§_", "§")
        chunk = LawChunk(
            id=paragraph_id,
            text=f"{enbez} {norm_abk}" + (f" – {titel}" if titel else "") + f"\n\n{full_text}",
            metadata=ChunkMetadata(
                gesetz=norm_abk,
                paragraph=enbez,
                absatz=None,
                titel=titel,
                abschnitt=current_abschnitt,
                hierarchie_pfad=hierarchie,
                norm_id=norm_id,
                quelle="gesetze-im-internet.de",
                chunk_typ="paragraph",
            ),
        )
        chunks.append(chunk)

        # Bei langen Paragraphen: zusaetzlich Absatz-Level Chunks
        if len(absaetze) > 1 and len(full_text) > 800:
            for abs_nr, abs_text in enumerate(absaetze, start=1):
                if len(abs_text.strip()) < 20:
                    continue
                abs_id = f"{paragraph_id}_Abs{abs_nr}"
                abs_chunk = LawChunk(
                    id=abs_id,
                    text=f"{enbez} Abs. {abs_nr} {norm_abk}\n\n{abs_text}",
                    metadata=ChunkMetadata(
                        gesetz=norm_abk,
                        paragraph=enbez,
                        absatz=abs_nr,
                        titel=titel,
                        abschnitt=current_abschnitt,
                        hierarchie_pfad=f"{hierarchie} > Abs. {abs_nr}",
                        norm_id=norm_id,
                        quelle="gesetze-im-internet.de",
                        chunk_typ="absatz",
                    ),
                )
                chunks.append(abs_chunk)

        return chunks

    def _parse_anlage(
        self, norm: Tag, gesetz_abk: str, current_abschnitt: str
    ) -> list[LawChunk]:
        """Parst eine Anlage (z.B. VersMedV-Anlage) in sinnvolle Chunks.

        Grosse Anlagen werden nach Top-Level <P>-Elementen aufgeteilt.
        Sehr grosse P-Bloecke (>2000 Zeichen) werden zusaetzlich nach
        nummerierten Abschnitten gesplittet.
        """
        meta = norm.find("metadaten")
        titel_tag = meta.find("titel") if meta else None
        titel = titel_tag.get_text(strip=True) if titel_tag else "Anlage"
        norm_id = norm.get("doknr", "")

        textdaten = norm.find("textdaten")
        if not textdaten:
            return []
        text_tag = textdaten.find("text")
        if not text_tag:
            return []
        content = text_tag.find("Content")
        if not content:
            return []

        chunks: list[LawChunk] = []
        p_tags = content.find_all("P", recursive=False)

        if not p_tags:
            # Fallback: gesamten Content als einen Chunk
            full_text = self._tag_to_text(content)
            if full_text and len(full_text) > 10:
                chunks.append(self._make_anlage_chunk(
                    gesetz_abk, "Anlage", titel, current_abschnitt,
                    norm_id, full_text, 0,
                ))
            return chunks

        # Jeden P-Block verarbeiten
        for i, p in enumerate(p_tags):
            text = self._tag_to_text(p)
            if not text or len(text.strip()) < 20:
                continue

            # Abschnittstitel aus erstem Satz extrahieren
            first_line = text.split("\n")[0][:120] if "\n" in text else text[:120]

            if len(text) <= 2000:
                # Kleine Bloecke direkt als Chunk
                chunks.append(self._make_anlage_chunk(
                    gesetz_abk, "Anlage", first_line, current_abschnitt,
                    norm_id, text, i,
                ))
            else:
                # Grosse Bloecke nach nummerierten Abschnitten splitten
                sub_chunks = self._split_large_anlage_block(text)
                for j, (sub_title, sub_text) in enumerate(sub_chunks):
                    chunks.append(self._make_anlage_chunk(
                        gesetz_abk, "Anlage", sub_title, current_abschnitt,
                        norm_id, sub_text, i * 100 + j,
                    ))

        logger.info(
            "Anlage '%s' -> %d Chunks", titel[:60], len(chunks)
        )
        return chunks

    def _split_large_anlage_block(self, text: str) -> list[tuple[str, str]]:
        """Splittet einen grossen Textblock nach nummerierten Abschnitten.

        Erkennt Muster wie '2.1 Narben...', '3. Nervensystem...' etc.
        Funktioniert auch ohne Zeilenumbrueche im Text.
        """
        # Muster: Hauptabschnittsnummern (z.B. "2.", "3.", "14.")
        # Nur einstellige Tiefe um nicht zu fein zu splitten
        pattern = re.compile(
            r'(?:^|\s)(\d{1,2}\.\s+[A-ZÄÖÜ\(][^.]{5,80})'
        )
        matches = list(pattern.finditer(text))

        if len(matches) < 2:
            # Nicht genug Abschnitte gefunden -> nach max. 1500 Zeichen splitten
            return self._split_by_size(text, max_size=1500)

        result: list[tuple[str, str]] = []

        # Text vor erstem Match
        if matches[0].start() > 50:
            pre_text = text[: matches[0].start()].strip()
            if pre_text:
                first_line = pre_text[:100]
                result.append((first_line, pre_text))

        # Abschnitte zwischen Matches
        for idx, match in enumerate(matches):
            start = match.start()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            section_text = text[start:end].strip()
            if section_text:
                section_title = match.group(1).strip()[:120]
                # Wenn Abschnitt immer noch zu gross, weiter splitten
                if len(section_text) > 3000:
                    sub = self._split_by_size(section_text, max_size=1500)
                    for k, (st, stxt) in enumerate(sub):
                        title = f"{section_title}" + (f" ({k+1})" if k > 0 else "")
                        result.append((title, stxt))
                else:
                    result.append((section_title, section_text))

        return result

    @staticmethod
    def _split_by_size(
        text: str, max_size: int = 1500
    ) -> list[tuple[str, str]]:
        """Splittet Text nach Groesse an Absatzgrenzen."""
        paragraphs = text.split("\n")
        chunks: list[tuple[str, str]] = []
        current: list[str] = []
        current_size = 0

        for para in paragraphs:
            if current_size + len(para) > max_size and current:
                chunk_text = "\n".join(current)
                title = current[0][:100] if current else ""
                chunks.append((title, chunk_text))
                current = []
                current_size = 0
            current.append(para)
            current_size += len(para)

        if current:
            chunk_text = "\n".join(current)
            title = current[0][:100] if current else ""
            chunks.append((title, chunk_text))

        return chunks

    def _make_anlage_chunk(
        self,
        gesetz: str,
        paragraph: str,
        titel: str,
        abschnitt: str,
        norm_id: str,
        text: str,
        index: int,
    ) -> LawChunk:
        """Erstellt einen LawChunk fuer einen Anlage-Abschnitt."""
        chunk_id = f"{gesetz}_Anlage_{index}".replace(" ", "_")
        return LawChunk(
            id=chunk_id,
            text=f"Anlage {gesetz} – {titel}\n\n{text}",
            metadata=ChunkMetadata(
                gesetz=gesetz,
                paragraph=paragraph,
                absatz=None,
                titel=titel,
                abschnitt=abschnitt,
                hierarchie_pfad=f"{gesetz} > Anlage > {titel}",
                norm_id=norm_id,
                quelle="gesetze-im-internet.de",
                chunk_typ="anlage",
            ),
        )

    def _extract_absaetze(self, content: Tag) -> list[str]:
        """Extrahiert Absaetze aus einem <Content>-Element."""
        absaetze: list[str] = []

        for p_tag in content.find_all("P", recursive=False):
            text = self._tag_to_text(p_tag)
            if text:
                absaetze.append(text)

        # Fallback: Wenn keine <P> auf Top-Level, gesamten Content nehmen
        if not absaetze:
            text = self._tag_to_text(content)
            if text:
                absaetze.append(text)

        return absaetze

    def _tag_to_text(self, tag: Tag) -> str:
        """Konvertiert ein Tag zu bereinigtem Text.

        Behandelt verschachtelte Elemente wie:
        - <DL>/<DT>/<DD> fuer Aufzaehlungen mit Nummern
        - <pre> fuer vorformatierten Text
        - <BR/> als Zeilenumbruch
        - <nomark> als normalen Text
        """
        parts: list[str] = []

        for child in tag.children:
            if isinstance(child, str):
                text = child.strip()
                if text:
                    parts.append(text)
            elif isinstance(child, Tag):
                if child.name in ("DL", "dl"):
                    # Definitionsliste -> Aufzaehlung
                    for dt_dd in child.children:
                        if isinstance(dt_dd, Tag):
                            t = dt_dd.get_text(separator=" ", strip=True)
                            if t:
                                parts.append(t)
                elif child.name in ("BR", "br"):
                    parts.append("\n")
                elif child.name == "pre":
                    parts.append(child.get_text())
                elif child.name == "table":
                    # Tabellen vereinfacht extrahieren
                    for row in child.find_all("row"):
                        cells = [
                            entry.get_text(strip=True)
                            for entry in row.find_all("entry")
                        ]
                        if cells:
                            parts.append(" | ".join(cells))
                else:
                    t = child.get_text(separator=" ", strip=True)
                    if t:
                        parts.append(t)

        text = " ".join(parts)
        # Mehrfache Leerzeichen normalisieren
        text = re.sub(r"\s+", " ", text).strip()
        return text

    @staticmethod
    def _normalize_abkuerzung(abk: str) -> str:
        """Normalisiert Gesetzesabkuerzungen.

        z.B. 'SGB 9' -> 'SGB IX', 'Sozialgesetzbuch (SGB) ...' -> 'SGB IX'
        """
        # Roemische Zahlen-Mapping
        roman = {
            "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V",
            "6": "VI", "7": "VII", "8": "VIII", "9": "IX", "10": "X",
            "11": "XI", "12": "XII", "14": "XIV",
        }

        abk = abk.strip()

        # "SGB 9" / "SGB 9 2018" -> "SGB IX"
        match = re.match(r"^SGB\s+(\d+)(?:\s|$)", abk)
        if match:
            num = match.group(1)
            return f"SGB {roman.get(num, num)}"

        # Bekannte Abkuerzungen direkt zurueckgeben
        known = {
            "BGG", "AGG", "VersMedV", "BTHG", "GG", "BGB", "StGB", "ZPO",
            "StPO", "JGG", "OWiG", "VwGO", "VwVfG", "InsO", "ZVG", "FamFG",
            "BetrVG", "KSchG", "ArbZG", "MuSchG", "BEEG", "TzBfG",
            "EntgTranspG", "ArbSchG", "BUrlG", "EntgFG",
            "HGB", "GmbHG", "AktG", "GewO", "UWG", "GWB",
            "EStG", "KraftStG", "AO", "UStG", "GewStG", "KStG", "ErbStG",
            "AufenthG", "AsylG",
            "StVO", "StVG", "StVZO", "FZV", "FeV",
            "BImSchG", "BNatSchG", "WHG",
            "WEG", "BauGB", "BauNVO",
            "BDSG", "UrhG", "MarkenG", "PatG",
            "GVG", "BRAO", "RVG", "GKG",
            "StAG", "PStG", "BBG", "TKG",
            "WoGG", "BKGG", "AsylbLG",
        }
        if abk in known:
            return abk

        return abk

    async def download_and_parse_all(self) -> list[LawChunk]:
        """Laedt alle Gesetze herunter und parst sie zu Chunks."""
        all_chunks: list[LawChunk] = []
        paths = await self.download_all_sgb()

        for path in paths:
            try:
                chunks = self.parse_zip(path)
                all_chunks.extend(chunks)
            except Exception as e:
                logger.error("Fehler beim Parsen von %s: %s", path, e)

        logger.info("Gesamt: %d Chunks aus %d Gesetzen", len(all_chunks), len(paths))
        return all_chunks

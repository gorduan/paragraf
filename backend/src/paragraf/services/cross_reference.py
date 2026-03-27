"""CrossReferenceExtractor – Extraktion von Querverweisen aus deutschem Gesetzestext."""

from __future__ import annotations

import logging
import re

from paragraf.models.law import LAW_REGISTRY

logger = logging.getLogger(__name__)

# ── Regex-Bausteine ──────────────────────────────────────────────────────────

# Gesetzes-Abkuerzungen laengste zuerst fuer Longest-Match (Pitfall 1)
_SORTED_LAWS = sorted(LAW_REGISTRY.keys(), key=len, reverse=True)
_LAW_PATTERN = "|".join(re.escape(k) for k in _SORTED_LAWS)

# Kontext-Keywords vor Zitationen
_KONTEXT_RE = re.compile(
    r"(?P<kontext>i\.\s*V\.\s*m\.|gem(?:aess|ae(?:ss|ß)|\.)|nach|siehe|vgl\.)\s+",
    re.UNICODE,
)

# Mapping abgekuerzter Kontext-Keywords auf kanonische Form
_KONTEXT_MAP: dict[str, str] = {
    "gem.": "gemaess",
    "gemaess": "gemaess",
    "gemaeß": "gemaess",
    "gemaess": "gemaess",
    "nach": "nach",
    "siehe": "siehe",
    "vgl.": "siehe",
}

# ── Zitations-Muster ────────────────────────────────────────────────────────

# Einzelparagraph: § X [Abs. Y] GESETZ
_CITE_SINGLE = re.compile(
    r"(?:(?P<kontext>i\.\s*V\.\s*m\.|gem(?:aess|ae(?:ss|ß)|\.)|nach|siehe|vgl\.)\s+)?"
    r"§\s*(?P<num>\d+\w?)"
    r"(?:\s+Abs\.\s*(?P<abs>\d+))?"
    r"\s+(?P<gesetz>" + _LAW_PATTERN + r")"
    r"(?=[\s,;.\):\-]|$)",
    re.UNICODE,
)

# Artikel: Art. X [Abs. Y] GESETZ
_CITE_ARTIKEL = re.compile(
    r"(?:(?P<kontext>i\.\s*V\.\s*m\.|gem(?:aess|ae(?:ss|ß)|\.)|nach|siehe|vgl\.)\s+)?"
    r"Art\.?\s*(?P<num>\d+\w?)"
    r"(?:\s+Abs\.\s*(?P<abs>\d+))?"
    r"\s+(?P<gesetz>" + _LAW_PATTERN + r")"
    r"(?=[\s,;.\):\-]|$)",
    re.UNICODE,
)

# Plural: §§ X, Y[, Z] GESETZ
_CITE_PLURAL = re.compile(
    r"(?:(?P<kontext>i\.\s*V\.\s*m\.|gem(?:aess|ae(?:ss|ß)|\.)|nach|siehe|vgl\.)\s+)?"
    r"§§\s*(?P<nums>\d+\w?(?:\s*,\s*\d+\w?)+)"
    r"\s+(?P<gesetz>" + _LAW_PATTERN + r")"
    r"(?=[\s,;.\):\-]|$)",
    re.UNICODE,
)

# i.V.m.-Kette: § X [Abs. Y] i.V.m. § Z [Abs. W] GESETZ
_IVM_CHAIN = re.compile(
    r"§\s*(?P<num1>\d+\w?)"
    r"(?:\s+Abs\.\s*(?P<abs1>\d+))?"
    r"\s+i\.\s*V\.\s*m\.\s+"
    r"§\s*(?P<num2>\d+\w?)"
    r"(?:\s+Abs\.\s*(?P<abs2>\d+))?"
    r"\s+(?P<gesetz>" + _LAW_PATTERN + r")"
    r"(?=[\s,;.\):\-]|$)",
    re.UNICODE,
)

# Fallback: § X [Abs. Y] ohne bekanntes Gesetz (fuer unverified)
_CITE_UNKNOWN = re.compile(
    r"(?:(?P<kontext>i\.\s*V\.\s*m\.|gem(?:aess|ae(?:ss|ß)|\.)|nach|siehe|vgl\.)\s+)?"
    r"§\s*(?P<num>\d+\w?)"
    r"(?:\s+Abs\.\s*(?P<abs>\d+))?"
    r"\s+(?P<gesetz>[A-ZAEOEUE][A-Za-zaeoeueAEOEUEss/]+(?:\s+[IVXL]+)?)"
    r"(?=[\s,;.\):\-]|$)",
    re.UNICODE,
)


def _normalize_kontext(raw_kontext: str | None) -> str | None:
    """Normalisiert Kontext-Keywords auf kanonische Form."""
    if raw_kontext is None:
        return None
    cleaned = raw_kontext.strip()
    # Entferne optionale Whitespace in i.V.m.
    cleaned = re.sub(r"\s+", " ", cleaned)
    if cleaned.startswith("i.") or cleaned.startswith("i. "):
        return "i.V.m."
    return _KONTEXT_MAP.get(cleaned, cleaned)


class CrossReferenceExtractor:
    """Extrahiert Querverweise aus deutschem Gesetzestext.

    Unterstuetzte Muster:
    - § X GESETZ, § X Abs. Y GESETZ
    - Art. X GESETZ, Art. X Abs. Y GESETZ
    - §§ X, Y GESETZ (Plural)
    - § X Abs. Y i.V.m. § Z Abs. W GESETZ (Ketten)
    - Kontext-Keywords: gemaess, nach, siehe, vgl., i.V.m.
    """

    def extract(self, text: str) -> list[dict]:
        """Extrahiert alle Querverweise aus dem gegebenen Text.

        Args:
            text: Deutscher Gesetzestext mit potentiellen Zitationen.

        Returns:
            Liste von Referenz-Dicts mit den Feldern:
            gesetz, paragraph, absatz, raw, verified, kontext.
        """
        results: list[dict] = []
        seen: set[tuple[str, str, int | None]] = set()

        # 1. i.V.m.-Ketten (vor Einzelzitationen, da sie diese enthalten)
        for m in _IVM_CHAIN.finditer(text):
            gesetz = m.group("gesetz").strip()
            verified = gesetz in LAW_REGISTRY

            # Erstes Element der Kette
            num1 = m.group("num1")
            abs1 = int(m.group("abs1")) if m.group("abs1") else None
            key1 = (gesetz, f"§ {num1}", abs1)
            if key1 not in seen:
                seen.add(key1)
                results.append({
                    "gesetz": gesetz,
                    "paragraph": f"§ {num1}",
                    "absatz": abs1,
                    "raw": m.group(0).strip(),
                    "verified": verified,
                    "kontext": "i.V.m.",
                })

            # Zweites Element der Kette
            num2 = m.group("num2")
            abs2 = int(m.group("abs2")) if m.group("abs2") else None
            key2 = (gesetz, f"§ {num2}", abs2)
            if key2 not in seen:
                seen.add(key2)
                results.append({
                    "gesetz": gesetz,
                    "paragraph": f"§ {num2}",
                    "absatz": abs2,
                    "raw": m.group(0).strip(),
                    "verified": verified,
                    "kontext": None,
                })

        # 2. Plural-Zitationen: §§ X, Y GESETZ
        for m in _CITE_PLURAL.finditer(text):
            gesetz = m.group("gesetz").strip()
            verified = gesetz in LAW_REGISTRY
            kontext = _normalize_kontext(m.group("kontext"))
            nums_str = m.group("nums")
            nums = [n.strip() for n in nums_str.split(",")]
            for num in nums:
                key = (gesetz, f"§ {num}", None)
                if key not in seen:
                    seen.add(key)
                    results.append({
                        "gesetz": gesetz,
                        "paragraph": f"§ {num}",
                        "absatz": None,
                        "raw": m.group(0).strip(),
                        "verified": verified,
                        "kontext": kontext,
                    })

        # 3. Einzelparagraph-Zitationen: § X [Abs. Y] GESETZ
        for m in _CITE_SINGLE.finditer(text):
            gesetz = m.group("gesetz").strip()
            verified = gesetz in LAW_REGISTRY
            num = m.group("num")
            absatz = int(m.group("abs")) if m.group("abs") else None
            kontext = _normalize_kontext(m.group("kontext"))
            key = (gesetz, f"§ {num}", absatz)
            if key not in seen:
                seen.add(key)
                results.append({
                    "gesetz": gesetz,
                    "paragraph": f"§ {num}",
                    "absatz": absatz,
                    "raw": m.group(0).strip(),
                    "verified": verified,
                    "kontext": kontext,
                })

        # 4. Artikel-Zitationen: Art. X [Abs. Y] GESETZ
        for m in _CITE_ARTIKEL.finditer(text):
            gesetz = m.group("gesetz").strip()
            verified = gesetz in LAW_REGISTRY
            num = m.group("num")
            absatz = int(m.group("abs")) if m.group("abs") else None
            kontext = _normalize_kontext(m.group("kontext"))
            key = (gesetz, f"Art. {num}", absatz)
            if key not in seen:
                seen.add(key)
                results.append({
                    "gesetz": gesetz,
                    "paragraph": f"Art. {num}",
                    "absatz": absatz,
                    "raw": m.group(0).strip(),
                    "verified": verified,
                    "kontext": kontext,
                })

        # 5. Fallback: Unbekannte Gesetze (nicht im Registry)
        for m in _CITE_UNKNOWN.finditer(text):
            gesetz = m.group("gesetz").strip()
            if gesetz in LAW_REGISTRY:
                continue  # Bereits von obigen Patterns erfasst
            num = m.group("num")
            absatz = int(m.group("abs")) if m.group("abs") else None
            kontext = _normalize_kontext(m.group("kontext"))
            key = (gesetz, f"§ {num}", absatz)
            if key not in seen:
                seen.add(key)
                results.append({
                    "gesetz": gesetz,
                    "paragraph": f"§ {num}",
                    "absatz": absatz,
                    "raw": m.group(0).strip(),
                    "verified": False,
                    "kontext": kontext,
                })

        return results

"""Query Expansion – Juristisches Synonym-Woerterbuch fuer verbesserte Suche."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from paragraf.config import settings
from paragraf.data.synonyms import LEGAL_SYNONYMS
from paragraf.models.law import LAW_REGISTRY

logger = logging.getLogger(__name__)

# Arabisch-zu-roemisch Mapping fuer Gesetzesnummern
ROMAN_MAP: dict[str, str] = {
    "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V",
    "6": "VI", "7": "VII", "8": "VIII", "9": "IX", "10": "X",
    "11": "XI", "12": "XII", "14": "XIV",
}

# Regex: Gesetzesabkuerzung + arabische Zahl (z.B. "SGB 9", "SGB 12")
_ARABIC_LAW_RE = re.compile(r"\b([A-Z][A-Za-z]+)\s+(\d{1,2})\b")

# Maximale Expansionsterme pro Treffer (Vermeidung von Query-Dilution)
_MAX_EXPANSIONS_PER_MATCH = 3


class QueryExpander:
    """Erweitert Suchanfragen um juristische Synonyme und normalisierte Abkuerzungen.

    Baut einen Synonym-Index aus drei Quellen:
    1. LAW_REGISTRY (automatisch generierte Abkuerzung <-> Beschreibung Paare)
    2. LEGAL_SYNONYMS (kuratiertes Woerterbuch)
    3. Optionale JSON-Datei (Overrides/Erweiterungen ohne Code-Aenderung)
    """

    def __init__(self) -> None:
        self._synonyms: dict[str, list[str]] = {}
        self._build_index()
        self._load_json_overrides()

    def _build_index(self) -> None:
        """Baut den Synonym-Index aus LAW_REGISTRY und kuratierten Synonymen."""
        # 1. Automatische Synonyme aus LAW_REGISTRY
        for abk, law_def in LAW_REGISTRY.items():
            self._synonyms[abk.lower()] = [law_def.beschreibung]
            self._synonyms[law_def.beschreibung.lower()] = [abk]
            for tag in law_def.tags:
                self._synonyms.setdefault(tag.lower(), []).append(abk)

        # 2. Kuratierte Synonyme aus LEGAL_SYNONYMS
        for key, values in LEGAL_SYNONYMS.items():
            self._synonyms.setdefault(key.lower(), []).extend(values)

        # 3. Deduplizierung (Reihenfolge beibehalten)
        for key in self._synonyms:
            self._synonyms[key] = list(dict.fromkeys(self._synonyms[key]))

    def _load_json_overrides(self) -> None:
        """Laedt optionale JSON-Synonym-Datei fuer Overrides/Erweiterungen."""
        json_path = settings.synonyms_json_path
        if not json_path:
            return

        path = Path(json_path)
        if not path.exists():
            logger.warning("Synonym-JSON-Datei nicht gefunden: %s", json_path)
            return

        try:
            with path.open("r", encoding="utf-8") as f:
                overrides: dict[str, list[str]] = json.load(f)
            for key, values in overrides.items():
                self._synonyms.setdefault(key.lower(), []).extend(values)
                # Deduplizierung nach Merge
                self._synonyms[key.lower()] = list(
                    dict.fromkeys(self._synonyms[key.lower()])
                )
            logger.info("JSON-Synonyme geladen: %d Eintraege aus %s", len(overrides), json_path)
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning("Fehler beim Laden der Synonym-JSON-Datei %s: %s", json_path, exc)

    def _normalize_query(self, query: str) -> str:
        """Normalisiert arabische Zahlen in Gesetzesabkuerzungen zu roemischen.

        z.B. 'SGB 9' -> 'SGB IX', 'SGB 12' -> 'SGB XII'
        Ersetzt nur, wenn das Ergebnis in LAW_REGISTRY existiert.
        """

        def _replace_arabic(match: re.Match[str]) -> str:
            prefix = match.group(1)
            num = match.group(2)
            roman = ROMAN_MAP.get(num)
            if roman is None:
                return match.group(0)
            candidate = f"{prefix} {roman}"
            if candidate in LAW_REGISTRY:
                return candidate
            return match.group(0)

        return _ARABIC_LAW_RE.sub(_replace_arabic, query)

    def expand(self, query: str) -> tuple[str, list[str]]:
        """Erweitert eine Suchanfrage um juristische Synonyme.

        Args:
            query: Die urspruengliche Suchanfrage.

        Returns:
            Tuple aus (erweiterter Query-String, Liste der gefundenen Expansionsterme).
            Fuer die 'append'-Strategie wird der erweiterte String als
            Original + Expansionsterme zurueckgegeben.
        """
        normalized = self._normalize_query(query)
        tokens = normalized.split()
        found_terms: list[str] = []

        # Multi-Word-Matching (3-Gramme, 2-Gramme, dann Einzeltokens)
        matched_indices: set[int] = set()

        # 3-Gramme pruefen
        for i in range(len(tokens) - 2):
            trigram = " ".join(tokens[i : i + 3]).lower()
            if trigram in self._synonyms:
                expansions = self._synonyms[trigram][:_MAX_EXPANSIONS_PER_MATCH]
                found_terms.extend(expansions)
                matched_indices.update({i, i + 1, i + 2})

        # 2-Gramme pruefen
        for i in range(len(tokens) - 1):
            if i in matched_indices and i + 1 in matched_indices:
                continue
            bigram = " ".join(tokens[i : i + 2]).lower()
            if bigram in self._synonyms:
                expansions = self._synonyms[bigram][:_MAX_EXPANSIONS_PER_MATCH]
                found_terms.extend(expansions)
                matched_indices.update({i, i + 1})

        # Einzeltokens pruefen
        for i, token in enumerate(tokens):
            if i in matched_indices:
                continue
            key = token.lower()
            if key in self._synonyms:
                expansions = self._synonyms[key][:_MAX_EXPANSIONS_PER_MATCH]
                found_terms.extend(expansions)

        # Deduplizierung der Expansionsterme (Reihenfolge beibehalten)
        found_terms = list(dict.fromkeys(found_terms))

        # Append-Strategie: Original + Expansionsterme
        if found_terms:
            expanded_query = normalized + " " + " ".join(found_terms)
        else:
            expanded_query = normalized

        return expanded_query, found_terms

    @property
    def synonym_count(self) -> int:
        """Anzahl der Eintraege im Synonym-Index (fuer Diagnose)."""
        return len(self._synonyms)

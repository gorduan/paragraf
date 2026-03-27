"""Tests fuer den QueryExpander-Service."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from paragraf.services.query_expander import QueryExpander


# ── Index-Aufbau ─────────────────────────────────────────────────────────────


class TestQueryExpanderIndex:
    """Tests fuer den Aufbau des Synonym-Index."""

    def test_builds_from_law_registry(self):
        """Synonym-Index enthaelt Eintraege aus LAW_REGISTRY (95+ Gesetze)."""
        qe = QueryExpander()
        assert qe.synonym_count > 50

    def test_contains_law_abbreviation(self):
        """SGB IX ist als Schluessel im Index vorhanden."""
        qe = QueryExpander()
        assert "sgb ix" in qe._synonyms


# ── Expansion ────────────────────────────────────────────────────────────────


class TestQueryExpanderExpand:
    """Tests fuer die Synonym-Expansion von Suchanfragen."""

    def test_expand_gdb(self):
        """GdB wird zu 'Grad der Behinderung' expandiert."""
        qe = QueryExpander()
        expanded, terms = qe.expand("GdB")
        assert "Grad der Behinderung" in terms

    def test_expand_kuendigung(self):
        """Kuendigung Arbeitsrecht expandiert 'Entlassung' als Synonym."""
        qe = QueryExpander()
        expanded, terms = qe.expand("Kuendigung Arbeitsrecht")
        assert "Entlassung" in terms

    def test_no_expansion_for_unknown(self):
        """Unbekannte Begriffe liefern keine Expansionsterme."""
        qe = QueryExpander()
        _, terms = qe.expand("xyznonexistent")
        assert terms == []

    def test_expanded_string_contains_original(self):
        """Der erweiterte Query-String enthaelt den Originalbegriff."""
        qe = QueryExpander()
        expanded, _ = qe.expand("GdB")
        assert "GdB" in expanded


# ── Normalisierung ───────────────────────────────────────────────────────────


class TestQueryExpanderNormalize:
    """Tests fuer die arabisch-zu-roemisch Normalisierung."""

    def test_sgb_9_to_sgb_ix(self):
        """SGB 9 wird zu SGB IX normalisiert."""
        qe = QueryExpander()
        expanded, _ = qe.expand("SGB 9 Behinderung")
        assert "SGB IX" in expanded

    def test_sgb_12_to_sgb_xii(self):
        """SGB 12 wird zu SGB XII normalisiert."""
        qe = QueryExpander()
        expanded, _ = qe.expand("SGB 12 Grundsicherung")
        assert "SGB XII" in expanded


# ── JSON-Override ────────────────────────────────────────────────────────────


class TestQueryExpanderJsonOverride:
    """Tests fuer den optionalen JSON-Synonym-Override."""

    def test_json_override_loads(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """JSON-Datei mit Synonymen wird korrekt geladen und gemergt."""
        override_file = tmp_path / "synonyms.json"
        override_file.write_text(
            json.dumps({"test_synonym": ["override_val"]}),
            encoding="utf-8",
        )
        from paragraf.config import settings

        monkeypatch.setattr(settings, "synonyms_json_path", str(override_file))
        qe = QueryExpander()
        assert "test_synonym" in qe._synonyms
        assert "override_val" in qe._synonyms["test_synonym"]

    def test_missing_json_no_crash(self, monkeypatch: pytest.MonkeyPatch):
        """Nicht-existente JSON-Datei fuehrt nicht zum Absturz."""
        from paragraf.config import settings

        monkeypatch.setattr(settings, "synonyms_json_path", "/nonexistent/path.json")
        # Darf keine Exception werfen
        qe = QueryExpander()
        assert qe.synonym_count > 0

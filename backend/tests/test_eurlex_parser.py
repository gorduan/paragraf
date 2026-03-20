"""Tests fuer den EUR-Lex HTML-Parser."""

from __future__ import annotations

from paragraf.services.eurlex_parser import EurLexParser

# Minimales HTML im EUR-Lex-Format
SAMPLE_EURLEX_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Test DSGVO</title></head>
<body>
<div class="eli-subdivision">
  <h2>KAPITEL I - Allgemeine Bestimmungen</h2>
</div>
<div class="eli-subdivision">
  <h2>Artikel 1 - Gegenstand und Ziele</h2>
  <p>(1) Diese Verordnung enthält Vorschriften zum Schutz natuerlicher Personen
  bei der Verarbeitung personenbezogener Daten und zum freien Verkehr solcher Daten.</p>
  <p>(2) Diese Verordnung schuetzt die Grundrechte und Grundfreiheiten natuerlicher
  Personen und insbesondere deren Recht auf Schutz personenbezogener Daten.</p>
</div>
<div class="eli-subdivision">
  <h2>Artikel 2 - Sachlicher Anwendungsbereich</h2>
  <p>(1) Diese Verordnung gilt fuer die ganz oder teilweise automatisierte
  Verarbeitung personenbezogener Daten sowie fuer die nichtautomatisierte
  Verarbeitung personenbezogener Daten, die in einem Dateisystem gespeichert
  sind oder gespeichert werden sollen.</p>
</div>
<div class="eli-subdivision">
  <h2>KAPITEL II - Grundsaetze</h2>
</div>
<div class="eli-subdivision">
  <h2>Artikel 5 - Grundsaetze fuer die Verarbeitung personenbezogener Daten</h2>
  <p>(1) Personenbezogene Daten muessen auf rechtmaessige Weise verarbeitet werden.</p>
  <p>(2) Der Verantwortliche ist fuer die Einhaltung verantwortlich.</p>
</div>
</body>
</html>
"""


class TestEurLexParser:
    """Tests fuer den EUR-Lex HTML-Parser."""

    def setup_method(self):
        self.parser = EurLexParser()

    def test_parse_returns_chunks(self):
        chunks = self.parser.parse_html(SAMPLE_EURLEX_HTML, "DSGVO")
        assert len(chunks) >= 3

    def test_article_extraction(self):
        chunks = self.parser.parse_html(SAMPLE_EURLEX_HTML, "DSGVO")
        paragraphs = [c.metadata.paragraph for c in chunks]
        assert any("1" in p for p in paragraphs)
        assert any("2" in p for p in paragraphs)
        assert any("5" in p for p in paragraphs)

    def test_chunk_metadata_quelle(self):
        chunks = self.parser.parse_html(SAMPLE_EURLEX_HTML, "DSGVO")
        for chunk in chunks:
            assert chunk.metadata.quelle == "eur-lex.europa.eu"
            assert chunk.metadata.gesetz == "DSGVO"

    def test_chunk_has_text(self):
        chunks = self.parser.parse_html(SAMPLE_EURLEX_HTML, "DSGVO")
        for chunk in chunks:
            assert len(chunk.text) > 20

    def test_chunk_ids_unique(self):
        chunks = self.parser.parse_html(SAMPLE_EURLEX_HTML, "DSGVO")
        ids = [c.id for c in chunks]
        assert len(ids) == len(set(ids))

    def test_abschnitt_tracking(self):
        chunks = self.parser.parse_html(SAMPLE_EURLEX_HTML, "DSGVO")
        # Art. 5 should have KAPITEL II as abschnitt
        art5 = [c for c in chunks if "5" in c.metadata.paragraph]
        assert len(art5) >= 1
        assert "KAPITEL II" in art5[0].metadata.abschnitt

    def test_empty_html(self):
        chunks = self.parser.parse_html("<html><body></body></html>", "TEST")
        assert chunks == []

    def test_fallback_strategy(self):
        """HTML ohne Artikel-Ueberschriften nutzt Fallback."""
        html = "<html><body><p>Ein langer Text der keine Artikel enthaelt aber genug Inhalt hat um als Chunk zu gelten und mindestens fuenfzig Zeichen haben sollte.</p></body></html>"
        chunks = self.parser.parse_html(html, "TEST")
        assert len(chunks) >= 1

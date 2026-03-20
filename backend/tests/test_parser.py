"""Tests fuer den XML-Parser."""

from __future__ import annotations

from paragraf.services.parser import GesetzParser

# Minimales XML im gesetze-im-internet.de Format
SAMPLE_XML = """\
<?xml version="1.0" encoding="UTF-8"?>
<dokumente builddate="20240101" doknr="BJNR000020963">
  <norm doknr="BJNR000020963BJNG000100000">
    <metadaten>
      <jurabk>SGB 9</jurabk>
    </metadaten>
  </norm>
  <norm doknr="BJNR000020963BJNE000100000">
    <metadaten>
      <jurabk>SGB 9</jurabk>
      <enbez>\u00a7 1</enbez>
      <titel format="parat">Selbstbestimmung und Teilhabe am Leben in der Gesellschaft</titel>
      <gliederungseinheit>
        <gliederungsbez>Teil 1</gliederungsbez>
        <gliederungstitel>Regelungen f\u00fcr Menschen mit Behinderungen</gliederungstitel>
      </gliederungseinheit>
    </metadaten>
    <textdaten>
      <text format="XML">
        <Content>
          <P>Menschen mit Behinderungen oder von Behinderung bedrohte Menschen erhalten
          Leistungen nach diesem Buch, um ihre Selbstbestimmung und ihre volle, wirksame
          und gleichberechtigte Teilhabe am Leben in der Gesellschaft zu f\u00f6rdern.</P>
          <P>Besondere Bed\u00fcrfnisse von Frauen und Kindern mit Behinderungen werden
          ber\u00fccksichtigt.</P>
        </Content>
      </text>
    </textdaten>
  </norm>
  <norm doknr="BJNR000020963BJNE000200000">
    <metadaten>
      <jurabk>SGB 9</jurabk>
      <enbez>\u00a7 2</enbez>
      <titel format="parat">Begriffsbestimmungen</titel>
    </metadaten>
    <textdaten>
      <text format="XML">
        <Content>
          <P>Menschen mit Behinderungen sind Menschen, die k\u00f6rperliche, seelische,
          geistige oder Sinnesbeeintr\u00e4chtigungen haben, die sie in Wechselwirkung mit
          einstellungs- und umweltbedingten Barrieren an der gleichberechtigten Teilhabe
          an der Gesellschaft mit hoher Wahrscheinlichkeit l\u00e4nger als sechs Monate
          hindern k\u00f6nnen.</P>
        </Content>
      </text>
    </textdaten>
  </norm>
</dokumente>
""".encode()


class TestGesetzParser:
    """Tests fuer das XML-Parsing."""

    def setup_method(self):
        self.parser = GesetzParser()

    def test_parse_xml_returns_chunks(self):
        chunks = self.parser.parse_xml(SAMPLE_XML)
        assert len(chunks) >= 2
        assert all(c.text for c in chunks)

    def test_chunk_metadata(self):
        chunks = self.parser.parse_xml(SAMPLE_XML)

        # Finde Paragraph 1
        p1 = next((c for c in chunks if c.metadata.paragraph == "\u00a7 1"), None)
        assert p1 is not None
        assert p1.metadata.gesetz == "SGB IX"
        assert p1.metadata.titel == "Selbstbestimmung und Teilhabe am Leben in der Gesellschaft"
        assert "Teil 1" in p1.metadata.abschnitt

    def test_abkuerzung_normalisierung(self):
        assert GesetzParser._normalize_abkuerzung("SGB 9") == "SGB IX"
        assert GesetzParser._normalize_abkuerzung("SGB 1") == "SGB I"
        assert GesetzParser._normalize_abkuerzung("SGB 12") == "SGB XII"
        assert GesetzParser._normalize_abkuerzung("BGG") == "BGG"

    def test_abkuerzung_neue_gesetze(self):
        """Neue Gesetzesabkuerzungen werden korrekt erkannt."""
        assert GesetzParser._normalize_abkuerzung("BGB") == "BGB"
        assert GesetzParser._normalize_abkuerzung("StGB") == "StGB"
        assert GesetzParser._normalize_abkuerzung("ZPO") == "ZPO"
        assert GesetzParser._normalize_abkuerzung("GG") == "GG"
        assert GesetzParser._normalize_abkuerzung("AO") == "AO"
        assert GesetzParser._normalize_abkuerzung("BetrVG") == "BetrVG"
        assert GesetzParser._normalize_abkuerzung("HGB") == "HGB"
        assert GesetzParser._normalize_abkuerzung("StVO") == "StVO"
        assert GesetzParser._normalize_abkuerzung("BDSG") == "BDSG"
        assert GesetzParser._normalize_abkuerzung("UrhG") == "UrhG"

    def test_paragraph_text_content(self):
        chunks = self.parser.parse_xml(SAMPLE_XML)
        p2 = next((c for c in chunks if c.metadata.paragraph == "\u00a7 2"), None)
        assert p2 is not None
        assert "Behinderungen" in p2.text
        assert "sechs Monate" in p2.text

    def test_hierarchie_pfad(self):
        chunks = self.parser.parse_xml(SAMPLE_XML)
        p1 = next((c for c in chunks if c.metadata.paragraph == "\u00a7 1"), None)
        assert p1 is not None
        assert "SGB IX" in p1.metadata.hierarchie_pfad
        assert "\u00a7 1" in p1.metadata.hierarchie_pfad

    def test_chunk_ids_unique(self):
        chunks = self.parser.parse_xml(SAMPLE_XML)
        ids = [c.id for c in chunks]
        # Paragraph-Level Chunks sollten einzigartig sein
        para_ids = [i for i in ids if "Abs" not in i]
        assert len(para_ids) == len(set(para_ids))

    def test_long_paragraph_creates_absatz_chunks(self):
        """Lange Paragraphen mit >1 Absatz sollten zusaetzliche Absatz-Chunks erzeugen."""
        chunks = self.parser.parse_xml(SAMPLE_XML)
        absatz_chunks = [c for c in chunks if c.metadata.chunk_typ == "absatz"]
        assert isinstance(absatz_chunks, list)


class TestSearchFilter:
    """Tests fuer Suchfilter-Modelle."""

    def test_search_filter_creation(self):
        from paragraf.models.law import SearchFilter

        f = SearchFilter(gesetz="SGB IX", paragraph="\u00a7 152")
        assert f.gesetz == "SGB IX"
        assert f.paragraph == "\u00a7 152"

    def test_search_result_zitation(self):
        from paragraf.models.law import ChunkMetadata, LawChunk, SearchResult

        chunk = LawChunk(
            id="test",
            text="Testtext",
            metadata=ChunkMetadata(
                gesetz="SGB IX",
                paragraph="\u00a7 152",
                absatz=1,
                titel="Feststellung der Behinderung",
            ),
        )
        result = SearchResult(chunk=chunk, score=0.95, rank=1)
        assert "\u00a7 152" in result.zitation
        assert "SGB IX" in result.zitation
        assert "Abs. 1" in result.zitation

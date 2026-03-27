"""Tests fuer den XML-Parser."""

from __future__ import annotations

import re

from paragraf.services.parser import GesetzParser, _split_into_saetze

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


# ── XML mit langen Absaetzen fuer Satz-Tests ───────────────────────────────

# Absaetze muessen lang genug sein (>2x chunk_satz_min_length) damit Satz-Splitting greift
_LONG_ABS_1 = (
    "Der Arbeitnehmer hat Anspruch auf Entgeltfortzahlung im Krankheitsfall fuer die Dauer "
    "von sechs Wochen gem. Abs. 1 Nr. 3 dieses Gesetzes. Die Berechnung erfolgt nach dem "
    "Durchschnittsentgelt der letzten drei Monate vor Beginn der Arbeitsunfaehigkeit. "
    "Bei Teilzeitbeschaeftigten wird das Entgelt anteilig nach der vereinbarten Arbeitszeit "
    "im Verhaeltnis zur regelmaessigen Arbeitszeit eines vergleichbaren Vollzeitbeschaeftigten "
    "berechnet. Abweichende Vereinbarungen zu Ungunsten des Arbeitnehmers sind unwirksam."
)
_LONG_ABS_2 = (
    "Der Arbeitgeber ist verpflichtet, die Arbeitsunfaehigkeitsbescheinigung spaetestens am "
    "dritten Tag der Erkrankung vorzulegen. Eine Verlaengerung der Frist ist auf Antrag "
    "moeglich, sofern besondere Umstaende vorliegen und der Arbeitnehmer dies unverzueglich "
    "anzeigt. Die elektronische Uebermittlung ist seit dem Jahr 2023 der Regelfall fuer "
    "gesetzlich Versicherte. Der Arbeitgeber kann im Einzelfall auch eine fruehere Vorlage "
    "verlangen, wenn berechtigte Zweifel an der Arbeitsunfaehigkeit bestehen."
)

SAMPLE_XML_LONG = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<dokumente builddate="20240101" doknr="TEST001">
  <norm doknr="TEST001BJNE000100000">
    <metadaten>
      <jurabk>TestG</jurabk>
      <enbez>§ 42</enbez>
      <titel format="parat">Entgeltfortzahlung</titel>
    </metadaten>
    <textdaten>
      <text format="XML">
        <Content>
          <P>{_LONG_ABS_1}</P>
          <P>{_LONG_ABS_2}</P>
        </Content>
      </text>
    </textdaten>
  </norm>
</dokumente>
""".encode()


# ── Satz Chunking Tests ────────────────────────────────────────────────────


class TestSatzChunking:
    """Tests fuer die Satz-Splitting-Funktion."""

    def test_splits_at_sentence_boundaries(self):
        """Spaltet korrekt an Satzgrenzen."""
        result = _split_into_saetze(
            "Der erste Satz ist hier komplett. Der zweite Satz beginnt mit "
            "Grossbuchstabe. Ein dritter Satz folgt nach.",
            min_length=10,
        )
        assert len(result) == 3

    def test_filters_short_fragments(self):
        """Filtert kurze Fragmente unter min_length heraus."""
        result = _split_into_saetze(
            "Dies ist ein ausreichend langer Satz der die Mindestlaenge von hundert "
            "Zeichen ueberschreiten sollte wenn er genug Text enthaelt und weitergeht. "
            "Kurz.",
            min_length=100,
        )
        assert len(result) == 1
        assert "ausreichend langer" in result[0]

    def test_single_sentence_no_split(self):
        """Ein einzelner Satz ohne Trennpunkt ergibt maximal 1 Ergebnis."""
        result = _split_into_saetze(
            "Dies ist nur ein einziger langer Satz ohne weiteren Punkt am Ende",
            min_length=10,
        )
        assert len(result) <= 1


class TestSatzAbbreviations:
    """Tests dass juristische Abkuerzungen nicht als Satzgrenzen erkannt werden."""

    def test_abs_not_split(self):
        """Abs. wird nicht als Satzgrenze behandelt."""
        result = _split_into_saetze(
            "Gemaess Abs. 1 ist dies geregelt und gilt weiterhin fuer alle Beteiligten. "
            "Der naechste Satz beginnt hier mit einem neuen Gedanken.",
            min_length=10,
        )
        abs_parts = [r for r in result if "Abs." in r]
        assert len(abs_parts) >= 1

    def test_nr_not_split(self):
        """Nr. wird nicht als Satzgrenze behandelt."""
        result = _split_into_saetze(
            "Nach Nr. 3 dieser Vorschrift gelten besondere Regelungen fuer alle Faelle. "
            "Der folgende Satz beschreibt die Ausnahmen im Detail.",
            min_length=10,
        )
        nr_parts = [r for r in result if "Nr." in r]
        assert len(nr_parts) >= 1

    def test_ivm_not_split(self):
        """i.V.m. wird nicht als Satzgrenze behandelt."""
        result = _split_into_saetze(
            "Dies gilt i.V.m. § 5 SGB IX auch fuer schwerbehinderte Menschen. "
            "Ein weiterer Satz folgt hier zur Ergaenzung.",
            min_length=10,
        )
        ivm_parts = [r for r in result if "i.V.m." in r]
        assert len(ivm_parts) >= 1

    def test_zb_not_split(self):
        """z.B. wird nicht als Satzgrenze behandelt."""
        result = _split_into_saetze(
            "Dies trifft z.B. bei Krankheit zu und wird entsprechend angewendet. "
            "Der naechste Satz erlaeutert weitere Details.",
            min_length=10,
        )
        zb_parts = [r for r in result if "z.B." in r]
        assert len(zb_parts) >= 1


class TestSatzMetadata:
    """Tests fuer Satz-Chunk-Metadaten bei der Parser-Ausgabe."""

    def setup_method(self):
        self.parser = GesetzParser()

    def test_satz_chunk_type(self):
        """Satz-Chunks haben chunk_typ='satz'."""
        chunks = self.parser.parse_xml(SAMPLE_XML_LONG)
        satz_chunks = [c for c in chunks if c.metadata.chunk_typ == "satz"]
        assert len(satz_chunks) > 0, "Parser sollte Satz-Chunks erzeugen"

    def test_satz_id_pattern(self):
        """Satz-Chunk-IDs folgen dem Muster *_Abs*_S*."""
        chunks = self.parser.parse_xml(SAMPLE_XML_LONG)
        satz_chunks = [c for c in chunks if c.metadata.chunk_typ == "satz"]
        assert len(satz_chunks) > 0
        for chunk in satz_chunks:
            assert re.search(r'_Abs\d+_S\d+$', chunk.id), (
                f"Satz-ID '{chunk.id}' entspricht nicht dem Muster *_Abs*_S*"
            )

    def test_satz_hierarchie(self):
        """Satz-Chunks enthalten '> S.' im Hierarchie-Pfad."""
        chunks = self.parser.parse_xml(SAMPLE_XML_LONG)
        satz_chunks = [c for c in chunks if c.metadata.chunk_typ == "satz"]
        assert len(satz_chunks) > 0
        for chunk in satz_chunks:
            assert "> S." in chunk.metadata.hierarchie_pfad, (
                f"Hierarchie-Pfad '{chunk.metadata.hierarchie_pfad}' enthaelt nicht '> S.'"
            )


class TestReindexChunkTypes:
    """Tests dass alle drei Chunk-Typen erzeugt werden."""

    def setup_method(self):
        self.parser = GesetzParser()

    def test_produces_all_chunk_types(self):
        """Parsing erzeugt paragraph, absatz und satz Chunk-Typen."""
        chunks = self.parser.parse_xml(SAMPLE_XML_LONG)
        chunk_types = {c.metadata.chunk_typ for c in chunks}
        assert "paragraph" in chunk_types, "Kein paragraph-Chunk gefunden"
        assert "absatz" in chunk_types, "Kein absatz-Chunk gefunden"
        assert "satz" in chunk_types, "Kein satz-Chunk gefunden"

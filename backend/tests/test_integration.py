"""Integrationstests fuer die gesamte Pipeline.

Diese Tests pruefen das Zusammenspiel der Komponenten,
ohne externe Services (Qdrant, ML-Modelle) zu benoetigen.
"""

from __future__ import annotations

from paragraf.models.law import (
    GESETZ_DOWNLOAD_SLUGS,
    ChunkMetadata,
    LawChunk,
    SearchFilter,
    SearchResult,
)
from paragraf.services.parser import GesetzParser
from paragraf.services.reranker import RerankerService, long_context_reorder

# ── Sample-XML fuer Tests ─────────────────────────────────────────────────────

SAMPLE_SGB_IX_XML = """\
<?xml version="1.0" encoding="UTF-8"?>
<dokumente builddate="20240101" doknr="BJNR323410016">
  <norm doknr="BJNR323410016BJNG000100000">
    <metadaten>
      <jurabk>SGB 9</jurabk>
      <gliederungseinheit>
        <gliederungsbez>Teil 1</gliederungsbez>
        <gliederungstitel>Regelungen fuer Menschen mit Behinderungen und von Behinderung bedrohte Menschen</gliederungstitel>
      </gliederungseinheit>
    </metadaten>
  </norm>
  <norm doknr="BJNR323410016BJNE000100000">
    <metadaten>
      <jurabk>SGB 9</jurabk>
      <enbez>\u00a7 1</enbez>
      <titel format="parat">Selbstbestimmung und Teilhabe am Leben in der Gesellschaft</titel>
    </metadaten>
    <textdaten>
      <text format="XML">
        <Content>
          <P>Menschen mit Behinderungen oder von Behinderung bedrohte Menschen erhalten
          Leistungen nach diesem Buch und den fuer die Rehabilitationstraeger geltenden
          Leistungsgesetzen, um ihre Selbstbestimmung und ihre volle, wirksame und
          gleichberechtigte Teilhabe am Leben in der Gesellschaft zu foerdern, Benachteiligungen
          zu vermeiden oder ihnen entgegenzuwirken.</P>
          <P>Dabei wird den besonderen Beduerfnissen von Frauen und Kindern mit Behinderungen
          und von Behinderung bedrohter Frauen und Kinder sowie Menschen mit seelischen
          Behinderungen oder von einer solchen Behinderung bedrohter Menschen Rechnung getragen.</P>
        </Content>
      </text>
    </textdaten>
  </norm>
  <norm doknr="BJNR323410016BJNE000200000">
    <metadaten>
      <jurabk>SGB 9</jurabk>
      <enbez>\u00a7 2</enbez>
      <titel format="parat">Begriffsbestimmungen</titel>
    </metadaten>
    <textdaten>
      <text format="XML">
        <Content>
          <P>Menschen mit Behinderungen sind Menschen, die koerperliche, seelische,
          geistige oder Sinnesbeeintraechtigungen haben, die sie in Wechselwirkung mit
          einstellungs- und umweltbedingten Barrieren an der gleichberechtigten Teilhabe
          an der Gesellschaft mit hoher Wahrscheinlichkeit laenger als sechs Monate
          hindern koennen. Eine Beeintraechtigung nach Satz 1 liegt vor, wenn der
          Koerper- und Gesundheitszustand von dem fuer das Lebensalter typischen Zustand
          abweicht.</P>
          <P>Menschen sind von Behinderung bedroht, wenn eine Beeintraechtigung nach
          Absatz 1 zu erwarten ist.</P>
          <P>Menschen sind im Sinne des Teils 3 schwerbehindert, wenn bei ihnen ein
          Grad der Behinderung von wenigstens 50 vorliegt und sie ihren Wohnsitz, ihren
          gewoehnlichen Aufenthalt oder ihre Beschaeftigung auf einem Arbeitsplatz im
          Sinne des Paragrafen 156 rechtmaessig im Geltungsbereich dieses Gesetzbuches haben.</P>
        </Content>
      </text>
    </textdaten>
  </norm>
  <norm doknr="BJNR323410016BJNE015200000">
    <metadaten>
      <jurabk>SGB 9</jurabk>
      <enbez>\u00a7 152</enbez>
      <titel format="parat">Feststellung der Behinderung, Ausweise</titel>
      <gliederungseinheit>
        <gliederungsbez>Teil 3</gliederungsbez>
        <gliederungstitel>Besondere Regelungen zur Teilhabe schwerbehinderter Menschen (Schwerbehindertenrecht)</gliederungstitel>
      </gliederungseinheit>
    </metadaten>
    <textdaten>
      <text format="XML">
        <Content>
          <P>Auf Antrag des behinderten Menschen stellen die fuer die Durchfuehrung des
          Bundesversorgungsgesetzes zustaendigen Behoerden das Vorliegen einer Behinderung
          und den Grad der Behinderung zum Zeitpunkt der Antragstellung fest.</P>
          <P>Auf Antrag kann festgestellt werden, dass ein Grad der Behinderung oder
          gesundheitliche Merkmale bereits zu einem frueheren Zeitpunkt vorgelegen haben.</P>
          <P>Ist der behinderte Mensch verstorben, wird die Feststellung auf Antrag
          der Hinterbliebenen getroffen.</P>
        </Content>
      </text>
    </textdaten>
  </norm>
</dokumente>
""".encode()


class TestParsingPipeline:
    """Integration: Parser -> Chunks -> Metadaten."""

    def setup_method(self):
        self.parser = GesetzParser()
        self.chunks = self.parser.parse_xml(SAMPLE_SGB_IX_XML)

    def test_parse_produces_chunks(self):
        assert len(self.chunks) >= 3

    def test_all_chunks_have_text(self):
        for chunk in self.chunks:
            assert len(chunk.text) > 20

    def test_all_chunks_have_gesetz(self):
        for chunk in self.chunks:
            assert chunk.metadata.gesetz == "SGB IX"

    def test_paragraphs_found(self):
        paras = {c.metadata.paragraph for c in self.chunks if c.metadata.chunk_typ == "paragraph"}
        assert "§ 1" in paras
        assert "§ 2" in paras
        assert "§ 152" in paras

    def test_abschnitt_tracked(self):
        p152 = next(
            c for c in self.chunks
            if c.metadata.paragraph == "§ 152" and c.metadata.chunk_typ == "paragraph"
        )
        assert "Teil 3" in p152.metadata.abschnitt

    def test_long_paragraph_has_absatz_chunks(self):
        absatz_chunks = [
            c for c in self.chunks
            if c.metadata.paragraph == "§ 2" and c.metadata.chunk_typ == "absatz"
        ]
        if absatz_chunks:
            assert all(c.metadata.absatz is not None for c in absatz_chunks)

    def test_hierarchie_pfad_format(self):
        for chunk in self.chunks:
            if chunk.metadata.chunk_typ == "paragraph":
                assert "SGB IX" in chunk.metadata.hierarchie_pfad
                assert chunk.metadata.paragraph in chunk.metadata.hierarchie_pfad

    def test_chunk_ids_contain_gesetz(self):
        for chunk in self.chunks:
            assert "SGB" in chunk.id or "§" in chunk.id


class TestRerankerPipeline:
    """Integration: Search Results -> Reranker -> LongContextReorder."""

    def _make_results(self, n: int = 10) -> list[SearchResult]:
        return [
            SearchResult(
                chunk=LawChunk(
                    id=f"SGB_IX_§{i}",
                    text=f"Testtext zu Paragraph {i} des SGB IX",
                    metadata=ChunkMetadata(
                        gesetz="SGB IX",
                        paragraph=f"§ {i}",
                        titel=f"Test-Titel {i}",
                    ),
                ),
                score=1.0 - i * 0.05,
                rank=i + 1,
            )
            for i in range(n)
        ]

    def test_reranker_then_reorder(self):
        results = self._make_results(10)
        reranker = RerankerService(top_k=5)
        reranked = reranker.rerank("Schwerbehinderung", results, top_k=5)
        assert len(reranked) == 5

        reordered = long_context_reorder(reranked)
        assert len(reordered) == 5

        reranked_ids = {r.chunk.id for r in reranked}
        reordered_ids = {r.chunk.id for r in reordered}
        assert reranked_ids == reordered_ids

    def test_zitation_formatting(self):
        results = self._make_results(1)
        zit = results[0].zitation
        assert "SGB IX" in zit
        assert "§ 0" in zit


class TestSearchFilter:
    """Integration: Filter-Erstellung und Validierung."""

    def test_filter_matches_gesetz_download_slugs(self):
        for gesetz in GESETZ_DOWNLOAD_SLUGS:
            f = SearchFilter(gesetz=gesetz)
            assert f.gesetz == gesetz

"""Tests fuer den CrossReferenceExtractor Service."""

from __future__ import annotations

from paragraf.services.cross_reference import CrossReferenceExtractor


class TestCrossReferenceExtractorBasic:
    """Grundlegende Extraktion von Einzelzitationen."""

    def test_single_paragraph_citation(self):
        """extract('§ 152 SGB IX') liefert eine Referenz mit korrekten Feldern."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 152 SGB IX")
        assert len(refs) == 1
        assert refs[0]["gesetz"] == "SGB IX"
        assert refs[0]["paragraph"] == "§ 152"
        assert refs[0]["absatz"] is None
        assert refs[0]["verified"] is True

    def test_paragraph_with_absatz(self):
        """extract('§ 5 Abs. 1 SGB IX') liefert Referenz mit absatz=1."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 5 Abs. 1 SGB IX")
        assert len(refs) == 1
        assert refs[0]["absatz"] == 1
        assert refs[0]["gesetz"] == "SGB IX"
        assert refs[0]["paragraph"] == "§ 5"

    def test_artikel_citation(self):
        """extract('Art. 3 GG') liefert Referenz mit paragraph='Art. 3'."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("Art. 3 GG")
        assert len(refs) == 1
        assert refs[0]["gesetz"] == "GG"
        assert refs[0]["paragraph"] == "Art. 3"

    def test_artikel_with_absatz(self):
        """Art. X Abs. Y GESETZ wird korrekt erkannt."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("Art. 6 Abs. 1 GG")
        assert len(refs) == 1
        assert refs[0]["paragraph"] == "Art. 6"
        assert refs[0]["absatz"] == 1
        assert refs[0]["gesetz"] == "GG"

    def test_no_references(self):
        """Text ohne Referenzen liefert leere Liste."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("Text ohne Referenzen")
        assert refs == []


class TestCrossReferenceExtractorVerification:
    """Verified/Unverified-Tagging basierend auf LAW_REGISTRY."""

    def test_verified_known_law(self):
        """Bekannte Gesetze werden als verified=True markiert."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 1 BGB")
        assert len(refs) == 1
        assert refs[0]["verified"] is True

    def test_unverified_unknown_law(self):
        """Unbekannte Gesetze werden als verified=False markiert."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 999 FAKELAW")
        assert len(refs) == 1
        assert refs[0]["verified"] is False


class TestCrossReferenceExtractorKontext:
    """Kontext-Keywords (i.V.m., gemaess, nach, siehe) werden erkannt."""

    def test_gemaess_keyword(self):
        """'gemaess § 823 BGB' liefert kontext='gemaess'."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("gemaess § 823 BGB")
        assert len(refs) == 1
        assert refs[0]["kontext"] == "gemaess"

    def test_nach_keyword(self):
        """'nach § 7 Abs. 2 SGB IV' liefert kontext='nach'."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("nach § 7 Abs. 2 SGB IV")
        assert len(refs) == 1
        assert refs[0]["kontext"] == "nach"

    def test_siehe_keyword(self):
        """'siehe § 12 StGB' liefert kontext='siehe'."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("siehe § 12 StGB")
        assert len(refs) == 1
        assert refs[0]["kontext"] == "siehe"

    def test_vgl_keyword(self):
        """'vgl. § 1 BGB' liefert kontext='siehe'."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("vgl. § 1 BGB")
        assert len(refs) == 1
        assert refs[0]["kontext"] == "siehe"

    def test_no_kontext(self):
        """Zitation ohne Kontext-Keyword hat kontext=None."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 1 BGB")
        assert len(refs) == 1
        assert refs[0]["kontext"] is None


class TestCrossReferenceExtractorIvm:
    """i.V.m.-Ketten werden korrekt gesplittet."""

    def test_ivm_chain_two_refs(self):
        """i.V.m.-Kette mit 2 Referenzen liefert 2 Ergebnisse."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 5 Abs. 1 i.V.m. § 6 Abs. 2 SGB IX")
        assert len(refs) == 2
        # Beide muessen SGB IX als Gesetz haben
        gesetze = {r["gesetz"] for r in refs}
        assert gesetze == {"SGB IX"}

    def test_ivm_chain_law_propagation(self):
        """Gesetz-Abkuerzung wird vom letzten Element propagiert."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 5 Abs. 1 i.V.m. § 6 Abs. 2 SGB IX")
        # Erste Referenz (§ 5) muss SGB IX vom Ende propagiert bekommen
        ref_5 = next(r for r in refs if r["paragraph"] == "§ 5")
        assert ref_5["gesetz"] == "SGB IX"
        assert ref_5["absatz"] == 1

    def test_ivm_kontext_marked(self):
        """Frueheres Element in i.V.m.-Kette hat kontext='i.V.m.'."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 5 Abs. 1 i.V.m. § 6 Abs. 2 SGB IX")
        ref_5 = next(r for r in refs if r["paragraph"] == "§ 5")
        assert ref_5["kontext"] == "i.V.m."


class TestCrossReferenceExtractorPlural:
    """SSSS-Pluralzitationen werden korrekt gesplittet."""

    def test_plural_two_paragraphs(self):
        """'§§ 36, 37 SGB XI' liefert 2 separate Referenzen."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§§ 36, 37 SGB XI")
        assert len(refs) == 2
        paragraphs = {r["paragraph"] for r in refs}
        assert "§ 36" in paragraphs
        assert "§ 37" in paragraphs
        for r in refs:
            assert r["gesetz"] == "SGB XI"

    def test_plural_three_paragraphs(self):
        """'§§ 1, 2, 3 BGB' liefert 3 separate Referenzen."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§§ 1, 2, 3 BGB")
        assert len(refs) == 3


class TestCrossReferenceExtractorMultiple:
    """Mehrere verschiedene Zitationen in einem Text."""

    def test_multiple_citations(self):
        """Text mit mehreren verschiedenen Zitationen liefert alle."""
        ext = CrossReferenceExtractor()
        text = "Gemaess § 823 BGB in Verbindung mit Art. 3 GG und § 152 SGB IX."
        refs = ext.extract(text)
        assert len(refs) >= 3
        gesetze = {r["gesetz"] for r in refs}
        assert "BGB" in gesetze
        assert "GG" in gesetze
        assert "SGB IX" in gesetze

    def test_raw_field_contains_original(self):
        """Das raw-Feld enthaelt den originalen Zitationstext."""
        ext = CrossReferenceExtractor()
        refs = ext.extract("§ 152 Abs. 1 SGB IX")
        assert len(refs) == 1
        assert "152" in refs[0]["raw"]
        assert "SGB IX" in refs[0]["raw"]

    def test_deduplication(self):
        """Doppelte Zitationen werden dedupliziert."""
        ext = CrossReferenceExtractor()
        text = "§ 1 BGB ist wichtig. Siehe auch § 1 BGB."
        refs = ext.extract(text)
        count_bgb_1 = sum(
            1 for r in refs if r["gesetz"] == "BGB" and r["paragraph"] == "§ 1"
        )
        assert count_bgb_1 == 1

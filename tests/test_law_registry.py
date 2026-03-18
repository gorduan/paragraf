"""Tests fuer das zentrale LAW_REGISTRY."""

from __future__ import annotations

from paragraf.models.law import (
    BESCHREIBUNGEN,
    EURLEX_LAWS,
    GESETZ_DOWNLOAD_SLUGS,
    LAW_REGISTRY,
    RECHTSGEBIETE,
    LawDefinition,
)


class TestLawRegistry:
    """Tests fuer LAW_REGISTRY Struktur und Konsistenz."""

    def test_registry_not_empty(self):
        assert len(LAW_REGISTRY) > 80

    def test_all_entries_have_fields(self):
        for abk, law in LAW_REGISTRY.items():
            assert isinstance(law, LawDefinition)
            assert law.abkuerzung, f"{abk}: abkuerzung leer"
            assert law.slug, f"{abk}: slug leer"
            assert law.beschreibung, f"{abk}: beschreibung leer"
            assert law.rechtsgebiet, f"{abk}: rechtsgebiet leer"
            assert law.quelle in (
                "gesetze-im-internet.de", "eur-lex.europa.eu"
            ), f"{abk}: unbekannte quelle {law.quelle}"

    def test_abkuerzung_matches_key(self):
        for abk, law in LAW_REGISTRY.items():
            assert abk == law.abkuerzung, f"Key {abk} != abkuerzung {law.abkuerzung}"

    def test_no_duplicate_slugs_within_source(self):
        de_slugs: list[str] = []
        eu_slugs: list[str] = []
        for law in LAW_REGISTRY.values():
            if law.quelle == "gesetze-im-internet.de":
                de_slugs.append(law.slug)
            else:
                eu_slugs.append(law.slug)
        assert len(de_slugs) == len(set(de_slugs)), "Doppelte DE-Slugs"
        assert len(eu_slugs) == len(set(eu_slugs)), "Doppelte EU-CELEX"

    def test_eu_laws_have_celex(self):
        for abk, law in LAW_REGISTRY.items():
            if law.quelle == "eur-lex.europa.eu":
                assert law.slug, f"{abk}: EU-Gesetz ohne CELEX"
                # CELEX-Nummern beginnen mit Ziffern oder sind Vertraege
                assert (
                    law.slug[0].isdigit() or "/" in law.slug
                ), f"{abk}: Ungueltiges CELEX-Format: {law.slug}"

    def test_eu_laws_count(self):
        eu_count = sum(1 for v in LAW_REGISTRY.values() if v.quelle == "eur-lex.europa.eu")
        assert eu_count == 10

    def test_de_laws_count(self):
        de_count = sum(1 for v in LAW_REGISTRY.values() if v.quelle == "gesetze-im-internet.de")
        assert de_count >= 75


class TestDerivedConstants:
    """Tests fuer abgeleitete Konstanten."""

    def test_gesetz_download_slugs_only_de(self):
        for abk, slug in GESETZ_DOWNLOAD_SLUGS.items():
            law = LAW_REGISTRY[abk]
            assert law.quelle == "gesetze-im-internet.de"
            assert slug == law.slug

    def test_eurlex_laws_only_eu(self):
        for abk, celex in EURLEX_LAWS.items():
            law = LAW_REGISTRY[abk]
            assert law.quelle == "eur-lex.europa.eu"
            assert celex == law.slug

    def test_beschreibungen_complete(self):
        assert set(BESCHREIBUNGEN.keys()) == set(LAW_REGISTRY.keys())

    def test_rechtsgebiete_complete(self):
        assert set(RECHTSGEBIETE.keys()) == set(LAW_REGISTRY.keys())

    def test_backward_compatible_sgb(self):
        """Alle bisherigen 18 Gesetze sind weiterhin vorhanden."""
        original = [
            "SGB I", "SGB II", "SGB III", "SGB IV", "SGB V", "SGB VI",
            "SGB VII", "SGB VIII", "SGB IX", "SGB X", "SGB XI", "SGB XII",
            "SGB XIV", "BGG", "AGG", "VersMedV", "EStG", "KraftStG",
        ]
        for abk in original:
            assert abk in LAW_REGISTRY, f"{abk} fehlt im Registry"
            assert abk in GESETZ_DOWNLOAD_SLUGS, f"{abk} fehlt in GESETZ_DOWNLOAD_SLUGS"

    def test_sgb_ix_slug_unchanged(self):
        assert GESETZ_DOWNLOAD_SLUGS["SGB IX"] == "sgb_9_2018"

    def test_bgg_slug_unchanged(self):
        assert GESETZ_DOWNLOAD_SLUGS["BGG"] == "bgg"

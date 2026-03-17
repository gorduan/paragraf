"""Tests fuer Pydantic-Datenmodelle."""

from __future__ import annotations

from paragraf.models.law import (
    GESETZ_DOWNLOAD_SLUGS,
    ChunkMetadata,
    EUTBBeratungsstelle,
    Gesetzbuch,
    LawChunk,
    SearchResult,
)


class TestGesetzbuch:
    """Tests fuer das Gesetzbuch-Enum."""

    def test_sgb_ix_value(self):
        assert Gesetzbuch.SGB_IX.value == "SGB IX"

    def test_all_sgb_present(self):
        values = [g.value for g in Gesetzbuch]
        for i in ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIV"]:
            assert f"SGB {i}" in values

    def test_bgg_present(self):
        assert Gesetzbuch.BGG.value == "BGG"


class TestGesetzDownloadSlugs:
    """Tests fuer die Download-URL-Mappings."""

    def test_sgb_ix_slug(self):
        assert GESETZ_DOWNLOAD_SLUGS["SGB IX"] == "sgb_9_2018"

    def test_all_sgb_have_slugs(self):
        for i in ["I", "II", "III", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIV"]:
            assert f"SGB {i}" in GESETZ_DOWNLOAD_SLUGS

    def test_bgg_slug(self):
        assert GESETZ_DOWNLOAD_SLUGS["BGG"] == "bgg"

    def test_sgb_iv_has_slug(self):
        assert "SGB IV" in GESETZ_DOWNLOAD_SLUGS
        assert GESETZ_DOWNLOAD_SLUGS["SGB IV"] == "sgb_4"

    def test_estg_slug(self):
        assert GESETZ_DOWNLOAD_SLUGS["EStG"] == "estg"

    def test_kraftstg_slug(self):
        assert GESETZ_DOWNLOAD_SLUGS["KraftStG"] == "kraftstg"


class TestChunkMetadata:
    """Tests fuer ChunkMetadata."""

    def test_defaults(self):
        meta = ChunkMetadata(gesetz="SGB IX", paragraph="§ 1")
        assert meta.gesetz == "SGB IX"
        assert meta.paragraph == "§ 1"
        assert meta.absatz is None
        assert meta.titel == ""
        assert meta.quelle == "gesetze-im-internet.de"
        assert meta.chunk_typ == "paragraph"

    def test_full_metadata(self):
        meta = ChunkMetadata(
            gesetz="SGB IX",
            paragraph="§ 152",
            absatz=1,
            titel="Feststellung der Behinderung",
            abschnitt="Teil 3 – Schwerbehindertenrecht",
            hierarchie_pfad="SGB IX > Teil 3 > § 152",
            norm_id="BJNR000020963BJNE015201126",
            stand="2024-01-01",
            quelle="gesetze-im-internet.de",
            chunk_typ="absatz",
        )
        assert meta.absatz == 1
        assert meta.chunk_typ == "absatz"


class TestLawChunk:
    """Tests fuer LawChunk."""

    def test_creation(self):
        chunk = LawChunk(
            id="SGB_IX_§1",
            text="Test-Gesetzestext",
            metadata=ChunkMetadata(gesetz="SGB IX", paragraph="§ 1"),
        )
        assert chunk.id == "SGB_IX_§1"
        assert "Test" in chunk.text

    def test_optional_token_count(self):
        chunk = LawChunk(
            id="test",
            text="text",
            metadata=ChunkMetadata(gesetz="SGB IX", paragraph="§ 1"),
            token_count=42,
        )
        assert chunk.token_count == 42


class TestSearchResult:
    """Tests fuer SearchResult."""

    def test_zitation_basic(self):
        result = SearchResult(
            chunk=LawChunk(
                id="test",
                text="text",
                metadata=ChunkMetadata(gesetz="SGB IX", paragraph="§ 152"),
            ),
            score=0.95,
            rank=1,
        )
        assert "SGB IX" in result.zitation
        assert "§ 152" in result.zitation

    def test_zitation_with_absatz(self):
        result = SearchResult(
            chunk=LawChunk(
                id="test",
                text="text",
                metadata=ChunkMetadata(
                    gesetz="SGB IX",
                    paragraph="§ 152",
                    absatz=2,
                    titel="Feststellung",
                ),
            ),
            score=0.95,
            rank=1,
        )
        zit = result.zitation
        assert "Abs. 2" in zit
        assert "Feststellung" in zit


class TestEUTBBeratungsstelle:
    """Tests fuer das EUTB-Modell."""

    def test_creation_minimal(self):
        stelle = EUTBBeratungsstelle(name="Test-EUTB")
        assert stelle.name == "Test-EUTB"
        assert stelle.schwerpunkte == []
        assert stelle.barrierefreiheit == []

    def test_creation_full(self):
        stelle = EUTBBeratungsstelle(
            name="EUTB Berlin",
            traeger="Lebenshilfe e.V.",
            strasse="Musterstr. 1",
            plz="10115",
            ort="Berlin",
            bundesland="Berlin",
            telefon="030-12345",
            email="test@eutb.de",
            website="https://eutb-berlin.de",
            schwerpunkte=["Sehbehinderung", "Autismus"],
            barrierefreiheit=["rollstuhlgerecht", "DGS"],
        )
        assert len(stelle.schwerpunkte) == 2
        assert "Berlin" in stelle.ort

"""Datenmodelle fuer Rechtstexte, Chunks und Suchergebnisse."""

from __future__ import annotations

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field


class Gesetzbuch(StrEnum):
    """Unterstuetzte Gesetzbuecher."""

    SGB_I = "SGB I"
    SGB_II = "SGB II"
    SGB_III = "SGB III"
    SGB_IV = "SGB IV"
    SGB_V = "SGB V"
    SGB_VI = "SGB VI"
    SGB_VII = "SGB VII"
    SGB_VIII = "SGB VIII"
    SGB_IX = "SGB IX"
    SGB_X = "SGB X"
    SGB_XI = "SGB XI"
    SGB_XII = "SGB XII"
    SGB_XIV = "SGB XIV"
    BGG = "BGG"
    UN_BRK = "UN-BRK"
    VERSMEDV = "VersMedV"
    AGG = "AGG"
    BTHG = "BTHG"
    ESTG = "EStG"
    KRAFTSTG = "KraftStG"


# Mapping Gesetzbuch -> Download-Slug auf gesetze-im-internet.de
GESETZ_DOWNLOAD_SLUGS: dict[str, str] = {
    "SGB I": "sgb_1",
    "SGB II": "sgb_2",
    "SGB III": "sgb_3",
    "SGB IV": "sgb_4",
    "SGB V": "sgb_5",
    "SGB VI": "sgb_6",
    "SGB VII": "sgb_7",
    "SGB VIII": "sgb_8",
    "SGB IX": "sgb_9_2018",
    "SGB X": "sgb_10",
    "SGB XI": "sgb_11",
    "SGB XII": "sgb_12",
    "SGB XIV": "sgb_14",
    "BGG": "bgg",
    "AGG": "agg",
    "VersMedV": "versmedv",
    "EStG": "estg",
    "KraftStG": "kraftstg",
}


class GesetzInfo(BaseModel):
    """Metadaten zu einem Gesetz."""

    abkuerzung: str = Field(description="Juristische Abkuerzung, z.B. 'SGB IX'")
    vollstaendiger_name: str = Field(description="Voller Titel des Gesetzes")
    slug: str = Field(description="Slug auf gesetze-im-internet.de")
    stand: date | None = Field(None, description="Stand/Fassung des Gesetzes")
    anzahl_normen: int = Field(0, description="Anzahl der Einzelnormen")


class ChunkMetadata(BaseModel):
    """Metadaten, die jedem Vektor-Chunk zugeordnet werden."""

    gesetz: str = Field(description="Gesetzesabkuerzung, z.B. 'SGB IX'")
    paragraph: str = Field(description="Paragraphen-Bezeichnung, z.B. '§ 152'")
    absatz: int | None = Field(None, description="Absatz-Nummer (1-basiert)")
    titel: str = Field("", description="Titel/Ueberschrift des Paragraphen")
    abschnitt: str = Field("", description="Uebergeordneter Abschnitt/Kapitel")
    hierarchie_pfad: str = Field(
        "",
        description="Vollstaendiger Hierarchie-Pfad, z.B. 'SGB IX > Teil 3 > Kap 1 > § 152'",
    )
    norm_id: str = Field("", description="Eindeutige Norm-ID (doknr aus XML)")
    stand: str | None = Field(None, description="Fassungsdatum")
    quelle: str = Field("gesetze-im-internet.de", description="Datenquelle")
    chunk_typ: str = Field("paragraph", description="paragraph | absatz | abschnitt")


class LawChunk(BaseModel):
    """Ein einzelner Chunk eines Gesetzestextes fuer das Embedding."""

    id: str = Field(description="Eindeutige Chunk-ID: '{gesetz}_{paragraph}_{absatz}'")
    text: str = Field(description="Der eigentliche Gesetzestext des Chunks")
    metadata: ChunkMetadata
    token_count: int | None = Field(None, description="Anzahl Tokens (tiktoken cl100k)")


class SearchFilter(BaseModel):
    """Filterkriterien fuer die Suche."""

    gesetz: str | None = Field(None, description="Nach Gesetzbuch filtern")
    paragraph: str | None = Field(None, description="Nach Paragraph filtern")
    abschnitt: str | None = Field(None, description="Nach Abschnitt filtern")
    chunk_typ: str | None = Field(None, description="paragraph | absatz | abschnitt")


class SearchResult(BaseModel):
    """Ein einzelnes Suchergebnis."""

    chunk: LawChunk
    score: float = Field(description="Relevanz-Score (0-1)")
    rank: int = Field(description="Position im Ranking (1-basiert)")

    @property
    def zitation(self) -> str:
        """Formatierte Quellenangabe."""
        meta = self.chunk.metadata
        teile = [meta.gesetz, meta.paragraph]
        if meta.absatz:
            teile.append(f"Abs. {meta.absatz}")
        if meta.titel:
            teile.append(f"({meta.titel})")
        return " ".join(teile)


class EUTBBeratungsstelle(BaseModel):
    """Eine EUTB-Beratungsstelle."""

    name: str
    traeger: str = ""
    strasse: str = ""
    plz: str = ""
    ort: str = ""
    bundesland: str = ""
    telefon: str = ""
    email: str = ""
    website: str = ""
    schwerpunkte: list[str] = Field(default_factory=list)
    barrierefreiheit: list[str] = Field(default_factory=list)

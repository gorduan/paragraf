"""Datenmodelle fuer Rechtstexte, Chunks und Suchergebnisse."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field


# ── Zentrales Gesetzes-Register ──────────────────────────────────────────────


@dataclass(frozen=True)
class LawDefinition:
    """Definition eines Gesetzes im zentralen Register."""

    abkuerzung: str  # "BGB"
    slug: str  # "bgb" (gesetze-im-internet.de) oder CELEX-Nummer
    beschreibung: str  # "Buergerliches Gesetzbuch"
    rechtsgebiet: str  # "Buergerliches Recht"
    quelle: str  # "gesetze-im-internet.de" | "eur-lex.europa.eu"


LAW_REGISTRY: dict[str, LawDefinition] = {
    # ── Sozialrecht (SGB) ────────────────────────────────────────────────
    "SGB I": LawDefinition("SGB I", "sgb_1", "Allgemeiner Teil – Grundsaetze des Sozialrechts", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB II": LawDefinition("SGB II", "sgb_2", "Grundsicherung fuer Arbeitsuchende (Buergergeld)", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB III": LawDefinition("SGB III", "sgb_3", "Arbeitsfoerderung", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB IV": LawDefinition("SGB IV", "sgb_4", "Gemeinsame Vorschriften fuer die Sozialversicherung", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB V": LawDefinition("SGB V", "sgb_5", "Gesetzliche Krankenversicherung", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB VI": LawDefinition("SGB VI", "sgb_6", "Gesetzliche Rentenversicherung", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB VII": LawDefinition("SGB VII", "sgb_7", "Gesetzliche Unfallversicherung", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB VIII": LawDefinition("SGB VIII", "sgb_8", "Kinder- und Jugendhilfe", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB IX": LawDefinition("SGB IX", "sgb_9_2018", "Rehabilitation und Teilhabe von Menschen mit Behinderungen", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB X": LawDefinition("SGB X", "sgb_10", "Sozialverwaltungsverfahren und Sozialdatenschutz", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB XI": LawDefinition("SGB XI", "sgb_11", "Soziale Pflegeversicherung", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB XII": LawDefinition("SGB XII", "sgb_12", "Sozialhilfe", "Sozialrecht", "gesetze-im-internet.de"),
    "SGB XIV": LawDefinition("SGB XIV", "sgb_14", "Soziale Entschaedigung", "Sozialrecht", "gesetze-im-internet.de"),
    # ── Sozialrecht (Ergaenzung) ─────────────────────────────────────────
    "BAföG": LawDefinition("BAföG", "baf_g", "Bundesausbildungsfoerderungsgesetz", "Sozialrecht", "gesetze-im-internet.de"),
    "WoGG": LawDefinition("WoGG", "wogg", "Wohngeldgesetz", "Sozialrecht", "gesetze-im-internet.de"),
    "BKGG": LawDefinition("BKGG", "bkgg_1996", "Bundeskindergeldgesetz", "Sozialrecht", "gesetze-im-internet.de"),
    "AsylbLG": LawDefinition("AsylbLG", "asylblg", "Asylbewerberleistungsgesetz", "Sozialrecht", "gesetze-im-internet.de"),
    # ── Behindertenrecht ─────────────────────────────────────────────────
    "BGG": LawDefinition("BGG", "bgg", "Behindertengleichstellungsgesetz", "Behindertenrecht", "gesetze-im-internet.de"),
    "AGG": LawDefinition("AGG", "agg", "Allgemeines Gleichbehandlungsgesetz", "Behindertenrecht", "gesetze-im-internet.de"),
    "VersMedV": LawDefinition("VersMedV", "versmedv", "Versorgungsmedizin-Verordnung (GdB-Feststellung)", "Behindertenrecht", "gesetze-im-internet.de"),
    # ── Steuerrecht ──────────────────────────────────────────────────────
    "EStG": LawDefinition("EStG", "estg", "Einkommensteuergesetz", "Steuerrecht", "gesetze-im-internet.de"),
    "KraftStG": LawDefinition("KraftStG", "kraftstg", "Kraftfahrzeugsteuergesetz", "Steuerrecht", "gesetze-im-internet.de"),
    "AO": LawDefinition("AO", "ao_1977", "Abgabenordnung", "Steuerrecht", "gesetze-im-internet.de"),
    "UStG": LawDefinition("UStG", "ustg_1980", "Umsatzsteuergesetz", "Steuerrecht", "gesetze-im-internet.de"),
    "GewStG": LawDefinition("GewStG", "gewstg", "Gewerbesteuergesetz", "Steuerrecht", "gesetze-im-internet.de"),
    "KStG": LawDefinition("KStG", "kstg_1977", "Koerperschaftsteuergesetz", "Steuerrecht", "gesetze-im-internet.de"),
    "ErbStG": LawDefinition("ErbStG", "erbstg_1974", "Erbschaftsteuer- und Schenkungsteuergesetz", "Steuerrecht", "gesetze-im-internet.de"),
    # ── Verfassung ───────────────────────────────────────────────────────
    "GG": LawDefinition("GG", "gg", "Grundgesetz fuer die Bundesrepublik Deutschland", "Verfassung", "gesetze-im-internet.de"),
    # ── Buergerliches Recht ──────────────────────────────────────────────
    "BGB": LawDefinition("BGB", "bgb", "Buergerliches Gesetzbuch", "Buergerliches Recht", "gesetze-im-internet.de"),
    "FamFG": LawDefinition("FamFG", "famfg", "Gesetz ueber das Verfahren in Familiensachen", "Buergerliches Recht", "gesetze-im-internet.de"),
    "ZPO": LawDefinition("ZPO", "zpo", "Zivilprozessordnung", "Buergerliches Recht", "gesetze-im-internet.de"),
    "InsO": LawDefinition("InsO", "inso", "Insolvenzordnung", "Buergerliches Recht", "gesetze-im-internet.de"),
    "ZVG": LawDefinition("ZVG", "zvg", "Zwangsversteigerungsgesetz", "Buergerliches Recht", "gesetze-im-internet.de"),
    # ── Strafrecht ───────────────────────────────────────────────────────
    "StGB": LawDefinition("StGB", "stgb", "Strafgesetzbuch", "Strafrecht", "gesetze-im-internet.de"),
    "StPO": LawDefinition("StPO", "stpo", "Strafprozessordnung", "Strafrecht", "gesetze-im-internet.de"),
    "JGG": LawDefinition("JGG", "jgg", "Jugendgerichtsgesetz", "Strafrecht", "gesetze-im-internet.de"),
    "OWiG": LawDefinition("OWiG", "owig_1968", "Gesetz ueber Ordnungswidrigkeiten", "Strafrecht", "gesetze-im-internet.de"),
    # ── Verwaltungsrecht ─────────────────────────────────────────────────
    "VwGO": LawDefinition("VwGO", "vwgo", "Verwaltungsgerichtsordnung", "Verwaltungsrecht", "gesetze-im-internet.de"),
    "VwVfG": LawDefinition("VwVfG", "vwvfg", "Verwaltungsverfahrensgesetz", "Verwaltungsrecht", "gesetze-im-internet.de"),
    # ── Arbeitsrecht ─────────────────────────────────────────────────────
    "BetrVG": LawDefinition("BetrVG", "betrvg", "Betriebsverfassungsgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "KSchG": LawDefinition("KSchG", "kschg", "Kuendigungsschutzgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "ArbZG": LawDefinition("ArbZG", "arbzg", "Arbeitszeitgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "MuSchG": LawDefinition("MuSchG", "muschg_2018", "Mutterschutzgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "BEEG": LawDefinition("BEEG", "beeg", "Bundeselterngeld- und Elternzeitgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "TzBfG": LawDefinition("TzBfG", "tzbfg", "Teilzeit- und Befristungsgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "AÜG": LawDefinition("AÜG", "a_g", "Arbeitnehmerueberlassungsgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "EntgTranspG": LawDefinition("EntgTranspG", "entgtranspg", "Entgelttransparenzgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "ArbSchG": LawDefinition("ArbSchG", "arbschg", "Arbeitsschutzgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "BUrlG": LawDefinition("BUrlG", "burlg", "Bundesurlaubsgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    "EntgFG": LawDefinition("EntgFG", "entgfg", "Entgeltfortzahlungsgesetz", "Arbeitsrecht", "gesetze-im-internet.de"),
    # ── Handels-/Wirtschaftsrecht ────────────────────────────────────────
    "HGB": LawDefinition("HGB", "hgb", "Handelsgesetzbuch", "Handels-/Wirtschaftsrecht", "gesetze-im-internet.de"),
    "GmbHG": LawDefinition("GmbHG", "gmbhg", "GmbH-Gesetz", "Handels-/Wirtschaftsrecht", "gesetze-im-internet.de"),
    "AktG": LawDefinition("AktG", "aktg", "Aktiengesetz", "Handels-/Wirtschaftsrecht", "gesetze-im-internet.de"),
    "GewO": LawDefinition("GewO", "gewo", "Gewerbeordnung", "Handels-/Wirtschaftsrecht", "gesetze-im-internet.de"),
    "UWG": LawDefinition("UWG", "uwg_2004", "Gesetz gegen den unlauteren Wettbewerb", "Handels-/Wirtschaftsrecht", "gesetze-im-internet.de"),
    "GWB": LawDefinition("GWB", "gwb", "Gesetz gegen Wettbewerbsbeschraenkungen", "Handels-/Wirtschaftsrecht", "gesetze-im-internet.de"),
    # ── Aufenthaltsrecht ─────────────────────────────────────────────────
    "AufenthG": LawDefinition("AufenthG", "aufenthg_2004", "Aufenthaltsgesetz", "Aufenthaltsrecht", "gesetze-im-internet.de"),
    "AsylG": LawDefinition("AsylG", "asylvfg_1992", "Asylgesetz", "Aufenthaltsrecht", "gesetze-im-internet.de"),
    "FreizügG/EU": LawDefinition("FreizügG/EU", "freiz_gg_eu_2004", "Freizuegigkeitsgesetz/EU", "Aufenthaltsrecht", "gesetze-im-internet.de"),
    # ── Verkehrsrecht ────────────────────────────────────────────────────
    "StVO": LawDefinition("StVO", "stvo_2013", "Strassenverkehrs-Ordnung", "Verkehrsrecht", "gesetze-im-internet.de"),
    "StVG": LawDefinition("StVG", "stvg", "Strassenverkehrsgesetz", "Verkehrsrecht", "gesetze-im-internet.de"),
    "StVZO": LawDefinition("StVZO", "stvzo_2012", "Strassenverkehrs-Zulassungs-Ordnung", "Verkehrsrecht", "gesetze-im-internet.de"),
    "FZV": LawDefinition("FZV", "fzv_2023", "Fahrzeug-Zulassungsverordnung", "Verkehrsrecht", "gesetze-im-internet.de"),
    "FeV": LawDefinition("FeV", "fev_2010", "Fahrerlaubnis-Verordnung", "Verkehrsrecht", "gesetze-im-internet.de"),
    # ── Umweltrecht ──────────────────────────────────────────────────────
    "BImSchG": LawDefinition("BImSchG", "bimschg", "Bundes-Immissionsschutzgesetz", "Umweltrecht", "gesetze-im-internet.de"),
    "BNatSchG": LawDefinition("BNatSchG", "bnatschg_2009", "Bundesnaturschutzgesetz", "Umweltrecht", "gesetze-im-internet.de"),
    "WHG": LawDefinition("WHG", "whg_2009", "Wasserhaushaltsgesetz", "Umweltrecht", "gesetze-im-internet.de"),
    # ── Immobilien ───────────────────────────────────────────────────────
    "WEG": LawDefinition("WEG", "woeigg", "Wohnungseigentumsgesetz", "Immobilienrecht", "gesetze-im-internet.de"),
    "BauGB": LawDefinition("BauGB", "bbaug", "Baugesetzbuch", "Immobilienrecht", "gesetze-im-internet.de"),
    "BauNVO": LawDefinition("BauNVO", "baunvo", "Baunutzungsverordnung", "Immobilienrecht", "gesetze-im-internet.de"),
    # ── Datenschutz ──────────────────────────────────────────────────────
    "BDSG": LawDefinition("BDSG", "bdsg_2018", "Bundesdatenschutzgesetz", "Datenschutz", "gesetze-im-internet.de"),
    # ── Geistiges Eigentum ───────────────────────────────────────────────
    "UrhG": LawDefinition("UrhG", "urhg", "Urheberrechtsgesetz", "Geistiges Eigentum", "gesetze-im-internet.de"),
    "MarkenG": LawDefinition("MarkenG", "markeng", "Markengesetz", "Geistiges Eigentum", "gesetze-im-internet.de"),
    "PatG": LawDefinition("PatG", "patg", "Patentgesetz", "Geistiges Eigentum", "gesetze-im-internet.de"),
    # ── Justiz/Kosten ────────────────────────────────────────────────────
    "GVG": LawDefinition("GVG", "gvg", "Gerichtsverfassungsgesetz", "Justiz/Kosten", "gesetze-im-internet.de"),
    "BRAO": LawDefinition("BRAO", "brao", "Bundesrechtsanwaltsordnung", "Justiz/Kosten", "gesetze-im-internet.de"),
    "RVG": LawDefinition("RVG", "rvg", "Rechtsanwaltsverguetungsgesetz", "Justiz/Kosten", "gesetze-im-internet.de"),
    "GKG": LawDefinition("GKG", "gkg_2004", "Gerichtskostengesetz", "Justiz/Kosten", "gesetze-im-internet.de"),
    # ── Sonstiges ────────────────────────────────────────────────────────
    "StAG": LawDefinition("StAG", "stag", "Staatsangehoerigkeitsgesetz", "Sonstiges", "gesetze-im-internet.de"),
    "PStG": LawDefinition("PStG", "pstg", "Personenstandsgesetz", "Sonstiges", "gesetze-im-internet.de"),
    "BBG": LawDefinition("BBG", "bbg_2009", "Bundesbeamtengesetz", "Sonstiges", "gesetze-im-internet.de"),
    "TKG": LawDefinition("TKG", "tkg_2021", "Telekommunikationsgesetz", "Sonstiges", "gesetze-im-internet.de"),
    # ── EU-Recht ─────────────────────────────────────────────────────────
    "DSGVO": LawDefinition("DSGVO", "32016R0679", "Datenschutz-Grundverordnung", "EU-Recht", "eur-lex.europa.eu"),
    "EU_AI_ACT": LawDefinition("EU_AI_ACT", "32024R1689", "KI-Verordnung", "EU-Recht", "eur-lex.europa.eu"),
    "EU_BARR_RL": LawDefinition("EU_BARR_RL", "32019L0882", "Barrierefreiheitsrichtlinie", "EU-Recht", "eur-lex.europa.eu"),
    "EU_ARBZEIT_RL": LawDefinition("EU_ARBZEIT_RL", "32003L0088", "Arbeitszeitrichtlinie", "EU-Recht", "eur-lex.europa.eu"),
    "EU_ENTSENDE_RL": LawDefinition("EU_ENTSENDE_RL", "32018L0957", "Entsenderichtlinie", "EU-Recht", "eur-lex.europa.eu"),
    "EU_ANTIDISK_RASSE": LawDefinition("EU_ANTIDISK_RASSE", "32000L0043", "Antirassismus-Richtlinie", "EU-Recht", "eur-lex.europa.eu"),
    "EU_ANTIDISK_RAHMEN": LawDefinition("EU_ANTIDISK_RAHMEN", "32000L0078", "Gleichbehandlungsrahmenrichtlinie", "EU-Recht", "eur-lex.europa.eu"),
    "EU_GRCH": LawDefinition("EU_GRCH", "12012P/TXT", "EU-Grundrechtecharta", "EU-Recht", "eur-lex.europa.eu"),
    "AEUV": LawDefinition("AEUV", "12012E/TXT", "Vertrag ueber die Arbeitsweise der EU", "EU-Recht", "eur-lex.europa.eu"),
    "EUV": LawDefinition("EUV", "12012M/TXT", "Vertrag ueber die Europaeische Union", "EU-Recht", "eur-lex.europa.eu"),
}


# ── Abgeleitete Konstanten (backward-compatible) ────────────────────────────

GESETZ_DOWNLOAD_SLUGS: dict[str, str] = {
    k: v.slug for k, v in LAW_REGISTRY.items()
    if v.quelle == "gesetze-im-internet.de"
}

EURLEX_LAWS: dict[str, str] = {
    k: v.slug for k, v in LAW_REGISTRY.items()
    if v.quelle == "eur-lex.europa.eu"
}

BESCHREIBUNGEN: dict[str, str] = {
    k: v.beschreibung for k, v in LAW_REGISTRY.items()
}

RECHTSGEBIETE: dict[str, str] = {
    k: v.rechtsgebiet for k, v in LAW_REGISTRY.items()
}


# ── Backward-compatible Enum ─────────────────────────────────────────────────


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


# ── Pydantic-Modelle ─────────────────────────────────────────────────────────


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

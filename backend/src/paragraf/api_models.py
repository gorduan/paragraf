"""Pydantic Response-Modelle fuer die FastAPI REST-Schicht."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ── Request-Modelle ──────────────────────────────────────────────────────────


class SearchRequest(BaseModel):
    anfrage: str = Field(description="Suchanfrage in natuerlicher Sprache")
    gesetzbuch: str | None = Field(None, description="Filter nach Gesetzbuch")
    abschnitt: str | None = Field(None, description="Filter nach Abschnitt")
    max_ergebnisse: int = Field(5, ge=1, le=20, description="Anzahl Ergebnisse")
    search_type: Literal["semantic", "fulltext", "hybrid_fulltext"] = Field(
        "semantic",
        description="Suchmodus: semantic (Standard), fulltext (Keyword), hybrid_fulltext (beides)",
    )
    absatz_von: int | None = Field(None, description="Absatz-Range Minimum (1-basiert)")
    absatz_bis: int | None = Field(None, description="Absatz-Range Maximum (1-basiert)")
    cursor: str | None = Field(None, description="Cursor fuer naechste Seite (aus next_cursor)")
    page_size: int = Field(10, ge=1, le=100, description="Ergebnisse pro Seite")


class LookupRequest(BaseModel):
    gesetz: str = Field(description="Gesetzbuch-Abkuerzung, z.B. 'SGB IX'")
    paragraph: str = Field(description="Paragraphen-Nummer, z.B. '§ 152'")


class CompareRequest(BaseModel):
    paragraphen: list[str] = Field(
        description="Liste von Paragraphen-Referenzen, z.B. ['§ 36 SGB XI', '§ 37 SGB XI']",
        min_length=2,
        max_length=5,
    )


class CounselingRequest(BaseModel):
    ort: str | None = Field(None, description="Stadt oder Ort")
    bundesland: str | None = Field(None, description="Bundesland")
    schwerpunkt: str | None = Field(None, description="Beratungsschwerpunkt")


class IndexRequest(BaseModel):
    gesetzbuch: str | None = Field(None, description="Einzelnes Gesetzbuch oder alle")


# ── Response-Modelle ─────────────────────────────────────────────────────────


class SearchResultItem(BaseModel):
    paragraph: str = Field(description="z.B. '§ 37'")
    gesetz: str = Field(description="z.B. 'SGB XI'")
    titel: str = Field(description="Titel des Paragraphen")
    text: str = Field(description="Volltext des Chunks")
    score: float = Field(description="Relevanz-Score (0-1)")
    abschnitt: str = Field(default="")
    hierarchie_pfad: str = Field(default="")
    quelle: str = Field(default="gesetze-im-internet.de")
    chunk_typ: str = Field(default="paragraph")
    absatz: int | None = Field(None)


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int
    search_type: str = Field("semantic", description="Verwendeter Suchmodus")
    next_cursor: str | None = Field(None, description="Cursor fuer naechste Seite (null = letzte Seite)")
    disclaimer: str = (
        "Dies ist eine allgemeine Rechtsinformation, keine Rechtsberatung "
        "im Sinne des Rechtsdienstleistungsgesetzes (RDG). Fuer eine individuelle "
        "Beratung wenden Sie sich an eine Rechtsanwaeltin/einen Rechtsanwalt oder "
        "eine EUTB-Beratungsstelle (www.teilhabeberatung.de)."
    )


class LookupResponse(BaseModel):
    paragraph: str
    gesetz: str
    titel: str
    text: str
    abschnitt: str = ""
    hierarchie_pfad: str = ""
    quelle: str = "gesetze-im-internet.de"
    stand: str | None = None
    found: bool = True
    error: str | None = None


class CompareItem(BaseModel):
    referenz: str = Field(description="Urspruengliche Referenz aus der Anfrage")
    paragraph: str = ""
    gesetz: str = ""
    titel: str = ""
    text: str = ""
    found: bool = True


class CompareResponse(BaseModel):
    items: list[CompareItem]


class LawInfo(BaseModel):
    abkuerzung: str
    beschreibung: str
    slug: str | None = None
    rechtsgebiet: str = ""
    quelle: str = "gesetze-im-internet.de"
    tags: list[str] = Field(default_factory=list)


class LawsResponse(BaseModel):
    gesetze: list[LawInfo]
    total_chunks: int
    db_status: str


class LawStructureEntry(BaseModel):
    paragraph: str
    titel: str
    abschnitt: str
    hierarchie_pfad: str


class LawStructureResponse(BaseModel):
    gesetz: str
    paragraphen: list[LawStructureEntry]
    total: int


class LawParagraphsResponse(BaseModel):
    gesetz: str
    paragraphen: list[SearchResultItem]
    total: int


class CounselingItem(BaseModel):
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


class CounselingResponse(BaseModel):
    stellen: list[CounselingItem]
    total: int
    hinweis: str = (
        "Alle EUTB-Beratungen sind kostenlos und unabhaengig. "
        "Ueberregionale Hotline: 0800 11 10 111"
    )


class IndexStatusItem(BaseModel):
    gesetz: str
    chunks: int
    status: str = Field(description="indexiert | nicht_indexiert")


class IndexStatusResponse(BaseModel):
    gesetze: list[IndexStatusItem]
    total_chunks: int
    db_status: str


class IndexProgressEvent(BaseModel):
    gesetz: str
    schritt: str = Field(description="download | parse | embedding | upload | done | error")
    fortschritt: int = 0
    gesamt: int = 0
    nachricht: str = ""


class IndexResultResponse(BaseModel):
    erfolg: bool
    verarbeitete_gesetze: int = 0
    total_chunks: int = 0
    fehler: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str = Field(description="ready | loading | error")
    embedding_model: str = ""
    embedding_dimension: int = 0
    embedding_device: str = ""
    qdrant_collection: str = ""
    qdrant_status: str = ""
    indexierte_chunks: int = 0


class SettingsResponse(BaseModel):
    embedding_device: str = "cpu"
    embedding_batch_size: int = 8
    embedding_max_length: int = 512
    reranker_top_k: int = 5
    retrieval_top_k: int = 20
    similarity_threshold: float = 0.35
    qdrant_url: str = "http://localhost:6333"
    hf_home: str = ""
    torch_home: str = ""


class GpuInfoResponse(BaseModel):
    cuda_available: bool = False
    gpu_name: str = ""
    vram_total_mb: int = 0


# ── Snapshot-Modelle ─────────────────────────────────────────────────────────


class SnapshotInfo(BaseModel):
    name: str = Field(description="Snapshot-Dateiname")
    creation_time: str | None = Field(None, description="Erstellungszeitpunkt")
    size: int = Field(0, description="Groesse in Bytes")


class SnapshotListResponse(BaseModel):
    snapshots: list[SnapshotInfo]
    total: int


class SnapshotCreateResponse(BaseModel):
    erfolg: bool
    name: str = Field(description="Name des erstellten Snapshots")
    nachricht: str = Field(default="", description="Statusmeldung")
    geloeschte_snapshots: list[str] = Field(
        default_factory=list,
        description="Namen der automatisch geloeschten aeltesten Snapshots",
    )


class SnapshotRestoreResponse(BaseModel):
    erfolg: bool
    nachricht: str = Field(description="Statusmeldung")


# ── Recommend & Pagination ──────────────────────────────────────────────────


class RecommendRequest(BaseModel):
    point_ids: list[str] | None = Field(
        None,
        min_length=1,
        max_length=5,
        description="Liste von Qdrant Point-IDs (UUID-Strings)",
    )
    paragraph: str | None = Field(None, description="Paragraph als Alternative zu Point-ID")
    gesetz: str | None = Field(None, description="Gesetz als Alternative zu Point-ID")
    limit: int = Field(10, ge=1, le=50, description="Anzahl aehnlicher Ergebnisse")
    exclude_same_law: bool = Field(True, description="Ergebnisse aus dem gleichen Gesetz ausschliessen")
    gesetzbuch: str | None = Field(None, description="Filter nach Gesetzbuch")
    abschnitt: str | None = Field(None, description="Filter nach Abschnitt")
    absatz_von: int | None = Field(None, description="Absatz-Range Minimum")
    absatz_bis: int | None = Field(None, description="Absatz-Range Maximum")


class RecommendResponse(BaseModel):
    source_ids: list[str] = Field(description="Verwendete Point-IDs als Basis")
    results: list[SearchResultItem]
    total: int
    disclaimer: str = (
        "Dies ist eine allgemeine Rechtsinformation, keine Rechtsberatung "
        "im Sinne des Rechtsdienstleistungsgesetzes (RDG). Fuer eine individuelle "
        "Beratung wenden Sie sich an eine Rechtsanwaeltin/einen Rechtsanwalt oder "
        "eine EUTB-Beratungsstelle (www.teilhabeberatung.de)."
    )


class BatchSearchRequest(BaseModel):
    queries: list[SearchRequest] = Field(
        min_length=1,
        max_length=10,
        description="Liste von Suchanfragen (max. 10)",
    )


class BatchSearchResponse(BaseModel):
    results: list[SearchResponse]
    total_queries: int
    load_warning: bool = Field(False, description="True wenn Auslastung hoch")


# ── Grouping & Discovery ──────────────────────────────────────────────────


class GroupedSearchRequest(BaseModel):
    anfrage: str = Field(description="Suchanfrage in natuerlicher Sprache")
    gesetzbuch: str | None = Field(None, description="Filter nach Gesetzbuch")
    abschnitt: str | None = Field(None, description="Filter nach Abschnitt")
    group_size: int = Field(
        default=3, ge=1, le=10, description="Ergebnisse pro Gruppe (max)"
    )
    max_groups: int = Field(
        default=10, ge=1, le=20, description="Maximale Anzahl Gruppen"
    )
    search_type: Literal["semantic", "fulltext", "hybrid_fulltext"] = Field(
        "semantic", description="Suchmodus"
    )


class DiscoverRequest(BaseModel):
    positive_ids: list[str] | None = Field(
        None, max_length=5, description="Positive Punkt-IDs"
    )
    positive_paragraphs: list[LookupRequest] | None = Field(
        None, max_length=5, description="Positive Paragraphen"
    )
    negative_ids: list[str] | None = Field(
        None, max_length=5, description="Negative Punkt-IDs"
    )
    negative_paragraphs: list[LookupRequest] | None = Field(
        None, max_length=5, description="Negative Paragraphen"
    )
    limit: int = Field(10, ge=1, le=50, description="Anzahl Ergebnisse")
    gesetzbuch: str | None = Field(None, description="Filter nach Gesetzbuch")
    abschnitt: str | None = Field(None, description="Filter nach Abschnitt")


class GroupedRecommendRequest(BaseModel):
    point_ids: list[str] | None = Field(
        None,
        min_length=1,
        max_length=5,
        description="Liste von Qdrant Point-IDs (UUID-Strings)",
    )
    paragraph: str | None = Field(None, description="Paragraph als Alternative zu Point-ID")
    gesetz: str | None = Field(None, description="Gesetz als Alternative zu Point-ID")
    exclude_same_law: bool = Field(
        True, description="Ergebnisse aus dem gleichen Gesetz ausschliessen"
    )
    gesetzbuch: str | None = Field(None, description="Filter nach Gesetzbuch")
    abschnitt: str | None = Field(None, description="Filter nach Abschnitt")
    absatz_von: int | None = Field(None, description="Absatz-Range Minimum")
    absatz_bis: int | None = Field(None, description="Absatz-Range Maximum")
    group_size: int = Field(3, ge=1, le=10, description="Ergebnisse pro Gruppe (max)")
    max_groups: int = Field(10, ge=1, le=20, description="Maximale Anzahl Gruppen")


class GroupedResultGroup(BaseModel):
    gesetz: str = Field(description="Gesetzbuch-Abkuerzung")
    results: list[SearchResultItem] = Field(description="Ergebnisse in dieser Gruppe")
    total: int = Field(description="Anzahl Ergebnisse in dieser Gruppe")


class GroupedSearchResponse(BaseModel):
    query: str
    groups: list[GroupedResultGroup]
    total_groups: int
    disclaimer: str = (
        "Dies ist eine allgemeine Rechtsinformation, keine Rechtsberatung "
        "im Sinne des Rechtsdienstleistungsgesetzes (RDG). Fuer eine individuelle "
        "Beratung wenden Sie sich an eine Rechtsanwaeltin/einen Rechtsanwalt oder "
        "eine EUTB-Beratungsstelle (www.teilhabeberatung.de)."
    )


class DiscoverResponse(BaseModel):
    positive_ids: list[str] = Field(description="Verwendete positive Point-IDs")
    negative_ids: list[str] = Field(description="Verwendete negative Point-IDs")
    results: list[SearchResultItem]
    total: int
    disclaimer: str = (
        "Dies ist eine allgemeine Rechtsinformation, keine Rechtsberatung "
        "im Sinne des Rechtsdienstleistungsgesetzes (RDG). Fuer eine individuelle "
        "Beratung wenden Sie sich an eine Rechtsanwaeltin/einen Rechtsanwalt oder "
        "eine EUTB-Beratungsstelle (www.teilhabeberatung.de)."
    )


class GroupedRecommendResponse(BaseModel):
    source_ids: list[str] = Field(description="Verwendete Point-IDs als Basis")
    groups: list[GroupedResultGroup]
    total_groups: int
    disclaimer: str = (
        "Dies ist eine allgemeine Rechtsinformation, keine Rechtsberatung "
        "im Sinne des Rechtsdienstleistungsgesetzes (RDG). Fuer eine individuelle "
        "Beratung wenden Sie sich an eine Rechtsanwaeltin/einen Rechtsanwalt oder "
        "eine EUTB-Beratungsstelle (www.teilhabeberatung.de)."
    )


# ── Cross-Reference (Querverweise) ─────────────────────────────────────────


class ReferenceExtractRequest(BaseModel):
    """Anfrage zur Querverweis-Extraktion."""

    gesetz: str | None = Field(None, description="Optional: nur fuer ein Gesetz extrahieren")
    full_reindex: bool = Field(False, description="True fuer vollstaendige Neuindexierung statt set_payload")


class ReferenceExtractResponse(BaseModel):
    """Ergebnis der Querverweis-Extraktion."""

    erfolg: bool
    total_points: int = Field(description="Anzahl durchsuchter Punkte")
    points_with_refs: int = Field(description="Punkte mit mindestens einem Querverweis")
    total_refs: int = Field(description="Gesamtzahl extrahierter Querverweise")
    snapshot_name: str | None = Field(None, description="Name des Sicherungs-Snapshots")
    nachricht: str = Field(description="Status-Nachricht")


class ReferenceItem(BaseModel):
    """Ein Querverweis in der API-Antwort."""

    gesetz: str
    paragraph: str
    absatz: int | None = None
    raw: str
    verified: bool
    kontext: str | None = None


class IncomingReferenceItem(BaseModel):
    """Ein eingehender Querverweis (wer zitiert diesen Paragraphen)."""

    gesetz: str = Field(description="Gesetz des zitierenden Paragraphen")
    paragraph: str = Field(description="Zitierender Paragraph")
    chunk_id: str = Field(description="Chunk-ID des zitierenden Punktes")
    text_preview: str = Field(description="Textvorschau (max 200 Zeichen)")


class ReferenceNetworkResponse(BaseModel):
    """Zitationsnetzwerk eines Paragraphen."""

    gesetz: str
    paragraph: str
    outgoing: list[ReferenceItem] = Field(description="Ausgehende Querverweise")
    incoming: list[IncomingReferenceItem] = Field(description="Eingehende Querverweise")
    incoming_count: int = Field(description="Gesamtzahl eingehender Querverweise")

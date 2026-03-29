# Phase 7: Query Expansion & Chunking - Research

**Researched:** 2026-03-27
**Domain:** Legal synonym expansion, sentence-level chunking, multi-hop search chaining
**Confidence:** HIGH

## Summary

This phase adds three capabilities to the backend: (1) a query expansion system that appends legal abbreviation expansions and synonyms to search queries, (2) improved paragraph chunking that splits at legal structure boundaries (Absatz, Satz) instead of arbitrary length, and (3) a multi-hop search endpoint and MCP prompt templates that chain search with cross-reference traversal. No frontend changes -- that is Phase 8.

The codebase is well-prepared for all three additions. LAW_REGISTRY already contains 95+ law entries with `abkuerzung`, `beschreibung`, and `tags` fields that serve as the foundation for automatic synonym generation. The parser already splits at Absatz boundaries with a 800-char threshold -- extending to Satz granularity requires regex-based sentence detection within Absaetze. The cross-reference infrastructure from Phase 6 (`get_outgoing_references`, `get_incoming_references`) provides the building blocks for multi-hop traversal.

**Primary recommendation:** Implement a standalone `QueryExpander` service class that generates expansion terms from LAW_REGISTRY + a hand-curated synonym dict, integrate it as a pre-processing step before `hybrid_search()`, and add the multi-hop endpoint as an orchestrator that chains existing search and reference methods.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** LAW_REGISTRY-basiert: Automatisch aus LAW_REGISTRY generiert (Abkuerzung <-> voller Name <-> Tags) plus manuell gepflegte juristische Kern-Synonyme (z.B. GdB <-> Grad der Behinderung, Kuendigung <-> Entlassung).
- **D-02:** Primaer als Python-Dict im Code (eigene Datei, z.B. `synonyms.py`). Zusaetzlich optionale JSON-Datei die das Dict ergaenzt/ueberschreibt -- fuer Anpassungen ohne Code-Aenderung.
- **D-03:** Arabische-Zahlen-Normalisierung auch bei der Suche: `_normalize_abkuerzung()` wird zur Suchzeit angewendet (SGB 9 -> SGB IX), nicht nur beim Parsen.
- **D-04:** Zwei Strategien konfigurierbar per ENV (`QUERY_EXPANSION_STRATEGY`): `append` (Default) haengt Synonyme an den Query-String an, `parallel` fuehrt Original + expandierte Query separat aus und fusioniert per RRF.
- **D-05:** Expansion sichtbar im API-Response: `expanded_terms`-Feld zeigt dem Nutzer welche Synonyme hinzugefuegt wurden.
- **D-06:** Expansion per API-Parameter abschaltbar: `expand: true/false` (Default: true) in SearchRequest.
- **D-07:** Granularitaet: Absatz + Satz. Chunks an Absatz-Grenzen UND an Satz-Grenzen bei langen Absaetzen. Chunk-Typen: `paragraph` (voller Text), `absatz` (einzelne Klausel), `satz` (einzelner Satz bei langen Absaetzen).
- **D-08:** Bestehende `paragraph`-Chunks beibehalten, neue `absatz`- und `satz`-Chunks kommen dazu.
- **D-09:** Schwellenwerte konfigurierbar per ENV: `CHUNK_MIN_LENGTH_FOR_SPLIT` (Default: 800 Zeichen) und `CHUNK_SATZ_MIN_LENGTH` fuer minimale Satz-Chunk-Laenge.
- **D-10:** Beides: MCP-Prompt-Templates fuer Claude UND ein Backend-Endpoint (`POST /api/search/multi-hop`) der intern Search -> References -> Search kettet.
- **D-11:** Traversal-Tiefe bis zu 3 Hops moeglich. Default: 1. Konfigurierbar per ENV (`MULTI_HOP_MAX_DEPTH`), API-Parameter (`tiefe`) und MCP-Parameter.
- **D-12:** Drei MCP-Prompt-Templates: `paragraf_legal_analysis`, `paragraf_norm_chain`, `paragraf_compare_areas`.

### Claude's Discretion
- Interne Implementierung der parallelen Expansion-Strategie (wie RRF-Fusion der zwei Ergebnis-Sets)
- Satz-Erkennung im Parser (Regex oder strukturbasiert)
- Multi-Hop Response-Format und Zwischenergebnis-Darstellung
- Error Handling bei zirkulaeren Querverweisen in der Traversal-Kette
- Pydantic-Modell-Namen fuer Multi-Hop Request/Response
- Ob der Multi-Hop-Endpoint Reranking auf die kombinierten Ergebnisse anwendet

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-07 | Query Expansion mit juristischem Synonym-Woerterbuch (konservativ, nur Abkuerzungen + Kernsynonyme) | QueryExpander service using LAW_REGISTRY auto-generation + curated synonyms dict; append/parallel strategies; expand toggle in SearchRequest; expanded_terms in SearchResponse |
| MCP-04 | Multi-Hop MCP-Prompt -- Paragraphen finden, Querverweise folgen, Rechtslage zusammenfassen | 3 MCP prompt templates (legal_analysis, norm_chain, compare_areas) + backend /api/search/multi-hop endpoint chaining search -> references -> search |
| CHUNK-01 | Parser verbessern -- Chunking an juristischen Strukturgrenzen (Absatz, Satz, Nummer) | Extend parser._extract_chunks() with Satz-level splitting using German legal sentence boundary regex |
| CHUNK-02 | Re-Indexierung mit verbessertem Chunking (nach Snapshot) | Snapshot backup before re-index; uses existing snapshot infrastructure from Phase 1 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pydantic v2 | >=2.0.0 | Request/Response models for multi-hop, expansion config | Already used throughout; Settings for new ENV vars |
| FastAPI | >=0.115.0 | New /api/search/multi-hop endpoint | Existing REST framework |
| FastMCP | >=1.0.0 | 3 new prompt templates | Existing MCP framework |
| qdrant-client | >=1.12.0 | Re-indexing with new chunks | Existing vector DB client |

### Supporting
No new external dependencies required. All functionality builds on existing libraries.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built synonym dict | py-openthesaurus | Explicitly deferred to V2-04 due to rate-limit issues |
| Regex sentence splitting | spaCy sentencizer | spaCy adds ~500MB dependency; German legal text has unusual sentence patterns that need custom rules anyway |

**Installation:**
No new packages needed. All work uses existing dependencies.

## Architecture Patterns

### Recommended Project Structure
```
backend/src/paragraf/
├── services/
│   ├── query_expander.py      # NEW: QueryExpander service class
│   ├── parser.py              # MODIFIED: add Satz-level chunking
│   ├── qdrant_store.py        # MODIFIED: expansion pre-processing in hybrid_search
│   └── multi_hop.py           # NEW: MultiHopService orchestrating search+refs chains
├── models/
│   └── law.py                 # MODIFIED: chunk_typ description update for "satz"
├── data/
│   └── synonyms.py            # NEW: curated legal synonym dictionary
├── tools/
│   └── (existing tools)       # No new MCP tools for this phase
├── prompts/
│   └── __init__.py            # MODIFIED: 3 new prompt templates added
├── api.py                     # MODIFIED: expand param in search, new multi-hop endpoint
├── api_models.py              # MODIFIED: expanded_terms field, MultiHop models
└── config.py                  # MODIFIED: new settings
```

### Pattern 1: QueryExpander as Pre-Processing Service
**What:** A `QueryExpander` class that takes a query string and returns `(expanded_query, expanded_terms)`. It builds its synonym index once at init from LAW_REGISTRY + curated dict + optional JSON override.
**When to use:** Called before `hybrid_search()` when `expand=True`.
**Example:**
```python
# backend/src/paragraf/services/query_expander.py
class QueryExpander:
    """Juristisches Synonym-Woerterbuch fuer Query Expansion."""

    def __init__(self) -> None:
        self._synonyms: dict[str, list[str]] = {}
        self._build_index()

    def _build_index(self) -> None:
        """Baut Synonym-Index aus LAW_REGISTRY + manuellen Synonymen."""
        from paragraf.models.law import LAW_REGISTRY
        # Auto-generate: Abkuerzung <-> beschreibung <-> tags
        for abk, law_def in LAW_REGISTRY.items():
            self._synonyms[abk.lower()] = [law_def.beschreibung]
            self._synonyms[law_def.beschreibung.lower()] = [abk]
            for tag in law_def.tags:
                self._synonyms.setdefault(tag.lower(), []).append(abk)

        # Merge curated synonyms
        from paragraf.data.synonyms import LEGAL_SYNONYMS
        for key, values in LEGAL_SYNONYMS.items():
            self._synonyms.setdefault(key.lower(), []).extend(values)

        # Override with optional JSON if exists
        self._load_json_overrides()

    def expand(self, query: str) -> tuple[str, list[str]]:
        """Expandiert Query mit gefundenen Synonymen.

        Returns:
            (expanded_query_string, list_of_added_terms)
        """
        # Normalize arabic numbers first (D-03)
        normalized = self._normalize_query(query)
        found_terms: list[str] = []
        # Token matching against synonym index
        # ...
        return expanded_query, found_terms
```

### Pattern 2: Append vs Parallel Expansion Strategy
**What:** Two configurable strategies for how expansion terms are used in search.
**When to use:** Controlled by `QUERY_EXPANSION_STRATEGY` ENV var.
```python
# In qdrant_store.py or a search orchestration layer
if strategy == "append":
    # Simple: concatenate original + expansion terms into one query string
    full_query = f"{query} {' '.join(expansion_terms)}"
    results = await self.hybrid_search(full_query, top_k, search_filter)

elif strategy == "parallel":
    # Advanced: run both queries separately, merge with RRF
    original_results = await self.hybrid_search(query, top_k, search_filter)
    expanded_results = await self.hybrid_search(expanded_query, top_k, search_filter)
    # Merge via simple RRF: 1/(k+rank) scoring
    results = rrf_merge(original_results, expanded_results, k=60)
```

### Pattern 3: Multi-Hop as Orchestrator Service
**What:** A `MultiHopService` that chains existing search and reference methods. Does NOT duplicate logic.
**When to use:** For `/api/search/multi-hop` endpoint and as reusable logic for MCP prompts.
```python
# backend/src/paragraf/services/multi_hop.py
class MultiHopService:
    """Orchestriert mehrstufige Suche mit Querverweis-Traversal."""

    def __init__(self, qdrant: QdrantStore, reranker: RerankerService) -> None:
        self.qdrant = qdrant
        self.reranker = reranker

    async def search_with_hops(
        self,
        query: str,
        tiefe: int = 1,
        search_filter: SearchFilter | None = None,
    ) -> MultiHopResult:
        """Sucht, folgt Querverweisen, sucht weiter."""
        visited: set[str] = set()  # Circular reference protection
        hops: list[HopResult] = []

        # Initial search
        initial = await self.qdrant.hybrid_search(query, ...)
        # For each result, get outgoing references
        # For each reference, search again (up to tiefe hops)
        # Collect all results with hop metadata
```

### Pattern 4: Satz-Level Chunking in Parser
**What:** Extend `_extract_chunks()` to split long Absaetze into Satz-level chunks.
**When to use:** When an Absatz exceeds `CHUNK_SATZ_MIN_LENGTH`.
```python
# In parser.py, after existing absatz chunking logic
SATZ_PATTERN = re.compile(
    r'(?<=[.;:])\s+'        # Split after . ; : followed by whitespace
    r'(?=[A-Z0-9(§])'       # Only when next char is uppercase, number, ( or §
)

# Additional: German legal numbered items
NUMMER_PATTERN = re.compile(
    r'(?:^|\n)\s*(?:\d+\.|[a-z]\))\s+'  # "1. " or "a) " at line start
)
```

### Anti-Patterns to Avoid
- **Modifying `encode_query()` for expansion:** Query expansion must happen BEFORE embedding, not inside the embedding service. The EmbeddingService should remain pure -- it encodes whatever string it receives.
- **Duplicating search logic in multi-hop:** The multi-hop endpoint should call `hybrid_search()` and `get_outgoing_references()`, NOT reimplement their internals.
- **Over-expanding queries:** Adding too many synonyms dilutes the semantic signal. Keep expansion conservative: max 2-3 additional terms per match.
- **Breaking existing chunk IDs:** New `satz`-type chunks must have distinct IDs (e.g., `SGB_IX_§152_Abs1_S2`) that do NOT collide with existing `paragraph` or `absatz` chunk IDs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RRF merge for parallel strategy | Custom fusion algorithm | Simple 1/(k+rank) formula used by Qdrant itself | Well-understood formula, consistent with existing hybrid search |
| Sentence boundary detection | Complex NLP pipeline | Regex with German legal conventions | spaCy adds 500MB+ and still needs custom rules for legal text |
| Circular reference detection | Graph traversal library | Simple `visited: set[str]` tracking | Max 3 hops with ~5 results per hop means tiny graph |
| Synonym dictionary format | Custom file format | Python dict in .py file + JSON override | Matches project convention, importable, type-checkable |

**Key insight:** This phase is primarily about orchestration -- connecting existing services in new ways. The QueryExpander, multi-hop service, and Satz chunking are all thin layers over existing infrastructure.

## Common Pitfalls

### Pitfall 1: Expansion Diluting Sparse Vector Signal
**What goes wrong:** Appending many expansion terms to a query changes the sparse (lexical) vector dramatically, finding documents that match expansion terms but not the original intent.
**Why it happens:** bge-m3 sparse vectors are lexical weight maps -- adding terms shifts the entire weight distribution.
**How to avoid:** Keep expansion conservative (max 2-3 terms). For `append` strategy, consider weighting -- place original query terms first. For `parallel` strategy, this is naturally avoided since original query runs independently.
**Warning signs:** Search results become less relevant when expansion is enabled vs. disabled.

### Pitfall 2: German Sentence Boundaries in Legal Text
**What goes wrong:** Splitting on `.` breaks abbreviations (Abs., Nr., S., Satz, Buchst., lit., vgl., gem., i.V.m., etc.) and numbered lists.
**Why it happens:** German legal text is dense with abbreviations that end in periods.
**How to avoid:** Use a negative lookbehind for known legal abbreviations:
```python
# Known abbreviations that should NOT trigger sentence split
LEGAL_ABBREVS = r'(?<!Abs)(?<!Nr)(?<!Satz)(?<!Buchst)(?<!lit)(?<!vgl)(?<!gem)(?<!Art)(?<!Ziff)(?<!S)(?<!i\.V\.m)(?<!bzw)(?<!z\.B)(?<!u\.a)(?<!ggf)(?<!usw)(?<!etc)(?<!ca)(?<!bzgl)(?<!insb)(?<!i\.S\.d)(?<!i\.d\.R)'
```
**Warning signs:** Chunks that are fragments of abbreviations, chunks starting with lowercase letters.

### Pitfall 3: Circular References in Multi-Hop Traversal
**What goes wrong:** Paragraph A references B, B references C, C references A. Without protection, traversal loops infinitely.
**Why it happens:** German law has many cross-references that form cycles (especially i.V.m. chains).
**How to avoid:** Maintain a `visited: set[str]` keyed by `f"{gesetz}_{paragraph}"`. Skip any reference already visited. Log when a cycle is detected.
**Warning signs:** Multi-hop requests timing out or returning duplicate results.

### Pitfall 4: Re-Indexing Breaks Existing Point UUIDs
**What goes wrong:** Re-indexing with new chunk types (satz) could change point UUIDs for existing chunks if the ID generation logic changes.
**Why it happens:** If the ID format for `paragraph` and `absatz` chunks is accidentally modified.
**How to avoid:** Existing `paragraph_id` and `abs_id` generation code (lines 229, 252 of parser.py) must remain UNCHANGED. Only ADD new ID generation for `satz` chunks. Snapshot backup before re-indexing (Phase 1 pattern).
**Warning signs:** After re-indexing, existing bookmarks or saved references stop working.

### Pitfall 5: Multi-Hop Response Size Explosion
**What goes wrong:** With 3 hops, 5 results per hop, and 5 references per result, the response can contain 5 + 25 + 125 = 155 results.
**Why it happens:** Exponential growth per hop without limiting the expansion.
**How to avoid:** Limit per-hop results (e.g., follow only top 3 references per hop). Deduplicate across hops. Cap total results in response.
**Warning signs:** Multi-hop requests taking >10 seconds, response bodies exceeding 100KB.

### Pitfall 6: JSON Override File Not Found Error
**What goes wrong:** If `SYNONYMS_JSON_PATH` ENV points to a non-existent file, the server crashes at startup.
**Why it happens:** File path configured but file not deployed.
**How to avoid:** Treat JSON override as optional -- if file does not exist, log a warning and continue with code-only synonyms.
**Warning signs:** Server fails to start after adding synonym config ENV.

## Code Examples

### Curated Legal Synonym Dictionary Structure
```python
# backend/src/paragraf/data/synonyms.py
"""Manuell gepflegte juristische Kern-Synonyme."""

from __future__ import annotations

LEGAL_SYNONYMS: dict[str, list[str]] = {
    # Behindertenrecht
    "gdb": ["Grad der Behinderung"],
    "grad der behinderung": ["GdB", "Schwerbehinderung"],
    "schwerbehindertenausweis": ["SBA", "Ausweis", "Schwerbehinderung"],
    "merkzeichen": ["Nachteilsausgleich", "Schwerbehindertenausweis"],
    "merkzeichen g": ["Gehbehinderung", "erhebliche Gehbehinderung"],
    "merkzeichen ag": ["aussergewoehnliche Gehbehinderung", "Parkerleichterung"],
    "merkzeichen h": ["Hilflosigkeit", "hilflos"],
    "merkzeichen bl": ["Blindheit", "blind"],
    "eingliederungshilfe": ["Teilhabe", "Rehabilitation"],

    # Arbeitsrecht
    "kuendigung": ["Entlassung", "Kuendigungsschutz", "Beendigung"],
    "abfindung": ["Entlassung", "Kuendigung", "Aufhebungsvertrag"],
    "mutterschutz": ["Schwangerschaft", "MuSchG"],
    "elternzeit": ["BEEG", "Elterngeld"],

    # Sozialrecht
    "buergergeld": ["Arbeitslosengeld II", "ALG II", "Hartz IV", "SGB II"],
    "hartz iv": ["Buergergeld", "SGB II", "Grundsicherung"],
    "grundsicherung": ["Buergergeld", "Sozialhilfe", "SGB XII"],
    "pflegegeld": ["Pflegeversicherung", "SGB XI"],
    "pflegegrad": ["Pflegebeduerftigkeit", "SGB XI"],
    "rente": ["Rentenversicherung", "SGB VI", "Altersrente"],
    "erwerbsminderung": ["Erwerbsminderungsrente", "SGB VI"],

    # Steuerrecht
    "behindertenpauschbetrag": ["Pauschbetrag", "EStG", "Steuerermaessigung"],
    "steuerermaessigung": ["Freibetrag", "Pauschbetrag"],
}
```

### Satz-Level Splitting Regex
```python
# In parser.py - German legal sentence boundary detection
import re

# Abbreviations that must NOT trigger sentence split
_LEGAL_ABBREV = (
    "Abs|Nr|Satz|Buchst|lit|vgl|gem|Art|Ziff|S|bzw|usw|etc|ca|bzgl|insb|ggf"
)

# Pattern: sentence ends with . ; : followed by space and uppercase/§/number
_SATZ_BOUNDARY = re.compile(
    rf'(?<!{_LEGAL_ABBREV})'  # Not after known abbreviation
    r'(?<!\b[A-Z])'           # Not after single capital letter (e.g., "S. 1")
    r'(?<!\bi\.V\.m)'         # Not after i.V.m.
    r'(?<!\bi\.S\.d)'         # Not after i.S.d.
    r'(?<!\bi\.d\.R)'         # Not after i.d.R.
    r'(?<!\bz\.B)'            # Not after z.B.
    r'(?<!\bu\.a)'            # Not after u.a.
    r'[.]\s+'                 # Period followed by whitespace
    r'(?=[A-Z0-9§(])',        # Next char is uppercase, digit, §, or (
)

def _split_into_saetze(text: str) -> list[str]:
    """Spaltet Text an Satzgrenzen unter Beruecksichtigung juristischer Abkuerzungen."""
    parts = _SATZ_BOUNDARY.split(text)
    # Filter too-short fragments
    return [p.strip() for p in parts if len(p.strip()) >= 30]
```

**Note on regex approach:** The negative lookbehind approach has a limitation -- Python `re` requires fixed-width lookbehinds. A practical alternative is to first replace known abbreviations with placeholders (e.g., `Abs.` -> `Abs\x00`), split on periods, then restore. This is more reliable than complex lookbehinds.

### Multi-Hop Pydantic Models
```python
# In api_models.py
class MultiHopRequest(BaseModel):
    anfrage: str = Field(description="Suchanfrage in natuerlicher Sprache")
    gesetzbuch: str | None = Field(None, description="Filter nach Gesetzbuch")
    tiefe: int = Field(1, ge=1, le=3, description="Traversal-Tiefe (1-3 Hops)")
    max_ergebnisse_pro_hop: int = Field(5, ge=1, le=10, description="Ergebnisse pro Hop")
    expand: bool = Field(True, description="Query Expansion aktivieren")


class HopResultItem(BaseModel):
    """Ein Ergebnis innerhalb eines Hops."""
    paragraph: str
    gesetz: str
    titel: str
    text: str
    score: float
    hop: int = Field(description="Hop-Nummer (0 = initiale Suche)")
    via_reference: str | None = Field(None, description="Querverweis der zu diesem Ergebnis fuehrte")


class MultiHopResponse(BaseModel):
    query: str
    expanded_terms: list[str] = Field(default_factory=list)
    hops: int = Field(description="Anzahl durchgefuehrter Hops")
    results: list[HopResultItem]
    total: int
    visited_paragraphs: list[str] = Field(description="Alle besuchten Paragraphen")
    disclaimer: str = (
        "Dies ist eine allgemeine Rechtsinformation, keine Rechtsberatung "
        "im Sinne des Rechtsdienstleistungsgesetzes (RDG)."
    )
```

### MCP Prompt Template Pattern (following existing register_prompts)
```python
# In prompts/__init__.py - added to register_prompts()
@mcp.prompt()
def paragraf_legal_analysis(thema: str, gesetzbuch: str = "") -> str:
    """Umfassende Rechtsanalyse: Suche + Querverweise folgen + Zusammenfassung.

    Args:
        thema: Das Thema der Rechtsanalyse
        gesetzbuch: Optional: Fokus auf bestimmtes Gesetzbuch
    """
    filter_hint = f" im {gesetzbuch}" if gesetzbuch else ""
    return (
        f"Fuehre eine umfassende Rechtsanalyse zum Thema '{thema}'{filter_hint} durch.\n\n"
        f"Schritt 1: Suche mit 'paragraf_search' nach '{thema}'{filter_hint}.\n"
        f"Schritt 2: Fuer die wichtigsten Ergebnisse (Top 3): "
        f"Rufe 'paragraf_references' auf, um Querverweise zu finden.\n"
        f"Schritt 3: Schaue dir die wichtigsten Querverweise mit 'paragraf_lookup' an.\n"
        f"Schritt 4: Fasse die Gesamtrechtslage zusammen:\n"
        f"- Welche Hauptnormen regeln das Thema?\n"
        f"- Welche Querverweise sind besonders relevant?\n"
        f"- Gibt es Widersprueche oder Ergaenzungen zwischen den Normen?\n\n"
        f"Gib immer die genauen Paragraphen-Referenzen an.\n"
        f"Weise am Ende auf EUTB-Beratungsstellen hin."
    )
```

### Settings Extension
```python
# In config.py - new settings to add
# ── Query Expansion ─────────────────────────────────────
query_expansion_strategy: Literal["append", "parallel"] = "append"
query_expansion_enabled: bool = True

# ── Chunking ────────────────────────────────────────────
chunk_min_length_for_split: int = 800
chunk_satz_min_length: int = 100

# ── Multi-Hop ──────────────────────────────────────────
multi_hop_max_depth: int = 3
multi_hop_results_per_hop: int = 5
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 800-char absatz split | Configurable ENV-based thresholds | This phase | More control over chunking granularity |
| No query expansion | LAW_REGISTRY-based + curated synonyms | This phase | Better recall for abbreviation queries |
| Single search pass | Multi-hop search + reference traversal | This phase | Complex legal questions answered more completely |

**Deprecated/outdated:**
- py-openthesaurus for synonym expansion: Explicitly deferred to V2-04 due to rate-limit problems

## Open Questions

1. **Satz-Erkennung: Regex vs. Placeholder Approach**
   - What we know: Python `re` requires fixed-width lookbehinds, making complex abbreviation exclusion difficult
   - What's unclear: Whether the placeholder approach (replace abbreviations, split, restore) is reliable enough for all legal text patterns
   - Recommendation: Use placeholder approach -- it is more maintainable and testable. Create a comprehensive test suite with real law text samples.

2. **Parallel Strategy RRF k-parameter**
   - What we know: Qdrant uses k=60 for its internal RRF fusion
   - What's unclear: Whether k=60 is optimal for merging original vs. expanded query results (different semantic space than dense+sparse fusion)
   - Recommendation: Use k=60 as default (matches Qdrant convention), make it a constant that can be adjusted after testing.

3. **Multi-Hop Reranking Decision**
   - What we know: Claude's discretion whether to apply reranking to combined multi-hop results
   - What's unclear: Whether reranking across different hops produces meaningful scores (results from different contexts)
   - Recommendation: Apply reranking ONLY to the final combined results, using the ORIGINAL query as the reranking reference. This ensures relevance to the user's actual question.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=8.0.0 + pytest-asyncio >=0.23.0 |
| Config file | `backend/pyproject.toml` (`asyncio_mode = "auto"`) |
| Quick run command | `docker compose exec backend python -m pytest tests/ -x -q` |
| Full suite command | `docker compose exec backend python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-07a | QueryExpander builds index from LAW_REGISTRY | unit | `pytest tests/test_query_expander.py::TestQueryExpanderIndex -x` | Wave 0 |
| SRCH-07b | Expand "GdB" returns "Grad der Behinderung" | unit | `pytest tests/test_query_expander.py::TestQueryExpanderExpand -x` | Wave 0 |
| SRCH-07c | Arabic normalization at search time (SGB 9 -> SGB IX) | unit | `pytest tests/test_query_expander.py::TestQueryExpanderNormalize -x` | Wave 0 |
| SRCH-07d | JSON override merges with code dict | unit | `pytest tests/test_query_expander.py::TestQueryExpanderJsonOverride -x` | Wave 0 |
| SRCH-07e | expand=false disables expansion | unit | `pytest tests/test_api_models.py::TestSearchRequestExpand -x` | Wave 0 |
| SRCH-07f | expanded_terms field in SearchResponse | unit | `pytest tests/test_api_models.py::TestSearchResponseExpandedTerms -x` | Wave 0 |
| SRCH-07g | Settings defaults for expansion strategy | unit | `pytest tests/test_config.py::TestSettings::test_query_expansion_defaults -x` | Wave 0 |
| MCP-04a | Multi-hop endpoint chains search+refs | unit | `pytest tests/test_multi_hop.py::TestMultiHopService -x` | Wave 0 |
| MCP-04b | Circular reference protection | unit | `pytest tests/test_multi_hop.py::TestMultiHopCircular -x` | Wave 0 |
| MCP-04c | 3 MCP prompt templates registered | unit | `pytest tests/test_prompts.py::TestMultiHopPrompts -x` | Wave 0 |
| CHUNK-01a | Satz-level splitting at sentence boundaries | unit | `pytest tests/test_parser.py::TestSatzChunking -x` | Wave 0 |
| CHUNK-01b | Legal abbreviations preserved during split | unit | `pytest tests/test_parser.py::TestSatzAbbreviations -x` | Wave 0 |
| CHUNK-01c | New satz chunk type has correct metadata | unit | `pytest tests/test_parser.py::TestSatzMetadata -x` | Wave 0 |
| CHUNK-02 | Re-indexing produces satz chunks alongside existing types | integration | `pytest tests/test_parser.py::TestReindexChunkTypes -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `docker compose exec backend python -m pytest tests/ -x -q`
- **Per wave merge:** `docker compose exec backend python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_query_expander.py` -- covers SRCH-07 (expansion service)
- [ ] `tests/test_multi_hop.py` -- covers MCP-04 (multi-hop orchestration)
- [ ] Extension of `tests/test_parser.py` -- covers CHUNK-01/CHUNK-02 (satz chunking)
- [ ] Extension of `tests/test_config.py` -- covers new settings defaults
- [ ] Extension of `tests/test_api_models.py` -- covers expand field and expanded_terms
- [ ] Extension of `tests/test_prompts.py` -- covers 3 new prompt templates

## Project Constraints (from CLAUDE.md)

- All commits on branch `Docker-only`, never on main/master
- Python 3.12+, async/await for all service methods
- Deutsche Docstrings, englische Variablen-/Funktionsnamen
- Pydantic v2 for all models, Pydantic Settings for config
- `from __future__ import annotations` at top of every Python file
- Ruff linter (line-length 100, strict rules)
- Mypy strict mode
- Configuration via ENV vars in docker-compose.yml
- Qdrant v1.13.2 compatibility
- BAAI/bge-m3 + bge-reranker-v2-m3 models only
- RDG disclaimer in every response
- German abbreviations in Roman numerals: "SGB IX" not "SGB 9"

## Sources

### Primary (HIGH confidence)
- `backend/src/paragraf/services/parser.py` lines 220-270 -- existing chunking logic with 800-char threshold
- `backend/src/paragraf/services/parser.py` lines 539-579 -- `_normalize_abkuerzung()` implementation
- `backend/src/paragraf/services/qdrant_store.py` lines 282-358 -- `hybrid_search()` with RRF fusion
- `backend/src/paragraf/services/qdrant_store.py` lines 787-866 -- reference query methods
- `backend/src/paragraf/models/law.py` -- LAW_REGISTRY (95+ entries), LawChunk, ChunkMetadata
- `backend/src/paragraf/prompts/__init__.py` -- existing 4 MCP prompt templates as pattern
- `backend/src/paragraf/tools/references.py` -- paragraf_references tool pattern
- `backend/src/paragraf/config.py` -- Settings class pattern for new ENV vars
- `backend/src/paragraf/api_models.py` -- existing request/response model patterns
- `backend/src/paragraf/server.py` -- MCP server setup, tool/prompt registration pattern

### Secondary (MEDIUM confidence)
- German legal text sentence boundary conventions -- based on analysis of existing parsed law text patterns in the codebase

### Tertiary (LOW confidence)
- Optimal RRF k-parameter for parallel expansion strategy -- needs empirical testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - patterns established in prior phases, well-understood integration points
- Pitfalls: HIGH - derived from direct code analysis and domain knowledge of German legal text
- Chunking regex: MEDIUM - German legal abbreviations are numerous, regex needs iterative testing

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain, no external dependency changes expected)

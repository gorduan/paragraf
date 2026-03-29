# Phase 6: Cross-Reference Pipeline - Research

**Researched:** 2026-03-27
**Domain:** German legal citation extraction, Qdrant payload management, citation network API
**Confidence:** HIGH

## Summary

Phase 6 builds a cross-reference extraction pipeline that parses German legal citations from paragraph text, stores them as structured payload in Qdrant, and exposes a citation network API. The core technical challenges are: (1) regex-based extraction of German legal citation patterns, (2) Qdrant `set_payload` for non-destructive payload augmentation, and (3) Qdrant nested filters for querying structured arrays of reference objects.

All required Qdrant features (`set_payload`, `NestedCondition`, `count`) are available in qdrant-client >= 1.12.0 with Qdrant v1.13.2. The nested filter feature was introduced in Qdrant 1.2 and is well-established. No new dependencies are needed -- this phase uses only existing Python stdlib (`re`) and the already-installed `qdrant-client`.

**Primary recommendation:** Build a `CrossReferenceExtractor` service class with pure regex extraction (no new dependencies), use `set_payload` for non-destructive payload augmentation, and use `NestedCondition` for incoming reference queries.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Core patterns: SS X GESETZ, SS X Abs. Y GESETZ, Art. X GESETZ, i.V.m. chains. Covers ~90% of real citations. Expandable later without re-architecture.
- **D-02:** All extracted citations tagged as `verified` (law abbreviation in LAW_REGISTRY) or `unverified` (not in registry). Both are stored -- unverified captures references to laws not yet indexed.
- **D-03:** i.V.m. chains split into separate references. "SS 5 Abs. 1 i.V.m. SS 6 Abs. 2 SGB IX" becomes two independent references, each independently navigable.
- **D-04:** References stored as structured objects in `references_out` payload field: `{gesetz, paragraph, absatz, raw, verified, kontext}`. Enables filtering by target law, granular lookups, and clean API responses.
- **D-05:** Context keyword stored per reference (`kontext` field): 'i.V.m.', 'gemaess', 'nach', 'siehe', null. Explains WHY a paragraph cites another.
- **D-06:** Qdrant payload filter at query time as default strategy. Query references_out fields with nested match to find "what cites this paragraph". No pre-computation needed.
- **D-07:** Resolution strategy configurable via environment variable (e.g., `XREF_RESOLUTION_STRATEGY`). Default: `filter` (query-time). Future option: `precomputed` (reverse index).
- **D-08:** API response includes `incoming_count` alongside the list of citing paragraphs. Uses Qdrant count query with same filter.
- **D-09:** `set_payload` as default approach -- adds `references_out` to existing points without re-embedding. No downtime, vectors unchanged. Snapshot created before operation (Phase 1 D-03).
- **D-10:** Full re-index must also be possible as an option (e.g., parameter on extraction endpoint). For cases where complete data refresh is needed.
- **D-11:** Standalone endpoint `POST /api/references/extract` triggers extraction + set_payload on all indexed laws. Independent of indexing flow. Also callable via MCP tool.

### Claude's Discretion
- Regex implementation details and test strategy for citation patterns
- Pydantic model names for reference objects
- Error handling for partial extraction failures (some laws succeed, some fail)
- Whether to add a `POST /api/references/extract/{gesetz}` single-law variant
- Nested filter structure for Qdrant payload queries on structured objects

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XREF-01 | Regex-basierte Querverweis-Extraktion aus deutschem Gesetzestext | German citation regex patterns, LAW_REGISTRY validation |
| XREF-02 | Querverweise als Array im Qdrant-Payload speichern (pro Paragraph) | Qdrant set_payload API, structured payload objects |
| XREF-03 | Re-Indexierung aller Gesetze mit Querverweis-Daten (nach Snapshot) | set_payload + snapshot integration, scroll-based extraction |
| XREF-04 | Zitationsnetzwerk-API -- referenzierte und referenzierende Normen abrufen | NestedCondition filter, count API, REST endpoint patterns |
| MCP-03 | MCP-Tool `paragraf_references` -- Querverweise eines Paragraphen abrufen | MCP tool registration pattern, dual-input pattern |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Branch:** All commits on branch `Docker-only`, never on main/master
- **Python 3.12+** with async/await for all service methods
- **Pydantic v2** for all models
- **Deutsche Docstrings**, englische Variablen-/Funktionsnamen
- **Ruff** linting: line-length 100, rules E/F/I/N/W/UP/B/SIM
- **`from __future__ import annotations`** at top of every Python file
- **Type annotations** on all public methods (mypy strict)
- **Existing patterns:** Use `_build_filter()` extension, `register_*_tools()` pattern, `AppContext` access via `ctx.request_context.lifespan_context`
- **Qdrant v1.13.2** -- features must be compatible
- **qdrant-client >= 1.12.0** -- confirmed compatible

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| re (stdlib) | Python 3.12 | Regex-based citation extraction | No external NLP needed for structured citation patterns |
| qdrant-client | >= 1.12.0 (installed) | set_payload, NestedCondition, count | Already in project, all APIs available |
| pydantic | >= 2.0.0 (installed) | Reference data models | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pydantic-settings | >= 2.0.0 (installed) | XREF_RESOLUTION_STRATEGY config | Settings extension |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex extraction | spaCy NER | Overkill for structured citations; adds ~500MB dependency |
| Query-time incoming refs | Pre-computed reverse index | Simpler now, D-07 allows future switch |

**Installation:** No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
backend/src/paragraf/
├── services/
│   ├── cross_reference.py    # NEW: CrossReferenceExtractor
│   └── qdrant_store.py       # EXTEND: set_payload, nested filter, count methods
├── models/
│   └── law.py                # EXTEND: ChunkMetadata.references_out, Reference model
├── api.py                    # EXTEND: /api/references/* endpoints
├── api_models.py             # EXTEND: Reference request/response models
├── config.py                 # EXTEND: xref_resolution_strategy setting
├── server.py                 # EXTEND: register_reference_tools import
└── tools/
    └── references.py         # NEW: paragraf_references MCP tool
```

### Pattern 1: CrossReferenceExtractor Service
**What:** Pure service class that extracts citations from text using regex, returning structured `Reference` objects. Stateless -- no Qdrant dependency in the extractor itself.
**When to use:** Called by extraction endpoint/MCP tool; receives text, returns references.
**Example:**
```python
# Source: Project pattern from existing services
from __future__ import annotations

import re
import logging
from paragraf.models.law import LAW_REGISTRY

logger = logging.getLogger(__name__)

class CrossReferenceExtractor:
    """Extrahiert Querverweise aus deutschem Gesetzestext."""

    # Core citation patterns
    # § 152 SGB IX, § 5 Abs. 1 SGB IX, §§ 36, 37 SGB XI
    PARAGRAPH_PATTERN = re.compile(
        r'§§?\s*'                           # § or §§
        r'(\d+\w?)'                          # paragraph number (e.g., 152, 36a)
        r'(?:\s+Abs\.\s*(\d+))?'             # optional Absatz
        r'(?:\s+(?:Satz|S\.)\s*(\d+))?'      # optional Satz
        r'\s+'                               # whitespace before law abbreviation
        r'([A-ZÄÖÜ][A-Za-zÄÖÜäöü/\s]*?'     # law abbreviation start
        r'(?:IX|VIII|VII|XIV|XII|XI|VI|V|IV|III|II|X|I)?)'  # roman numerals
        r'(?=[\s,;.\):]|$)',                 # lookahead: end boundary
        re.UNICODE
    )

    # Art. X GG, Art. X DSGVO
    ARTIKEL_PATTERN = re.compile(
        r'Art\.?\s*'
        r'(\d+\w?)'                          # article number
        r'(?:\s+Abs\.\s*(\d+))?'
        r'\s+'
        r'([A-ZÄÖÜ][A-Za-zÄÖÜäöü/\s]*?'
        r'(?:IX|VIII|VII|XIV|XII|XI|VI|V|IV|III|II|X|I)?)'
        r'(?=[\s,;.\):]|$)',
        re.UNICODE
    )

    def extract(self, text: str) -> list[dict]:
        """Extrahiert alle Querverweise aus dem gegebenen Text."""
        ...
```

### Pattern 2: Qdrant set_payload for Non-Destructive Augmentation
**What:** Uses `AsyncQdrantClient.set_payload()` to add `references_out` field to existing points without re-embedding.
**When to use:** Default extraction path (D-09). Scroll through all points, extract references from text, batch-update payloads.
**Example:**
```python
# Source: Qdrant official docs - https://qdrant.tech/documentation/manage-data/payload/
await self.client.set_payload(
    collection_name=self.collection_name,
    payload={
        "references_out": [
            {"gesetz": "SGB IX", "paragraph": "§ 152", "absatz": 1,
             "raw": "§ 152 Abs. 1 SGB IX", "verified": True, "kontext": "gemaess"},
        ]
    },
    points=[point_id],  # specific point UUID
    wait=True,
)
```

### Pattern 3: NestedCondition for Incoming Reference Queries
**What:** Uses `NestedCondition` to find all points whose `references_out` array contains objects matching target gesetz+paragraph.
**When to use:** Citation network API -- "what cites this paragraph?" (D-06).
**Example:**
```python
# Source: Qdrant docs - https://qdrant.tech/documentation/search/filtering/
from qdrant_client import models

nested_filter = models.Filter(
    must=[
        models.NestedCondition(
            nested=models.Nested(
                key="references_out",
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="gesetz",
                            match=models.MatchValue(value="SGB IX"),
                        ),
                        models.FieldCondition(
                            key="paragraph",
                            match=models.MatchValue(value="§ 152"),
                        ),
                    ]
                ),
            )
        )
    ]
)

# Scroll to get all citing paragraphs
records, _ = await self.client.scroll(
    collection_name=self.collection_name,
    scroll_filter=nested_filter,
    limit=100,
    with_payload=True,
)

# Count for incoming_count (D-08)
count_result = await self.client.count(
    collection_name=self.collection_name,
    count_filter=nested_filter,
    exact=True,
)
```

### Pattern 4: Extraction Workflow (Scroll + Extract + set_payload)
**What:** Scroll through all indexed points, extract references from text payload, batch-update with set_payload.
**When to use:** `POST /api/references/extract` endpoint.
**Example:**
```python
# Scroll through all points in batches
offset = None
while True:
    records, next_offset = await self.client.scroll(
        collection_name=self.collection_name,
        limit=100,
        offset=offset,
        with_payload=["chunk_id", "text", "gesetz", "paragraph"],
    )
    if not records:
        break

    for record in records:
        text = record.payload.get("text", "")
        refs = extractor.extract(text)
        if refs:
            await self.client.set_payload(
                collection_name=self.collection_name,
                payload={"references_out": refs},
                points=[record.id],
                wait=False,  # Batch: no need to wait per point
            )

    offset = next_offset
    if offset is None:
        break
```

### Anti-Patterns to Avoid
- **Don't use `overwrite_payload`:** It replaces ALL payload fields. Use `set_payload` which merges/adds fields.
- **Don't pre-compute reverse index at extraction time:** D-06 says query-time filtering. Pre-computation is a future option (D-07).
- **Don't create a separate collection for references:** Store in existing point payload. Qdrant handles nested queries efficiently.
- **Don't extract references during embedding/upsert by default:** D-11 mandates a standalone extraction endpoint, independent of indexing flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reverse reference lookup | Manual pre-computed index | Qdrant NestedCondition filter | Qdrant handles this natively; D-06 mandates query-time |
| Point counting | Manual iteration + count | `client.count(count_filter=...)` | Built-in, exact count support |
| Payload augmentation | Re-embed + re-upsert | `client.set_payload()` | No re-embedding needed, vectors unchanged |
| Law abbreviation validation | Custom lookup logic | `LAW_REGISTRY` dict lookup | Already exists with 95+ entries |
| Citation text cleanup | Custom normalizer | `_normalize_paragraph_input()` | Already handles SS-character variants |

**Key insight:** Qdrant's `set_payload` + `NestedCondition` + `count` APIs handle the entire storage and query layer. The only custom logic needed is the regex extraction itself.

## Common Pitfalls

### Pitfall 1: Greedy Regex Matching on Law Abbreviations
**What goes wrong:** Regex captures too much or too little text as the law abbreviation. "SS 5 SGB IX" could match "SGB" instead of "SGB IX" if the pattern doesn't handle multi-word abbreviations with roman numerals.
**Why it happens:** German law abbreviations vary wildly: single word ("BGB"), multi-word with roman numerals ("SGB IX"), with slashes ("FreizuegG/EU"), with umlauts ("BAfoG").
**How to avoid:** Build the regex to greedily match known LAW_REGISTRY keys. Use a post-match validation step: after regex captures a candidate, check if the candidate (or a longer match) exists in LAW_REGISTRY. Try longest match first.
**Warning signs:** Tests show "SGB" matched instead of "SGB IX"; or "GG" captures trailing words.

### Pitfall 2: i.V.m. Chain Splitting Ambiguity
**What goes wrong:** "SS 5 Abs. 1 i.V.m. SS 6 Abs. 2 SGB IX" -- the law abbreviation "SGB IX" applies to both references, but the regex might not propagate it to the first reference.
**Why it happens:** In German legal text, the law abbreviation often appears only at the end of a citation chain. Earlier references in the chain inherit it implicitly.
**How to avoid:** Two-pass approach: (1) extract full citation strings including i.V.m., (2) split chains and propagate the trailing law abbreviation to all parts that lack one.
**Warning signs:** First reference in i.V.m. chain has no `gesetz` field.

### Pitfall 3: set_payload Batch Performance
**What goes wrong:** Calling `set_payload` per-point with `wait=True` for thousands of points is extremely slow.
**Why it happens:** Each call waits for Qdrant to confirm the write.
**How to avoid:** Use `wait=False` for individual calls within a batch, or use Qdrant's batch update API. Call with `wait=True` only on the final batch. Alternatively, batch multiple point IDs in a single `set_payload` call if they share the same payload (they won't -- each point has different references).
**Warning signs:** Extraction of 5000+ points takes > 10 minutes.

### Pitfall 4: Nested Filter Without Payload Index
**What goes wrong:** Nested filter queries on `references_out` are slow without a payload index on the nested fields.
**Why it happens:** Qdrant needs payload indexes to efficiently filter. Without them, it scans all points.
**How to avoid:** Create payload indexes on `references_out[].gesetz` and `references_out[].paragraph` after extraction. Use keyword index type.
**Warning signs:** Incoming reference queries take > 1 second.

### Pitfall 5: SS-Number Ranges and Multi-Paragraph Citations
**What goes wrong:** "SSSS 36, 37 SGB XI" (multiple paragraphs) or "SSSS 36 bis 42 SGB XI" (ranges) are not captured by simple single-paragraph regex.
**Why it happens:** German legal text uses SSSS for plural citations.
**How to avoid:** Add a separate pattern for SSSS (plural) that splits comma-separated and range references into individual entries.
**Warning signs:** References containing SSSS are entirely missed.

### Pitfall 6: Snapshot Before Extraction
**What goes wrong:** Extraction modifies payload but fails midway, leaving partial data with no way to roll back.
**Why it happens:** `set_payload` is not transactional across multiple points.
**How to avoid:** Per D-09, create snapshot BEFORE extraction begins. Use existing `create_snapshot()` method from Phase 1.
**Warning signs:** After failed extraction, some points have `references_out` and others don't.

## Code Examples

### German Legal Citation Regex (Complete)
```python
# Source: Analysis of LAW_REGISTRY keys and German legal citation conventions
import re
from paragraf.models.law import LAW_REGISTRY

# Build alternation pattern from LAW_REGISTRY keys, longest first
_SORTED_LAWS = sorted(LAW_REGISTRY.keys(), key=len, reverse=True)
_LAW_PATTERN = "|".join(re.escape(k) for k in _SORTED_LAWS)

# Context keywords that precede citations
_KONTEXT_PATTERN = r'(?:(?:i\.\s*V\.\s*m\.|gem(?:aess|\.)|nach|siehe|vgl\.)\s+)?'

# Single paragraph citation: § X [Abs. Y] GESETZ
CITE_SINGLE = re.compile(
    _KONTEXT_PATTERN
    + r'(§)\s*'
    + r'(\d+\w?)'                            # paragraph number
    + r'(?:\s+Abs\.\s*(\d+))?'               # optional absatz
    + r'\s+(' + _LAW_PATTERN + r')'           # law abbreviation from registry
    + r'(?=[\s,;.\):\-]|$)',
    re.UNICODE
)

# Article citation: Art. X GESETZ
CITE_ARTIKEL = re.compile(
    _KONTEXT_PATTERN
    + r'(Art\.?)\s*'
    + r'(\d+\w?)'
    + r'(?:\s+Abs\.\s*(\d+))?'
    + r'\s+(' + _LAW_PATTERN + r')'
    + r'(?=[\s,;.\):\-]|$)',
    re.UNICODE
)
```

### Reference Pydantic Model
```python
# Source: D-04 from CONTEXT.md
from pydantic import BaseModel, Field

class Reference(BaseModel):
    """Ein einzelner Querverweis auf einen anderen Paragraphen."""
    gesetz: str = Field(description="Zielgesetz-Abkuerzung, z.B. 'SGB IX'")
    paragraph: str = Field(description="Ziel-Paragraph, z.B. '§ 152'")
    absatz: int | None = Field(None, description="Ziel-Absatz (1-basiert)")
    raw: str = Field(description="Original-Zitationstext aus dem Gesetz")
    verified: bool = Field(description="True wenn gesetz in LAW_REGISTRY")
    kontext: str | None = Field(
        None,
        description="Kontext-Keyword: 'i.V.m.', 'gemaess', 'nach', 'siehe', null",
    )
```

### Nested Filter Builder for Incoming References
```python
# Source: Qdrant docs + D-06
def _build_incoming_filter(
    self, gesetz: str, paragraph: str
) -> models.Filter:
    """Baut NestedCondition-Filter fuer eingehende Referenzen."""
    return models.Filter(
        must=[
            models.NestedCondition(
                nested=models.Nested(
                    key="references_out",
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="gesetz",
                                match=models.MatchValue(value=gesetz),
                            ),
                            models.FieldCondition(
                                key="paragraph",
                                match=models.MatchValue(value=paragraph),
                            ),
                        ]
                    ),
                )
            )
        ]
    )
```

### MCP Tool Pattern (from discover.py)
```python
# Source: backend/src/paragraf/tools/discover.py
def register_reference_tools(mcp: FastMCP) -> None:
    """Registriert Querverweis-Tools am MCP-Server."""

    @mcp.tool()
    async def paragraf_references(
        ctx: Context,
        paragraph: str,
        gesetz: str,
        richtung: str = "beide",
        max_ergebnisse: int = 20,
    ) -> str:
        """Querverweise eines Paragraphen abrufen.

        Args:
            paragraph: Paragraph-Bezeichnung, z.B. '§ 152'
            gesetz: Gesetzbuch, z.B. 'SGB IX'
            richtung: 'ausgehend', 'eingehend', oder 'beide'
            max_ergebnisse: Max. Ergebnisse (1-50, Standard: 20)
        """
        app = ctx.request_context.lifespan_context
        await app.ensure_ready()
        # ... implementation
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Neo4j for citation graphs | Qdrant nested payload filters | Project decision (Out of Scope) | No new database; payload arrays suffice for ~95 laws |
| NLP-based citation extraction | Regex-based extraction | D-01 decision | Simpler, no new ML dependencies, ~90% coverage |
| Pre-computed reverse index | Query-time NestedCondition | D-06 decision | Simpler architecture, configurable for future (D-07) |

## Open Questions

1. **Payload index creation for nested fields**
   - What we know: Qdrant supports payload indexes on nested fields using dot notation (e.g., `references_out[].gesetz`)
   - What's unclear: Whether index creation uses bracket notation or dot notation in qdrant-client >= 1.12.0
   - Recommendation: Test both `references_out[].gesetz` and `references_out.gesetz` during implementation; create keyword indexes after first extraction run

2. **Batch size for set_payload operations**
   - What we know: Individual set_payload calls work; batch update API exists
   - What's unclear: Optimal batch size for ~5000-10000 points
   - Recommendation: Start with per-point set_payload with `wait=False`, measure performance. If too slow, switch to batch update points API.

3. **Edge cases in citation patterns**
   - What we know: Core patterns (SS X Gesetz, Art. X Gesetz, i.V.m.) cover ~90%
   - What's unclear: Exact frequency of SSSS-ranges, "f." / "ff." suffixes, sentence-level references
   - Recommendation: Build core patterns first, add edge cases iteratively based on real extraction results

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >= 8.0.0 + pytest-asyncio >= 0.23.0 |
| Config file | `backend/pyproject.toml` (asyncio_mode = "auto") |
| Quick run command | `cd backend && python -m pytest tests/test_cross_reference.py tests/test_references_tool.py -x -v` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XREF-01 | Regex extracts SS X Abs. Y GESETZ, Art. X, i.V.m. chains | unit | `python -m pytest tests/test_cross_reference.py -x` | No -- Wave 0 |
| XREF-02 | References stored as structured array in payload | unit | `python -m pytest tests/test_qdrant_store.py -k reference -x` | No -- Wave 0 |
| XREF-03 | Extraction + set_payload on all indexed laws | unit | `python -m pytest tests/test_cross_reference.py -k extract_all -x` | No -- Wave 0 |
| XREF-04 | Citation network API returns outgoing + incoming | unit | `python -m pytest tests/test_api_models.py -k reference -x` | No -- Wave 0 |
| MCP-03 | paragraf_references MCP tool | unit | `python -m pytest tests/test_references_tool.py -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_cross_reference.py tests/test_references_tool.py -x -v`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_cross_reference.py` -- covers XREF-01 (regex extraction), XREF-03 (extraction workflow)
- [ ] `tests/test_references_tool.py` -- covers MCP-03 (paragraf_references tool)
- [ ] Extension to `tests/test_qdrant_store.py` -- covers XREF-02 (set_payload), XREF-04 (nested filter queries)

## Sources

### Primary (HIGH confidence)
- Qdrant official docs: [Filtering](https://qdrant.tech/documentation/search/filtering/) -- NestedCondition syntax, nested filter semantics
- Qdrant official docs: [Payload Management](https://qdrant.tech/documentation/manage-data/payload/) -- set_payload API, filter-based updates
- Qdrant Python client docs: [AsyncQdrantClient](https://python-client.qdrant.tech/qdrant_client.async_qdrant_client) -- method signatures
- Project codebase: `backend/src/paragraf/services/qdrant_store.py` -- existing _build_filter pattern, scroll, snapshot methods
- Project codebase: `backend/src/paragraf/models/law.py` -- LAW_REGISTRY (95+ entries), ChunkMetadata structure
- Project codebase: `backend/src/paragraf/tools/discover.py` -- MCP tool registration pattern, dual-input, _resolve_examples

### Secondary (MEDIUM confidence)
- [Qdrant 1.2 release notes](https://qdrant.tech/articles/qdrant-1.2.x/) -- nested filter feature introduction (available since 1.2, well before v1.13.2)
- German legal citation conventions -- based on domain knowledge of SS/Art./i.V.m. patterns in German law

### Tertiary (LOW confidence)
- Optimal batch size for set_payload operations -- needs empirical testing
- Payload index performance on nested fields -- general documentation confirms support, specific performance with ~10k points unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all APIs verified in Qdrant docs
- Architecture: HIGH -- patterns directly extend existing codebase; NestedCondition syntax confirmed in official docs
- Pitfalls: HIGH -- based on actual codebase analysis (LAW_REGISTRY key formats, i.V.m. semantics, set_payload behavior)
- Regex patterns: MEDIUM -- core patterns well-defined, edge cases need iterative refinement against real data

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain, no fast-moving dependencies)

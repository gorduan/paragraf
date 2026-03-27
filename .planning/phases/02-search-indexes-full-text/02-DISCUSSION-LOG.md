# Phase 2: Search Indexes & Full-Text - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 02-search-indexes-full-text
**Areas discussed:** Search mode design, Absatz range filtering, Full-text search behavior, MCP tool exposure, Index creation timing, Existing data migration, Full-text min token length

---

## Search mode design

### API surface

| Option | Description | Selected |
|--------|-------------|----------|
| Single endpoint + toggle | Extend /api/search with search_type parameter: 'semantic', 'fulltext', 'hybrid_fulltext' | ✓ |
| Separate endpoint | New /api/search/fulltext alongside existing /api/search | |
| You decide | Claude picks based on codebase patterns | |

**User's choice:** Single endpoint + toggle (Recommended)
**Notes:** Keeps one search surface, cleaner API

### Reranking for fulltext

| Option | Description | Selected |
|--------|-------------|----------|
| No reranking for fulltext | Full-text results are exact keyword matches, reranking adds latency without benefit | ✓ |
| Always rerank | Every search mode gets cross-encoder reranking | |
| You decide | Claude picks based on what makes sense | |

**User's choice:** No reranking for fulltext (Recommended)

### Response metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Add search_type to response | SearchResponse includes search_type field | ✓ |
| No metadata | Keep response unchanged | |
| You decide | Claude picks based on downstream needs | |

**User's choice:** Add search_type to response (Recommended)

---

## Absatz range filtering

### Filter design

| Option | Description | Selected |
|--------|-------------|----------|
| Min/max fields | absatz_von and absatz_bis for range queries | ✓ |
| Single value only | Exact match absatz field, no ranges | |
| You decide | Claude picks based on Qdrant capabilities | |

**User's choice:** Min/max fields (Recommended)

### Null absatz handling

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude null absatz | Only absatz-level chunks returned when filter active | ✓ |
| Include null as 'all' | Paragraph-level chunks match any range | |
| You decide | Claude picks based on legal research needs | |

**User's choice:** Exclude null absatz (Recommended)

---

## Full-text search behavior

### Tokenizer

| Option | Description | Selected |
|--------|-------------|----------|
| Multilingual | Qdrant's multilingual tokenizer for German compound words | ✓ |
| Word-based (default) | Simple whitespace/punctuation splitting | |
| You decide | Claude picks best for German legal vocabulary | |

**User's choice:** Multilingual (Recommended)

### Result ranking

| Option | Description | Selected |
|--------|-------------|----------|
| Qdrant text scoring | Scored results based on keyword relevance | ✓ |
| Filter only, no scoring | Text match as filter on vector search | |
| You decide | Claude picks based on Qdrant v1.13.2 capabilities | |

**User's choice:** Qdrant text scoring (Recommended)

### Case sensitivity

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive | Lowercase indexing, standard for legal text | ✓ |
| Case-sensitive | Exact case matching | |
| You decide | Claude picks sensible default | |

**User's choice:** Case-insensitive (Recommended)

---

## MCP tool exposure

### Tool design

| Option | Description | Selected |
|--------|-------------|----------|
| Extend paragraf_search | Add suchmodus parameter to existing tool | ✓ |
| New paragraf_volltext tool | Separate MCP tool for full-text search | |
| You decide | Claude picks based on MCP tool design patterns | |

**User's choice:** Extend paragraf_search (Recommended)

### Description guidance

| Option | Description | Selected |
|--------|-------------|----------|
| Guidance in description | Tool description explains when to use which mode | ✓ |
| Minimal description | Just list parameter options | |
| You decide | Claude decides on documentation level | |

**User's choice:** Guidance in description (Recommended)

---

## Index creation timing

| Option | Description | Selected |
|--------|-------------|----------|
| In ensure_collection() | Auto-create alongside existing KEYWORD indexes on startup | |
| Separate migration endpoint | New endpoint for manual trigger | ✓ |
| You decide | Claude picks based on existing patterns | |

**User's choice:** Separate migration endpoint
**Notes:** User chose against the recommended option — explicit control over index creation preferred

---

## Existing data migration

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-index existing data | Qdrant builds indexes from existing payload, no re-indexing | ✓ |
| Full re-index after index creation | Re-index all laws after creating indexes | |
| You decide | Claude picks based on Qdrant v1.13.2 behavior | |

**User's choice:** Auto-index existing data (Recommended)

---

## Full-text min token length

| Option | Description | Selected |
|--------|-------------|----------|
| min_token_len=2 | Skip single-character tokens | ✓ |
| min_token_len=1 | Index everything including single characters | |
| You decide | Claude picks sensible default | |

**User's choice:** min_token_len=2 (Recommended)

---

## Claude's Discretion

- Migration endpoint naming and REST design
- Error handling for index creation failures
- Whether to add an index status check endpoint
- Qdrant TextIndex max_token_len configuration

## Deferred Ideas

None — discussion stayed within phase scope.

# Phase 6: Cross-Reference Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 06-cross-reference-pipeline
**Areas discussed:** Citation pattern scope, Payload & storage design, Incoming reference lookup, Re-indexing approach

---

## Citation Pattern Scope

### Q1: How broad should the citation extractor be?

| Option | Description | Selected |
|--------|-------------|----------|
| Core patterns | § X GESETZ, § X Abs. Y GESETZ, Art. X GESETZ, i.V.m. chains. ~90% coverage. | ✓ |
| Comprehensive patterns | All core plus S., Nr., Buchst., Halbsatz, §§ ranges, relative references. Higher recall, more complex. | |
| Minimal (§ + GESETZ only) | Only § X GESETZ and Art. X GESETZ. Simplest but loses granularity. | |

**User's choice:** Core patterns (Recommended)
**Notes:** None

### Q2: Should the extractor validate citations against LAW_REGISTRY?

| Option | Description | Selected |
|--------|-------------|----------|
| Validate against registry | Only accept citations matching LAW_REGISTRY. Reduces false positives. | |
| Extract all, tag as verified/unverified | Store all, tag each as verified (in registry) or unverified. Captures refs to non-indexed laws. | ✓ |
| No validation | Store every citation as-is. Higher noise. | |

**User's choice:** Extract all, tag as verified/unverified
**Notes:** User diverged from recommended — wants to capture references to laws not yet in the system.

### Q3: How should i.V.m. chains be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate references | Split into individual references. Each independently navigable. | ✓ |
| Linked pair | Store as compound reference preserving relationship. Harder to query. | |
| You decide | Claude's discretion. | |

**User's choice:** Separate references (Recommended)
**Notes:** None

---

## Payload & Storage Design

### Q4: How should extracted references be stored in Qdrant payload?

| Option | Description | Selected |
|--------|-------------|----------|
| Structured objects | references_out: [{gesetz, paragraph, absatz, raw, verified}]. Enables filtering. | ✓ |
| Normalized ID strings | references_out: ['SGB_IX_§_6_Abs_2', ...]. Compact but less queryable. | |
| Raw citation strings | references_out: ['§ 6 Abs. 2 SGB IX', ...]. Simplest but needs parsing at query time. | |

**User's choice:** Structured objects (Recommended)
**Notes:** None

### Q5: Should the reference context keyword be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| Store context keyword | Add 'kontext' field: i.V.m., gemaess, nach, siehe, null. | ✓ |
| No context | Just store target reference. Simpler payload. | |
| You decide | Claude's discretion. | |

**User's choice:** Store context keyword (Recommended)
**Notes:** None

---

## Incoming Reference Lookup

### Q6: How should 'what cites this paragraph?' be resolved?

| Option | Description | Selected |
|--------|-------------|----------|
| Qdrant filter at query time | Filter on references_out payload. No pre-computation. Always fresh. | ✓ |
| Pre-computed reverse index | Compute references_in payload after indexing. Fast but stale risk. | |
| Separate lookup collection | Dedicated citations collection. Clean separation but extra management. | |

**User's choice:** Option 1 as standard, but configurable via ENV variable
**Notes:** User wants the default to be query-time filter but the strategy should be configurable/swappable for future flexibility.

### Q7: Should incoming references include a count?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include count | API returns incoming_count alongside citing paragraphs. One extra Qdrant call. | ✓ |
| No, just the list | Return only citing paragraphs. Count derivable client-side. | |
| You decide | Claude's discretion. | |

**User's choice:** Yes, include count (Recommended)
**Notes:** None

---

## Re-indexing Approach

### Q8: How should reference data be added to existing Qdrant points?

| Option | Description | Selected |
|--------|-------------|----------|
| set_payload update | Add references_out to existing points without re-embedding. Fast, no downtime. | ✓ (default) |
| Full re-index with references | Re-parse, re-embed, re-insert everything. Complete but slow. | ✓ (must be possible) |
| Hybrid: set_payload now + parser integration | Both paths. Two code paths to maintain. | |

**User's choice:** Option 1 as standard, Option 2 must also be possible
**Notes:** User explicitly wants both approaches available — set_payload as fast default, full re-index as thorough option.

### Q9: Should the extraction be standalone or integrated into index flow?

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone endpoint | POST /api/references/extract — independent of indexing. Also via MCP. | ✓ |
| Integrated into index flow | Auto-extract during /api/index. Couples extraction to indexing. | |
| Both: standalone + auto on index | Two triggers, same logic. | |

**User's choice:** Standalone endpoint (Recommended)
**Notes:** None

---

## Claude's Discretion

- Regex implementation details and test strategy
- Pydantic model naming for reference objects
- Error handling for partial extraction failures
- Single-law extraction variant endpoint
- Nested Qdrant filter structure for structured payload queries

## Deferred Ideas

None — discussion stayed within phase scope.

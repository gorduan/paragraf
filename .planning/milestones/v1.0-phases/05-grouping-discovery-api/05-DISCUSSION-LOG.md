# Phase 5: Grouping & Discovery API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 05-grouping-discovery-api
**Areas discussed:** Grouping API Design, Discovery API Design, Grouped Recommendations, MCP Tool Strategy

---

## Grouping API Design

### Group-By Field

| Option | Description | Selected |
|--------|-------------|----------|
| gesetz only | Group by law abbreviation. Maps directly to query_points_groups on gesetz field. | ✓ |
| gesetz + rechtsgebiet | Support grouping by either field via parameter. Rechtsgebiet groups may be very large. | |
| gesetz with rechtsgebiet header | Group by gesetz but add rechtsgebiet as section header. Visual hierarchy. | |

**User's choice:** gesetz only (Recommended)
**Notes:** Most natural grouping for legal search.

### Group Size

| Option | Description | Selected |
|--------|-------------|----------|
| 3 per group | Compact overview, top 3 hits per law. | |
| 5 per group | More detail per law but larger responses. | |
| Configurable via parameter | Default 3, caller can override with group_size (1-10). | ✓ |

**User's choice:** Configurable via parameter
**Notes:** None

### Endpoint Design

| Option | Description | Selected |
|--------|-------------|----------|
| New /api/search/grouped | Separate endpoint with own response shape (groups array). | ✓ |
| Mode on /api/search | Add grouped=true parameter. Response shape changes based on flag. | |

**User's choice:** New /api/search/grouped (Recommended)
**Notes:** Clean separation — grouped responses have fundamentally different structure.

### Max Groups

| Option | Description | Selected |
|--------|-------------|----------|
| Max 10 groups | Fixed limit, configurable via ENV. | |
| All matching groups | Return every law that has hits. | |
| Configurable per request | Default 10, caller can set max_groups (1-20). | ✓ |

**User's choice:** Configurable per request
**Notes:** None

---

## Discovery API Design

### Input Format

| Option | Description | Selected |
|--------|-------------|----------|
| Point-IDs only | Simple, consistent with internal ID model. | |
| Dual-input like Recommend | Accept both point IDs AND paragraph+gesetz pairs. Reuses Phase 4 resolution logic. | ✓ |

**User's choice:** Dual-input like Recommend
**Notes:** Consistency with Phase 4 paragraf_similar pattern.

### Example Limits

| Option | Description | Selected |
|--------|-------------|----------|
| 1-5 positive, 0-5 negative | Fixed limits matching Phase 4. | |
| 1-3 positive, 0-3 negative | More conservative limits. | |
| Configurable via ENV | Default 5/5, via DISCOVERY_MAX_POSITIVE / DISCOVERY_MAX_NEGATIVE. | ✓ |

**User's choice:** Configurable via ENV
**Notes:** Follows Phase 4 ENV-first pattern.

### Endpoint Design

| Option | Description | Selected |
|--------|-------------|----------|
| New /api/discover | Separate endpoint. Discovery has different semantics. | ✓ |
| Extend /api/recommend | Add negative_ids to existing recommend. | |

**User's choice:** New /api/discover (Recommended)
**Notes:** Mirrors Phase 4's decision to separate /api/recommend from /api/search.

### Relevance Explanation

| Option | Description | Selected |
|--------|-------------|----------|
| Score only | Return score + rank like all other results. | |
| Score + context label | Add label per result explaining relevance. | |
| You decide | Claude's discretion. | ✓ |

**User's choice:** You decide
**Notes:** Deferred to Claude's discretion.

---

## Grouped Recommendations

### Approach

| Option | Description | Selected |
|--------|-------------|----------|
| New /api/recommend/grouped | Separate endpoint combining Recommend + query_points_groups. | ✓ |
| Mode on /api/recommend | Add grouped=true parameter to existing endpoint. | |
| Reuse /api/search/grouped | Let grouped search accept recommend_ids parameter. | |

**User's choice:** New /api/recommend/grouped (Recommended)
**Notes:** None

### Config Sharing

| Option | Description | Selected |
|--------|-------------|----------|
| Shared config | Same GROUP_SIZE_DEFAULT and GROUP_MAX_GROUPS for both. | ✓ |
| Separate config | Independent settings for grouped recommend. | |

**User's choice:** Shared config (Recommended)
**Notes:** Simpler, consistent behavior.

---

## MCP Tool Strategy

### paragraf_discover Input

| Option | Description | Selected |
|--------|-------------|----------|
| Dual-input like paragraf_similar | Accept punkt_ids OR paragraph+gesetz for positive and negative. | ✓ |
| punkt_ids only | Simpler but less convenient. | |

**User's choice:** Dual-input like paragraf_similar (Recommended)
**Notes:** Consistency with existing MCP tool patterns.

### paragraf_grouped_search Design

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone tool | Own tool with own parameters. Claude sees distinct capability. | ✓ |
| Mode on paragraf_search | Add gruppiert parameter to existing tool. | |

**User's choice:** Standalone tool (Recommended)
**Notes:** None

### Grouped Recommend MCP Tool

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, paragraf_similar_grouped | Separate tool for grouped recommendations. | ✓ |
| No, grouped mode on paragraf_similar | Add gruppiert parameter to existing tool. | |
| You decide | Claude's discretion. | |

**User's choice:** Yes, paragraf_similar_grouped (Recommended)
**Notes:** Mirrors REST API split. Three new MCP tools total.

---

## Claude's Discretion

- Whether Discovery results include context labels explaining relevance
- Error handling for invalid/missing point IDs in Discovery
- Qdrant DiscoverQuery parameters (score_threshold, strategy)
- Internal grouped response structure ordering
- Pydantic model naming for grouped responses

## Deferred Ideas

None — discussion stayed within phase scope.

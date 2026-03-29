# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 -- Volles Qdrant-Potenzial

**Shipped:** 2026-03-29
**Phases:** 13 | **Plans:** 33 | **Tasks:** 67

### What Was Built
- Complete Qdrant feature utilization: Recommend, Discovery, Grouping, Scroll, Snapshots, Quantization, Full-Text
- Cross-reference pipeline: regex citation extraction from German legal text, citation network API, interactive d3-force graph
- Professional React frontend: design system with 8 primitives, 7 page types, filters, grouped views, export, accessibility
- 7 new MCP tools exposing all backend capabilities to Claude Desktop/Code
- Multi-hop search combining semantic search with citation traversal for complex legal questions
- Query expansion with curated legal synonym dictionary and sentence-level semantic chunking

### What Worked
- **Backend-first sequencing**: Building all backend services (Phases 1-7) before UI work (Phases 8-10) eliminated blocked frontend work entirely
- **Design system early**: Phase 3 tokens and primitives paid off across Phases 8-10 with consistent UI
- **Parallel plan execution**: Independent plans within phases ran concurrently, keeping 3-5 min per plan
- **Gap closure phases**: Audit-driven Phases 11-13 caught all integration gaps systematically
- **GSD workflow**: Research -> plan -> execute -> verify cycle caught issues early (Phase 9 needed 2 gap closure plans)

### What Was Inefficient
- **Tracking artifact drift**: ROADMAP.md and REQUIREMENTS.md checkboxes went stale, requiring Phase 13 just for cleanup
- **SUMMARY frontmatter gaps**: Several plans had empty requirements_completed fields, caught only at audit
- **Phase 9 gap closure**: 2 additional plans (09-04, 09-05) needed post-verification -- graph and discovery UX had subtle issues not caught by initial planning
- **Nyquist compliance**: Only 1/10 phases fully Nyquist-compliant -- validation was added but test coverage gaps remain

### Patterns Established
- `query_points` / `query_points_groups` exclusively -- no legacy Qdrant search endpoints
- cva + cn() as standard React component pattern with TailwindCSS 4 tokens
- Dual-input MCP tool pattern (punkt_id OR paragraph+gesetz) for flexible usage
- NestedCondition queries for array-of-object payload fields in Qdrant
- Placeholder-based abbreviation protection for sentence splitting in legal text
- Discovery mode as separate boolean rather than extending SearchMode union type

### Key Lessons
1. **Audit before completion**: The milestone audit caught 14 tech debt items and 7 integration gaps that would have been missed without systematic cross-phase verification
2. **Frontend wiring gaps are predictable**: Backend-only endpoints without frontend consumers are a recurring pattern -- plan a wiring phase from the start
3. **Tracking artifacts need automation**: Manual checkbox updates in REQUIREMENTS.md and ROADMAP.md drift silently -- consider automated status sync
4. **Gap closure phases are normal**: 3 gap closure phases (11-13) out of 13 total is reasonable -- budget for ~20% gap closure work
5. **Research prevents rework**: Phases with thorough research (6, 7) had zero gap closure needs; phases with lighter research (9) needed 2 extra plans

### Cost Observations
- Model mix: ~90% opus, ~10% sonnet (research agents)
- Sessions: ~8-10 sessions over 3 days
- Notable: 33 plans averaging ~4 min each = ~2.2 hours total execution time; research + planning roughly equal time

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~10 | 13 | Established GSD workflow with audit-driven gap closure |

### Cumulative Quality

| Milestone | Tests | Coverage | Requirements |
|-----------|-------|----------|-------------|
| v1.0 | 24 (vitest) + unit tests | 1/10 Nyquist | 40/40 satisfied |

### Top Lessons (Verified Across Milestones)

1. Backend-first sequencing eliminates frontend blocking
2. Systematic audits catch integration gaps that plan-level verification misses
3. Budget ~20% of phases for gap closure work

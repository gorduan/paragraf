# Pitfalls Research

**Domain:** German Legal-Tech RAG -- Advanced Qdrant Features, Citation Extraction, Query Expansion, Frontend Redesign
**Researched:** 2026-03-27
**Confidence:** MEDIUM-HIGH (Qdrant behavior verified against docs/issues; citation parsing based on domain-specific parser projects; frontend pitfalls from established patterns)

## Critical Pitfalls

### Pitfall 1: Recommend/Discovery API Requires Point IDs, Not Query Text

**What goes wrong:**
The current search flow takes user text, encodes it to a vector, and queries Qdrant. The Recommend API works differently -- it takes existing point IDs as positive/negative examples, not raw vectors. Developers try to call `recommend` with a text query and get confused when the API signature does not accept it. They then encode the text and pass the vector directly, but the `recommend` endpoint expects `positive: [point_id]`, not `query: [vector]`. The Discovery API has the same constraint -- it operates on point IDs for context pairs.

**Why it happens:**
Mental model mismatch. Search is "text in, results out." Recommendation is "examples in, similar out." The Qdrant `recommend` API can accept raw vectors via `positive_vectors` parameter (since Qdrant 1.6+), but this is a separate parameter from the point-ID-based `positive` parameter. Mixing them up or not knowing about `positive_vectors` leads to wasted time.

**How to avoid:**
- For "Similar Paragraphs" button: use the point ID directly from the search result (already stored as UUID5 of chunk_id). Pass it to `recommend` via the `positive` parameter.
- For Discovery with user text: encode the text first, use `positive_vectors` parameter with the raw vector.
- Design the API contract early: `/api/similar/{point_id}` (Recommend) vs. `/api/discover` (Discovery with mixed inputs).

**Warning signs:**
- API calls returning "expected list of point IDs" errors
- Confusion about whether to pass chunk_id strings or UUID point IDs
- Endpoint design that tries to combine text search and recommendation in one call

**Phase to address:**
Phase implementing Recommend/Discovery API -- design the endpoint contracts before writing code.

---

### Pitfall 2: Grouping API Cannot Do Hybrid Dense+Sparse Fusion Directly via search_groups

**What goes wrong:**
The existing hybrid search uses `query_points` with prefetch (dense + sparse) and RRF fusion. Developers assume `search_groups` works the same way but with grouping added. It does not. The older `search_groups` endpoint does not support the prefetch/fusion pattern. You must use `query_points_groups` instead, which does support it -- but this is a different endpoint with a different API signature.

**Why it happens:**
Qdrant has both legacy (`search_groups`) and modern (`query_points_groups`) grouping endpoints. Documentation does not prominently warn about this distinction. GitHub issue #5397 confirms this caused confusion for real users.

**How to avoid:**
- Use `query_points_groups` exclusively (not `search_groups`). It supports the same prefetch/fusion pattern as `query_points`.
- Model the grouping query after the existing `hybrid_search` method in `qdrant_store.py` -- same prefetch structure, just add `group_by` and `group_size` parameters.
- Verify against Qdrant v1.13.2 API reference that `query_points_groups` exists in this version.

**Warning signs:**
- Import of `search_groups` method instead of `query_points_groups`
- Error messages about unsupported query types in grouping
- Results returning ungrouped when grouping was expected

**Phase to address:**
Phase implementing Grouping API -- verify the correct endpoint before implementation begins.

---

### Pitfall 3: German Legal Citation Parsing is Deceptively Complex

**What goes wrong:**
A "simple" regex for extracting cross-references from German law text catches 60% of citations but silently misses the rest. German legal citations have dozens of variant forms:
- `SS 35a Abs. 1 Satz 2 SGB VIII` (standard)
- `SS 35a I 2 SGB VIII` (Roman numeral Absatz)
- `SSSS 3, 4 Nr. 3a) UWG` (multi-section)
- `SS 291 S. 1 i.V.m SS 288 Abs. 1 S. 2 BGB` (combined references)
- `Art. 3 GG` (Grundgesetz uses Artikel, not Paragraph)
- `SS 35a des Achten Buches Sozialgesetzbuch` (full name instead of abbreviation)
- `Absatz 1 Nummer 2` (spelled out, no abbreviation)
- Nested references: `SS 2 Abs. 1 in Verbindung mit SS 3 Abs. 2 Satz 1 Nr. 4 lit. a SGB XII`

The dots in `Abs.`, `Nr.`, `S.`, `i.V.m.` conflict with sentence-ending periods, breaking both regex and sentence tokenization.

**Why it happens:**
German legal drafting has no enforced citation format standard. Each law, court, and commentary uses slightly different conventions. The `lavis-nlp/german-legal-reference-parser` project exists specifically because this problem is hard enough to warrant a dedicated tool.

**How to avoid:**
- Do NOT write citation regex from scratch. Start with the `german-legal-reference-parser` library or adapt its patterns.
- Define a reduced scope for v1: only extract `SS [number] [Abs. X] [Satz Y] [Nr. Z] [LAW_ABBREVIATION]` patterns where the law abbreviation matches keys in `LAW_REGISTRY`. This catches the most common form without trying to handle every edge case.
- Normalize all extracted citations to a canonical form (e.g., `SS 35a Abs. 1 S. 2 SGB VIII`) so that `SS 35a I 2 SGB VIII` matches the same canonical ID.
- Store cross-references as structured payload in Qdrant (list of `{target_gesetz, target_paragraph, target_absatz}` objects), not as raw strings.
- Accept that completeness is impossible in v1 -- log unmatched patterns for iterative improvement.

**Warning signs:**
- Citation extraction tests only cover the simple `SS X Abs. Y GESETZ` pattern
- No normalization step -- raw strings stored as cross-references
- Combined references (i.V.m.) treated as a single citation instead of two linked citations
- Recall below 80% on a sample of manually annotated paragraphs

**Phase to address:**
Phase implementing cross-reference extraction -- allocate time for pattern discovery and normalization, not just regex writing.

---

### Pitfall 4: Query Expansion Causes Query Drift in Legal German

**What goes wrong:**
Query expansion adds synonyms or related terms to improve recall. In legal German, this is dangerous because legal terms have precise meanings that differ from everyday German. "Behinderung" (disability) in SGB IX is a defined legal term; expanding to "Handicap" or "Einschraenkung" retrieves irrelevant results. "Unterhalt" (maintenance/alimony) expands to "Lebensunterhalt" (livelihood) which is a different legal concept. The expanded query floods results with loosely related but legally wrong paragraphs, destroying precision.

**Why it happens:**
General-purpose synonym databases (WordNet, word2vec on Wikipedia) do not understand legal terminology boundaries. Even domain-specific embeddings can conflate related but legally distinct concepts. Research from TU Munich on German legal query expansion confirms that naive expansion degrades retrieval quality.

**How to avoid:**
- Use a curated legal synonym mapping, not automatic expansion. Start with a small handcrafted dictionary of abbreviation expansions (`GdB` -> `Grad der Behinderung`, `SchwbG` -> `Schwerbehindertengesetz` -> now `SGB IX Teil 3`) and common equivalences.
- Implement expansion as a re-ranking boost, not a query replacement. Run the original query first, then run expanded queries and merge results with lower weight.
- Test expansion quality with before/after precision measurements on known-good queries.
- Consider LLM-based query reformulation (via MCP prompt) instead of dictionary expansion -- the LLM understands legal context better than a synonym list.

**Warning signs:**
- Search results include paragraphs from unrelated legal domains after expansion
- Precision drops while recall increases (net quality decrease for legal users)
- No A/B comparison between expanded and non-expanded queries

**Phase to address:**
Phase implementing query expansion -- start with conservative abbreviation-only expansion, measure before broadening.

---

### Pitfall 5: Scalar Quantization Breaks Sparse Vector Search Quality

**What goes wrong:**
Developers enable scalar quantization on the collection expecting uniform memory savings. But scalar quantization (int8) applied to sparse vectors can significantly degrade lexical matching quality because sparse vectors have very different value distributions than dense vectors -- most values are zero (not stored), and the non-zero values encode precise token weights. Quantizing these weights loses the fine-grained distinctions that make sparse search useful.

**Why it happens:**
Qdrant's quantization configuration applies to dense vectors by default. However, developers may not realize that quantization parameters need separate consideration for dense vs. sparse vectors. Additionally, Qdrant v1.13.2's quantization primarily targets dense vectors -- sparse vectors use inverted indices and are already memory-efficient by nature.

**How to avoid:**
- Apply scalar quantization ONLY to dense vectors. Sparse vectors already use inverted index storage and do not benefit from quantization.
- In Qdrant, quantization is configured per collection on the dense vectors config. Verify that the `quantization_config` is set on the `vectors_config` for the `"dense"` named vector, not globally.
- Create a snapshot before enabling quantization. Test search quality (precision@10, recall@10) on a benchmark set before and after.
- Use `rescore: true` (default) so original vectors are used for final scoring after quantized approximate search.

**Warning signs:**
- Hybrid search quality drops after enabling quantization
- Sparse-only queries return different (worse) results
- Memory savings are smaller than expected (sparse vectors were already efficient)

**Phase to address:**
Phase implementing Scalar Quantization -- snapshot first, quantize dense only, benchmark before/after.

---

### Pitfall 6: Frontend Redesign Breaks Existing Functionality Without Anyone Noticing

**What goes wrong:**
The frontend has zero tests (documented in CONCERNS.md). A visual redesign touches every component. Without tests, regressions in SSE indexing flow, health check polling, API error handling, and law browser navigation go unnoticed until a user hits them. The IndexPage alone is 965 lines -- changing its styling inevitably touches its logic.

**Why it happens:**
Design-focused work naturally prioritizes visual output. "It looks right" substitutes for "it works right." The existing frontend was built incrementally without a component library or design system, so the redesign requires touching almost every file.

**How to avoid:**
- Add integration tests for critical flows BEFORE redesigning: health check polling, search request/response, SSE indexing stream, law browser navigation.
- Use the Strangler Fig pattern: redesign one page/component at a time, keeping the old version functional until the new one is verified.
- Extract the 965-line IndexPage into smaller components BEFORE restyling. Separation of logic from presentation makes the redesign safer.
- Keep API client (`lib/api.ts`) and hooks (`useApi.ts`, `useHealthCheck.ts`) unchanged during visual redesign.

**Warning signs:**
- PR that changes 15+ component files simultaneously
- No manual testing checklist for SSE indexing flow
- HealthOverlay stops working after redesign (polling logic intertwined with rendering)
- "It works in dev but not in Docker" (nginx routing breaks)

**Phase to address:**
Phase implementing frontend redesign -- add smoke tests and decompose large components FIRST, then restyle.

---

### Pitfall 7: Snapshot API Not Used Before Destructive Collection Changes

**What goes wrong:**
Adding quantization, changing payload indices, or re-indexing with new cross-reference payloads modifies the collection in ways that may be irreversible or hard to undo. Without a snapshot, a failed migration means re-indexing all 95+ laws from scratch (hours on CPU, minutes on GPU).

**Why it happens:**
The project currently has no backup mechanism (documented in CONCERNS.md as "Missing Critical Feature"). Developers forget to snapshot because the collection "just works" and changes seem safe.

**How to avoid:**
- Implement the Snapshot API as the FIRST Qdrant feature, before any other collection modifications.
- Create an automatic pre-migration snapshot in code: any operation that modifies collection config (quantization, new indices, bulk upsert) should snapshot first.
- Store snapshots with timestamps and descriptions: `paragraf_pre_quantization_20260327`.
- Test snapshot restore works before relying on it.

**Warning signs:**
- Quantization or re-indexing planned without snapshot step in the implementation plan
- No documented recovery procedure for failed collection changes
- Docker volume is the only "backup" (fragile -- `docker compose down -v` destroys it)

**Phase to address:**
Must be the FIRST phase of any Qdrant feature work. Non-negotiable prerequisite.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store cross-references as raw strings instead of structured objects | Faster to implement | Cannot query/filter by target law, no graph traversal, normalization nightmare later | Never -- structure from day one |
| Skip citation normalization in v1 | Ship faster | Duplicate edges in citation graph, `SS 35a I 2 SGB VIII` and `SS 35a Abs. 1 S. 2 SGB VIII` treated as different targets | Never -- normalization is the hard part, skipping it means redoing extraction |
| Apply quantization without benchmarking | Saves testing time | Silent search quality degradation discovered weeks later by users | Never -- a 50-query benchmark takes 10 minutes |
| Redesign all pages simultaneously | Feels faster, "consistent" | Impossible to isolate regressions, merge conflicts, context switching | Never -- one page at a time |
| Add Recommend API without exposing point IDs in frontend | Backend works, frontend "later" | Frontend team cannot integrate without ID propagation, requires second pass through all result components | Only in a backend-only phase, with clear contract for frontend |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Qdrant `query_points_groups` | Using `search_groups` (legacy) which lacks hybrid support | Use `query_points_groups` with same prefetch/fusion pattern as `query_points` |
| Qdrant `recommend` | Passing raw vectors to `positive` parameter (expects point IDs) | Use `positive` for point IDs, `positive_vectors` for raw vectors |
| Qdrant Scalar Quantization | Enabling without `rescore: true` | Always keep `rescore: true` (default) to maintain accuracy |
| Qdrant Snapshot API | Creating snapshot while write operations are in progress | Ensure no concurrent upserts during snapshot creation |
| `german-legal-reference-parser` | Assuming it handles all citation formats out of the box | It requires a `laws.txt` file with known law abbreviations -- must be populated from `LAW_REGISTRY` |
| Full-Text Index on `text` field | Creating keyword index on long text (very large inverted index) | Use `text` type index with tokenizer config, not `keyword` type |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recommend API called with reranking on every result card hover | Backend CPU spikes, UI feels laggy | Debounce calls, lazy-load recommendations only on click | >5 concurrent users |
| Cross-reference extraction at query time instead of index time | Search latency jumps from 200ms to 2s+ | Extract and store cross-refs during indexing, serve from payload at query time | First query |
| Grouping API with `group_size` too large | Response time grows linearly with group_size * num_groups | Default `group_size: 3`, let user paginate within groups | >50 groups requested |
| Query expansion running multiple Qdrant queries per user search | 2-4x latency increase per search | Use Qdrant's built-in prefetch for expansion variants, fuse in one call | >10 concurrent users |
| Citation graph loaded entirely into frontend memory | Browser tab crashes on complex laws with 1000+ cross-references | Paginate graph data, load only 2-hop neighborhood from clicked node | SGB laws (extensive cross-referencing) |
| N+1 pattern in index status (already exists, documented in CONCERNS.md) worsened by adding cross-ref counts | 70+ Qdrant calls become 140+ | Cache status with TTL, batch queries | Already breaking |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Qdrant Snapshot API to frontend without rate limiting | Attacker triggers continuous snapshots, fills disk | Snapshot endpoint should be backend-internal only, not exposed via REST API |
| Point IDs in Recommend API reveal internal UUID scheme | Information disclosure (minor for this app) | Acceptable risk for internal tool; document if ever exposed publicly |
| Query expansion accepting arbitrary expansion terms from user input | Injection of irrelevant terms to poison search results | Expansion should be server-side only, user cannot control expansion terms |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Similar Paragraphs" returns near-duplicates from same law | User sees 5 copies of the same paragraph with minor Absatz differences | Filter recommendations to exclude same `gesetz+paragraph` combination, or group by paragraph |
| Grouped results hide the best match | User misses the most relevant result because it is collapsed inside a group | Show the top-1 result ungrouped above groups, then show grouped results below |
| Citation graph is visually impressive but not actionable | User sees a graph but cannot navigate to referenced paragraphs | Each graph node must be clickable and load the referenced paragraph inline |
| Query expansion silently active with no user feedback | User does not understand why unexpected results appear | Show "Also searching for: [expanded terms]" badge on results page |
| Redesigned UI loses the "it just works" simplicity | Legal professionals want function over form | Preserve existing interaction patterns (search bar, result list, sidebar filters); do not reinvent navigation |

## "Looks Done But Isn't" Checklist

- [ ] **Recommend API:** Often missing negative example handling -- verify that "not like this" works, not just "similar to this"
- [ ] **Grouping API:** Often missing group count in response -- verify the UI shows "12 results in 4 laws" not just the groups
- [ ] **Citation extraction:** Often missing bidirectional linking -- if SS 35a SGB VIII references SS 99 SGB IX, verify SS 99 SGB IX also shows SS 35a SGB VIII as a back-reference
- [ ] **Query expansion:** Often missing the "off switch" -- verify users can disable expansion when they want exact-match behavior
- [ ] **Scalar quantization:** Often missing quality benchmarks -- verify precision@10 before and after on at least 20 test queries
- [ ] **Snapshot API:** Often missing restore testing -- verify a snapshot can actually be restored, not just created
- [ ] **Frontend redesign:** Often missing Docker build test -- verify `docker compose up --build` still works after all frontend changes (nginx routing, env injection)
- [ ] **Full-Text Index:** Often missing tokenizer configuration for German -- verify compound words like "Schwerbehindertenvertretung" are tokenized correctly
- [ ] **Scroll API pagination:** Often missing stable ordering -- verify paginated results do not skip or duplicate items when data changes between pages

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Quantization degrades search quality | LOW | Disable quantization on collection (`update_collection` with `quantization_config: None`), original vectors preserved |
| Citation regex misses patterns | LOW | Iterative -- add patterns, re-extract, update payloads. Does not require re-embedding |
| Frontend redesign breaks SSE indexing | MEDIUM | Revert to pre-redesign commit. Highlights need for component tests |
| Query expansion degrades precision | LOW | Disable expansion (feature flag). No data changes needed |
| Grouped search returns wrong results via legacy API | LOW | Switch from `search_groups` to `query_points_groups`. Code change only |
| Collection corrupted during migration | HIGH without snapshot, LOW with | Restore from snapshot. Without snapshot: full re-index (hours on CPU) |
| Cross-references stored as raw strings, need restructuring | HIGH | Must re-extract all citations and re-upsert payloads. Cannot convert in place |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| No snapshots before destructive changes | Phase 1 (Infrastructure/Snapshots) | Snapshot create + restore roundtrip tested |
| Grouping uses wrong API endpoint | Phase implementing Grouping | Integration test with hybrid dense+sparse grouped query |
| Recommend API ID vs vector confusion | Phase implementing Recommend | Endpoint accepts point_id, returns results excluding source paragraph |
| Citation parsing incomplete | Phase implementing Cross-References | Recall measured on 50+ manually annotated paragraphs from SGB laws |
| Query drift from expansion | Phase implementing Query Expansion | A/B precision comparison on 20+ benchmark queries |
| Quantization degrades quality | Phase implementing Quantization | Pre/post precision@10 benchmark, snapshot exists before enabling |
| Frontend redesign breaks functionality | Phase implementing Frontend Redesign | Smoke tests for health check, search, indexing SSE, law browser pass before and after |
| Cross-refs stored as strings | Phase implementing Cross-References | Payload schema review confirms structured objects, not strings |
| Recommend returns near-duplicates | Phase implementing Recommend | Results filtered to exclude same gesetz+paragraph source |

## Sources

- [Qdrant Recommendation API article](https://qdrant.tech/articles/new-recommendation-api/) -- Recommend API positive/negative examples, scoring strategies
- [Qdrant GitHub Issue #5397](https://github.com/qdrant/qdrant/issues/5397) -- search_groups does not support hybrid dense+sparse, resolved via query_points_groups
- [Qdrant GitHub Issue #6125](https://github.com/qdrant/qdrant/issues/6125) -- Quantization not applied correctly in some cases
- [Qdrant Hybrid Search docs](https://qdrant.tech/documentation/search/hybrid-queries/) -- prefetch/fusion pattern for hybrid queries
- [Qdrant Quantization course](https://qdrant.tech/course/essentials/day-4/what-is-quantization/) -- Scalar quantization best practices, rescore parameter
- [german-legal-reference-parser](https://github.com/lavis-nlp/german-legal-reference-parser) -- Citation parsing formats, normalization, laws.txt requirement
- [TU Munich: German Legal IR Query Expansion](https://wwwmatthes.in.tum.de/pages/p6wat10sn8sc/German-Legal-Information-Retrieval-Query-Expansion-with-Word-Embeddings) -- Query expansion with word embeddings for German legal domain
- [flair/ner-german-legal](https://huggingface.co/flair/ner-german-legal) -- NER model for German legal entities
- Existing codebase: `backend/src/paragraf/services/qdrant_store.py` -- named vectors "dense"/"sparse", hybrid search implementation
- `.planning/codebase/CONCERNS.md` -- zero frontend tests, monolithic api.py, missing backup mechanism

---
*Pitfalls research for: Paragraf v2 -- Advanced Qdrant Features, Citation Extraction, Query Expansion, Frontend Redesign*
*Researched: 2026-03-27*

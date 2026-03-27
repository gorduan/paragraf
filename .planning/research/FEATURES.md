# Feature Research

**Domain:** German legal-tech RAG search application (advanced features milestone)
**Researched:** 2026-03-27
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any serious legal search tool must have. The app already covers basic search and lookup; these are table stakes for the *next level* of a professional legal research tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Paginated search results** | Every search tool paginates. Showing only top-K without "load more" feels broken for legal research where completeness matters. | LOW | Qdrant Scroll API. Already in PROJECT.md backlog. Straightforward implementation with offset/limit. |
| **Grouped results by law/legal area** | Beck-online and Juris group results by source. Users expect to see "3 results in SGB IX, 2 in SGB XII" rather than a flat list. | MEDIUM | Qdrant Search Groups API groups by payload field. Group by `gesetz` or `rechtsgebiet`. Requires frontend accordion/tab UI. |
| **Advanced filtering (law, section, legal area)** | Juris and Beck-online offer faceted filtering. Legal researchers always want to narrow by specific law, section (Abschnitt), or legal domain. | MEDIUM | Backend: Qdrant payload filters already support this. Frontend: Filter sidebar/panel with checkboxes. Partially wired (`abschnitt` filter exists but not exposed). |
| **Cross-reference links (Normenkette)** | Every professional German legal database shows which other paragraphs a norm references. "Normenkette" is a standard feature in Beck-online and Juris. Without it, users must manually identify referenced laws. | HIGH | Requires: (1) regex-based citation extraction from law text, (2) storing references as payload in Qdrant, (3) clickable links in UI. The `german-legal-reference-parser` library handles German citation patterns. |
| **Export results (PDF/Markdown/clipboard)** | Legal professionals copy results into briefs, memos, and case files. No export = dead end for professional use. | MEDIUM | PDF via browser print or a library like jsPDF. Markdown is trivial (data already structured). Clipboard copy per result card is the minimum. |
| **Full-text keyword search** | Lawyers need exact word matches alongside semantic search. "Find all paragraphs containing 'Eingliederungshilfe' literally." Semantic search alone misses exact terminology needs. | LOW | Qdrant full-text index on `text` field. Combine with existing hybrid search or offer as separate toggle. |
| **Bookmark/save results** | Already exists (BookmarkContext in localStorage). Table stakes confirmed -- keep and polish. | LOW | Already implemented. May need export of bookmarks. |

### Differentiators (Competitive Advantage)

Features that go beyond what free tools (gesetze-im-internet.de, dejure.org) offer and approach or exceed paid databases -- especially leveraging the RAG/vector stack.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **"Similar paragraphs" recommendation** | No free German legal tool offers "show me paragraphs similar to this one." Beck-online links related commentary but not semantically similar norms across laws. This is the killer feature of a vector DB legal tool. | MEDIUM | Qdrant Recommend API with point IDs. Pass a paragraph's vector as positive example, get similar paragraphs. UI: "Aehnliche Paragraphen" button on each result card. Strategy: `best_score` for better results. |
| **Citation network visualization** | Juris shows "Normenkette" as a flat list. An interactive graph showing how laws reference each other is genuinely novel for German legal research. The TENJI study showed law students doubled retrieval performance with graph interfaces. | HIGH | Depends on: cross-reference extraction (table stakes). Visualization with a lightweight graph library (e.g., D3-force, vis-network, or react-force-graph). Start simple: directed graph of paragraph -> referenced paragraphs. |
| **Discovery search (positive/negative examples)** | "Find paragraphs like SGB IX section 99 but NOT like section 100." No existing German legal tool offers this kind of exploratory search. Powerful for comparative legal research. | MEDIUM | Qdrant Discovery API. UI: drag-and-drop or checkbox-based "like this / not like this" interface. More advanced UX challenge than backend complexity. |
| **Grouped recommendations** | "Show me similar paragraphs, but grouped by which law they come from." Combines Recommend + Groups API. Gives a structured overview of related norms across the entire legal corpus. | MEDIUM | Qdrant Recommend Point Groups API (combined endpoint). Groups recommendations by `gesetz` payload field. |
| **Semantic chunking for long paragraphs** | Current chunking splits at 800 chars. Smarter segmentation (by legal clause structure: Absatz, Satz, Nummer) produces better search relevance and more precise results. | MEDIUM | Improve parser to respect legal structure boundaries. No new ML model needed -- rule-based on German legal text patterns (Abs., S., Nr., Buchst.). |
| **Query expansion with legal synonyms** | Legal German uses specific terminology ("Eingliederungshilfe" vs "Teilhabeleistung"). Expanding queries with domain synonyms improves recall without users needing to know all terms. | MEDIUM | Build a legal synonym dictionary (manual + extracted from law text). Expand queries before embedding. Could also use bge-m3 multi-query approach. |
| **Multi-hop MCP prompts** | Combined MCP workflows: "Find relevant paragraphs, then find their cross-references, then summarize the legal situation." This makes Claude an actual legal research assistant, not just a search proxy. | MEDIUM | Chain existing MCP tools in prompt templates. No new infra needed -- just well-designed prompt templates that call multiple tools. |
| **Snapshot backup before re-indexing** | Professional users need confidence that re-indexing won't destroy their working database. Qdrant Snapshots API provides this. | LOW | Qdrant Snapshot API. Create snapshot before any index operation. Expose as button in Index Dashboard. |

### Anti-Features (Deliberately NOT Building)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Built-in LLM chat interface** | "Add ChatGPT-like chat for legal questions" | Massively increases scope, liability (RDG), hallucination risk, and compute cost. Claude via MCP already does this better. | Keep MCP integration as the AI layer. The web app is a search/browse tool, not a chatbot. |
| **User accounts and authentication** | "Let users save preferences, share results" | Single-user local/internal tool. Auth adds complexity with zero value for the target deployment. | localStorage for preferences/bookmarks. Share via export (PDF/Markdown). |
| **Real-time law update notifications** | "Alert when a law changes" | gesetze-im-internet.de doesn't provide change feeds. Would require polling + diffing entire law corpus. Enormous effort, fragile. | Manual re-index with snapshot backup. Show "last indexed" date prominently. |
| **Full knowledge graph database (Neo4j)** | "Store all cross-references in a proper graph DB" | Adds another Docker service, another query language, another failure point. Overkill for citation links between ~95 laws. | Store cross-references as Qdrant payload arrays. Query with payload filters. Good enough for the scale. |
| **ColBERT multi-vector search** | "bge-m3 supports ColBERT, use it" | ColBERT requires token-level vector storage, multiplying storage 100x+. Qdrant support for multi-vector is experimental. Dense + Sparse hybrid already performs well. | Defer to future milestone. Current hybrid search with reranking is proven. |
| **Mobile native app** | "Build iOS/Android app" | Tiny user base doesn't justify native development. Web app works on mobile browsers. | Responsive design improvements. PWA manifest for "Add to Home Screen." |
| **Automated legal analysis/opinion** | "Generate legal opinions from search results" | RDG liability. This crosses from information retrieval into legal advice. | MCP prompts explicitly disclaim: "keine Rechtsberatung." Search returns raw law text, not interpretation. |

## Feature Dependencies

```
Cross-Reference Extraction (Payload)
    |
    |----> Citation Network Visualization (requires refs in payload)
    |----> Clickable Cross-Reference Links in UI (requires refs in payload)
    |----> Multi-Hop MCP Prompts (requires following references)

Qdrant Recommend API (Backend)
    |----> "Similar Paragraphs" Button (Frontend)
    |----> Grouped Recommendations (Recommend + Groups API)
    |----> Discovery Search (extends Recommend with neg examples)

Qdrant Search Groups API (Backend)
    |----> Grouped Search Results UI (Frontend)

Qdrant Scroll API (Backend)
    |----> Paginated Results (Frontend)
    |----> Law Browser Pagination (Frontend)

Full-Text Index (Qdrant Config)
    |----> Exact Keyword Search Toggle (Frontend)

Qdrant Snapshot API (Backend)
    |----> Backup Button in Index Dashboard (Frontend)

Advanced Filtering (Backend already supports)
    |----> Filter Sidebar UI (Frontend)
    |----> Facet Counts in Response (Backend enhancement)

Export Functionality
    (no backend dependency -- frontend-only for Markdown/clipboard)
    |----> PDF Export (requires formatting logic)
```

### Dependency Notes

- **Cross-Reference Extraction is the critical path feature.** It unlocks citation visualization, clickable links, and multi-hop prompts. Must be built first among the differentiators.
- **Recommend API is independent of cross-references.** Can be built in parallel. Only needs existing paragraph vectors.
- **Grouped search and pagination are independent of each other.** Can be built in any order.
- **Export is fully independent.** Can be added at any time as a frontend-only feature.
- **Snapshot backup should precede any re-indexing work** (like adding cross-reference payloads). Safety first.

## MVP Definition

### Launch With (Phase 1: Foundation)

- [ ] **Qdrant Snapshot API** -- safety net before any re-indexing
- [ ] **Paginated search results** -- Scroll API, essential UX
- [ ] **Advanced filter UI** -- expose existing backend filter capabilities
- [ ] **Full-text keyword search** -- add text index, toggle in UI
- [ ] **Export (Markdown/Clipboard)** -- immediate professional value, low cost

### Add After Foundation (Phase 2: Recommendations)

- [ ] **Recommend API backend** -- "similar paragraphs" endpoint
- [ ] **"Similar Paragraphs" button** -- frontend integration on result cards
- [ ] **Grouped search results** -- Search Groups API + accordion UI
- [ ] **Discovery search** -- positive/negative example interface
- [ ] **Scalar quantization** -- optimize memory as collection grows

### Add After Recommendations (Phase 3: Cross-References)

- [ ] **Cross-reference extraction** -- regex parsing + re-index with citation payload
- [ ] **Clickable cross-reference links** -- in paragraph view
- [ ] **Citation network visualization** -- interactive graph
- [ ] **Multi-hop MCP prompts** -- chain search + follow references
- [ ] **Query expansion** -- legal synonym dictionary

### Future Consideration (Phase 4+)

- [ ] **Grouped recommendations** -- combine Recommend + Groups
- [ ] **Semantic chunking** -- improve paragraph segmentation
- [ ] **PDF export** -- formatted professional output
- [ ] **Responsive design audit** -- mobile optimization
- [ ] **Accessibility audit** -- WCAG compliance

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Paginated results | HIGH | LOW | P1 |
| Advanced filter UI | HIGH | LOW | P1 |
| Full-text keyword search | HIGH | LOW | P1 |
| Export (Markdown/Clipboard) | HIGH | LOW | P1 |
| Snapshot backup | MEDIUM | LOW | P1 |
| Similar paragraphs (Recommend) | HIGH | MEDIUM | P1 |
| Grouped search results | HIGH | MEDIUM | P1 |
| Cross-reference extraction | HIGH | HIGH | P2 |
| Discovery search | MEDIUM | MEDIUM | P2 |
| Citation network visualization | HIGH | HIGH | P2 |
| Clickable cross-ref links | HIGH | MEDIUM | P2 |
| Multi-hop MCP prompts | MEDIUM | MEDIUM | P2 |
| Query expansion | MEDIUM | MEDIUM | P2 |
| Scalar quantization | LOW | LOW | P2 |
| Grouped recommendations | MEDIUM | LOW | P3 |
| Semantic chunking | MEDIUM | MEDIUM | P3 |
| PDF export | MEDIUM | MEDIUM | P3 |
| Responsive/accessibility | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have -- unlocks core value or is low-hanging fruit
- P2: Should have -- differentiators that require cross-reference infrastructure
- P3: Nice to have -- polish and optimization

## Competitor Feature Analysis

| Feature | Beck-online | Juris | dejure.org (free) | gesetze-im-internet.de (free) | Our Approach |
|---------|-------------|-------|-------------------|-------------------------------|--------------|
| Full-text search | Yes (advanced) | Yes (advanced) | Basic | Basic | Hybrid: semantic + full-text keyword toggle |
| Cross-references | Normenkette (flat list) | Normenkette (flat list) | Hyperlinked refs | Hyperlinked refs | Interactive citation graph (novel) |
| Similar paragraphs | Via commentary links | Via related docs | No | No | Qdrant Recommend API (novel for free tools) |
| Grouped results | By source/category | By source type | No | No | Qdrant Search Groups by law/legal area |
| Advanced filters | Extensive facets | Extensive facets | Law filter only | Law filter only | Law + section + legal area + chunk type |
| Export | PDF, Word, clipboard | PDF, clipboard | No | No | Markdown + clipboard (Phase 1), PDF (Phase 3+) |
| Citation visualization | No | Juris Analytics (paid) | No | No | D3/react-force-graph (free, open) |
| Semantic search | Beck-Noxtua (AI, new) | No | No | No | bge-m3 hybrid search (already built) |
| Exploratory discovery | No | No | No | No | Qdrant Discovery API with pos/neg examples |
| MCP/AI integration | No | No | No | No | FastMCP tools for Claude (already built) |

### Key Competitive Insights

1. **Free tools (dejure.org, gesetze-im-internet.de)** have basic cross-references as hyperlinks but no semantic search, no recommendations, no grouping. Our app already surpasses them on search quality.

2. **Paid databases (Beck-online, Juris)** have extensive content (commentary, case law) we cannot match. But they lack semantic search, exploratory discovery, and AI integration. Our differentiators are in search intelligence, not content volume.

3. **Beck-Noxtua** is Beck's new AI offering (launched ~2024-2025) that adds semantic search to Beck-online. This validates that semantic legal search is the direction the market is moving. Our advantage: open-source, local deployment, MCP integration.

4. **Citation network visualization is genuinely novel.** No German legal database -- free or paid -- offers an interactive graph of law cross-references. The TENJI study (ACM CIKM 2025) showed that graph-based legal interfaces nearly doubled retrieval performance for law students.

## Sources

- [Beck-online Wikipedia](https://de.wikipedia.org/wiki/Beck-Online) -- feature overview, 40M+ documents, commentary linking
- [Globalex: Legal Research in Germany](https://www.nyulawglobal.org/globalex/germany1.html) -- overview of German legal databases
- [German Legal Reference Parser (GitHub)](https://github.com/lavis-nlp/german-legal-reference-parser) -- regex-based citation extraction for German law
- [Open Legal Data Reference Extraction](https://github.com/openlegaldata/legal-reference-extraction) -- alternative citation parser
- [Qdrant Recommendation API](https://qdrant.tech/articles/new-recommendation-api/) -- best_score strategy, positive/negative examples
- [Qdrant Search Groups API](https://api.qdrant.tech/api-reference/search/point-groups) -- group by payload field
- [TENJI: Human-Centered Legal Knowledge Graph (ACM CIKM 2025)](https://dl.acm.org/doi/10.1145/3746252.3761003) -- graph interfaces doubled retrieval performance
- [Juristische Datenbanken Vergleich](https://www.juristischedatenbanken.de/marktuebersicht/) -- market overview of German legal databases
- [Beck-Noxtua Datenbasis](https://www.beck-noxtua.de/datenbasis/) -- Beck's AI-powered legal search

---
*Feature research for: Paragraf v2 -- Volles Qdrant-Potenzial*
*Researched: 2026-03-27*

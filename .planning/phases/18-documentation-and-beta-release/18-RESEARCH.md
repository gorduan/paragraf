# Phase 18: Documentation & Beta Release - Research

**Researched:** 2026-04-01
**Domain:** Technical documentation, version management, project positioning
**Confidence:** HIGH

## Summary

Phase 18 is a documentation-only phase with no code logic changes. It requires: (1) rewriting README.md to be concise and honest, (2) creating three new guides (INSTALLATION.md, API.md, MCP.md), and (3) updating version strings from "0.2.0" / "2.0.0" to "0.9-beta" across 5+ files. The user has been explicit that there must be no marketing language — the project is thorough (not fast), the frontend is a demo, and the MCP server is the real strength.

The primary risk is version string fragmentation — the version currently appears in at least 5 files with inconsistent values (backend: 0.2.0, desktop: 2.0.0). A grep-based sweep is needed to catch all occurrences. The documentation work itself is straightforward since all API endpoints and MCP tools have existing docstrings that serve as source material.

**Primary recommendation:** Structure as 4 plans: (1) Version update sweep, (2) README rewrite, (3) INSTALLATION.md + API.md, (4) MCP.md (the most important document per user decision D-16).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Kein Marketing-Sprech. Keine Versprechen wie "Gesetze finden in Sekunden", "schnelle Suche" etc. Paragraf ist nicht schnell, sondern ausfuehrlich und gruendlich.
- **D-02:** Frontend ist eine Demo-Oberflaeche. Die eigentliche Staerke liegt im MCP-Server, der jedes LLM (Claude, GPT, etc.) mit deutschem Recht versorgt und so bessere Antworten ermoeglicht.
- **D-03:** Ehrliche Darstellung: Was funktioniert, was nicht, was Beta bedeutet.
- **D-04:** Version aendern von "v2" auf "0.9-beta" — ueberall: README, package.json, pyproject.toml, CLAUDE.md, docker-compose Labels, etc.
- **D-05:** README wird komplett neu geschrieben. Kurz, sachlich, technisch. Keine Wiederholung von Inhalten die in eigenen Guides stehen.
- **D-06:** Struktur: Was ist Paragraf (1-2 Saetze), Quick-Start (Docker), Architektur-Ueberblick, Links zu INSTALLATION.md, API.md, MCP.md, Rechtliche Hinweise.
- **D-07:** "v2" aus dem Titel entfernen. Neuer Titel: "Paragraf -- RAG-basierte Rechtsrecherche fuer deutsches Recht" oder aehnlich.
- **D-08:** Ausfuehrliche Schritt-fuer-Schritt Anleitung. Docker-basiert als Hauptweg.
- **D-09:** Voraussetzungen klar benennen: Docker Desktop, Git, Hardwareanforderungen (RAM, Festplatte fuer ML-Modelle).
- **D-10:** GPU-Setup als eigener Abschnitt (NVIDIA Container Toolkit).
- **D-11:** Lokale Entwicklung (Backend + Frontend separat) als eigener Abschnitt.
- **D-12:** Troubleshooting-Abschnitt fuer haeufige Probleme.
- **D-13:** Alle REST-Endpoints dokumentieren mit Beschreibung, Request/Response-Beispielen (curl).
- **D-14:** Gruppiert nach Funktion: Suche, Nachschlagen, Vergleich, Gesetze, Index, Einstellungen, Modelle.
- **D-15:** Keine Auto-generierte OpenAPI-Doku, sondern handgeschriebene Erklaerungen mit Kontext wann man welchen Endpoint nutzt.
- **D-16:** Dies ist der wichtigste Guide — MCP ist die Staerke des Projekts.
- **D-17:** Zielgruppe: Claude Desktop-Nutzer, Claude Code-Nutzer, und andere MCP-kompatible LLM-Clients.
- **D-18:** Setup-Anleitung: `claude mcp add paragraf --url http://localhost:8000/mcp`
- **D-19:** Alle MCP-Tools auflisten mit Beschreibung und Beispiel-Prompts die zeigen was man damit fragen kann.
- **D-20:** Erklaeren warum MCP besser ist als reines Websuchen: strukturierte Gesetzes-Datenbank, Querverweise, Hybrid-Search, Reranking.

### Claude's Discretion
- Genaue Formulierungen und Reihenfolge innerhalb der Dokumente
- Technische Details-Tiefe in der API-Doku
- Ob Beispiel-Outputs in der MCP-Doku gezeigt werden

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

## Standard Stack

This phase creates documentation files (Markdown) and updates version strings. No new libraries or dependencies are introduced.

### Tools Used
| Tool | Purpose | Why |
|------|---------|-----|
| Markdown | All documentation format | GitHub renders it natively, industry standard |
| curl examples | API documentation | Universal, no client dependency, copy-pasteable |

## Architecture Patterns

### Documentation Structure
```
paragraf v2/
├── README.md              # Rewritten: concise project overview + links
├── INSTALLATION.md        # NEW: step-by-step setup guide
├── API.md                 # NEW: REST endpoint reference
├── MCP.md                 # NEW: MCP integration guide (most important)
├── CLAUDE.md              # Updated: version refs, remove "v2"
├── .env.example           # Updated: header comment version ref
├── backend/
│   ├── pyproject.toml     # version: "0.9-beta" (was "0.2.0")
│   └── src/paragraf/
│       └── __init__.py    # __version__ = "0.9-beta" (was "0.2.0")
├── frontend/
│   └── package.json       # version: "0.9.0-beta" (npm semver, was "0.2.0")
├── desktop/
│   └── package.json       # version: "0.9.0-beta" (was "2.0.0")
└── docker-compose.yml     # Labels if any version refs exist
```

### Pattern: Documentation Hub with Spokes
**What:** README serves as a concise hub linking to detailed guides. Each guide is self-contained.
**When to use:** Projects with multiple audiences (users, developers, LLM integrators).
**Structure:**
- README.md: 1-page overview, quick-start, architecture diagram, links to guides
- INSTALLATION.md: step-by-step for Docker users and local developers
- API.md: endpoint reference for frontend developers and API consumers
- MCP.md: integration guide for Claude/LLM users (the primary audience)

### Pattern: Honest Beta Positioning
**What:** Explicitly state project maturity, known limitations, and what "beta" means.
**Why:** Per D-01/D-03 -- no marketing, honest representation.
**Template elements:**
- What works well (hybrid search, cross-references, reranking)
- What is limited (speed -- thorough not fast, frontend is demo-quality)
- What "0.9-beta" means (feature-complete for core use case, API may change)

### Anti-Patterns to Avoid
- **Marketing superlatives:** "Blitzschnelle Suche", "in Sekunden" -- user explicitly forbids this (D-01)
- **Repeating content across docs:** README should link, not duplicate INSTALLATION steps (D-05)
- **Auto-generated API docs without context:** User wants handwritten explanations of WHEN to use each endpoint (D-15)
- **Ignoring npm semver:** npm package.json requires valid semver -- "0.9-beta" is invalid, must use "0.9.0-beta"

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API documentation | Custom doc generator | Hand-written Markdown with curl examples | D-15 explicitly requires handwritten docs with context |
| Version bumping | Manual find-and-replace | Systematic grep sweep + targeted edits | Too many files to update manually without missing one |

## Inventory: Version Strings to Update

All locations where version must change to "0.9-beta" (or semver equivalent):

| File | Current Value | New Value | Field |
|------|---------------|-----------|-------|
| `backend/pyproject.toml` | `"0.2.0"` | `"0.9b0"` | `version` (PEP 440: pre-release) |
| `backend/src/paragraf/__init__.py` | `"0.2.0"` | `"0.9b0"` | `__version__` |
| `frontend/package.json` | `"0.2.0"` | `"0.9.0-beta"` | `version` (npm semver) |
| `desktop/package.json` | `"2.0.0"` | `"0.9.0-beta"` | `version` (npm semver) |
| `CLAUDE.md` | Multiple "v2" refs | Remove "v2", update description | Header, project description |
| `.env.example` | `"Paragraf v2"` in header | `"Paragraf"` | Comment line |
| `README.md` | `"Paragraf v2"` title | Complete rewrite | Entire file |

**Version format note:**
- PEP 440 (Python): `0.9b0` is the canonical form for "0.9 beta". `"0.9-beta"` is NOT valid PEP 440.
- npm semver: `0.9.0-beta` is valid. Cannot use `0.9-beta` (needs three-part version).
- Display/docs: Use "0.9-beta" in human-readable text (README, CLAUDE.md descriptions).

## Inventory: REST API Endpoints (for API.md)

Grouped per D-14:

### Suche (Search)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/search` | Hybrid search (dense + sparse + reranking) |
| POST | `/api/search/batch` | Multiple queries in one request |
| POST | `/api/search/grouped` | Search with results grouped by law |
| POST | `/api/search/multi-hop` | Multi-step search following references |

### Empfehlungen (Recommendations)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/recommend` | Similar paragraphs by vector similarity |
| POST | `/api/recommend/grouped` | Similar paragraphs grouped by law |
| POST | `/api/discover` | Discover related content via exploration |

### Nachschlagen (Lookup)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/lookup` | Look up specific paragraph by law + number |
| POST | `/api/compare` | Compare two paragraphs side by side |

### Querverweise (References)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/references/extract` | Extract legal references from text |
| GET | `/api/references/{gesetz}/{paragraph}` | Get reference network for a paragraph |

### Gesetze (Laws)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/laws` | List all available laws with index status |
| GET | `/api/laws/{gesetz}/structure` | Law structure (chapters, sections) |
| GET | `/api/laws/{gesetz}/paragraphs` | All paragraphs of a law |

### Beratung (Counseling)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/counseling` | Search EUTB counseling centers |

### Index-Verwaltung (Index Management)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/index/status` | Index status per law |
| POST | `/api/index` | Index one or more laws (SSE stream) |
| POST | `/api/index/eutb` | Index EUTB counseling data |
| POST | `/api/indexes/ensure` | Ensure Qdrant collections exist |

### Snapshots
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/snapshots` | Create snapshot |
| GET | `/api/snapshots` | List snapshots |
| POST | `/api/snapshots/{name}/restore` | Restore snapshot |
| DELETE | `/api/snapshots/{name}` | Delete snapshot |

### System
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check (backend + Qdrant + models) |
| GET | `/api/settings` | Current configuration (read-only) |
| GET | `/api/settings/gpu` | GPU detection status |
| POST | `/api/models/download` | Download ML models (SSE stream) |
| GET | `/api/models/status` | Model download/load status |
| GET | `/api/models/cache` | Cache size and location |
| DELETE | `/api/models/cache` | Clear model cache |

**Total: 29 endpoints** across 8 groups.

## Inventory: MCP Tools (for MCP.md)

| Tool | File | Purpose |
|------|------|---------|
| `paragraf_search` | search.py | Hybrid search across all indexed laws |
| `paragraf_lookup` | search.py | Look up specific paragraph |
| `paragraf_compare` | search.py | Compare two paragraphs |
| `paragraf_similar` | recommend.py | Find similar paragraphs by vector |
| `paragraf_discover` | discover.py | Explore related content |
| `paragraf_grouped_search` | grouped_search.py | Search grouped by law |
| `paragraf_similar_grouped` | grouped_search.py | Similar paragraphs grouped by law |
| `paragraf_references` | references.py | Get reference network |
| `paragraf_laws` | lookup.py | List available laws |
| `paragraf_counseling` | lookup.py | Search EUTB counseling centers |
| `paragraf_status` | lookup.py | Check system/index status |
| `paragraf_index` | ingest.py | Index laws into Qdrant |
| `paragraf_index_eutb` | ingest.py | Index EUTB data |
| `paragraf_snapshot` | snapshot.py | Create/manage snapshots |

**Total: 14 MCP tools.**

## Common Pitfalls

### Pitfall 1: PEP 440 Version Format
**What goes wrong:** Using "0.9-beta" in pyproject.toml causes build errors. Python packaging requires PEP 440 format.
**Why it happens:** Natural language "0.9-beta" is not valid PEP 440.
**How to avoid:** Use `0.9b0` in pyproject.toml and __init__.py. Use "0.9-beta" only in human-readable docs.
**Warning signs:** `pip install -e .` fails, `hatchling` build errors.

### Pitfall 2: npm Semver Requirements
**What goes wrong:** npm requires three-part version. `"0.9-beta"` is invalid.
**How to avoid:** Use `"0.9.0-beta"` in package.json files.
**Warning signs:** `npm install` warns about invalid version.

### Pitfall 3: Missing Version Locations
**What goes wrong:** Version updated in obvious files but missed in __init__.py, desktop/package.json, or comment headers.
**How to avoid:** Run `grep -rn "0\.2\.0\|2\.0\.0\|v2" --include="*.py" --include="*.json" --include="*.toml" --include="*.yml" --include="*.md"` before and after to verify completeness.
**Warning signs:** `__version__` still returns old value at runtime.

### Pitfall 4: Broken Internal Links
**What goes wrong:** README links to INSTALLATION.md but file is named differently, or relative paths break on GitHub.
**How to avoid:** Use consistent filenames, test links work on GitHub (relative paths from repo root).
**Warning signs:** 404 on GitHub documentation links.

### Pitfall 5: curl Examples with Wrong Ports
**What goes wrong:** API examples use localhost:8000 (direct backend) instead of localhost:3847 (Docker frontend proxy) or vice versa.
**How to avoid:** Decide on one canonical URL for documentation. Recommend `http://localhost:3847/api/...` (via nginx) for Docker users, note `http://localhost:8000/api/...` for local dev.
**Warning signs:** Users get connection refused when following docs.

### Pitfall 6: MCP URL Incorrect
**What goes wrong:** D-18 specifies `http://localhost:8000/mcp` but the MCP service runs on port 8001 as a separate container.
**How to avoid:** Verify the actual MCP endpoint URL from docker-compose.yml. The MCP service maps to port 8001 externally. Correct URL: `http://localhost:8001/mcp`.
**Warning signs:** Claude Desktop fails to connect to MCP server.

## Code Examples

### Version String Patterns

Python (PEP 440):
```python
# backend/pyproject.toml
version = "0.9b0"

# backend/src/paragraf/__init__.py
__version__ = "0.9b0"
```

npm (semver):
```json
{
  "version": "0.9.0-beta"
}
```

Human-readable (README, CLAUDE.md):
```markdown
Paragraf 0.9-beta
```

### curl Example Pattern (for API.md)
```bash
# Suche nach "Kuendigungsschutz"
curl -s http://localhost:3847/api/search \
  -H "Content-Type: application/json" \
  -d '{"anfrage": "Kuendigungsschutz bei Schwerbehinderung", "top_k": 5}' | jq .
```

### MCP Setup Pattern (for MCP.md)
```bash
# Claude Code
claude mcp add paragraf --url http://localhost:8001/mcp

# Claude Desktop (claude_desktop_config.json)
{
  "mcpServers": {
    "paragraf": {
      "url": "http://localhost:8001/mcp"
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single README with everything | Hub README + separate guides | Industry standard | Better navigation, less overwhelming |
| OpenAPI auto-generated docs | Handwritten with context (D-15) | User decision | More useful for humans, explains WHEN not just WHAT |
| MCP stdio transport only | Streamable-HTTP transport | MCP SDK 1.0+ | Network-accessible, Docker-friendly |

## Project Constraints (from CLAUDE.md)

- All commits go to branch "Docker-only", never main/master
- Deutsche UI, deutsche Docstrings, englische Variablen/Funktionsnamen
- Alle Gesetzes-Abkuerzungen in roemischen Zahlen (SGB IX, nicht SGB 9)
- RDG-Disclaimer bei jeder Antwort
- Docker Compose only deployment

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.0+ with pytest-asyncio |
| Config file | `backend/pyproject.toml` |
| Quick run command | `docker compose exec backend python -m pytest tests/ -v -x` |
| Full suite command | `docker compose exec backend python -m pytest tests/ -v` |

### Phase Requirements to Test Map

This phase is documentation-only. No behavioral code changes. Validation focuses on:

| Check | Behavior | Test Type | Command | Exists? |
|-------|----------|-----------|---------|---------|
| V-01 | Version strings consistent | manual/grep | `grep -rn "0\.9" backend/pyproject.toml backend/src/paragraf/__init__.py frontend/package.json desktop/package.json` | N/A |
| V-02 | PEP 440 valid | smoke | `cd backend && pip install -e . 2>&1` | N/A |
| V-03 | npm version valid | smoke | `cd frontend && npm pkg get version` | N/A |
| V-04 | Markdown links valid | manual | Check all `[text](file.md)` links in README resolve | N/A |
| V-05 | No "v2" remnants in docs | grep | `grep -rn "v2\|Paragraf v2" README.md INSTALLATION.md API.md MCP.md CLAUDE.md` | N/A |
| V-06 | curl examples work | manual | Run curl examples from API.md against running instance | N/A |

### Sampling Rate
- **Per task commit:** V-01, V-05 (grep checks)
- **Per wave merge:** V-01 through V-05
- **Phase gate:** All V-01 through V-06

### Wave 0 Gaps
None -- this phase creates documentation files, not test infrastructure. Existing pytest suite validates that version changes do not break imports.

## Open Questions

1. **Port for API curl examples**
   - What we know: Docker maps frontend/nginx to 3847, backend directly to 8000. Both can reach `/api/*`.
   - What is unclear: Which port should docs recommend? 3847 is the "production" path through nginx.
   - Recommendation: Use `localhost:3847` as primary in docs (matches Docker setup), note `localhost:8000` for local dev.

2. **MCP endpoint URL**
   - What we know: D-18 says `http://localhost:8000/mcp` but MCP runs as separate service on port 8001.
   - What is unclear: Whether backend also exposes MCP at 8000 or only the dedicated mcp service at 8001.
   - Recommendation: Verify in implementation. The docker-compose.yml shows mcp service on 8001. Use `http://localhost:8001/mcp`.

3. **desktop/package.json in scope?**
   - What we know: Desktop app version is "2.0.0", listed in CONTEXT.md canonical refs.
   - What is unclear: Whether desktop package should also go to 0.9.0-beta since it is a separate product.
   - Recommendation: Include it -- CONTEXT.md D-04 says "ueberall".

## Sources

### Primary (HIGH confidence)
- Project codebase: `backend/src/paragraf/api.py` -- all 29 REST endpoints verified by grep
- Project codebase: `backend/src/paragraf/tools/*.py` -- all 14 MCP tools verified by grep
- Project codebase: Version strings verified in pyproject.toml, package.json, __init__.py
- PEP 440 specification -- pre-release version format `0.9b0`
- npm semver specification -- pre-release format `0.9.0-beta`

### Secondary (MEDIUM confidence)
- MCP port 8001 from docker-compose.yml line analysis (not fully read, inferred from CLAUDE.md architecture table)

## Metadata

**Confidence breakdown:**
- Version update scope: HIGH -- grep-verified all version locations
- API endpoint inventory: HIGH -- extracted from api.py source
- MCP tool inventory: HIGH -- extracted from tools/ source
- Documentation patterns: HIGH -- standard Markdown, no novel technology
- Port/URL details: MEDIUM -- need verification during implementation

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- documentation phase, no fast-moving dependencies)

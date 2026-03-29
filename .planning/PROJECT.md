# Paragraf v2 -- Professionelle Rechtsrecherche

## What This Is

Docker-basierte Web-App fuer deutsches und europaeisches Recht mit RAG-basierter Rechtsrecherche. Nutzt BAAI/bge-m3 Embeddings, Qdrant Hybrid-Search (Dense + Sparse mit RRF-Fusion) und Cross-Encoder Reranking. Dual-Interface: React-Frontend fuer Endnutzer und MCP-Server fuer Claude Desktop/Code.

## Core Value

Juristen und Buerger finden in Sekunden die relevanten Paragraphen -- mit semantischer Suche, Querverweisen zwischen Gesetzen und gruppierten Ergebnissen, die den Kontext einer Rechtsfrage vollstaendig erschliessen.

## Requirements

### Validated

- ✓ Hybrid Search (Dense + Sparse RRF-Fusion) mit Cross-Encoder Reranking -- existing
- ✓ ~95 deutsche Gesetze + 9 EU-Verordnungen indexiert -- existing
- ✓ Exakter Paragraphen-Lookup -- existing
- ✓ Paragraphen-Vergleich (bis zu 5 nebeneinander) -- existing
- ✓ Gesetz-Browser mit hierarchischer Struktur -- existing
- ✓ EUTB-Beratungsstellen-Suche -- existing
- ✓ SSE-Streaming fuer Indexierungs-Fortschritt -- existing
- ✓ MCP-Server mit Search/Lookup/Compare/Ingest Tools -- existing
- ✓ 4 MCP-Prompts (Rechtsinfo, Leichte Sprache, Nachteilsausgleich, Leistungen) -- existing
- ✓ Docker Compose Deployment (4 Services) -- existing
- ✓ GPU-Support mit FP16 -- existing
- ✓ Snapshot API + Scalar Quantization -- v1.0
- ✓ Full-Text Index + Range Filter -- v1.0
- ✓ Recommend API (aehnliche Paragraphen) -- v1.0
- ✓ Discovery API (explorative Suche) -- v1.0
- ✓ Grouping API (nach Gesetz gruppiert) -- v1.0
- ✓ Scroll API (Paginierung) -- v1.0
- ✓ Batch Search -- v1.0
- ✓ Query Expansion (juristisches Synonym-Woerterbuch) -- v1.0
- ✓ Querverweis-Extraktion + Zitationsnetzwerk -- v1.0
- ✓ Multi-Hop MCP-Prompts -- v1.0
- ✓ Semantic Chunking (Satz-Ebene) -- v1.0
- ✓ Design-System mit TailwindCSS 4 Tokens + 8 Primitives -- v1.0
- ✓ Professionelle Search UX (Filter, Gruppierung, Paginierung, Compare) -- v1.0
- ✓ Interaktiver Zitationsgraph (d3-force) -- v1.0
- ✓ Discovery UI mit Positiv/Negativ-Beispielen -- v1.0
- ✓ PDF/Markdown-Export -- v1.0
- ✓ Responsive Design + WCAG 2.1 AA -- v1.0
- ✓ Snapshot-Management im Dashboard -- v1.0
- ✓ 7 neue MCP-Tools (similar, discover, references, grouped_search, snapshot, similar_grouped) -- v1.0

### Active

(No active requirements -- planning next milestone)

### Out of Scope

- Nutzer-Authentifizierung -- keine Login-Anforderung, App ist intern/lokal
- Echtzeit-Kollaboration -- Single-User-Tool
- Eigenes LLM/Chat-Interface -- Claude uebernimmt das via MCP
- Bezahl-Features -- Open-Source-Projekt
- Mobile Native App -- Web-first, responsive genuegt
- ColBERT Multi-Vector Search -- Storage-Overhead 100x+, Hybrid Dense+Sparse genuegt
- PWA Manifest -- nicht prioritaer fuer Desktop-fokussierten Einsatz

## Context

**Current state (v1.0 shipped):**
- 283 files changed, ~50k lines added across 13 phases
- Tech stack: Python 3.12 + FastAPI + FastMCP, React 19 + Vite + TailwindCSS 4, Qdrant v1.13.2
- 4 Docker services: qdrant, backend, mcp, frontend (nginx)
- 40/40 milestone requirements satisfied, 7 integration gaps closed
- 24 vitest frontend tests, backend unit tests across all services
- Nyquist test coverage: 1/10 phases fully compliant (area for improvement)
- All Qdrant v1.13.2 capabilities utilized except ColBERT multi-vector

## Constraints

- **Tech Stack**: Python 3.12 + FastAPI + FastMCP, React 19 + Vite + TailwindCSS -- beibehalten
- **Deployment**: Docker Compose only -- keine Kubernetes, kein Cloud-Deployment
- **Qdrant Version**: v1.13.2 -- Features muessen mit dieser Version kompatibel sein
- **Modelle**: BAAI/bge-m3 + bge-reranker-v2-m3 -- keine neuen ML-Modelle einfuehren
- **Sprache**: Deutsche UI, deutsche Docstrings, englische Variablen/Funktionsnamen
- **Branch**: Alle Commits auf Branch "Docker-only", nie auf main/master

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Alle Qdrant-Features nutzen (Recommend, Discovery, Grouping, Scroll, Quantization, Snapshots) | Volle Investition in bestehende Infrastruktur statt neue Tools | ✓ Good -- alle Features produktiv genutzt |
| Querverweis-Extraktion als Kern-Feature | Zitationsnetzwerk ist USP gegenueber einfachen Gesetzesdatenbanken | ✓ Good -- Graph-Visualisierung + Multi-Hop ermoeglicht |
| Frontend-Redesign mit Design-Skills | Professionelle UX durch /frontend-design + /ui-ux-pro-max + /ckm-ui-styling | ✓ Good -- konsistentes Design-System, 8 Primitives |
| Kein ColBERT Multi-Vector in diesem Milestone | Komplexitaet vs. Nutzen -- Hybrid Dense+Sparse genuegt, ColBERT spaeter | ✓ Good -- kein Bedarf, Suchqualitaet ausreichend |
| Backend-first Sequenzierung (Phases 1-7 vor 8-10) | Frontend nicht blockiert, alle APIs fertig bevor UI gebaut wird | ✓ Good -- zero blocked frontend work |
| query_points / query_points_groups statt Legacy-Endpoints | Zukunftssicher, konsistente API | ✓ Good -- einheitliches Query-Interface |
| Gap Closure Phases (11-13) nach Audit | Systematische Luecken-Schliessung statt ad-hoc Fixes | ✓ Good -- alle 7 Integrations-Luecken geschlossen |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 after v1.0 milestone completion*

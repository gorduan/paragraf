# Paragraf v2 — Volles Qdrant-Potenzial

## What This Is

Docker-basierte Web-App fuer deutsches und europaeisches Recht mit RAG-basierter Rechtsrecherche. Nutzt BAAI/bge-m3 Embeddings, Qdrant Hybrid-Search (Dense + Sparse mit RRF-Fusion) und Cross-Encoder Reranking. Dual-Interface: React-Frontend fuer Endnutzer und MCP-Server fuer Claude Desktop/Code.

Dieses Milestone erschliesst das volle Potenzial der Qdrant-Datenbank und verbessert Frontend, Backend und MCP-Tools gleichermassen.

## Core Value

Juristen und Buerger finden in Sekunden die relevanten Paragraphen — mit semantischer Suche, Querverweisen zwischen Gesetzen und gruppierten Ergebnissen, die den Kontext einer Rechtsfrage vollstaendig erschliessen.

## Requirements

### Validated

- ✓ Hybrid Search (Dense + Sparse RRF-Fusion) mit Cross-Encoder Reranking — existing
- ✓ ~95 deutsche Gesetze + 9 EU-Verordnungen indexiert — existing
- ✓ Exakter Paragraphen-Lookup — existing
- ✓ Paragraphen-Vergleich (bis zu 5 nebeneinander) — existing
- ✓ Gesetz-Browser mit hierarchischer Struktur — existing
- ✓ EUTB-Beratungsstellen-Suche — existing
- ✓ SSE-Streaming fuer Indexierungs-Fortschritt — existing
- ✓ MCP-Server mit Search/Lookup/Compare/Ingest Tools — existing
- ✓ 4 MCP-Prompts (Rechtsinfo, Leichte Sprache, Nachteilsausgleich, Leistungen) — existing
- ✓ Docker Compose Deployment (3 Services) — existing
- ✓ GPU-Support mit FP16 — existing

### Active

**Qdrant-Features:**
- [ ] Recommend API: "Aehnliche Paragraphen" zu einem gegebenen Paragraphen finden
- [ ] Discovery API: Explorative Suche mit Positiv/Negativ-Beispielen
- [ ] Grouping API: Suchergebnisse nach Gesetz/Rechtsgebiet gruppieren
- [ ] Scroll API: Paginierung ueber grosse Ergebnismengen
- [x] Full-Text Index auf `text`-Feld fuer exakte Wortsuche — Validated in Phase 2: Search Indexes Full-Text
- [x] Payload Range-Filter fuer numerische Felder (absatz) — Validated in Phase 2: Search Indexes Full-Text
- [x] Scalar Quantization fuer speichereffizientere Vektoren — Validated in Phase 1: Snapshot Safety Net
- [x] Snapshot API fuer Backup/Restore vor Re-Indexierung — Validated in Phase 1: Snapshot Safety Net

**Backend/MCP-Erweiterungen:**
- [ ] Querverweis-Extraktion: Zitationen zwischen Gesetzen erkennen und als Payload speichern
- [ ] Zitationsnetzwerk: Graph-basierte Navigation zwischen referenzierten Normen
- [ ] Query Expansion: Synonym-/Paraphrasen-Erweiterung fuer besseren Recall
- [ ] Multi-Hop MCP-Prompts: Kombinierte Suchen fuer komplexe Rechtsfragen
- [ ] Abschnitt-Filter vollstaendig in MCP-Tools exponieren
- [ ] Batch Search Endpoint fuer parallele Queries
- [ ] Semantic Chunking: Intelligentere Segmentierung langer Paragraphen

**Frontend-Verbesserungen (mit /frontend-design, /ui-ux-pro-max, /ckm-ui-styling):**
- [ ] Professionelles UI-Redesign mit Design-System und konsistenter visueller Sprache
- [ ] "Aehnliche Paragraphen"-Button auf ResultCard (Recommend API)
- [ ] Ergebnis-Gruppierung nach Gesetz/Rechtsgebiet in der Suche
- [ ] Erweiterte Filter-UI: Abschnitt + Chunk-Typ + Absatz-Range
- [ ] Vergleich direkt aus Suchergebnissen heraus (onCompare wiring)
- [ ] Paginierung fuer Suche und Law Browser
- [ ] Zitations-Graph: Interaktive Visualisierung von Querverweisen
- [ ] Export: PDF/Markdown-Export von Ergebnissen und Vergleichen
- [ ] Responsive Design-Verbesserungen und Accessibility-Audit

### Out of Scope

- Nutzer-Authentifizierung — keine Login-Anforderung, App ist intern/lokal
- Echtzeit-Kollaboration — Single-User-Tool
- Eigenes LLM/Chat-Interface — Claude uebernimmt das via MCP
- Bezahl-Features — Open-Source-Projekt
- Mobile Native App — Web-first, responsive genuegt

## Context

- Brownfield: Funktionierendes System mit ~20 Python-Dateien Backend + React-Frontend
- Qdrant v1.13.2 bietet Recommend, Discovery, Grouping, Scroll, Quantization, Snapshots — alles ungenutzt
- bge-m3 unterstuetzt ColBERT Multi-Vector Output — aktuell nur Dense + Sparse genutzt
- Frontend hat teilweise vorbereitete aber nicht verdrahtete Features (onCompare, abschnitt-Filter)
- MCP-Tools spiegeln nicht alle Backend-Capabilities wider
- Gesetze referenzieren sich intensiv gegenseitig — dieses Netzwerk ist aktuell unsichtbar
- Frontend-Design soll mit /frontend-design, /ui-ux-pro-max und /ckm-ui-styling Skills professionell gestaltet werden

## Constraints

- **Tech Stack**: Python 3.12 + FastAPI + FastMCP, React 19 + Vite + TailwindCSS — beibehalten
- **Deployment**: Docker Compose only — keine Kubernetes, kein Cloud-Deployment
- **Qdrant Version**: v1.13.2 — Features muessen mit dieser Version kompatibel sein
- **Modelle**: BAAI/bge-m3 + bge-reranker-v2-m3 — keine neuen ML-Modelle einfuehren
- **Sprache**: Deutsche UI, deutsche Docstrings, englische Variablen/Funktionsnamen
- **Branch**: Alle Commits auf Branch "Docker-only", nie auf main/master

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Alle Qdrant-Features nutzen (Recommend, Discovery, Grouping, Scroll, Quantization, Snapshots) | Volle Investition in bestehende Infrastruktur statt neue Tools | — Pending |
| Querverweis-Extraktion als Kern-Feature | Zitationsnetzwerk ist USP gegenueber einfachen Gesetzesdatenbanken | — Pending |
| Frontend-Redesign mit Design-Skills | Professionelle UX durch /frontend-design + /ui-ux-pro-max + /ckm-ui-styling | — Pending |
| Kein ColBERT Multi-Vector in diesem Milestone | Komplexitaet vs. Nutzen — Hybrid Dense+Sparse genuegt, ColBERT spaeter | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after Phase 2 (Search Indexes Full-Text) completion*

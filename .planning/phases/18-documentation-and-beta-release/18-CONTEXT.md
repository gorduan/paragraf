# Phase 18: Documentation & Beta Release - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Projekt-Dokumentation fuer GitHub ueberarbeiten. Vier Dokumente: README (Rewrite), INSTALLATION.md, API.md, MCP.md. Versionsnummer auf 0.9-beta aendern. Kein Marketing, keine falschen Versprechen. Ehrliche Darstellung des Projektstatus.

</domain>

<decisions>
## Implementation Decisions

### Ton und Positionierung
- **D-01:** Kein Marketing-Sprech. Keine Versprechen wie "Gesetze finden in Sekunden", "schnelle Suche" etc. Paragraf ist nicht schnell, sondern ausfuehrlich und gruendlich.
- **D-02:** Frontend ist eine Demo-Oberflaeche. Die eigentliche Staerke liegt im MCP-Server, der jedes LLM (Claude, GPT, etc.) mit deutschem Recht versorgt und so bessere Antworten ermoeglicht.
- **D-03:** Ehrliche Darstellung: Was funktioniert, was nicht, was Beta bedeutet.
- **D-04:** Version aendern von "v2" auf "0.9-beta" — ueberall: README, package.json, pyproject.toml, CLAUDE.md, docker-compose Labels, etc.

### README.md (Rewrite)
- **D-05:** README wird komplett neu geschrieben. Kurz, sachlich, technisch. Keine Wiederholung von Inhalten die in eigenen Guides stehen.
- **D-06:** Struktur: Was ist Paragraf (1-2 Saetze), Quick-Start (Docker), Architektur-Ueberblick, Links zu INSTALLATION.md, API.md, MCP.md, Rechtliche Hinweise.
- **D-07:** "v2" aus dem Titel entfernen. Neuer Titel: "Paragraf — RAG-basierte Rechtsrecherche fuer deutsches Recht" oder aehnlich.

### INSTALLATION.md (Neu)
- **D-08:** Ausfuehrliche Schritt-fuer-Schritt Anleitung. Docker-basiert als Hauptweg.
- **D-09:** Voraussetzungen klar benennen: Docker Desktop, Git, Hardwareanforderungen (RAM, Festplatte fuer ML-Modelle).
- **D-10:** GPU-Setup als eigener Abschnitt (NVIDIA Container Toolkit).
- **D-11:** Lokale Entwicklung (Backend + Frontend separat) als eigener Abschnitt.
- **D-12:** Troubleshooting-Abschnitt fuer haeufige Probleme.

### API.md (Neu)
- **D-13:** Alle REST-Endpoints dokumentieren mit Beschreibung, Request/Response-Beispielen (curl).
- **D-14:** Gruppiert nach Funktion: Suche, Nachschlagen, Vergleich, Gesetze, Index, Einstellungen, Modelle.
- **D-15:** Keine Auto-generierte OpenAPI-Doku, sondern handgeschriebene Erklaerungen mit Kontext wann man welchen Endpoint nutzt.

### MCP.md (Neu)
- **D-16:** Dies ist der wichtigste Guide — MCP ist die Staerke des Projekts.
- **D-17:** Zielgruppe: Claude Desktop-Nutzer, Claude Code-Nutzer, und andere MCP-kompatible LLM-Clients.
- **D-18:** Setup-Anleitung: `claude mcp add paragraf --url http://localhost:8000/mcp`
- **D-19:** Alle MCP-Tools auflisten mit Beschreibung und Beispiel-Prompts die zeigen was man damit fragen kann.
- **D-20:** Erklaeren warum MCP besser ist als reines Websuchen: strukturierte Gesetzes-Datenbank, Querverweise, Hybrid-Search, Reranking.

### Claude's Discretion
- Genaue Formulierungen und Reihenfolge innerhalb der Dokumente
- Technische Details-Tiefe in der API-Doku
- Ob Beispiel-Outputs in der MCP-Doku gezeigt werden

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bestehende Dokumentation
- `README.md` — Aktuelle README (wird komplett ersetzt)
- `.env.example` — Alle verfuegbaren Environment-Variablen
- `CLAUDE.md` — Projekt-Konventionen und Tech-Stack (Version-Referenzen muessen aktualisiert werden)

### Backend-Code (fuer API-Doku)
- `backend/src/paragraf/api.py` — Alle REST-Endpoints
- `backend/src/paragraf/api_models.py` — Request/Response-Modelle
- `backend/src/paragraf/server.py` — MCP-Server Setup und Tool-Registrierungen
- `backend/src/paragraf/tools/` — MCP-Tool-Definitionen

### Version-Referenzen (muessen auf 0.9-beta geaendert werden)
- `backend/pyproject.toml` — Python-Paketversion
- `frontend/package.json` — Frontend-Version
- `desktop/package.json` — Desktop-App-Version
- `docker-compose.yml` — Service-Labels
- `CLAUDE.md` — Projektbeschreibung

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/paragraf/api.py` enthält alle Endpoint-Definitionen mit Docstrings — kann als Basis fuer API.md dienen
- `backend/src/paragraf/server.py` enthält MCP-Tool-Registrierungen mit Beschreibungen — Basis fuer MCP.md
- `backend/src/paragraf/tools/` enthält individuelle Tool-Implementierungen mit deutschen Docstrings

### Established Patterns
- Deutsche Docstrings, englische Variablennamen
- Alle Gesetzes-Abkuerzungen in roemischen Zahlen (SGB IX, nicht SGB 9)
- RDG-Disclaimer bei jeder Antwort

### Integration Points
- Version-String in mindestens 5 Dateien (pyproject.toml, package.json x2, CLAUDE.md, docker-compose)
- README.md wird von GitHub als Hauptseite angezeigt

</code_context>

<specifics>
## Specific Ideas

- "Kein Marketing BlaBla" — explizite Anweisung vom User
- "Unser Projekt ist nicht schnell sondern ausfuehrlich" — ehrliche Selbsteinschaetzung verwenden
- "Das Frontend ist mehr als Demo zu sehen" — klar so kommunizieren
- "Die Staerken liegen im MCP fuer bessere Antworten in jedem LLM" — MCP als Hauptfeature positionieren
- "Paragraf soll 0.9 haben und als Beta eingestuft werden" — ueberall Version aendern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-documentation-and-beta-release*
*Context gathered: 2026-04-01*

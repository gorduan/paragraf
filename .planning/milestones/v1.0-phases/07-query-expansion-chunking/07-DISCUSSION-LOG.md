# Phase 7: Query Expansion & Chunking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 07-query-expansion-chunking
**Areas discussed:** Synonym Dictionary, Expansion Behavior, Chunking Strategy, Multi-Hop MCP

---

## Synonym Dictionary

### Quelle der Synonyme

| Option | Description | Selected |
|--------|-------------|----------|
| LAW_REGISTRY-basiert (Empfohlen) | Automatisch aus LAW_REGISTRY generiert + manuell gepflegte juristische Kern-Synonyme | ✓ |
| Nur Abkuerzungen | Nur Abkuerzung <-> voller Gesetzesname, keine inhaltlichen Synonyme | |
| Externe Quelle | py-openthesaurus oder aehnlicher Dienst (V2-04 im Backlog) | |

**User's choice:** LAW_REGISTRY-basiert
**Notes:** Keine

### Speicherformat

| Option | Description | Selected |
|--------|-------------|----------|
| Python-Dict im Code (Empfohlen) | Statisches Dictionary in eigener Datei, versioniert mit Git | ✓ (primaer) |
| JSON-Datei | Externe JSON-Datei, editierbar ohne Code-Aenderung | ✓ (optional dazu) |
| Du entscheidest | Claude waehlt Format | |

**User's choice:** Python-Dict als Default, aber JSON-Datei soll optional zusaetzlich moeglich sein
**Notes:** Beides gewuenscht — Dict als Basis, JSON als Override/Ergaenzung

### Zahlen-Normalisierung

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, bei Suche normalisieren (Empfohlen) | _normalize_abkuerzung() auch zur Suchzeit anwenden | ✓ |
| Nein, nur Expansion | Normalisierung bleibt nur beim Parsen | |

**User's choice:** Ja, bei Suche normalisieren
**Notes:** Keine

---

## Expansion Behavior

### Pipeline-Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Query-String erweitern (Empfohlen) | Synonyme an Query-String anhaengen, ein Embedding | |
| Parallele Queries + Fusion | Original + expandiert separat suchen, RRF fusionieren | |
| Beides konfigurierbar | ENV-Variable bestimmt Strategie: append oder parallel | ✓ |

**User's choice:** Beides konfigurierbar
**Notes:** Keine

### Sichtbarkeit

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, im Response anzeigen (Empfohlen) | expanded_terms-Feld im API-Response | ✓ |
| Nein, unsichtbar | Expansion passiert intern | |

**User's choice:** Ja, im Response anzeigen
**Notes:** Keine

### Abschaltbarkeit

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, abschaltbar (Empfohlen) | expand: true/false Parameter in SearchRequest | ✓ |
| Immer aktiv | Kein Toggle | |

**User's choice:** Ja, abschaltbar
**Notes:** Keine

---

## Chunking Strategy

### Granularitaet

| Option | Description | Selected |
|--------|-------------|----------|
| Absatz + Satz (Empfohlen) | Chunks an Absatz- UND Satz-Grenzen, Typen: paragraph/absatz/satz | ✓ |
| Absatz + Satz + Nummer | Zusaetzlich Aufzaehlungspunkte als eigene Chunks | |
| Nur Absatz-Grenzen | Wie aktuell, aber 800-Zeichen-Schwellenwert entfernen | |

**User's choice:** Absatz + Satz
**Notes:** Keine

### Umgang mit Alt-Chunks

| Option | Description | Selected |
|--------|-------------|----------|
| Beibehalten + neue dazu (Empfohlen) | Volle Paragraphen-Chunks bleiben, granularere kommen dazu | ✓ |
| Ersetzen | Alte durch neue ersetzen | |
| Du entscheidest | Claude analysiert und waehlt | |

**User's choice:** Beibehalten + neue dazu
**Notes:** Keine

### Schwellenwert-Konfiguration

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, per ENV (Empfohlen) | CHUNK_MIN_LENGTH_FOR_SPLIT und CHUNK_SATZ_MIN_LENGTH als ENV-Variablen | ✓ |
| Fester Wert | 800 Zeichen hardcoded | |

**User's choice:** Ja, per ENV
**Notes:** Keine

---

## Multi-Hop MCP

### Architektur

| Option | Description | Selected |
|--------|-------------|----------|
| MCP Prompt-Template (Empfohlen) | Claude orchestriert die Kette selbst via Prompt-Anleitung | |
| Server-seitiger Chain | Backend-Endpoint kettet intern | |
| Beides | MCP-Prompt fuer Claude UND Backend-Endpoint fuer REST | ✓ |

**User's choice:** Beides
**Notes:** Keine

### Traversal-Tiefe

| Option | Description | Selected |
|--------|-------------|----------|
| 1 Hop (Empfohlen) | Default, einfach und schnell | |
| Bis zu 2 Hops | Transitive Zusammenhaenge | |
| Konfigurierbar per ENV | MULTI_HOP_MAX_DEPTH als ENV-Variable | |

**User's choice:** Bis zu 3 Hops. 1 als Default, aber sowohl in API, MCP und ENV einstellbar.
**Notes:** User wollte explizit Maximum 3 statt 2, und Konfigurierbarkeit auf allen Ebenen (ENV, API, MCP)

### Prompt-Templates

| Option | Description | Selected |
|--------|-------------|----------|
| Rechtsanalyse (paragraf_legal_analysis) | Suche + Querverweise + Zusammenfassung | ✓ |
| Normenkette (paragraf_norm_chain) | Querverweis-Kette ab Startparagraph verfolgen | ✓ |
| Rechtsvergleich (paragraf_compare_areas) | Parallele Suche in mehreren Rechtsgebieten | ✓ |

**User's choice:** Alle drei
**Notes:** Keine

---

## Claude's Discretion

- Interne Implementierung der parallelen Expansion-Strategie
- Satz-Erkennung im Parser
- Multi-Hop Response-Format
- Error Handling bei zirkulaeren Querverweisen
- Pydantic-Modell-Namen
- Reranking bei Multi-Hop-Ergebnissen

## Deferred Ideas

None — discussion stayed within phase scope.

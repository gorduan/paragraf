# Phase 16: Model Download & GPU Configuration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 16-model-download-gpu-configuration
**Areas discussed:** Download-Erlebnis, GPU-Erkennung & Wechsel, Cache-Verwaltung, Fehlerbehandlung

---

## Download-Erlebnis

### Wann soll der Model-Download starten?

| Option | Description | Selected |
|--------|-------------|----------|
| Im Setup-Wizard | Download als eigener Wizard-Schritt (nach Docker-Check, vor Abschluss). SetupWizard.tsx hat bereits die Schritt-Logik. | ✓ |
| Beim ersten API-Aufruf | Backend laedt Modelle lazy beim ersten Embedding-/Reranker-Aufruf. HealthOverlay zeigt 'Modelle werden geladen'. | |
| Nach Setup im Hintergrund | Setup schliesst ab, App startet sofort. Download laeuft im Hintergrund. | |

**User's choice:** Im Setup-Wizard (Recommended)
**Notes:** --

### Soll ein abgebrochener Download fortsetzbar sein (Resume)?

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, Resume-Support | Bei Abbruch oder Neustart setzt Download dort fort wo er aufgehoert hat. HuggingFace Hub Range-Requests. | ✓ |
| Nein, Neustart bei Abbruch | Bei Abbruch wird partieller Download geloescht und neu gestartet. | |

**User's choice:** Ja, Resume-Support (Recommended)
**Notes:** --

### Wie soll der Download-Fortschritt kommuniziert werden?

| Option | Description | Selected |
|--------|-------------|----------|
| Einzelner Gesamtbalken | Ein Fortschrittsbalken fuer den gesamten Download (~4GB). Darunter: aktuelles Modell, Geschwindigkeit, Restzeit. | |
| Pro-Modell-Balken | Zwei separate Fortschrittsbalken (Embedding ~3.2GB + Reranker ~0.8GB). Mehr Detail. | ✓ |

**User's choice:** Pro-Modell-Balken
**Notes:** --

### Soll der Nutzer den Download ueberspringen koennen?

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, 'Spaeter fortsetzen' | Button zum Ueberspringen. App startet, Suche deaktiviert bis Modelle da. | |
| Nein, Download ist Pflicht | Wizard blockiert bis Download fertig. Ohne Modelle funktioniert nichts. | ✓ |

**User's choice:** Nein, Download ist Pflicht (Recommended)
**Notes:** --

---

## GPU-Erkennung & Wechsel

### Wie soll die GPU-Erkennung ablaufen?

| Option | Description | Selected |
|--------|-------------|----------|
| Automatisch im Wizard | Nach Model-Download prueft Wizard GPU-Verfuegbarkeit (nvidia-smi im Container). Empfehlung bei Fund. | ✓ |
| Automatisch beim Backend-Start | Backend erkennt GPU selbststaendig. Kein Wizard-Schritt. Ergebnis in Settings. | |
| Nur in den Settings | Keine automatische Erkennung. Nutzer prueft manuell. | |

**User's choice:** Automatisch im Wizard (Recommended)
**Notes:** --

### Wie soll der CPU/GPU-Wechsel in den Settings funktionieren?

| Option | Description | Selected |
|--------|-------------|----------|
| Docker-Neustart mit Feedback | Toggle in Settings. Docker Compose Neustart mit/ohne GPU-Override. HealthOverlay zeigt Status. | ✓ |
| Hot-Swap ohne Neustart | Backend laedt Modelle zur Laufzeit um (torch .to(device)). Riskant. | |
| Nur per docker-compose.gpu.yml | Kein UI-Toggle. Manueller Compose-Override. | |

**User's choice:** Docker-Neustart mit Feedback (Recommended)
**Notes:** --

---

## Cache-Verwaltung

### Wie soll die Cache-Verwaltung in den Settings aussehen?

| Option | Description | Selected |
|--------|-------------|----------|
| Info-Karte mit Aktionen | Pfad (read-only), Groesse, Loeschen-Button. Kompakt. | |
| Minimale Anzeige | Nur Pfad und Gesamtgroesse. Loeschen-Button. | |
| Erweitert mit Pfad-Aenderung | Wie Info-Karte + Pfad nachtraeglich aenderbar (Ordner-Dialog). Modelle verschoben/neu heruntergeladen. | ✓ |

**User's choice:** Erweitert mit Pfad-Aenderung
**Notes:** --

### Was soll beim Loeschen des Caches passieren?

| Option | Description | Selected |
|--------|-------------|----------|
| Bestaetigung + auto Re-Download | Dialog mit Warnung. Cache leeren, naechster Start zeigt Download-Schritt erneut. | ✓ |
| Loeschen + sofortiger Re-Download | Cache geloescht, Download startet sofort in Settings. | |
| Nur loeschen, kein Auto-Download | Cache geloescht. Nutzer muss manuell neu downloaden. | |

**User's choice:** Bestaetigung + automatischer Re-Download (Recommended)
**Notes:** --

---

## Fehlerbehandlung

### Was soll bei Netzwerk-Abbruch waehrend des Model-Downloads passieren?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-Retry + Resume | 3x Retry mit Backoff + Resume-Support. Danach Fehlermeldung mit "Erneut versuchen". | ✓ |
| Sofort Fehler zeigen | Kein automatischer Retry. Fehlermeldung sofort. | |
| Unbegrenzt Retry | Endlose Versuche solange Wizard offen. | |

**User's choice:** Auto-Retry + Resume (Recommended)
**Notes:** --

### Was soll passieren wenn GPU-Wechsel fehlschlaegt?

| Option | Description | Selected |
|--------|-------------|----------|
| Automatisch auf CPU zurueckfallen | CPU-Fallback mit Hinweis. Settings zeigt CPU. | ✓ |
| Fehlermeldung ohne Fallback | Fehlerdetails, manueller Rueckwechsel. | |

**User's choice:** Automatisch auf CPU zurueckfallen (Recommended)
**Notes:** --

### Was bei zu wenig Speicherplatz fuer den Download?

| Option | Description | Selected |
|--------|-------------|----------|
| Vorab pruefen + Warnung | Freien Platz pruefen vor Download. Warnung wenn <5GB. Option "Pfad aendern" oder "Trotzdem versuchen". | ✓ |
| Erst beim Fehler reagieren | Kein Vorab-Check. Fehlermeldung bei Speichermangel. | |

**User's choice:** Vorab pruefen + Warnung (Recommended)
**Notes:** --

---

## Claude's Discretion

- Technische Implementierung des Resume-Supports (HuggingFace Hub API vs. eigene Range-Request-Logik)
- Exakte Wizard-Schritt-Nummerierung und -Integration
- Backend-API-Design fuer Download-Fortschritt (SSE-Stream vs. Polling)
- Docker Compose GPU-Override-Mechanismus

## Deferred Ideas

None -- discussion stayed within phase scope

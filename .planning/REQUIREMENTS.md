# Requirements: Paragraf v2 -- Desktop Installer

**Defined:** 2026-03-29
**Core Value:** Juristen und Buerger installieren Paragraf mit einem Doppelklick -- ohne CLI, ohne Docker-Kenntnisse, ohne technisches Vorwissen.

## v2.0 Requirements

Requirements fuer dieses Milestone. Jedes mapped zu Roadmap-Phasen.

### Desktop Shell

- [x] **SHELL-01**: Nutzer sieht die Paragraf-App in einem eigenen Desktop-Fenster (Electron) mit nativer Titelleiste
- [x] **SHELL-02**: App erscheint im Windows-Startmenue mit Icon und kann per Doppelklick gestartet werden
- [x] **SHELL-03**: Nur eine Instanz der App kann gleichzeitig laufen (Single-Instance Lock)
- [ ] **SHELL-04**: App minimiert sich in den System Tray und laeuft im Hintergrund weiter

### Installer & Setup

- [x] **INST-01**: Grafischer Windows-Installer (.exe) mit Willkommens-Screen, Lizenz, Installationspfad-Auswahl
- [ ] **INST-02**: Setup-Wizard bietet Installationsmodus-Auswahl: "Docker (Empfohlen)" vs "Nativ (Spaeter)"
- [x] **INST-03**: Docker-Modus: Installer prueft ob Docker Desktop installiert ist und leitet zur Installation weiter falls noetig
- [ ] **INST-04**: Erster App-Start zeigt Setup-Wizard mit Fortschrittsanzeige fuer alle Einrichtungsschritte
- [x] **INST-05**: Setup-Wizard zeigt geschaetzten Speicherbedarf vor Download an und kann nach Unterbrechung fortgesetzt werden

### Backend Lifecycle

- [x] **LIFE-01**: Backend (Docker Compose) startet automatisch beim App-Start und stoppt beim Schliessen
- [x] **LIFE-02**: App zeigt Verbindungsstatus zum Backend (Health-Polling) mit visueller Anzeige
- [ ] **LIFE-03**: Bei Port-Konflikten erkennt die App das Problem und bietet Loesung an
- [ ] **LIFE-04**: Bei Backend-Absturz versucht die App automatisch einen Neustart (max 3 Versuche)

### Model & GPU Management

- [x] **MODEL-01**: ML-Modelle (~4GB) werden beim ersten Start automatisch heruntergeladen mit Fortschrittsbalken
- [x] **MODEL-02**: GPU/CUDA wird automatisch erkannt und konfiguriert (nvidia-smi + torch.cuda)
- [x] **MODEL-03**: Nutzer kann zwischen CPU und GPU zur Laufzeit wechseln (Settings)
- [x] **MODEL-04**: Model-Cache kann in den Einstellungen verwaltet werden (Pfad, Groesse, Loeschen)

### Documentation & Beta Release

- [ ] **DOC-01**: Version auf 0.9-beta geaendert in allen relevanten Dateien (pyproject.toml, package.json, __init__.py, CLAUDE.md, .env.example)
- [ ] **DOC-02**: README.md komplett neu geschrieben als sachliche Projekt-Uebersicht mit Links zu Guides (kein Marketing)
- [ ] **DOC-03**: INSTALLATION.md erstellt mit Schritt-fuer-Schritt Docker-Anleitung, GPU-Setup, lokaler Entwicklung, Troubleshooting
- [ ] **DOC-04**: API.md erstellt mit allen REST-Endpoints, curl-Beispielen, gruppiert nach Funktion
- [ ] **DOC-05**: MCP.md erstellt als wichtigster Guide mit Setup fuer Claude Desktop/Code, alle 14 MCP-Tools mit Beispiel-Prompts

## v2.1 Requirements (Deferred)

### Native Mode (Docker-free)

- **NATIVE-01**: python-build-standalone Bootstrap mit pip install fuer Backend-Dependencies
- **NATIVE-02**: Qdrant-Binary-Management (Download, Start, Stop, Update)
- **NATIVE-03**: Automatische Python/Qdrant-Updates bei neuen Versionen

### Distribution & Polish

- **DIST-01**: Auto-Update via electron-updater (Check + Download + Install)
- **DIST-02**: Code Signing Certificate fuer Windows SmartScreen-Kompatibilitaet
- **DIST-03**: macOS DMG Installer
- **DIST-04**: Linux AppImage Installer

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native Mode in v2.0 | Zu hohes Risiko (PyInstaller/python-build-standalone Edge Cases), Docker-Friction erst messen |
| Mac/Linux Installer in v2.0 | Windows-first, andere Plattformen nutzen docker compose direkt |
| Auto-Update in v2.0 | Braucht Code Signing, eigene Phase in v2.1 |
| Bundled ML-Modelle im Installer | NSIS 2GB Limit, Modelle muessen post-install heruntergeladen werden |
| PyInstaller fuer Python-Bundling | Antivirus False Positives, Zombie-Prozesse, 3-5GB Bundles -- python-build-standalone ist besser |
| Tauri als Desktop-Shell | NSIS 2GB Limit bei nativer Bundling-Strategie, Rust-Toolchain-Requirement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 14 | Complete |
| SHELL-02 | Phase 14 | Complete |
| SHELL-03 | Phase 14 | Complete |
| SHELL-04 | Phase 17 | Pending |
| INST-01 | Phase 15 | Complete |
| INST-02 | Phase 15 | Pending |
| INST-03 | Phase 15 | Complete |
| INST-04 | Phase 15 | Pending |
| INST-05 | Phase 15 | Complete |
| LIFE-01 | Phase 14 | Complete |
| LIFE-02 | Phase 14 | Complete |
| LIFE-03 | Phase 17 | Pending |
| LIFE-04 | Phase 17 | Pending |
| MODEL-01 | Phase 16 | Complete |
| MODEL-02 | Phase 16 | Complete |
| MODEL-03 | Phase 16 | Complete |
| MODEL-04 | Phase 16 | Complete |
| DOC-01 | Phase 18 | Pending |
| DOC-02 | Phase 18 | Pending |
| DOC-03 | Phase 18 | Pending |
| DOC-04 | Phase 18 | Pending |
| DOC-05 | Phase 18 | Pending |

**Coverage:**
- v2.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-29*
*Traceability updated: 2026-04-01*

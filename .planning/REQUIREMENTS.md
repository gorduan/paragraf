# Requirements: Paragraf v2 -- Desktop Installer

**Defined:** 2026-03-29
**Core Value:** Juristen und Buerger installieren Paragraf mit einem Doppelklick -- ohne CLI, ohne Docker-Kenntnisse, ohne technisches Vorwissen.

## v2.0 Requirements

Requirements fuer dieses Milestone. Jedes mapped zu Roadmap-Phasen.

### Desktop Shell

- [ ] **SHELL-01**: Nutzer sieht die Paragraf-App in einem eigenen Desktop-Fenster (Electron) mit nativer Titelleiste
- [ ] **SHELL-02**: App erscheint im Windows-Startmenue mit Icon und kann per Doppelklick gestartet werden
- [ ] **SHELL-03**: Nur eine Instanz der App kann gleichzeitig laufen (Single-Instance Lock)
- [ ] **SHELL-04**: App minimiert sich in den System Tray und laeuft im Hintergrund weiter

### Installer & Setup

- [ ] **INST-01**: Grafischer Windows-Installer (.exe) mit Willkommens-Screen, Lizenz, Installationspfad-Auswahl
- [ ] **INST-02**: Setup-Wizard bietet Installationsmodus-Auswahl: "Docker (Empfohlen)" vs "Nativ (Spaeter)"
- [ ] **INST-03**: Docker-Modus: Installer prueft ob Docker Desktop installiert ist und leitet zur Installation weiter falls noetig
- [ ] **INST-04**: Erster App-Start zeigt Setup-Wizard mit Fortschrittsanzeige fuer alle Einrichtungsschritte
- [ ] **INST-05**: Setup-Wizard zeigt geschaetzten Speicherbedarf vor Download an und kann nach Unterbrechung fortgesetzt werden

### Backend Lifecycle

- [ ] **LIFE-01**: Backend (Docker Compose) startet automatisch beim App-Start und stoppt beim Schliessen
- [ ] **LIFE-02**: App zeigt Verbindungsstatus zum Backend (Health-Polling) mit visueller Anzeige
- [ ] **LIFE-03**: Bei Port-Konflikten erkennt die App das Problem und bietet Loesung an
- [ ] **LIFE-04**: Bei Backend-Absturz versucht die App automatisch einen Neustart (max 3 Versuche)

### Model & GPU Management

- [ ] **MODEL-01**: ML-Modelle (~4GB) werden beim ersten Start automatisch heruntergeladen mit Fortschrittsbalken
- [ ] **MODEL-02**: GPU/CUDA wird automatisch erkannt und konfiguriert (nvidia-smi + torch.cuda)
- [ ] **MODEL-03**: Nutzer kann zwischen CPU und GPU zur Laufzeit wechseln (Settings)
- [ ] **MODEL-04**: Model-Cache kann in den Einstellungen verwaltet werden (Pfad, Groesse, Loeschen)

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
| SHELL-01 | TBD | Pending |
| SHELL-02 | TBD | Pending |
| SHELL-03 | TBD | Pending |
| SHELL-04 | TBD | Pending |
| INST-01 | TBD | Pending |
| INST-02 | TBD | Pending |
| INST-03 | TBD | Pending |
| INST-04 | TBD | Pending |
| INST-05 | TBD | Pending |
| LIFE-01 | TBD | Pending |
| LIFE-02 | TBD | Pending |
| LIFE-03 | TBD | Pending |
| LIFE-04 | TBD | Pending |
| MODEL-01 | TBD | Pending |
| MODEL-02 | TBD | Pending |
| MODEL-03 | TBD | Pending |
| MODEL-04 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 16 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 16

---
*Requirements defined: 2026-03-29*

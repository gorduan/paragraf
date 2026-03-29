# Roadmap: Paragraf v2

## Milestones

- **v1.0 Volles Qdrant-Potenzial** -- Phases 1-13 (shipped 2026-03-29) | [Archive](milestones/v1.0-ROADMAP.md)
- **v2.0 Desktop Installer** -- Phases 14-17 (in progress)

## Phases

<details>
<summary>v1.0 Volles Qdrant-Potenzial (Phases 1-13) -- SHIPPED 2026-03-29</summary>

- [x] Phase 1: Snapshot Safety Net (2/2 plans) -- completed 2026-03-27
- [x] Phase 2: Search Indexes & Full-Text (2/2 plans) -- completed 2026-03-27
- [x] Phase 3: Design System Foundation (2/2 plans) -- completed 2026-03-27
- [x] Phase 4: Recommend & Pagination (3/3 plans) -- completed 2026-03-27
- [x] Phase 5: Grouping & Discovery API (3/3 plans) -- completed 2026-03-27
- [x] Phase 6: Cross-Reference Pipeline (3/3 plans) -- completed 2026-03-27
- [x] Phase 7: Query Expansion & Chunking (3/3 plans) -- completed 2026-03-27
- [x] Phase 8: Search Results UX (3/3 plans) -- completed 2026-03-27
- [x] Phase 9: Cross-Reference & Discovery UX (5/5 plans) -- completed 2026-03-28
- [x] Phase 10: Dashboard, Export & Polish (3/3 plans) -- completed 2026-03-28
- [x] Phase 11: Frontend API Wiring (2/2 plans) -- completed 2026-03-28
- [x] Phase 12: Search UX Polish (1/1 plan) -- completed 2026-03-28
- [x] Phase 13: Tracking Artifact Cleanup (1/1 plan) -- completed 2026-03-29

</details>

### v2.0 Desktop Installer

**Milestone Goal:** Paragraf wird eine installierbare Desktop-App mit grafischem Installer fuer Windows. Zielgruppe: absolute Anfaenger ohne CLI-Kenntnisse. Docker-Modus als einziger Backend-Modus in v2.0.

- [x] **Phase 14: Electron Shell & Docker Lifecycle** - Desktop-Fenster mit Backend-Management via Docker Compose (completed 2026-03-29)
- [ ] **Phase 15: Windows Installer & Setup Wizard** - NSIS-Installer mit First-Run-Wizard und Docker-Erkennung
- [ ] **Phase 16: Model Download & GPU Configuration** - ML-Modell-Download mit Fortschritt und automatische GPU-Erkennung
- [ ] **Phase 17: System Tray & Crash Resilience** - Tray-Minimierung, Port-Konflikt-Erkennung und automatischer Neustart

## Phase Details

### Phase 14: Electron Shell & Docker Lifecycle
**Goal**: Nutzer startet Paragraf als Desktop-App, die den Docker-Backend-Stack automatisch hochfaehrt und beim Schliessen sauber herunterfaehrt
**Depends on**: Phase 13 (v1.0 complete)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, LIFE-01, LIFE-02
**Success Criteria** (what must be TRUE):
  1. Nutzer sieht die Paragraf-App in einem eigenen Desktop-Fenster mit nativer Titelleiste und kann die React-SPA darin bedienen
  2. App erscheint im Windows-Startmenue mit Paragraf-Icon und startet per Doppelklick
  3. Beim Versuch eine zweite Instanz zu starten, wird stattdessen das bestehende Fenster in den Vordergrund geholt
  4. Backend (Docker Compose) startet automatisch beim App-Start und stoppt sauber beim Schliessen (keine Zombie-Prozesse)
  5. App zeigt visuell an ob das Backend verbunden ist, laedt oder einen Fehler hat (Health-Polling)
**Plans**: 2 plans

Plans:
- [x] 14-01-PLAN.md — Electron project scaffold, window shell, single-instance lock
- [x] 14-02-PLAN.md — Docker Compose lifecycle, IPC handlers, HealthOverlay desktop adaptation

### Phase 15: Windows Installer & Setup Wizard
**Goal**: Nutzer installiert Paragraf mit einem grafischen Windows-Installer und wird beim ersten Start durch einen Setup-Wizard gefuehrt, der Docker erkennt und alle Voraussetzungen prueft
**Depends on**: Phase 14
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05
**Success Criteria** (what must be TRUE):
  1. Nutzer kann einen .exe-Installer ausfuehren mit Willkommens-Screen, Lizenz-Anzeige und Installationspfad-Auswahl
  2. Setup-Wizard bietet "Docker (Empfohlen)" als Installationsmodus an (Native ausgegraut mit "Kommt spaeter"-Hinweis)
  3. Installer prueft ob Docker Desktop installiert ist und leitet bei Bedarf zur Docker-Installation weiter
  4. Erster App-Start zeigt einen mehrstufigen Setup-Wizard mit Fortschrittsanzeige fuer alle Einrichtungsschritte
  5. Setup-Wizard zeigt geschaetzten Speicherbedarf an und kann nach Unterbrechung (Abbruch, Neustart) dort weitermachen wo er aufgehoert hat
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 15-01-PLAN.md — NSIS installer config, electron-store, Docker detection, IPC handlers, preload bridge
- [ ] 15-02-PLAN.md — React setup wizard UI (5 steps), App.tsx first-run routing, deferred Docker startup

### Phase 16: Model Download & GPU Configuration
**Goal**: ML-Modelle werden beim ersten Start automatisch heruntergeladen und GPU/CUDA wird erkannt und konfiguriert, sodass Nutzer ohne Eingriff die optimale Performance erhalten
**Depends on**: Phase 15
**Requirements**: MODEL-01, MODEL-02, MODEL-03, MODEL-04
**Success Criteria** (what must be TRUE):
  1. ML-Modelle (~4GB) werden beim ersten Start automatisch heruntergeladen mit Fortschrittsbalken, Geschwindigkeit und geschaetzter Restzeit
  2. GPU/CUDA wird automatisch erkannt (nvidia-smi + torch.cuda) und die App konfiguriert sich selbststaendig fuer GPU-Nutzung
  3. Nutzer kann in den Einstellungen zwischen CPU und GPU wechseln ohne Neuinstallation
  4. Nutzer kann in den Einstellungen den Model-Cache verwalten (Pfad einsehen, Groesse anzeigen, Cache loeschen)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD

### Phase 17: System Tray & Crash Resilience
**Goal**: App laeuft zuverlaessig im Hintergrund weiter und erholt sich automatisch von Backend-Abstuerzen und Port-Konflikten
**Depends on**: Phase 14
**Requirements**: SHELL-04, LIFE-03, LIFE-04
**Success Criteria** (what must be TRUE):
  1. App minimiert sich in den System Tray und laeuft im Hintergrund weiter mit Status-Icon und Rechtsklick-Menue
  2. Bei Port-Konflikten (8000 oder 6333 belegt) erkennt die App das Problem und bietet dem Nutzer eine Loesung an
  3. Bei Backend-Absturz versucht die App automatisch einen Neustart (max 3 Versuche) mit visuellem Feedback
**Plans**: TBD

Plans:
- [ ] 17-01: TBD
- [ ] 17-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 > 15 > 16 > 17
(Phase 17 depends on Phase 14, not Phase 16 -- can theoretically run after Phase 14, but sequenced last for polish)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. Electron Shell & Docker Lifecycle | v2.0 | 2/2 | Complete    | 2026-03-29 |
| 15. Windows Installer & Setup Wizard | v2.0 | 1/2 | In Progress|  |
| 16. Model Download & GPU Configuration | v2.0 | 0/2 | Not started | - |
| 17. System Tray & Crash Resilience | v2.0 | 0/2 | Not started | - |

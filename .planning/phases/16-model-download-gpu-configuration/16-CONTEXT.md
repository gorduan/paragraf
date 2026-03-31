# Phase 16: Model Download & GPU Configuration - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

ML-Modelle (~4GB) werden beim ersten Start automatisch heruntergeladen und GPU/CUDA wird erkannt und konfiguriert, sodass Nutzer ohne Eingriff die optimale Performance erhalten. Umfasst: Download mit Fortschritt im Setup-Wizard, automatische GPU-Erkennung, CPU/GPU-Wechsel in den Settings, und Cache-Verwaltung (Pfad, Groesse, Loeschen).

</domain>

<decisions>
## Implementation Decisions

### Download-Erlebnis
- **D-01:** Model-Download findet als eigener Schritt im Setup-Wizard statt (nach Docker-Check, vor GPU-Erkennung). Download ist Pflicht -- Wizard blockiert bis alle Modelle heruntergeladen sind.
- **D-02:** Fortschrittsanzeige zeigt **pro-Modell-Balken** (BAAI/bge-m3 + BAAI/bge-reranker-v2-m3 separat). Jeder Balken zeigt: Modellname, Fortschritt in %, heruntergeladene/gesamte GB, Geschwindigkeit, geschaetzte Restzeit.
- **D-03:** Download unterstuetzt **Resume** -- bei Abbruch oder Neustart setzt der Download dort fort wo er aufgehoert hat (HuggingFace Hub Range-Requests).

### GPU-Erkennung & Wechsel
- **D-04:** GPU-Erkennung erfolgt **automatisch im Setup-Wizard** als Schritt nach dem Model-Download. Prueft nvidia-smi im Container. Wenn GPU erkannt: Nutzer kann GPU-Modus aktivieren (empfohlen) oder CPU beibehalten. Wenn keine GPU: stille Weiterarbeit auf CPU.
- **D-05:** CPU/GPU-Wechsel in den Settings via **Docker-Neustart mit Feedback**. Toggle in SettingsPage, beim Wechsel wird Docker Compose mit/ohne GPU-Override neu gestartet. HealthOverlay zeigt "Backend wird neu gestartet..." waehrend des Wechsels (~30s).

### Cache-Verwaltung
- **D-06:** Erweiterter Cache-Bereich in SettingsPage: Pfad anzeigen, Groesse in GB, Aufschluesselung pro Modell (Name + Groesse + Status), **Pfad nachtraeglich aenderbar** (Ordner-Dialog, Modelle werden verschoben/neu heruntergeladen).
- **D-07:** Cache-Loeschen mit **Bestaetigungsdialog** ("Modelle werden geloescht, beim naechsten Start automatisch neu heruntergeladen"). Nach Bestaetigung: Cache leeren, beim naechsten App-Start Download-Schritt erneut anzeigen.

### Fehlerbehandlung
- **D-08:** Netzwerk-Abbruch waehrend Download: **Auto-Retry** (3 Versuche mit Backoff) + Resume-Support. Nach 3 Fehlversuchen: Fehlermeldung mit "Erneut versuchen"-Button.
- **D-09:** GPU-Wechsel fehlschlaegt: **automatischer Fallback auf CPU**. Nutzer bekommt Hinweis "GPU-Modus konnte nicht aktiviert werden. CPU-Modus wird verwendet." Settings zeigt weiterhin CPU.
- **D-10:** Speicherplatz-Pruefung **vor dem Download**: freien Platz am Cache-Pfad pruefen. Wenn <5GB frei: Warnung mit aktuellem/benoetigtem Platz, Option "Pfad aendern" oder "Trotzdem versuchen".

### Claude's Discretion
- Technische Implementierung des Resume-Supports (HuggingFace Hub API vs. eigene Range-Request-Logik)
- Exakte Wizard-Schritt-Nummerierung und -Integration in bestehenden SetupWizard.tsx
- Backend-API-Design fuer Download-Fortschritt (SSE-Stream vs. Polling)
- Docker Compose GPU-Override-Mechanismus (Environment-Variable vs. Compose-File-Wechsel)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bestehender Setup-Wizard & Electron-IPC
- `desktop/src/main/ipc.ts` -- Setup-Wizard IPC-Handler (modelCachePath, storageEstimate, startDocker, selectModelCachePath)
- `desktop/src/main/store.ts` -- Persistenter App-Store (SetupState mit modelCachePath, setupStep, setupComplete)
- `frontend/src/components/SetupWizard.tsx` -- Bestehender Setup-Wizard mit Docker-Check und Storage-Schritt
- `desktop/src/preload/index.ts` -- Preload-Bridge (selectModelCachePath IPC)

### Model-Download & Embedding-Service
- `backend/scripts/download_models.py` -- Bestehender Pre-Download-Script (kein Fortschritt, kein Streaming)
- `backend/src/paragraf/services/embedding.py` -- EmbeddingService mit FlagEmbedding/sentence-transformers Fallback
- `backend/src/paragraf/config.py` -- Settings mit embedding_device, embedding_model

### GPU & Docker
- `docker-compose.gpu.yml` -- GPU-Override mit NVIDIA-Reservierung und EMBEDDING_DEVICE=cuda
- `docker-compose.desktop.yml` -- Desktop-Compose mit PARAGRAF_MODEL_CACHE Volume-Mount
- `backend/src/paragraf/api.py` -- /api/settings/gpu Endpoint (torch.cuda Erkennung)

### Frontend-Komponenten
- `frontend/src/pages/SettingsPage.tsx` -- Bestehende Settings mit GPU-Info-Anzeige
- `frontend/src/components/ProgressBar.tsx` -- Bestehende ProgressBar-Komponente
- `frontend/src/components/HealthOverlay.tsx` -- Health-Status-Overlay
- `frontend/src/lib/api.ts` -- REST-Client (gpuInfo, settings Endpoints)
- `frontend/src/types/electron.d.ts` -- Electron TypeScript-Typen (modelCachePath, selectModelCachePath)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SetupWizard.tsx` -- mehrstufiger Wizard mit Schritt-Navigation, kann um Download- und GPU-Schritte erweitert werden
- `ProgressBar.tsx` -- existierende Fortschrittsbalken-Komponente, wiederverwendbar fuer Model-Download
- `HealthOverlay.tsx` -- Status-Overlay, wiederverwendbar fuer Backend-Neustart-Feedback beim GPU-Wechsel
- `/api/settings/gpu` Endpoint -- GPU-Erkennung via torch.cuda bereits implementiert
- `electron-store` mit `modelCachePath` -- Cache-Pfad-Persistenz bereits vorhanden
- `selectModelCachePath` IPC -- Ordner-Dialog fuer Cache-Pfad bereits implementiert
- `download_models.py` -- Basislogik fuer Model-Download vorhanden, muss um Fortschritt/Resume erweitert werden

### Established Patterns
- Setup-Wizard-State ueber `electron-store` persistiert (setupStep, setupComplete)
- IPC-Handler-Pattern: `ipcMain.handle("setup:*")` in `ipc.ts`, Bridge in `preload/index.ts`
- Docker Compose Start/Stop ueber `docker.ts` Modul (startDockerCompose, stopDockerCompose)
- GPU-Override via separates Compose-File (`docker-compose.gpu.yml` mit `EMBEDDING_DEVICE=cuda`)
- Settings-Page ist Read-Only fuer env-basierte Config, aber Cache-Verwaltung braucht interaktive Aktionen

### Integration Points
- SetupWizard.tsx: neue Schritte (Download, GPU-Erkennung) einfuegen nach Docker-Check
- SettingsPage.tsx: Cache-Verwaltungssektion und CPU/GPU-Toggle hinzufuegen
- ipc.ts: neue IPC-Handler fuer Download-Fortschritt, GPU-Check, GPU-Switch, Cache-Loeschen
- docker.ts: GPU-Override-Logik (Compose-File-Auswahl basierend auf GPU-Setting)
- api.py/api_models.py: neuer Endpoint fuer Download-Fortschritt (SSE oder Polling)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 16-model-download-gpu-configuration*
*Context gathered: 2026-03-31*

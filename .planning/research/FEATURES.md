# Feature Landscape: Desktop Installer & Native App

**Domain:** Desktop installer and native app packaging for ML-heavy legal research application
**Researched:** 2026-03-29
**Overall confidence:** MEDIUM-HIGH
**Target user:** DAU (duemmster anzunehmender User) -- zero CLI knowledge, first contact with Docker/ML/GPU concepts

## Table Stakes

Features users expect from any installable desktop application. Missing any of these means the product feels broken or unfinished.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Graphical installer (.exe)** | Every Windows app has a double-click installer. Users will not run CLI commands. Period. | MEDIUM | Tauri bundler or NSIS/Inno Setup | Tauri 2 bundles NSIS by default for Windows. Installer size ~10MB (Tauri) vs ~80-150MB (Electron). |
| **Start Menu + Desktop shortcut** | Users expect to find the app where they find every other app. | LOW | Installer framework | Both Tauri and Electron installers create these automatically. |
| **First-run setup wizard** | App needs Docker OR native stack + 4GB ML models. Cannot silently fail on missing prerequisites. Ollama and LM Studio both guide users through first setup. | HIGH | Prerequisite detection logic | 3-5 screens max: Welcome > Mode selection > Prerequisites > Model download > Done. Must feel like installing any normal app. |
| **Installation mode selection (Docker vs Native)** | Docker requires WSL2 + Docker Desktop (~2GB). Native requires Qdrant binary + Python env. User must choose, but wizard must recommend. | HIGH | Docker detection, Qdrant binary bundling | Auto-detect Docker: check registry `HKLM\SOFTWARE\Docker Inc.\Docker Desktop` and `docker info` command. Recommend Docker if found, Native otherwise. |
| **ML model download with progress bar** | 4GB download (bge-m3 ~2GB + bge-reranker-v2-m3 ~2GB). Users need visual feedback or they think it crashed. LM Studio and Ollama both show download progress per model. | MEDIUM | HuggingFace Hub download, network access | Must support: progress percentage, speed display, ETA, pause/resume on network failure. HuggingFace Hub supports resumable downloads natively. |
| **Backend lifecycle management** | User clicks app icon, backend starts. User closes app, backend stops. No orphaned processes, no manual terminal management. | HIGH | Process spawning, health checks | Tauri sidecar pattern: spawn Python/Docker process, monitor health via `/api/health`, restart on crash. Must handle: clean shutdown, port conflicts, stale PID files. |
| **Health status indicator** | User needs to know: "Is it ready?" Existing HealthOverlay pattern already handles this for the web app, must carry over to desktop. | LOW | Existing `/api/health` endpoint | Reuse existing `useHealthCheck` hook. Show loading states during model initialization (~30-60s on CPU). |
| **Uninstaller** | Clean removal of app, models, data. Windows "Apps & Features" integration. | LOW | Installer framework | Tauri/NSIS handle this. Must ask: "Delete downloaded models and law data?" (they are large). |
| **Error messages in German** | Target audience is German-speaking non-technical users. English error messages are a dead end. | LOW | Existing i18n pattern | App already uses German throughout. Extend to installer and setup wizard screens. |

## Differentiators

Features that elevate the installer experience beyond "it works" to "this is polished." Not expected, but users notice and appreciate them.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Automatic GPU/CUDA detection** | User should never need to know what CUDA is. App detects NVIDIA GPU, checks for CUDA toolkit (`nvidia-smi` or `$CUDA_PATH` env var), and auto-configures `EMBEDDING_DEVICE=cuda`. Inference 5-10x faster on GPU. | MEDIUM | NVIDIA driver detection | Check: (1) `nvidia-smi` command available, (2) CUDA version compatible with PyTorch. If Docker mode: auto-apply `docker-compose.gpu.yml` overlay. If native: install PyTorch+CUDA wheel. Show "GPU erkannt: NVIDIA RTX 3060" in wizard. |
| **System tray with backend status** | App runs in background like Discord/Slack. Tray icon shows: green (ready), yellow (loading models), red (error). Right-click: Open, Restart Backend, Quit. | MEDIUM | Tauri system tray plugin | Tauri 2 has built-in `tray-icon` plugin. Prevents users from accidentally closing the backend by closing the window. |
| **Auto-update mechanism** | App checks for updates on startup, downloads in background, prompts to restart. No manual re-download from website. | MEDIUM | Update server (GitHub Releases) | Tauri 2 has built-in `tauri-plugin-updater`. Supports GitHub Releases as update source. Code signing required for Windows (self-signed OK for internal use). |
| **One-click Docker prerequisite install** | If Docker not found, offer to download and install Docker Desktop automatically. Guide through WSL2 enablement if needed. Reduces "installation failed" to near zero for Docker mode. | HIGH | Docker Desktop installer, WSL2 detection | Docker Desktop installer can enable WSL2 automatically. Check WSL2: `wsl --status`. Biggest friction point: Windows restart may be required after WSL2 enablement. Must handle this gracefully. |
| **Model management UI** | Show which models are downloaded, their size, GPU/CPU status. Allow re-download if corrupt. Show cache location. Inspired by LM Studio's model management. | MEDIUM | HuggingFace cache introspection | Check `~/.cache/huggingface/hub/` for model directories. Show: model name, size on disk, download date. "Modelle neu herunterladen" button. |
| **Smart storage location selection** | Let user pick where to store models and law data (default: app data folder). Important because 4GB+ models should not go on a small C: drive. LM Studio lets users choose model directory. | LOW | Installer config | Folder picker in setup wizard. Store path in app config. Pass as volume mount (Docker) or env var (native). |
| **Offline-ready after first setup** | After initial model download and law indexing, app works fully offline. No internet required for search. Important for law firms with restricted networks. | LOW | Already the case architecturally | Just needs to be communicated clearly in UI. "Alle Daten lokal -- keine Internetverbindung noetig." |
| **Single-instance enforcement** | Prevent user from launching 2 instances (port conflicts, double resource usage). | LOW | Tauri single-instance plugin | `tauri-plugin-single-instance`. Show existing window if user clicks icon again. |
| **Startup on Windows login (optional)** | For power users who want the backend always ready. Off by default. | LOW | Tauri autostart plugin | `tauri-plugin-autostart`. Registry-based autostart on Windows. |

## Anti-Features

Features to explicitly NOT build. Each would add complexity without proportional value, or would actively harm the user experience.

| Anti-Feature | Why Tempting | Why Avoid | What to Do Instead |
|--------------|-------------|-----------|-------------------|
| **Custom Python environment manager** | "Bundle Python with the installer for native mode" | Python + pip + torch + all dependencies = nightmare of version conflicts, antivirus false positives, PATH corruption. PyInstaller bundles are 2-5GB and fragile with torch. PyOxidizer is experimental and struggles with complex dependency trees like torch+transformers. | Docker mode as primary recommendation. Native mode uses pre-built Qdrant binary + user's existing Python (detected, not installed). If no Python: strongly push Docker. |
| **Silent/unattended install** | "IT admins want to deploy silently" | Single-user local tool. No enterprise deployment scenario exists. Silent install skips the mode selection and model download which are essential. | Not in scope. If needed later, Tauri/NSIS support `/S` flag natively. |
| **Mac/Linux installer in v2.0** | "Cross-platform from day one" | Doubles or triples installer testing surface. Docker on Mac has its own issues (Colima vs Docker Desktop). Linux has dozens of package formats. Windows is the stated primary target. | Windows-only for v2.0. Mac/Linux users can still use `docker compose up` directly. Add platform support in v3.0 once the installer UX is proven. |
| **Bundled Qdrant inside app** | "Avoid separate Qdrant process" | Qdrant is a Rust binary. Embedding it means building Qdrant from source or shipping a 50MB+ binary. Docker already handles this cleanly. Native mode can download the standalone `qdrant.exe` from GitHub Releases (~25MB, single file). | Docker: Qdrant as container. Native: download `qdrant.exe` from `github.com/qdrant/qdrant/releases` and manage as sidecar process. |
| **Web-based installer** | "Install via browser download + web setup wizard" | Adds a web server dependency before the app is even installed. Confusing UX -- is the app running or not? | Traditional desktop installer (.exe). Web app is what runs AFTER installation. |
| **Automatic law indexing during install** | "Index all 95 laws during setup so app is ready immediately" | Indexing takes 15-60 minutes depending on hardware. User will think installer is frozen. Mixing install with heavy compute is bad UX. | Install first, index later. After first launch, show dashboard with "Gesetze indexieren" button. Separate concerns. |
| **Docker Compose GUI** | "Build a visual Docker Compose manager" | Docker Desktop already has a GUI. Duplicating it is wasted effort. Our app should abstract away Docker, not expose it. | App starts/stops containers via `docker compose` CLI commands behind the scenes. User never sees Docker directly. |
| **Kubernetes/cloud deployment option** | "Some users might want to deploy to a server" | Out of scope per project constraints. Cloud adds auth, networking, scaling concerns that are irrelevant for a local desktop tool. | Docker Compose only. If someone wants server deployment, `docker-compose.yml` already works on any Docker host. |

## Feature Dependencies

```
Installer Framework (Tauri 2)
    |
    |----> Windows .exe installer (NSIS bundled)
    |----> Start Menu + Desktop shortcut (automatic)
    |----> Uninstaller (automatic)
    |----> System tray icon (tray-icon plugin)
    |----> Single-instance enforcement (single-instance plugin)
    |----> Auto-update (updater plugin)
    |----> Autostart on login (autostart plugin)

First-Run Setup Wizard (custom React UI inside Tauri window)
    |
    |----> Prerequisite Detection
    |       |----> Docker detection (registry + CLI)
    |       |----> WSL2 detection (wsl --status)
    |       |----> Python detection (python --version)
    |       |----> GPU/CUDA detection (nvidia-smi + CUDA_PATH)
    |
    |----> Installation Mode Selection
    |       |----> Docker mode setup
    |       |       |----> Docker prerequisite install (if missing)
    |       |       |----> docker compose pull + up
    |       |       |----> GPU overlay auto-apply (if NVIDIA detected)
    |       |
    |       |----> Native mode setup
    |               |----> Qdrant binary download (github.com/qdrant/qdrant/releases)
    |               |----> Python environment validation
    |               |----> pip install from pyproject.toml
    |               |----> GPU PyTorch wheel selection
    |
    |----> ML Model Download (shared by both modes)
            |----> bge-m3 download (~2GB) with progress
            |----> bge-reranker-v2-m3 download (~2GB) with progress
            |----> Resume on failure
            |----> Integrity verification

Backend Lifecycle Management
    |----> Process spawning (Docker: docker compose up / Native: python -m paragraf)
    |----> Health polling (existing /api/health endpoint)
    |----> Crash recovery (restart on failure, max 3 retries)
    |----> Clean shutdown (SIGTERM / docker compose down)
    |----> System tray status updates
```

### Critical Path

1. **Tauri 2 shell** must work first -- everything else is inside it
2. **Prerequisite detection** must work before mode selection can be meaningful
3. **Backend lifecycle** must work before any app functionality is usable
4. **Model download** can happen during or after install, but must complete before first search

## MVP Recommendation

### Absolute Minimum for "It Works" (Phase 1)

1. **Tauri 2 app shell** wrapping existing React frontend
2. **Docker-mode-only setup wizard** (detect Docker, pull images, start containers)
3. **Backend lifecycle** (start/stop Docker Compose from Tauri)
4. **Health overlay** (reuse existing HealthOverlay component)
5. **System tray** with basic status (ready/loading/error)

Skip native mode in Phase 1. Docker is the proven deployment path. Native adds enormous complexity for an edge case (users without Docker who also want to avoid installing it).

### Add in Phase 2

6. **ML model download with progress** (pre-pull models instead of first-run download)
7. **GPU/CUDA auto-detection** and docker-compose.gpu.yml overlay
8. **Auto-update mechanism** via GitHub Releases
9. **Model management UI** (show download status, re-download option)

### Add in Phase 3 (if validated)

10. **Native mode** (Qdrant binary + Python sidecar) -- only if Docker mode proves too much friction
11. **One-click Docker prerequisite install**
12. **Storage location selection**

### Defer Indefinitely

- Mac/Linux installers
- Silent/unattended install
- Custom Python bundling

## User Flow: Download to First Search Result

```
User downloads Paragraf-Setup.exe from website/GitHub
    |
    v
Double-click installer
    |
    v
[Screen 1: Welcome]
"Willkommen bei Paragraf -- Rechtsrecherche fuer alle"
Brief description, "Weiter" button
    |
    v
[Screen 2: Systemcheck]  <-- automatic, no user action needed
Checklist with green/red indicators:
  [x] Windows 10/11 .............. OK
  [x] 8 GB RAM ................... OK
  [x] Docker Desktop ............. OK (oder: Nicht gefunden)
  [ ] NVIDIA GPU ................. Optional (GTX 1660 erkannt)
  [ ] ~6 GB Speicherplatz ........ OK

If Docker missing: "Docker Desktop wird benoetigt. Jetzt installieren?"
  -> Download + install Docker Desktop
  -> May require restart
  -> Resume wizard after restart
    |
    v
[Screen 3: GPU-Konfiguration]  <-- only shown if GPU detected
"NVIDIA GTX 1660 erkannt. GPU-Beschleunigung aktivieren?"
  (o) Ja, GPU nutzen (5-10x schneller)
  ( ) Nein, nur CPU
"Weiter" button
    |
    v
[Screen 4: Installation]
Progress bar: "Docker-Images werden heruntergeladen..."
  - Qdrant v1.13.2 ........... 120 MB [=====>    ] 52%
  - Backend + ML-Modelle ...... 4.2 GB [==>       ] 23%
  - Frontend .................. 25 MB  [==========] 100%

This is the long step (5-30 min depending on internet).
Must show: speed, ETA, individual component progress.
    |
    v
[Screen 5: Fertig]
"Paragraf wurde installiert!
 Beim ersten Start werden die Gesetze indexiert (~15 Min)."
[x] Paragraf jetzt starten
[x] Startmenue-Verknuepfung erstellen
"Fertigstellen" button
    |
    v
App opens -> HealthOverlay shows "ML-Modelle werden geladen..." (30-60s)
    -> Backend ready
    -> Dashboard: "Keine Gesetze indexiert. Jetzt starten?"
    -> User clicks "Alle Gesetze indexieren"
    -> SSE progress stream (existing feature)
    -> 15-45 min later: First search possible
```

**Total time from download to first search: ~30-90 minutes** (mostly waiting for downloads and indexing). This is comparable to LM Studio or Ollama first-run experience with large models.

## Reference Implementations

| App | Installer UX | Model Download | Backend Management | Lessons |
|-----|-------------|----------------|-------------------|---------|
| **Ollama** | One-click .exe, auto-installs to Program Files, starts service immediately | `ollama run` downloads model on first use, shows progress | Runs as Windows service, always on, system tray icon | Keep it simple. One-click install, models download when needed. |
| **LM Studio** | Standard .exe installer, ~80MB (Electron). No prerequisites. | Built-in model browser with search, size info, download progress, GPU compatibility tags | Embedded inference engine, no external dependencies | Model browsing UX is best-in-class. Show model info before download. |
| **Docker Desktop** | .exe installer, auto-enables WSL2, may require restart | Pulls images on `docker pull`, shows layer progress | Manages Docker daemon, system tray with status | WSL2 enablement + restart is the biggest friction. Handle it or avoid it. |
| **Jan.ai** | .exe installer, ~80MB (Electron). Models download separately. | Model hub with categories, size, RAM requirements shown upfront | Local inference server, manages models in app data folder | Good example of "offline-first" messaging and model management UI. |

## Complexity Budget

| Feature Category | Estimated Effort | Risk Level | Notes |
|-----------------|-----------------|------------|-------|
| Tauri 2 app shell | 1-2 weeks | LOW | Well-documented, many examples with React |
| Setup wizard UI | 2-3 weeks | MEDIUM | Custom multi-step form, prerequisite detection logic |
| Docker lifecycle | 1-2 weeks | MEDIUM | Process management, error handling, port conflicts |
| GPU detection | 2-3 days | LOW | nvidia-smi + env var check, conditional compose overlay |
| Model download progress | 1 week | MEDIUM | Need to intercept Docker layer progress or pre-download models |
| System tray | 2-3 days | LOW | Tauri plugin, straightforward |
| Auto-update | 1 week | MEDIUM | Code signing, update server setup, testing |
| Native mode (full) | 3-4 weeks | HIGH | Qdrant binary management, Python env, process orchestration |
| Windows installer polish | 1 week | LOW | Icons, splash screen, UAC handling |

**Total estimated: 8-14 weeks** for Docker-mode-only MVP (Phases 1-2), add 3-4 weeks for native mode.

## Sources

- [Tauri 2 Sidecar Documentation](https://v2.tauri.app/develop/sidecar/) -- embedding external binaries, Python process management
- [Tauri 2 System Tray](https://v2.tauri.app/learn/system-tray/) -- tray icon configuration and events
- [Tauri 2 Updater Plugin](https://v2.tauri.app/plugin/updater/) -- auto-update mechanism with GitHub Releases
- [Tauri vs Electron Complete Guide 2026](https://blog.nishikanta.in/tauri-vs-electron-the-complete-developers-guide-2026) -- framework comparison, installer sizes
- [Tauri v2 FastAPI Sidecar Template](https://github.com/AlanSynn/vue-tauri-fastapi-sidecar-template) -- reference implementation of Tauri + Python backend
- [Tauri v2 Python Server Sidecar Example](https://github.com/dieharders/example-tauri-v2-python-server-sidecar) -- Next.js + Python API server in Tauri
- [Qdrant GitHub Releases](https://github.com/qdrant/qdrant/releases) -- standalone Windows binary (qdrant.exe)
- [Qdrant Windows Quick Start](https://medium.com/@niteen.gokhale/qdrant-quick-start-on-windows-26a081bfda65) -- running qdrant.exe standalone
- [HuggingFace Hub Download Guide](https://huggingface.co/docs/huggingface_hub/guides/download) -- resumable model downloads
- [PyInstaller FastAPI Tutorial](https://ccgit.crown.edu/cyber-reels/fastapi-pyinstaller-tutorial-build-executables-1764802265) -- bundling FastAPI as executable
- [CUDA Installation Guide Windows](https://docs.nvidia.com/cuda/cuda-installation-guide-microsoft-windows/index.html) -- CUDA detection and registry paths
- [Docker Desktop Windows Install](https://docs.docker.com/desktop/setup/install/windows-install/) -- prerequisites, WSL2 setup
- [Ollama Windows Guide](https://skywork.ai/blog/llm/ollama-windows-guide-install-run-local-ai-on-pc/) -- reference installer UX
- [LM Studio Setup Guide](https://devtoolhub.com/install-lm-studio-ollama/) -- reference model download UX

---
*Feature research for: Paragraf v2 -- Desktop Installer & Native App*
*Researched: 2026-03-29*

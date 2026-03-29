# Project Research Summary

**Project:** Paragraf v2 — Desktop Installer & Native App
**Domain:** Desktop packaging for ML-heavy Python/React application (Windows-first)
**Researched:** 2026-03-29
**Confidence:** HIGH

## Executive Summary

Building a desktop installer for Paragraf v2 means wrapping an existing Docker-based RAG application (Python FastAPI + Qdrant + React) into a double-click Windows `.exe` for non-technical users. The core challenge is that the ML stack (BAAI/bge-m3 + bge-reranker-v2-m3 + PyTorch) totals 4-8GB of downloads — making naive "bundle everything" approaches fail at the installer level (NSIS 2GB hard limit) or at the antivirus level (PyInstaller false positives). The correct architecture is a **thin installer (<100MB)** containing only the desktop shell, with all ML models, Python runtime, and Qdrant downloaded post-install via a first-run setup wizard. This is the same pattern used by Ollama, LM Studio, and Jan.ai.

The desktop shell should be **Electron 40 + electron-builder**, not Tauri 2. While three of the four research files initially leaned toward Tauri, the combined research is unambiguous: ARCHITECTURE.md's Tauri recommendation depends on PyInstaller as the Python backend bundler, but PITFALLS.md classifies PyInstaller as a CRITICAL risk (antivirus quarantine, zombie processes, 3-5GB bundles) and recommends against it regardless of shell choice. Tauri's NSIS installer has the same 2GB limit as Electron's. Tauri's sidecar lifecycle management is documented as lacking (GitHub issue #3062 still open). Electron's Node.js main process with `tree-kill` is the proven path for managing Python child processes. The team has TypeScript expertise but no Rust experience, making Tauri's Rust-based process management an additional risk. **Electron + python-build-standalone** is the synthesized recommendation.

The critical risk is user abandonment during the 30-90 minute first-run experience (Docker pull + model downloads + law indexing). Every second of that experience must show clear progress, estimated time, and recovery from network failures. Three non-negotiable requirements from PITFALLS.md must be addressed in the architecture phase before any coding: (1) thin installer strategy to avoid NSIS 2GB limit, (2) `tree-kill` + Windows Job Objects from day one for clean process teardown, (3) `HF_HOME` set to a short path (`C:\ProgramData\Paragraf\models`) to avoid Windows MAX_PATH failures on user machines with long German names.

## Key Findings

### Recommended Stack

The existing stack (Python 3.12, FastAPI, React 19, Vite, Qdrant v1.13.2) requires zero changes. The desktop layer is purely additive: a new `desktop/` package wraps the existing `frontend/` as the Electron renderer and spawns the existing `backend/` as a child process. The NSIS 2GB limit is bypassed by keeping the installer thin — the installer contains only the Electron shell (~100MB), and the Python runtime (~30MB compressed), Qdrant binary (~40MB), and ML models (~4GB) are all downloaded post-install.

**Core technologies (new additions only):**
- **Electron 40**: desktop shell — Node.js main process manages Python/Qdrant child processes; mature, TypeScript-native, no Rust required
- **electron-vite 5**: build tooling — bridges existing Vite 6 frontend into Electron's main/preload/renderer build; released Dec 2025
- **electron-builder 25**: packaging — NSIS installer generation, code signing, delta auto-updates; 12.8k stars, battle-tested
- **python-build-standalone**: Python runtime — pre-built relocatable Python 3.12 (~30MB), no PyInstaller, no antivirus triggers, used by Rye/uv
- **tree-kill 1.2.x**: process cleanup — recursive process tree kill on Windows; `child_process.kill()` alone does not terminate Python's child processes
- **huggingface_hub**: model download — already a transitive dependency; `snapshot_download()` with resume and progress; no new dependency
- **torch.cuda + nvidia-smi**: GPU detection — existing PyTorch (no new dep) plus subprocess call to system nvidia-smi

**Not recommended:**
- **Tauri 2**: sidecar lifecycle immature (issue #3062 open); requires Rust toolchain the team lacks; ARCHITECTURE.md's Tauri + PyInstaller combination is overridden by PITFALLS.md findings
- **PyInstaller**: antivirus quarantine (CRITICAL per PITFALLS.md), zombie processes on Windows from bootloader/child split, 3-5GB bundles with CUDA DLLs

### Expected Features

**Must have (table stakes) — Phase 1:**
- Graphical Windows `.exe` installer — users will not run CLI commands
- First-run setup wizard (3-5 screens: Welcome > System check > Mode selection > Download > Done)
- Installation mode selection: Docker (recommended) vs Native (no Docker required)
- ML model download with progress bar — 4GB download requires ETA, speed, resume on failure
- Backend lifecycle management — app start spawns backend; app close kills it cleanly (no orphans)
- Health status overlay — reuse existing `HealthOverlay` + `useHealthCheck`, no changes needed
- Start Menu + Desktop shortcut — automatic via NSIS installer
- Error messages in German — target audience is non-technical German speakers
- Uninstaller with option to delete models and law data

**Should have (differentiators) — Phase 2:**
- Automatic GPU/CUDA detection: `nvidia-smi` (pre-Python) + `torch.cuda.is_available()` (post-install), auto-configure `EMBEDDING_DEVICE=cuda`
- System tray with backend status (green/yellow/red), right-click menu for Restart/Quit
- Auto-update mechanism via GitHub Releases (app shell only, not models)
- Model management UI: show downloaded models, sizes, re-download option
- Smart storage location picker (models default to `C:\ProgramData\Paragraf\` to avoid MAX_PATH)

**Defer to Phase 3 (if Docker mode proves too much friction):**
- Native mode: Qdrant standalone binary + python-build-standalone + pip install at first run
- One-click Docker Desktop prerequisite installer

**Defer indefinitely:**
- Mac/Linux installers (doubles testing surface; Docker mode works on all platforms via `docker compose up`)
- Silent/unattended install (skips model download which is essential for first run)
- PyInstaller-based bundling (explicitly anti-featured due to antivirus and zombie process risks)

### Architecture Approach

The architecture uses two execution modes behind one Electron shell. In **Docker mode** (Phase 1 MVP), Electron manages `docker compose up/down` for the 3-service headless stack (qdrant + backend + mcp, no frontend container) and loads the existing React SPA as the Electron renderer via `file://`. In **Native mode** (Phase 3), Electron spawns `qdrant.exe` and a python-build-standalone process as child processes managed by `tree-kill`. Both modes share the same React SPA with no code changes — only `window.__PARAGRAF_API_BASE_URL__` changes from nginx-proxied to `http://localhost:8000` direct. The existing `frontend/` folder becomes the Electron renderer with one change: `base: './'` in `vite.config.ts` to fix asset paths under `file://` protocol.

**Major components (new `desktop/` package):**
1. **Electron main process** (`desktop/src/main/index.ts`) — window creation, app lifecycle, IPC handler
2. **Backend manager** (`desktop/src/main/backend.ts`) — spawn Python via child_process, health polling, `tree-kill` on quit, crash restart with backoff
3. **Docker manager** (`desktop/src/main/docker.ts`) — `docker compose up/down/ps`, Docker Desktop detection via registry + named pipe + CLI
4. **Setup wizard** (`frontend/src/pages/SetupPage.tsx`) — first-run multi-step React UI using existing component patterns
5. **Headless compose file** (`desktop/docker-compose.headless.yml`) — 3-service variant (no frontend container)
6. **GPU detector** (`desktop/src/main/gpu.ts`) — `nvidia-smi` subprocess before Python is available
7. **Model manager** (new backend API endpoint) — `snapshot_download()` progress streamed via SSE (same pattern as law indexing, no new library)

**Unchanged (zero modifications needed):**
- All backend services, API routes, Pydantic models, MCP tools
- All existing frontend pages (SearchPage, LookupPage, etc.)
- All Docker files, docker-compose.yml, Qdrant schema
- `useHealthCheck` hook — already polls `/api/health` with reconnect logic

### Critical Pitfalls

1. **NSIS 2GB installer limit** (CRITICAL) — thin installer containing only Electron shell (<100MB); ALL Python deps, Qdrant binary, and ML models are post-install downloads; CPU-only PyTorch by default; CUDA is an optional add-on download triggered by GPU detection; must be decided in architecture phase before any packaging work

2. **Zombie Python processes on Windows** (CRITICAL) — always use `tree-kill` (not `child_process.kill()`); implement Windows Job Objects to group child processes; add startup orphan check (scan port 8000 on launch); graceful `POST /api/shutdown` before force-kill; design this into the backend lifecycle manager from day one

3. **PyInstaller antivirus false positives** (CRITICAL) — do NOT use PyInstaller; use python-build-standalone + pip install at first run instead; no bootloader means no antivirus trigger; if PyInstaller is ever required, recompile bootloader from source and sign all executables; test every release on VirusTotal (target <3 detections)

4. **Windows MAX_PATH (260 chars) breaks HuggingFace model cache** (HIGH) — set `HF_HOME=C:\ProgramData\Paragraf\models` and `HF_HUB_CACHE` explicitly at process startup; never use default `%USERPROFILE%\.cache\huggingface\hub\`; German users have long full-name usernames; set short paths from day one

5. **Windows SmartScreen blocks unsigned installer** (HIGH) — acquire code signing certificate early (Azure Trusted Signing ~10 EUR/month recommended for faster reputation building); sign ALL executables; start beta distribution early to build SmartScreen reputation

6. **GPU/CUDA detection chicken-and-egg** (HIGH) — two-phase detection: Phase 1 uses `nvidia-smi` subprocess before Python is installed; Phase 2 uses `torch.cuda.is_available()` after install to verify CUDA runtime; ship CPU-only PyTorch by default; CUDA is an explicit add-on download with driver version compatibility check

## Implications for Roadmap

Based on combined research, the following phase structure is recommended. Docker-first is the MVP — native mode is deferred to Phase 3 because it adds 3-4 weeks of complexity for an edge case that can be validated by measuring Docker installation friction.

### Phase 1: Electron Shell + Docker Mode MVP
**Rationale:** Docker is the proven deployment path. All existing infrastructure works. Phase 1 validates the desktop UX before investing in native mode complexity.
**Delivers:** Working `.exe` installer, first-run setup wizard (Docker mode only), system tray, backend lifecycle management (docker compose), health overlay, German error messages, code signing.
**Addresses:** All table-stakes features — installer, wizard, lifecycle, health, tray, shortcuts, uninstaller.
**Avoids:** NSIS 2GB limit (thin installer), zombie processes (tree-kill from day one), MAX_PATH (short HF_HOME), SmartScreen (certificate procurement starts here).
**Stack:** Electron 40, electron-vite 5, electron-builder 25, tree-kill, `docker compose` CLI.
**Research flag:** Needs phase-level research on Docker Desktop detection methods (multi-method: registry + named pipe + CLI) and NSIS installer customization via electron-builder.

### Phase 2: GPU Detection + Model Management + Auto-Update
**Rationale:** After Docker mode works, Phase 2 adds features that elevate UX from functional to polished. GPU auto-detection is a differentiator that users notice immediately (5-10x faster indexing). Auto-update prevents the app from going stale.
**Delivers:** Automatic GPU/CUDA detection and configuration, ML model download progress UI (SSE-based, reusing law indexing pattern), model management UI, auto-update via GitHub Releases.
**Addresses:** Differentiator features — GPU detection, model management, auto-update, storage location picker.
**Avoids:** GPU chicken-and-egg (#4) via two-phase nvidia-smi + torch.cuda detection; auto-update channel separation (app updates vs model updates).
**Stack:** torch.cuda + nvidia-smi (no new deps), huggingface_hub (already transitive), electron-updater (via electron-builder).
**Research flag:** Low research need. SSE-based download progress is identical to existing law indexing pattern. GPU detection approach is well-documented.

### Phase 3: Native Mode (No Docker Required)
**Rationale:** Native mode targets users who cannot or will not install Docker Desktop. Only build after Docker mode is proven stable and Docker installation friction is measured in practice.
**Delivers:** Full app functionality without Docker — python-build-standalone install at first run, Qdrant standalone binary lifecycle, pip install of Python dependencies, CPU/CUDA PyTorch switching.
**Addresses:** Installation mode selection (native path), smart storage location selection, one-click Docker prerequisite install (if validated).
**Avoids:** PyInstaller (use python-build-standalone); antivirus triggers; zombie processes via tree-kill + Job Objects; NSIS limit via post-install downloads; Qdrant permissions via user-writable `%LOCALAPPDATA%\Paragraf\qdrant\`.
**Stack:** python-build-standalone (GitHub releases), Qdrant v1.13.2 Windows binary (GitHub releases), Windows Job Objects via Node.js child_process.
**Research flag:** NEEDS phase-level research. python-build-standalone + pip bootstrap on Windows has documented edge cases. Windows Job Objects API in Node.js is non-trivial. Port conflict recovery needs design. Highest-risk phase.

### Phase Ordering Rationale

- **Docker before Native** — Docker is proven infrastructure; native adds 3-4 weeks complexity for an edge case; Docker mode validates the wizard UX before investing in the harder path
- **Code signing in Phase 1** — SmartScreen reputation builds gradually over weeks; certificate procurement takes 1-5 business days; starting in Phase 3 would block release
- **GPU detection in Phase 2 not Phase 1** — Docker mode handles GPU via `docker-compose.gpu.yml` overlay already; detection logic can be added after base installer is stable
- **tree-kill and short HF_HOME paths must be in Phase 1** — these are architecture-level decisions that are very expensive to retrofit; zombie processes corrupt user perception; MAX_PATH failures are impossible to diagnose post-installation

### Research Flags

Phases needing `/gsd:research-phase` during planning:
- **Phase 1:** Docker Desktop detection methods on Windows (registry key paths, named pipe `\\.\pipe\docker_engine`, CLI fallbacks). NSIS installer customization via electron-builder (custom wizard pages, UAC, Start Menu shortcut configuration).
- **Phase 3:** python-build-standalone Windows bootstrap process (pip install without pip pre-installed). Windows Job Objects in Node.js child_process. Dynamic port selection and conflict recovery across Docker and native modes.

Phases with standard patterns (skip research-phase):
- **Phase 2:** GPU detection (nvidia-smi + torch.cuda), SSE-based download progress (identical to existing law indexing in codebase), electron-updater (well-documented by electron-builder).

## Conflict Resolution: Electron vs Tauri

The four research files disagreed on the desktop shell. This is the explicit synthesis decision:

| Research File | Recommendation | Key Argument |
|---------------|---------------|--------------|
| STACK.md | Electron 40 + python-build-standalone | NSIS 2GB limit is real; no Rust expertise; Node.js child_process for Python is proven |
| FEATURES.md | Tauri 2 (implicit — feature dependency graph uses Tauri plugins) | Smaller footprint, first-class sidecar, built-in plugins |
| ARCHITECTURE.md | Tauri 2 + PyInstaller | Tauri Rust process management is ideal for sidecars |
| PITFALLS.md | Electron (implicit — explicitly rejects PyInstaller) | PyInstaller = CRITICAL antivirus + zombie process risks regardless of shell |

**Synthesis: Electron 40 + python-build-standalone wins because:**
1. ARCHITECTURE.md's Tauri recommendation depends on PyInstaller, which PITFALLS.md classifies as CRITICAL risk (Pitfalls #2 and #3). Removing PyInstaller from Tauri's architecture leaves no bundling strategy for the Python backend in native mode.
2. Tauri's NSIS installer has the SAME 2GB limit (confirmed in Tauri issue #7372). The thin installer strategy required by PITFALLS.md #1 is mandatory regardless of shell choice — it does not advantage Tauri.
3. Tauri's sidecar lifecycle plugin is explicitly documented as incomplete (issue #3062, open). STACK.md's Electron + tree-kill approach is verified working in production (VS Code, Slack patterns).
4. The team has no Rust expertise. Tauri's process management requires writing Rust. The additional learning curve is unjustified given that Electron + Node.js achieves the same result with TypeScript.
5. FEATURES.md's Tauri plugin list (tray-icon, single-instance, autostart, updater) all have direct Electron equivalents with mature APIs.
6. The 30MB vs 200MB RAM difference between Tauri and Electron is irrelevant — ML models already consume 4GB RAM.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | NSIS 2GB limit is documented hard constraint. Electron + python-build-standalone corroborated by STACK.md and PITFALLS.md. Electron v40.8.5 version verified 2026-03-26. |
| Features | MEDIUM-HIGH | Feature list is comprehensive. Effort estimates (8-14 weeks Docker mode, +3-4 weeks native) from FEATURES.md; validate against team velocity. Some Tauri-specific features need Electron API mapping confirmed. |
| Architecture | MEDIUM | Electron + python-build-standalone is architecturally sound but lacks a reference implementation for this exact combination (React + FastAPI + PyTorch + python-build-standalone + Electron). python-build-standalone Windows bootstrap needs spike validation. |
| Pitfalls | HIGH | All critical pitfalls corroborated across multiple independent sources (GitHub issues, forum posts, production case studies). Prevention strategies are verified. |

**Overall confidence:** HIGH for core architectural decision (Electron + python-build-standalone, thin installer, Docker-first). MEDIUM for native mode complexity and effort estimates.

### Gaps to Address

- **Tauri-to-Electron feature mapping:** FEATURES.md lists Tauri-specific plugins; Phase 1 planning should confirm Electron equivalents (tray = `Tray` class; single-instance = `app.requestSingleInstanceLock()`; autostart = registry-based npm package).
- **python-build-standalone Windows bootstrap spike:** Exact sequence for bootstrapping pip on embedded Python on Windows has known edge cases. Phase 3 planning must include a technical spike before committing.
- **Model delivery in Docker mode:** ML models stored in Docker volumes (not `%APPDATA%`). Phase 2 model management UI must decide whether to expose Docker volume paths or maintain separate HF_HOME outside Docker for cross-mode model sharing.
- **Code signing procurement timeline:** Azure Trusted Signing (~10 EUR/month) recommended over traditional OV certificates for faster SmartScreen reputation. Must be initiated at project kickoff — 1-5 business days for approval.
- **Port conflict recovery design:** Ports 8000 (backend) and 6333 (Qdrant) may be in use on user machines. Dynamic port selection strategy (try 8000, fall back to 8001-8010) needs design before Phase 1 to avoid retrofitting.

## Sources

### Primary (HIGH confidence)
- [Electron Releases](https://releases.electronjs.org/) — v40.8.5 confirmed 2026-03-26
- [electron-vite 5.0 announcement](https://electron-vite.org/blog/) — released Dec 2025, Vite 6 support confirmed
- [NSIS 2GB limit — NSIS Forums](https://nsis-dev.github.io/NSIS-Forums/html/t-281864.html) — hard installer size limitation documented
- [NSIS 2GB limit — Tauri issue #7372](https://github.com/tauri-apps/tauri/issues/7372) — confirmed in Tauri context (overrides ARCHITECTURE.md claim)
- [Tauri sidecar lifecycle — issue #3062](https://github.com/tauri-apps/plugins-workspace/issues/3062) — lifecycle management gaps, still open 2026
- [Tauri sidecar kill bug — issue #11686](https://github.com/tauri-apps/tauri/issues/11686) — PyInstaller two-process kill failure in Tauri
- [PyInstaller false positives — issue #6754](https://github.com/pyinstaller/pyinstaller/issues/6754) — antivirus root cause and bootloader fix
- [HuggingFace Hub MAX_PATH — issue #35](https://github.com/huggingface/huggingface_hub/issues/35) — Windows 260-char path limit
- [tree-kill package](https://www.npmjs.com/package/tree-kill) — recursive process tree kill on Windows
- [Qdrant v1.13.2 Releases](https://github.com/qdrant/qdrant/releases/tag/v1.13.2) — Windows binary confirmed
- [python-build-standalone releases](https://github.com/indygreg/python-build-standalone/releases) — active releases, used by Rye/uv

### Secondary (MEDIUM confidence)
- [Bundling Python inside Electron — Simon Willison](https://til.simonwillison.net/electron/python-inside-electron) — python-build-standalone + Electron pattern
- [DoltHub Electron vs Tauri comparison](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — 2025 comparison, Tauri sidecar limitations
- [SmartScreen and EV certificates](https://blog.betterbird.eu/2026/01/whats-the-story-with-windows-smartscreen) — EV no longer bypasses SmartScreen (2026 source)
- [Azure Trusted Signing](https://learn.microsoft.com/en-us/answers/questions/5584097/how-to-bypass-windows-defender-smartscreen-even-af) — Microsoft cloud signing for SmartScreen reputation
- [PyInstaller PyTorch size discussion](https://github.com/orgs/pyinstaller/discussions/8552) — 2.6GB+ CUDA bundles confirmed
- [HuggingFace Hub download guide](https://huggingface.co/docs/huggingface_hub/guides/download) — resumable downloads, snapshot_download()
- [electron-builder auto-update](https://www.electron.build/auto-update.html) — NSIS delta update support
- [Tauri 2 Sidecar Documentation](https://v2.tauri.app/develop/sidecar/) — reference (approach overridden by synthesis)

### Tertiary (LOW confidence — needs validation during implementation)
- [Python Embedded Distribution](https://docs.python.org/3/using/windows.html) — bootstrap process needs spike validation for Phase 3
- [PyTorch Wheel Variants](https://developer.nvidia.com/blog/streamline-cuda-accelerated-python-install-and-packaging-workflows-with-wheel-variants/) — experimental as of PyTorch 2.8+, stability for this timeline unverified
- [PyInstaller CUDA detection — issue #2956](https://github.com/pyinstaller/pyinstaller/issues/2956) — torch.cuda.is_available() returns False in bundles (supports rejecting PyInstaller)

---
*Research completed: 2026-03-29*
*Ready for roadmap: yes*

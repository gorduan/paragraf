# Technology Stack: Desktop Installer & Packaging

**Project:** Paragraf v2.0 -- Desktop App & Installer
**Researched:** 2026-03-29
**Focus:** NEW capabilities only -- desktop shell, installer, model download, GPU detection, backend lifecycle

## Decision: Electron (not Tauri)

**Recommendation: Electron** because the project bundles a ~4GB Python ML backend with PyTorch. Tauri's advantages (small bundle, low RAM) are irrelevant when the app ships multi-gigabyte ML models. Meanwhile, Electron's mature Node.js main process makes Python child_process management straightforward, and electron-builder's NSIS support is battle-tested for Windows installers.

**Why not Tauri:**
- NSIS has a hard 2GB installer limit. PyTorch CPU-only is ~800MB, CUDA variant is ~4GB. With Python runtime + dependencies, a bundled installer easily exceeds 2GB. Tauri uses NSIS internally, hitting this wall.
- Tauri's sidecar lifecycle management is immature -- no official plugin, requires manual Rust boilerplate for spawn/monitor/restart/cleanup (GitHub issue #3062 still open).
- Tauri requires Rust toolchain for builds. The team has no Rust expertise. Electron uses Node.js, which aligns with the existing TypeScript/Vite frontend.
- Tauri's Python sidecar pattern (PyInstaller exe as sidecar) adds a build step that PyInstaller + PyTorch is notoriously difficult to get right (3-5GB bundles, CUDA DLL issues).
- The 30MB vs 200MB RAM difference is meaningless when ML models consume 2-4GB RAM.

**Confidence: HIGH** -- based on multiple sources, NSIS 2GB limit is a documented hard blocker, Tauri sidecar lifecycle is documented as lacking.

## Recommended Stack Additions

### Desktop Shell

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron | ^40.0.0 | Desktop app shell (Chromium + Node.js) | Latest stable (v40.8.5 as of March 2026). Mature, proven for apps with heavy backends (VS Code, Slack). Node.js main process can spawn/manage Python. |
| electron-vite | ^5.0.0 | Build tooling for Electron + Vite | Bridges existing Vite 6 frontend into Electron. Handles main/preload/renderer builds. Released Dec 2025, supports Vite 6. |

### Installer & Packaging

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-builder | ^25.0.0 | Package Electron app + create installers | Most popular (12.8k GitHub stars), native NSIS support, delta updates, code signing. Preferred over electron-forge for NSIS. |
| NSIS (via electron-builder) | -- | Windows .exe installer | Built into electron-builder. Customizable wizard pages, Start Menu shortcuts, uninstaller. |

**Critical design decision: Thin installer + post-install download.**
The installer itself must be small (<100MB). ML models (~4GB) and the Python backend are downloaded post-install by the app's setup wizard. This avoids the NSIS 2GB limit entirely.

### Python Backend Bundling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| python-build-standalone | latest | Embeddable Python 3.12 distribution | Pre-built, relocatable Python for Windows/Mac/Linux. No system Python dependency. ~30MB compressed. Used by tools like Rye, uv. More reliable than PyInstaller for complex ML stacks. |
| pip (bundled with embedded Python) | -- | Install Python dependencies at first run | Avoids PyInstaller's PyTorch bundling nightmares (3-5GB exe, CUDA DLL issues). Dependencies installed into a local venv on first launch. |

**Why NOT PyInstaller:**
- PyTorch + PyInstaller = 3-5GB single executable, extremely fragile
- CUDA DLLs cause constant breakage across PyInstaller versions
- Excludes/includes must be manually maintained as dependencies change
- CPU-only vs CUDA builds require separate PyInstaller configs
- python-build-standalone + pip install is simpler, more maintainable, and allows CPU/CUDA switching at runtime

### Model Download & Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| huggingface_hub | >=0.24.0 | Download ML models with progress | Already a transitive dependency (via transformers/sentence-transformers). Provides `snapshot_download()` with tqdm progress bars, caching, resume, dry-run size estimation. |

The backend already uses HuggingFace models. `huggingface_hub` is already installed transitively. The setup wizard calls a backend endpoint that triggers `snapshot_download()` and streams progress via SSE (same pattern as law indexing).

**No new library needed** -- just a new API endpoint exposing download progress.

### GPU/CUDA Detection

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| torch.cuda (PyTorch) | >=2.2.0 | Detect CUDA availability | Already installed. `torch.cuda.is_available()`, `torch.cuda.get_device_name()`, `torch.cuda.device_count()`. The authoritative way to check CUDA when PyTorch is your inference runtime. |
| nvidia-smi (system) | -- | Detect NVIDIA driver version | Called via subprocess. Available on any system with NVIDIA drivers. Provides driver version, GPU model, VRAM. Used as pre-check before PyTorch CUDA test. |

**No new library needed.** GPU detection is a backend API endpoint:
1. Check `nvidia-smi` exists (subprocess) -- confirms NVIDIA driver installed
2. Check `torch.cuda.is_available()` -- confirms CUDA runtime works
3. Return GPU model, VRAM, driver version, CUDA version to frontend

### Backend Lifecycle Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js child_process (built-in) | -- | Spawn/kill Python backend | Built into Electron's Node.js. `spawn()` for the Python process, stdio pipes for logs, `kill()` on app quit. |
| tree-kill | ^1.2.2 | Kill process trees on Windows | Windows `child_process.kill()` does not kill child processes. `tree-kill` ensures the Python process and all its children (uvicorn workers) are terminated. Critical for Windows. |

**Lifecycle pattern:**
1. Electron main process spawns: `python -m paragraf --mode api --port 8000`
2. Health polling: GET `http://localhost:8000/api/health` every 2s
3. Ready when health returns `{ status: "ready" }`
4. On app quit: `tree-kill(pid)` to clean up process tree
5. On crash: Auto-restart with backoff (3 attempts, then show error)

### Qdrant Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Qdrant binary (standalone) | v1.13.2 | Vector database without Docker | Qdrant provides standalone binaries for Windows/Mac/Linux. Same version as Docker image. Managed as a second child process by Electron. |

**Native mode** (no Docker): Electron manages both Qdrant binary and Python backend as child processes.
**Docker mode**: Existing docker-compose.yml, Electron just opens the browser window.

## Stack Summary by Installation Mode

### Docker Mode (existing users)
No new dependencies. Electron opens a window pointing to `http://localhost:3847`. Docker Compose manages everything.

### Native Mode (new users without Docker)
- Electron shell (~100MB installer)
- python-build-standalone (~30MB, downloaded post-install)
- Python dependencies via pip (~800MB CPU-only, ~4GB with CUDA)
- ML models via huggingface_hub (~4GB, downloaded post-install)
- Qdrant standalone binary (~40MB, downloaded post-install)

Total installer: ~100MB. Total post-install downloads: ~5-9GB depending on GPU.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Desktop shell | Electron 40 | Tauri 2 | NSIS 2GB limit blocks bundled installers; no official sidecar lifecycle plugin; requires Rust toolchain |
| Desktop shell | Electron 40 | CEF (Chromium Embedded) | Too low-level, no installer tooling, no ecosystem |
| Desktop shell | Electron 40 | Neutralinojs | Too immature, limited Node.js API access, no child_process |
| Build tool | electron-vite 5 | electron-forge | electron-forge lacks native NSIS; electron-vite aligns with existing Vite 6 |
| Packaging | electron-builder | electron-forge makers | electron-builder has better NSIS support, more popular, better docs |
| Python bundling | python-build-standalone | PyInstaller | PyTorch + PyInstaller = 3-5GB fragile bundles; CUDA DLL nightmares |
| Python bundling | python-build-standalone | Conda/Miniconda | 400MB+ installer, overkill for embedded use |
| Python bundling | python-build-standalone | Python embeddable zip (python.org) | Requires manual pip bootstrap, less tested than python-build-standalone |
| Model download | huggingface_hub | Custom HTTP download | Already a dependency, provides caching/resume/progress for free |
| GPU detection | torch.cuda + nvidia-smi | GPUtil library | Extra dependency for something torch.cuda already does |
| GPU detection | torch.cuda + nvidia-smi | pynvml | Extra dependency, nvidia-smi subprocess is simpler |
| Process management | child_process + tree-kill | pm2 | Overkill for managing 2 processes; adds large dependency |
| Installer | NSIS (via electron-builder) | WiX/MSI | NSIS more customizable, better wizard support, electron-builder default |
| Installer | NSIS (via electron-builder) | Inno Setup | Not supported by electron-builder |

## New Dependencies Summary

### Frontend / Electron (package.json additions)

```bash
# Production
npm install electron tree-kill

# Dev / Build
npm install -D electron-vite electron-builder
```

| Package | Type | Size Impact |
|---------|------|-------------|
| electron | prod | ~180MB (Chromium runtime, not in installer -- electron-builder handles) |
| tree-kill | prod | ~5KB (tiny, critical for Windows) |
| electron-vite | dev | Build tool only |
| electron-builder | dev | Build tool only |

### Backend (pyproject.toml -- NO changes)

No new Python dependencies. Everything needed is already installed:
- `huggingface_hub` -- transitive via transformers/sentence-transformers
- `torch.cuda` -- part of torch
- `subprocess` -- stdlib (for nvidia-smi)

### System binaries (downloaded post-install, not pip/npm)

| Binary | Source | Size |
|--------|--------|------|
| python-build-standalone 3.12 | github.com/indygreg/python-build-standalone/releases | ~30MB compressed |
| Qdrant v1.13.2 | github.com/qdrant/qdrant/releases | ~40MB compressed |

## Project Structure Changes

```
paragraf v2/
├── desktop/                        # NEW: Electron app
│   ├── package.json                # Electron + electron-vite + electron-builder
│   ├── electron-builder.yml        # NSIS installer config
│   ├── electron.vite.config.ts     # electron-vite config
│   ├── src/
│   │   ├── main/                   # Electron main process
│   │   │   ├── index.ts            # App entry, window creation
│   │   │   ├── backend.ts          # Python process lifecycle
│   │   │   ├── qdrant.ts           # Qdrant process lifecycle
│   │   │   ├── gpu.ts              # GPU detection (nvidia-smi)
│   │   │   └── updater.ts          # Auto-update (future)
│   │   ├── preload/                # Preload scripts (IPC bridge)
│   │   │   └── index.ts
│   │   └── renderer/               # -> points to existing frontend/src
│   └── resources/                  # Icons, NSIS scripts
├── frontend/                       # EXISTING: unchanged, shared renderer
├── backend/                        # EXISTING: unchanged
└── docker-compose.yml              # EXISTING: unchanged
```

**Key insight:** The existing `frontend/` code becomes the Electron renderer with minimal changes. The `desktop/` package imports it. No need to move or duplicate frontend code.

## Integration Points with Existing Stack

| Existing Component | Integration | Changes Needed |
|-------------------|-------------|----------------|
| React 19 frontend | Loaded as Electron renderer | Add `base: './'` to vite.config.ts for file:// protocol; conditional nginx vs file:// API base URL |
| FastAPI backend | Spawned as child process | No changes -- already binds to configurable port |
| Qdrant | Spawned as child process (native) or Docker (docker mode) | No changes -- already configurable via env vars |
| nginx | Not used in desktop mode | Frontend served directly by Electron; API calls go to localhost:8000 |
| Health check | Reused for backend readiness | No changes -- useHealthCheck already polls /api/health |
| SSE streaming | Reused for model download progress | Add new endpoint for model download, same SSE pattern as indexing |
| docker-compose.yml | Used in Docker installation mode | No changes |

## Version Verification

| Technology | Claimed Version | Verification | Confidence |
|------------|----------------|--------------|------------|
| Electron | v40.x | electronjs.org releases page, v40.8.5 on 2026-03-26 | HIGH |
| electron-vite | v5.0.0 | electron-vite.org blog, released Dec 2025 | HIGH |
| electron-builder | v25.x | electron.build, actively maintained | MEDIUM (exact latest minor unverified) |
| python-build-standalone | latest | github.com/indygreg/python-build-standalone, active releases | HIGH |
| Qdrant standalone | v1.13.2 | github.com/qdrant/qdrant/releases, matches Docker image | HIGH |
| huggingface_hub | >=0.24.0 | Already transitive dependency | HIGH |
| tree-kill | ^1.2.2 | npmjs.com/package/tree-kill | MEDIUM |

## Sources

- [Electron Releases](https://releases.electronjs.org/)
- [electron-vite 5.0 announcement](https://electron-vite.org/blog/)
- [electron-builder NSIS docs](https://www.electron.build/nsis.html)
- [Tauri 2 Windows Installer docs](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri sidecar lifecycle issue #3062](https://github.com/tauri-apps/plugins-workspace/issues/3062)
- [NSIS 2GB limit -- Tauri issue #7372](https://github.com/tauri-apps/tauri/issues/7372)
- [Bundling Python inside Electron -- Simon Willison](https://til.simonwillison.net/electron/python-inside-electron)
- [Tauri Python sidecar template](https://github.com/AlanSynn/vue-tauri-fastapi-sidecar-template)
- [HuggingFace Hub download guide](https://huggingface.co/docs/huggingface_hub/guides/download)
- [PyInstaller PyTorch size discussion](https://github.com/orgs/pyinstaller/discussions/8552)
- [Python embeddable distribution docs](https://docs.python.org/3/using/windows.html)
- [DoltHub Electron vs Tauri comparison](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)

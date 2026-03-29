# Architecture: Desktop Installer Integration

**Domain:** Desktop app shell + installer wrapping existing Docker-based legal-tech RAG application
**Researched:** 2026-03-29
**Confidence:** HIGH (Tauri sidecar pattern verified via official docs + multiple production examples; Qdrant Windows binary confirmed in v1.13.2 releases; PyInstaller+FastAPI pattern well-documented)

## Recommended Architecture

### High-Level: Two Execution Modes, One Desktop Shell

```
+------------------------------------------------------------------+
|  TAURI DESKTOP SHELL (Rust + WebView)                            |
|  - Window management, system tray, Start Menu integration        |
|  - Process lifecycle manager (start/stop/health/restart)         |
|  - Mode switcher: Docker vs Native                               |
|  - Setup wizard (first-run)                                      |
|  - Model download manager                                        |
|                                                                  |
|  +-----------------------------------------------------------+  |
|  |  EXISTING REACT SPA (loaded in WebView)                    |  |
|  |  - Same React 19 + Vite build                              |  |
|  |  - window.__PARAGRAF_API_BASE_URL__ = "http://localhost:X" |  |
|  |  - useHealthCheck polls backend as before                  |  |
|  +-----------------------------------------------------------+  |
+------------------------------------------------------------------+
        |                                    |
        v (Docker Mode)                      v (Native Mode)
+------------------+              +---------------------------+
| docker compose   |              | qdrant.exe (sidecar)      |
|   qdrant         |              |   port 6333               |
|   backend        |              +---------------------------+
|   mcp            |              | paragraf-backend.exe      |
|   (no frontend!) |              |   (PyInstaller sidecar)   |
+------------------+              |   port 8000               |
                                  +---------------------------+
```

### Key Insight: Frontend Moves INTO the Desktop Shell

In both modes, the React SPA is **not** served by nginx. Instead:
- Tauri's WebView loads the built `dist/` assets directly from the filesystem
- The existing `window.__PARAGRAF_API_BASE_URL__` mechanism points to `http://localhost:8000`
- nginx is eliminated entirely -- Tauri IS the frontend host

This means:
- **Docker mode** runs only 3 services (qdrant, backend, mcp) -- no frontend container
- **Native mode** runs qdrant.exe + paragraf-backend.exe as sidecar processes
- The React SPA code is identical in both modes

## Component Inventory: New vs Modified vs Unchanged

### NEW Components (purely additive)

| Component | Location | Purpose |
|-----------|----------|---------|
| Tauri shell | `desktop/src-tauri/` | Rust app: window, tray, process lifecycle |
| Setup wizard page | `frontend/src/pages/SetupPage.tsx` | First-run wizard (mode selection, model download) |
| Process manager (Rust) | `desktop/src-tauri/src/process_manager.rs` | Start/stop/health-check backend processes |
| Docker manager (Rust) | `desktop/src-tauri/src/docker_manager.rs` | docker compose up/down for Docker mode |
| Model downloader | `desktop/src-tauri/src/model_manager.rs` | Download bge-m3 + reranker with progress |
| GPU detector | `desktop/src-tauri/src/gpu_detect.rs` | CUDA/GPU detection for config |
| PyInstaller spec | `backend/paragraf.spec` | Bundle backend into standalone .exe |
| Desktop docker-compose | `desktop/docker-compose.headless.yml` | 3-service compose (no frontend service) |
| Tauri config | `desktop/src-tauri/tauri.conf.json` | App metadata, sidecar config, NSIS settings |
| Desktop entrypoint | `desktop/src-tauri/src/main.rs` | Tauri app bootstrap |

### MODIFIED Components (minimal changes)

| Component | Change | Why |
|-----------|--------|-----|
| `frontend/src/lib/api.ts` | No change needed | `window.__PARAGRAF_API_BASE_URL__` already handles dynamic base URL |
| `frontend/src/hooks/useHealthCheck.ts` | No change needed | Already polls `/api/health` with reconnect logic |
| `frontend/src/App.tsx` | Add conditional SetupPage route | Show setup wizard on first run |
| `frontend/vite.config.ts` | Possibly add Tauri dev server integration | Dev experience for Tauri + Vite |
| `backend/src/paragraf/config.py` | Add `native_mode` flag, local model path support | Native mode uses local paths instead of Docker volumes |
| `backend/src/paragraf/__main__.py` | No change needed | Already supports `--mode api --port 8000` |

### UNCHANGED Components

- All backend services (embedding, qdrant_store, reranker, parser, etc.)
- All API routes and models
- All frontend pages (SearchPage, LookupPage, etc.)
- All MCP tools and prompts
- Qdrant configuration and collection schema
- All existing Docker files (Dockerfile, docker-compose.yml)

## Data Flow: Docker Mode

```
User clicks "Paragraf" icon
    |
    v
Tauri main.rs starts
    |
    +--> Read config: mode = "docker"
    |
    +--> Check Docker Desktop running (docker info)
    |    |
    |    +--> NOT running: show "Please start Docker Desktop" overlay
    |    +--> Running: continue
    |
    +--> Run: docker compose -f docker-compose.headless.yml up -d
    |    (qdrant + backend + mcp, NO frontend)
    |
    +--> Set window.__PARAGRAF_API_BASE_URL__ = "http://localhost:8000"
    |
    +--> Load React SPA in WebView (from bundled dist/)
    |
    +--> useHealthCheck polls http://localhost:8000/api/health
    |    |
    |    +--> "connecting" while Docker containers start (~10-30s)
    |    +--> "loading" while ML models initialize (~30-120s first time)
    |    +--> "ready" when fully operational
    |
    v
User interacts with app normally

On app close:
    +--> docker compose -f docker-compose.headless.yml stop
    +--> (optional: keep containers for faster restart)
```

### Docker Mode: Volume Mapping

Same Docker volumes as current architecture:
- `qdrant_data` -- persistent vector storage
- `model_cache` -- HuggingFace models (bge-m3 + reranker)
- `law_data` -- downloaded law XML/HTML + processed JSON

No changes to volume mapping. The only difference is the frontend container is absent.

## Data Flow: Native Mode

```
User clicks "Paragraf" icon
    |
    v
Tauri main.rs starts
    |
    +--> Read config: mode = "native"
    |
    +--> Start qdrant.exe sidecar
    |    +--> Binary bundled in app or downloaded at install
    |    +--> Config: storage at %APPDATA%/Paragraf/qdrant_data/
    |    +--> Port 6333
    |    +--> Health check: GET http://localhost:6333/healthz
    |
    +--> Wait for Qdrant healthy
    |
    +--> Start paragraf-backend.exe sidecar
    |    +--> PyInstaller-bundled FastAPI + ML dependencies
    |    +--> ENV: QDRANT_URL=http://localhost:6333
    |    +--> ENV: HF_HOME=%APPDATA%/Paragraf/models/
    |    +--> ENV: DATA_DIR=%APPDATA%/Paragraf/data/
    |    +--> Port 8000
    |
    +--> Set window.__PARAGRAF_API_BASE_URL__ = "http://localhost:8000"
    |
    +--> Load React SPA in WebView
    |
    +--> First run? Show model download wizard
    |    +--> Download bge-m3 (~2GB) with progress
    |    +--> Download bge-reranker-v2-m3 (~2GB) with progress
    |
    +--> useHealthCheck polls as normal
    |
    v
User interacts with app normally

On app close:
    +--> Send SIGTERM to paragraf-backend.exe
    +--> Send SIGTERM to qdrant.exe
    +--> Wait for graceful shutdown (5s timeout, then force kill)
```

### Native Mode: File Paths

| Data | Location | Size |
|------|----------|------|
| Qdrant storage | `%APPDATA%/Paragraf/qdrant_data/` | ~500MB-2GB depending on indexed laws |
| ML models | `%APPDATA%/Paragraf/models/` | ~4GB (bge-m3 + reranker) |
| Law data (raw + processed) | `%APPDATA%/Paragraf/data/` | ~200MB |
| App config | `%APPDATA%/Paragraf/config.json` | <1KB |
| Qdrant binary | Bundled in installer OR `%LOCALAPPDATA%/Paragraf/bin/` | ~40MB |
| Backend exe | Bundled in installer | ~200-400MB (PyInstaller with torch CPU) |

## Architecture Decisions

### Why Tauri 2, Not Electron

| Factor | Tauri 2 | Electron | Decision |
|--------|---------|----------|----------|
| Installer size | ~10MB shell + sidecars | ~100MB+ (Chromium) + sidecars | Tauri wins |
| RAM idle | ~30-40MB | ~200-300MB | Tauri wins -- ML models already use 4GB+ |
| Sidecar support | First-class `externalBin` | Manual child_process | Tauri wins |
| Windows installer | Built-in NSIS bundler | electron-builder (NSIS/Squirrel) | Tie |
| WebView | System WebView2 (Edge) | Bundled Chromium | Tauri -- smaller, but WebView2 dependency |
| Rust backend | Native -- can manage processes efficiently | Node.js main process | Tauri wins for process management |
| React integration | WebView loads built assets | Chromium loads built assets | Tie |
| Learning curve | Minimal Rust needed for shell | Pure JS/TS | Electron slightly easier |

**Decision: Tauri 2** because the app is already 4GB+ with ML models. Adding 100MB of Chromium (Electron) on top is wasteful. Tauri's native process management in Rust is ideal for managing qdrant.exe and backend.exe sidecars. Windows 10/11 ships with WebView2 (Edge-based), so no extra download needed.

### Why PyInstaller for Native Backend, Not Embedded Python

Options considered:
1. **PyInstaller** -- bundle Python + FastAPI + torch into single .exe
2. **Embedded Python** -- ship python3.12.zip + pip install at runtime
3. **Nuitka** -- compile Python to C, then native binary

**Decision: PyInstaller** because:
- Proven pattern with FastAPI + uvicorn (multiple production examples)
- Single .exe simplifies sidecar management
- Torch CPU-only keeps size at ~200-400MB (not 3GB+ with CUDA)
- Spec files handle hidden imports (FlagEmbedding, sentence-transformers)
- GPU mode: user installs CUDA toolkit separately, backend detects at runtime

### Why Not Bundle ML Models in Installer

The installer should NOT include the ~4GB of ML models because:
- Installer download would be 4.5GB+ -- unacceptable for distribution
- Models update independently of app code
- First-run download with progress bar is standard UX (see: Ollama, LM Studio)
- Models are cached in `%APPDATA%/Paragraf/models/` across reinstalls

### Headless Docker Compose (No Frontend Container)

Current `docker-compose.yml` has 4 services. For desktop mode, create `docker-compose.headless.yml`:
- Removes `frontend` service entirely
- Keeps qdrant, backend, mcp
- Backend exposes port 8000 to host (already does)
- MCP exposes port 8001 to host (already does)
- Tauri WebView connects to `http://localhost:8000` directly

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Tauri Shell** | Window, tray, first-run wizard, app config | Process Manager, Docker Manager, WebView |
| **Process Manager** | Start/stop/health native sidecars | qdrant.exe, backend.exe |
| **Docker Manager** | docker compose up/down/ps | Docker CLI, docker-compose.headless.yml |
| **Model Manager** | Download ML models with progress | HuggingFace Hub (HTTPS), Tauri events |
| **GPU Detector** | Detect CUDA, set EMBEDDING_DEVICE | System NVIDIA driver, backend env vars |
| **Setup Wizard** | First-run mode selection, model download | Tauri commands (invoke), Model Manager |
| **React SPA** | All user-facing UI (unchanged) | Backend REST API via fetch() |
| **Backend** | FastAPI REST + ML pipeline (unchanged) | Qdrant, filesystem |
| **Qdrant** | Vector storage (unchanged) | Backend via gRPC/HTTP |

## Tauri IPC Design

Tauri uses a command pattern for frontend-to-backend communication:

```rust
// src-tauri/src/main.rs -- Tauri commands
#[tauri::command]
fn get_app_config() -> AppConfig { ... }

#[tauri::command]
async fn start_backend(mode: &str) -> Result<(), String> { ... }

#[tauri::command]
async fn stop_backend() -> Result<(), String> { ... }

#[tauri::command]
async fn get_backend_status() -> BackendStatus { ... }

#[tauri::command]
async fn download_models(app: AppHandle) -> Result<(), String> {
    // Emit progress events to frontend
    app.emit("model-download-progress", payload)?;
    ...
}

#[tauri::command]
fn detect_gpu() -> GpuInfo { ... }

#[tauri::command]
fn check_docker_available() -> bool { ... }
```

```typescript
// Frontend calls via @tauri-apps/api
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const config = await invoke<AppConfig>("get_app_config");
await invoke("start_backend", { mode: "native" });
const status = await invoke<BackendStatus>("get_backend_status");

// Listen for model download progress
const unlisten = await listen("model-download-progress", (event) => {
  setProgress(event.payload as ProgressPayload);
});
```

### Conditional Tauri vs Browser

The React SPA must work in BOTH Tauri WebView and regular browser (for Docker-only users who skip the desktop app). Use feature detection:

```typescript
// lib/platform.ts
export const isTauri = () => "__TAURI_INTERNALS__" in window;

// Only import Tauri APIs when running in Tauri
export async function invokeIfTauri<T>(cmd: string, args?: object): Promise<T | null> {
  if (!isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}
```

## Directory Structure (New Files)

```
paragraf v2/
├── desktop/                          # NEW: Tauri desktop shell
│   ├── src-tauri/
│   │   ├── Cargo.toml               # Rust dependencies
│   │   ├── tauri.conf.json          # App config, NSIS settings, sidecars
│   │   ├── build.rs                 # Build script
│   │   ├── icons/                   # App icons (ICO, PNG)
│   │   ├── bin/                     # Sidecar binaries (built, not committed)
│   │   │   ├── qdrant-x86_64-pc-windows-msvc.exe
│   │   │   └── paragraf-backend-x86_64-pc-windows-msvc.exe
│   │   └── src/
│   │       ├── main.rs              # Tauri entry point + commands
│   │       ├── process_manager.rs   # Sidecar lifecycle (start/stop/health)
│   │       ├── docker_manager.rs    # Docker compose lifecycle
│   │       ├── model_manager.rs     # ML model download with progress
│   │       ├── gpu_detect.rs        # CUDA/GPU detection
│   │       └── config.rs            # App configuration (mode, paths)
│   ├── docker-compose.headless.yml  # 3-service compose (no frontend)
│   └── scripts/
│       ├── build-backend-exe.sh     # PyInstaller build script
│       └── download-qdrant.sh       # Fetch qdrant binary for bundling
├── frontend/                         # EXISTING: minimal changes
│   ├── src/
│   │   ├── lib/platform.ts          # NEW: Tauri detection utility
│   │   ├── pages/SetupPage.tsx      # NEW: First-run wizard
│   │   └── hooks/useDesktop.ts      # NEW: Tauri IPC hooks
│   └── ...
├── backend/                          # EXISTING: minimal changes
│   ├── paragraf.spec                 # NEW: PyInstaller spec file
│   └── ...
└── ...
```

## Installer Flow

### Tauri NSIS Installer (Built-in)

Tauri 2 generates Windows NSIS installers natively. The installer:

1. Checks for WebView2 (installs if missing -- rare on Win10/11)
2. Installs Tauri app + bundled frontend assets
3. Registers Start Menu shortcut + desktop icon
4. Includes sidecar binaries (qdrant.exe, paragraf-backend.exe) for Native mode
5. Does NOT include ML models (downloaded on first run)

### First-Run Setup Wizard

```
Welcome Screen
    |
    v
Mode Selection:
    [Docker Mode] -- "Recommended if Docker Desktop is installed"
    [Native Mode] -- "Standalone, no Docker needed"
    |               |
    v               v
Docker Check:    GPU Detection:
  Installed?       CUDA available?
  Running?         Which GPU?
    |               |
    v               v
Model Download (both modes):
  bge-m3 (~2GB)         [=====>    ] 65%
  bge-reranker (~2GB)   [waiting...]
    |
    v
Initial Law Index (optional):
  "Index core German laws now? (~5 min)"
  [Yes] [Later]
    |
    v
Ready!
```

## Scalability: Mac/Linux Later

The architecture is designed for Windows-first but extensible:

| Concern | Windows (now) | macOS (later) | Linux (later) |
|---------|---------------|---------------|---------------|
| Shell | Tauri NSIS installer | Tauri .dmg bundle | Tauri .AppImage/.deb |
| WebView | WebView2 (Edge) | WKWebView (Safari) | WebKitGTK |
| Qdrant binary | x86_64-pc-windows-msvc.zip | x86_64-apple-darwin.tar.gz | x86_64-unknown-linux-musl.tar.gz |
| Backend exe | PyInstaller --onefile (Windows) | PyInstaller --onefile (macOS) | PyInstaller --onefile (Linux) |
| GPU | CUDA (NVIDIA) | Metal (Apple Silicon) | CUDA (NVIDIA) |

Tauri's cross-platform nature means the Rust process manager code works on all platforms with minimal platform-specific logic (mainly path conventions and signal handling).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding Frontend in Electron/Tauri Build Pipeline
**What:** Making the React build part of the Tauri build step
**Why bad:** Couples two independent build pipelines, slower iteration
**Instead:** Build frontend separately (`npm run build`), copy `dist/` into Tauri's assets. Tauri loads pre-built assets.

### Anti-Pattern 2: Custom IPC for Every API Call
**What:** Routing all REST API calls through Tauri IPC instead of direct HTTP
**Why bad:** Duplicates all API types in Rust, adds latency, breaks browser compatibility
**Instead:** Frontend talks to backend via HTTP (same as today). Only use Tauri IPC for desktop-specific actions (start/stop backend, download models, detect GPU).

### Anti-Pattern 3: Bundling ML Models in the Installer
**What:** Including 4GB of model files in the installer download
**Why bad:** 4.5GB+ installer, models update independently, wastes bandwidth on reinstall
**Instead:** Download models on first run with progress UI. Cache in %APPDATA%.

### Anti-Pattern 4: Single Process (Backend inside Tauri)
**What:** Running FastAPI inside the Tauri Rust process via PyO3
**Why bad:** Crashes take down the whole app, complex build, can't restart backend independently
**Instead:** Sidecar pattern -- backend runs as separate process, managed by Tauri.

## Sources

- [Tauri 2 Sidecar Documentation](https://v2.tauri.app/develop/sidecar/)
- [Tauri 2 Windows Installer (NSIS)](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri+FastAPI Sidecar Template](https://github.com/AlanSynn/vue-tauri-fastapi-sidecar-template)
- [Tauri+Python Sidecar Example](https://github.com/dieharders/example-tauri-v2-python-server-sidecar)
- [Building Production Desktop LLM Apps with Tauri+FastAPI+PyInstaller](https://aiechoes.substack.com/p/building-production-ready-desktop)
- [Qdrant v1.13.2 Releases (Windows binary confirmed)](https://github.com/qdrant/qdrant/releases/tag/v1.13.2)
- [Sidecar Lifecycle Management Plugin proposal](https://github.com/tauri-apps/plugins-workspace/issues/3062)
- [PyInstaller FastAPI example](https://github.com/iancleary/pyinstaller-fastapi)
- [Tauri vs Electron comparison (DoltHub)](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)
- [Tauri vs Electron (Hopp)](https://www.gethopp.app/blog/tauri-vs-electron)

# Phase 16: Model Download & GPU Configuration - Research

**Researched:** 2026-03-31
**Domain:** ML model lifecycle management, GPU detection in Docker, download progress streaming
**Confidence:** HIGH

## Summary

This phase adds automatic ML model downloading with progress feedback, GPU/CUDA detection and switching, and model cache management to the Paragraf Docker web app. The core challenge is bridging the gap between HuggingFace Hub's Python download API (which provides tqdm-based progress) and the React frontend (which needs real-time byte-level updates via SSE).

The existing codebase already has: (1) a working SSE pattern for law indexing progress, (2) a `/api/settings/gpu` endpoint with `torch.cuda` detection, (3) a `docker-compose.gpu.yml` overlay for NVIDIA GPU passthrough, (4) a `download_models.py` script (no progress), (5) a `SetupWizard.tsx` with step-based navigation, and (6) a `ProgressBar.tsx` component. The implementation extends these existing patterns rather than building new infrastructure.

**Primary recommendation:** Use `huggingface_hub.snapshot_download()` with a custom `tqdm_class` that forwards byte-level progress to an SSE stream, one model at a time. GPU switching triggers a backend restart via the Electron IPC layer (desktop mode) or manual `docker compose` restart (web-only mode).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Model-Download findet als eigener Schritt im Setup-Wizard statt (nach Docker-Check, vor GPU-Erkennung). Download ist Pflicht -- Wizard blockiert bis alle Modelle heruntergeladen sind.
- **D-02:** Fortschrittsanzeige zeigt **pro-Modell-Balken** (BAAI/bge-m3 + BAAI/bge-reranker-v2-m3 separat). Jeder Balken zeigt: Modellname, Fortschritt in %, heruntergeladene/gesamte GB, Geschwindigkeit, geschaetzte Restzeit.
- **D-03:** Download unterstuetzt **Resume** -- bei Abbruch oder Neustart setzt der Download dort fort wo er aufgehoert hat (HuggingFace Hub Range-Requests).
- **D-04:** GPU-Erkennung erfolgt **automatisch im Setup-Wizard** als Schritt nach dem Model-Download. Prueft nvidia-smi im Container. Wenn GPU erkannt: Nutzer kann GPU-Modus aktivieren (empfohlen) oder CPU beibehalten. Wenn keine GPU: stille Weiterarbeit auf CPU.
- **D-05:** CPU/GPU-Wechsel in den Settings via **Docker-Neustart mit Feedback**. Toggle in SettingsPage, beim Wechsel wird Docker Compose mit/ohne GPU-Override neu gestartet. HealthOverlay zeigt "Backend wird neu gestartet..." waehrend des Wechsels (~30s).
- **D-06:** Erweiterter Cache-Bereich in SettingsPage: Pfad anzeigen, Groesse in GB, Aufschluesselung pro Modell (Name + Groesse + Status), **Pfad nachtraeglich aenderbar** (Ordner-Dialog, Modelle werden verschoben/neu heruntergeladen).
- **D-07:** Cache-Loeschen mit **Bestaetigungsdialog** ("Modelle werden geloescht, beim naechsten Start automatisch neu heruntergeladen"). Nach Bestaetigung: Cache leeren, beim naechsten App-Start Download-Schritt erneut anzeigen.
- **D-08:** Netzwerk-Abbruch waehrend Download: **Auto-Retry** (3 Versuche mit Backoff) + Resume-Support. Nach 3 Fehlversuchen: Fehlermeldung mit "Erneut versuchen"-Button.
- **D-09:** GPU-Wechsel fehlschlaegt: **automatischer Fallback auf CPU**. Nutzer bekommt Hinweis "GPU-Modus konnte nicht aktiviert werden. CPU-Modus wird verwendet." Settings zeigt weiterhin CPU.
- **D-10:** Speicherplatz-Pruefung **vor dem Download**: freien Platz am Cache-Pfad pruefen. Wenn <5GB frei: Warnung mit aktuellem/benoetigtem Platz, Option "Pfad aendern" oder "Trotzdem versuchen".

### Claude's Discretion
- Technische Implementierung des Resume-Supports (HuggingFace Hub API vs. eigene Range-Request-Logik)
- Exakte Wizard-Schritt-Nummerierung und -Integration in bestehenden SetupWizard.tsx
- Backend-API-Design fuer Download-Fortschritt (SSE-Stream vs. Polling)
- Docker Compose GPU-Override-Mechanismus (Environment-Variable vs. Compose-File-Wechsel)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODEL-01 | ML-Modelle (~4GB) werden beim ersten Start automatisch heruntergeladen mit Fortschrittsbalken | HuggingFace Hub `snapshot_download` with custom `tqdm_class` for progress; SSE stream pattern from existing indexing code; new backend endpoint + wizard step |
| MODEL-02 | GPU/CUDA wird automatisch erkannt und konfiguriert (nvidia-smi + torch.cuda) | Existing `/api/settings/gpu` endpoint already detects via `torch.cuda`; extend to also check `nvidia-smi` subprocess; GPU step in wizard after download |
| MODEL-03 | Nutzer kann zwischen CPU und GPU zur Laufzeit wechseln (Settings) | Toggle in SettingsPage; backend endpoint to switch `EMBEDDING_DEVICE` env var; requires container restart via Electron IPC (desktop) or manual compose restart (web-only) |
| MODEL-04 | Model-Cache kann in den Einstellungen verwaltet werden (Pfad, Groesse, Loeschen) | New backend endpoints for cache info (`shutil.disk_usage`, `os.walk` for sizes), cache clear (`shutil.rmtree`), path change; frontend cache management section in SettingsPage |
</phase_requirements>

## Standard Stack

### Core (already in project -- no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| huggingface_hub | (transitive via FlagEmbedding, transformers) | Model downloading with progress, resume, caching | Official HF library; already installed as transitive dep; built-in resume and retry |
| torch | >=2.2.0 | `torch.cuda.is_available()` for GPU detection | Already a project dependency |
| FastAPI StreamingResponse | (via fastapi) | SSE stream for download progress | Already used for indexing progress (proven pattern in `api.py` line 1246) |
| shutil | stdlib | `disk_usage()` for free space check, `rmtree()` for cache deletion | Python stdlib, cross-platform |
| pathlib | stdlib | Path operations for cache management | Python stdlib |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tqdm | (transitive via huggingface_hub) | Base class for custom progress bar | Needed to create custom `tqdm_class` for `snapshot_download` |
| subprocess | stdlib | Run `nvidia-smi` inside container | GPU detection fallback when torch.cuda might not reflect actual GPU availability |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `snapshot_download` with tqdm_class | Manual `hf_hub_download` per file | snapshot_download handles file enumeration, concurrency, and caching automatically; manual approach gives finer control but duplicates existing logic |
| SSE for progress | WebSocket | SSE is simpler (unidirectional), matches existing indexing pattern, works through nginx reverse proxy without config changes |
| SSE for progress | Polling endpoint | Polling adds latency and unnecessary requests; SSE gives real-time updates; pattern already proven in codebase |

**No `npm install` or `pip install` needed** -- all required libraries are already in the dependency tree.

## Architecture Patterns

### Recommended Project Structure (new/modified files)
```
backend/src/paragraf/
├── api.py                    # New endpoints: /api/models/download (SSE), /api/models/status,
│                             #   /api/models/cache, /api/models/cache/clear, /api/settings/gpu (extended)
├── api_models.py             # New models: ModelDownloadEvent, ModelStatusResponse, CacheInfoResponse,
│                             #   GpuDetectionResponse (extended)
├── services/
│   └── model_manager.py      # NEW: ModelManager class -- download orchestration, cache ops, GPU detection
└── config.py                 # (no changes needed -- HF_HOME already configured via env vars)

frontend/src/
├── components/
│   ├── SetupWizard.tsx       # Add 2 new steps: ModelDownload, GpuDetection
│   ├── SetupSteps/
│   │   ├── ModelDownloadStep.tsx  # NEW: Download progress UI with per-model bars
│   │   └── GpuDetectionStep.tsx   # NEW: Auto-detect GPU, offer enable/skip
│   └── ProgressBar.tsx       # Extend with speed/ETA display variant
├── pages/
│   └── SettingsPage.tsx      # Add: GPU toggle section, Cache management section
└── lib/
    └── api.ts                # New API methods: downloadModels (SSE), modelStatus, cacheInfo, clearCache, switchGpu
```

### Pattern 1: SSE Download Progress (Backend)
**What:** Backend streams download progress via SSE, identical pattern to existing `/api/index` endpoint.
**When to use:** For MODEL-01 (download progress streaming).
**Example:**
```python
# Source: Existing pattern in backend/src/paragraf/api.py lines 1069-1247

from huggingface_hub import snapshot_download
from tqdm.auto import tqdm as tqdm_auto
import time

class ProgressTqdm(tqdm_auto):
    """Custom tqdm that forwards progress to a callback."""

    _callback = None  # Class-level; set before download

    def update(self, n=1):
        super().update(n)
        if self._callback and self.total:
            self._callback(self.n, self.total)

@app.post("/api/models/download")
async def download_models(request: Request) -> StreamingResponse:
    progress_state = {}

    def _event(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    async def _stream() -> AsyncIterator[str]:
        models = [
            ("BAAI/bge-m3", "Embedding-Modell"),
            ("BAAI/bge-reranker-v2-m3", "Reranker-Modell"),
        ]
        hf_home = os.environ.get("HF_HOME", "/models")

        # Check disk space first (D-10)
        disk = shutil.disk_usage(hf_home)
        yield _event({"type": "disk_check", "free_gb": disk.free / (1024**3)})

        for model_id, label in models:
            yield _event({
                "type": "start",
                "model": model_id,
                "label": label,
            })

            def on_progress(current_bytes, total_bytes):
                progress_state[model_id] = (current_bytes, total_bytes)

            ProgressTqdm._callback = on_progress

            try:
                await asyncio.to_thread(
                    snapshot_download,
                    model_id,
                    cache_dir=hf_home,
                    tqdm_class=ProgressTqdm,
                )
                yield _event({"type": "complete", "model": model_id})
            except Exception as e:
                yield _event({"type": "error", "model": model_id, "message": str(e)})

        yield _event({"type": "all_complete"})

    return StreamingResponse(_stream(), media_type="text/event-stream")
```

### Pattern 2: Frontend SSE Consumption (matching existing `indexGesetze` pattern)
**What:** Frontend consumes SSE stream using `fetch` + `ReadableStream`, exact same approach as `api.indexGesetze()`.
**When to use:** For model download progress UI.
**Example:**
```typescript
// Source: Existing pattern in frontend/src/lib/api.ts lines 467-521

downloadModels: (
  onProgress: (event: ModelDownloadEvent) => void,
  onComplete?: () => void,
): { cancel: () => void } => {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/models/download`, {
        method: "POST",
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) { onComplete?.(); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              onProgress(event);
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") console.error("Download-Stream Fehler:", e);
    } finally {
      onComplete?.();
    }
  })();

  return { cancel: () => controller.abort() };
},
```

### Pattern 3: GPU Detection Endpoint (Backend)
**What:** Extend existing `/api/settings/gpu` to include `nvidia-smi` subprocess check alongside `torch.cuda`.
**When to use:** For MODEL-02 (GPU detection in wizard and settings).
**Example:**
```python
# Source: Extend existing backend/src/paragraf/api.py lines 329-340

import subprocess

@app.get("/api/settings/gpu")
async def get_gpu_info() -> GpuDetectionResponse:
    result = GpuDetectionResponse()

    # Check nvidia-smi first (available even if torch not loaded)
    try:
        output = await asyncio.to_thread(
            subprocess.check_output,
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            timeout=5,
        )
        lines = output.decode().strip().split("\n")
        if lines and lines[0]:
            parts = lines[0].split(", ")
            result.nvidia_smi_available = True
            result.gpu_name = parts[0] if parts else ""
            result.vram_total_mb = int(parts[1]) if len(parts) > 1 else 0
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass

    # Check torch.cuda
    try:
        import torch
        result.cuda_available = torch.cuda.is_available()
        if result.cuda_available and not result.gpu_name:
            result.gpu_name = torch.cuda.get_device_name(0)
            result.vram_total_mb = int(torch.cuda.get_device_properties(0).total_memory / 1024 / 1024)
    except Exception:
        pass

    # Current device setting
    result.current_device = settings.embedding_device

    return result
```

### Pattern 4: Cache Management (Backend)
**What:** New endpoints for cache info retrieval and cache clearing.
**When to use:** For MODEL-04 (cache management in settings).
**Example:**
```python
import os
import shutil

@app.get("/api/models/cache")
async def get_cache_info() -> CacheInfoResponse:
    hf_home = os.environ.get("HF_HOME", "/models")
    disk = shutil.disk_usage(hf_home)

    models = []
    hub_dir = os.path.join(hf_home, "hub")
    if os.path.exists(hub_dir):
        for entry in os.scandir(hub_dir):
            if entry.is_dir() and entry.name.startswith("models--"):
                model_name = entry.name.replace("models--", "").replace("--", "/")
                size = sum(f.stat().st_size for f in Path(entry.path).rglob("*") if f.is_file())
                models.append(ModelCacheEntry(
                    name=model_name,
                    size_mb=round(size / (1024 * 1024)),
                    path=entry.path,
                ))

    return CacheInfoResponse(
        cache_path=hf_home,
        total_size_mb=sum(m.size_mb for m in models),
        free_space_mb=round(disk.free / (1024 * 1024)),
        models=models,
    )

@app.delete("/api/models/cache")
async def clear_cache() -> dict:
    hf_home = os.environ.get("HF_HOME", "/models")
    hub_dir = os.path.join(hf_home, "hub")
    if os.path.exists(hub_dir):
        await asyncio.to_thread(shutil.rmtree, hub_dir)
    return {"erfolg": True, "nachricht": "Model-Cache geloescht"}
```

### Anti-Patterns to Avoid
- **Blocking the event loop during download:** Always use `asyncio.to_thread()` for `snapshot_download` calls. The download is CPU/IO-bound and will freeze the FastAPI server if run synchronously.
- **Building custom HTTP download logic:** Do NOT implement Range-Request resume logic manually. `huggingface_hub` handles this automatically. Resume is built-in since v0.23.0+.
- **WebSocket for unidirectional progress:** SSE is simpler and already proven in the codebase. WebSocket adds connection complexity and nginx config changes for no benefit.
- **Storing GPU preference in backend config:** GPU mode is a Docker Compose concern (`EMBEDDING_DEVICE` env var). The backend reads it from env at startup. Switching requires container restart, not config file editing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model download with resume | Custom HTTP client with Range headers | `huggingface_hub.snapshot_download()` | Built-in resume, parallel downloads, cache management, integrity checks |
| Disk space checking | Platform-specific `os.statvfs` / `ctypes.windll` | `shutil.disk_usage()` | Cross-platform stdlib, works on Linux containers |
| Progress bar tracking | Custom byte counting on HTTP streams | Custom `tqdm_class` extending `tqdm.auto.tqdm` | tqdm is already the interface HF uses; custom class intercepts existing progress events |
| Model file enumeration | Walking HF cache directory structure manually | `huggingface_hub.scan_cache_dir()` | Official API for inspecting the HF cache; handles all edge cases of the versioned cache layout |
| SSE event formatting | Custom string building | `f"data: {model.model_dump_json()}\n\n"` | Exact pattern already used in indexing SSE (api.py line 1077) |

**Key insight:** The HuggingFace Hub library already handles the hard parts (resume, parallel file downloads within a model, cache versioning, integrity verification). The main engineering work is bridging HF's tqdm-based progress to an SSE stream.

## Common Pitfalls

### Pitfall 1: tqdm_class Progress Granularity
**What goes wrong:** `snapshot_download` uses `tqdm_class` for the OVERALL file-count progress bar, but individual file download progress (bytes) uses its own internal tqdm bars. A naive custom `tqdm_class` only sees "file 1 of N done", not byte-level progress.
**Why it happens:** HuggingFace Hub has a two-level progress system: outer (files) and inner (bytes per file).
**How to avoid:** Use `hf_hub_download()` for each file individually instead of `snapshot_download()`, OR intercept the inner tqdm by monkey-patching `huggingface_hub.utils.tqdm`. The simpler approach: call `hf_hub_download()` per known file with the custom `tqdm_class`, which DOES get byte-level progress.
**Warning signs:** Progress bar jumps from 0% to 50% to 100% instead of smooth byte-level updates.

### Pitfall 2: torch.cuda vs nvidia-smi Mismatch in Docker
**What goes wrong:** `nvidia-smi` works inside the container (NVIDIA Container Toolkit installed) but `torch.cuda.is_available()` returns False.
**Why it happens:** The PyTorch build must match the CUDA version. The project uses CPU-only PyTorch (`torch>=2.2.0` installed from `pytorch.org/whl/cpu`). CPU-only PyTorch will NEVER report `torch.cuda.is_available() == True`, regardless of GPU hardware.
**How to avoid:** For GPU detection in the wizard step, rely on `nvidia-smi` subprocess call first. `torch.cuda` is only valid when the GPU-enabled container is running (with CUDA-enabled PyTorch). The wizard GPU step should check `nvidia-smi` availability, not `torch.cuda`.
**Warning signs:** GPU always shows as unavailable even on NVIDIA systems.

### Pitfall 3: Docker Volume Model Cache Path
**What goes wrong:** D-06 says "Pfad nachtraeglich aenderbar" but the model cache is a Docker volume (`model_cache:/models`). Changing the path from inside the container is meaningless -- it requires changing the Docker Compose volume mount.
**Why it happens:** Docker volumes abstract away host paths. The container always sees `/models`.
**How to avoid:** In Docker-only mode (web-only), the cache path display should show the Docker volume name, and path changing requires Docker Compose config modification (which may need Electron IPC in desktop mode or manual docker-compose.yml editing in web-only mode). In desktop mode, the Electron layer manages volume mounts. For web-only users, cache path is informational only (read-only).
**Warning signs:** User changes path in UI but models don't appear in new location.

### Pitfall 4: GPU Switch Requires Container Restart
**What goes wrong:** User toggles GPU in settings, expects instant switch, but nothing happens.
**Why it happens:** `EMBEDDING_DEVICE` is an environment variable read at container startup. Changing it requires `docker compose down && docker compose -f ... up`.
**How to avoid:** The GPU toggle must clearly communicate that a restart is needed. In desktop mode, the Electron layer triggers `docker compose` restart. In web-only Docker mode, the backend cannot restart itself -- it can only set a flag and instruct the user. The recommended approach: backend exposes an endpoint to signal desired device, and the Electron IPC layer (or a manual user action) performs the actual restart.
**Warning signs:** Toggle flips but device doesn't actually change until manual restart.

### Pitfall 5: Concurrent Download Requests
**What goes wrong:** User clicks download, navigates away, comes back, clicks download again -- two parallel downloads corrupt the cache.
**Why it happens:** No server-side lock on the download operation.
**How to avoid:** Use an `asyncio.Lock` in the backend to ensure only one download runs at a time. Return "already downloading" status if a second request comes in while download is active. Frontend should also check model status before offering download button.
**Warning signs:** Corrupted model files, duplicate downloads consuming bandwidth.

### Pitfall 6: SSE Through nginx Proxy Buffering
**What goes wrong:** SSE events arrive in large batches instead of real-time.
**Why it happens:** nginx buffers responses by default.
**How to avoid:** The existing `nginx.conf` already has `proxy_buffering off` for `/api/*` routes (set up for indexing SSE). Verify this applies to the new `/api/models/download` endpoint too. No additional nginx config needed since the route is under `/api/`.
**Warning signs:** Progress bar stays at 0% for a long time, then jumps to 100%.

## Code Examples

### Model Status Check Endpoint
```python
# Source: New endpoint pattern based on existing /api/settings/gpu

class ModelStatusResponse(BaseModel):
    models_ready: bool = False
    models: list[ModelInfo] = Field(default_factory=list)
    downloading: bool = False

class ModelInfo(BaseModel):
    name: str
    label: str
    downloaded: bool = False
    size_mb: int = 0

@app.get("/api/models/status")
async def get_model_status() -> ModelStatusResponse:
    hf_home = os.environ.get("HF_HOME", "/models")
    hub_dir = os.path.join(hf_home, "hub")

    models_info = []
    for model_id, label in [
        ("BAAI/bge-m3", "Embedding-Modell"),
        ("BAAI/bge-reranker-v2-m3", "Reranker-Modell"),
    ]:
        cache_name = f"models--{model_id.replace('/', '--')}"
        model_path = os.path.join(hub_dir, cache_name)
        is_downloaded = os.path.exists(model_path) and any(
            Path(model_path).rglob("*.safetensors")
        )
        size = 0
        if is_downloaded:
            size = sum(f.stat().st_size for f in Path(model_path).rglob("*") if f.is_file())

        models_info.append(ModelInfo(
            name=model_id,
            label=label,
            downloaded=is_downloaded,
            size_mb=round(size / (1024 * 1024)),
        ))

    return ModelStatusResponse(
        models_ready=all(m.downloaded for m in models_info),
        models=models_info,
    )
```

### Setup Wizard Step Integration
```typescript
// Source: Pattern based on existing SetupWizard.tsx

// Updated STEPS array
const STEPS = [
  { id: "welcome", label: "Willkommen" },
  { id: "mode", label: "Modus" },
  { id: "docker", label: "Docker" },
  { id: "storage", label: "Speicher" },
  { id: "download", label: "Modelle" },     // NEW
  { id: "gpu", label: "GPU" },              // NEW
  { id: "summary", label: "Fertig" },
] as const;
```

### Download Progress Event Types
```typescript
// Source: New types for frontend/src/lib/api.ts

interface ModelDownloadEvent {
  type: "disk_check" | "start" | "progress" | "complete" | "error" | "all_complete";
  model?: string;
  label?: string;
  // For type=progress:
  downloaded_bytes?: number;
  total_bytes?: number;
  speed_mbps?: number;
  eta_seconds?: number;
  // For type=disk_check:
  free_gb?: number;
  // For type=error:
  message?: string;
  retryable?: boolean;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `resume_download=True` param | Always resumes (param deprecated) | huggingface_hub 0.23.0 (2024) | No need to pass resume_download; just call download again |
| `requests` HTTP library | `httpx` for downloads | huggingface_hub 0.26+ | Already compatible; no action needed |
| Manual tqdm progress bars | `tqdm_class` parameter on download functions | huggingface_hub 0.20+ | Official way to customize progress reporting |
| Docker `--runtime nvidia` | `deploy.resources.reservations.devices` | Docker Compose v2.x | Already used in existing `docker-compose.gpu.yml` |

**Deprecated/outdated:**
- `resume_download` parameter: Deprecated since huggingface_hub 0.23.0. Downloads always resume automatically.
- `docker --runtime nvidia`: Replaced by `deploy.resources.reservations.devices` in compose files (already correct in project).

## Open Questions

1. **Per-file byte-level progress with snapshot_download**
   - What we know: `snapshot_download`'s `tqdm_class` controls the outer file-count bar, not inner byte progress.
   - What's unclear: Whether the custom `tqdm_class` is also used for inner per-file progress in newer versions of huggingface_hub.
   - Recommendation: Use `hf_hub_download()` for each known model file individually. This gives reliable byte-level progress via `tqdm_class`. For bge-m3, the main files are `model.safetensors` (~2.2GB) and config files. Pre-enumerate files using `huggingface_hub.list_repo_files()` then download the large ones with progress tracking.

2. **GPU switch in web-only (non-Electron) mode**
   - What we know: In desktop/Electron mode, the Electron layer can restart Docker Compose. In web-only mode, the backend container cannot restart itself.
   - What's unclear: How to handle GPU switching for users running only `docker compose up`.
   - Recommendation: For web-only mode, show instructions ("Run `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build`"). For desktop mode, the Electron IPC handles restart. The toggle should be disabled or show instructions in web-only mode.

3. **Cache path change in Docker mode**
   - What we know: The model cache is a Docker named volume (`model_cache:/models`). The path inside the container is always `/models`.
   - What's unclear: How to implement D-06 "Pfad nachtraeglich aenderbar" when the path is controlled by Docker volume mounts.
   - Recommendation: In desktop mode, changing the path means updating the Docker Compose volume mount source (Electron manages this). In web-only mode, path is read-only/informational. Display the volume name and explain that the path is managed by Docker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 8.0+ with pytest-asyncio |
| Config file (backend) | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command (backend) | `docker compose exec backend python -m pytest tests/test_model_manager.py -x` |
| Framework (frontend) | vitest 4.1+ with @testing-library/react |
| Quick run command (frontend) | `cd frontend && npx vitest run src/__tests__/ModelDownload.test.tsx` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODEL-01 | Download endpoint streams SSE events with progress | unit | `docker compose exec backend python -m pytest tests/test_model_manager.py::test_download_progress_events -x` | Wave 0 |
| MODEL-01 | Frontend ModelDownloadStep renders per-model progress bars | unit | `cd frontend && npx vitest run src/__tests__/ModelDownloadStep.test.tsx` | Wave 0 |
| MODEL-02 | GPU detection returns nvidia-smi + torch.cuda info | unit | `docker compose exec backend python -m pytest tests/test_model_manager.py::test_gpu_detection -x` | Wave 0 |
| MODEL-02 | GpuDetectionStep shows GPU found / not found UI | unit | `cd frontend && npx vitest run src/__tests__/GpuDetectionStep.test.tsx` | Wave 0 |
| MODEL-03 | GPU toggle sends switch request and shows restart feedback | unit | `cd frontend && npx vitest run src/__tests__/SettingsPage.test.tsx` | Wave 0 |
| MODEL-04 | Cache info endpoint returns model sizes and free space | unit | `docker compose exec backend python -m pytest tests/test_model_manager.py::test_cache_info -x` | Wave 0 |
| MODEL-04 | Cache clear endpoint removes hub directory | unit | `docker compose exec backend python -m pytest tests/test_model_manager.py::test_cache_clear -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `docker compose exec backend python -m pytest tests/test_model_manager.py -x`
- **Per wave merge:** `docker compose exec backend python -m pytest tests/ -v && cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_model_manager.py` -- covers MODEL-01 through MODEL-04 backend logic
- [ ] `frontend/src/__tests__/ModelDownloadStep.test.tsx` -- covers MODEL-01 download UI
- [ ] `frontend/src/__tests__/GpuDetectionStep.test.tsx` -- covers MODEL-02 GPU detection UI
- [ ] `frontend/src/__tests__/SettingsPage.test.tsx` -- covers MODEL-03 GPU toggle + MODEL-04 cache management

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/src/paragraf/api.py` (SSE pattern lines 1069-1247), `docker-compose.gpu.yml`, `backend/scripts/download_models.py`, `frontend/src/components/SetupWizard.tsx`, `frontend/src/lib/api.ts` (SSE consumption lines 467-521)
- [HuggingFace Hub Download Docs](https://huggingface.co/docs/huggingface_hub/guides/download) - Resume, caching, tqdm_class
- [HuggingFace Hub File Download Reference](https://huggingface.co/docs/huggingface_hub/package_reference/file_download) - `hf_hub_download`, `snapshot_download` API
- [Docker Compose GPU Support](https://docs.docker.com/compose/how-tos/gpu-support/) - NVIDIA device reservation syntax
- [Docker Desktop GPU on Windows](https://docs.docker.com/desktop/features/gpu/) - GPU passthrough requirements

### Secondary (MEDIUM confidence)
- [HuggingFace Hub Utilities](https://huggingface.co/docs/huggingface_hub/package_reference/utilities) - tqdm wrapper, progress bar customization
- [HuggingFace Hub Issue #1004](https://github.com/huggingface/huggingface_hub/issues/1004) - snapshot_download progress bar limitations
- [Streamlit progress discussion](https://discuss.streamlit.io/t/progress-when-downloading-with-huggingface-hub-snapshot-download/80775) - Custom tqdm_class patterns

### Tertiary (LOW confidence)
- [DeepWiki HF Hub File Download](https://deepwiki.com/huggingface/huggingface_hub/2.2-file-operations) - Internal architecture of download system (community-maintained)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project; no new dependencies needed
- Architecture: HIGH - SSE pattern proven in existing codebase; HF Hub API well-documented
- Pitfalls: HIGH - GPU/Docker issues well-documented in community forums; tqdm limitation confirmed by HF issue tracker
- Download progress granularity: MEDIUM - Per-file byte-level progress via `hf_hub_download` is proven, but `snapshot_download` tqdm_class behavior for inner progress needs runtime validation

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain; HF Hub API stable since v0.23)

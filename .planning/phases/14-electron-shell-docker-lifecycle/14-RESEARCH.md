# Phase 14: Electron Shell & Docker Lifecycle - Research

**Researched:** 2026-03-29
**Domain:** Electron desktop shell, Docker Compose lifecycle management, single-instance lock, health polling
**Confidence:** HIGH

## Summary

Phase 14 wraps the existing Paragraf web application in an Electron desktop window that automatically manages Docker Compose (start/stop) and provides visual backend health status. This is Docker-mode only -- no native Python/Qdrant process management. The existing React SPA becomes the Electron renderer, and the existing `useHealthCheck` hook continues to provide backend status, with the HealthOverlay adapted for desktop context.

The key architectural insight is that in Docker mode, Electron acts as a thin shell: it spawns `docker compose up`, loads the frontend from disk (not from nginx), and polls the backend health endpoint. The frontend nginx container is no longer needed when running in Electron. A headless docker-compose file (without the frontend service) is used.

**Primary recommendation:** Create a `desktop/` directory with electron-vite 5 configuration. Main process manages Docker Compose via `child_process.execFile` (never `exec` -- avoids shell injection). Frontend is built separately and loaded as the renderer. Use `app.requestSingleInstanceLock()` for single-instance, `tree-kill` for process cleanup, and the existing health polling for status display.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | Nutzer sieht die Paragraf-App in einem eigenen Desktop-Fenster (Electron) mit nativer Titelleiste | Electron BrowserWindow with default frame, loading built React SPA from file:// |
| SHELL-02 | App erscheint im Windows-Startmenue mit Icon und kann per Doppelklick gestartet werden | electron-builder NSIS creates Start Menu shortcut + desktop icon automatically |
| SHELL-03 | Nur eine Instanz der App kann gleichzeitig laufen (Single-Instance Lock) | `app.requestSingleInstanceLock()` + `second-instance` event to focus existing window |
| LIFE-01 | Backend (Docker Compose) startet automatisch beim App-Start und stoppt beim Schliessen | `child_process.execFile("docker", ["compose", ...])` in main process, `tree-kill` on quit |
| LIFE-02 | App zeigt Verbindungsstatus zum Backend (Health-Polling) mit visueller Anzeige | Existing `useHealthCheck` hook + `HealthOverlay` component, adapted for desktop context |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | ^41.1.0 | Desktop app shell (Chromium + Node.js) | Latest stable. Chromium 146, Node v24. Mature ecosystem (VS Code, Slack). |
| electron-vite | ^5.0.0 | Build tooling for Electron + Vite | Bridges existing Vite 6 frontend into Electron. Handles main/preload/renderer builds. |
| electron-builder | ^26.8.1 | Package Electron app + create NSIS installer | Most popular packager, native NSIS support, Start Menu shortcuts. Required for SHELL-02. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tree-kill | ^1.2.2 | Kill Docker Compose process tree on Windows | Always on Windows -- `child_process.kill()` does not kill child processes. Critical for LIFE-01 cleanup. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-vite | electron-forge | electron-forge lacks native NSIS; electron-vite aligns with existing Vite 6 |
| electron-builder | @electron-forge/maker-nsis | electron-builder has better NSIS support, more documentation |
| tree-kill | Windows Job Objects | Job Objects more robust but require native bindings; tree-kill is pure JS, good enough for Docker Compose |

**Installation (in desktop/ directory):**
```bash
npm install electron tree-kill
npm install -D electron-vite electron-builder @types/node typescript
```

**Version verification:**
| Package | Registry Version | Publish Date | Confidence |
|---------|-----------------|--------------|------------|
| electron | 41.1.0 | 2026-03-28 | HIGH (verified via npm view) |
| electron-vite | 5.0.0 | Dec 2025 | HIGH (verified via npm view) |
| electron-builder | 26.8.1 | Recent | HIGH (verified via npm view) |
| tree-kill | 1.2.2 | Stable | HIGH (verified via npm view) |

## Architecture Patterns

### Recommended Project Structure

```
paragraf v2/
+-- desktop/                          # NEW: Electron app
|   +-- package.json                  # Electron deps + build scripts
|   +-- electron-builder.yml          # NSIS installer config
|   +-- electron.vite.config.ts       # electron-vite config
|   +-- tsconfig.json                 # TypeScript config for main/preload
|   +-- tsconfig.node.json            # Node-specific TS config
|   +-- src/
|   |   +-- main/                     # Electron main process
|   |   |   +-- index.ts              # App entry, window creation, single-instance
|   |   |   +-- docker.ts             # Docker Compose lifecycle (start/stop/status)
|   |   |   +-- ipc.ts                # IPC handler registration
|   |   |   +-- window.ts             # BrowserWindow factory
|   |   |   +-- logger.ts             # Main process logging
|   |   +-- preload/                  # Preload scripts (IPC bridge)
|   |   |   +-- index.ts              # contextBridge exposing docker status
|   +-- resources/                    # Icons (ICO, PNG)
|   |   +-- icon.ico
|   |   +-- icon.png
+-- docker-compose.desktop.yml        # NEW: 3-service compose (no frontend)
+-- frontend/                         # EXISTING: unchanged source
+-- backend/                          # EXISTING: unchanged
+-- docker-compose.yml                # EXISTING: unchanged (4-service, for web users)
```

### Pattern 1: Docker Compose Lifecycle via child_process.execFile

**What:** Electron main process spawns `docker compose` using `execFile` (array args, no shell -- safe from injection), monitors its output, and kills it on app quit.
**When to use:** Always for LIFE-01.
**Example:**

```typescript
// desktop/src/main/docker.ts
import { execFile, type ChildProcess } from "child_process";
import path from "path";
import kill from "tree-kill";

let composeProcess: ChildProcess | null = null;

const COMPOSE_FILE = path.join(__dirname, "../../..", "docker-compose.desktop.yml");

export function startDockerCompose(): Promise<void> {
  return new Promise((resolve, reject) => {
    // execFile with array args -- no shell, no injection risk
    composeProcess = execFile(
      "docker",
      ["compose", "-p", "paragraf", "-f", COMPOSE_FILE, "up", "--build", "-d"],
      { windowsHide: true },
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

export function stopDockerCompose(): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      "docker",
      ["compose", "-p", "paragraf", "-f", COMPOSE_FILE, "stop"],
      { windowsHide: true },
      () => resolve()
    );
  });
}

export function killComposeProcess(): void {
  if (composeProcess?.pid) {
    kill(composeProcess.pid);
    composeProcess = null;
  }
}
```

### Pattern 2: Single-Instance Lock

**What:** Prevents multiple instances, focuses existing window on second launch attempt.
**When to use:** Always for SHELL-03.
**Example:**

```typescript
// desktop/src/main/index.ts
import { app, BrowserWindow } from "electron";

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}
```

### Pattern 3: Loading React SPA as Renderer

**What:** Electron loads the pre-built frontend from disk via file:// protocol.
**When to use:** Production mode.
**Example:**

```typescript
// desktop/src/main/window.ts
import { BrowserWindow } from "electron";
import path from "path";

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Paragraf",
    icon: path.join(__dirname, "../../resources/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // In dev: load Vite dev server
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    // In production: load built frontend from disk
    win.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  return win;
}
```

### Pattern 4: API Base URL Injection for Electron Mode

**What:** When running in Electron, the frontend needs to know the backend is at `http://localhost:8000` (no nginx proxy).
**When to use:** The existing `window.__PARAGRAF_API_BASE_URL__` mechanism handles this.

The preload script sets the API base URL:

```typescript
// desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";

// Inject API base URL so frontend talks directly to Docker backend
contextBridge.exposeInMainWorld("__PARAGRAF_API_BASE_URL__", "http://localhost:8000");

contextBridge.exposeInMainWorld("paragrafDesktop", {
  isDesktop: true,
  getDockerStatus: () => ipcRenderer.invoke("docker:status"),
  restartDocker: () => ipcRenderer.invoke("docker:restart"),
});
```

The frontend already reads this:
```typescript
// frontend/src/lib/api.ts -- existing, no changes needed:
const BASE_URL = (window as any).__PARAGRAF_API_BASE_URL__ || "";
```

**Important note on contextBridge:** `contextBridge.exposeInMainWorld` sets properties on `window`. The string value `"http://localhost:8000"` is exposed as `window.__PARAGRAF_API_BASE_URL__`. The existing API client reads this exact property name. No frontend changes needed.

### Pattern 5: Headless Docker Compose (No Frontend Service)

**What:** A docker-compose file with only qdrant, backend, and mcp services.
**When to use:** Electron mode -- frontend is served by Electron, not nginx.

The file is a copy of `docker-compose.yml` with the `frontend` service removed. All environment variables, volumes, and healthchecks remain identical.

### Anti-Patterns to Avoid

- **Routing API calls through Electron IPC:** The frontend should talk to the backend via HTTP at `http://localhost:8000`, exactly as it does today. Only use IPC for desktop-specific actions (Docker start/stop, status queries).
- **Disabling context isolation or enabling nodeIntegration:** Security risk. Use preload scripts with `contextBridge` for all main-to-renderer communication.
- **Running `docker compose up` without `-d` (detached):** This blocks the main process. Always use detached mode and poll health separately.
- **Using `docker-compose` (V1) instead of `docker compose` (V2):** Docker Compose V1 is deprecated since July 2023. The Docker CLI plugin `docker compose` is the standard.
- **Building frontend inside Electron build pipeline:** Build frontend separately (`cd frontend && npm run build`), copy `dist/` as the renderer source. Decouples the builds.
- **Using `exec()` for spawning Docker commands:** Always use `execFile()` with array arguments. Avoids shell injection and is the Electron security best practice.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process tree cleanup on Windows | Custom recursive PID walker | `tree-kill` | Windows process model is non-trivial; tree-kill handles edge cases |
| NSIS Windows installer | Custom NSIS scripts | `electron-builder` NSIS target | electron-builder generates NSIS with Start Menu, desktop icon, uninstaller |
| Single-instance enforcement | Named mutex/pipe | `app.requestSingleInstanceLock()` | Built into Electron, handles focus-existing-window pattern |
| Frontend-to-backend URL switching | Complex conditional logic | Existing `window.__PARAGRAF_API_BASE_URL__` | Already implemented, works for both nginx-proxy and direct-to-backend |
| Health check polling | New polling mechanism | Existing `useHealthCheck` hook | Already implements the exact state machine needed (connecting/loading/ready/error) |

**Key insight:** Phase 14 is largely about wiring existing pieces together. The React SPA, health check hook, health overlay, and Docker Compose config already exist. The new code is the Electron main process glue.

## Common Pitfalls

### Pitfall 1: Zombie Docker Containers on Windows App Close

**What goes wrong:** Closing Electron does not stop Docker containers. Containers keep running, holding ports 8000 and 6333.
**Why it happens:** `app.quit()` does not automatically run `docker compose stop`. The `before-quit` event must explicitly trigger cleanup.
**How to avoid:** Register a `before-quit` handler that runs `docker compose stop` via `execFile` and awaits completion before allowing quit. Use `tree-kill` on the compose process if it hangs. Set a 10-second timeout before force-quitting.
**Warning signs:** Ports remain bound after app close; Docker containers visible in `docker ps` after app quit.

### Pitfall 2: Vite base Path Breaks Asset Loading in Electron

**What goes wrong:** Vite builds with absolute paths (`/assets/index.js`). In Electron loading via `file://`, this resolves to filesystem root. All assets fail to load -- blank white screen.
**Why it happens:** Default Vite `base: '/'` produces absolute paths.
**How to avoid:** The existing `vite.config.ts` already has `base: "./"` which produces relative paths. This works for both HTTP (Docker/web mode) and `file://` (Electron). Verify this is preserved.
**Warning signs:** Blank white screen in Electron; console shows 404 for JS/CSS files.

### Pitfall 3: Docker Not Available or Not Running

**What goes wrong:** User has Docker Desktop installed but not running, or Docker is not installed at all. `docker compose up` fails silently or with cryptic error.
**Why it happens:** Docker Desktop is not a system service by default; it must be explicitly started.
**How to avoid:** Before spawning Docker Compose, check Docker availability: (1) `docker info` succeeds = Docker daemon running; (2) `docker info` fails but `docker --version` works = installed but not running; (3) `docker` not found = not installed. Show appropriate UI for each state.
**Warning signs:** Health check stays in "connecting" forever; no containers in `docker ps`.

### Pitfall 4: Port 8000 Already Bound from Previous Run

**What goes wrong:** App crashes or is force-killed, Docker containers keep running. Next launch, `docker compose up` works but port conflicts may occur.
**Why it happens:** Docker Compose V2 with `-d` is idempotent -- it recognizes existing running containers. This is usually fine. But stale unhealthy containers cause issues.
**How to avoid:** On app start, always run `docker compose up -d`. Compose V2 handles the "already running" case. If health check fails after 60 seconds, offer restart as recovery action.
**Warning signs:** Health check cycles between "connecting" and "error".

### Pitfall 5: Electron Security Defaults

**What goes wrong:** Disabling web security or enabling node integration to make IPC "easier" creates security holes.
**Why it happens:** Tutorials often disable security for simplicity.
**How to avoid:** Keep `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Use preload script with `contextBridge` for all IPC. Only expose specific, typed functions to the renderer.
**Warning signs:** Electron DevTools security warnings; CSP violations.

### Pitfall 6: HealthOverlay Shows CLI Instructions in Desktop Mode

**What goes wrong:** When backend is unreachable, HealthOverlay currently shows "docker compose up" as the fix instruction. In desktop mode, the user cannot use CLI.
**Why it happens:** HealthOverlay was designed for web/Docker users, not desktop users.
**How to avoid:** Detect desktop mode via `window.paragrafDesktop?.isDesktop` and show desktop-appropriate messages: "Backend wird gestartet..." during startup, or "Neustart" button on error (calling IPC restart).
**Warning signs:** Non-technical users confused by terminal instructions in a desktop app.

## Code Examples

### Main Process Entry Point

```typescript
// desktop/src/main/index.ts
import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./window";
import { startDockerCompose, stopDockerCompose } from "./docker";
import { registerIpcHandlers } from "./ipc";

// Single-instance lock (SHELL-03)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    registerIpcHandlers();
    mainWindow = createMainWindow();

    // Start Docker Compose in background (LIFE-01)
    try {
      await startDockerCompose();
    } catch (err) {
      // Docker not available -- renderer shows error via HealthOverlay
      console.error("Docker Compose start failed:", err);
    }
  });

  app.on("before-quit", async (e) => {
    e.preventDefault();
    try {
      await stopDockerCompose();
    } catch {
      // Best effort
    }
    app.exit(0);
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
```

### Docker Status Check

```typescript
// desktop/src/main/docker.ts (status check)
import { execFile } from "child_process";

export function checkDockerAvailable(): Promise<"running" | "installed" | "missing"> {
  return new Promise((resolve) => {
    execFile("docker", ["info"], { windowsHide: true }, (error) => {
      if (!error) {
        resolve("running");
        return;
      }
      execFile("docker", ["--version"], { windowsHide: true }, (vErr) => {
        resolve(vErr ? "missing" : "installed");
      });
    });
  });
}
```

### electron-vite Configuration

```typescript
// desktop/electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
    },
  },
  renderer: {
    // Renderer uses pre-built frontend assets (built separately)
    // Not built by electron-vite -- copied from frontend/dist/
    build: {
      outDir: "out/renderer",
    },
  },
});
```

**Note:** The recommended approach is to build the frontend separately (`cd frontend && npm run build`) and copy the output to `desktop/out/renderer/`. This avoids coupling the two build pipelines and ensures the existing frontend works unchanged in both Docker (nginx) and Electron modes.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| docker-compose (V1, Python) | docker compose (V2, Go plugin) | July 2023 deprecated V1 | Use `docker compose` command, not `docker-compose` |
| Electron contextBridge optional | contextBridge required (sandbox default) | Electron 20+ | Must use preload scripts, no direct node access in renderer |
| electron-builder v24 | electron-builder v26 | 2025 | New NSIS features, better code signing support |
| Electron v40 (from project research) | Electron v41 | March 2026 | Node v24, Chromium 146. Use ^41.1.0 |

**Deprecated/outdated:**
- `docker-compose` (V1): Deprecated, use `docker compose` (V2 plugin)
- `app.makeSingleInstance()`: Replaced by `app.requestSingleInstanceLock()` since Electron 4
- `remote` module: Removed, use `ipcMain`/`ipcRenderer` with `contextBridge`

## Open Questions

1. **electron-vite renderer pointing to external frontend directory**
   - What we know: electron-vite supports custom renderer root directories via config
   - What's unclear: Whether the `../frontend/src` path reference works cleanly with Vite plugins (@tailwindcss/vite, @vitejs/plugin-react) that expect to be in the same package
   - Recommendation: Build frontend separately (`cd frontend && npm run build`) and copy `dist/` into `desktop/out/renderer/`. This is simpler, avoids coupling, and ensures the frontend works in both Docker and Electron modes unchanged.

2. **Docker Compose project name isolation**
   - What we know: Docker Compose uses the directory name as project name by default
   - What's unclear: If `docker compose -f ../docker-compose.desktop.yml` uses parent directory name or CWD
   - Recommendation: Explicitly set project name: `docker compose -p paragraf -f docker-compose.desktop.yml up -d`

3. **HealthOverlay context-aware text**
   - What we know: Current HealthOverlay shows CLI instructions when backend unreachable
   - What's unclear: Exact UX for desktop mode error states
   - Recommendation: Detect desktop mode via `window.paragrafDesktop?.isDesktop` and show desktop-appropriate messages with "Neustart" button instead of CLI instructions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Electron build + dev | Yes | v22.17.1 | -- |
| npm | Package management | Yes | 11.6.0 | -- |
| Docker | Docker Compose lifecycle | Yes | 28.4.0 | -- |
| Docker Compose | Backend orchestration | Yes | v2.39.2 | -- |
| Python | Backend (in Docker) | N/A | In Docker image | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None. All required tools are available.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 (frontend), manual smoke tests (Electron) |
| Config file | `frontend/vitest.config.ts` (existing) |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | Desktop window shows React SPA | manual/smoke | Launch app, verify SPA loads | N/A |
| SHELL-02 | Start Menu shortcut with icon | manual/smoke | Install via NSIS, check Start Menu | N/A |
| SHELL-03 | Single-instance lock | unit | `cd desktop && npx vitest run src/__tests__/single-instance.test.ts` | Wave 0 |
| LIFE-01 | Docker Compose start/stop | integration | `cd desktop && npx vitest run src/__tests__/docker.test.ts` | Wave 0 |
| LIFE-02 | Health polling visual feedback | unit | `cd frontend && npx vitest run src/__tests__/HealthOverlay.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** Full vitest suite + manual Electron smoke test
- **Phase gate:** All automated tests green + manual verification of 5 success criteria

### Wave 0 Gaps

- [ ] `desktop/src/__tests__/docker.test.ts` -- covers LIFE-01 (mock child_process, verify start/stop/status)
- [ ] `desktop/src/__tests__/single-instance.test.ts` -- covers SHELL-03 (mock app.requestSingleInstanceLock)
- [ ] `frontend/src/__tests__/HealthOverlay.test.tsx` -- covers LIFE-02 (render overlay in each state, verify desktop vs web text)
- [ ] `desktop/vitest.config.ts` -- test config for desktop package
- [ ] `desktop/tsconfig.json` -- TypeScript config for desktop package

## Project Constraints (from CLAUDE.md)

- **Branch:** All commits on branch `Docker-only`, never on main/master
- **Tech stack:** React 19 + Vite + TailwindCSS for frontend (preserved as Electron renderer)
- **Deployment:** Docker Compose only in v2.0 (native mode deferred to v2.1)
- **Sprache:** Deutsche UI, deutsche Docstrings, englische Variablen/Funktionsnamen
- **Naming:** camelCase for TS functions/variables, PascalCase for components
- **Accessibility:** role attributes, aria-live, keyboard shortcuts preserved
- **Conventions:** contextIsolation: true, nodeIntegration: false (Electron security best practices)
- **Docker services:** qdrant, backend, mcp needed; frontend service NOT needed in desktop mode
- **HF_HOME:** Must use short path (C:\ProgramData\Paragraf\models) from day one to avoid MAX_PATH
- **tree-kill:** Use from day one for Windows process cleanup

## Sources

### Primary (HIGH confidence)
- npm registry: electron@41.1.0, electron-vite@5.0.0, electron-builder@26.8.1, tree-kill@1.2.2 (all verified via `npm view`)
- [Electron 41 release blog](https://www.electronjs.org/blog/electron-41-0) -- Chromium 146, Node v24
- [electron-vite docs](https://electron-vite.org/guide/) -- Project structure, renderer configuration
- [Electron app API](https://www.electronjs.org/docs/latest/api/app) -- requestSingleInstanceLock, before-quit, second-instance
- Existing codebase: `frontend/src/hooks/useHealthCheck.ts`, `frontend/src/components/HealthOverlay.tsx`, `frontend/src/lib/api.ts`, `docker-compose.yml`

### Secondary (MEDIUM confidence)
- [electron-builder NSIS docs](https://www.electron.build/nsis.html) -- NSIS configuration and shortcuts
- Project research: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`

### Tertiary (LOW confidence)
- electron-vite renderer cross-package integration -- not verified with this project's specific structure (Open Question 1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, Electron 41 release confirmed
- Architecture: HIGH -- Docker-mode-only simplifies significantly; pattern is well-established (Electron + Docker Compose)
- Pitfalls: HIGH -- documented in project research, verified against Electron/Docker issue trackers

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable ecosystem, monthly Electron releases may bump minor version)

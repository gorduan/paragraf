# Phase 15: Windows Installer & Setup Wizard - Research

**Researched:** 2026-03-29
**Domain:** NSIS installer packaging (electron-builder), first-run setup wizard, Docker Desktop detection, resumable setup state
**Confidence:** HIGH

## Summary

Phase 15 adds two distinct components to the existing Electron desktop app: (1) a polished NSIS Windows installer with welcome screen, license display, and installation path selection, and (2) an in-app first-run setup wizard that checks Docker Desktop availability, shows estimated storage requirements, and can resume after interruption.

The NSIS installer is handled entirely by electron-builder's assisted installer mode, which already supports welcome pages, license pages, and directory selection via `installer.nsh` macros. No custom NSIS scripting is needed beyond the macro file. The setup wizard is an in-app React experience (not part of the NSIS installer) that runs on first launch, using `electron-store` to persist wizard state so it can resume after interruption.

The key architectural distinction: the NSIS installer handles file placement and shortcuts (INST-01). The in-app setup wizard handles Docker detection (INST-03), mode selection (INST-02), storage estimation (INST-05), and first-run initialization steps (INST-04). These are two separate systems with different technology stacks.

**Primary recommendation:** Configure electron-builder's NSIS assisted installer for the graphical installer experience. Build the setup wizard as a new React page (`SetupWizard`) in the frontend that renders instead of the main app on first run, with state persisted via IPC to `electron-store` in the main process.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INST-01 | Grafischer Windows-Installer (.exe) mit Willkommens-Screen, Lizenz, Installationspfad-Auswahl | electron-builder NSIS assisted installer with `customWelcomePage` macro, `license` option, `allowToChangeInstallationDirectory: true` (already configured) |
| INST-02 | Setup-Wizard bietet Installationsmodus-Auswahl: "Docker (Empfohlen)" vs "Nativ (Spaeter)" | In-app React wizard page with two cards: Docker (enabled, recommended badge) and Native (disabled, "Kommt spaeter" overlay) |
| INST-03 | Docker-Modus: Installer prueft ob Docker Desktop installiert ist und leitet zur Installation weiter falls noetig | Main process checks Docker via `docker info` / `docker --version` / registry key; wizard shows status and link to Docker Desktop download |
| INST-04 | Erster App-Start zeigt Setup-Wizard mit Fortschrittsanzeige fuer alle Einrichtungsschritte | Multi-step React wizard with stepper UI; steps: Welcome > Mode > Docker Check > Summary; progress shown via step indicator |
| INST-05 | Setup-Wizard zeigt geschaetzten Speicherbedarf vor Download an und kann nach Unterbrechung fortgesetzt werden | Storage estimation displayed in wizard (Docker images ~4GB, ML models ~4GB); `electron-store` persists completed steps; wizard resumes at last incomplete step |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-builder | ^26.8.1 | NSIS installer generation | Already in desktop/package.json. Handles welcome page, license, directory selection, Start Menu shortcuts, uninstaller. |
| electron-store | ^11.0.2 | Persist setup wizard state (completed steps, mode selection) | De facto standard for Electron app settings. Atomic writes, survives crashes. JSON file in userData. |
| electron | ^41.1.0 | Desktop shell (already installed from Phase 14) | Existing dependency. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tree-kill | ^1.2.2 | Process cleanup (already installed from Phase 14) | Existing dependency, no changes. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-store | Manual JSON file | electron-store handles atomic writes, schema validation, defaults. Manual JSON risks corruption on crash. |
| NSIS custom pages for mode selection | In-app React wizard | NSIS scripting is painful and limited. React wizard is maintainable, testable, and matches existing UI patterns. |
| winget for Docker install | Direct download URL | winget requires admin and may not be available on all systems. Linking to Docker Desktop download page is simpler and more reliable. |

**Installation (in desktop/ directory):**
```bash
npm install electron-store
```

**Version verification:**
| Package | Registry Version | Confidence |
|---------|-----------------|------------|
| electron-builder | 26.8.1 | HIGH (already in package.json, verified via npm view) |
| electron-store | 11.0.2 | HIGH (verified via npm view) |
| electron | 41.1.0 | HIGH (already in package.json) |

## Architecture Patterns

### Recommended Project Structure

```
desktop/
+-- build/
|   +-- installer.nsh          # NEW: NSIS macros (welcome page, license)
|   +-- license.rtf            # NEW: License text for NSIS installer
+-- electron-builder.yml       # EXISTING: updated with license + extraResources
+-- src/
|   +-- main/
|   |   +-- index.ts           # MODIFIED: check first-run, load wizard or app
|   |   +-- docker.ts          # EXISTING: add registry-based Docker detection
|   |   +-- ipc.ts             # MODIFIED: add setup wizard IPC handlers
|   |   +-- store.ts           # NEW: electron-store setup + typed schema
|   |   +-- window.ts          # EXISTING: unchanged
|   |   +-- logger.ts          # EXISTING: unchanged
|   +-- preload/
|       +-- index.ts           # MODIFIED: expose setup wizard IPC methods
frontend/
+-- src/
    +-- components/
    |   +-- SetupWizard.tsx     # NEW: multi-step setup wizard component
    |   +-- SetupSteps/
    |       +-- WelcomeStep.tsx     # NEW: welcome + branding
    |       +-- ModeStep.tsx        # NEW: Docker vs Native selection
    |       +-- DockerCheckStep.tsx  # NEW: Docker detection + install link
    |       +-- StorageStep.tsx     # NEW: storage estimation display
    |       +-- SummaryStep.tsx     # NEW: confirmation + start
    +-- App.tsx                 # MODIFIED: show SetupWizard on first run
```

### Pattern 1: Two-Layer Installer Architecture

**What:** The NSIS installer and the in-app setup wizard are separate systems with different responsibilities.
**When to use:** Always -- this is the core architecture for Phase 15.

```
LAYER 1: NSIS INSTALLER (electron-builder)
  - Welcome screen (MUI_PAGE_WELCOME)
  - License display (license.rtf)
  - Installation directory selection
  - File extraction + shortcuts
  - Runs ONCE during install

LAYER 2: IN-APP SETUP WIZARD (React)
  - Mode selection (Docker / Native greyed out)
  - Docker Desktop detection
  - Storage estimation
  - Runs on FIRST LAUNCH (and resumes if interrupted)
```

### Pattern 2: electron-store for Setup State Persistence (INST-05)

**What:** Use electron-store to persist which setup steps are completed. On app launch, check store; if setup incomplete, show wizard at last incomplete step.
**When to use:** INST-04, INST-05 -- resumable setup wizard.

```typescript
// desktop/src/main/store.ts
import Store from "electron-store";

interface SetupState {
  setupComplete: boolean;
  setupStep: number;       // 0-4, which step the user reached
  selectedMode: "docker";  // Only "docker" in v2.0
  dockerDetected: boolean;
  estimatedStorage: number; // MB
}

interface AppSchema {
  setup: SetupState;
}

const defaults: AppSchema = {
  setup: {
    setupComplete: false,
    setupStep: 0,
    selectedMode: "docker",
    dockerDetected: false,
    estimatedStorage: 0,
  },
};

export const store = new Store<AppSchema>({ defaults });
```

### Pattern 3: Docker Desktop Detection (INST-03)

**What:** Three-tier detection: (1) `docker info` = daemon running, (2) `docker --version` = installed but not running, (3) Windows Registry check = installed but CLI not in PATH. Falls back to opening Docker Desktop download page.
**When to use:** INST-03 -- Docker check step in setup wizard.

The existing `checkDockerAvailable()` in `desktop/src/main/docker.ts` already implements tiers 1 and 2. For Phase 15, extend it with a Windows Registry check as tier 3 and a `shell.openExternal()` call to guide the user to the Docker Desktop download page.

Registry detection uses `reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "Docker Desktop"` via the safe `execFile("reg", [...args])` pattern (array args, no shell -- consistent with Phase 14 conventions).

```typescript
// Extended DockerCheckResult for the setup wizard
export interface DockerCheckResult {
  status: "running" | "installed" | "not-running" | "missing";
  version?: string;
}
```

Detection flow:
1. `execFile("docker", ["info"])` succeeds -> status: "running"
2. `execFile("docker", ["--version"])` succeeds -> status: "not-running" (daemon off)
3. `execFile("reg", ["query", ...])` finds Docker Desktop -> status: "installed" (CLI not in PATH)
4. All fail -> status: "missing"

### Pattern 4: Setup Wizard as React Page

**What:** The setup wizard is a React component rendered instead of the main app when setup is incomplete. Uses IPC to communicate with main process for Docker checks and state persistence.
**When to use:** INST-04 -- first-run wizard.

```typescript
// frontend/src/components/SetupWizard.tsx (skeleton)
interface SetupWizardProps {
  initialStep: number;
  onComplete: () => void;
}

const STEPS = [
  { id: "welcome", label: "Willkommen" },
  { id: "mode", label: "Installationsmodus" },
  { id: "docker-check", label: "Docker-Pruefung" },
  { id: "storage", label: "Speicherbedarf" },
  { id: "summary", label: "Zusammenfassung" },
];

export function SetupWizard({ initialStep, onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  // ... step navigation, IPC calls for Docker detection, state saving
}
```

### Pattern 5: First-Run Detection in Main Process

**What:** On app start, check `store.get("setup.setupComplete")`. If false, send setup state to renderer via IPC. Renderer shows wizard instead of main app.
**When to use:** Always -- entry point logic.

Key behavior change: Docker Compose is NOT started until the setup wizard completes. The wizard verifies Docker availability first, then on completion triggers the Docker Compose startup.

### Pattern 6: Preload IPC Bridge for Setup Wizard

**What:** Expose setup-specific IPC methods via contextBridge.
**When to use:** Connecting React wizard to main process.

```typescript
// desktop/src/preload/index.ts (additions)
contextBridge.exposeInMainWorld("paragrafSetup", {
  getSetupState: () => ipcRenderer.invoke("setup:getState"),
  setSetupStep: (step: number) => ipcRenderer.invoke("setup:setStep", step),
  checkDocker: () => ipcRenderer.invoke("setup:checkDocker"),
  openDockerDownload: () => ipcRenderer.invoke("setup:openDockerDownload"),
  completeSetup: () => ipcRenderer.invoke("setup:complete"),
  getStorageEstimate: () => ipcRenderer.invoke("setup:storageEstimate"),
});
```

### Anti-Patterns to Avoid

- **Putting the mode selection in the NSIS installer:** NSIS scripting is fragile, hard to test, and cannot interact with the Electron app. Keep mode selection in the React wizard.
- **Starting Docker Compose before setup wizard completes:** The wizard must verify Docker is available first. Only start Docker after wizard completion.
- **Storing setup state in localStorage:** localStorage is per-origin and can be cleared by the user. Use electron-store in the main process for reliable persistence.
- **Blocking app launch for Docker detection:** Run Docker detection asynchronously in the wizard step. Show a spinner while checking, allow the user to proceed to download link if missing.
- **Bundling docker-compose.desktop.yml inside the ASAR:** ASAR is read-only and Docker Compose needs to read the file from disk. Use `extraResources` (already configured in electron-builder.yml).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NSIS welcome/license pages | Custom NSIS scripts | electron-builder `installer.nsh` macros | electron-builder's assisted installer supports welcome, license, directory pages via simple macros |
| App settings persistence | Manual JSON read/write | `electron-store` v11 | Atomic writes, crash-safe, typed schema, userData directory |
| Docker Desktop download | Custom downloader | `shell.openExternal(url)` | Opens user's browser to official Docker Desktop download page |
| Windows Registry query | Native Node addon | `execFile("reg", [...args])` | Windows `reg.exe` is always available, no native bindings needed |
| Setup stepper UI | Custom step indicator | Tailwind-styled div chain | Simple enough to build with existing Tailwind classes, no stepper library needed |

**Key insight:** The NSIS installer is 90% configuration (electron-builder.yml + installer.nsh). The in-app setup wizard is standard React with IPC -- uses the same patterns as the rest of the app.

## Common Pitfalls

### Pitfall 1: NSIS Welcome Page Not Showing

**What goes wrong:** The welcome page does not appear in the installer despite configuring `customWelcomePage`.
**Why it happens:** The `installer.nsh` file must be placed in `desktop/build/installer.nsh` (the `build` directory relative to electron-builder.yml). The macro name must be exactly `customWelcomePage`. electron-builder's `include` option defaults to `build/installer.nsh`.
**How to avoid:** Place `installer.nsh` in `desktop/build/`. Define the macro as `!macro customWelcomePage` with `!insertmacro MUI_PAGE_WELCOME`. Verify by running `npm run dist` and checking the installer output.
**Warning signs:** Installer goes straight to directory selection without welcome screen.

### Pitfall 2: Setup Wizard State Lost on Crash

**What goes wrong:** User is on step 3 of the wizard, app crashes or is closed. On restart, wizard starts from step 0.
**Why it happens:** State is only saved in React component state (memory), not persisted to disk.
**How to avoid:** Save current step to `electron-store` via IPC every time the user advances a step. On wizard load, read the last completed step from store.
**Warning signs:** Users report having to redo setup steps after closing and reopening.

### Pitfall 3: Docker Detection False Negative on Fresh Windows

**What goes wrong:** Docker Desktop is installed but `docker` CLI is not found because the user has not restarted their terminal or PATH is not updated after Docker Desktop installation.
**Why it happens:** Docker Desktop adds its CLI to PATH, but the current process inherits the old PATH from before installation.
**How to avoid:** Multi-layered detection: (1) `docker info`, (2) `docker --version`, (3) Windows Registry check for "Docker Desktop" in uninstall keys, (4) Check `C:\Program Files\Docker\Docker\resources\bin\docker.exe` directly. If any of 3-4 succeeds but 1-2 fails, tell user to restart Paragraf after starting Docker Desktop.
**Warning signs:** Wizard says "Docker nicht gefunden" immediately after user installs Docker Desktop.

### Pitfall 4: electron-store ESM Import Issues

**What goes wrong:** `import Store from "electron-store"` fails at runtime with ESM/CJS mismatch errors.
**Why it happens:** electron-store v10+ is ESM-only. electron-vite compiles main process to CJS by default.
**How to avoid:** electron-store v11 works with ESM. The desktop package.json already has `"type": "module"`. electron-vite with `externalizeDepsPlugin()` should handle this correctly. Verify at build time.
**Warning signs:** `ERR_REQUIRE_ESM` or `SyntaxError: Cannot use import statement outside a module` at runtime.

### Pitfall 5: License File Encoding Issues in NSIS

**What goes wrong:** German characters (umlauts) display as garbled text in the NSIS license page.
**Why it happens:** NSIS expects specific encodings. RTF files handle Unicode best.
**How to avoid:** Use RTF format for the license file (`license.rtf`). RTF natively supports Unicode characters. Alternatively, use UTF-8 with BOM for `.txt` files.
**Warning signs:** "ae" and "ss" characters appear as garbage in the installer license page.

### Pitfall 6: extraResources Path Wrong in Production

**What goes wrong:** Docker Compose file is not found when running the installed app. `getComposeFilePath()` returns the wrong path.
**Why it happens:** In dev, paths resolve relative to the source tree. In production, extraResources land in `process.resourcesPath`. The existing `docker.ts` already handles this distinction, but new resources (like a setup config) might not.
**How to avoid:** Always use `app.isPackaged` to branch between dev and production paths. Test with a built installer, not just dev mode.
**Warning signs:** Works in `npm run dev`, fails after `npm run dist` and install.

## Code Examples

### NSIS Installer Macros (installer.nsh)

```nsis
; desktop/build/installer.nsh
; Adds welcome page and license page to the assisted installer

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro licensePage
  !insertmacro MUI_PAGE_LICENSE "${BUILD_RESOURCES_DIR}\license.rtf"
!macroend
```

### electron-builder.yml Updates

```yaml
# desktop/electron-builder.yml (additions to existing)
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopIcon: true
  createStartMenuShortcut: true
  shortcutName: Paragraf
  menuCategory: Paragraf
  artifactName: "Paragraf-Setup-${version}.${ext}"
  license: build/license.rtf       # NEW: license file for NSIS

extraResources:
  - from: out/renderer
    to: renderer
    filter:
      - "**/*"
  - from: ../docker-compose.desktop.yml
    to: docker-compose.desktop.yml
  - from: ../backend
    to: backend
    filter:
      - "**/*"
      - "!**/__pycache__/**"
      - "!**/.pytest_cache/**"
```

### Storage Estimation Logic

```typescript
// desktop/src/main/ipc.ts (new handler)
ipcMain.handle("setup:storageEstimate", async () => {
  // Estimated sizes for user information display
  return {
    dockerImages: 4000,       // ~4 GB (qdrant + python backend)
    mlModels: 4000,           // ~4 GB (bge-m3 + bge-reranker-v2-m3)
    lawData: 500,             // ~500 MB (all German laws indexed)
    total: 8500,              // ~8.5 GB total
    unit: "MB",
  };
});
```

### App.tsx First-Run Check

```typescript
// frontend/src/App.tsx (modified)
function App() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const isDesktop = (window as any).paragrafDesktop?.isDesktop === true;

  useEffect(() => {
    if (!isDesktop) {
      // Web mode: no setup wizard needed
      setSetupComplete(true);
      return;
    }
    // Desktop mode: check setup state via IPC
    (window as any).paragrafSetup?.getSetupState().then((state: any) => {
      setSetupComplete(state.setupComplete);
      setSetupStep(state.setupStep);
    });
  }, [isDesktop]);

  if (setupComplete === null) return null; // Loading
  if (!setupComplete && isDesktop) {
    return <SetupWizard initialStep={setupStep} onComplete={() => setSetupComplete(true)} />;
  }

  // Normal app rendering...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| electron-store v9 (CJS) | electron-store v11 (ESM-only) | 2024 | Must use ESM imports; works with `"type": "module"` in package.json |
| Custom NSIS scripts | electron-builder macros in installer.nsh | electron-builder v24+ | Much simpler: define macros, electron-builder handles page insertion |
| Docker Compose V1 (docker-compose) | Docker Compose V2 (docker compose) | July 2023 | Already handled in Phase 14 |
| One-click installer default | Assisted installer for customization | electron-builder convention | Set `oneClick: false` to enable welcome, license, directory pages |

**Deprecated/outdated:**
- `electron-store` < v10: CJS, no longer maintained. Use v11+ (ESM).
- Custom NSIS `.nsi` scripts: Avoid unless absolutely necessary. Use `installer.nsh` macros.
- `docker-compose` (V1): Use `docker compose` (V2 plugin).

## Open Questions

1. **Backend source bundling for Docker Compose build**
   - What we know: `docker-compose.desktop.yml` uses `build: ./backend` which needs the backend source code to be available relative to the compose file
   - What's unclear: Whether `extraResources` is the right mechanism for bundling the entire backend directory, or if pre-built Docker images should be pushed to a registry
   - Recommendation: For v2.0, bundle the backend source via `extraResources` and let `docker compose up --build` build locally. Pre-built images are a v2.1 optimization. The compose file path resolution needs testing with the installed app's directory structure.

2. **License text content**
   - What we know: NSIS can display license text in RTF or TXT format
   - What's unclear: What license the project uses (no LICENSE file found in repo)
   - Recommendation: Create a disclaimer/terms-of-use document in German (RDG disclaimer, no warranty, open source license). Use RTF format for proper Unicode support.

3. **Docker Desktop auto-start after installation**
   - What we know: Docker Desktop can be configured to start on Windows login
   - What's unclear: Whether the setup wizard should offer to enable Docker Desktop auto-start
   - Recommendation: Defer to Phase 17 (system tray / polish). For now, just detect and guide.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Electron build + dev | Yes | v22.17.1 | -- |
| npm | Package management | Yes | 11.6.0 | -- |
| Docker | Docker Compose lifecycle | Yes | 28.4.0 | -- |
| Docker Compose | Backend orchestration | Yes | v2.39.2 | -- |
| winget | Docker Desktop install suggestion | Yes | v1.28.220 | Direct download link fallback |
| NSIS (via electron-builder) | Installer compilation | Auto-downloaded by electron-builder | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None. NSIS is automatically downloaded by electron-builder during `npm run dist`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 (desktop + frontend) |
| Config file | `desktop/vitest.config.ts`, `frontend/vitest.config.ts` |
| Quick run command | `cd desktop && npx vitest run --reporter=verbose` |
| Full suite command | `cd desktop && npx vitest run && cd ../frontend && npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INST-01 | NSIS installer with welcome, license, directory | manual/smoke | Build installer, run on clean Windows, verify 3 pages | N/A |
| INST-02 | Mode selection: Docker enabled, Native greyed out | unit | `cd frontend && npx vitest run src/__tests__/SetupWizard.test.tsx` | Wave 0 |
| INST-03 | Docker detection (running/installed/missing) | unit | `cd desktop && npx vitest run tests/docker-detection.test.ts` | Wave 0 |
| INST-04 | Multi-step wizard with progress indicator | unit | `cd frontend && npx vitest run src/__tests__/SetupWizard.test.tsx` | Wave 0 |
| INST-05 | Storage estimate + resumable state | unit | `cd desktop && npx vitest run tests/store.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd desktop && npx vitest run --reporter=verbose`
- **Per wave merge:** Full vitest suite + manual installer smoke test
- **Phase gate:** All automated tests green + manual verification of 5 success criteria on clean Windows

### Wave 0 Gaps

- [ ] `frontend/src/__tests__/SetupWizard.test.tsx` -- covers INST-02, INST-04 (render wizard steps, verify mode selection UI, step navigation)
- [ ] `desktop/tests/docker-detection.test.ts` -- covers INST-03 (mock child_process for Docker detection states)
- [ ] `desktop/tests/store.test.ts` -- covers INST-05 (persist step, resume from last step, complete flag)

## Project Constraints (from CLAUDE.md)

- **Branch:** All commits on branch `Docker-only`, never on main/master
- **Tech stack:** React 19 + Vite + TailwindCSS for frontend (wizard uses existing design system)
- **Deployment:** Docker Compose only in v2.0 (native mode deferred to v2.1 -- wizard shows "Kommt spaeter")
- **Sprache:** Deutsche UI, deutsche Docstrings, englische Variablen/Funktionsnamen
- **Naming:** camelCase for TS functions/variables, PascalCase for components
- **Accessibility:** role attributes, aria-live, keyboard shortcuts preserved (wizard must be keyboard-navigable)
- **Security:** contextIsolation: true, nodeIntegration: false (wizard IPC uses contextBridge)
- **HF_HOME:** Must use short path (C:\ProgramData\Paragraf\models) -- relevant for storage estimation display
- **NSIS 2GB limit:** Installer must stay thin (<100MB). ML models downloaded post-install (Phase 16). Installer only contains Electron shell + frontend assets.

## Sources

### Primary (HIGH confidence)
- [electron-builder NSIS docs](https://www.electron.build/nsis.html) -- NSIS options, installer.nsh macros, assisted installer configuration
- [electron-builder assisted installer template](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/templates/nsis/assistedInstaller.nsh) -- customWelcomePage, licensePage macro integration
- [electron-store GitHub](https://github.com/sindresorhus/electron-store) -- v11 ESM-only, atomic writes, userData path
- npm registry: electron-store@11.0.2, electron-builder@26.8.1 (verified via `npm view`)
- Existing codebase: `desktop/electron-builder.yml`, `desktop/src/main/docker.ts`, `desktop/src/preload/index.ts`
- Phase 14 RESEARCH.md -- Electron architecture, IPC patterns, Docker lifecycle

### Secondary (MEDIUM confidence)
- [Docker Desktop install docs](https://docs.docker.com/desktop/setup/install/windows-install/) -- download URL, system requirements
- [Docker Desktop silent install](https://silentinstallhq.com/docker-desktop-silent-install-how-to-guide/) -- registry detection, winget installation
- [electron-builder configuration docs](https://www.electron.build/configuration.html) -- extraResources, files configuration

### Tertiary (LOW confidence)
- electron-store ESM compatibility with electron-vite -- needs verification at build time (Pitfall 4)
- Backend source bundling via extraResources for Docker Compose build context -- needs testing with installed app (Open Question 1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- electron-builder NSIS already configured, electron-store is straightforward
- Architecture: HIGH -- clear separation between NSIS installer and in-app wizard; patterns established in Phase 14
- Pitfalls: HIGH -- NSIS macro placement, electron-store ESM, Docker detection edge cases well-documented

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable ecosystem)

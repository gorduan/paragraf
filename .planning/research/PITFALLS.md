# Domain Pitfalls: Desktop Installer & Packaging for ML-Heavy Web App

**Domain:** Desktop packaging (Electron/Tauri) + Python ML backend + Windows installer
**Researched:** 2026-03-29
**Confidence:** HIGH (pitfalls verified across multiple sources: PyInstaller/Electron/Tauri issue trackers, Windows-specific documentation, HuggingFace Hub issues)

---

## Critical Pitfalls

Mistakes that cause rewrites, user-facing failures, or weeks of lost time.

### Pitfall 1: NSIS Installer 2GB Size Limit + PyTorch Bundle Size Explosion

**Severity:** CRITICAL -- build pipeline breaks, installer impractically large
**What goes wrong:** NSIS (the installer framework used by electron-builder) has a hard 2GB file size limit. PyTorch with CUDA ships 2-3GB of CUDA DLLs alone. Combined with the Python runtime (~100MB), FlagEmbedding model files (~2GB), bge-reranker-v2-m3 (~2GB), and the Electron shell (~150MB), the total easily reaches 4-7GB -- far exceeding NSIS limits and creating impractical download sizes.
**Why it happens:** PyTorch wheels from PyPI bundle CUDA runtime libraries inside the wheel. CPU-only is ~250MB; CUDA 12.x is ~2.5GB. Developers naturally want a single "download and run" installer.
**Consequences:**
- NSIS compiler fails with internal error if content exceeds 2GB
- Even if split, installer download of 3-5GB+ leads to user abandonment
- Too large for GitHub Releases (2GB per asset limit)
- Auto-updates re-download the entire package

**Prevention:**
1. **Thin installer (<100MB)** containing only the Electron shell and bootstrap logic.
2. **Ship CPU-only PyTorch** (~250MB) as the default. Install from `https://download.pytorch.org/whl/cpu`.
3. **Make CUDA an optional post-install download.** After installation, detect GPU and offer: "NVIDIA GPU erkannt. CUDA-Beschleunigung herunterladen? (~2GB)"
4. **Download ML models on first launch, not in the installer.** Use HuggingFace Hub with progress bar and resume support.
5. **Consider PyTorch Wheel Variants** (experimental in PyTorch 2.8+): auto-selects CPU/CUDA based on detected hardware. Evaluate stability for your timeline.

**Detection:** Build fails with NSIS compiler error; installer size exceeds 1GB; CI artifacts exceed hosting limits.
**Phase to address:** Architecture phase -- download/install strategy must be designed before any packaging work.

---

### Pitfall 2: Zombie Python Processes on Windows After App Close

**Severity:** CRITICAL -- orphan processes consume RAM/CPU indefinitely
**What goes wrong:** Closing Electron/Tauri does not kill the Python backend. On Windows, `child_process.kill()` and Tauri's `child.kill()` only terminate the immediate process, not its children. If using PyInstaller `--onefile`, there are TWO processes (bootloader parent + Python child), and only the parent dies. The Python process running FastAPI + ML models continues in the background, holding 2-4GB of RAM. This is a confirmed Tauri bug (issue #11686).
**Why it happens:** Windows does not cascade `TerminateProcess` to child processes unless using Job Objects. PyInstaller's `--onefile` bootloader/child architecture makes this worse. Unix-style process groups do not work on Windows.
**Consequences:**
- 2-4GB RAM leaked per app restart
- Port 8000 remains bound ("address already in use" on next launch)
- Users must manually kill `python.exe` in Task Manager
- System becomes unusable after several restarts

**Prevention:**
1. **Use `tree-kill` package** (npm) which recursively kills the entire process tree on Windows.
2. **Do NOT use PyInstaller `--onefile`.** Use `--onedir` (single process, no bootloader/child split) or better: Python Embedded Distribution (direct `python.exe`, kills cleanly).
3. **Use Windows Job Objects** to group all child processes. When the job terminates, all processes in it die.
4. **Implement graceful shutdown:** Send `POST /api/shutdown` or stdin command before process kill. FastAPI handles cleanup.
5. **Startup orphan check:** On app launch, check for processes on port 8000 and offer to kill them.
6. **PID file** (`%APPDATA%/paragraf/backend.pid`) for reliable process tracking.

**Detection:** Task Manager shows multiple `python.exe` after restart; "Port already in use" error; memory climbs with each restart.
**Phase to address:** Backend lifecycle management phase. Must be solved before beta testing.

---

### Pitfall 3: PyInstaller Bundles Flagged as Malware by Windows Antivirus

**Severity:** CRITICAL -- blocks user adoption entirely
**What goes wrong:** PyInstaller's `runw.exe` bootloader is on antivirus blocklists because real malware frequently uses PyInstaller. Windows Defender, Norton, and others quarantine or delete the bundled `.exe`. The `--onefile` mode is worse because unpacking to temp directories matches malware dropper patterns.
**Why it happens:** PyInstaller's bootloader hash is shared across millions of applications. The Electrum project documented that recompiling the bootloader from source dropped detections from 15 AV engines to 1.
**Consequences:**
- Users see "Threat detected" and cannot run the app
- Corporate managed antivirus silently blocks installation
- `.exe` disappears from disk (quarantined)

**Prevention:**
1. **Do NOT use PyInstaller `--onefile`.** Use `--onedir` which reduces false positives.
2. **Strongly prefer Python Embedded Distribution** over PyInstaller entirely. Ship Python 3.12 embeddable ZIP + pip-installed packages in a directory. No bootloader, no packing, no antivirus triggers.
3. **If PyInstaller is required:** recompile the bootloader from source to change its hash.
4. **Code-sign ALL executables** (see Pitfall 5).
5. **Test every release on VirusTotal** before publishing. Target 0-2 detections.

**Detection:** Works on dev machine, fails on fresh Windows; users report "Windows protected your PC"; exe disappears from disk.
**Phase to address:** First phase of native mode. Must validate before other native-mode work.

---

### Pitfall 4: GPU/CUDA Detection Chicken-and-Egg Problem

**Severity:** HIGH -- wrong PyTorch variant installed, or GPU users stuck on CPU
**What goes wrong:** The setup wizard needs GPU info to decide CPU vs CUDA PyTorch BEFORE Python is installed. But `torch.cuda.is_available()` requires PyTorch. Additionally, inside bundled apps, `torch.cuda.is_available()` may return False even with a GPU present (documented in pyinstaller/pyinstaller#2956) due to missing CUDA DLLs in the bundle's PATH.
**Why it happens:** CUDA detection depends on: (1) correct PyTorch build variant, (2) NVIDIA driver compatibility, (3) CUDA runtime DLLs in PATH, (4) GPU not exclusively locked. In a developer environment all work; in a user's bundled environment, any can fail.
**Consequences:**
- GPU users get 10-50x slower indexing without knowing
- CPU-only users waste 2-3GB downloading CUDA PyTorch
- No error shown -- app "works" but slowly

**Prevention:**
1. **Two-phase GPU detection:**
   - Phase 1 (before Python): Run `nvidia-smi` from Node.js/Rust subprocess. It ships with NVIDIA drivers and is always in PATH. Parse output for driver version and GPU model.
   - Phase 2 (after install): Verify with `torch.cuda.is_available()`. If False but nvidia-smi found GPU, show diagnostic.
2. **Show GPU status prominently in UI:** "GPU: NVIDIA RTX 3060 (erkannt) / CUDA: kompatibel / Modus: GPU-beschleunigt" or "Nicht erkannt / Modus: CPU"
3. **Ship CPU-only by default, offer CUDA as add-on download.** The add-on checks driver version and downloads matching CUDA wheel.
4. **Pin minimum NVIDIA driver version** in prerequisites. CUDA 12.x needs driver >= 525.60.13.

**Detection:** nvidia-smi works but torch.cuda.is_available() returns False; indexing >30min for single law on GPU machine; no GPU info in UI.
**Phase to address:** GPU detection as dedicated sub-phase before CUDA packaging.

---

### Pitfall 5: Windows SmartScreen Blocks Unsigned Installer for Non-Technical Users

**Severity:** HIGH -- blocks installation for target audience (Juristen, Buerger)
**What goes wrong:** SmartScreen shows "Windows protected your PC" with a hidden "Run anyway" link. Non-technical users see this as a virus warning and refuse to install. Since March 2024, even EV (Extended Validation) certificates no longer instantly bypass SmartScreen -- they must build reputation over time.
**Why it happens:** SmartScreen uses a reputation system. New executables from unknown publishers have zero reputation. New certificates need download volume to build trust.
**Consequences:**
- 30-50% of non-technical users abandon installation
- Corporate/government machines may hard-block via Group Policy
- Negative perception from warning screenshots

**Prevention:**
1. **Get a code signing certificate** from DigiCert, Sectigo, or GlobalSign. Cost: ~100-300 EUR/year.
2. **Consider Azure Trusted Signing** (Microsoft cloud signing, ~10 USD/month, since October 2025). Designed to build SmartScreen reputation faster.
3. **Sign EVERYTHING:** installer `.exe`, uninstaller, main app `.exe`, backend Python `.exe`. SmartScreen checks each executable separately.
4. **Always use timestamp server** (e.g., `http://timestamp.digicert.com`). Without it, signatures expire with the certificate.
5. **Build reputation gradually** with beta releases to a small group first.
6. **NSIS installer format** (electron-builder default) is best supported by SmartScreen.
7. **Provide installation instructions** with screenshots showing SmartScreen bypass for target audience.

**Detection:** Fresh Windows VM shows SmartScreen warning; users report "blue warning screen"; installation success rate drops.
**Phase to address:** Installer phase. Certificate acquisition takes 1-5 business days -- start early.

---

### Pitfall 6: Windows MAX_PATH (260 chars) Breaks HuggingFace Model Cache

**Severity:** HIGH -- models fail to download/load on some machines
**What goes wrong:** HuggingFace cache creates paths like `C:\Users\JohannesSchmidtMueller\AppData\Local\huggingface\hub\models--BAAI--bge-m3\snapshots\5617a9f61b028005a4858fdac845db406aefb181\model.safetensors` (140+ chars). Combined with lock files and long usernames, this exceeds Windows' 260-char MAX_PATH. `FileLock` hangs indefinitely (huggingface_hub issue #35), downloads silently fail, or `FileNotFoundError` is raised. Same applies to Python package paths under `%APPDATA%` with deep torch/transformers directory nesting.
**Why it happens:** HuggingFace Hub uses SHA-based content-addressed storage. German usernames tend to be long (full names). Default cache at `%USERPROFILE%\.cache\huggingface\hub\` is already long. Windows symlinks (used by HF Hub for efficient caching) are not supported on all Windows machines.
**Consequences:**
- Model download hangs with no error
- Works on dev machine (short username), fails on user machines
- Impossible to diagnose without MAX_PATH knowledge

**Prevention:**
1. **Set `HF_HOME` to a short path** at startup: `C:\ProgramData\Paragraf\models` or `C:\paragraf\models`.
2. **Set `HF_HUB_CACHE` explicitly** as belt-and-suspenders.
3. **Install Python venv at short path:** `%LOCALAPPDATA%\paragraf\` (shorter than Roaming).
4. **Enable long paths via installer** if admin (registry key `LongPathsEnabled`), but do not rely on it (needs reboot).
5. **Test with Windows username of 30+ characters** in CI.

**Detection:** Model loading hangs on some machines; FileLock timeout in logs; path > 200 chars in cache.
**Phase to address:** Model management phase. Set short cache paths from day one.

---

## Moderate Pitfalls

### Pitfall 7: Blocking Electron Main Process During Downloads

**What goes wrong:** Downloading 4GB of ML models in the Electron main process freezes the entire app -- no window updates, no progress bar, no close button. Users force-kill the "frozen" app, leaving partial downloads.
**Prevention:** All heavy downloads run in the Python backend process (which has its own event loop and threading). Electron main process only receives progress via SSE/IPC. HuggingFace Hub handles download resume after interruption. Never run downloads in the renderer process either.

---

### Pitfall 8: Docker Desktop Detection and Orchestration Is Fragile

**What goes wrong:** The setup wizard needs to detect Docker Desktop. Checking `docker` in PATH is insufficient -- Docker Desktop installs to varying locations, may not be in PATH, the daemon may not be running, and WSL2 vs Hyper-V backends behave differently. Docker Desktop startup takes 30-60 seconds.
**Prevention:**
1. Check multiple methods: (a) Registry `HKLM\SOFTWARE\Docker Inc.\Docker`, (b) `docker.exe` in PATH, (c) named pipe `\\.\pipe\docker_engine`, (d) Start Menu shortcut.
2. Distinguish "installed" from "running" with separate status display.
3. Startup timeout with user feedback: "Docker Desktop wird gestartet... (bis zu 60 Sekunden)"
4. Always offer native mode as fallback. Never hard-require Docker.

---

### Pitfall 9: Vite base Path Breaks Asset Loading in Electron

**What goes wrong:** Vite builds with absolute paths (`/assets/index.js`). In Electron loading via `file://`, this resolves to filesystem root, not app directory. All assets fail to load with blank white screen.
**Prevention:** Set `base: './'` in `vite.config.ts` when building for Electron. This produces relative paths (`./assets/index.js`) that work with both HTTP (Docker/web mode) and `file://` (Electron). Use build-time environment variable to switch: `base: process.env.ELECTRON ? './' : '/'`.

---

### Pitfall 10: Port Conflicts on User Machines

**What goes wrong:** Backend port 8000 or Qdrant port 6333 already in use by dev servers, VPNs, or corporate software.
**Prevention:**
1. Check port availability before binding; fall back to ports 8001-8010.
2. Store chosen port in config (`%APPDATA%/Paragraf/config.json`).
3. Use non-standard port for native Qdrant (e.g., 16333).
4. Show port in Settings page for debugging.
5. Consider named pipes on Windows for backend-frontend IPC to avoid port conflicts entirely.

---

### Pitfall 11: Auto-Updater Cannot Handle ML Model or Python Runtime Updates

**What goes wrong:** Standard auto-updaters (electron-updater) handle ~50-100MB app updates. They cannot handle: 2GB model re-downloads, partial/resumed downloads, keeping old model during download, or Python runtime upgrades. The updater tries to re-download everything or times out.
**Prevention:**
1. **Separate app updates from model/runtime updates.** Electron shell via standard updater. Models/Python via custom download manager with resume.
2. **Version-tag models independently** from app version.
3. **HTTP Range header resume** for model downloads (HuggingFace Hub supports this).
4. **Never delete old model before new is verified** (checksum).
5. NSIS delta updates for Electron shell only.

---

### Pitfall 12: Dual-Mode (Docker + Native) Configuration Drift

**What goes wrong:** Over time, env vars in `docker-compose.yml` diverge from native-mode config. Features work in Docker but break in native because a new env var was only added to compose.
**Prevention:**
1. **Single source of truth:** Pydantic Settings (already in codebase) with defaults for both modes. Both `docker-compose.yml` and native config override the same `Settings` class.
2. **Integration tests for both modes** in CI.
3. **Startup config validation** that checks all required vars are present.
4. **Document every env var** with default and mode applicability.

---

### Pitfall 13: HuggingFace Hub Cache Corruption from Interrupted Downloads

**What goes wrong:** Interrupted model downloads leave partial files. Next attempt may use corrupted cached data. On Windows specifically, symlinks (used by HF Hub for efficient caching) may not work, causing fallback behavior.
**Prevention:** Use HuggingFace Hub >= 0.24 with proper temp files and atomic moves. Expose `force_download=True` as a "retry" option in the UI. Verify model integrity after download with a test inference call.

---

### Pitfall 14: Qdrant Native Binary Permissions and Version Mismatch

**What goes wrong:** In native mode, Qdrant binary cannot write to its storage directory (permissions under Program Files), or the bundled version does not match v1.13.2 API expectations.
**Prevention:**
1. Store Qdrant data under user-writable path: `%LOCALAPPDATA%\paragraf\qdrant\storage`.
2. Download `qdrant.exe` v1.13.2 from GitHub Releases during build, pin with checksum.
3. **Alternative:** `QdrantClient(path="./qdrant_data")` for embedded mode (no separate process). Evaluate for your data volume.
4. Never install to Program Files.

---

### Pitfall 15: Windows User Paths with Spaces and Umlauts Break Subprocess Calls

**What goes wrong:** Paths with spaces (`C:\Program Files\Paragraf\`) or German umlauts in usernames break Python subprocess calls and some library internals that use shell-based process spawning.
**Prevention:**
1. Default install to path without spaces: `C:\Paragraf\` or `%LOCALAPPDATA%\Paragraf\`.
2. Always use `pathlib.Path` or `os.path.join()`, never string concatenation.
3. Always use list-form `subprocess.run()` (not string form).
4. Test with path containing spaces AND umlauts in CI.

---

## Minor Pitfalls

### Pitfall 16: Electron DevTools Exposed in Production
**What goes wrong:** Users open DevTools (Ctrl+Shift+I), see console errors, get confused.
**Prevention:** Disable DevTools in production. Enable only with debug flag.

### Pitfall 17: Multiple Electron Instances Race on Ports
**What goes wrong:** Double-click starts two instances, both try same ports.
**Prevention:** `app.requestSingleInstanceLock()`. Second instance focuses existing window.

### Pitfall 18: System Tray Icon Invisible on Dark/Light Themes
**What goes wrong:** Tray icon invisible on dark taskbar (Windows 11 default) or light theme.
**Prevention:** Ship both light/dark icon variants. Detect theme via registry `SystemUsesLightTheme`.

### Pitfall 19: Windows Firewall Prompt Scares Users
**What goes wrong:** Backend listening on port triggers "Allow through firewall?" dialog. Users click Cancel.
**Prevention:** Bind to `127.0.0.1` only (not `0.0.0.0`). Localhost-only does NOT trigger firewall dialog.

### Pitfall 20: Corporate Proxy Blocks First-Launch Model Download
**What goes wrong:** German law firms/government offices use HTTP proxies. HuggingFace downloads timeout.
**Prevention:** Detect system proxy settings. Pass to httpx and HF Hub. Offer manual proxy config in setup wizard. Consider offline installer variant for corporate environments.

### Pitfall 21: Electron Security Warnings from Disabled Defaults
**What goes wrong:** Loading local React app with `nodeIntegration: true` or `webSecurity: false` opens security holes.
**Prevention:** Follow Electron security best practices: `nodeIntegration: false`, `contextIsolation: true`, preload scripts for IPC. Never disable webSecurity.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Architecture / Strategy | NSIS size limit (#1), config drift (#12) | CRITICAL | Thin installer + post-install downloads; single Settings class |
| Python Runtime Bundling | Antivirus false positives (#3), bundle size (#1) | CRITICAL | Embedded Python distribution, NOT PyInstaller onefile |
| Backend Lifecycle | Zombie processes (#2), port conflicts (#10) | CRITICAL | tree-kill + Job Objects from day 1, dynamic ports |
| Setup Wizard | Blocking downloads (#7), GPU chicken-and-egg (#4) | HIGH | Downloads in Python process, two-phase GPU detection |
| GPU Detection / CUDA | Silent CPU fallback (#4) | HIGH | nvidia-smi pre-check, prominent status in UI |
| Installer / Code Signing | SmartScreen (#5), antivirus (#3) | HIGH | Certificate early, sign everything, NSIS format |
| Model Management | MAX_PATH (#6), cache corruption (#13) | HIGH | Short HF_HOME, HF Hub >= 0.24 with resume |
| Electron Shell | Vite base path (#9), DevTools (#16), security (#21) | MEDIUM | base: './', disable DevTools, contextIsolation |
| Docker Integration | Fragile detection (#8) | MEDIUM | Multiple detection methods, native fallback |
| Native Qdrant | Permissions (#14), wrong version | MEDIUM | User-writable path, pinned version checksum |
| Auto-Update System | Cannot handle models (#11) | MEDIUM | Separate app/model update channels |
| First Launch | Proxy (#20), firewall (#19) | LOW | Proxy detection, bind 127.0.0.1 only |

## Pitfall Severity Summary

| Severity | Count | Key Pitfalls |
|----------|-------|--------------|
| CRITICAL | 3 | #1 (Size/NSIS), #2 (Zombie Processes), #3 (Antivirus) |
| HIGH | 3 | #4 (GPU Detection), #5 (SmartScreen), #6 (MAX_PATH) |
| MODERATE | 9 | #7-#15 |
| MINOR | 6 | #16-#21 |

## "Looks Done But Isn't" Checklist

- [ ] **Installer:** Tested on fresh Windows 11 VM with no dev tools installed
- [ ] **Installer:** Tested with Windows username > 20 characters containing umlauts
- [ ] **Installer:** Tested with Windows Defender real-time protection ON
- [ ] **Installer:** Tested with SmartScreen enabled (default)
- [ ] **Installer:** Total download size verified < 500MB for base install
- [ ] **Backend:** Verified single process on Windows (no orphan after kill)
- [ ] **Backend:** Verified graceful shutdown via HTTP endpoint AND process termination
- [ ] **Backend:** Verified port conflict recovery (fallback to alternative port)
- [ ] **GPU:** Tested on machine WITH NVIDIA GPU (CUDA works)
- [ ] **GPU:** Tested on machine WITHOUT NVIDIA GPU (CPU fallback, user informed)
- [ ] **GPU:** Tested with NVIDIA GPU but OLD driver (clear error message)
- [ ] **Models:** Tested model download with slow connection (resume works)
- [ ] **Models:** Tested download interruption and restart (no corruption)
- [ ] **Docker mode:** Tested Docker Desktop not installed (native mode offered)
- [ ] **Docker mode:** Tested Docker Desktop installed but not running (startup offered)
- [ ] **Both modes:** Verified same features work in Docker AND native mode
- [ ] **Update:** Tested app update without re-downloading models
- [ ] **Paths:** No hardcoded paths; tested with spaces and umlauts
- [ ] **Electron:** Vite assets load via file:// protocol (base: './')
- [ ] **Security:** VirusTotal scan < 3 detections for all executables

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| NSIS size limit (#1) | HIGH | Architecture change to thin installer + post-install downloads |
| Zombie processes (#2) | MEDIUM | Add tree-kill, cleanup script, patch release |
| Antivirus blocks (#3) | HIGH | Switch to embedded Python, recompile bootloader, re-sign, re-release |
| GPU not detected (#4) | LOW | Config fix, no reinstall needed |
| SmartScreen blocks (#5) | MEDIUM | Acquire certificate, re-sign, wait weeks for reputation |
| MAX_PATH failure (#6) | LOW | Change HF_HOME path, re-download models to new location |
| Config drift (#12) | MEDIUM | Audit and sync configs, add integration tests |

## Sources

- [NSIS 2GB limit -- NSIS Forums](https://nsis-dev.github.io/NSIS-Forums/html/t-281864.html) -- Hard installer size limitation
- [PyInstaller false positives -- Issue #6754](https://github.com/pyinstaller/pyinstaller/issues/6754) -- Antivirus root cause and bootloader fix
- [Electrum AV reduction -- Issue #5426](https://github.com/spesmilo/electrum/issues/5426) -- 15 to 1 detection by recompiling bootloader
- [PyInstaller PyTorch size -- Discussion #8552](https://github.com/orgs/pyinstaller/discussions/8552) -- 2.6GB+ CUDA bundles
- [Tauri sidecar kill bug -- Issue #11686](https://github.com/tauri-apps/tauri/issues/11686) -- PyInstaller two-process kill failure
- [Tauri sidecar lifecycle -- Issue #3062](https://github.com/tauri-apps/plugins-workspace/issues/3062) -- Lifecycle management gaps
- [HuggingFace Hub MAX_PATH -- Issue #35](https://github.com/huggingface/huggingface_hub/issues/35) -- Windows 260-char path limit
- [SmartScreen and EV certificates (2026)](https://blog.betterbird.eu/2026/01/whats-the-story-with-windows-smartscreen) -- EV no longer bypasses SmartScreen
- [Azure Trusted Signing](https://learn.microsoft.com/en-us/answers/questions/5584097/how-to-bypass-windows-defender-smartscreen-even-af) -- Microsoft cloud signing
- [Electron code signing docs](https://www.electronjs.org/docs/latest/tutorial/code-signing) -- Official signing guidance
- [Electron security best practices](https://www.electronjs.org/docs/latest/tutorial/security) -- Security checklist
- [Python Embedded Distribution](https://docs.python.org/3/using/windows.html) -- Embeddable Python for Windows
- [Python embedded guide](https://preethamdpg.medium.com/distribute-your-python-application-with-ease-windows-python-embeddable-package-667db62bfd23) -- Bundling without PyInstaller
- [Qdrant Windows binary](https://github.com/qdrant/qdrant/releases) -- Standalone Windows exe
- [qdrant-npm helper](https://github.com/Anush008/qdrant-npm) -- NPM Qdrant binary helper
- [PyTorch Wheel Variants -- NVIDIA](https://developer.nvidia.com/blog/streamline-cuda-accelerated-python-install-and-packaging-workflows-with-wheel-variants/) -- Auto CPU/CUDA selection
- [electron-builder auto-update](https://www.electron.build/auto-update.html) -- NSIS delta update support
- [PyInstaller CUDA detection -- Issue #2956](https://github.com/pyinstaller/pyinstaller/issues/2956) -- torch.cuda.is_available() False in bundle
- [tree-kill package](https://www.npmjs.com/package/tree-kill) -- Recursive process tree kill on Windows

---
*Pitfalls research for: Paragraf v2 -- Desktop Installer & Packaging for ML-Heavy Web App*
*Researched: 2026-03-29*

import { spawn, ChildProcess, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";

export type BackendState =
  | "stopped"
  | "starting_qdrant"
  | "starting_backend"
  | "loading_models"
  | "ready"
  | "error";

export interface BackendStatus {
  state: BackendState;
  qdrant: boolean;
  backend: boolean;
  mcp: boolean;
  error?: string;
  log: string[];
  loadingProgress: number;
  loadingStage: string;
}

// Bekannte Log-Muster und ihr Fortschritt (0–100)
const LOADING_STAGES: [RegExp, number, string][] = [
  [/Paragraf REST-API startet/, 5, "Initialisiere Services..."],
  [/Lade Embedding|Loading.*bge-m3|sentence-transformers/, 10, "Lade Embedding-Modell (BAAI/bge-m3)..."],
  [/Downloading.*model|Fetching.*files/, 20, "Lade Modell-Dateien herunter..."],
  [/tokenizer_config|vocab.*loading|Loading.*tokenizer/, 35, "Lade Tokenizer..."],
  [/model\.safetensors|Loading.*weights|Loading.*model/, 45, "Lade Modell-Gewichte..."],
  [/Embedding.*geladen|Loaded.*embedding|model loaded/, 55, "Embedding-Modell geladen"],
  [/Verbinde mit Qdrant|Connecting.*Qdrant/, 60, "Verbinde mit Qdrant..."],
  [/Qdrant erreichbar|collections/, 65, "Qdrant verbunden"],
  [/Collection.*existiert|ensure_collection/, 68, "Collection geprüft"],
  [/Lade Reranker|Loading.*reranker/, 70, "Lade Reranker-Modell..."],
  [/Reranker.*geladen|reranker.*loaded/, 90, "Reranker geladen"],
  [/Alle Services initialisiert|Services ready/, 95, "Fast fertig..."],
  [/Uvicorn running|Application startup complete/, 100, "Backend bereit"],
];

export class BackendManager {
  private state: BackendState = "stopped";
  private qdrantProcess: ChildProcess | null = null;
  private pythonProcess: ChildProcess | null = null;
  private mcpProcess: ChildProcess | null = null;
  private logs: string[] = [];
  private qdrantRunning = false;
  private backendRunning = false;
  private mcpRunning = false;
  private error: string | undefined;
  private projectDir: string;
  private loadingProgress = 0;
  private loadingStage = "";
  private onStateChange?: (status: BackendStatus) => void;

  constructor() {
    this.projectDir = path.resolve(__dirname, "..", "..", "..");
  }

  getProjectDir(): string {
    return this.projectDir;
  }

  private readEnvFile(): Record<string, string> {
    const envPath = path.join(this.projectDir, ".env");
    const result: Record<string, string> = {};
    if (!fs.existsSync(envPath)) return result;
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
    return result;
  }

  setStateChangeHandler(handler: (status: BackendStatus) => void): void {
    this.onStateChange = handler;
  }

  getStatus(): BackendStatus {
    return {
      state: this.state,
      qdrant: this.qdrantRunning,
      backend: this.backendRunning,
      mcp: this.mcpRunning,
      error: this.error,
      log: this.logs.slice(-100),
      loadingProgress: this.loadingProgress,
      loadingStage: this.loadingStage,
    };
  }

  private log(msg: string): void {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.logs.push(line);
    if (this.logs.length > 500) this.logs.shift();
    this.emitState();
  }

  private setState(state: BackendState, error?: string): void {
    this.state = state;
    this.error = error;
    this.emitState();
  }

  private setProgress(progress: number, stage: string): void {
    this.loadingProgress = progress;
    this.loadingStage = stage;
    this.emitState();
  }

  private emitState(): void {
    this.onStateChange?.(this.getStatus());
  }

  private parseLogForProgress(line: string): void {
    for (const [pattern, progress, stage] of LOADING_STAGES) {
      if (pattern.test(line) && progress > this.loadingProgress) {
        this.setProgress(progress, stage);
        break;
      }
    }
  }

  // ── Qdrant ──────────────────────────────────────────────────────────

  async checkQdrant(): Promise<boolean> {
    this.log("Prüfe Qdrant...");
    const ok = await this.checkQdrantHealth();
    if (ok) {
      this.qdrantRunning = true;
      this.log("Qdrant läuft bereits auf Port 6333");
      return true;
    }
    this.log("Qdrant nicht erreichbar");
    return false;
  }

  private findQdrant(): string | null {
    const candidates: string[] = [];

    if (process.platform === "win32") {
      candidates.push(
        "E:\\qdrant\\qdrant.exe",
        path.join(this.projectDir, "qdrant", "qdrant.exe"),
        path.join(process.env.LOCALAPPDATA || "", "qdrant", "qdrant.exe"),
        path.join(process.env.USERPROFILE || "", "qdrant", "qdrant.exe"),
      );
    } else {
      const home = process.env.HOME || "";
      candidates.push(
        path.join(this.projectDir, "qdrant", "qdrant"),
        path.join(home, "qdrant", "qdrant"),
        "/usr/local/bin/qdrant",
      );
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // PATH
    try {
      const result = execSync(
        process.platform === "win32" ? "where qdrant" : "which qdrant",
        { stdio: "pipe", timeout: 3000 },
      );
      const p = result.toString().trim().split("\n")[0];
      if (p && fs.existsSync(p)) return p;
    } catch {}

    return null;
  }

  async startQdrant(): Promise<boolean> {
    this.setState("starting_qdrant");

    // Bereits laufend?
    if (await this.checkQdrantHealth()) {
      this.qdrantRunning = true;
      this.log("Qdrant läuft bereits");
      return true;
    }

    const qdrantPath = this.findQdrant();
    if (!qdrantPath) {
      this.setState(
        "error",
        "Qdrant nicht gefunden. Bitte qdrant.exe nach E:\\qdrant\\ legen.\n"
        + "Download: https://github.com/qdrant/qdrant/releases",
      );
      return false;
    }

    this.log(`Starte Qdrant: ${qdrantPath}`);

    const storagePath = path.join(path.dirname(qdrantPath), "storage");
    fs.mkdirSync(storagePath, { recursive: true });

    this.qdrantProcess = spawn(qdrantPath, [], {
      cwd: path.dirname(qdrantPath),
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        QDRANT__STORAGE__STORAGE_PATH: storagePath,
      },
    });

    this.qdrantProcess.stdout?.on("data", (data: Buffer) => {
      data.toString().split("\n").filter(Boolean).forEach((l) => this.log(`[Qdrant] ${l}`));
    });

    this.qdrantProcess.stderr?.on("data", (data: Buffer) => {
      data.toString().split("\n").filter(Boolean).forEach((l) => this.log(`[Qdrant] ${l}`));
    });

    this.qdrantProcess.on("exit", (code) => {
      this.log(`Qdrant beendet (Code: ${code})`);
      this.qdrantRunning = false;
    });

    // Health-Check (max 15s)
    for (let i = 0; i < 15; i++) {
      if (await this.checkQdrantHealth()) {
        this.qdrantRunning = true;
        this.log("Qdrant bereit");
        return true;
      }
      await this.sleep(1000);
    }

    this.setState("error", "Qdrant konnte nicht gestartet werden");
    return false;
  }

  private checkQdrantHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get("http://localhost:6333/healthz", (res) => {
        resolve(res.statusCode === 200);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  // ── Python Backend ──────────────────────────────────────────────────

  private findUv(): string | null {
    try {
      const result = execSync(
        process.platform === "win32" ? "where uv" : "which uv",
        { stdio: "pipe", timeout: 5000 },
      );
      return result.toString().trim().split("\n")[0];
    } catch {}

    const candidates: string[] = [];
    if (process.platform === "win32") {
      const localAppData = process.env.LOCALAPPDATA || "";
      const userProfile = process.env.USERPROFILE || "";
      candidates.push(
        path.join(localAppData, "uv", "uv.exe"),
        path.join(userProfile, ".local", "bin", "uv.exe"),
        path.join(userProfile, ".cargo", "bin", "uv.exe"),
      );
    } else {
      const home = process.env.HOME || "";
      candidates.push(
        path.join(home, ".local", "bin", "uv"),
        path.join(home, ".cargo", "bin", "uv"),
        "/usr/local/bin/uv",
      );
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  async startBackend(): Promise<boolean> {
    this.setState("starting_backend");
    this.setProgress(0, "Prüfe Backend...");

    // Prüfen ob Backend bereits auf Port 8000 läuft
    if (await this.checkBackendHealth()) {
      this.backendRunning = true;
      this.setProgress(100, "Backend bereit (bereits gestartet)");
      this.setState("ready");
      this.log("Backend läuft bereits auf Port 8000");
      return true;
    }

    this.setProgress(1, "Suche uv...");
    const uvPath = this.findUv();
    if (!uvPath) {
      this.setState("error", "uv nicht gefunden. Bitte installieren: https://docs.astral.sh/uv/");
      return false;
    }
    this.log(`uv gefunden: ${uvPath}`);

    this.setState("loading_models");
    this.setProgress(2, "Starte Python Backend...");

    const envVars = this.readEnvFile();

    this.pythonProcess = spawn(
      uvPath,
      ["run", "python", "-m", "paragraf", "--mode", "api", "--port", "8000"],
      {
        cwd: this.projectDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          HF_HOME: process.env.HF_HOME || envVars.HF_HOME || "E:/hf_cache",
          TORCH_HOME: process.env.TORCH_HOME || envVars.TORCH_HOME || "E:/torch_cache",
          HF_HUB_DISABLE_SYMLINKS_WARNING: "1",
          HF_HUB_OFFLINE: "1",
          TRANSFORMERS_OFFLINE: "1",
          TMPDIR: "E:/tmp",
          TEMP: "E:/tmp",
          TMP: "E:/tmp",
          UV_CACHE_DIR: process.env.UV_CACHE_DIR || "E:/uv_cache",
        },
      },
    );

    this.pythonProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      lines.forEach((line) => {
        this.log(`[API] ${line}`);
        this.parseLogForProgress(line);
      });
    });

    this.pythonProcess.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      lines.forEach((line) => {
        this.log(`[API] ${line}`);
        this.parseLogForProgress(line);
      });
    });

    this.pythonProcess.on("exit", (code) => {
      this.log(`Python-Prozess beendet (Code: ${code})`);
      this.backendRunning = false;
      this.pythonProcess = null;
      if (this.state !== "stopped") {
        this.setState("error", `Backend unerwartet beendet (Code: ${code})`);
      }
    });

    // Health-Check (max 180s)
    for (let i = 0; i < 180; i++) {
      if (await this.checkBackendHealth()) {
        this.backendRunning = true;
        this.setProgress(100, "Backend bereit");
        this.setState("ready");
        this.log("Backend bereit");
        return true;
      }
      await this.sleep(1000);
    }

    this.setState("error", "Backend Timeout (Modelle konnten nicht geladen werden)");
    return false;
  }

  private checkBackendHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get("http://localhost:8000/api/health", (res) => {
        resolve(res.statusCode === 200);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  // ── MCP Server ─────────────────────────────────────────────────────

  async startMcp(): Promise<boolean> {
    if (this.mcpRunning) {
      this.log("MCP-Server läuft bereits");
      return true;
    }

    const uvPath = this.findUv();
    if (!uvPath) {
      this.log("MCP: uv nicht gefunden");
      return false;
    }

    const envVars = this.readEnvFile();

    this.log("Starte MCP-Server (streamable-http, Port 8001)...");
    this.mcpProcess = spawn(
      uvPath,
      [
        "run", "python", "-m", "paragraf",
        "--mode", "mcp", "--port", "8001",
      ],
      {
        cwd: this.projectDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          MCP_TRANSPORT: "streamable-http",
          MCP_PORT: "8001",
          HF_HOME: process.env.HF_HOME || envVars.HF_HOME || "E:/hf_cache",
          TORCH_HOME: process.env.TORCH_HOME || envVars.TORCH_HOME || "E:/torch_cache",
          HF_HUB_DISABLE_SYMLINKS_WARNING: "1",
          TMPDIR: "E:/tmp",
          TEMP: "E:/tmp",
          TMP: "E:/tmp",
          UV_CACHE_DIR: process.env.UV_CACHE_DIR || "E:/uv_cache",
        },
      },
    );

    this.mcpProcess.stdout?.on("data", (data: Buffer) => {
      data.toString().split("\n").filter(Boolean).forEach((l) => this.log(`[MCP] ${l}`));
    });

    this.mcpProcess.stderr?.on("data", (data: Buffer) => {
      data.toString().split("\n").filter(Boolean).forEach((l) => this.log(`[MCP] ${l}`));
    });

    this.mcpProcess.on("exit", (code) => {
      this.log(`MCP-Prozess beendet (Code: ${code})`);
      this.mcpRunning = false;
      this.mcpProcess = null;
      this.emitState();
    });

    // Give it a few seconds to start
    for (let i = 0; i < 10; i++) {
      await this.sleep(1000);
      if (this.mcpProcess && !this.mcpProcess.killed) {
        // Check if the process is still alive after a brief wait
        if (i >= 2) {
          this.mcpRunning = true;
          this.log("MCP-Server gestartet");
          this.emitState();
          return true;
        }
      } else {
        this.log("MCP-Server konnte nicht gestartet werden");
        return false;
      }
    }

    return false;
  }

  async stopMcp(): Promise<void> {
    if (!this.mcpProcess) {
      this.mcpRunning = false;
      this.emitState();
      return;
    }

    this.log("Stoppe MCP-Server...");
    this.mcpProcess.kill("SIGTERM");
    await this.sleep(2000);
    if (this.mcpProcess && !this.mcpProcess.killed) {
      this.mcpProcess.kill("SIGKILL");
    }
    this.mcpProcess = null;
    this.mcpRunning = false;
    this.log("MCP-Server gestoppt");
    this.emitState();
  }

  // ── Restart ───────────────────────────────────────────────────────

  async restart(): Promise<boolean> {
    const mcpWasRunning = this.mcpRunning;

    // Stop MCP if running
    if (mcpWasRunning) {
      await this.stopMcp();
    }

    // Stop backend
    await this.stop();
    await this.sleep(1000);

    // Start backend
    const ok = await this.start();

    // Restart MCP if it was running
    if (ok && mcpWasRunning) {
      await this.startMcp();
    }

    return ok;
  }

  // ── Start/Stop ──────────────────────────────────────────────────────

  async start(): Promise<boolean> {
    if (this.state === "ready") return true;
    this.error = undefined;

    // 1. Qdrant starten
    if (!(await this.startQdrant())) return false;

    // 2. Backend starten
    if (!(await this.startBackend())) return false;

    return true;
  }

  async stop(): Promise<void> {
    this.log("Stoppe Backend...");

    if (this.pythonProcess) {
      this.pythonProcess.kill("SIGTERM");
      await this.sleep(2000);
      if (this.pythonProcess && !this.pythonProcess.killed) {
        this.pythonProcess.kill("SIGKILL");
      }
      this.pythonProcess = null;
    }

    this.backendRunning = false;
    this.setProgress(0, "");
    this.setState("stopped");
    this.log("Backend gestoppt");
  }

  async stopQdrant(): Promise<void> {
    this.log("Stoppe Qdrant...");
    if (this.qdrantProcess) {
      this.qdrantProcess.kill("SIGTERM");
      await this.sleep(1000);
      if (this.qdrantProcess && !this.qdrantProcess.killed) {
        this.qdrantProcess.kill("SIGKILL");
      }
      this.qdrantProcess = null;
    }
    this.qdrantRunning = false;
    this.log("Qdrant gestoppt");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

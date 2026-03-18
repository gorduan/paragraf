import { spawn, ChildProcess, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";

export type BackendState =
  | "stopped"
  | "starting_docker"
  | "starting_backend"
  | "loading_models"
  | "ready"
  | "error";

export interface BackendStatus {
  state: BackendState;
  docker: boolean;
  qdrant: boolean;
  backend: boolean;
  error?: string;
  log: string[];
}

export class BackendManager {
  private state: BackendState = "stopped";
  private pythonProcess: ChildProcess | null = null;
  private logs: string[] = [];
  private dockerAvailable = false;
  private qdrantRunning = false;
  private backendRunning = false;
  private error: string | undefined;
  private projectDir: string;
  private onStateChange?: (status: BackendStatus) => void;

  constructor() {
    // Projekt-Root finden (ein Verzeichnis über desktop/)
    this.projectDir = path.resolve(__dirname, "..", "..", "..");
  }

  setStateChangeHandler(handler: (status: BackendStatus) => void): void {
    this.onStateChange = handler;
  }

  getStatus(): BackendStatus {
    return {
      state: this.state,
      docker: this.dockerAvailable,
      qdrant: this.qdrantRunning,
      backend: this.backendRunning,
      error: this.error,
      log: this.logs.slice(-100),
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

  private emitState(): void {
    this.onStateChange?.(this.getStatus());
  }

  // ── Docker ──────────────────────────────────────────────────────────

  async checkDocker(): Promise<boolean> {
    this.log("Prüfe Docker...");
    try {
      const result = await this.execWithTimeout("docker version --format {{.Server.Version}}", 8000);
      if (result) {
        this.dockerAvailable = true;
        this.log(`Docker verfügbar (Version: ${result.trim()})`);
        return true;
      }
    } catch {
      // Fallback
    }
    this.dockerAvailable = false;
    this.log("Docker nicht verfügbar – bitte Docker Desktop starten und warten bis es bereit ist");
    return false;
  }

  private execWithTimeout(command: string, timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      const child = spawn(command, [], {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: timeoutMs,
      });

      let stdout = "";
      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve(null);
      }, timeoutMs);

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code === 0 ? stdout : null);
      });

      child.on("error", () => {
        clearTimeout(timer);
        resolve(null);
      });
    });
  }

  // ── Qdrant ──────────────────────────────────────────────────────────

  async startQdrant(): Promise<boolean> {
    this.setState("starting_docker");
    this.log("Starte Qdrant via Docker Compose...");

    try {
      execSync("docker compose up -d qdrant", {
        cwd: this.projectDir,
        stdio: "pipe",
        timeout: 60000,
      });
    } catch (e: any) {
      this.log(`Docker Compose Fehler: ${e.message}`);
      this.setState("error", "Qdrant konnte nicht gestartet werden");
      return false;
    }

    // Health-Check warten (max 30s)
    for (let i = 0; i < 30; i++) {
      if (await this.checkQdrantHealth()) {
        this.qdrantRunning = true;
        this.log("Qdrant bereit");
        return true;
      }
      await this.sleep(1000);
    }

    this.setState("error", "Qdrant Timeout");
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
    // 1. PATH
    try {
      const result = execSync(
        process.platform === "win32" ? "where uv" : "which uv",
        { stdio: "pipe", timeout: 5000 }
      );
      return result.toString().trim().split("\n")[0];
    } catch {}

    // 2. Typische Installationsorte
    const candidates: string[] = [];
    if (process.platform === "win32") {
      const localAppData = process.env.LOCALAPPDATA || "";
      const userProfile = process.env.USERPROFILE || "";
      candidates.push(
        path.join(localAppData, "uv", "uv.exe"),
        path.join(userProfile, ".local", "bin", "uv.exe"),
        path.join(userProfile, ".cargo", "bin", "uv.exe")
      );
    } else {
      const home = process.env.HOME || "";
      candidates.push(
        path.join(home, ".local", "bin", "uv"),
        path.join(home, ".cargo", "bin", "uv"),
        "/usr/local/bin/uv"
      );
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  async startBackend(): Promise<boolean> {
    this.setState("starting_backend");
    this.log("Suche uv...");

    const uvPath = this.findUv();
    if (!uvPath) {
      this.setState("error", "uv nicht gefunden. Bitte installieren: https://docs.astral.sh/uv/");
      return false;
    }
    this.log(`uv gefunden: ${uvPath}`);

    this.log("Starte Python Backend...");
    this.setState("loading_models");

    this.pythonProcess = spawn(
      uvPath,
      ["run", "python", "-m", "paragraf", "--mode", "api", "--port", "8000"],
      {
        cwd: this.projectDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      }
    );

    this.pythonProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      lines.forEach((line) => this.log(`[API] ${line}`));
    });

    this.pythonProcess.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      lines.forEach((line) => this.log(`[API] ${line}`));
    });

    this.pythonProcess.on("exit", (code) => {
      this.log(`Python-Prozess beendet (Code: ${code})`);
      this.backendRunning = false;
      if (this.state !== "stopped") {
        this.setState("error", `Backend unerwartet beendet (Code: ${code})`);
      }
    });

    // Health-Check warten (max 120s – Modelle laden dauert)
    for (let i = 0; i < 120; i++) {
      if (await this.checkBackendHealth()) {
        this.backendRunning = true;
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

  // ── Start/Stop ──────────────────────────────────────────────────────

  async start(): Promise<boolean> {
    if (this.state === "ready") return true;

    this.error = undefined;

    // 1. Docker prüfen
    if (!this.checkDocker()) {
      this.setState("error", "Docker ist nicht verfügbar. Bitte Docker Desktop starten.");
      return false;
    }

    // 2. Qdrant starten
    if (!(await this.startQdrant())) return false;

    // 3. Backend starten
    if (!(await this.startBackend())) return false;

    return true;
  }

  async stop(): Promise<void> {
    this.log("Stoppe Backend...");

    if (this.pythonProcess) {
      this.pythonProcess.kill("SIGTERM");
      // Grace period
      await this.sleep(2000);
      if (this.pythonProcess && !this.pythonProcess.killed) {
        this.pythonProcess.kill("SIGKILL");
      }
      this.pythonProcess = null;
    }

    this.backendRunning = false;
    this.setState("stopped");
    this.log("Backend gestoppt");
  }

  async stopQdrant(): Promise<void> {
    this.log("Stoppe Qdrant...");
    try {
      execSync("docker compose stop qdrant", {
        cwd: this.projectDir,
        stdio: "pipe",
        timeout: 30000,
      });
      this.qdrantRunning = false;
      this.log("Qdrant gestoppt");
    } catch (e: any) {
      this.log(`Fehler beim Stoppen von Qdrant: ${e.message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

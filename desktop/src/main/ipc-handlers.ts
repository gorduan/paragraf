import { ipcMain, BrowserWindow } from "electron";
import { execSync, spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { BackendManager } from "./backend";

function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        size += getDirSize(fullPath);
      }
    }
  } catch {
    // Permission errors etc.
  }
  return size;
}

export function registerIpcHandlers(backend: BackendManager): void {
  // Status-Updates an Renderer senden
  backend.setStateChangeHandler((status) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send("backend:status", status);
    });
  });

  ipcMain.handle("backend:getStatus", () => {
    return backend.getStatus();
  });

  ipcMain.handle("backend:start", async () => {
    return await backend.start();
  });

  ipcMain.handle("backend:stop", async () => {
    await backend.stop();
    return true;
  });

  ipcMain.handle("backend:stopQdrant", async () => {
    await backend.stopQdrant();
    return true;
  });

  ipcMain.handle("backend:checkQdrant", async () => {
    return await backend.checkQdrant();
  });

  // ── Settings ────────────────────────────────────────────────────────

  ipcMain.handle(
    "settings:save",
    async (_event, settings: Record<string, string>) => {
      const projectDir = backend.getProjectDir();
      const envPath = path.join(projectDir, ".env");
      const tmpPath = envPath + ".tmp";

      // Read existing .env to preserve comments and order
      let lines: string[] = [];
      if (fs.existsSync(envPath)) {
        lines = fs.readFileSync(envPath, "utf-8").split("\n");
      }

      const remaining = { ...settings };

      // Update existing lines
      const updatedLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) return line;
        const key = trimmed.slice(0, eqIdx).trim();
        if (key in remaining) {
          const val = remaining[key];
          delete remaining[key];
          return `${key}=${val}`;
        }
        return line;
      });

      // Append new keys
      for (const [key, val] of Object.entries(remaining)) {
        updatedLines.push(`${key}=${val}`);
      }

      // Atomic write: tmp → rename
      fs.writeFileSync(tmpPath, updatedLines.join("\n"), "utf-8");
      fs.renameSync(tmpPath, envPath);

      // Restart backend (+ MCP if running)
      return await backend.restart();
    },
  );

  ipcMain.handle(
    "settings:getDiskUsage",
    async (_event, dirPath: string) => {
      const exists = fs.existsSync(dirPath);
      const sizeBytes = exists ? getDirSize(dirPath) : 0;
      return { exists, sizeBytes };
    },
  );

  ipcMain.handle("settings:load", () => {
    const projectDir = backend.getProjectDir();
    const envPath = path.join(projectDir, ".env");
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
  });

  // ── Setup / Package Management ───────────────────────────────────────

  ipcMain.handle("setup:detectGpu", () => {
    try {
      const output = execSync("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits", {
        stdio: "pipe",
        timeout: 5000,
      }).toString().trim();
      if (output) {
        const [name, vram] = output.split(",").map((s) => s.trim());
        return { available: true, name, vramMb: parseInt(vram) || 0 };
      }
    } catch {}
    return { available: false, name: "", vramMb: 0 };
  });

  ipcMain.handle("setup:detectTorch", () => {
    const projectDir = backend.getProjectDir();
    try {
      const findUv = () => {
        try {
          return execSync(
            process.platform === "win32" ? "where uv" : "which uv",
            { stdio: "pipe", timeout: 5000 },
          ).toString().trim().split("\n")[0];
        } catch {}
        const userProfile = process.env.USERPROFILE || "";
        const candidate = path.join(userProfile, ".local", "bin", "uv.exe");
        if (fs.existsSync(candidate)) return candidate;
        return null;
      };
      const uv = findUv();
      if (!uv) return { installed: false, version: "", cuda: false };
      const output = execSync(
        `"${uv}" run python -c "import torch; print(torch.__version__); print(torch.cuda.is_available())"`,
        { cwd: projectDir, stdio: "pipe", timeout: 30000 },
      ).toString().trim();
      const lines = output.split("\n");
      const version = lines[0]?.trim() || "";
      const cuda = lines[1]?.trim() === "True";
      return { installed: true, version, cuda };
    } catch {
      return { installed: false, version: "", cuda: false };
    }
  });

  ipcMain.handle(
    "setup:installTorch",
    (_event, variant: "cpu" | "cuda") => {
      const projectDir = backend.getProjectDir();
      return new Promise<{ success: boolean; output: string }>((resolve) => {
        const findUv = () => {
          try {
            return execSync(
              process.platform === "win32" ? "where uv" : "which uv",
              { stdio: "pipe", timeout: 5000 },
            ).toString().trim().split("\n")[0];
          } catch {}
          const userProfile = process.env.USERPROFILE || "";
          const candidate = path.join(userProfile, ".local", "bin", "uv.exe");
          if (fs.existsSync(candidate)) return candidate;
          return null;
        };
        const uv = findUv();
        if (!uv) {
          resolve({ success: false, output: "uv nicht gefunden" });
          return;
        }

        const args = variant === "cuda"
          ? ["pip", "install", "--reinstall", "torch", "--index-url", "https://download.pytorch.org/whl/cu128"]
          : ["pip", "install", "--reinstall", "torch", "--index-url", "https://download.pytorch.org/whl/cpu"];

        // Read .env for cache paths
        const envPath = path.join(projectDir, ".env");
        let envVars: Record<string, string> = {};
        if (fs.existsSync(envPath)) {
          for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
            const t = line.trim();
            if (!t || t.startsWith("#")) continue;
            const eq = t.indexOf("=");
            if (eq !== -1) envVars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
          }
        }

        const proc = spawn(uv, args, {
          cwd: projectDir,
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            UV_CACHE_DIR: process.env.UV_CACHE_DIR || "E:/uv_cache",
            TMPDIR: process.env.TMPDIR || "E:/tmp",
            TEMP: process.env.TMPDIR || "E:/tmp",
            TMP: process.env.TMPDIR || "E:/tmp",
          },
        });

        let output = "";
        proc.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          output += text;
          // Send progress to renderer
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((win) => {
            win.webContents.send("setup:installProgress", text);
          });
        });
        proc.stderr?.on("data", (data: Buffer) => {
          const text = data.toString();
          output += text;
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((win) => {
            win.webContents.send("setup:installProgress", text);
          });
        });
        proc.on("exit", (code) => {
          resolve({ success: code === 0, output });
        });
        proc.on("error", (err) => {
          resolve({ success: false, output: err.message });
        });
      });
    },
  );

  // ── MCP ─────────────────────────────────────────────────────────────

  ipcMain.handle("mcp:start", async () => {
    return await backend.startMcp();
  });

  ipcMain.handle("mcp:stop", async () => {
    await backend.stopMcp();
    return true;
  });
}

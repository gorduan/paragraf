/** IPC-Handler – Verbindet Renderer-Anfragen mit Docker-Lifecycle und Setup-Wizard. */
import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { checkDockerAvailable, checkDockerDetailed, startDockerCompose, stopDockerCompose } from "./docker";
import { store } from "./store";
import { logger } from "./logger";

export function registerIpcHandlers(): void {
  // ── Docker Lifecycle ──────────────────────────────────────────────────────
  ipcMain.handle("docker:status", async () => {
    const status = await checkDockerAvailable();
    logger.info("Docker Status abgefragt:", status);
    return status;
  });

  ipcMain.handle("docker:restart", async () => {
    logger.info("Docker Neustart angefordert");
    try {
      await stopDockerCompose();
      const cachePath = (store.get("setup.modelCachePath") as string) || undefined;
      const gpuEnabled = (store.get("setup.gpuEnabled") as boolean) || false;
      await startDockerCompose(cachePath, gpuEnabled);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Docker Neustart fehlgeschlagen:", message);
      return { success: false, error: message };
    }
  });

  // ── Setup Wizard ──────────────────────────────────────────────────────────
  ipcMain.handle("setup:getState", () => {
    return store.get("setup");
  });

  ipcMain.handle("setup:setStep", (_event, step: number) => {
    store.set("setup.setupStep", step);
    return true;
  });

  ipcMain.handle("setup:checkDocker", async () => {
    const result = await checkDockerDetailed();
    const detected = result.status === "running" || result.status === "not-running" || result.status === "installed";
    store.set("setup.dockerDetected", detected);
    return result;
  });

  ipcMain.handle("setup:openDockerDownload", () => {
    shell.openExternal("https://www.docker.com/products/docker-desktop/");
    return true;
  });

  ipcMain.handle("setup:complete", () => {
    store.set("setup.setupComplete", true);
    store.set("setup.setupStep", 7);
    return true;
  });

  ipcMain.handle("setup:storageEstimate", () => {
    const storedPath = store.get("setup.modelCachePath");
    const modelCachePath = storedPath
      || process.env.HF_HOME
      || process.env.PARAGRAF_MODEL_CACHE
      || "C:\\ProgramData\\Paragraf\\models";
    return { dockerImages: 4000, mlModels: 4000, lawData: 500, total: 8500, unit: "MB", modelCachePath };
  });

  ipcMain.handle("setup:selectModelCachePath", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Modell-Cache-Ordner wählen",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selected = result.filePaths[0];
    store.set("setup.modelCachePath", selected);
    return selected;
  });

  ipcMain.handle("setup:startDocker", async () => {
    logger.info("Setup abgeschlossen - Docker Compose starten");
    try {
      const cachePath = (store.get("setup.modelCachePath") as string) || undefined;
      const gpuEnabled = (store.get("setup.gpuEnabled") as boolean) || false;
      await startDockerCompose(cachePath, gpuEnabled);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Docker Compose Start fehlgeschlagen:", message);
      return { success: false, error: message };
    }
  });

  // ── GPU & Cache Management ─────────────────────────────────────────────────

  ipcMain.handle("setup:switchGpu", async (_event, enabled: boolean) => {
    logger.info("GPU-Wechsel angefordert:", enabled);
    store.set("setup.gpuEnabled", enabled);
    try {
      await stopDockerCompose();
      const cachePath = (store.get("setup.modelCachePath") as string) || undefined;
      await startDockerCompose(cachePath, enabled);
      return { success: true, gpuEnabled: enabled };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("GPU-Wechsel fehlgeschlagen:", message);
      // D-09: Fallback to CPU on failure
      store.set("setup.gpuEnabled", false);
      try {
        const cachePath = (store.get("setup.modelCachePath") as string) || undefined;
        await startDockerCompose(cachePath, false);
      } catch { /* best effort */ }
      return { success: false, error: message, gpuEnabled: false };
    }
  });

  ipcMain.handle("setup:getGpuPreference", () => {
    return { gpuEnabled: (store.get("setup.gpuEnabled") as boolean) || false };
  });

  ipcMain.handle("setup:clearModelCache", async () => {
    const cachePath = store.get("setup.modelCachePath") as string;
    if (!cachePath) return { success: false, error: "Kein Cache-Pfad konfiguriert" };
    const fs = await import("fs/promises");
    const nodePath = await import("path");
    const hubDir = nodePath.join(cachePath, "hub");
    try {
      await fs.rm(hubDir, { recursive: true, force: true });
      // D-07: Reset setup state so download step is shown on next app start
      store.set("setup.setupStep", 4); // step 4 = download
      store.set("setup.setupComplete", false);
      logger.info("Model-Cache geloescht, Setup-State zurueckgesetzt:", hubDir);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Cache-Loeschen fehlgeschlagen:", message);
      return { success: false, error: message };
    }
  });

  ipcMain.handle("setup:getCacheSize", async () => {
    const cachePath = store.get("setup.modelCachePath") as string;
    if (!cachePath) return { totalMb: 0, path: "" };
    const fs = await import("fs/promises");
    const nodePath = await import("path");
    const hubDir = nodePath.join(cachePath, "hub");
    let totalBytes = 0;
    try {
      const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = nodePath.join(dir, entry.name);
          if (entry.isDirectory()) await walk(fullPath);
          else {
            const stat = await fs.stat(fullPath);
            totalBytes += stat.size;
          }
        }
      };
      await walk(hubDir);
    } catch { /* dir may not exist */ }
    return { totalMb: Math.round(totalBytes / (1024 * 1024)), path: cachePath };
  });
}

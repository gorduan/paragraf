/** IPC-Handler – Verbindet Renderer-Anfragen mit Docker-Lifecycle und Setup-Wizard. */
import { ipcMain, shell } from "electron";
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
      await startDockerCompose();
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
    store.set("setup.setupStep", 5);
    return true;
  });

  ipcMain.handle("setup:storageEstimate", () => {
    const modelCachePath = process.env.HF_HOME
      || process.env.PARAGRAF_MODEL_CACHE
      || "C:\\ProgramData\\Paragraf\\models";
    return { dockerImages: 4000, mlModels: 4000, lawData: 500, total: 8500, unit: "MB", modelCachePath };
  });

  ipcMain.handle("setup:startDocker", async () => {
    logger.info("Setup abgeschlossen - Docker Compose starten");
    try {
      await startDockerCompose();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Docker Compose Start fehlgeschlagen:", message);
      return { success: false, error: message };
    }
  });
}

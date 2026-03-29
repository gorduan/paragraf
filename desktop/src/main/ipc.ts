/** IPC-Handler – Verbindet Renderer-Anfragen mit Docker-Lifecycle. */
import { ipcMain } from "electron";
import { checkDockerAvailable, startDockerCompose, stopDockerCompose } from "./docker";
import { logger } from "./logger";

export function registerIpcHandlers(): void {
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
}

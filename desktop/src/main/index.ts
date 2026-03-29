/** Paragraf Desktop – Electron Main Process Entry Point. */
import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./window";
import { startDockerCompose, stopDockerCompose, killComposeProcess } from "./docker";
import { registerIpcHandlers } from "./ipc";
import { logger } from "./logger";

// ── Single-Instance Lock (SHELL-03) ────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.warn("Zweite Instanz erkannt – beende");
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;
  let isQuitting = false;

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      logger.info("Zweite Instanz: bestehendes Fenster fokussiert");
    }
  });

  app.whenReady().then(async () => {
    logger.info("=== Paragraf Desktop startet ===");

    // Register IPC handlers before creating window (LIFE-02)
    registerIpcHandlers();

    mainWindow = createMainWindow();

    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    // Start Docker Compose after window is visible (LIFE-01)
    try {
      await startDockerCompose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Docker Compose konnte nicht gestartet werden:", message);
      // Don't crash – renderer shows HealthOverlay with retry option
    }
  });

  // ── Clean Shutdown (LIFE-01) ───────────────────────────────────────────────
  app.on("before-quit", async (e) => {
    if (isQuitting) return;
    isQuitting = true;
    e.preventDefault();
    logger.info("App wird beendet – Docker Compose stoppen...");
    try {
      await stopDockerCompose();
    } catch {
      logger.warn("Docker Compose stop fehlgeschlagen – erzwinge Beendigung");
      killComposeProcess();
    }
    app.exit(0);
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}

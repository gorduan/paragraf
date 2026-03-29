/** Paragraf Desktop – Electron Main Process Entry Point. */
import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./window";
import { logger } from "./logger";

// ── Single-Instance Lock (SHELL-03) ────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.warn("Zweite Instanz erkannt – beende");
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      logger.info("Zweite Instanz: bestehendes Fenster fokussiert");
    }
  });

  app.whenReady().then(async () => {
    logger.info("=== Paragraf Desktop startet ===");
    mainWindow = createMainWindow();

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}

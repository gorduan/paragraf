/** BrowserWindow-Factory fuer das Hauptfenster. */
import { BrowserWindow } from "electron";
import path from "path";
import { logger } from "./logger";

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Paragraf",
    icon: path.join(__dirname, "../../resources/icon.ico"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
    logger.info("Hauptfenster angezeigt");
  });

  // In dev: load Vite dev server
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    // In production: load built frontend from resources
    const rendererPath = path.join(__dirname, "../../renderer/index.html");
    win.loadFile(rendererPath);
  }

  return win;
}

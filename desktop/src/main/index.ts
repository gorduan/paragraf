import { app, BrowserWindow, ipcMain, globalShortcut } from "electron";
import * as path from "path";
import { BackendManager } from "./backend";
import { registerIpcHandlers } from "./ipc-handlers";

let mainWindow: BrowserWindow | null = null;
let backendManager: BackendManager | null = null;

const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Paragraf",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),

      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: "#0f172a",
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Backend-Manager initialisieren
  backendManager = new BackendManager();

  // IPC-Handler registrieren
  registerIpcHandlers(backendManager);

  createWindow();

  // Globale Shortcuts
  globalShortcut.register("CommandOrControl+K", () => {
    mainWindow?.webContents.send("shortcut:search");
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", async () => {
  if (backendManager) {
    await backendManager.stop();
  }
  globalShortcut.unregisterAll();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (backendManager) {
    await backendManager.stop();
  }
});

import { ipcMain, BrowserWindow } from "electron";
import { BackendManager } from "./backend";

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

  ipcMain.handle("backend:checkDocker", () => {
    return backend.checkDocker();
  });
}

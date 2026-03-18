import { contextBridge, ipcRenderer } from "electron";

export interface BackendStatus {
  state: string;
  docker: boolean;
  qdrant: boolean;
  backend: boolean;
  error?: string;
  log: string[];
}

const electronAPI = {
  // Backend-Management
  backend: {
    getStatus: (): Promise<BackendStatus> =>
      ipcRenderer.invoke("backend:getStatus"),
    start: (): Promise<boolean> => ipcRenderer.invoke("backend:start"),
    stop: (): Promise<boolean> => ipcRenderer.invoke("backend:stop"),
    stopQdrant: (): Promise<boolean> =>
      ipcRenderer.invoke("backend:stopQdrant"),
    checkDocker: (): Promise<boolean> =>
      ipcRenderer.invoke("backend:checkDocker"),
    onStatus: (callback: (status: BackendStatus) => void) => {
      const handler = (_event: any, status: BackendStatus) => callback(status);
      ipcRenderer.on("backend:status", handler);
      return () => ipcRenderer.removeListener("backend:status", handler);
    },
  },
  // Shortcuts
  onSearchShortcut: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("shortcut:search", handler);
    return () => ipcRenderer.removeListener("shortcut:search", handler);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;

import { contextBridge, ipcRenderer } from "electron";

export interface BackendStatus {
  state: string;
  qdrant: boolean;
  backend: boolean;
  mcp: boolean;
  error?: string;
  log: string[];
  loadingProgress: number;
  loadingStage: string;
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
    checkQdrant: (): Promise<boolean> =>
      ipcRenderer.invoke("backend:checkQdrant"),
    onStatus: (callback: (status: BackendStatus) => void) => {
      const handler = (_event: any, status: BackendStatus) => callback(status);
      ipcRenderer.on("backend:status", handler);
      return () => ipcRenderer.removeListener("backend:status", handler);
    },
  },
  // Settings
  settings: {
    load: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke("settings:load"),
    save: (settings: Record<string, string>): Promise<boolean> =>
      ipcRenderer.invoke("settings:save", settings),
    getDiskUsage: (
      dirPath: string,
    ): Promise<{ exists: boolean; sizeBytes: number }> =>
      ipcRenderer.invoke("settings:getDiskUsage", dirPath),
  },
  // MCP Server
  mcp: {
    start: (): Promise<boolean> => ipcRenderer.invoke("mcp:start"),
    stop: (): Promise<boolean> => ipcRenderer.invoke("mcp:stop"),
  },
  // Setup
  setup: {
    detectGpu: (): Promise<{ available: boolean; name: string; vramMb: number }> =>
      ipcRenderer.invoke("setup:detectGpu"),
    detectTorch: (): Promise<{ installed: boolean; version: string; cuda: boolean }> =>
      ipcRenderer.invoke("setup:detectTorch"),
    installTorch: (variant: "cpu" | "cuda"): Promise<{ success: boolean; output: string }> =>
      ipcRenderer.invoke("setup:installTorch", variant),
    onInstallProgress: (callback: (text: string) => void) => {
      const handler = (_event: any, text: string) => callback(text);
      ipcRenderer.on("setup:installProgress", handler);
      return () => ipcRenderer.removeListener("setup:installProgress", handler);
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

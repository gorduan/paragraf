/// <reference types="vite/client" />

export {};

interface BackendStatus {
  state: string;
  qdrant: boolean;
  backend: boolean;
  mcp: boolean;
  error?: string;
  log: string[];
  loadingProgress: number;
  loadingStage: string;
}

interface ElectronAPI {
  backend: {
    getStatus: () => Promise<BackendStatus>;
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    stopQdrant: () => Promise<boolean>;
    checkQdrant: () => Promise<boolean>;
    onStatus: (callback: (status: BackendStatus) => void) => () => void;
  };
  settings: {
    load: () => Promise<Record<string, string>>;
    save: (settings: Record<string, string>) => Promise<boolean>;
    getDiskUsage: (
      dirPath: string,
    ) => Promise<{ exists: boolean; sizeBytes: number }>;
  };
  mcp: {
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
  };
  setup: {
    detectGpu: () => Promise<{ available: boolean; name: string; vramMb: number }>;
    detectTorch: () => Promise<{ installed: boolean; version: string; cuda: boolean }>;
    installTorch: (variant: "cpu" | "cuda") => Promise<{ success: boolean; output: string }>;
    onInstallProgress: (callback: (text: string) => void) => () => void;
  };
  onSearchShortcut: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

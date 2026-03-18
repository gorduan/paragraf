/// <reference types="vite/client" />

export {};

interface BackendStatus {
  state: string;
  qdrant: boolean;
  backend: boolean;
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
  onSearchShortcut: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

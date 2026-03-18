/// <reference types="vite/client" />

export {};

interface BackendStatus {
  state: string;
  docker: boolean;
  qdrant: boolean;
  backend: boolean;
  error?: string;
  log: string[];
}

interface ElectronAPI {
  backend: {
    getStatus: () => Promise<BackendStatus>;
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    stopQdrant: () => Promise<boolean>;
    checkDocker: () => Promise<boolean>;
    onStatus: (callback: (status: BackendStatus) => void) => () => void;
  };
  onSearchShortcut: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

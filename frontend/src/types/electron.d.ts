/** Globale Window-Erweiterungen fuer Electron IPC Bridges. */

interface SetupState {
  setupComplete: boolean;
  setupStep: number;
  selectedMode: "docker";
  dockerDetected: boolean;
  estimatedStorage: number;
}

interface DockerCheckResult {
  status: "running" | "installed" | "not-running" | "missing";
  version?: string;
}

interface StorageEstimate {
  dockerImages: number;
  mlModels: number;
  lawData: number;
  total: number;
  unit: string;
}

interface ParagrafSetup {
  getSetupState: () => Promise<SetupState>;
  setSetupStep: (step: number) => Promise<boolean>;
  checkDocker: () => Promise<DockerCheckResult>;
  openDockerDownload: () => Promise<boolean>;
  completeSetup: () => Promise<boolean>;
  getStorageEstimate: () => Promise<StorageEstimate>;
  startDocker: () => Promise<{ success: boolean; error?: string }>;
}

interface ParagrafDesktop {
  isDesktop: boolean;
  getDockerStatus: () => Promise<string>;
  restartDocker: () => Promise<void>;
}

declare global {
  interface Window {
    paragrafSetup?: ParagrafSetup;
    paragrafDesktop?: ParagrafDesktop;
  }
}

export {};

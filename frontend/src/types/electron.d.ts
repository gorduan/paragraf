/** Globale Window-Erweiterungen fuer Electron IPC Bridges. */

declare global {
  interface SetupState {
    setupComplete: boolean;
    setupStep: number;
    selectedMode: "docker";
    dockerDetected: boolean;
    estimatedStorage: number;
    modelCachePath: string;
    gpuEnabled: boolean;
  }

  interface DockerCheckResult {
    status: "running" | "installed" | "not-running" | "missing";
    version?: string;
  }

  interface ParagrafStorageEstimate {
    dockerImages: number;
    mlModels: number;
    lawData: number;
    total: number;
    unit: string;
    modelCachePath: string;
  }

  interface ParagrafSetup {
    getSetupState: () => Promise<SetupState>;
    setSetupStep: (step: number) => Promise<boolean>;
    checkDocker: () => Promise<DockerCheckResult>;
    openDockerDownload: () => Promise<boolean>;
    completeSetup: () => Promise<boolean>;
    getStorageEstimate: () => Promise<ParagrafStorageEstimate>;
    startDocker: () => Promise<{ success: boolean; error?: string }>;
    selectModelCachePath: () => Promise<string | null>;
    // GPU & Cache management
    switchGpu: (enabled: boolean) => Promise<{ success: boolean; error?: string; gpuEnabled: boolean }>;
    getGpuPreference: () => Promise<{ gpuEnabled: boolean }>;
    clearModelCache: () => Promise<{ success: boolean; error?: string }>;
    getCacheSize: () => Promise<{ totalMb: number; path: string }>;
  }

  interface ParagrafDesktop {
    isDesktop: boolean;
    getDockerStatus: () => Promise<string>;
    restartDocker: () => Promise<{ success: boolean; error?: string }>;
  }

  interface Window {
    paragrafSetup?: ParagrafSetup;
    paragrafDesktop?: ParagrafDesktop;
  }
}

export {};

/** Preload-Script – IPC-Bridge zwischen Main und Renderer. */
import { contextBridge, ipcRenderer } from "electron";

// Inject API base URL so frontend talks directly to Docker backend at localhost:8000
// The existing frontend reads: (window as any).__PARAGRAF_API_BASE_URL__ || ""
contextBridge.exposeInMainWorld("__PARAGRAF_API_BASE_URL__", "http://localhost:8000");

// Desktop-specific API for renderer
contextBridge.exposeInMainWorld("paragrafDesktop", {
  isDesktop: true,
  getDockerStatus: (): Promise<string> => ipcRenderer.invoke("docker:status"),
  restartDocker: (): Promise<void> => ipcRenderer.invoke("docker:restart"),
});

// Setup wizard API for renderer
contextBridge.exposeInMainWorld("paragrafSetup", {
  getSetupState: () => ipcRenderer.invoke("setup:getState"),
  setSetupStep: (step: number) => ipcRenderer.invoke("setup:setStep", step),
  checkDocker: () => ipcRenderer.invoke("setup:checkDocker"),
  openDockerDownload: () => ipcRenderer.invoke("setup:openDockerDownload"),
  completeSetup: () => ipcRenderer.invoke("setup:complete"),
  getStorageEstimate: () => ipcRenderer.invoke("setup:storageEstimate"),
  startDocker: () => ipcRenderer.invoke("setup:startDocker"),
  selectModelCachePath: () => ipcRenderer.invoke("setup:selectModelCachePath"),
  // GPU & Cache management
  switchGpu: (enabled: boolean) => ipcRenderer.invoke("setup:switchGpu", enabled),
  getGpuPreference: () => ipcRenderer.invoke("setup:getGpuPreference"),
  clearModelCache: () => ipcRenderer.invoke("setup:clearModelCache"),
  getCacheSize: () => ipcRenderer.invoke("setup:getCacheSize"),
});

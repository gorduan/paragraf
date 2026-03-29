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

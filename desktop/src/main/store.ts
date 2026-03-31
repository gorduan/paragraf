/** Persistenter App-Store fuer Setup-Wizard-State und Einstellungen. */
import Store from "electron-store";

export interface SetupState {
  setupComplete: boolean;
  setupStep: number; // 0=welcome, 1=mode, 2=docker-check, 3=storage, 4=download, 5=gpu, 6=summary
  selectedMode: "docker"; // Only "docker" in v2.0
  dockerDetected: boolean;
  estimatedStorage: number; // MB
  modelCachePath: string;
  gpuEnabled: boolean; // Whether GPU mode is active
}

export interface AppSchema {
  setup: SetupState;
}

const defaults: AppSchema = {
  setup: {
    setupComplete: false,
    setupStep: 0,
    selectedMode: "docker",
    dockerDetected: false,
    estimatedStorage: 0,
    modelCachePath: "",
    gpuEnabled: false,
  },
};

export const store = new Store<AppSchema>({ name: "config", projectName: "paragraf-desktop", defaults });

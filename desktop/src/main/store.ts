/** Persistenter App-Store fuer Setup-Wizard-State und Einstellungen. */
import Store from "electron-store";

export interface SetupState {
  setupComplete: boolean;
  setupStep: number; // 0=welcome, 1=mode, 2=docker-check, 3=storage, 4=summary
  selectedMode: "docker"; // Only "docker" in v2.0
  dockerDetected: boolean;
  estimatedStorage: number; // MB
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
  },
};

export const store = new Store<AppSchema>({ name: "config", projectName: "paragraf-desktop", defaults });

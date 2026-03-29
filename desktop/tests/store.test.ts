/** Tests fuer electron-store Setup-Wizard-State. */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron-store with in-memory Map-backed implementation
const mockStore = new Map<string, unknown>();

vi.mock("electron-store", () => {
  return {
    default: class MockStore {
      private defaults: Record<string, unknown>;

      constructor(opts?: { defaults?: Record<string, unknown> }) {
        this.defaults = opts?.defaults ?? {};
        // Initialize with defaults
        for (const [key, value] of Object.entries(this.defaults)) {
          if (!mockStore.has(key)) {
            mockStore.set(key, structuredClone(value));
          }
        }
      }

      get(key: string): unknown {
        // Support dotted keys like "setup.setupStep"
        const parts = key.split(".");
        if (parts.length === 1) {
          return mockStore.has(key) ? mockStore.get(key) : this.defaults[key];
        }
        const root = mockStore.get(parts[0]) as Record<string, unknown> | undefined;
        if (!root) return undefined;
        return root[parts[1]];
      }

      set(key: string, value: unknown): void {
        const parts = key.split(".");
        if (parts.length === 1) {
          mockStore.set(key, value);
          return;
        }
        const root = (mockStore.get(parts[0]) as Record<string, unknown>) ?? {};
        root[parts[1]] = value;
        mockStore.set(parts[0], root);
      }
    },
  };
});

// Must import AFTER mock is set up
import { store } from "../src/main/store";

describe("store", () => {
  beforeEach(() => {
    mockStore.clear();
    // Re-initialize defaults
    mockStore.set("setup", {
      setupComplete: false,
      setupStep: 0,
      selectedMode: "docker",
      dockerDetected: false,
      estimatedStorage: 0,
    });
  });

  it("defaults return setupComplete=false", () => {
    const setup = store.get("setup") as Record<string, unknown>;
    expect(setup.setupComplete).toBe(false);
  });

  it("defaults return setupStep=0", () => {
    const setup = store.get("setup") as Record<string, unknown>;
    expect(setup.setupStep).toBe(0);
  });

  it("defaults return selectedMode='docker'", () => {
    const setup = store.get("setup") as Record<string, unknown>;
    expect(setup.selectedMode).toBe("docker");
  });

  it("setting setupStep=3 then getting it returns 3", () => {
    store.set("setup.setupStep", 3);
    expect(store.get("setup.setupStep")).toBe(3);
  });

  it("setting setupComplete=true persists", () => {
    store.set("setup.setupComplete", true);
    expect(store.get("setup.setupComplete")).toBe(true);
  });
});

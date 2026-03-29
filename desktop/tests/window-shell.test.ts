import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLoadFile = vi.fn();
const mockLoadURL = vi.fn();
const mockShow = vi.fn();
const mockOnce = vi.fn();

vi.mock("electron", () => {
  const BrowserWindow = vi.fn(function (this: Record<string, unknown>) {
    this.loadFile = mockLoadFile;
    this.loadURL = mockLoadURL;
    this.show = mockShow;
    this.once = mockOnce;
  });
  return { BrowserWindow };
});

describe("Window Shell (SHELL-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ELECTRON_RENDERER_URL;
  });

  it("should create BrowserWindow with contextIsolation and sandbox", async () => {
    const { BrowserWindow } = await import("electron");
    const { createMainWindow } = await import("../src/main/window");
    createMainWindow();

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Paragraf",
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        }),
      })
    );
  });

  it("should load file URL in production mode", async () => {
    const { createMainWindow } = await import("../src/main/window");
    createMainWindow();
    expect(mockLoadFile).toHaveBeenCalledTimes(1);
    const loadedPath = mockLoadFile.mock.calls[0][0] as string;
    expect(loadedPath.replace(/\\/g, "/")).toContain("renderer/index.html");
  });
});

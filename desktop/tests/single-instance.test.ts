import { describe, it, expect, vi } from "vitest";

// Mock electron app module
const mockQuit = vi.fn();
const mockOn = vi.fn();
const mockWhenReady = vi.fn(() => Promise.resolve());
const mockRequestSingleInstanceLock = vi.fn();

vi.mock("electron", () => ({
  app: {
    requestSingleInstanceLock: mockRequestSingleInstanceLock,
    quit: mockQuit,
    on: mockOn,
    whenReady: mockWhenReady,
    isPackaged: false,
    exit: vi.fn(),
  },
  BrowserWindow: vi.fn(function (this: Record<string, unknown>) {
    this.loadFile = vi.fn();
    this.loadURL = vi.fn();
    this.show = vi.fn();
    this.once = vi.fn();
    this.on = vi.fn();
  }),
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock child_process for docker.ts import
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

// Mock tree-kill for docker.ts import
vi.mock("tree-kill", () => ({
  default: vi.fn(),
}));

describe("Single-Instance Lock (SHELL-03)", () => {
  it("should call requestSingleInstanceLock", async () => {
    mockRequestSingleInstanceLock.mockReturnValue(true);
    // Import triggers the lock check
    await import("../src/main/index");
    expect(mockRequestSingleInstanceLock).toHaveBeenCalledOnce();
  });
});

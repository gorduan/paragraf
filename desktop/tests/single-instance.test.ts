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
  },
  BrowserWindow: vi.fn(function (this: Record<string, unknown>) {
    this.loadFile = vi.fn();
    this.loadURL = vi.fn();
    this.show = vi.fn();
    this.once = vi.fn();
    this.on = vi.fn();
  }),
}));

describe("Single-Instance Lock (SHELL-03)", () => {
  it("should call requestSingleInstanceLock", async () => {
    mockRequestSingleInstanceLock.mockReturnValue(true);
    // Import triggers the lock check
    await import("../src/main/index");
    expect(mockRequestSingleInstanceLock).toHaveBeenCalledOnce();
  });
});

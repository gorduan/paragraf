import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process
const mockExecFile = vi.fn();
vi.mock("child_process", () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
}));

// Mock electron
vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getAppPath: () => "/mock/app",
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock tree-kill
vi.mock("tree-kill", () => ({
  default: vi.fn(),
}));

describe("Docker Lifecycle (LIFE-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("checkDockerAvailable", () => {
    it("should return 'running' when docker info succeeds", async () => {
      mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: any, cb: Function) => {
        if (args[0] === "info") cb(null, "", "");
      });

      const { checkDockerAvailable } = await import("../src/main/docker");
      const result = await checkDockerAvailable();
      expect(result).toBe("running");
    });

    it("should return 'installed' when docker info fails but version works", async () => {
      mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: any, cb: Function) => {
        if (args[0] === "info") cb(new Error("daemon not running"));
        if (args[0] === "--version") cb(null, "Docker version 28.4.0", "");
      });

      const { checkDockerAvailable } = await import("../src/main/docker");
      const result = await checkDockerAvailable();
      expect(result).toBe("installed");
    });

    it("should return 'missing' when docker is not found", async () => {
      mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: any, cb: Function) => {
        if (args[0] === "info") cb(new Error("not found"));
        if (args[0] === "--version") cb(new Error("not found"));
      });

      const { checkDockerAvailable } = await import("../src/main/docker");
      const result = await checkDockerAvailable();
      expect(result).toBe("missing");
    });
  });

  describe("startDockerCompose", () => {
    it("should call docker compose up -d with correct arguments", async () => {
      mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: any, cb: Function) => {
        cb(null, "", "");
        return { pid: 1234 };
      });

      const { startDockerCompose } = await import("../src/main/docker");
      await startDockerCompose();

      expect(mockExecFile).toHaveBeenCalledWith(
        "docker",
        expect.arrayContaining(["compose", "-p", "paragraf", "up", "-d"]),
        expect.objectContaining({ windowsHide: true }),
        expect.any(Function)
      );
    });

    it("should reject when docker compose fails", async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(new Error("compose failed"));
        return { pid: 1234 };
      });

      const { startDockerCompose } = await import("../src/main/docker");
      await expect(startDockerCompose()).rejects.toThrow("compose failed");
    });
  });

  describe("stopDockerCompose", () => {
    it("should call docker compose stop", async () => {
      mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: any, cb: Function) => {
        if (args.includes("stop")) cb(null, "", "");
      });

      const { stopDockerCompose } = await import("../src/main/docker");
      await stopDockerCompose();

      expect(mockExecFile).toHaveBeenCalledWith(
        "docker",
        expect.arrayContaining(["compose", "-p", "paragraf", "stop"]),
        expect.objectContaining({ windowsHide: true }),
        expect.any(Function)
      );
    });
  });
});

describe("IPC Handlers (LIFE-01, LIFE-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should register docker:status and docker:restart handlers", async () => {
    const { ipcMain } = await import("electron");
    const { registerIpcHandlers } = await import("../src/main/ipc");

    registerIpcHandlers();

    expect(ipcMain.handle).toHaveBeenCalledWith("docker:status", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("docker:restart", expect.any(Function));
  });
});

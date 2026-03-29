/** Tests fuer erweiterte Docker-Erkennung mit 4 Stufen. */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process.execFile (safe pattern - no shell)
const mockExecFile = vi.fn();
vi.mock("child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock electron app
vi.mock("electron", () => ({
  app: { isPackaged: false, getAppPath: () => "/test" },
}));

// Mock tree-kill
vi.mock("tree-kill", () => ({ default: vi.fn() }));

// Mock logger
vi.mock("../src/main/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { checkDockerDetailed } from "../src/main/docker";

describe("checkDockerDetailed", () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it("returns status 'running' with version when docker info succeeds", async () => {
    mockExecFile.mockImplementation(
      (cmd: string, args: string[], _opts: unknown, cb?: Function) => {
        if (args[0] === "info") {
          cb?.(null, "Docker info output", "");
        } else if (args[0] === "--version") {
          cb?.(null, "Docker version 24.0.7, build afdd53b", "");
        }
        return { pid: 1 };
      }
    );

    const result = await checkDockerDetailed();
    expect(result.status).toBe("running");
    expect(result.version).toBeDefined();
  });

  it("returns status 'not-running' when docker info fails but --version succeeds", async () => {
    mockExecFile.mockImplementation(
      (cmd: string, args: string[], _opts: unknown, cb?: Function) => {
        if (args[0] === "info") {
          cb?.(new Error("Cannot connect to Docker daemon"));
        } else if (args[0] === "--version") {
          cb?.(null, "Docker version 24.0.7, build afdd53b", "");
        }
        return { pid: 1 };
      }
    );

    const result = await checkDockerDetailed();
    expect(result.status).toBe("not-running");
    expect(result.version).toContain("24.0.7");
  });

  it("returns status 'installed' when docker commands fail but registry query finds Docker Desktop", async () => {
    mockExecFile.mockImplementation(
      (cmd: string, args: string[], _opts: unknown, cb?: Function) => {
        if (cmd === "docker") {
          cb?.(new Error("not found"));
        } else if (cmd === "reg") {
          cb?.(null, "Docker Desktop    REG_SZ    C:\\Program Files\\Docker\\Docker Desktop.exe", "");
        }
        return { pid: 1 };
      }
    );

    const result = await checkDockerDetailed();
    expect(result.status).toBe("installed");
    expect(result.version).toBeUndefined();
  });

  it("returns status 'missing' when all checks fail", async () => {
    mockExecFile.mockImplementation(
      (cmd: string, _args: string[], _opts: unknown, cb?: Function) => {
        cb?.(new Error("not found"));
        return { pid: 1 };
      }
    );

    const result = await checkDockerDetailed();
    expect(result.status).toBe("missing");
  });
});

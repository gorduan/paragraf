/** Docker-Compose-Lifecycle – Start, Stop, Status-Pruefung. */
import { execFile, type ChildProcess } from "child_process";
import path from "path";
import { app } from "electron";
import kill from "tree-kill";
import { logger } from "./logger";

let composeProcess: ChildProcess | null = null;

/** Resolve path to docker-compose.desktop.yml relative to app root. */
function getComposeFilePath(): string {
  // In dev: project root is 2 levels up from desktop/out/main/
  // In production: app.getAppPath() points to the asar or app directory
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.resolve(__dirname, "..", "..", "..", "docker-compose.desktop.yml");
  }
  // In packaged app: compose file is in extraResources
  return path.join(process.resourcesPath, "docker-compose.desktop.yml");
}

/** Resolve path to docker-compose.gpu.yml relative to app root. */
function getGpuComposeFilePath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.resolve(__dirname, "..", "..", "..", "docker-compose.gpu.yml");
  }
  return path.join(process.resourcesPath, "docker-compose.gpu.yml");
}

export type DockerAvailability = "running" | "installed" | "missing";

export interface DockerCheckResult {
  status: "running" | "installed" | "not-running" | "missing";
  version?: string;
}

/** Check if Docker daemon is available. */
export function checkDockerAvailable(): Promise<DockerAvailability> {
  return new Promise((resolve) => {
    execFile("docker", ["info"], { windowsHide: true, timeout: 10000 }, (error) => {
      if (!error) {
        resolve("running");
        return;
      }
      execFile("docker", ["--version"], { windowsHide: true, timeout: 5000 }, (vErr) => {
        resolve(vErr ? "missing" : "installed");
      });
    });
  });
}

/** Erweiterte Docker-Erkennung mit 4 Stufen inkl. Windows-Registry-Fallback. */
export function checkDockerDetailed(): Promise<DockerCheckResult> {
  return new Promise((resolve) => {
    // Tier 1: docker info -> running (daemon is responsive)
    execFile("docker", ["info"], { windowsHide: true, timeout: 10000 }, (infoErr) => {
      if (!infoErr) {
        // Docker daemon is running, get version
        execFile(
          "docker",
          ["--version"],
          { windowsHide: true, timeout: 5000 },
          (_vErr, vStdout) => {
            const version = vStdout?.trim().match(/Docker version ([^,]+)/)?.[1];
            resolve({ status: "running", version: version ?? "unknown" });
          }
        );
        return;
      }

      // Tier 2: docker --version -> not-running (CLI present but daemon down)
      execFile(
        "docker",
        ["--version"],
        { windowsHide: true, timeout: 5000 },
        (versionErr, versionStdout) => {
          if (!versionErr && versionStdout) {
            const version = versionStdout.trim().match(/Docker version ([^,]+)/)?.[1];
            resolve({ status: "not-running", version });
            return;
          }

          // Tier 3: Windows Registry query -> installed (Docker Desktop installed but CLI not in PATH)
          execFile(
            "reg",
            [
              "query",
              "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Docker Desktop",
              "/v",
              "DisplayName",
            ],
            { windowsHide: true, timeout: 5000 },
            (regErr) => {
              if (!regErr) {
                resolve({ status: "installed" });
                return;
              }

              // Tier 4: all checks failed -> missing
              resolve({ status: "missing" });
            }
          );
        }
      );
    });
  });
}

/** Start Docker Compose in detached mode. */
export function startDockerCompose(modelCachePath?: string, gpuEnabled?: boolean): Promise<void> {
  const composePath = getComposeFilePath();
  logger.info("Docker Compose starten:", composePath, "GPU:", gpuEnabled ?? false);

  const env = { ...process.env };
  if (modelCachePath) {
    env.PARAGRAF_MODEL_CACHE = modelCachePath;
    logger.info("Modell-Cache-Pfad:", modelCachePath);
  }

  const args = ["compose", "-p", "paragraf", "-f", composePath];
  if (gpuEnabled) {
    args.push("-f", getGpuComposeFilePath());
    logger.info("GPU-Overlay aktiviert:", getGpuComposeFilePath());
  }
  args.push("up", "-d");

  return new Promise((resolve, reject) => {
    composeProcess = execFile(
      "docker",
      args,
      { windowsHide: true, timeout: 120000, env },
      (error, _stdout, _stderr) => {
        if (error) {
          logger.error("Docker Compose start fehlgeschlagen:", error.message);
          reject(error);
        } else {
          logger.info("Docker Compose gestartet (detached)");
          resolve();
        }
      }
    );
  });
}

/** Stop Docker Compose gracefully. */
export function stopDockerCompose(): Promise<void> {
  const composePath = getComposeFilePath();
  logger.info("Docker Compose stoppen...");

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      logger.warn("Docker Compose stop Timeout (10s) – erzwinge Beendigung");
      resolve();
    }, 10000);

    execFile(
      "docker",
      ["compose", "-p", "paragraf", "-f", composePath, "stop"],
      { windowsHide: true, timeout: 15000 },
      (error) => {
        clearTimeout(timeout);
        if (error) {
          logger.warn("Docker Compose stop Fehler:", error.message);
        } else {
          logger.info("Docker Compose gestoppt");
        }
        resolve();
      }
    );
  });
}

/** Kill the compose process tree if still running (emergency cleanup). */
export function killComposeProcess(): void {
  if (composeProcess?.pid) {
    logger.warn("Compose-Prozess-Baum beenden (PID:", composeProcess.pid, ")");
    kill(composeProcess.pid);
    composeProcess = null;
  }
}

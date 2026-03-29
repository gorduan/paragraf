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

export type DockerAvailability = "running" | "installed" | "missing";

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

/** Start Docker Compose in detached mode. */
export function startDockerCompose(): Promise<void> {
  const composePath = getComposeFilePath();
  logger.info("Docker Compose starten:", composePath);

  return new Promise((resolve, reject) => {
    composeProcess = execFile(
      "docker",
      ["compose", "-p", "paragraf", "-f", composePath, "up", "-d"],
      { windowsHide: true, timeout: 120000 },
      (error, stdout, stderr) => {
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

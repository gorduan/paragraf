/** Einfaches Logging fuer den Electron Main-Process. */

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, ...args: unknown[]): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `${timestamp} | ${level.toUpperCase().padEnd(5)} | main`;
  console[level](prefix, "|", ...args);
}

export const logger = {
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args),
};

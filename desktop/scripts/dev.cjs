/** Startet electron-vite dev ohne ELECTRON_RUN_AS_NODE (VS Code Terminal setzt diese Variable). */
const { spawnSync } = require("child_process");

delete process.env.ELECTRON_RUN_AS_NODE;

const result = spawnSync("npx", ["electron-vite", "dev"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);

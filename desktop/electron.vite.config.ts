import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import path from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["electron-store"] })],
    build: {
      outDir: "out/main",
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
    },
  },
  renderer: {
    // Dev: minimal HTML entry so electron-vite can start its dev server.
    // The actual frontend runs on its own Vite dev server (port 5173).
    // window.ts uses ELECTRON_RENDERER_URL to load the frontend dev server.
    root: path.resolve(__dirname, "src/renderer"),
    build: {
      outDir: path.resolve(__dirname, "out/renderer"),
      rollupOptions: {
        input: path.resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
});

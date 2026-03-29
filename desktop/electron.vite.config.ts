import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
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
    // Renderer is the pre-built frontend — copied from frontend/dist/
    // Not built by electron-vite.
    build: {
      outDir: "out/renderer",
    },
  },
});

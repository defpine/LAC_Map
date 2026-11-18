import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const viewer = mode === "viewer";
  return {
    plugins: [react(), ...(viewer ? [{
      name: "exclude-editor-from-viewer",
      generateBundle(_options: unknown, bundle: Record<string, { type: string; modules?: Record<string, unknown> }>) {
        for (const chunk of Object.values(bundle)) for (const id of Object.keys(chunk.modules ?? {})) {
          if (/[/\\]editor[/\\]|[/\\]ui[/\\]App\.tsx|leaflet-geoman/.test(id)) throw new Error(`Editor module in Viewer: ${id}`);
        }
      },
    }] : [])],
    server: { host: "127.0.0.1" },
    base: env.PAGES_BASE_PATH || "./",
    publicDir: viewer ? "public-viewer" : "public",
    build: { outDir: viewer ? "dist-viewer" : "dist", rollupOptions: { input: viewer ? "viewer.html" : "index.html" } },
  };
});

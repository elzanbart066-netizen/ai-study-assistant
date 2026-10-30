import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const here = import.meta.dirname;
const project = path.resolve(here, "..");
const swaps: Record<string, string> = {
  "server/lib/ids.ts": "shims/ids.ts",
  "server/lib/security.ts": "shims/security.ts",
  "server/lib/storage.ts": "shims/storage.ts",
  "server/integrations/ai.ts": "shims/ai.ts",
  "server/integrations/documents.ts": "shims/documents.ts",
  "src/services/api.ts": "api.ts",
};

// Swaps Node-only modules (and the HTTP client) for browser versions.
function browserSwaps(): Plugin {
  return {
    name: "browser-swaps",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || !source.startsWith(".")) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const rel = path.relative(project, resolved.id).split(path.sep).join("/");
      const swap = swaps[rel];
      if (!swap || importer.startsWith(path.join(here, "shims")) || importer === path.join(here, "api.ts")) return null;
      return path.join(here, swap);
    },
  };
}

export default defineConfig({
  root: here,
  publicDir: path.join(project, "public"),
  // GitHub Pages serves the site from /<repo>/; the router uses the hash, so relative paths work everywhere.
  base: "./",
  define: { "import.meta.env.VITE_STATIC_SITE": JSON.stringify("1") },
  plugins: [browserSwaps(), react()],
  resolve: {
    alias: { "pdfkit-standalone": path.join(project, "node_modules/pdfkit/js/pdfkit.standalone.js") },
  },
  build: {
    outDir: path.join(here, "dist"),
    emptyOutDir: true,
    // The two DejaVu fonts are inlined so PDF export needs no extra requests.
    assetsInlineLimit: 2_000_000,
    chunkSizeWarningLimit: 6000,
  },
});

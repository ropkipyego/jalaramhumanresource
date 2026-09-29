import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnv = path.resolve(__dirname, "..");
  const env = loadEnv(mode, rootEnv, "");
  const stackPort = env.NGINX_HOST_PORT || "8080";

  return {
    /** Load VITE_* from repo root `.env` (same as Docker build). */
    envDir: rootEnv,
    server: {
      host: "::",
      port: Number(stackPort),
      strictPort: false,
      /** When Vite falls back to another port, API calls still hit Docker nginx on stackPort. */
      proxy: {
        "/api": { target: `http://127.0.0.1:${stackPort}`, changeOrigin: true },
        "/rest": { target: `http://127.0.0.1:${stackPort}`, changeOrigin: true },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "es2020",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("@supabase/supabase-js")) return "supabase";
            if (id.includes("@tanstack/react-query")) return "query";
            if (id.includes("react-router") || id.includes("react-dom") || /\/react\//.test(id)) {
              return "vendor";
            }
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("date-fns")) return "dates";
            if (id.includes("xlsx")) return "xlsx";
            if (id.includes("jspdf")) return "pdf";
          },
        },
      },
    },
  };
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
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
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true },
    proxy: {
      '/api/bot': {
        target: 'http://bot:4000', // Correctly uses the 'bot' service name
        changeOrigin: true,
      },
      '/hardhat': {
        target: 'http://chain:8545', // <-- CHANGED: Use the 'chain' service name!
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hardhat/, ""),
      },
    },
  },
});
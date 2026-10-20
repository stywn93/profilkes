import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import flowbiteReact from "flowbite-react/plugin/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
//
// Vite binds to 127.0.0.1 by default so a local `npm run dev` is not exposed
// on the LAN. Containers set VITE_HOST=0.0.0.0, otherwise the published port
// has nothing to forward to. API_ORIGIN points the /api proxy at the API
// service: 127.0.0.1 for a local API, http://api:8787 for the compose stack.
export default defineConfig({
  plugins: [react(), tailwindcss(), flowbiteReact()],
  server: {
    host: process.env.VITE_HOST ?? "127.0.0.1",
    port: Number(process.env.VITE_PORT ?? 5173),
    // Fail loudly instead of silently moving to another port, which leaves
    // the proxy target and the printed URL out of sync.
    strictPort: true,
    watch:
      process.env.VITE_POLLING === "1"
        ? { usePolling: true, interval: 400 }
        : undefined,
    proxy: {
      "/api": {
        target: process.env.API_ORIGIN ?? "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});

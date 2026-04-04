import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Слушать все интерфейсы — можно открыть с другого устройства в Wi‑Fi: http://<ваш-IP>:5173
    host: true,
    proxy: {
      "/auth": { target: "http://localhost:8000", changeOrigin: true },
      "/users": { target: "http://localhost:8000", changeOrigin: true },
      "/tasks": { target: "http://localhost:8000", changeOrigin: true },
      "/matchmaking": { target: "http://localhost:8000", changeOrigin: true },
      "/submissions": { target: "http://localhost:8000", changeOrigin: true },
      "/rating": { target: "http://localhost:8000", changeOrigin: true },
      "/payments": { target: "http://localhost:8000", changeOrigin: true },
      "/posts": { target: "http://localhost:8000", changeOrigin: true },
      "/proposals": { target: "http://localhost:8000", changeOrigin: true },
      "/contracts": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});

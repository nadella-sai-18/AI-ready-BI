import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to FastAPI directly (CORS is enabled on the backend).
// The API base URL is read from VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // `vite preview` is used for the Railway deployment. Bind to 0.0.0.0 on the
  // platform-provided $PORT and accept Railway's public hostname(s).
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
});

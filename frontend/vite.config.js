import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to FastAPI directly (CORS is enabled on the backend for
// http://localhost:5173). The API base URL is read from VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});

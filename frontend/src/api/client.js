import axios from "axios";

// Central Axios instance. Base URL comes from VITE_API_URL (see .env).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach the local session token (placeholder until backend auth exists).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize FastAPI error payloads ({detail: "..."} or validation arrays) into
// a readable message on err.userMessage.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = "Request failed";
    const detail = error?.response?.data?.detail;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((d) => `${(d.loc || []).slice(-1)[0] || "field"}: ${d.msg}`)
        .join("; ");
    } else if (error.message) {
      message = error.message;
    }
    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default api;

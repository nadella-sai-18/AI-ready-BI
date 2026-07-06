import { Button } from "./ui.jsx";

/**
 * External links to the BI layer. Both tools read the SAME PostgreSQL
 * database (lms_db), so they stay consistent with the app:
 *   - Metabase           existing dashboards           (default :3000)
 *   - Self-hosted MinusX  AI analytics chat (OSS)       (default :3100)
 *
 * URLs are configured in `.env`:
 *   VITE_METABASE_URL   default http://localhost:3000
 *   VITE_MINUSX_URL     default http://localhost:3100   (self-hosted MinusX)
 */

const METABASE_URL = import.meta.env.VITE_METABASE_URL || "http://localhost:3000";
const MINUSX_URL = import.meta.env.VITE_MINUSX_URL || "http://localhost:3100";

const open = (url) => window.open(url, "_blank", "noopener,noreferrer");

export default function IntegrationButtons({ compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={() => open(METABASE_URL)}
          className="flex w-full items-center gap-2 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-brand-100 hover:bg-brand-700"
        >
          <span>📊</span> Open Metabase
        </button>
        <button
          onClick={() => open(MINUSX_URL)}
          className="flex w-full items-center gap-2 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-brand-100 hover:bg-brand-700"
        >
          <span>🤖</span> MinusX AI Analytics
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => open(METABASE_URL)}>📊 Open Metabase</Button>
      <Button onClick={() => open(MINUSX_URL)}>🤖 Ask MinusX AI</Button>
    </div>
  );
}

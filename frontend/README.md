# AI-Ready BI — Frontend

Professional enterprise UI built with **React + Vite + Tailwind CSS**, talking to
the FastAPI backend via **Axios**. All data is read from / written to your
PostgreSQL database through the API — there is no mock data.

## Pages

- **Login** — local session gate (username + role). Backend JWT auth is a later phase.
- **Dashboard** — live KPI cards computed from real API data + buttons to open Metabase / MinusX AI.
- **Students / Faculty / Courses / Attendance / Exams / Marks / Competencies** — full CRUD.

## Structure

```
frontend/
├── src/
│   ├── api/client.js         # Axios instance (VITE_API_URL) + error normalization
│   ├── auth/                 # local session context + protected routes
│   ├── components/           # Layout, DataTable, Modal, CrudPage, KpiCard, Toast, ui primitives
│   └── pages/                # one file per page
├── .env                      # VITE_API_URL, VITE_METABASE_URL, VITE_MINUSX_URL
└── package.json
```

Most entity pages are configured declaratively through the reusable
`components/CrudPage.jsx` (columns + field definitions), which handles list,
search, create, edit, and delete against the backend.

## Prerequisites

- The **FastAPI backend** running on http://localhost:8000
  (`cd backend && uvicorn app.main:app --reload --port 8000`)
- The **PostgreSQL** container running (docker-compose)

## Setup & run

```powershell
cd frontend
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173).

Configuration lives in `.env`:

```
VITE_API_URL=http://localhost:8000
VITE_METABASE_URL=http://localhost:3000
VITE_MINUSX_URL=https://app.minusx.ai
```

## Notes

- CORS is already enabled on the backend for http://localhost:5173.
- Login is a local session only (no fabricated data). Replace `login()` in
  `src/auth/AuthContext.jsx` with a real API call once the backend auth endpoint exists.

# AI-Ready BI — College Analytics Management System

A full-stack, AI-ready Business Intelligence system for a Learning Management
System (LMS). It provides CRUD management of academic data, an operational KPI
dashboard, and one-click access to **Metabase** and **MinusX AI** — all on top
of a single shared **PostgreSQL** database.

```
React (Vite + Tailwind)  →  FastAPI (SQLAlchemy)  →  PostgreSQL (lms_db)
                                                          ├─ Metabase (dashboards)
                                                          └─ MinusX AI (analyst)
```

Every write from the web app lands directly in PostgreSQL, so Metabase and
MinusX always reflect the latest data — no sync step.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Installation guide](#installation-guide)
- [Running the app](#running-the-app)
- [API documentation](#api-documentation)
- [Database & semantic layer](#database--semantic-layer)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Features

- **Operational dashboard** — live KPI cards (students, faculty, courses,
  programs, attendance %, average marks, risk students, pass rate) and charts,
  computed from the semantic layer in `sql/views.sql`.
- **CRUD modules** — Students, Faculty, Courses, Enrollments, Attendance, Exams,
  Marks, Competencies (definitions + student scores).
- **Search, filters & pagination** on list pages.
- **Validation** — Pydantic on the backend, inline form validation on the frontend.
- **Robust UX** — success toasts, error banners, loading indicators, delete
  confirmations, responsive layout with a mobile drawer nav.
- **BI integration** — one button opens Metabase (where MinusX AI runs) in a new tab.
- **Auth gate** — role-based local session (Admin / Faculty / Management);
  see [Roadmap](#roadmap) for real JWT auth.

## Architecture

```
┌────────────────────┐      HTTP/JSON      ┌────────────────────┐
│  React frontend    │  ───────────────▶   │  FastAPI backend   │
│  (Vite + Tailwind) │  ◀───────────────   │  (clean layering)  │
└────────────────────┘                     └─────────┬──────────┘
                                                     │ SQLAlchemy ORM
                                                     ▼
                                          ┌────────────────────┐
                                          │  PostgreSQL lms_db │
                                          │  tables + views    │
                                          └─────────┬──────────┘
                                     ┌───────────────┴───────────────┐
                                     ▼                               ▼
                              ┌────────────┐                 ┌────────────┐
                              │  Metabase  │                 │  MinusX AI │
                              └────────────┘                 └────────────┘
```

Backend layering (per module): **router → service → model → database**. Services
own the business logic and raise domain exceptions (`NotFoundError`,
`ConflictError`, `ValidationError`) which are translated to HTTP 404/409/422.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, Tailwind CSS 3, React Router 6, Axios |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Uvicorn |
| Database | PostgreSQL 16 (Docker) |
| BI | Metabase, MinusX AI |

## Project structure

```
ai-ready-bi/
├── docker/            docker-compose.yml (PostgreSQL + Metabase)
├── sql/               schema.sql · seed.sql · views.sql  (existing — untouched)
├── backend/           FastAPI app (see backend/README.md)
│   └── app/
│       ├── models/ schemas/ services/ routers/ config/ utils/
│       ├── database.py
│       └── main.py
├── frontend/          React app (see frontend/README.md)
│   └── src/
│       ├── api/ auth/ components/ pages/
│       └── main.jsx App.jsx
├── docs/
│   ├── API.md          full endpoint reference
│   └── INSTALLATION.md step-by-step setup
└── README.md          (this file)
```

## Installation guide

> Full step-by-step version: [docs/INSTALLATION.md](docs/INSTALLATION.md).

### Prerequisites
- **Docker Desktop** (for PostgreSQL + Metabase)
- **Python 3.11+**
- **Node.js 18+ (LTS)** — https://nodejs.org

### 1. Database + Metabase (Docker)
```bash
cd docker
docker compose up -d
```
This starts PostgreSQL (`lms_db`, host port **5433**) and Metabase (port **3000**).

If the database is empty, load in this order (schema → views → migrations → seed):
```bash
# from the repo root
docker exec -i ai-ready-bi-db psql -U admin -d lms_db < sql/schema.sql
docker exec -i ai-ready-bi-db psql -U admin -d lms_db < sql/views.sql
for f in sql/migrations/*.sql; do docker exec -i ai-ready-bi-db psql -U admin -d lms_db < "$f"; done
docker exec -i ai-ready-bi-db psql -U admin -d lms_db < sql/seed.sql
```

### 2. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows:  .\.venv\Scripts\Activate.ps1
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## Running the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger UI (interactive API docs) | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Metabase | http://localhost:3000 |

Log in on the frontend with any username and a role, then use the sidebar to
manage records. Changes are immediately visible in Metabase and MinusX.

## API documentation

- **Interactive:** http://localhost:8000/docs (Swagger) — try every endpoint live.
- **Reference:** [docs/API.md](docs/API.md) — all endpoints, params, and status codes.

## Database & semantic layer

The database schema lives in `sql/schema.sql` and is **not modified** by the app
(models map to existing tables; `create_all` is never called). The analytics
"semantic layer" in `sql/views.sql` (e.g. `v_kpi_dashboard`,
`v_program_performance`, `v_competency_analysis`, `v_course_performance`) is
reused by the dashboard **and** by Metabase / MinusX.

## Configuration

**Backend** — `backend/.env`:
```
DATABASE_URL=postgresql+psycopg2://admin:admin123@localhost:5433/lms_db
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Frontend** — `frontend/.env`:
```
VITE_API_URL=http://localhost:8000
VITE_METABASE_URL=http://localhost:3000
VITE_METABASE_DASHBOARD_URL=          # optional specific dashboard
VITE_MINUSX_URL=                      # blank → opens Metabase (where MinusX runs)
```

## Troubleshooting

- **`ERR_CONNECTION_REFUSED` on :5173** — the Vite dev server isn't running.
  Start it with `npm run dev` in `frontend/`.
- **`node` not recognized** — install Node.js, then open a **new** terminal so
  the PATH refreshes.
- **esbuild install-script warning during `npm install`** — if Vite fails to
  start, run `node node_modules/esbuild/install.js` in `frontend/`.
- **Backend can't connect to DB** — confirm the Docker container is up
  (`docker ps`) and that host port **5433** is mapped.
- **CORS errors** — ensure the frontend origin is listed in `CORS_ORIGINS`.

## Roadmap

- Real authentication (JWT) backed by a `users` table (additive migration).
- Dedicated Program & Semester CRUD endpoints.
- Server-side pagination for very large datasets.
- Automated tests (pytest + React Testing Library).
- Optional fixes to two pre-existing `views.sql` issues (faculty↔course link,
  `total_exams` double-count) — see backend notes; requires schema/view changes,
  so only on request.

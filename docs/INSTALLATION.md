# Installation Guide

Step-by-step setup for the AI-Ready BI College Analytics Management System on a
fresh machine.

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Desktop | latest | Runs PostgreSQL + Metabase |
| Python | 3.11+ | Backend |
| Node.js | 18+ (LTS) | Frontend — https://nodejs.org (keep "Add to PATH" checked) |
| Git | any | Optional |

After installing Node.js, **open a new terminal** so the PATH updates. Verify:
```bash
node --version
npm --version
```

## 2. Start PostgreSQL + Metabase

From the repo root:
```bash
cd docker
docker compose up -d
docker ps          # confirm ai-ready-bi-db and metabase are "Up"
```

- PostgreSQL: `localhost:5433`, database `lms_db`, user `admin`, password `admin123`
- Metabase: http://localhost:3000

### Load schema, views, migrations & seed (only if the DB is empty)
Run in THIS order — migrations add ERP columns and fix the views, so they must
come after `schema.sql`/`views.sql` and before `seed.sql`:
```bash
# from the repo root
docker exec -i ai-ready-bi-db psql -U admin -d lms_db < sql/schema.sql
docker exec -i ai-ready-bi-db psql -U admin -d lms_db < sql/views.sql
for f in sql/migrations/*.sql; do
  docker exec -i ai-ready-bi-db psql -U admin -d lms_db < "$f"
done
docker exec -i ai-ready-bi-db psql -U admin -d lms_db < sql/seed.sql
```

> `seed.sql` TRUNCATEs and reloads, so it's safe to re-run. The migrations are
> additive/idempotent and never modify `schema.sql`/`seed.sql`/`views.sql`.

## 3. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:
- **Windows (PowerShell):** `.\.venv\Scripts\Activate.ps1`
- **macOS / Linux:** `source .venv/bin/activate`

Install and run:
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify: open http://localhost:8000/health → `{"status":"ok","database":"connected"}`.

Interactive API docs: http://localhost:8000/docs

## 4. Frontend (React)

In a **separate terminal**:
```bash
cd frontend
npm install
npm run dev
```

Open the printed URL: http://localhost:5173

> **npm script-policy note:** if `npm install` warns that esbuild's install
> script was skipped and Vite then fails to start, run:
> ```bash
> node node_modules/esbuild/install.js
> ```

## 5. First run

1. Go to http://localhost:5173
2. Log in with any username + role (Admin / Faculty / Management).
3. You land on the operational dashboard. Use the sidebar to manage records.

## 6. Configuration (optional)

**backend/.env**
```
DATABASE_URL=postgresql+psycopg2://admin:admin123@localhost:5433/lms_db
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**frontend/.env**
```
VITE_API_URL=http://localhost:8000
VITE_METABASE_URL=http://localhost:3000
VITE_METABASE_DASHBOARD_URL=
VITE_MINUSX_URL=
```
Restart the affected dev server after changing `.env`.

## 7. Stopping everything

```bash
# frontend / backend: Ctrl+C in their terminals
cd docker
docker compose down          # stops containers (data persists in the volume)
```

## Common issues

| Symptom | Fix |
|---------|-----|
| `ERR_CONNECTION_REFUSED` on :5173 | Vite not running → `npm run dev` |
| `node`/`npm` not recognized | Install Node.js, open a new terminal |
| Backend: `database: unreachable` | Docker DB not up, or wrong port (5433) |
| CORS error in browser console | Add the frontend origin to `CORS_ORIGINS` |
| Vite fails on esbuild | `node node_modules/esbuild/install.js` |

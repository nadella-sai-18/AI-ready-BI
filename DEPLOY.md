# Deploying to Railway

Three services in one Railway project: **Postgres**, **Backend** (FastAPI), **Frontend** (React).
(MinusX + Metabase stay local — see the note at the bottom.)

Config-as-code files (`backend/railway.json`, `frontend/railway.json`) already set the
build/start commands, so you mostly set the **Root Directory** and a few **variables**.

---

## 1. Postgres
1. Railway → **New → Database → PostgreSQL**. This creates a service named `Postgres`.
2. Load the whole database ONCE from your machine, using the **public** connection string
   (Postgres service → **Connect → Public Network** → copy the `postgresql://...` URL):
   ```bash
   # local psql:
   psql "<PUBLIC_DATABASE_URL>" -f sql/deploy_all.sql
   # or via the docker container:
   cat sql/deploy_all.sql | docker exec -i ai-ready-bi-db psql "<PUBLIC_DATABASE_URL>"
   ```
   `sql/deploy_all.sql` = schema + all migrations + seed (≈800 students, exams, marks, attendance, 37 views).

## 2. Backend service (FastAPI)
1. **New → GitHub Repo** → pick this repo.
2. **Settings → Root Directory** = `backend`  (filter "root" to find it).
   - Start command is already in `backend/railway.json` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
3. **Variables:**
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   CORS_ORIGINS=https://<your-frontend-domain>.up.railway.app
   ```
   - `DATABASE_URL` references the Postgres service (internal URL — fast, private).
   - Do **not** set `PORT` (Railway injects it).
4. **Settings → Networking → Generate Domain** to get the public backend URL.
   Test it at `https://<backend>.up.railway.app/docs`.

## 3. Frontend service (React / Vite)
1. **New → GitHub Repo** → same repo (a second service).
2. **Settings → Root Directory** = `frontend`.
   - Build/start are already in `frontend/railway.json` (`npm run build` / `npm run preview`).
3. **Variables (build-time — must be set before it builds):**
   ```
   VITE_API_URL=https://<your-backend-domain>.up.railway.app
   ```
4. **Generate Domain** → that public URL is your app. Put it back into the backend's
   `CORS_ORIGINS` (step 2.3) so the browser can call the API.

---

## Order of operations
1. Create Postgres → load `deploy_all.sql`.
2. Deploy Backend (set `DATABASE_URL`) → generate domain.
3. Deploy Frontend (set `VITE_API_URL` = backend domain) → generate domain.
4. Update Backend `CORS_ORIGINS` = frontend domain → redeploy backend.

## Notes
- **Internal vs public DB URL:** the backend uses `${{Postgres.DATABASE_URL}}` (internal).
  You only use the **public** URL to load `deploy_all.sql` from your laptop.
- **MinusX / Metabase:** these are heavy Docker services and would burn Railway credit fast.
  Keep them local (they read the same data), or deploy them later as separate Docker services
  pointing `DB_TYPE`/data-source at the Railway Postgres public URL.
- **Re-running `deploy_all.sql`** re-seeds (the seed TRUNCATEs first) — safe to re-run to reset demo data.

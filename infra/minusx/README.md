# Self-Hosted MinusX (AI analytics layer)

Open-source, self-hosted [MinusX](https://github.com/minusxai/minusx) added **alongside**
the existing College Analytics system. Nothing in the app, database, or Metabase changes —
MinusX is a standalone BI web app that connects to the **same PostgreSQL database** (`lms_db`)
as a data source.

```
frontend/            existing React app        (http://localhost:5173)
backend/             existing FastAPI app      (http://localhost:8000)
docker/              existing Postgres + Metabase
  postgres           ai-ready-bi-db            (host port 5433 -> lms_db)
  metabase           Metabase                  (http://localhost:3000)
infra/minusx/        THIS — self-hosted MinusX (http://localhost:3100)  <-- new
```

MinusX reads the same `lms_db`, so the app, Metabase, and MinusX all stay consistent.

---

## Prerequisites
- Docker Desktop running.
- The college database must be up (from the repo root):
  ```bash
  docker compose -f docker/docker-compose.yml up -d
  ```
- An **Anthropic (Claude) API key** — MinusX uses Claude as its engine.

## 1. Configure
```bash
cd infra/minusx
cp .env.example .env
# edit .env → set ANTHROPIC_API_KEY and NEXTAUTH_SECRET
```

## 2. Start MinusX
```bash
docker compose up -d          # pulls the image on first run, then starts on :3100
```
Open **http://localhost:3100** and create the local admin account.

## 3. Connect it to the college database (one-time, in the MinusX UI)
Add a **PostgreSQL** data source with:

| Field    | Value                     |
|----------|---------------------------|
| Host     | `host.docker.internal`    |
| Port     | `5433`                    |
| Database | `lms_db`                  |
| User     | `admin`                   |
| Password | `admin123`                |

> `host.docker.internal` lets the MinusX container reach the Postgres published on your host.
> (Alternative: attach MinusX to the `docker_default` network and use host `ai-ready-bi-db`, port `5432`.)

MinusX will introspect the schema — including the business-friendly views in
`sql/migrations/015_minusx_business_views.sql` — and can answer the demo questions below.

## Stop / logs
```bash
docker compose down           # stop (keeps ./data)
docker compose logs -f minusx # view logs
```

---

## What MinusX can answer (demo questions)

**Attendance** — backed by `v_today_attendance_summary`, `v_today_attendance_by_branch`,
`v_today_attendance_by_section`, `v_low_attendance_students`, `v_attendance_trend_last_7_days`,
`v_current_semester_attendance_summary`
- What is today's attendance summary?
- How many students are absent today?
- Which branch has the lowest attendance today?
- Which section has the lowest attendance today?
- Which students are below 75% attendance?
- Show the attendance trend for the last 7 days.

**Exams** — `v_exam_schedule_current_semester`, `v_exam_status_summary`,
`v_subject_exam_overview`, `v_exam_faculty_mapping`, `v_exam_pending_marks_summary`
- Show the current-semester exam schedule.
- Show Internal 1 / Mid / End Semester exams for CSE.
- Which exams are pending marks entry?
- Which faculty is handling which exam?

**Marks / performance** — `v_student_performance_summary`, `v_subject_result_summary`,
`v_section_performance`, `v_branch_pass_rate`, `v_at_risk_students`,
`v_marks_current_semester_summary`
- Which branch has the best pass percentage?
- Which section is performing badly in CSE?
- Show at-risk students (low marks or low attendance).
- Which subject has the weakest performance?
- Show top performers in Semester 7.
- Show branch-wise and section-wise average marks.

> Tip: mention the view name for the most reliable answers, e.g.
> *"Using v_today_attendance_by_branch, which branch has the lowest attendance today?"*

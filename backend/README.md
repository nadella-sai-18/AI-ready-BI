# AI-Ready BI — Backend

FastAPI backend on top of the **existing** `lms_db` PostgreSQL database.
No SQL files are modified and `create_all` is never called — models map to the
tables already created by `sql/schema.sql`.

## Architecture (clean layering)

```
backend/
├── app/
│   ├── main.py                # app wiring, CORS, exception handlers, /health
│   ├── database.py            # engine + session + get_db (NO create_all)
│   ├── config/                # settings loaded from .env
│   │   └── settings.py
│   ├── models/                # SQLAlchemy ORM (maps to existing tables)
│   │   └── student.py
│   ├── schemas/               # Pydantic request/response models
│   │   └── student.py
│   ├── services/              # business logic (framework-agnostic)
│   │   └── student_service.py
│   ├── routers/               # thin HTTP layer, delegates to services
│   │   └── student.py
│   └── utils/                 # shared helpers
│       └── exceptions.py      # domain exceptions (NotFound / Conflict)
└── requirements.txt
```

**Flow:** `router` (HTTP) → `service` (business logic) → `model` (ORM) → PostgreSQL.
Services raise domain exceptions; `main.py` translates them into HTTP responses.
This keeps the business logic independent of FastAPI.

## Prerequisites

Your Postgres container from `docker/docker-compose.yml` must be running
(host port **5433**).

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `.env.example` to `.env` if you need to change the connection string
(the defaults already match docker-compose).

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Student endpoints

| Method | Path                  | Purpose                                    |
|--------|-----------------------|--------------------------------------------|
| GET    | `/students`           | List / search (`?search=`, `?program_id=`, `?skip=`, `?limit=`) |
| GET    | `/students/{id}`      | View one student                           |
| POST   | `/students`           | Add student                                |
| PUT    | `/students/{id}`      | Edit student (partial update)              |
| DELETE | `/students/{id}`      | Delete student                             |

## Faculty endpoints

| Method | Path                  | Purpose                                    |
|--------|-----------------------|--------------------------------------------|
| GET    | `/faculty`            | List / search (`?search=`, `?department=`, `?skip=`, `?limit=`) |
| GET    | `/faculty/{id}`       | View one faculty member                    |
| POST   | `/faculty`            | Add faculty                                |
| PUT    | `/faculty/{id}`       | Edit faculty (partial update)              |
| DELETE | `/faculty/{id}`       | Delete faculty                             |

## Course endpoints

Courses are linked to a **program** and a **semester**. On create/update the
service validates that both exist and that the semester belongs to the program.
Responses are enriched with `program_name` and `semester_name`.

| Method | Path                  | Purpose                                    |
|--------|-----------------------|--------------------------------------------|
| GET    | `/courses`            | List / search (`?search=`, `?program_id=`, `?semester_id=`, `?skip=`, `?limit=`) |
| GET    | `/courses/{id}`       | View one course (enriched)                 |
| POST   | `/courses`            | Add course (validates program + semester)  |
| PUT    | `/courses/{id}`       | Edit course (partial; re-validates links)  |
| DELETE | `/courses/{id}`       | Delete course                              |

Validation responses: `404` if program/semester not found, `409` if the
semester does not belong to the chosen program.

## Enrollment endpoints

Enrollments link a **student** to a **course**. On enroll the service validates
both exist and prevents duplicate enrollments of the same student/course.
`enrollment_date` defaults to today when omitted. Responses are enriched with
`student_name` and `course_name`.

| Method | Path                          | Purpose                              |
|--------|-------------------------------|--------------------------------------|
| GET    | `/enrollments`                | List (`?student_id=`, `?course_id=`, `?skip=`, `?limit=`) |
| GET    | `/enrollments/{id}`           | View one enrollment                  |
| GET    | `/enrollments/student/{id}`   | View a student's enrollments         |
| GET    | `/enrollments/course/{id}`    | View a course's enrollments          |
| POST   | `/enrollments`                | Enroll student (validates FKs)       |
| DELETE | `/enrollments/{id}`           | Remove enrollment                    |

Validation responses: `404` if student/course/enrollment not found, `409` if the
student is already enrolled in that course.

## Attendance endpoints

Attendance links a **student** to a **course** on a **date** with a `status`
(`Present` | `Absent` | `Late`). Marking validates both FKs and prevents a
duplicate mark for the same student/course/date. `class_date` defaults to today.

| Method | Path                                | Purpose                              |
|--------|-------------------------------------|--------------------------------------|
| GET    | `/attendance`                       | List (`?student_id=`, `?course_id=`, `?skip=`, `?limit=`) |
| GET    | `/attendance/{id}`                  | View one record                      |
| GET    | `/attendance/student/{id}`          | Student attendance history           |
| GET    | `/attendance/report/course/{id}`    | Per-student attendance report for a course |
| POST   | `/attendance`                       | Mark attendance                      |
| PUT    | `/attendance/{id}`                  | Update attendance (status/date)      |
| DELETE | `/attendance/{id}`                  | Delete a record                      |

Validation responses: `404` if student/course/record not found, `409` if already
marked for that student/course/date, `422` if status is not one of the allowed values.

## Exam endpoints

Exams belong to a **course**. Create/update validates the course exists.
Responses are enriched with `course_name`.

| Method | Path            | Purpose                                        |
|--------|-----------------|------------------------------------------------|
| GET    | `/exams`        | List / search (`?search=`, `?course_id=`, `?skip=`, `?limit=`) |
| GET    | `/exams/{id}`   | View one exam                                  |
| POST   | `/exams`        | Create exam (`course_id`, `exam_name`, `max_marks`, optional `exam_date`) |
| PUT    | `/exams/{id}`   | Update exam (partial)                          |
| DELETE | `/exams/{id}`   | Delete exam                                    |

Validation: `404` if course/exam not found, `422` if `max_marks <= 0`, `409` if
deleting an exam that still has marks referencing it.

## Marks endpoints

Marks link a **student** to an **exam**. Entering validates both exist, blocks
duplicates for the same student/exam, and rejects marks above the exam maximum.
Responses include `max_marks`, `percentage`, and `passed` (pass threshold = 40%).

| Method | Path                    | Purpose                                    |
|--------|-------------------------|--------------------------------------------|
| GET    | `/marks`                | List (`?student_id=`, `?exam_id=`, `?skip=`, `?limit=`) |
| GET    | `/marks/{id}`           | View one mark                              |
| GET    | `/marks/student/{id}`   | Student results across all exams (+ summary) |
| POST   | `/marks`                | Enter marks (`student_id`, `exam_id`, `marks_obtained`) |
| PUT    | `/marks/{id}`           | Update marks                              |
| DELETE | `/marks/{id}`           | Delete a mark                            |

Validation: `404` if student/exam/mark not found, `409` if marks already entered
for that student/exam, `422` if `marks_obtained` exceeds the exam's `max_marks`.

## Competency endpoints

Two existing tables: `competencies` (definitions) and `student_competencies`
(per-student scores). Levels follow `sql/views.sql`: `< 70` Weak Area,
`70–85` Moderate, `> 85` Strong.

**Competency definitions**

| Method | Path                    | Purpose                          |
|--------|-------------------------|----------------------------------|
| GET    | `/competencies`         | List / search (`?search=`, `?skip=`, `?limit=`) |
| GET    | `/competencies/{id}`    | View one competency              |
| POST   | `/competencies`         | Add competency                   |
| PUT    | `/competencies/{id}`    | Update competency (partial)      |
| DELETE | `/competencies/{id}`    | Delete competency                |

**Student competency scores**

| Method | Path                              | Purpose                          |
|--------|-----------------------------------|----------------------------------|
| POST   | `/competencies/scores`            | Assign a score to a student      |
| GET    | `/competencies/scores/{id}`       | View one assigned score          |
| PUT    | `/competencies/scores/{id}`       | Update an assigned score         |
| DELETE | `/competencies/scores/{id}`       | Delete an assigned score         |
| GET    | `/competencies/student/{id}`      | Student competency report (+ summary) |

Validation: `404` if student/competency/score not found, `409` if the competency
is already assigned to that student, `422` if `score` is outside 0–100. Scores and
reports are enriched with `level`; the report adds `average_score` and `overall_level`.

## Dashboard endpoints (read-only analytics)

Backed by the existing semantic layer in `sql/views.sql` (the same views used by
Metabase and MinusX) plus a few lightweight aggregate queries. Nothing here
writes to the database.

| Method | Path                                | Purpose                              |
|--------|-------------------------------------|--------------------------------------|
| GET    | `/dashboard/kpis`                   | Headline KPI cards (students, faculty, courses, programs, attendance %, average marks, risk students, pass rate) |
| GET    | `/dashboard/program-performance`    | Avg score + students per program (`v_program_performance`) |
| GET    | `/dashboard/competency-analysis`    | Avg score + level per competency (`v_competency_analysis`) |
| GET    | `/dashboard/course-performance`     | Avg score + enrolled per course (`v_course_performance`) |
| GET    | `/dashboard/attendance-distribution`| Present/Absent/Late counts           |

Any change here writes straight to the shared PostgreSQL database, so Metabase
and MinusX AI see the updated data immediately.

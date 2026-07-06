# API Reference

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs` (Swagger) · `http://localhost:8000/redoc`

All request/response bodies are JSON. List endpoints accept `skip` (default 0)
and `limit` (default 100, max 500) for pagination.

## Conventions

| Status | Meaning |
|--------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (successful delete) |
| 404 | Resource not found (`NotFoundError`) |
| 409 | Conflict — duplicate or FK constraint (`ConflictError`) |
| 422 | Validation error (Pydantic, or business rule via `ValidationError`) |

Error body: `{ "detail": "message" }` (string), or an array of field errors for
request-schema validation.

---

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + DB connectivity check |

## Students — `/students`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/students` | List. Query: `search` (name/email), `program_id`, `skip`, `limit` |
| GET | `/students/{id}` | View one |
| POST | `/students` | Create — `full_name`*, `email`, `program_id`, `enrollment_year` |
| PUT | `/students/{id}` | Partial update |
| DELETE | `/students/{id}` | Delete |

## Faculty — `/faculty`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/faculty` | List. Query: `search`, `department`, `skip`, `limit` |
| GET | `/faculty/{id}` | View one |
| POST | `/faculty` | Create — `full_name`*, `email`, `department` |
| PUT | `/faculty/{id}` | Partial update |
| DELETE | `/faculty/{id}` | Delete |

## Courses — `/courses`

Linked to a program + semester. Validates both exist and that the semester
belongs to the program. Responses include `program_name`, `semester_name`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/courses` | List. Query: `search`, `program_id`, `semester_id`, `skip`, `limit` |
| GET | `/courses/{id}` | View one (enriched) |
| POST | `/courses` | Create — `course_name`*, `program_id`*, `semester_id`*, `credits` |
| PUT | `/courses/{id}` | Partial update (re-validates links) |
| DELETE | `/courses/{id}` | Delete |

Errors: `404` program/semester not found · `409` semester not in program.

## Enrollments — `/enrollments`

Links a student to a course; blocks duplicates. `enrollment_date` defaults to today.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/enrollments` | List. Query: `student_id`, `course_id`, `skip`, `limit` |
| GET | `/enrollments/{id}` | View one |
| GET | `/enrollments/student/{student_id}` | A student's enrollments |
| GET | `/enrollments/course/{course_id}` | A course's enrollments |
| POST | `/enrollments` | Enroll — `student_id`*, `course_id`*, `enrollment_date` |
| DELETE | `/enrollments/{id}` | Remove |

Errors: `404` student/course not found · `409` already enrolled.

## Attendance — `/attendance`

`status` ∈ { `Present`, `Absent`, `Late` }. Blocks duplicate marks for the same
student/course/date. `class_date` defaults to today.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/attendance` | List. Query: `student_id`, `course_id`, `skip`, `limit` |
| GET | `/attendance/{id}` | View one |
| GET | `/attendance/student/{student_id}` | Student attendance history |
| GET | `/attendance/report/course/{course_id}` | Per-student report (% present) |
| POST | `/attendance` | Mark — `student_id`*, `course_id`*, `status`*, `class_date` |
| PUT | `/attendance/{id}` | Update `status` / `class_date` |
| DELETE | `/attendance/{id}` | Delete |

Errors: `404` not found · `409` duplicate · `422` invalid status.

## Exams — `/exams`

Belong to a course; `max_marks > 0`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/exams` | List. Query: `search`, `course_id`, `skip`, `limit` |
| GET | `/exams/{id}` | View one |
| POST | `/exams` | Create — `course_id`*, `exam_name`*, `max_marks`*, `exam_date` |
| PUT | `/exams/{id}` | Partial update |
| DELETE | `/exams/{id}` | Delete |

Errors: `404` course/exam not found · `422` `max_marks<=0` · `409` exam has marks.

## Marks — `/marks`

Links a student to an exam; blocks duplicates; rejects marks above the exam max.
Responses include `max_marks`, `percentage`, `passed` (pass ≥ 40%).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/marks` | List. Query: `student_id`, `exam_id`, `skip`, `limit` |
| GET | `/marks/{id}` | View one |
| GET | `/marks/student/{student_id}` | Student results across exams (+ summary) |
| POST | `/marks` | Enter — `student_id`*, `exam_id`*, `marks_obtained`* |
| PUT | `/marks/{id}` | Update `marks_obtained` |
| DELETE | `/marks/{id}` | Delete |

Errors: `404` not found · `409` duplicate · `422` marks exceed max.

## Competencies — `/competencies`

Definitions plus per-student scores. Level: `<70` Weak Area, `70–85` Moderate,
`>85` Strong.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/competencies` | List. Query: `search`, `skip`, `limit` |
| GET | `/competencies/{id}` | View one |
| POST | `/competencies` | Create — `competency_name`*, `description` |
| PUT | `/competencies/{id}` | Partial update |
| DELETE | `/competencies/{id}` | Delete |
| POST | `/competencies/scores` | Assign — `student_id`*, `competency_id`*, `score`* (0–100) |
| GET | `/competencies/scores/{id}` | View one score |
| PUT | `/competencies/scores/{id}` | Update `score` |
| DELETE | `/competencies/scores/{id}` | Delete score |
| GET | `/competencies/student/{student_id}` | Student competency report (+ summary) |

Errors: `404` not found · `409` already assigned · `422` score outside 0–100.

## Dashboard — `/dashboard` (read-only)

Backed by `sql/views.sql` (the semantic layer shared with Metabase / MinusX).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/kpis` | Headline KPIs (students, faculty, courses, programs, attendance %, average marks, risk students, pass rate) |
| GET | `/dashboard/program-performance` | Avg score + students per program |
| GET | `/dashboard/competency-analysis` | Avg score + level per competency |
| GET | `/dashboard/course-performance` | Avg score + enrolled per course |
| GET | `/dashboard/attendance-distribution` | Present / Absent / Late counts |

`*` = required field.

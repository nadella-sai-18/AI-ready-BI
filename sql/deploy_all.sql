-- =====================================================================
-- deploy_all.sql — full database bootstrap for a FRESH Postgres.
-- Order: schema.sql -> migrations 001..018 -> seed.sql
-- Usage:  psql "<DATABASE_URL>" -f sql/deploy_all.sql
-- =====================================================================

\echo >>> schema.sql
CREATE TABLE programs (
    program_id SERIAL PRIMARY KEY,
    program_name VARCHAR(100),
    duration_years INT
);

CREATE TABLE semesters (
    semester_id SERIAL PRIMARY KEY,
    program_id INT REFERENCES programs(program_id),
    semester_name VARCHAR(50),
    semester_number INT
);

CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    program_id INT REFERENCES programs(program_id),
    full_name VARCHAR(100),
    email VARCHAR(100),
    enrollment_year INT
);

CREATE TABLE faculty (
    faculty_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100),
    email VARCHAR(100),
    department VARCHAR(100)
);

CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    program_id INT REFERENCES programs(program_id),
    semester_id INT REFERENCES semesters(semester_id),
    course_name VARCHAR(100),
    credits INT
);

CREATE TABLE enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    course_id INT REFERENCES courses(course_id),
    enrollment_date DATE
);

CREATE TABLE attendance (
    attendance_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    course_id INT REFERENCES courses(course_id),
    class_date DATE,
    status VARCHAR(20)
);

CREATE TABLE exams (
    exam_id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(course_id),
    exam_name VARCHAR(50),
    exam_date DATE,
    max_marks INT
);

CREATE TABLE marks (
    mark_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    exam_id INT REFERENCES exams(exam_id),
    marks_obtained INT
);

CREATE TABLE competencies (
    competency_id SERIAL PRIMARY KEY,
    competency_name VARCHAR(100),
    description TEXT
);

CREATE TABLE student_competencies (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    competency_id INT REFERENCES competencies(competency_id),
    score INT
);

\echo >>> sql/migrations/001_academic_and_terms.sql
-- Migration 001 — Academic years + semester term type
-- ADDITIVE ONLY. Does not modify or drop anything in schema.sql.

-- Academic years (e.g. 2023-2024 ... 2026-2027)
CREATE TABLE IF NOT EXISTS academic_years (
    academic_year_id SERIAL PRIMARY KEY,
    year_label VARCHAR(20) NOT NULL,
    start_year INT,
    end_year INT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_academic_years_label
    ON academic_years (year_label);

-- Monsoon / Winter term on each semester
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS term_type VARCHAR(10);

-- Backfill existing semester rows (odd = Monsoon, even = Winter). Only updates
-- rows where term_type is still NULL; adds no new rows.
UPDATE semesters
SET term_type = CASE WHEN semester_number % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END
WHERE term_type IS NULL AND semester_number IS NOT NULL;


\echo >>> sql/migrations/002_students_erp.sql
-- Migration 002 — Student ERP fields
-- ADDITIVE ONLY. Existing enrollment_year is reused as the admission year.

ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number VARCHAR(20);
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_number VARCHAR(15);
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year_id INT
    REFERENCES academic_years(academic_year_id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_year INT;      -- 1..4
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_semester INT;  -- 1..8
ALTER TABLE students ADD COLUMN IF NOT EXISTS section VARCHAR(2);     -- A/B/C/D
ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(15) DEFAULT 'Active';

-- Roll number should be unique when present (partial unique index allows NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS ux_students_roll_number
    ON students (roll_number) WHERE roll_number IS NOT NULL;


\echo >>> sql/migrations/003_courses_faculty.sql
-- Migration 003 — Course code + assigned faculty
-- ADDITIVE ONLY. Fixes the faculty<->course relationship that v_faculty_performance
-- needs (see views_v2 in migration 006).

ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_code VARCHAR(20);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS faculty_id INT
    REFERENCES faculty(faculty_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_courses_course_code
    ON courses (course_code) WHERE course_code IS NOT NULL;


\echo >>> sql/migrations/004_exams_types.sql
-- Migration 004 — Exam type + weightage
-- ADDITIVE ONLY. exam_type standardizes: Internal 1, Internal 2, Mid Sem, End Sem.
-- weightage (%) supports total/percentage/grade computation.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS weightage INT;


\echo >>> sql/migrations/005_indexes.sql
-- Migration 005 — Performance indexes for scale (800 -> 8,000+ students)
-- ADDITIVE ONLY. Speeds up the common foreign-key filters and joins.

CREATE INDEX IF NOT EXISTS ix_attendance_student ON attendance (student_id);
CREATE INDEX IF NOT EXISTS ix_attendance_course  ON attendance (course_id);
CREATE INDEX IF NOT EXISTS ix_marks_student      ON marks (student_id);
CREATE INDEX IF NOT EXISTS ix_marks_exam         ON marks (exam_id);
CREATE INDEX IF NOT EXISTS ix_enrollments_student ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS ix_enrollments_course  ON enrollments (course_id);
CREATE INDEX IF NOT EXISTS ix_exams_course       ON exams (course_id);
CREATE INDEX IF NOT EXISTS ix_courses_program    ON courses (program_id);
CREATE INDEX IF NOT EXISTS ix_courses_semester   ON courses (semester_id);
CREATE INDEX IF NOT EXISTS ix_courses_faculty    ON courses (faculty_id);
CREATE INDEX IF NOT EXISTS ix_students_program   ON students (program_id);
CREATE INDEX IF NOT EXISTS ix_students_academic_year ON students (academic_year_id);
CREATE INDEX IF NOT EXISTS ix_students_status    ON students (status);
CREATE INDEX IF NOT EXISTS ix_student_competencies_student ON student_competencies (student_id);
CREATE INDEX IF NOT EXISTS ix_student_competencies_competency ON student_competencies (competency_id);


\echo >>> sql/migrations/006_views_v2.sql
-- Migration 006 — Additive analytics views (v2)
-- ADDITIVE ONLY. Does NOT modify sql/views.sql. These sit alongside the existing
-- semantic layer so Metabase and MinusX can use one consistent set of views.

-- Fixed faculty performance: uses the new courses.faculty_id link (the original
-- v_faculty_performance had a self-join bug and could not attribute marks to a
-- specific faculty member).
CREATE OR REPLACE VIEW v2_faculty_performance AS
SELECT
    f.faculty_id,
    f.full_name AS faculty_name,
    f.department,
    COUNT(DISTINCT c.course_id) AS courses_taught,
    ROUND(AVG(m.marks_obtained), 2) AS avg_student_score
FROM faculty f
LEFT JOIN courses c ON c.faculty_id = f.faculty_id
LEFT JOIN exams e   ON e.course_id = c.course_id
LEFT JOIN marks m   ON m.exam_id = e.exam_id
GROUP BY f.faculty_id, f.full_name, f.department;

-- Program performance trend by academic year (uses students.academic_year_id).
CREATE OR REPLACE VIEW v2_program_trend AS
SELECT
    p.program_id,
    p.program_name,
    ay.year_label AS academic_year,
    COUNT(DISTINCT s.student_id) AS students,
    ROUND(AVG(m.marks_obtained), 2) AS avg_score
FROM programs p
JOIN students s ON s.program_id = p.program_id
LEFT JOIN academic_years ay ON ay.academic_year_id = s.academic_year_id
LEFT JOIN marks m ON m.student_id = s.student_id
GROUP BY p.program_id, p.program_name, ay.year_label
ORDER BY p.program_name, ay.year_label;

-- Faculty performance across semesters (course -> semester).
CREATE OR REPLACE VIEW v2_faculty_semester AS
SELECT
    f.faculty_id,
    f.full_name AS faculty_name,
    sem.semester_id,
    sem.semester_name,
    sem.term_type,
    ROUND(AVG(m.marks_obtained), 2) AS avg_score
FROM faculty f
JOIN courses c    ON c.faculty_id = f.faculty_id
LEFT JOIN semesters sem ON sem.semester_id = c.semester_id
LEFT JOIN exams e ON e.course_id = c.course_id
LEFT JOIN marks m ON m.exam_id = e.exam_id
GROUP BY f.faculty_id, f.full_name, sem.semester_id, sem.semester_name, sem.term_type;


\echo >>> sql/migrations/007_reference_academic_years.sql
-- Migration 007 — Reference academic years (structural, from the spec).
-- These are the fixed academic years listed in the requirements, NOT dummy
-- student/marks data. Idempotent: inserts each label only if missing.

INSERT INTO academic_years (year_label, start_year, end_year)
SELECT v.year_label, v.start_year, v.end_year
FROM (VALUES
    ('2023-2024', 2023, 2024),
    ('2024-2025', 2024, 2025),
    ('2025-2026', 2025, 2026),
    ('2026-2027', 2026, 2027)
) AS v(year_label, start_year, end_year)
WHERE NOT EXISTS (
    SELECT 1 FROM academic_years a WHERE a.year_label = v.year_label
);


\echo >>> sql/migrations/008_views_fix.sql
-- Migration 008 — Correct the semantic layer for accurate AI/BI answers
-- ADDITIVE / redefinition only. Does NOT edit the sql/views.sql FILE; it
-- redefines the views in the database so Metabase and MinusX return correct
-- results. Run AFTER views.sql.
--
-- Root problem fixed: the original v_student_performance/v_risk_students compared
-- RAW marks_obtained. With exams of different max_marks (20/50/100) that badly
-- misfires (flagged ~760 "risk" students). These use PERCENTAGE instead.

-- Rebuild the dependency chain cleanly.
DROP VIEW IF EXISTS v_kpi_dashboard;
DROP VIEW IF EXISTS v_risk_students;
DROP VIEW IF EXISTS v_student_performance;

-- Per-student performance (percentage-based, no cartesian join).
CREATE VIEW v_student_performance AS
SELECT
    s.student_id,
    s.full_name,
    p.program_name,
    mk.avg_marks,                        -- raw average (kept for compatibility)
    COALESCE(mk.total_exams, 0) AS total_exams,
    att.attendance_percentage,
    mk.avg_percentage                    -- corrected metric used for risk/pass
FROM students s
LEFT JOIN programs p ON p.program_id = s.program_id
LEFT JOIN (
    SELECT m.student_id,
           ROUND(AVG(m.marks_obtained), 2) AS avg_marks,
           COUNT(*) AS total_exams,
           ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)), 2) AS avg_percentage
    FROM marks m
    JOIN exams e ON e.exam_id = m.exam_id
    GROUP BY m.student_id
) mk ON mk.student_id = s.student_id
LEFT JOIN (
    SELECT student_id,
           ROUND(100.0 * SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)
                 / NULLIF(COUNT(*), 0), 2) AS attendance_percentage
    FROM attendance
    GROUP BY student_id
) att ON att.student_id = s.student_id;

-- At-risk students: avg exam percentage < 40 OR attendance < 75%.
CREATE VIEW v_risk_students AS
SELECT *
FROM v_student_performance
WHERE avg_percentage < 40 OR attendance_percentage < 75;

-- Business KPI summary (superset of the original columns).
CREATE VIEW v_kpi_dashboard AS
SELECT
    (SELECT COUNT(*) FROM students) AS total_students,
    (SELECT COUNT(*) FROM courses)  AS total_courses,
    (SELECT COUNT(*) FROM faculty)  AS total_faculty,
    (SELECT COUNT(*) FROM programs) AS total_programs,
    (SELECT ROUND(AVG(marks_obtained), 2) FROM marks) AS overall_avg_marks,
    (SELECT ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)), 2)
       FROM marks m JOIN exams e ON e.exam_id = m.exam_id) AS avg_percentage,
    (SELECT ROUND(100.0 * SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0), 2) FROM attendance) AS attendance_percentage,
    (SELECT ROUND(100.0 * SUM(CASE WHEN e.max_marks > 0
                 AND m.marks_obtained * 100.0 / e.max_marks >= 40 THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0), 2)
       FROM marks m JOIN exams e ON e.exam_id = m.exam_id) AS pass_rate,
    (SELECT COUNT(*) FROM v_risk_students) AS risk_students_count;

-- Course completion rate = % of End-Sem results that passed (>= 40%).
DROP VIEW IF EXISTS v_course_completion;
CREATE VIEW v_course_completion AS
SELECT
    c.course_id,
    c.course_code,
    c.course_name,
    p.program_name,
    COUNT(m.mark_id) AS results_count,
    ROUND(100.0 * SUM(CASE WHEN e.max_marks > 0
                AND m.marks_obtained * 100.0 / e.max_marks >= 40 THEN 1 ELSE 0 END)
          / NULLIF(COUNT(m.mark_id), 0), 2) AS completion_rate
FROM courses c
LEFT JOIN programs p ON p.program_id = c.program_id
LEFT JOIN exams e ON e.course_id = c.course_id AND e.exam_type = 'End Sem'
LEFT JOIN marks m ON m.exam_id = e.exam_id
GROUP BY c.course_id, c.course_code, c.course_name, p.program_name;

-- Program trend over academic years (percentage; column kept as avg_score).
DROP VIEW IF EXISTS v2_program_trend;
CREATE VIEW v2_program_trend AS
SELECT
    p.program_id,
    p.program_name,
    ay.year_label AS academic_year,
    COUNT(DISTINCT s.student_id) AS students,
    ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)), 2) AS avg_score
FROM programs p
JOIN students s ON s.program_id = p.program_id
LEFT JOIN academic_years ay ON ay.academic_year_id = s.academic_year_id
LEFT JOIN marks m ON m.student_id = s.student_id
LEFT JOIN exams e ON e.exam_id = m.exam_id
GROUP BY p.program_id, p.program_name, ay.year_label
ORDER BY p.program_name, ay.year_label;

-- Faculty performance across semesters (percentage; column kept as avg_score).
DROP VIEW IF EXISTS v2_faculty_semester;
CREATE VIEW v2_faculty_semester AS
SELECT
    f.faculty_id,
    f.full_name AS faculty_name,
    sem.semester_id,
    sem.semester_name,
    sem.term_type,
    ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)), 2) AS avg_score
FROM faculty f
JOIN courses c ON c.faculty_id = f.faculty_id
LEFT JOIN semesters sem ON sem.semester_id = c.semester_id
LEFT JOIN exams e ON e.course_id = c.course_id
LEFT JOIN marks m ON m.exam_id = e.exam_id
GROUP BY f.faculty_id, f.full_name, sem.semester_id, sem.semester_name, sem.term_type;


\echo >>> sql/migrations/009_enrollment_status.sql
-- Migration 009 — Explicit course-completion status on enrollments
-- ADDITIVE ONLY. Adds a real field that records whether a student completed a
-- course, so "completion rate" is a true, queryable metric (not inferred).
--
-- Values: 'Completed' | 'Ongoing' | 'Dropped'. seed.sql backfills it from each
-- student's End-Sem result + attendance for that course.

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status VARCHAR(15) DEFAULT 'Ongoing';

CREATE INDEX IF NOT EXISTS ix_enrollments_status ON enrollments (status);

-- Completion rate now comes from the explicit enrollments.status field.
DROP VIEW IF EXISTS v_course_completion;
CREATE VIEW v_course_completion AS
SELECT
    c.course_id,
    c.course_code,
    c.course_name,
    p.program_name,
    COUNT(en.enrollment_id) AS enrolled,
    SUM(CASE WHEN en.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
    ROUND(100.0 * SUM(CASE WHEN en.status = 'Completed' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(en.enrollment_id), 0), 2) AS completion_rate
FROM courses c
LEFT JOIN programs p ON p.program_id = c.program_id
LEFT JOIN enrollments en ON en.course_id = c.course_id
GROUP BY c.course_id, c.course_code, c.course_name, p.program_name;


\echo >>> sql/migrations/010_attendance_daily_views.sql
-- =====================================================================
-- Migration 010: daily attendance semantic views
-- ---------------------------------------------------------------------
-- Attendance is recorded PER SUBJECT (one row per student, per course,
-- per day). That makes "how many students are present today?" ambiguous:
-- a student can be Present in some subjects and Absent in others, so
-- counting DISTINCT students per status double-counts them.
--
-- These views collapse attendance to a clean, unambiguous grain so tools
-- like MinusX answer with a single sensible number.
--
-- Additive only: no tables/columns changed, existing views untouched.
-- Idempotent: safe to re-run (CREATE OR REPLACE).
-- =====================================================================

-- 1) One row per day: record-level totals + attendance rate.
--    Answers "attendance today" as records and a percentage.
CREATE OR REPLACE VIEW v_attendance_daily AS
SELECT
    class_date,
    COUNT(*)                                             AS total_records,
    COUNT(DISTINCT student_id)                           AS students_marked,
    SUM((status = 'Present')::int)                       AS present_records,
    SUM((status = 'Absent')::int)                        AS absent_records,
    SUM((status = 'Late')::int)                          AS late_records,
    ROUND(100.0 * SUM((status IN ('Present','Late'))::int)
          / NULLIF(COUNT(*), 0), 1)                      AS attendance_percentage
FROM attendance
GROUP BY class_date;

-- 2) One row per student per day: a single, mutually-exclusive day status
--    so counts SUM to the number of students (no double counting).
--    A student "attended" a class if Present or Late.
--      day_status = 'Present' -> attended all their classes that day
--                   'Absent'  -> attended none
--                   'Partial' -> attended some but not all
CREATE OR REPLACE VIEW v_student_daily_attendance AS
SELECT
    a.student_id,
    s.full_name                                         AS student_name,
    s.roll_number,
    s.section,
    s.program_id,
    p.program_name,
    s.academic_year_id,
    ay.year_label,
    a.class_date,
    COUNT(*)                                            AS classes_scheduled,
    SUM((a.status = 'Present')::int)                    AS present_count,
    SUM((a.status = 'Late')::int)                       AS late_count,
    SUM((a.status = 'Absent')::int)                     AS absent_count,
    SUM((a.status IN ('Present','Late'))::int)          AS attended_count,
    CASE
        WHEN SUM((a.status IN ('Present','Late'))::int) = COUNT(*) THEN 'Present'
        WHEN SUM((a.status IN ('Present','Late'))::int) = 0        THEN 'Absent'
        ELSE 'Partial'
    END                                                 AS day_status
FROM attendance a
JOIN students s      ON s.student_id = a.student_id
LEFT JOIN programs p ON p.program_id = s.program_id
LEFT JOIN academic_years ay ON ay.academic_year_id = s.academic_year_id
GROUP BY a.student_id, s.full_name, s.roll_number, s.section,
         s.program_id, p.program_name, s.academic_year_id, ay.year_label, a.class_date;


\echo >>> sql/migrations/011_exams_scheduling.sql
-- =====================================================================
-- Migration 011: exam scheduling + lifecycle columns
-- ---------------------------------------------------------------------
-- Adds operational metadata the ERP Exams module needs. Branch, semester,
-- term and faculty are NOT stored here — they are derived via the exam's
-- course (course -> program / semester / faculty), so nothing is
-- duplicated. Additive only; existing columns and data untouched.
-- Idempotent: safe to re-run.
-- =====================================================================

ALTER TABLE exams ADD COLUMN IF NOT EXISTS status       VARCHAR(15) DEFAULT 'Scheduled';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS start_time   TIME;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS end_time     TIME;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Backfill lifecycle status from reality: an exam that already has marks
-- entered is Completed; everything else is Scheduled.
UPDATE exams e
SET status = CASE
        WHEN EXISTS (SELECT 1 FROM marks m WHERE m.exam_id = e.exam_id) THEN 'Completed'
        ELSE 'Scheduled'
    END
WHERE status IS NULL OR status = 'Scheduled';

CREATE INDEX IF NOT EXISTS idx_exams_status ON exams (status);
CREATE INDEX IF NOT EXISTS idx_exams_course ON exams (course_id);


\echo >>> sql/migrations/012_marks_status.sql
-- =====================================================================
-- Migration 012: marks status + remarks
-- ---------------------------------------------------------------------
-- Adds an explicit attendance-in-exam status so an absent student is
-- distinct from a genuine zero, plus an optional remarks note.
-- Additive + idempotent. Existing marks are treated as 'Present'.
-- =====================================================================

ALTER TABLE marks ADD COLUMN IF NOT EXISTS status   VARCHAR(10) DEFAULT 'Present';
ALTER TABLE marks ADD COLUMN IF NOT EXISTS remarks  VARCHAR(200);

UPDATE marks SET status = 'Present' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_marks_exam    ON marks (exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks (student_id);


\echo >>> sql/migrations/013_marks_analytics_views.sql
-- =====================================================================
-- Migration 013: marks analytics semantic views (Metabase / MinusX)
-- ---------------------------------------------------------------------
-- A wide, denormalized fact view (v_marks_detail) plus rollups by student,
-- section, branch and subject. These make section/branch/subject/at-risk
-- questions answerable directly, without joins, in Metabase / MinusX.
-- Additive + idempotent (CREATE OR REPLACE). No tables changed.
-- Pass threshold = 40%. Absent marks are excluded from averages but counted.
-- =====================================================================

-- 1) Wide fact view: one row per mark with every dimension resolved.
CREATE OR REPLACE VIEW v_marks_detail AS
SELECT
    m.mark_id,
    m.marks_obtained,
    m.status,
    (m.status = 'Absent')                                   AS is_absent,
    m.remarks,
    st.student_id,
    st.full_name                                            AS student_name,
    st.roll_number,
    st.section,
    st.program_id,
    p.program_name                                          AS branch,
    st.academic_year_id,
    ay.year_label,
    sm.semester_number,
    ((sm.semester_number + 1) / 2)                          AS btech_year,
    CASE WHEN sm.semester_number % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END AS term,
    ex.exam_id,
    ex.exam_name,
    ex.exam_type,
    ex.exam_date,
    ex.max_marks,
    c.course_id,
    c.course_name                                           AS subject,
    c.course_code,
    f.full_name                                             AS faculty_name,
    CASE WHEN m.status = 'Present' AND ex.max_marks > 0
         THEN ROUND(m.marks_obtained * 100.0 / ex.max_marks, 2) END AS percentage,
    (m.status = 'Present' AND ex.max_marks > 0
        AND m.marks_obtained * 100.0 / ex.max_marks >= 40)  AS passed
FROM marks m
JOIN students st  ON st.student_id = m.student_id
JOIN exams ex     ON ex.exam_id = m.exam_id
JOIN courses c    ON c.course_id = ex.course_id
JOIN semesters sm ON sm.semester_id = c.semester_id
LEFT JOIN programs p        ON p.program_id = st.program_id
LEFT JOIN academic_years ay ON ay.academic_year_id = st.academic_year_id
LEFT JOIN faculty f         ON f.faculty_id = c.faculty_id;

-- 2) Per-student performance (with at-risk flag).
CREATE OR REPLACE VIEW v_marks_student_performance AS
SELECT
    student_id, student_name, roll_number, section, branch, program_id,
    btech_year, semester_number, term, year_label,
    COUNT(*)                                        AS total_exams,
    COUNT(*) FILTER (WHERE is_absent)               AS absent_count,
    COUNT(*) FILTER (WHERE NOT is_absent)           AS appeared,
    ROUND(AVG(percentage), 1)                       AS avg_percentage,
    COUNT(*) FILTER (WHERE passed)                  AS pass_count,
    COUNT(*) FILTER (WHERE NOT passed AND NOT is_absent) AS fail_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage,
    (AVG(percentage) < 40)                          AS at_risk
FROM v_marks_detail
GROUP BY student_id, student_name, roll_number, section, branch, program_id,
         btech_year, semester_number, term, year_label;

-- 3) Section-wise performance (branch + semester + section).
CREATE OR REPLACE VIEW v_marks_section_performance AS
SELECT
    branch, program_id, btech_year, semester_number, term, section,
    COUNT(DISTINCT student_id)                      AS students,
    COUNT(*) FILTER (WHERE NOT is_absent)           AS appeared,
    ROUND(AVG(percentage), 1)                       AS avg_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage,
    COUNT(*) FILTER (WHERE is_absent)               AS absent_count
FROM v_marks_detail
GROUP BY branch, program_id, btech_year, semester_number, term, section;

-- 4) Branch-wise performance (branch + semester).
CREATE OR REPLACE VIEW v_marks_branch_performance AS
SELECT
    branch, program_id, btech_year, semester_number, term,
    COUNT(DISTINCT student_id)                      AS students,
    ROUND(AVG(percentage), 1)                       AS avg_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage,
    COUNT(*) FILTER (WHERE is_absent)               AS absent_count
FROM v_marks_detail
GROUP BY branch, program_id, btech_year, semester_number, term;

-- 5) Subject-wise performance (with failure rate).
CREATE OR REPLACE VIEW v_marks_subject_performance AS
SELECT
    subject, course_id, course_code, branch, program_id, semester_number, term,
    COUNT(*) FILTER (WHERE NOT is_absent)           AS appeared,
    ROUND(AVG(percentage), 1)                       AS avg_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE NOT passed AND NOT is_absent)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS fail_percentage,
    COUNT(*) FILTER (WHERE is_absent)               AS absent_count
FROM v_marks_detail
GROUP BY subject, course_id, course_code, branch, program_id, semester_number, term;

-- 6) Current-semester marks (each mark whose exam semester = the student's
--    current semester) -- the default lens for "current" questions.
CREATE OR REPLACE VIEW v_current_semester_marks AS
SELECT d.*
FROM v_marks_detail d
JOIN students s ON s.student_id = d.student_id
WHERE d.semester_number = s.current_semester;

-- 7) At-risk students (by marks): low average, repeated failures, or absences.
CREATE OR REPLACE VIEW v_marks_at_risk AS
SELECT *
FROM v_marks_student_performance
WHERE at_risk OR avg_percentage < 45 OR fail_count >= 4 OR absent_count >= 3;


\echo >>> sql/migrations/014_dashboard_percentage_fix.sql
-- =====================================================================
-- Migration 014: make Dashboard performance views percentage-based
-- ---------------------------------------------------------------------
-- v_program_performance and v_course_performance averaged RAW marks across
-- exams with different maximums (20 / 50 / 100), producing a meaningless
-- ~30 "score". Rebuilt to average PERCENTAGE (marks_obtained * 100 / max),
-- excluding Absent marks (NULL). Column names unchanged so the Dashboard
-- keeps working. Additive + idempotent (CREATE OR REPLACE).
-- =====================================================================

CREATE OR REPLACE VIEW v_program_performance AS
SELECT
    p.program_id,
    p.program_name,
    COUNT(DISTINCT s.student_id) AS total_students,
    ROUND(AVG(m.marks_obtained * 100.0 / e.max_marks), 2) AS avg_program_score
FROM programs p
LEFT JOIN students s ON p.program_id = s.program_id
LEFT JOIN marks m    ON s.student_id = m.student_id AND m.marks_obtained IS NOT NULL
LEFT JOIN exams e    ON m.exam_id = e.exam_id AND e.max_marks > 0
GROUP BY p.program_id, p.program_name;

CREATE OR REPLACE VIEW v_course_performance AS
SELECT
    c.course_id,
    c.course_name,
    p.program_name,
    ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)), 2) AS avg_score,
    COUNT(DISTINCT en.student_id) AS enrolled_students,
    ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0))
          / NULLIF(c.credits, 0)::numeric, 2) AS normalized_score
FROM courses c
LEFT JOIN programs p     ON c.program_id = p.program_id
LEFT JOIN enrollments en ON c.course_id = en.course_id
LEFT JOIN exams e        ON c.course_id = e.course_id
LEFT JOIN marks m        ON e.exam_id = m.exam_id AND m.marks_obtained IS NOT NULL
GROUP BY c.course_id, c.course_name, p.program_name, c.credits;


\echo >>> sql/migrations/015_minusx_business_views.sql
-- =====================================================================
-- Migration 015: business-friendly semantic views for MinusX / Metabase
-- ---------------------------------------------------------------------
-- Clean, plain-named views a principal/admin analyst (and MinusX AI) can
-- query directly. Most wrap the existing analytics views (010/013/014);
-- a few add attendance-today / exam-schedule specifics. Additive +
-- idempotent. Nothing else is modified.
--
-- Convention: attendance_percentage = 100 * Present / total records
-- (matches the app's at-risk logic). "Current semester" = any semester a
-- cohort is currently in (students.current_semester).
-- =====================================================================

-- ============================ ATTENDANCE ============================

CREATE OR REPLACE VIEW v_today_attendance_summary AS
SELECT
    CURRENT_DATE                                            AS class_date,
    COUNT(*)                                                AS total_records,
    COUNT(DISTINCT student_id)                              AS students_marked,
    COUNT(*) FILTER (WHERE status = 'Present')              AS present,
    COUNT(*) FILTER (WHERE status = 'Absent')               AS absent,
    COUNT(*) FILTER (WHERE status = 'Late')                 AS late,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'Present')
          / NULLIF(COUNT(*), 0), 1)                         AS attendance_percentage
FROM attendance
WHERE class_date = CURRENT_DATE;

CREATE OR REPLACE VIEW v_today_attendance_by_branch AS
SELECT
    p.program_name                                          AS branch,
    s.program_id,
    COUNT(*)                                                AS total_records,
    COUNT(*) FILTER (WHERE a.status = 'Present')            AS present,
    COUNT(*) FILTER (WHERE a.status = 'Absent')             AS absent,
    COUNT(*) FILTER (WHERE a.status = 'Late')               AS late,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'Present')
          / NULLIF(COUNT(*), 0), 1)                         AS attendance_percentage
FROM attendance a
JOIN students s      ON s.student_id = a.student_id
LEFT JOIN programs p ON p.program_id = s.program_id
WHERE a.class_date = CURRENT_DATE
GROUP BY p.program_name, s.program_id
ORDER BY attendance_percentage;

CREATE OR REPLACE VIEW v_today_attendance_by_section AS
SELECT
    p.program_name                                          AS branch,
    s.program_id,
    s.section,
    COUNT(*)                                                AS total_records,
    COUNT(*) FILTER (WHERE a.status = 'Present')            AS present,
    COUNT(*) FILTER (WHERE a.status = 'Absent')             AS absent,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'Present')
          / NULLIF(COUNT(*), 0), 1)                         AS attendance_percentage
FROM attendance a
JOIN students s      ON s.student_id = a.student_id
LEFT JOIN programs p ON p.program_id = s.program_id
WHERE a.class_date = CURRENT_DATE AND s.section IS NOT NULL
GROUP BY p.program_name, s.program_id, s.section
ORDER BY attendance_percentage;

CREATE OR REPLACE VIEW v_current_semester_attendance_summary AS
SELECT
    p.program_name                                          AS branch,
    s.current_semester                                      AS semester_number,
    COUNT(DISTINCT s.student_id)                            AS students,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'Present')
          / NULLIF(COUNT(*), 0), 1)                         AS attendance_percentage
FROM attendance a
JOIN students s      ON s.student_id = a.student_id
LEFT JOIN programs p ON p.program_id = s.program_id
GROUP BY p.program_name, s.current_semester
ORDER BY p.program_name, s.current_semester;

CREATE OR REPLACE VIEW v_low_attendance_students AS
SELECT
    s.student_id, s.full_name AS student_name, s.roll_number,
    p.program_name AS branch, s.section, s.current_semester AS semester_number,
    COUNT(a.attendance_id)                                  AS classes,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'Present')
          / NULLIF(COUNT(a.attendance_id), 0), 1)           AS attendance_percentage
FROM students s
JOIN attendance a    ON a.student_id = s.student_id
LEFT JOIN programs p ON p.program_id = s.program_id
GROUP BY s.student_id, s.full_name, s.roll_number, p.program_name, s.section, s.current_semester
HAVING ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'Present')
             / NULLIF(COUNT(a.attendance_id), 0), 1) < 75
ORDER BY attendance_percentage;

CREATE OR REPLACE VIEW v_attendance_trend_last_7_days AS
SELECT
    class_date,
    COUNT(*)                                                AS total_records,
    COUNT(*) FILTER (WHERE status = 'Present')              AS present,
    COUNT(*) FILTER (WHERE status = 'Absent')               AS absent,
    COUNT(*) FILTER (WHERE status = 'Late')                 AS late,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'Present')
          / NULLIF(COUNT(*), 0), 1)                         AS attendance_percentage
FROM attendance
WHERE class_date > CURRENT_DATE - INTERVAL '7 days' AND class_date <= CURRENT_DATE
GROUP BY class_date
ORDER BY class_date;

-- ============================== EXAMS ==============================

CREATE OR REPLACE VIEW v_exam_schedule_current_semester AS
SELECT
    e.exam_id, e.exam_name, e.exam_type, e.exam_date, e.status, e.max_marks,
    c.course_name AS subject, c.course_code,
    p.program_name AS branch, sm.semester_number,
    ((sm.semester_number + 1) / 2) AS btech_year,
    CASE WHEN sm.semester_number % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END AS term,
    f.full_name AS faculty_name
FROM exams e
JOIN courses c    ON c.course_id = e.course_id
JOIN semesters sm ON sm.semester_id = c.semester_id
LEFT JOIN programs p ON p.program_id = c.program_id
LEFT JOIN faculty f  ON f.faculty_id = c.faculty_id
WHERE sm.semester_number IN (SELECT DISTINCT current_semester FROM students WHERE current_semester IS NOT NULL)
ORDER BY e.exam_date;

CREATE OR REPLACE VIEW v_exam_status_summary AS
SELECT
    p.program_name AS branch, sm.semester_number,
    COUNT(*)                                                AS total_exams,
    COUNT(*) FILTER (WHERE e.status = 'Completed')          AS completed,
    COUNT(*) FILTER (WHERE e.status = 'Scheduled')          AS scheduled,
    COUNT(*) FILTER (WHERE e.status = 'Cancelled')          AS cancelled,
    COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM marks m WHERE m.exam_id = e.exam_id)) AS pending_marks
FROM exams e
JOIN courses c    ON c.course_id = e.course_id
JOIN semesters sm ON sm.semester_id = c.semester_id
LEFT JOIN programs p ON p.program_id = c.program_id
GROUP BY p.program_name, sm.semester_number
ORDER BY p.program_name, sm.semester_number;

CREATE OR REPLACE VIEW v_subject_exam_overview AS
SELECT
    c.course_id, c.course_name AS subject, c.course_code,
    p.program_name AS branch, sm.semester_number,
    COUNT(e.exam_id)                                        AS total_exams,
    COUNT(*) FILTER (WHERE e.exam_type IN ('Internal 1', 'Internal 2')) AS internals,
    COUNT(*) FILTER (WHERE e.exam_type = 'Mid Sem')         AS mid_sem,
    COUNT(*) FILTER (WHERE e.exam_type = 'End Sem')         AS end_sem,
    COUNT(*) FILTER (WHERE e.exam_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM marks m WHERE m.exam_id = e.exam_id)) AS pending_marks
FROM courses c
JOIN semesters sm ON sm.semester_id = c.semester_id
LEFT JOIN exams e ON e.course_id = c.course_id
LEFT JOIN programs p ON p.program_id = c.program_id
GROUP BY c.course_id, c.course_name, c.course_code, p.program_name, sm.semester_number;

CREATE OR REPLACE VIEW v_exam_faculty_mapping AS
SELECT
    e.exam_id, e.exam_name, e.exam_type, e.exam_date,
    c.course_name AS subject, p.program_name AS branch, sm.semester_number,
    f.faculty_id, f.full_name AS faculty_name, f.department
FROM exams e
JOIN courses c    ON c.course_id = e.course_id
JOIN semesters sm ON sm.semester_id = c.semester_id
LEFT JOIN programs p ON p.program_id = c.program_id
LEFT JOIN faculty f  ON f.faculty_id = c.faculty_id;

CREATE OR REPLACE VIEW v_exam_pending_marks_summary AS
SELECT
    e.exam_id, e.exam_name, e.exam_type, e.exam_date,
    c.course_name AS subject, p.program_name AS branch, sm.semester_number,
    f.full_name AS faculty_name
FROM exams e
JOIN courses c    ON c.course_id = e.course_id
JOIN semesters sm ON sm.semester_id = c.semester_id
LEFT JOIN programs p ON p.program_id = c.program_id
LEFT JOIN faculty f  ON f.faculty_id = c.faculty_id
WHERE NOT EXISTS (SELECT 1 FROM marks m WHERE m.exam_id = e.exam_id)
ORDER BY e.exam_date;

-- ======================= MARKS / PERFORMANCE =======================
-- Plain-named wrappers over the marks analytics views (migration 013).

CREATE OR REPLACE VIEW v_student_performance_summary AS
SELECT * FROM v_marks_student_performance;

CREATE OR REPLACE VIEW v_subject_result_summary AS
SELECT * FROM v_marks_subject_performance;

CREATE OR REPLACE VIEW v_section_performance AS
SELECT * FROM v_marks_section_performance;

CREATE OR REPLACE VIEW v_branch_pass_rate AS
SELECT branch, program_id, semester_number, term, students, avg_percentage, pass_percentage
FROM v_marks_branch_performance;

CREATE OR REPLACE VIEW v_marks_current_semester_summary AS
SELECT
    branch, program_id, section, semester_number,
    COUNT(DISTINCT student_id)                              AS students,
    ROUND(AVG(percentage), 1)                               AS avg_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage
FROM v_current_semester_marks
GROUP BY branch, program_id, section, semester_number
ORDER BY branch, section;

-- Combined at-risk: low marks (avg < 40%) OR low attendance (< 75%).
CREATE OR REPLACE VIEW v_at_risk_students AS
WITH mk AS (
    SELECT st.student_id,
           ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)), 1) AS avg_marks
    FROM marks m
    JOIN exams e     ON e.exam_id = m.exam_id
    JOIN students st ON st.student_id = m.student_id
    WHERE m.status = 'Present' AND e.max_marks > 0
    GROUP BY st.student_id
),
att AS (
    SELECT student_id,
           ROUND(100.0 * SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)
                 / NULLIF(COUNT(*), 0), 1) AS att_pct
    FROM attendance GROUP BY student_id
)
SELECT
    s.student_id, s.full_name AS student_name, s.roll_number,
    p.program_name AS branch, s.section, s.current_semester AS semester_number,
    mk.avg_marks   AS avg_marks_percentage,
    att.att_pct    AS attendance_percentage,
    CASE
        WHEN COALESCE(mk.avg_marks, 100) < 40 AND COALESCE(att.att_pct, 100) < 75 THEN 'Low marks + low attendance'
        WHEN COALESCE(mk.avg_marks, 100) < 40 THEN 'Low marks'
        ELSE 'Low attendance'
    END AS risk_reason
FROM students s
LEFT JOIN programs p ON p.program_id = s.program_id
LEFT JOIN mk  ON mk.student_id = s.student_id
LEFT JOIN att ON att.student_id = s.student_id
WHERE (COALESCE(mk.avg_marks, 100) < 40 OR COALESCE(att.att_pct, 100) < 75)
  AND (s.status = 'Active' OR s.status IS NULL)
ORDER BY COALESCE(mk.avg_marks, att.att_pct);


\echo >>> sql/migrations/016_semesters_shared.sql
-- =====================================================================
-- Migration 016: collapse per-program semesters into 8 SHARED semesters
-- ---------------------------------------------------------------------
-- A semester is a college-wide academic cycle, not a per-branch record.
-- This merges the 32 rows (8 numbers x 4 programs) into 8 canonical rows,
-- remapping courses.semester_id (the ONLY FK into semesters) so nothing
-- is lost — courses keep their own program_id, and every exam / mark /
-- attendance row keys off course / semester_number, which are preserved.
-- Adds ERP columns: btech_year, academic_period, is_current, status.
-- Additive + idempotent-ish (safe to re-run: after collapse it's a no-op).
-- =====================================================================
BEGIN;

-- 1) New academic columns.
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS btech_year      INT;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS academic_period VARCHAR(30);
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS is_current      BOOLEAN DEFAULT false;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS status          VARCHAR(15) DEFAULT 'Upcoming';

-- 2) Point every course at the canonical (lowest-id) semester of its number.
WITH canon AS (
    SELECT semester_number, MIN(semester_id) AS keep_id
    FROM semesters GROUP BY semester_number
)
UPDATE courses c
SET semester_id = canon.keep_id
FROM semesters s, canon
WHERE c.semester_id = s.semester_id
  AND s.semester_number = canon.semester_number
  AND s.semester_id <> canon.keep_id;

-- 3) Drop the now-orphaned duplicate semester rows (24 of them).
DELETE FROM semesters
WHERE semester_id NOT IN (SELECT MIN(semester_id) FROM semesters GROUP BY semester_number);

-- 4) Make the surviving 8 rows shared + enriched.
UPDATE semesters SET
    program_id      = NULL,
    semester_name   = 'Semester ' || semester_number,
    term_type       = CASE WHEN semester_number % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END,
    btech_year      = (semester_number + 1) / 2,
    academic_period = CASE WHEN semester_number % 2 = 1 THEN 'Jul-Nov' ELSE 'Dec-Apr' END,
    status          = CASE
        WHEN semester_number IN (SELECT DISTINCT current_semester FROM students WHERE current_semester IS NOT NULL)
        THEN 'Active' ELSE 'Upcoming' END;

-- 5) Mark the final-year current Monsoon term (Semester 7) as the current
--    operational semester (exactly one). Admin can change this later.
UPDATE semesters SET is_current = (semester_number = 7);

COMMIT;


\echo >>> sql/migrations/017_audit_view_fixes.sql
-- =====================================================================
-- Migration 017: final-audit view fixes
-- ---------------------------------------------------------------------
-- 1) "Today's attendance" views were pinned to CURRENT_DATE, so they go
--    empty the moment the clock passes the last seeded class day. Rebase
--    them on the LATEST marked day so "today's attendance" is always the
--    most recent day of records (robust for demos + MinusX).
-- 2) v_faculty_performance had a self-join typo (c.program_id = c.program_id)
--    that made every faculty show the same number, and averaged RAW marks.
--    Fixed: join on faculty_id and average PERCENTAGE (excluding absentees).
-- Additive + idempotent (CREATE OR REPLACE).
-- =====================================================================

CREATE OR REPLACE VIEW v_today_attendance_summary AS
WITH latest AS (SELECT MAX(class_date) AS d FROM attendance)
SELECT
    (SELECT d FROM latest)                                  AS class_date,
    COUNT(*)                                                AS total_records,
    COUNT(DISTINCT student_id)                              AS students_marked,
    COUNT(*) FILTER (WHERE status = 'Present')              AS present,
    COUNT(*) FILTER (WHERE status = 'Absent')               AS absent,
    COUNT(*) FILTER (WHERE status = 'Late')                 AS late,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'Present')
          / NULLIF(COUNT(*), 0), 1)                         AS attendance_percentage
FROM attendance
WHERE class_date = (SELECT d FROM latest);

CREATE OR REPLACE VIEW v_today_attendance_by_branch AS
WITH latest AS (SELECT MAX(class_date) AS d FROM attendance)
SELECT
    p.program_name                                          AS branch,
    s.program_id,
    COUNT(*)                                                AS total_records,
    COUNT(*) FILTER (WHERE a.status = 'Present')            AS present,
    COUNT(*) FILTER (WHERE a.status = 'Absent')             AS absent,
    COUNT(*) FILTER (WHERE a.status = 'Late')               AS late,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'Present')
          / NULLIF(COUNT(*), 0), 1)                         AS attendance_percentage
FROM attendance a
JOIN students s      ON s.student_id = a.student_id
LEFT JOIN programs p ON p.program_id = s.program_id
WHERE a.class_date = (SELECT d FROM latest)
GROUP BY p.program_name, s.program_id
ORDER BY attendance_percentage;

CREATE OR REPLACE VIEW v_today_attendance_by_section AS
WITH latest AS (SELECT MAX(class_date) AS d FROM attendance)
SELECT
    p.program_name                                          AS branch,
    s.program_id,
    s.section,
    COUNT(*)                                                AS total_records,
    COUNT(*) FILTER (WHERE a.status = 'Present')            AS present,
    COUNT(*) FILTER (WHERE a.status = 'Absent')             AS absent,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'Present')
          / NULLIF(COUNT(*), 0), 1)                         AS attendance_percentage
FROM attendance a
JOIN students s      ON s.student_id = a.student_id
LEFT JOIN programs p ON p.program_id = s.program_id
WHERE a.class_date = (SELECT d FROM latest) AND s.section IS NOT NULL
GROUP BY p.program_name, s.program_id, s.section
ORDER BY attendance_percentage;

-- Correct faculty performance: join by faculty_id, percentage-based, exclude absent.
-- DROP first: the column set changes (adds courses_taught), which CREATE OR
-- REPLACE cannot do. No object depends on this view.
DROP VIEW IF EXISTS v_faculty_performance;
CREATE VIEW v_faculty_performance AS
SELECT
    f.faculty_id,
    f.full_name  AS faculty_name,
    f.department,
    COUNT(DISTINCT c.course_id) AS courses_taught,
    ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0))
          FILTER (WHERE m.status = 'Present'), 1) AS avg_student_percentage
FROM faculty f
LEFT JOIN courses c ON c.faculty_id = f.faculty_id
LEFT JOIN exams e   ON e.course_id = c.course_id
LEFT JOIN marks m   ON m.exam_id = e.exam_id
GROUP BY f.faculty_id, f.full_name, f.department;


\echo >>> sql/migrations/018_competency_view.sql
-- =====================================================================
-- Migration 018: ensure v_competency_analysis exists in the migration chain
-- ---------------------------------------------------------------------
-- This view is used by the Dashboard (/dashboard/competency-analysis) but
-- was only defined in sql/views.sql, so a fresh build from schema+migrations
-- alone was missing it. Re-declared here (idempotent) so deploy bundles and
-- fresh databases include it. Base tables only — safe to run anytime.
-- =====================================================================

CREATE OR REPLACE VIEW v_competency_analysis AS
SELECT
    c.competency_name,
    ROUND(AVG(sc.score), 2) AS avg_score,
    CASE
        WHEN AVG(sc.score) < 70 THEN 'Weak Area'
        WHEN AVG(sc.score) >= 70 AND AVG(sc.score) <= 85 THEN 'Moderate'
        ELSE 'Strong'
    END AS competency_level
FROM competencies c
JOIN student_competencies sc ON c.competency_id = sc.competency_id
GROUP BY c.competency_name;

\echo >>> seed.sql
-- =====================================================================
-- B.Tech College ERP — realistic seed data
-- =====================================================================
-- Generates ~800 students across 4 branches (CSE/ECE/Civil/Mech) x
-- 4 academic years (50 per branch per year), plus faculty, courses,
-- exams, marks, attendance and competency scores.
--
-- RUN ORDER on a fresh database:
--   1) sql/schema.sql
--   2) sql/migrations/*.sql   (adds ERP columns/tables this seed relies on)
--   3) sql/seed.sql           (this file)
--
-- This file is re-runnable: it TRUNCATEs all tables first, then reloads.
-- =====================================================================

TRUNCATE TABLE
    student_competencies, marks, attendance, enrollments, exams,
    courses, students, semesters, faculty, competencies,
    academic_years, programs
RESTART IDENTITY CASCADE;

-- ---------- Programs (branches) ----------
INSERT INTO programs (program_name, duration_years) VALUES
    ('Computer Science Engineering', 4),
    ('Electronics & Communication Engineering', 4),
    ('Civil Engineering', 4),
    ('Mechanical Engineering', 4);

-- ---------- Academic years ----------
INSERT INTO academic_years (year_label, start_year, end_year) VALUES
    ('2023-2024', 2023, 2024),
    ('2024-2025', 2024, 2025),
    ('2025-2026', 2025, 2026),
    ('2026-2027', 2026, 2027);

-- ---------- Faculty (5 per department) ----------
INSERT INTO faculty (full_name, email, department)
SELECT 'Prof ' || d.abbr || ' ' || n,
       lower(d.abbr) || n || '@college.edu',
       d.pname
FROM (VALUES
    ('CSE', 'Computer Science Engineering'),
    ('ECE', 'Electronics & Communication Engineering'),
    ('CIV', 'Civil Engineering'),
    ('MEC', 'Mechanical Engineering')
) d(abbr, pname)
CROSS JOIN generate_series(1, 5) n;

-- ---------- Semesters (8 SHARED across all programs — migration 016) ----------
-- A semester is a college-wide academic cycle; programs relate through courses.
INSERT INTO semesters (semester_name, semester_number, term_type, btech_year, academic_period, status, is_current)
SELECT 'Semester ' || s,
       s,
       CASE WHEN s % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END,
       (s + 1) / 2,
       CASE WHEN s % 2 = 1 THEN 'Jul-Nov' ELSE 'Dec-Apr' END,
       CASE WHEN s % 2 = 1 THEN 'Active' ELSE 'Upcoming' END,   -- odd = current Monsoon
       (s = 7)                                                   -- final-year current sem
FROM generate_series(1, 8) s;

-- ---------- Courses (4 per semester per program, with assigned faculty) ----------
WITH fac AS (
    SELECT faculty_id, department,
           row_number() OVER (PARTITION BY department ORDER BY faculty_id) AS rn
    FROM faculty
)
INSERT INTO courses (program_id, semester_id, course_name, credits, course_code, faculty_id)
SELECT p.program_id,
       sem.semester_id,
       CASE d.abbr
           WHEN 'CSE' THEN (ARRAY[
               'Engineering Mathematics I','Programming in C','Physics for Computing','Basic Electrical Engineering',
               'Engineering Mathematics II','Data Structures','Digital Logic Design','Discrete Mathematics',
               'Object Oriented Programming','Computer Organization','Database Management Systems','Operating Systems',
               'Design and Analysis of Algorithms','Computer Networks','Theory of Computation','Microprocessors',
               'Software Engineering','Compiler Design','Web Technologies','Artificial Intelligence',
               'Machine Learning','Cloud Computing','Information Security','Data Mining',
               'Deep Learning','Big Data Analytics','Internet of Things','Distributed Systems',
               'Natural Language Processing','Blockchain Technology','DevOps Engineering','Capstone Project'
           ])[(sem.semester_number - 1) * 4 + c]
           WHEN 'ECE' THEN (ARRAY[
               'Engineering Mathematics I','Physics for Electronics','Basic Electrical Engineering','Programming Fundamentals',
               'Engineering Mathematics II','Electronic Devices and Circuits','Network Theory','Signals and Systems',
               'Analog Electronics','Digital Electronics','Electromagnetic Theory','Control Systems',
               'Communication Systems','Microcontrollers','Linear Integrated Circuits','Random Processes',
               'Digital Signal Processing','VLSI Design','Antennas and Wave Propagation','Microwave Engineering',
               'Embedded Systems','Optical Communication','Wireless Communication','Digital Image Processing',
               'Satellite Communication','RF Circuit Design','Radar Systems','Nanoelectronics',
               'IoT and Sensors','5G Networks','Biomedical Electronics','Capstone Project'
           ])[(sem.semester_number - 1) * 4 + c]
           WHEN 'CIV' THEN (ARRAY[
               'Engineering Mathematics I','Engineering Physics','Engineering Chemistry','Engineering Mechanics',
               'Engineering Mathematics II','Building Materials','Surveying I','Fluid Mechanics',
               'Strength of Materials','Surveying II','Concrete Technology','Soil Mechanics',
               'Structural Analysis I','Hydraulics','Transportation Engineering I','Geotechnical Engineering',
               'Structural Analysis II','Design of RC Structures','Water Resources Engineering','Environmental Engineering I',
               'Design of Steel Structures','Foundation Engineering','Transportation Engineering II','Environmental Engineering II',
               'Construction Management','Estimation and Costing','Earthquake Engineering','Bridge Engineering',
               'Advanced Structural Design','Remote Sensing and GIS','Pavement Design','Capstone Project'
           ])[(sem.semester_number - 1) * 4 + c]
           ELSE (ARRAY[
               'Engineering Mathematics I','Engineering Physics','Engineering Chemistry','Engineering Graphics',
               'Engineering Mathematics II','Engineering Mechanics','Thermodynamics','Material Science',
               'Strength of Materials','Fluid Mechanics','Manufacturing Processes','Machine Drawing',
               'Kinematics of Machinery','Applied Thermodynamics','Metrology and Measurements','Engineering Metallurgy',
               'Dynamics of Machinery','Heat and Mass Transfer','Design of Machine Elements','Manufacturing Technology',
               'Internal Combustion Engines','Refrigeration and Air Conditioning','Automobile Engineering','Finite Element Analysis',
               'Mechatronics','Power Plant Engineering','Robotics','Computer Aided Manufacturing',
               'Automation and Control','Renewable Energy Systems','Industrial Engineering','Capstone Project'
           ])[(sem.semester_number - 1) * 4 + c]
       END,
       3 + (c % 2),
       d.abbr || (sem.semester_number * 10 + c),
       f.faculty_id
FROM programs p
JOIN (VALUES
    ('Computer Science Engineering', 'CSE'),
    ('Electronics & Communication Engineering', 'ECE'),
    ('Civil Engineering', 'CIV'),
    ('Mechanical Engineering', 'MEC')
) d(pname, abbr) ON d.pname = p.program_name
CROSS JOIN semesters sem                                    -- 8 shared semesters
CROSS JOIN generate_series(1, 4) c
JOIN fac f ON f.department = p.program_name AND f.rn = ((c - 1) % 5) + 1;

-- ---------- Competencies ----------
INSERT INTO competencies (competency_name, description) VALUES
    ('Programming', 'Coding and software development skill'),
    ('Communication', 'Verbal and written communication'),
    ('Problem Solving', 'Analytical and logical reasoning'),
    ('Team Work', 'Collaboration in teams'),
    ('Leadership', 'Leading and coordinating teams');

-- ---------- Students (50 per branch per academic year = 800) ----------
INSERT INTO students (
    program_id, academic_year_id, full_name, email, roll_number,
    gender, current_year, current_semester, section, enrollment_year, status
)
SELECT
    b.program_id,
    b.academic_year_id,
    (ARRAY['Aarav','Vivaan','Aditya','Arjun','Sai','Reyansh','Krishna','Ishaan',
           'Rohan','Kabir','Ananya','Diya','Aadhya','Saanvi','Isha','Kavya',
           'Riya','Priya','Neha','Meera'])[1 + ((b.rn - 1) % 20)]
      || ' ' ||
    (ARRAY['Sharma','Verma','Reddy','Nair','Iyer','Gupta','Patel','Rao','Kumar',
           'Singh','Das','Bose','Menon','Pillai','Chowdhury'])[1 + ((b.rn - 1) % 15)],
    lower(b.abbr) || b.start_year || lpad(b.n::text, 3, '0') || '@college.edu',
    b.abbr || b.start_year || lpad(b.n::text, 3, '0'),
    CASE WHEN b.n % 2 = 0 THEN 'Male' ELSE 'Female' END,
    -- Study year derived from the admission batch relative to the latest
    -- academic year: joined 2023 -> Year 4 in 2026-2027, etc. A whole batch
    -- shares the same year (real B.Tech progression).
    GREATEST(1, LEAST(4, b.max_start - b.start_year + 1)),
    GREATEST(1, LEAST(4, b.max_start - b.start_year + 1)) * 2 - 1,
    CASE WHEN b.n <= 25 THEN 'A' ELSE 'B' END,
    b.start_year,
    'Active'
FROM (
    SELECT p.program_id, d.abbr, ay.academic_year_id, ay.start_year, n,
           (SELECT MAX(start_year) FROM academic_years) AS max_start,
           row_number() OVER (ORDER BY p.program_id, ay.start_year, n) AS rn
    FROM programs p
    JOIN (VALUES
        ('Computer Science Engineering', 'CSE'),
        ('Electronics & Communication Engineering', 'ECE'),
        ('Civil Engineering', 'CIV'),
        ('Mechanical Engineering', 'MEC')
    ) d(pname, abbr) ON d.pname = p.program_name
    CROSS JOIN academic_years ay
    CROSS JOIN generate_series(1, 50) n
) b;

-- ---------- Enrollments (each student -> the 4 courses of their current semester) ----------
INSERT INTO enrollments (student_id, course_id, enrollment_date)
SELECT s.student_id, c.course_id, make_date(s.enrollment_year, 8, 1)
FROM students s
JOIN semesters sem ON sem.semester_number = s.current_semester
JOIN courses c ON c.semester_id = sem.semester_id AND c.program_id = s.program_id;

-- ---------- Exams (4 per course) ----------
INSERT INTO exams (course_id, exam_name, exam_type, exam_date, max_marks, weightage)
SELECT c.course_id, t.nm, t.nm, make_date(2025, t.mon, 15), t.mx, t.wt
FROM courses c
CROSS JOIN (VALUES
    ('Internal 1', 9, 20, 10),
    ('Internal 2', 10, 20, 10),
    ('Mid Sem', 11, 50, 30),
    ('End Sem', 12, 100, 50)
) t(nm, mon, mx, wt);

-- ---------- Marks (realistic, differentiated by student / section / branch / subject) ----------
-- Per-student ability is stable across their exams; deterministic modifiers add
-- real structure so analytics show genuine differences:
--   Section A > Section B (B is the weaker section)
--   CSE > ECE > Civil > Mech (Mech weakest branch)
--   subjects vary easy<->hard by course_id
-- Weak students (student_id % 15 = 0) score 18-38% (fail); a few (student, exam)
-- pairs are Absent. Requires migration 012 (marks.status).
CREATE TEMP TABLE _ability AS
SELECT s.student_id, s.program_id, s.section, s.current_semester,
       CASE WHEN s.student_id % 15 = 0 THEN 0.18 + random() * 0.20
            ELSE 0.52 + random() * 0.38 END AS base,
       CASE WHEN s.student_id % 15 = 0 THEN 0.08 ELSE 0.03 END AS absent_prob
FROM students s
WHERE (s.status = 'Active' OR s.status IS NULL) AND s.current_semester IS NOT NULL;

INSERT INTO marks (student_id, exam_id, marks_obtained, status)
SELECT student_id, exam_id,
       CASE WHEN is_absent THEN NULL
            ELSE GREATEST(0, LEAST(max_marks, round(max_marks * final_pct)))::int END,
       CASE WHEN is_absent THEN 'Absent' ELSE 'Present' END
FROM (
    SELECT student_id, exam_id, max_marks, is_absent,
           LEAST(0.99, GREATEST(0.03, raw_pct)) AS final_pct
    FROM (
        SELECT a.student_id, ex.exam_id, ex.max_marks,
               (random() < a.absent_prob) AS is_absent,
               a.base
               + CASE a.section WHEN 'A' THEN 0.05 WHEN 'B' THEN -0.05 ELSE 0 END
               + CASE a.program_id WHEN 1 THEN 0.05 WHEN 2 THEN 0.01
                                   WHEN 3 THEN -0.03 WHEN 4 THEN -0.06 ELSE 0 END
               + CASE (c.course_id % 5) WHEN 0 THEN -0.10 WHEN 1 THEN -0.05
                                        WHEN 2 THEN 0.0 WHEN 3 THEN 0.03 ELSE 0.06 END
               + (random() * 0.10 - 0.05) AS raw_pct
        FROM _ability a
        JOIN courses c ON c.program_id = a.program_id
        JOIN semesters sm ON sm.semester_id = c.semester_id
                         AND sm.semester_number = a.current_semester
        JOIN exams ex ON ex.course_id = c.course_id
    ) x
) y;

DROP TABLE _ability;

-- Exams that now have marks are Completed (migration 011 ran before this data).
UPDATE exams e SET status = 'Completed'
WHERE EXISTS (SELECT 1 FROM marks m WHERE m.exam_id = e.exam_id);

-- ---------- Attendance (current + historical) ----------
-- One stable attendance profile per student drives every semester, so a
-- student's attendance tendency is consistent across their whole B.Tech:
--   at-risk students (student_id % 15 = 0): ~55-72% present (below 75%)
--   everyone else                          : ~82-96% present
-- Non-present days: ~80% Absent / ~20% Late. Overall ~87% Present /
-- ~10% Absent / ~2.5% Late, with ~53 students below the 75% threshold.
-- NB: a plain TEMP TABLE (no ON COMMIT DROP) is used so the profile
-- survives psql's per-statement autocommit; it is dropped explicitly below.
CREATE TEMP TABLE _prof AS
SELECT s.student_id, s.program_id, s.current_semester, ay.start_year,
       CASE WHEN s.student_id % 15 = 0 THEN 0.55 + random() * 0.17
            ELSE 0.82 + random() * 0.14 END AS present_prob
FROM students s
JOIN academic_years ay ON ay.academic_year_id = s.academic_year_id
WHERE (s.status = 'Active' OR s.status IS NULL) AND s.current_semester IS NOT NULL;

-- Current semester: ~24 weekday class days up to 2026-07-02 (dense, recent).
INSERT INTO attendance (student_id, course_id, class_date, status)
SELECT t.student_id, t.course_id, t.class_date,
       CASE WHEN t.r < t.present_prob THEN 'Present'
            WHEN t.r < t.present_prob + (1 - t.present_prob) * 0.80 THEN 'Absent'
            ELSE 'Late' END
FROM (
    SELECT p.student_id, c.course_id, d.class_date, p.present_prob, random() AS r
    FROM _prof p
    JOIN semesters sm ON sm.semester_number = p.current_semester
    JOIN courses c ON c.semester_id = sm.semester_id AND c.program_id = p.program_id
    CROSS JOIN (
        SELECT gd::date AS class_date
        FROM generate_series(DATE '2026-06-01', DATE '2026-07-02', INTERVAL '1 day') g(gd)
        WHERE EXTRACT(dow FROM gd) BETWEEN 1 AND 5
    ) d
) t;

-- Historical past semesters: ~11 weekdays each, in the term's real window
--   Monsoon (odd sem): Sep of (start_year + yearIndex)
--   Winter  (even sem): Mar of (start_year + yearIndex + 1)
INSERT INTO attendance (student_id, course_id, class_date, status)
SELECT t.student_id, t.course_id, t.class_date,
       CASE WHEN t.r < t.present_prob THEN 'Present'
            WHEN t.r < t.present_prob + (1 - t.present_prob) * 0.80 THEN 'Absent'
            ELSE 'Late' END
FROM (
    SELECT p.student_id, c.course_id, d.class_date, p.present_prob, random() AS r
    FROM _prof p
    JOIN semesters sm ON sm.semester_number < p.current_semester
    JOIN courses c ON c.semester_id = sm.semester_id AND c.program_id = p.program_id
    CROSS JOIN LATERAL (
        SELECT gd::date AS class_date
        FROM generate_series(
            CASE WHEN sm.semester_number % 2 = 1
                 THEN make_date(p.start_year + (sm.semester_number - 1) / 2, 9, 3)
                 ELSE make_date(p.start_year + (sm.semester_number - 1) / 2 + 1, 3, 3) END,
            (CASE WHEN sm.semester_number % 2 = 1
                  THEN make_date(p.start_year + (sm.semester_number - 1) / 2, 9, 3)
                  ELSE make_date(p.start_year + (sm.semester_number - 1) / 2 + 1, 3, 3) END) + 14,
            INTERVAL '1 day') g(gd)
        WHERE EXTRACT(dow FROM gd) BETWEEN 1 AND 5
    ) d
) t;

DROP TABLE _prof;

-- ---------- Enrollment completion status ----------
-- A student "Completed" a course if they passed its End-Sem exam (>= 40%) and
-- attended >= 75% of its classes; very low attendance -> 'Dropped'; else 'Ongoing'.
-- (Requires migration 009 which adds enrollments.status.)
WITH endsem AS (
    SELECT en.enrollment_id,
           (m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)) AS pct
    FROM enrollments en
    JOIN exams e ON e.course_id = en.course_id AND e.exam_type = 'End Sem'
    LEFT JOIN marks m ON m.exam_id = e.exam_id AND m.student_id = en.student_id
),
att AS (
    SELECT en.enrollment_id,
           100.0 * SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)
               / NULLIF(COUNT(a.attendance_id), 0) AS att_pct
    FROM enrollments en
    LEFT JOIN attendance a
        ON a.student_id = en.student_id AND a.course_id = en.course_id
    GROUP BY en.enrollment_id
)
UPDATE enrollments en
SET status = CASE
        WHEN COALESCE(endsem.pct, 0) >= 40 AND COALESCE(att.att_pct, 0) >= 75 THEN 'Completed'
        WHEN COALESCE(att.att_pct, 100) < 40 THEN 'Dropped'
        ELSE 'Ongoing'
    END
FROM endsem
JOIN att ON att.enrollment_id = endsem.enrollment_id
WHERE en.enrollment_id = endsem.enrollment_id;

-- ---------- Student competency scores (all 5 per student) ----------
-- Differentiated by competency so "weakest areas" has a clear answer:
-- Leadership and Communication are systematically weakest.
INSERT INTO student_competencies (student_id, competency_id, score)
SELECT s.student_id, comp.competency_id,
       CASE comp.competency_name
           WHEN 'Programming'     THEN 65 + floor(random() * 30)   -- ~65-94 strong
           WHEN 'Problem Solving' THEN 58 + floor(random() * 30)   -- ~58-87
           WHEN 'Team Work'       THEN 55 + floor(random() * 28)   -- ~55-82
           WHEN 'Communication'   THEN 45 + floor(random() * 28)   -- ~45-72 weak
           WHEN 'Leadership'      THEN 40 + floor(random() * 28)   -- ~40-67 weakest
           ELSE 50 + floor(random() * 40)
       END::int
FROM students s
CROSS JOIN competencies comp;

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

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

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

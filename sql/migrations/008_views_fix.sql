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

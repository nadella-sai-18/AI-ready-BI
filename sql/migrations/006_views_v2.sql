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

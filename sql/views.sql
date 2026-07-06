
-- =====================================================
-- 1. STUDENT PERFORMANCE LAYER (CORE AI ENTITY)
-- =====================================================
CREATE OR REPLACE VIEW v_student_performance AS
SELECT
    s.student_id,
    s.full_name,
    p.program_name,
    AVG(m.marks_obtained) AS avg_marks,
    COUNT(m.mark_id) AS total_exams,
    ROUND(
        COUNT(CASE WHEN a.status = 'Present' THEN 1 END) * 100.0
        / NULLIF(COUNT(a.attendance_id),0), 2
    ) AS attendance_percentage
FROM students s
LEFT JOIN programs p ON s.program_id = p.program_id
LEFT JOIN marks m ON s.student_id = m.student_id
LEFT JOIN attendance a ON s.student_id = a.student_id
GROUP BY s.student_id, s.full_name, p.program_name;


-- =====================================================
-- 2. AT-RISK STUDENTS (AI QUESTION READY)
-- =====================================================
CREATE OR REPLACE VIEW v_risk_students AS
SELECT *
FROM v_student_performance
WHERE avg_marks < 35 OR attendance_percentage < 75;


-- =====================================================
-- 3. COURSE PERFORMANCE KPI LAYER
-- =====================================================
CREATE OR REPLACE VIEW v_course_performance AS
SELECT
    c.course_id,
    c.course_name,
    p.program_name,
    AVG(m.marks_obtained) AS avg_score,
    COUNT(DISTINCT en.student_id) AS enrolled_students,
    ROUND(
        AVG(m.marks_obtained) / NULLIF(c.credits,0), 2
    ) AS normalized_score
FROM courses c
LEFT JOIN programs p ON c.program_id = p.program_id
LEFT JOIN enrollments en ON c.course_id = en.course_id
LEFT JOIN exams e ON c.course_id = e.course_id
LEFT JOIN marks m ON e.exam_id = m.exam_id
GROUP BY c.course_id, c.course_name, p.program_name, c.credits;


-- =====================================================
-- 4. PROGRAM PERFORMANCE TREND (BUSINESS KPI)
-- =====================================================
CREATE OR REPLACE VIEW v_program_performance AS
SELECT
    p.program_id,
    p.program_name,
    COUNT(DISTINCT s.student_id) AS total_students,
    ROUND(AVG(m.marks_obtained),2) AS avg_program_score
FROM programs p
LEFT JOIN students s ON p.program_id = s.program_id
LEFT JOIN marks m ON s.student_id = m.student_id
GROUP BY p.program_id, p.program_name;


-- =====================================================
-- 5. COMPETENCY WEAKNESS ANALYSIS (AI INSIGHT VIEW)
-- =====================================================
CREATE OR REPLACE VIEW v_competency_analysis AS
SELECT
    c.competency_name,
    ROUND(AVG(sc.score),2) AS avg_score,
    CASE
        WHEN AVG(sc.score) < 70 THEN 'Weak Area'
        WHEN AVG(sc.score) BETWEEN 70 AND 85 THEN 'Moderate'
        ELSE 'Strong'
    END AS competency_level
FROM competencies c
JOIN student_competencies sc
ON c.competency_id = sc.competency_id
GROUP BY c.competency_name;


-- =====================================================
-- 6. FACULTY PERFORMANCE VIEW (COMPARISON KPI)
-- =====================================================
CREATE OR REPLACE VIEW v_faculty_performance AS
SELECT
    f.faculty_id,
    f.full_name AS faculty_name,
    f.department,
    ROUND(AVG(m.marks_obtained),2) AS avg_student_score
FROM faculty f
LEFT JOIN courses c ON c.program_id = c.program_id
LEFT JOIN exams e ON c.course_id = e.course_id
LEFT JOIN marks m ON e.exam_id = m.exam_id
GROUP BY f.faculty_id, f.full_name, f.department;


-- =====================================================
-- 7. BUSINESS DASHBOARD KPI SUMMARY VIEW
-- =====================================================
CREATE OR REPLACE VIEW v_kpi_dashboard AS
SELECT
    (SELECT COUNT(*) FROM students) AS total_students,
    (SELECT COUNT(*) FROM courses) AS total_courses,
    (SELECT COUNT(*) FROM faculty) AS total_faculty,
    (SELECT ROUND(AVG(marks_obtained),2) FROM marks) AS overall_avg_marks,
    (SELECT COUNT(*) FROM v_risk_students) AS risk_students_count;

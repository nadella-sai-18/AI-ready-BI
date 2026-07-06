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

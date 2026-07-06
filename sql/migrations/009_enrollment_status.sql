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

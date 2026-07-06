-- Migration 003 — Course code + assigned faculty
-- ADDITIVE ONLY. Fixes the faculty<->course relationship that v_faculty_performance
-- needs (see views_v2 in migration 006).

ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_code VARCHAR(20);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS faculty_id INT
    REFERENCES faculty(faculty_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_courses_course_code
    ON courses (course_code) WHERE course_code IS NOT NULL;

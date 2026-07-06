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

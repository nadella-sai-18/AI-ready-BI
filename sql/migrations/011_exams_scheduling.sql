-- =====================================================================
-- Migration 011: exam scheduling + lifecycle columns
-- ---------------------------------------------------------------------
-- Adds operational metadata the ERP Exams module needs. Branch, semester,
-- term and faculty are NOT stored here — they are derived via the exam's
-- course (course -> program / semester / faculty), so nothing is
-- duplicated. Additive only; existing columns and data untouched.
-- Idempotent: safe to re-run.
-- =====================================================================

ALTER TABLE exams ADD COLUMN IF NOT EXISTS status       VARCHAR(15) DEFAULT 'Scheduled';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS start_time   TIME;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS end_time     TIME;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Backfill lifecycle status from reality: an exam that already has marks
-- entered is Completed; everything else is Scheduled.
UPDATE exams e
SET status = CASE
        WHEN EXISTS (SELECT 1 FROM marks m WHERE m.exam_id = e.exam_id) THEN 'Completed'
        ELSE 'Scheduled'
    END
WHERE status IS NULL OR status = 'Scheduled';

CREATE INDEX IF NOT EXISTS idx_exams_status ON exams (status);
CREATE INDEX IF NOT EXISTS idx_exams_course ON exams (course_id);

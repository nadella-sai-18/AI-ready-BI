-- =====================================================================
-- Migration 012: marks status + remarks
-- ---------------------------------------------------------------------
-- Adds an explicit attendance-in-exam status so an absent student is
-- distinct from a genuine zero, plus an optional remarks note.
-- Additive + idempotent. Existing marks are treated as 'Present'.
-- =====================================================================

ALTER TABLE marks ADD COLUMN IF NOT EXISTS status   VARCHAR(10) DEFAULT 'Present';
ALTER TABLE marks ADD COLUMN IF NOT EXISTS remarks  VARCHAR(200);

UPDATE marks SET status = 'Present' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_marks_exam    ON marks (exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks (student_id);

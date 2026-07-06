-- =====================================================================
-- Migration 016: collapse per-program semesters into 8 SHARED semesters
-- ---------------------------------------------------------------------
-- A semester is a college-wide academic cycle, not a per-branch record.
-- This merges the 32 rows (8 numbers x 4 programs) into 8 canonical rows,
-- remapping courses.semester_id (the ONLY FK into semesters) so nothing
-- is lost — courses keep their own program_id, and every exam / mark /
-- attendance row keys off course / semester_number, which are preserved.
-- Adds ERP columns: btech_year, academic_period, is_current, status.
-- Additive + idempotent-ish (safe to re-run: after collapse it's a no-op).
-- =====================================================================
BEGIN;

-- 1) New academic columns.
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS btech_year      INT;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS academic_period VARCHAR(30);
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS is_current      BOOLEAN DEFAULT false;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS status          VARCHAR(15) DEFAULT 'Upcoming';

-- 2) Point every course at the canonical (lowest-id) semester of its number.
WITH canon AS (
    SELECT semester_number, MIN(semester_id) AS keep_id
    FROM semesters GROUP BY semester_number
)
UPDATE courses c
SET semester_id = canon.keep_id
FROM semesters s, canon
WHERE c.semester_id = s.semester_id
  AND s.semester_number = canon.semester_number
  AND s.semester_id <> canon.keep_id;

-- 3) Drop the now-orphaned duplicate semester rows (24 of them).
DELETE FROM semesters
WHERE semester_id NOT IN (SELECT MIN(semester_id) FROM semesters GROUP BY semester_number);

-- 4) Make the surviving 8 rows shared + enriched.
UPDATE semesters SET
    program_id      = NULL,
    semester_name   = 'Semester ' || semester_number,
    term_type       = CASE WHEN semester_number % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END,
    btech_year      = (semester_number + 1) / 2,
    academic_period = CASE WHEN semester_number % 2 = 1 THEN 'Jul-Nov' ELSE 'Dec-Apr' END,
    status          = CASE
        WHEN semester_number IN (SELECT DISTINCT current_semester FROM students WHERE current_semester IS NOT NULL)
        THEN 'Active' ELSE 'Upcoming' END;

-- 5) Mark the final-year current Monsoon term (Semester 7) as the current
--    operational semester (exactly one). Admin can change this later.
UPDATE semesters SET is_current = (semester_number = 7);

COMMIT;

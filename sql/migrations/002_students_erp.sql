-- Migration 002 — Student ERP fields
-- ADDITIVE ONLY. Existing enrollment_year is reused as the admission year.

ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number VARCHAR(20);
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_number VARCHAR(15);
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year_id INT
    REFERENCES academic_years(academic_year_id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_year INT;      -- 1..4
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_semester INT;  -- 1..8
ALTER TABLE students ADD COLUMN IF NOT EXISTS section VARCHAR(2);     -- A/B/C/D
ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(15) DEFAULT 'Active';

-- Roll number should be unique when present (partial unique index allows NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS ux_students_roll_number
    ON students (roll_number) WHERE roll_number IS NOT NULL;

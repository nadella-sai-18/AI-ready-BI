-- Migration 001 — Academic years + semester term type
-- ADDITIVE ONLY. Does not modify or drop anything in schema.sql.

-- Academic years (e.g. 2023-2024 ... 2026-2027)
CREATE TABLE IF NOT EXISTS academic_years (
    academic_year_id SERIAL PRIMARY KEY,
    year_label VARCHAR(20) NOT NULL,
    start_year INT,
    end_year INT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_academic_years_label
    ON academic_years (year_label);

-- Monsoon / Winter term on each semester
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS term_type VARCHAR(10);

-- Backfill existing semester rows (odd = Monsoon, even = Winter). Only updates
-- rows where term_type is still NULL; adds no new rows.
UPDATE semesters
SET term_type = CASE WHEN semester_number % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END
WHERE term_type IS NULL AND semester_number IS NOT NULL;

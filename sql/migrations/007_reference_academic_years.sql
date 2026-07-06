-- Migration 007 — Reference academic years (structural, from the spec).
-- These are the fixed academic years listed in the requirements, NOT dummy
-- student/marks data. Idempotent: inserts each label only if missing.

INSERT INTO academic_years (year_label, start_year, end_year)
SELECT v.year_label, v.start_year, v.end_year
FROM (VALUES
    ('2023-2024', 2023, 2024),
    ('2024-2025', 2024, 2025),
    ('2025-2026', 2025, 2026),
    ('2026-2027', 2026, 2027)
) AS v(year_label, start_year, end_year)
WHERE NOT EXISTS (
    SELECT 1 FROM academic_years a WHERE a.year_label = v.year_label
);

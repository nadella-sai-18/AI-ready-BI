-- =====================================================================
-- Migration 018: ensure v_competency_analysis exists in the migration chain
-- ---------------------------------------------------------------------
-- This view is used by the Dashboard (/dashboard/competency-analysis) but
-- was only defined in sql/views.sql, so a fresh build from schema+migrations
-- alone was missing it. Re-declared here (idempotent) so deploy bundles and
-- fresh databases include it. Base tables only — safe to run anytime.
-- =====================================================================

CREATE OR REPLACE VIEW v_competency_analysis AS
SELECT
    c.competency_name,
    ROUND(AVG(sc.score), 2) AS avg_score,
    CASE
        WHEN AVG(sc.score) < 70 THEN 'Weak Area'
        WHEN AVG(sc.score) >= 70 AND AVG(sc.score) <= 85 THEN 'Moderate'
        ELSE 'Strong'
    END AS competency_level
FROM competencies c
JOIN student_competencies sc ON c.competency_id = sc.competency_id
GROUP BY c.competency_name;

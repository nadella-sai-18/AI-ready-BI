-- Migration 004 — Exam type + weightage
-- ADDITIVE ONLY. exam_type standardizes: Internal 1, Internal 2, Mid Sem, End Sem.
-- weightage (%) supports total/percentage/grade computation.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS weightage INT;

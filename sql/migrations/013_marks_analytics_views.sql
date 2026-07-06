-- =====================================================================
-- Migration 013: marks analytics semantic views (Metabase / MinusX)
-- ---------------------------------------------------------------------
-- A wide, denormalized fact view (v_marks_detail) plus rollups by student,
-- section, branch and subject. These make section/branch/subject/at-risk
-- questions answerable directly, without joins, in Metabase / MinusX.
-- Additive + idempotent (CREATE OR REPLACE). No tables changed.
-- Pass threshold = 40%. Absent marks are excluded from averages but counted.
-- =====================================================================

-- 1) Wide fact view: one row per mark with every dimension resolved.
CREATE OR REPLACE VIEW v_marks_detail AS
SELECT
    m.mark_id,
    m.marks_obtained,
    m.status,
    (m.status = 'Absent')                                   AS is_absent,
    m.remarks,
    st.student_id,
    st.full_name                                            AS student_name,
    st.roll_number,
    st.section,
    st.program_id,
    p.program_name                                          AS branch,
    st.academic_year_id,
    ay.year_label,
    sm.semester_number,
    ((sm.semester_number + 1) / 2)                          AS btech_year,
    CASE WHEN sm.semester_number % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END AS term,
    ex.exam_id,
    ex.exam_name,
    ex.exam_type,
    ex.exam_date,
    ex.max_marks,
    c.course_id,
    c.course_name                                           AS subject,
    c.course_code,
    f.full_name                                             AS faculty_name,
    CASE WHEN m.status = 'Present' AND ex.max_marks > 0
         THEN ROUND(m.marks_obtained * 100.0 / ex.max_marks, 2) END AS percentage,
    (m.status = 'Present' AND ex.max_marks > 0
        AND m.marks_obtained * 100.0 / ex.max_marks >= 40)  AS passed
FROM marks m
JOIN students st  ON st.student_id = m.student_id
JOIN exams ex     ON ex.exam_id = m.exam_id
JOIN courses c    ON c.course_id = ex.course_id
JOIN semesters sm ON sm.semester_id = c.semester_id
LEFT JOIN programs p        ON p.program_id = st.program_id
LEFT JOIN academic_years ay ON ay.academic_year_id = st.academic_year_id
LEFT JOIN faculty f         ON f.faculty_id = c.faculty_id;

-- 2) Per-student performance (with at-risk flag).
CREATE OR REPLACE VIEW v_marks_student_performance AS
SELECT
    student_id, student_name, roll_number, section, branch, program_id,
    btech_year, semester_number, term, year_label,
    COUNT(*)                                        AS total_exams,
    COUNT(*) FILTER (WHERE is_absent)               AS absent_count,
    COUNT(*) FILTER (WHERE NOT is_absent)           AS appeared,
    ROUND(AVG(percentage), 1)                       AS avg_percentage,
    COUNT(*) FILTER (WHERE passed)                  AS pass_count,
    COUNT(*) FILTER (WHERE NOT passed AND NOT is_absent) AS fail_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage,
    (AVG(percentage) < 40)                          AS at_risk
FROM v_marks_detail
GROUP BY student_id, student_name, roll_number, section, branch, program_id,
         btech_year, semester_number, term, year_label;

-- 3) Section-wise performance (branch + semester + section).
CREATE OR REPLACE VIEW v_marks_section_performance AS
SELECT
    branch, program_id, btech_year, semester_number, term, section,
    COUNT(DISTINCT student_id)                      AS students,
    COUNT(*) FILTER (WHERE NOT is_absent)           AS appeared,
    ROUND(AVG(percentage), 1)                       AS avg_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage,
    COUNT(*) FILTER (WHERE is_absent)               AS absent_count
FROM v_marks_detail
GROUP BY branch, program_id, btech_year, semester_number, term, section;

-- 4) Branch-wise performance (branch + semester).
CREATE OR REPLACE VIEW v_marks_branch_performance AS
SELECT
    branch, program_id, btech_year, semester_number, term,
    COUNT(DISTINCT student_id)                      AS students,
    ROUND(AVG(percentage), 1)                       AS avg_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage,
    COUNT(*) FILTER (WHERE is_absent)               AS absent_count
FROM v_marks_detail
GROUP BY branch, program_id, btech_year, semester_number, term;

-- 5) Subject-wise performance (with failure rate).
CREATE OR REPLACE VIEW v_marks_subject_performance AS
SELECT
    subject, course_id, course_code, branch, program_id, semester_number, term,
    COUNT(*) FILTER (WHERE NOT is_absent)           AS appeared,
    ROUND(AVG(percentage), 1)                       AS avg_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE NOT passed AND NOT is_absent)
          / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS fail_percentage,
    COUNT(*) FILTER (WHERE is_absent)               AS absent_count
FROM v_marks_detail
GROUP BY subject, course_id, course_code, branch, program_id, semester_number, term;

-- 6) Current-semester marks (each mark whose exam semester = the student's
--    current semester) -- the default lens for "current" questions.
CREATE OR REPLACE VIEW v_current_semester_marks AS
SELECT d.*
FROM v_marks_detail d
JOIN students s ON s.student_id = d.student_id
WHERE d.semester_number = s.current_semester;

-- 7) At-risk students (by marks): low average, repeated failures, or absences.
CREATE OR REPLACE VIEW v_marks_at_risk AS
SELECT *
FROM v_marks_student_performance
WHERE at_risk OR avg_percentage < 45 OR fail_count >= 4 OR absent_count >= 3;

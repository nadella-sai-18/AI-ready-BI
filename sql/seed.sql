-- =====================================================================
-- B.Tech College ERP — realistic seed data
-- =====================================================================
-- Generates ~800 students across 4 branches (CSE/ECE/Civil/Mech) x
-- 4 academic years (50 per branch per year), plus faculty, courses,
-- exams, marks, attendance and competency scores.
--
-- RUN ORDER on a fresh database:
--   1) sql/schema.sql
--   2) sql/migrations/*.sql   (adds ERP columns/tables this seed relies on)
--   3) sql/seed.sql           (this file)
--
-- This file is re-runnable: it TRUNCATEs all tables first, then reloads.
-- =====================================================================

TRUNCATE TABLE
    student_competencies, marks, attendance, enrollments, exams,
    courses, students, semesters, faculty, competencies,
    academic_years, programs
RESTART IDENTITY CASCADE;

-- ---------- Programs (branches) ----------
INSERT INTO programs (program_name, duration_years) VALUES
    ('Computer Science Engineering', 4),
    ('Electronics & Communication Engineering', 4),
    ('Civil Engineering', 4),
    ('Mechanical Engineering', 4);

-- ---------- Academic years ----------
INSERT INTO academic_years (year_label, start_year, end_year) VALUES
    ('2023-2024', 2023, 2024),
    ('2024-2025', 2024, 2025),
    ('2025-2026', 2025, 2026),
    ('2026-2027', 2026, 2027);

-- ---------- Faculty (5 per department) ----------
INSERT INTO faculty (full_name, email, department)
SELECT 'Prof ' || d.abbr || ' ' || n,
       lower(d.abbr) || n || '@college.edu',
       d.pname
FROM (VALUES
    ('CSE', 'Computer Science Engineering'),
    ('ECE', 'Electronics & Communication Engineering'),
    ('CIV', 'Civil Engineering'),
    ('MEC', 'Mechanical Engineering')
) d(abbr, pname)
CROSS JOIN generate_series(1, 5) n;

-- ---------- Semesters (8 SHARED across all programs — migration 016) ----------
-- A semester is a college-wide academic cycle; programs relate through courses.
INSERT INTO semesters (semester_name, semester_number, term_type, btech_year, academic_period, status, is_current)
SELECT 'Semester ' || s,
       s,
       CASE WHEN s % 2 = 1 THEN 'Monsoon' ELSE 'Winter' END,
       (s + 1) / 2,
       CASE WHEN s % 2 = 1 THEN 'Jul-Nov' ELSE 'Dec-Apr' END,
       CASE WHEN s % 2 = 1 THEN 'Active' ELSE 'Upcoming' END,   -- odd = current Monsoon
       (s = 7)                                                   -- final-year current sem
FROM generate_series(1, 8) s;

-- ---------- Courses (4 per semester per program, with assigned faculty) ----------
WITH fac AS (
    SELECT faculty_id, department,
           row_number() OVER (PARTITION BY department ORDER BY faculty_id) AS rn
    FROM faculty
)
INSERT INTO courses (program_id, semester_id, course_name, credits, course_code, faculty_id)
SELECT p.program_id,
       sem.semester_id,
       CASE d.abbr
           WHEN 'CSE' THEN (ARRAY[
               'Engineering Mathematics I','Programming in C','Physics for Computing','Basic Electrical Engineering',
               'Engineering Mathematics II','Data Structures','Digital Logic Design','Discrete Mathematics',
               'Object Oriented Programming','Computer Organization','Database Management Systems','Operating Systems',
               'Design and Analysis of Algorithms','Computer Networks','Theory of Computation','Microprocessors',
               'Software Engineering','Compiler Design','Web Technologies','Artificial Intelligence',
               'Machine Learning','Cloud Computing','Information Security','Data Mining',
               'Deep Learning','Big Data Analytics','Internet of Things','Distributed Systems',
               'Natural Language Processing','Blockchain Technology','DevOps Engineering','Capstone Project'
           ])[(sem.semester_number - 1) * 4 + c]
           WHEN 'ECE' THEN (ARRAY[
               'Engineering Mathematics I','Physics for Electronics','Basic Electrical Engineering','Programming Fundamentals',
               'Engineering Mathematics II','Electronic Devices and Circuits','Network Theory','Signals and Systems',
               'Analog Electronics','Digital Electronics','Electromagnetic Theory','Control Systems',
               'Communication Systems','Microcontrollers','Linear Integrated Circuits','Random Processes',
               'Digital Signal Processing','VLSI Design','Antennas and Wave Propagation','Microwave Engineering',
               'Embedded Systems','Optical Communication','Wireless Communication','Digital Image Processing',
               'Satellite Communication','RF Circuit Design','Radar Systems','Nanoelectronics',
               'IoT and Sensors','5G Networks','Biomedical Electronics','Capstone Project'
           ])[(sem.semester_number - 1) * 4 + c]
           WHEN 'CIV' THEN (ARRAY[
               'Engineering Mathematics I','Engineering Physics','Engineering Chemistry','Engineering Mechanics',
               'Engineering Mathematics II','Building Materials','Surveying I','Fluid Mechanics',
               'Strength of Materials','Surveying II','Concrete Technology','Soil Mechanics',
               'Structural Analysis I','Hydraulics','Transportation Engineering I','Geotechnical Engineering',
               'Structural Analysis II','Design of RC Structures','Water Resources Engineering','Environmental Engineering I',
               'Design of Steel Structures','Foundation Engineering','Transportation Engineering II','Environmental Engineering II',
               'Construction Management','Estimation and Costing','Earthquake Engineering','Bridge Engineering',
               'Advanced Structural Design','Remote Sensing and GIS','Pavement Design','Capstone Project'
           ])[(sem.semester_number - 1) * 4 + c]
           ELSE (ARRAY[
               'Engineering Mathematics I','Engineering Physics','Engineering Chemistry','Engineering Graphics',
               'Engineering Mathematics II','Engineering Mechanics','Thermodynamics','Material Science',
               'Strength of Materials','Fluid Mechanics','Manufacturing Processes','Machine Drawing',
               'Kinematics of Machinery','Applied Thermodynamics','Metrology and Measurements','Engineering Metallurgy',
               'Dynamics of Machinery','Heat and Mass Transfer','Design of Machine Elements','Manufacturing Technology',
               'Internal Combustion Engines','Refrigeration and Air Conditioning','Automobile Engineering','Finite Element Analysis',
               'Mechatronics','Power Plant Engineering','Robotics','Computer Aided Manufacturing',
               'Automation and Control','Renewable Energy Systems','Industrial Engineering','Capstone Project'
           ])[(sem.semester_number - 1) * 4 + c]
       END,
       3 + (c % 2),
       d.abbr || (sem.semester_number * 10 + c),
       f.faculty_id
FROM programs p
JOIN (VALUES
    ('Computer Science Engineering', 'CSE'),
    ('Electronics & Communication Engineering', 'ECE'),
    ('Civil Engineering', 'CIV'),
    ('Mechanical Engineering', 'MEC')
) d(pname, abbr) ON d.pname = p.program_name
CROSS JOIN semesters sem                                    -- 8 shared semesters
CROSS JOIN generate_series(1, 4) c
JOIN fac f ON f.department = p.program_name AND f.rn = ((c - 1) % 5) + 1;

-- ---------- Competencies ----------
INSERT INTO competencies (competency_name, description) VALUES
    ('Programming', 'Coding and software development skill'),
    ('Communication', 'Verbal and written communication'),
    ('Problem Solving', 'Analytical and logical reasoning'),
    ('Team Work', 'Collaboration in teams'),
    ('Leadership', 'Leading and coordinating teams');

-- ---------- Students (50 per branch per academic year = 800) ----------
INSERT INTO students (
    program_id, academic_year_id, full_name, email, roll_number,
    gender, current_year, current_semester, section, enrollment_year, status
)
SELECT
    b.program_id,
    b.academic_year_id,
    (ARRAY['Aarav','Vivaan','Aditya','Arjun','Sai','Reyansh','Krishna','Ishaan',
           'Rohan','Kabir','Ananya','Diya','Aadhya','Saanvi','Isha','Kavya',
           'Riya','Priya','Neha','Meera'])[1 + ((b.rn - 1) % 20)]
      || ' ' ||
    (ARRAY['Sharma','Verma','Reddy','Nair','Iyer','Gupta','Patel','Rao','Kumar',
           'Singh','Das','Bose','Menon','Pillai','Chowdhury'])[1 + ((b.rn - 1) % 15)],
    lower(b.abbr) || b.start_year || lpad(b.n::text, 3, '0') || '@college.edu',
    b.abbr || b.start_year || lpad(b.n::text, 3, '0'),
    CASE WHEN b.n % 2 = 0 THEN 'Male' ELSE 'Female' END,
    -- Study year derived from the admission batch relative to the latest
    -- academic year: joined 2023 -> Year 4 in 2026-2027, etc. A whole batch
    -- shares the same year (real B.Tech progression).
    GREATEST(1, LEAST(4, b.max_start - b.start_year + 1)),
    GREATEST(1, LEAST(4, b.max_start - b.start_year + 1)) * 2 - 1,
    CASE WHEN b.n <= 25 THEN 'A' ELSE 'B' END,
    b.start_year,
    'Active'
FROM (
    SELECT p.program_id, d.abbr, ay.academic_year_id, ay.start_year, n,
           (SELECT MAX(start_year) FROM academic_years) AS max_start,
           row_number() OVER (ORDER BY p.program_id, ay.start_year, n) AS rn
    FROM programs p
    JOIN (VALUES
        ('Computer Science Engineering', 'CSE'),
        ('Electronics & Communication Engineering', 'ECE'),
        ('Civil Engineering', 'CIV'),
        ('Mechanical Engineering', 'MEC')
    ) d(pname, abbr) ON d.pname = p.program_name
    CROSS JOIN academic_years ay
    CROSS JOIN generate_series(1, 50) n
) b;

-- ---------- Enrollments (each student -> the 4 courses of their current semester) ----------
INSERT INTO enrollments (student_id, course_id, enrollment_date)
SELECT s.student_id, c.course_id, make_date(s.enrollment_year, 8, 1)
FROM students s
JOIN semesters sem ON sem.semester_number = s.current_semester
JOIN courses c ON c.semester_id = sem.semester_id AND c.program_id = s.program_id;

-- ---------- Exams (4 per course) ----------
INSERT INTO exams (course_id, exam_name, exam_type, exam_date, max_marks, weightage)
SELECT c.course_id, t.nm, t.nm, make_date(2025, t.mon, 15), t.mx, t.wt
FROM courses c
CROSS JOIN (VALUES
    ('Internal 1', 9, 20, 10),
    ('Internal 2', 10, 20, 10),
    ('Mid Sem', 11, 50, 30),
    ('End Sem', 12, 100, 50)
) t(nm, mon, mx, wt);

-- ---------- Marks (realistic, differentiated by student / section / branch / subject) ----------
-- Per-student ability is stable across their exams; deterministic modifiers add
-- real structure so analytics show genuine differences:
--   Section A > Section B (B is the weaker section)
--   CSE > ECE > Civil > Mech (Mech weakest branch)
--   subjects vary easy<->hard by course_id
-- Weak students (student_id % 15 = 0) score 18-38% (fail); a few (student, exam)
-- pairs are Absent. Requires migration 012 (marks.status).
CREATE TEMP TABLE _ability AS
SELECT s.student_id, s.program_id, s.section, s.current_semester,
       CASE WHEN s.student_id % 15 = 0 THEN 0.18 + random() * 0.20
            ELSE 0.52 + random() * 0.38 END AS base,
       CASE WHEN s.student_id % 15 = 0 THEN 0.08 ELSE 0.03 END AS absent_prob
FROM students s
WHERE (s.status = 'Active' OR s.status IS NULL) AND s.current_semester IS NOT NULL;

INSERT INTO marks (student_id, exam_id, marks_obtained, status)
SELECT student_id, exam_id,
       CASE WHEN is_absent THEN NULL
            ELSE GREATEST(0, LEAST(max_marks, round(max_marks * final_pct)))::int END,
       CASE WHEN is_absent THEN 'Absent' ELSE 'Present' END
FROM (
    SELECT student_id, exam_id, max_marks, is_absent,
           LEAST(0.99, GREATEST(0.03, raw_pct)) AS final_pct
    FROM (
        SELECT a.student_id, ex.exam_id, ex.max_marks,
               (random() < a.absent_prob) AS is_absent,
               a.base
               + CASE a.section WHEN 'A' THEN 0.05 WHEN 'B' THEN -0.05 ELSE 0 END
               + CASE a.program_id WHEN 1 THEN 0.05 WHEN 2 THEN 0.01
                                   WHEN 3 THEN -0.03 WHEN 4 THEN -0.06 ELSE 0 END
               + CASE (c.course_id % 5) WHEN 0 THEN -0.10 WHEN 1 THEN -0.05
                                        WHEN 2 THEN 0.0 WHEN 3 THEN 0.03 ELSE 0.06 END
               + (random() * 0.10 - 0.05) AS raw_pct
        FROM _ability a
        JOIN courses c ON c.program_id = a.program_id
        JOIN semesters sm ON sm.semester_id = c.semester_id
                         AND sm.semester_number = a.current_semester
        JOIN exams ex ON ex.course_id = c.course_id
    ) x
) y;

DROP TABLE _ability;

-- Exams that now have marks are Completed (migration 011 ran before this data).
UPDATE exams e SET status = 'Completed'
WHERE EXISTS (SELECT 1 FROM marks m WHERE m.exam_id = e.exam_id);

-- ---------- Attendance (current + historical) ----------
-- One stable attendance profile per student drives every semester, so a
-- student's attendance tendency is consistent across their whole B.Tech:
--   at-risk students (student_id % 15 = 0): ~55-72% present (below 75%)
--   everyone else                          : ~82-96% present
-- Non-present days: ~80% Absent / ~20% Late. Overall ~87% Present /
-- ~10% Absent / ~2.5% Late, with ~53 students below the 75% threshold.
-- NB: a plain TEMP TABLE (no ON COMMIT DROP) is used so the profile
-- survives psql's per-statement autocommit; it is dropped explicitly below.
CREATE TEMP TABLE _prof AS
SELECT s.student_id, s.program_id, s.current_semester, ay.start_year,
       CASE WHEN s.student_id % 15 = 0 THEN 0.55 + random() * 0.17
            ELSE 0.82 + random() * 0.14 END AS present_prob
FROM students s
JOIN academic_years ay ON ay.academic_year_id = s.academic_year_id
WHERE (s.status = 'Active' OR s.status IS NULL) AND s.current_semester IS NOT NULL;

-- Current semester: ~24 weekday class days up to 2026-07-02 (dense, recent).
INSERT INTO attendance (student_id, course_id, class_date, status)
SELECT t.student_id, t.course_id, t.class_date,
       CASE WHEN t.r < t.present_prob THEN 'Present'
            WHEN t.r < t.present_prob + (1 - t.present_prob) * 0.80 THEN 'Absent'
            ELSE 'Late' END
FROM (
    SELECT p.student_id, c.course_id, d.class_date, p.present_prob, random() AS r
    FROM _prof p
    JOIN semesters sm ON sm.semester_number = p.current_semester
    JOIN courses c ON c.semester_id = sm.semester_id AND c.program_id = p.program_id
    CROSS JOIN (
        SELECT gd::date AS class_date
        FROM generate_series(DATE '2026-06-01', DATE '2026-07-02', INTERVAL '1 day') g(gd)
        WHERE EXTRACT(dow FROM gd) BETWEEN 1 AND 5
    ) d
) t;

-- Historical past semesters: ~11 weekdays each, in the term's real window
--   Monsoon (odd sem): Sep of (start_year + yearIndex)
--   Winter  (even sem): Mar of (start_year + yearIndex + 1)
INSERT INTO attendance (student_id, course_id, class_date, status)
SELECT t.student_id, t.course_id, t.class_date,
       CASE WHEN t.r < t.present_prob THEN 'Present'
            WHEN t.r < t.present_prob + (1 - t.present_prob) * 0.80 THEN 'Absent'
            ELSE 'Late' END
FROM (
    SELECT p.student_id, c.course_id, d.class_date, p.present_prob, random() AS r
    FROM _prof p
    JOIN semesters sm ON sm.semester_number < p.current_semester
    JOIN courses c ON c.semester_id = sm.semester_id AND c.program_id = p.program_id
    CROSS JOIN LATERAL (
        SELECT gd::date AS class_date
        FROM generate_series(
            CASE WHEN sm.semester_number % 2 = 1
                 THEN make_date(p.start_year + (sm.semester_number - 1) / 2, 9, 3)
                 ELSE make_date(p.start_year + (sm.semester_number - 1) / 2 + 1, 3, 3) END,
            (CASE WHEN sm.semester_number % 2 = 1
                  THEN make_date(p.start_year + (sm.semester_number - 1) / 2, 9, 3)
                  ELSE make_date(p.start_year + (sm.semester_number - 1) / 2 + 1, 3, 3) END) + 14,
            INTERVAL '1 day') g(gd)
        WHERE EXTRACT(dow FROM gd) BETWEEN 1 AND 5
    ) d
) t;

DROP TABLE _prof;

-- ---------- Enrollment completion status ----------
-- A student "Completed" a course if they passed its End-Sem exam (>= 40%) and
-- attended >= 75% of its classes; very low attendance -> 'Dropped'; else 'Ongoing'.
-- (Requires migration 009 which adds enrollments.status.)
WITH endsem AS (
    SELECT en.enrollment_id,
           (m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)) AS pct
    FROM enrollments en
    JOIN exams e ON e.course_id = en.course_id AND e.exam_type = 'End Sem'
    LEFT JOIN marks m ON m.exam_id = e.exam_id AND m.student_id = en.student_id
),
att AS (
    SELECT en.enrollment_id,
           100.0 * SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)
               / NULLIF(COUNT(a.attendance_id), 0) AS att_pct
    FROM enrollments en
    LEFT JOIN attendance a
        ON a.student_id = en.student_id AND a.course_id = en.course_id
    GROUP BY en.enrollment_id
)
UPDATE enrollments en
SET status = CASE
        WHEN COALESCE(endsem.pct, 0) >= 40 AND COALESCE(att.att_pct, 0) >= 75 THEN 'Completed'
        WHEN COALESCE(att.att_pct, 100) < 40 THEN 'Dropped'
        ELSE 'Ongoing'
    END
FROM endsem
JOIN att ON att.enrollment_id = endsem.enrollment_id
WHERE en.enrollment_id = endsem.enrollment_id;

-- ---------- Student competency scores (all 5 per student) ----------
-- Differentiated by competency so "weakest areas" has a clear answer:
-- Leadership and Communication are systematically weakest.
INSERT INTO student_competencies (student_id, competency_id, score)
SELECT s.student_id, comp.competency_id,
       CASE comp.competency_name
           WHEN 'Programming'     THEN 65 + floor(random() * 30)   -- ~65-94 strong
           WHEN 'Problem Solving' THEN 58 + floor(random() * 30)   -- ~58-87
           WHEN 'Team Work'       THEN 55 + floor(random() * 28)   -- ~55-82
           WHEN 'Communication'   THEN 45 + floor(random() * 28)   -- ~45-72 weak
           WHEN 'Leadership'      THEN 40 + floor(random() * 28)   -- ~40-67 weakest
           ELSE 50 + floor(random() * 40)
       END::int
FROM students s
CROSS JOIN competencies comp;

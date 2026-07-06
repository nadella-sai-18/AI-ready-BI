CREATE TABLE programs (
    program_id SERIAL PRIMARY KEY,
    program_name VARCHAR(100),
    duration_years INT
);

CREATE TABLE semesters (
    semester_id SERIAL PRIMARY KEY,
    program_id INT REFERENCES programs(program_id),
    semester_name VARCHAR(50),
    semester_number INT
);

CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    program_id INT REFERENCES programs(program_id),
    full_name VARCHAR(100),
    email VARCHAR(100),
    enrollment_year INT
);

CREATE TABLE faculty (
    faculty_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100),
    email VARCHAR(100),
    department VARCHAR(100)
);

CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    program_id INT REFERENCES programs(program_id),
    semester_id INT REFERENCES semesters(semester_id),
    course_name VARCHAR(100),
    credits INT
);

CREATE TABLE enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    course_id INT REFERENCES courses(course_id),
    enrollment_date DATE
);

CREATE TABLE attendance (
    attendance_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    course_id INT REFERENCES courses(course_id),
    class_date DATE,
    status VARCHAR(20)
);

CREATE TABLE exams (
    exam_id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(course_id),
    exam_name VARCHAR(50),
    exam_date DATE,
    max_marks INT
);

CREATE TABLE marks (
    mark_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    exam_id INT REFERENCES exams(exam_id),
    marks_obtained INT
);

CREATE TABLE competencies (
    competency_id SERIAL PRIMARY KEY,
    competency_name VARCHAR(100),
    description TEXT
);

CREATE TABLE student_competencies (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id),
    competency_id INT REFERENCES competencies(competency_id),
    score INT
);
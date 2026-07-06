from sqlalchemy import Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Enrollment(Base):
    """Maps to the EXISTING `enrollments` table defined in sql/schema.sql.

    Columns mirror the schema exactly:
        enrollment_id   SERIAL PRIMARY KEY
        student_id      INT REFERENCES students(student_id)
        course_id       INT REFERENCES courses(course_id)
        enrollment_date DATE
    """

    __tablename__ = "enrollments"

    enrollment_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=True)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=True)
    enrollment_date = Column(Date, nullable=True)
    status = Column(String(15), nullable=True)  # Completed / Ongoing / Dropped (migration 009)

    # Read-only relationships used to enrich responses (no cascade / writes).
    student = relationship("Student", lazy="joined")
    course = relationship("Course", lazy="joined")

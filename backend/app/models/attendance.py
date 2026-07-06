from sqlalchemy import Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Attendance(Base):
    """Maps to the EXISTING `attendance` table defined in sql/schema.sql.

    Columns mirror the schema exactly:
        attendance_id SERIAL PRIMARY KEY
        student_id    INT REFERENCES students(student_id)
        course_id     INT REFERENCES courses(course_id)
        class_date    DATE
        status        VARCHAR(20)
    """

    __tablename__ = "attendance"

    attendance_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=True)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=True)
    class_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=True)

    # Read-only relationships used to enrich responses (no cascade / writes).
    student = relationship("Student", lazy="joined")
    course = relationship("Course", lazy="joined")

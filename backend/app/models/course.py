from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Course(Base):
    """Maps to the `courses` table (base columns from sql/schema.sql +
    course_code / faculty_id from sql/migrations/003_courses_faculty.sql).
    """

    __tablename__ = "courses"

    course_id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("programs.program_id"), nullable=True)
    semester_id = Column(Integer, ForeignKey("semesters.semester_id"), nullable=True)
    course_name = Column(String(100), nullable=True)
    credits = Column(Integer, nullable=True)

    # --- additive ---
    course_code = Column(String(20), nullable=True)
    faculty_id = Column(Integer, ForeignKey("faculty.faculty_id"), nullable=True)

    # Read-only relationships used to enrich responses (no cascade / writes).
    program = relationship("Program", lazy="joined")
    semester = relationship("Semester", lazy="joined")
    faculty = relationship("Faculty", lazy="joined")

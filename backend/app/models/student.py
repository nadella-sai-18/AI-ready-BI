from sqlalchemy import Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Student(Base):
    """Maps to the `students` table (base columns from sql/schema.sql +
    additive ERP columns from sql/migrations/002_students_erp.sql).
    """

    __tablename__ = "students"

    student_id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("programs.program_id"), nullable=True)
    full_name = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    enrollment_year = Column(Integer, nullable=True)  # admission year

    # --- ERP fields (additive migration) ---
    roll_number = Column(String(20), nullable=True)
    phone_number = Column(String(15), nullable=True)
    gender = Column(String(10), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    academic_year_id = Column(
        Integer, ForeignKey("academic_years.academic_year_id"), nullable=True
    )
    current_year = Column(Integer, nullable=True)      # 1..4
    current_semester = Column(Integer, nullable=True)  # 1..8
    section = Column(String(2), nullable=True)          # A/B/C/D
    status = Column(String(15), nullable=True)          # Active/Graduated/Discontinued

    program = relationship("Program", lazy="joined")
    academic_year = relationship("AcademicYear", lazy="joined")

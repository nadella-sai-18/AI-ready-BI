from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Semester(Base):
    """Maps to the `semesters` table.

    As of migration 016 semesters are SHARED across all programs (8 rows,
    one per number) — `program_id` is retained (nullable, unused) for
    backward compatibility but is NULL. The program relationship lives on
    courses/students/exams, not here.
    """

    __tablename__ = "semesters"

    semester_id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("programs.program_id"), nullable=True)  # legacy, NULL
    semester_name = Column(String(50), nullable=True)
    semester_number = Column(Integer, nullable=True)
    term_type = Column(String(10), nullable=True)  # 'Monsoon' | 'Winter'

    # --- additive (migration 016): real B.Tech academic cycle ---
    btech_year = Column(Integer, nullable=True)        # 1..4
    academic_period = Column(String(30), nullable=True)  # e.g. 'Jul-Nov'
    is_current = Column(Boolean, nullable=True, default=False)
    status = Column(String(15), nullable=True)         # Active | Completed | Upcoming

    program = relationship("Program", lazy="joined")

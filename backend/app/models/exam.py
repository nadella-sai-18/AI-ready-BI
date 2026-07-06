from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import relationship

from app.database import Base


class Exam(Base):
    """Maps to the `exams` table (base columns from sql/schema.sql +
    exam_type / weightage from sql/migrations/004_exams_types.sql +
    status / times / instructions from sql/migrations/011_exams_scheduling.sql).
    """

    __tablename__ = "exams"

    exam_id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=True)
    exam_name = Column(String(50), nullable=True)
    exam_date = Column(Date, nullable=True)
    max_marks = Column(Integer, nullable=True)

    # --- additive (migration 004) ---
    exam_type = Column(String(20), nullable=True)  # Internal 1/2, Mid Sem, End Sem, Lab*, ...
    weightage = Column(Integer, nullable=True)     # percent contribution

    # --- additive (migration 011): scheduling + lifecycle ---
    status = Column(String(15), nullable=True)     # Scheduled | Completed | Cancelled
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    instructions = Column(Text, nullable=True)

    course = relationship("Course", lazy="joined")

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Mark(Base):
    """Maps to the EXISTING `marks` table defined in sql/schema.sql.

    Columns mirror the schema exactly:
        mark_id        SERIAL PRIMARY KEY
        student_id     INT REFERENCES students(student_id)
        exam_id        INT REFERENCES exams(exam_id)
        marks_obtained INT
    """

    __tablename__ = "marks"

    mark_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=True)
    exam_id = Column(Integer, ForeignKey("exams.exam_id"), nullable=True)
    marks_obtained = Column(Integer, nullable=True)

    # --- additive (migration 012): exam attendance status + note ---
    status = Column(String(10), nullable=True)   # Present | Absent
    remarks = Column(String(200), nullable=True)

    # Read-only relationships used to enrich responses (no cascade / writes).
    student = relationship("Student", lazy="joined")
    exam = relationship("Exam", lazy="joined")

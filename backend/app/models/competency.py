from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Competency(Base):
    """Maps to the EXISTING `competencies` table defined in sql/schema.sql.

    Columns mirror the schema exactly:
        competency_id   SERIAL PRIMARY KEY
        competency_name VARCHAR(100)
        description     TEXT
    """

    __tablename__ = "competencies"

    competency_id = Column(Integer, primary_key=True, index=True)
    competency_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)


class StudentCompetency(Base):
    """Maps to the EXISTING `student_competencies` table defined in sql/schema.sql.

    Columns mirror the schema exactly:
        id            SERIAL PRIMARY KEY
        student_id    INT REFERENCES students(student_id)
        competency_id INT REFERENCES competencies(competency_id)
        score         INT
    """

    __tablename__ = "student_competencies"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=True)
    competency_id = Column(Integer, ForeignKey("competencies.competency_id"), nullable=True)
    score = Column(Integer, nullable=True)

    # Read-only relationships used to enrich responses (no cascade / writes).
    student = relationship("Student", lazy="joined")
    competency = relationship("Competency", lazy="joined")

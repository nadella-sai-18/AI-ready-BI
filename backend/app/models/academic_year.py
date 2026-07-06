from sqlalchemy import Column, Integer, String

from app.database import Base


class AcademicYear(Base):
    """Maps to the `academic_years` table (sql/migrations/001)."""

    __tablename__ = "academic_years"

    academic_year_id = Column(Integer, primary_key=True, index=True)
    year_label = Column(String(20), nullable=False)  # e.g. '2024-2025'
    start_year = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)

from sqlalchemy import Column, Integer, String

from app.database import Base


class Faculty(Base):
    """Maps to the EXISTING `faculty` table defined in sql/schema.sql.

    Columns mirror the schema exactly:
        faculty_id  SERIAL PRIMARY KEY
        full_name   VARCHAR(100)
        email       VARCHAR(100)
        department  VARCHAR(100)
    """

    __tablename__ = "faculty"

    faculty_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)

from sqlalchemy import Column, Integer, String

from app.database import Base


class Program(Base):
    """Maps to the EXISTING `programs` table defined in sql/schema.sql.

    Defined here so the Course module can validate program_id foreign keys and
    enrich course responses with the program name. A dedicated Program CRUD
    module can be added in a later phase.
    """

    __tablename__ = "programs"

    program_id = Column(Integer, primary_key=True, index=True)
    program_name = Column(String(100), nullable=True)
    duration_years = Column(Integer, nullable=True)

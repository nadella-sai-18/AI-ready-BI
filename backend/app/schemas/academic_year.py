from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AcademicYearBase(BaseModel):
    year_label: str = Field(..., min_length=1, max_length=20, description="e.g. 2024-2025")
    start_year: Optional[int] = Field(None, ge=1900, le=2100)
    end_year: Optional[int] = Field(None, ge=1900, le=2100)


class AcademicYearCreate(AcademicYearBase):
    """Payload for creating an academic year."""


class AcademicYearUpdate(BaseModel):
    year_label: Optional[str] = Field(None, min_length=1, max_length=20)
    start_year: Optional[int] = Field(None, ge=1900, le=2100)
    end_year: Optional[int] = Field(None, ge=1900, le=2100)


class AcademicYearOut(AcademicYearBase):
    academic_year_id: int

    model_config = ConfigDict(from_attributes=True)

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.academics import btech_year_of, term_of

TermType = Literal["Monsoon", "Winter"]
SemesterStatus = Literal["Active", "Completed", "Upcoming"]


class SemesterBase(BaseModel):
    # Semesters are shared across programs — no program_id required.
    semester_number: int = Field(..., ge=1, le=8)
    semester_name: Optional[str] = Field(None, max_length=50)
    term_type: Optional[TermType] = None
    btech_year: Optional[int] = Field(None, ge=1, le=4)
    academic_period: Optional[str] = Field(None, max_length=30)
    is_current: Optional[bool] = False
    status: Optional[SemesterStatus] = "Upcoming"


class SemesterCreate(SemesterBase):
    """Payload for creating a semester (1-8, unique)."""


class SemesterUpdate(BaseModel):
    semester_number: Optional[int] = Field(None, ge=1, le=8)
    semester_name: Optional[str] = Field(None, max_length=50)
    term_type: Optional[TermType] = None
    btech_year: Optional[int] = Field(None, ge=1, le=4)
    academic_period: Optional[str] = Field(None, max_length=30)
    is_current: Optional[bool] = None
    status: Optional[SemesterStatus] = None


class SemesterOut(BaseModel):
    semester_id: int
    semester_number: Optional[int] = None
    semester_name: Optional[str] = None
    term_type: Optional[str] = None
    btech_year: Optional[int] = None
    academic_period: Optional[str] = None
    is_current: Optional[bool] = None
    status: Optional[str] = None
    # Computed context (filled by the service).
    active_students: Optional[int] = None
    courses_offered: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_semester(cls, s) -> "SemesterOut":
        num = s.semester_number
        return cls(
            semester_id=s.semester_id,
            semester_number=num,
            semester_name=s.semester_name or (f"Semester {num}" if num else None),
            term_type=s.term_type or (term_of(num) if num else None),
            btech_year=s.btech_year or (btech_year_of(num) if num else None),
            academic_period=s.academic_period,
            is_current=bool(s.is_current),
            status=s.status,
        )

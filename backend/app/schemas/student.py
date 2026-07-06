from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Gender = Literal["Male", "Female", "Other"]
Section = Literal["A", "B", "C", "D"]
Status = Literal["Active", "Graduated", "Discontinued"]


class StudentBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    program_id: Optional[int] = None
    enrollment_year: Optional[int] = Field(None, ge=1900, le=2100)  # admission year
    # ERP fields
    roll_number: Optional[str] = Field(None, max_length=20)
    phone_number: Optional[str] = Field(None, max_length=15)
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    academic_year_id: Optional[int] = None
    current_year: Optional[int] = Field(None, ge=1, le=4)
    current_semester: Optional[int] = Field(None, ge=1, le=8)
    section: Optional[Section] = None
    status: Optional[Status] = "Active"


class StudentCreate(StudentBase):
    """Payload for creating a student."""


class StudentUpdate(BaseModel):
    """Payload for updating a student. All fields optional (partial update)."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    program_id: Optional[int] = None
    enrollment_year: Optional[int] = Field(None, ge=1900, le=2100)
    roll_number: Optional[str] = Field(None, max_length=20)
    phone_number: Optional[str] = Field(None, max_length=15)
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    academic_year_id: Optional[int] = None
    current_year: Optional[int] = Field(None, ge=1, le=4)
    current_semester: Optional[int] = Field(None, ge=1, le=8)
    section: Optional[Section] = None
    status: Optional[Status] = None


class StudentOut(StudentBase):
    student_id: int
    program_name: Optional[str] = None
    academic_year: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_student(cls, s) -> "StudentOut":
        return cls(
            student_id=s.student_id,
            full_name=s.full_name,
            email=s.email,
            program_id=s.program_id,
            enrollment_year=s.enrollment_year,
            roll_number=s.roll_number,
            phone_number=s.phone_number,
            gender=s.gender,
            date_of_birth=s.date_of_birth,
            academic_year_id=s.academic_year_id,
            current_year=s.current_year,
            current_semester=s.current_semester,
            section=s.section,
            status=s.status,
            program_name=s.program.program_name if s.program else None,
            academic_year=s.academic_year.year_label if s.academic_year else None,
        )

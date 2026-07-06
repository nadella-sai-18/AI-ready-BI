from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FacultyBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = Field(None, max_length=100)


class FacultyCreate(FacultyBase):
    """Payload for creating a faculty member."""


class FacultyUpdate(BaseModel):
    """Payload for updating a faculty member. All fields optional (partial update)."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = Field(None, max_length=100)


class FacultyOut(FacultyBase):
    faculty_id: int

    model_config = ConfigDict(from_attributes=True)

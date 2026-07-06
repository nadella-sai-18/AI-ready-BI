from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CourseBase(BaseModel):
    course_name: str = Field(..., min_length=1, max_length=100)
    program_id: int = Field(..., description="Must reference an existing program")
    semester_id: int = Field(..., description="Must reference an existing semester of that program")
    credits: Optional[int] = Field(None, ge=0, le=20)
    course_code: Optional[str] = Field(None, max_length=20)
    faculty_id: Optional[int] = Field(None, description="Assigned faculty (optional)")


class CourseCreate(CourseBase):
    """Payload for creating a course."""


class CourseUpdate(BaseModel):
    """Payload for updating a course. All fields optional (partial update)."""

    course_name: Optional[str] = Field(None, min_length=1, max_length=100)
    program_id: Optional[int] = None
    semester_id: Optional[int] = None
    credits: Optional[int] = Field(None, ge=0, le=20)
    course_code: Optional[str] = Field(None, max_length=20)
    faculty_id: Optional[int] = None


class CourseOut(BaseModel):
    course_id: int
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    program_id: Optional[int] = None
    semester_id: Optional[int] = None
    credits: Optional[int] = None
    faculty_id: Optional[int] = None
    # Enriched, human-readable context.
    program_name: Optional[str] = None
    semester_name: Optional[str] = None
    faculty_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_course(cls, course) -> "CourseOut":
        """Build an enriched CourseOut from a Course ORM instance."""
        return cls(
            course_id=course.course_id,
            course_name=course.course_name,
            course_code=course.course_code,
            program_id=course.program_id,
            semester_id=course.semester_id,
            credits=course.credits,
            faculty_id=course.faculty_id,
            program_name=course.program.program_name if course.program else None,
            semester_name=course.semester.semester_name if course.semester else None,
            faculty_name=course.faculty.full_name if course.faculty else None,
        )

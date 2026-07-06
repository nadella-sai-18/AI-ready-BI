from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

EnrollmentStatus = Literal["Completed", "Ongoing", "Dropped"]


class EnrollmentCreate(BaseModel):
    """Payload to enroll a student in a course."""

    student_id: int = Field(..., description="Must reference an existing student")
    course_id: int = Field(..., description="Must reference an existing course")
    # Optional; the service defaults to today when omitted.
    enrollment_date: Optional[date] = None
    status: Optional[EnrollmentStatus] = "Ongoing"


class EnrollmentUpdate(BaseModel):
    """Payload to update an enrollment (e.g. mark completion)."""

    status: EnrollmentStatus


class EnrollmentOut(BaseModel):
    enrollment_id: int
    student_id: Optional[int] = None
    course_id: Optional[int] = None
    enrollment_date: Optional[date] = None
    status: Optional[str] = None
    # Enriched, human-readable context.
    student_name: Optional[str] = None
    course_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_enrollment(cls, enrollment) -> "EnrollmentOut":
        """Build an enriched EnrollmentOut from an Enrollment ORM instance."""
        return cls(
            enrollment_id=enrollment.enrollment_id,
            student_id=enrollment.student_id,
            course_id=enrollment.course_id,
            enrollment_date=enrollment.enrollment_date,
            status=enrollment.status,
            student_name=enrollment.student.full_name if enrollment.student else None,
            course_name=enrollment.course.course_name if enrollment.course else None,
        )

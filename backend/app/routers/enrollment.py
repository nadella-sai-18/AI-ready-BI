"""HTTP layer for the Enrollment module.

Routers stay thin: they handle request/response concerns and delegate all
business logic to EnrollmentService. Responses are enriched with student and
course names via EnrollmentOut.from_enrollment().
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.enrollment import EnrollmentCreate, EnrollmentOut, EnrollmentUpdate
from app.services.enrollment_service import EnrollmentService

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])


def get_enrollment_service(db: Session = Depends(get_db)) -> EnrollmentService:
    """Dependency that builds an EnrollmentService bound to the request's DB session."""
    return EnrollmentService(db)


@router.get("", response_model=Page[EnrollmentOut])
def list_enrollments(
    student_id: Optional[int] = Query(None, description="Filter by student"),
    course_id: Optional[int] = Query(None, description="Filter by course"),
    status: Optional[str] = Query(None, description="Filter by status"),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: EnrollmentService = Depends(get_enrollment_service),
):
    items, total = service.list_enrollments(
        student_id=student_id, course_id=course_id, status=status, sort_by=sort_by,
        order=order, skip=skip, limit=limit,
    )
    return Page(
        items=[EnrollmentOut.from_enrollment(e) for e in items], total=total, skip=skip, limit=limit
    )


@router.get("/student/{student_id}", response_model=list[EnrollmentOut])
def view_student_enrollments(
    student_id: int, service: EnrollmentService = Depends(get_enrollment_service)
):
    """View all courses a student is enrolled in."""
    return [EnrollmentOut.from_enrollment(e) for e in service.list_by_student(student_id)]


@router.get("/course/{course_id}", response_model=list[EnrollmentOut])
def view_course_enrollments(
    course_id: int, service: EnrollmentService = Depends(get_enrollment_service)
):
    """View all students enrolled in a course."""
    return [EnrollmentOut.from_enrollment(e) for e in service.list_by_course(course_id)]


@router.get("/{enrollment_id}", response_model=EnrollmentOut)
def get_enrollment(
    enrollment_id: int, service: EnrollmentService = Depends(get_enrollment_service)
):
    return EnrollmentOut.from_enrollment(service.get_enrollment(enrollment_id))


@router.post("", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
def enroll_student(
    payload: EnrollmentCreate, service: EnrollmentService = Depends(get_enrollment_service)
):
    """Enroll a student in a course."""
    return EnrollmentOut.from_enrollment(service.enroll(payload))


@router.put("/{enrollment_id}", response_model=EnrollmentOut)
def update_enrollment(
    enrollment_id: int,
    payload: EnrollmentUpdate,
    service: EnrollmentService = Depends(get_enrollment_service),
):
    """Update an enrollment's completion status (Completed / Ongoing / Dropped)."""
    return EnrollmentOut.from_enrollment(service.update_enrollment(enrollment_id, payload))


@router.delete("/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_enrollment(
    enrollment_id: int, service: EnrollmentService = Depends(get_enrollment_service)
):
    """Remove an enrollment."""
    service.remove(enrollment_id)
    return None

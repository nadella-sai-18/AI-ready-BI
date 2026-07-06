"""HTTP layer for the Student module."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate
from app.services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["Students"])


def get_student_service(db: Session = Depends(get_db)) -> StudentService:
    return StudentService(db)


@router.get("", response_model=Page[StudentOut])
def list_students(
    search: Optional[str] = Query(None, description="Match name / email / roll number"),
    program_id: Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    current_year: Optional[int] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: StudentService = Depends(get_student_service),
):
    items, total = service.list_students(
        search=search,
        program_id=program_id,
        academic_year_id=academic_year_id,
        status=status,
        section=section,
        current_year=current_year,
        sort_by=sort_by,
        order=order,
        skip=skip,
        limit=limit,
    )
    return Page(
        items=[StudentOut.from_student(s) for s in items], total=total, skip=skip, limit=limit
    )


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, service: StudentService = Depends(get_student_service)):
    return StudentOut.from_student(service.get_student(student_id))


@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(payload: StudentCreate, service: StudentService = Depends(get_student_service)):
    return StudentOut.from_student(service.create_student(payload))


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int, payload: StudentUpdate, service: StudentService = Depends(get_student_service)
):
    return StudentOut.from_student(service.update_student(student_id, payload))


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: int, service: StudentService = Depends(get_student_service)):
    service.delete_student(student_id)
    return None

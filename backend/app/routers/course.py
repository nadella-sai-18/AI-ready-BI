"""HTTP layer for the Course module."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate
from app.services.course_service import CourseService

router = APIRouter(prefix="/courses", tags=["Courses"])


def get_course_service(db: Session = Depends(get_db)) -> CourseService:
    return CourseService(db)


@router.get("", response_model=Page[CourseOut])
def list_courses(
    search: Optional[str] = Query(None, description="Match course name"),
    program_id: Optional[int] = Query(None),
    semester_id: Optional[int] = Query(None),
    faculty_id: Optional[int] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: CourseService = Depends(get_course_service),
):
    items, total = service.list_courses(
        search=search,
        program_id=program_id,
        semester_id=semester_id,
        faculty_id=faculty_id,
        sort_by=sort_by,
        order=order,
        skip=skip,
        limit=limit,
    )
    return Page(
        items=[CourseOut.from_course(c) for c in items], total=total, skip=skip, limit=limit
    )


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, service: CourseService = Depends(get_course_service)):
    return CourseOut.from_course(service.get_course(course_id))


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, service: CourseService = Depends(get_course_service)):
    return CourseOut.from_course(service.create_course(payload))


@router.put("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int, payload: CourseUpdate, service: CourseService = Depends(get_course_service)
):
    return CourseOut.from_course(service.update_course(course_id, payload))


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, service: CourseService = Depends(get_course_service)):
    service.delete_course(course_id)
    return None

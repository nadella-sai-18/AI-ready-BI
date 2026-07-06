"""HTTP layer for the Faculty module."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.faculty import FacultyCreate, FacultyOut, FacultyUpdate
from app.services.faculty_service import FacultyService

router = APIRouter(prefix="/faculty", tags=["Faculty"])


def get_faculty_service(db: Session = Depends(get_db)) -> FacultyService:
    return FacultyService(db)


@router.get("", response_model=Page[FacultyOut])
def list_faculty(
    search: Optional[str] = Query(None, description="Match name / email"),
    department: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: FacultyService = Depends(get_faculty_service),
):
    items, total = service.list_faculty(
        search=search, department=department, sort_by=sort_by, order=order, skip=skip, limit=limit
    )
    return Page(items=items, total=total, skip=skip, limit=limit)


@router.get("/{faculty_id}", response_model=FacultyOut)
def get_faculty(faculty_id: int, service: FacultyService = Depends(get_faculty_service)):
    return service.get_faculty(faculty_id)


@router.post("", response_model=FacultyOut, status_code=status.HTTP_201_CREATED)
def create_faculty(payload: FacultyCreate, service: FacultyService = Depends(get_faculty_service)):
    return service.create_faculty(payload)


@router.put("/{faculty_id}", response_model=FacultyOut)
def update_faculty(
    faculty_id: int, payload: FacultyUpdate, service: FacultyService = Depends(get_faculty_service)
):
    return service.update_faculty(faculty_id, payload)


@router.delete("/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faculty(faculty_id: int, service: FacultyService = Depends(get_faculty_service)):
    service.delete_faculty(faculty_id)
    return None

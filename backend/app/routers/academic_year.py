"""HTTP layer for the Academic Year module."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.academic_year import (
    AcademicYearCreate,
    AcademicYearOut,
    AcademicYearUpdate,
)
from app.schemas.common import Page
from app.services.academic_year_service import AcademicYearService

router = APIRouter(prefix="/academic-years", tags=["Academic Years"])


def get_service(db: Session = Depends(get_db)) -> AcademicYearService:
    return AcademicYearService(db)


@router.get("", response_model=Page[AcademicYearOut])
def list_years(
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: AcademicYearService = Depends(get_service),
):
    items, total = service.list_years(
        search=search, sort_by=sort_by, order=order, skip=skip, limit=limit
    )
    return Page(items=items, total=total, skip=skip, limit=limit)


@router.get("/{academic_year_id}", response_model=AcademicYearOut)
def get_year(academic_year_id: int, service: AcademicYearService = Depends(get_service)):
    return service.get_year(academic_year_id)


@router.post("", response_model=AcademicYearOut, status_code=status.HTTP_201_CREATED)
def create_year(payload: AcademicYearCreate, service: AcademicYearService = Depends(get_service)):
    return service.create_year(payload)


@router.put("/{academic_year_id}", response_model=AcademicYearOut)
def update_year(
    academic_year_id: int,
    payload: AcademicYearUpdate,
    service: AcademicYearService = Depends(get_service),
):
    return service.update_year(academic_year_id, payload)


@router.delete("/{academic_year_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_year(academic_year_id: int, service: AcademicYearService = Depends(get_service)):
    service.delete_year(academic_year_id)
    return None

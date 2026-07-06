"""HTTP layer for the Semester module (8 shared academic semesters)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.semester import SemesterCreate, SemesterOut, SemesterUpdate
from app.services.semester_service import SemesterService

router = APIRouter(prefix="/semesters", tags=["Semesters"])


def get_semester_service(db: Session = Depends(get_db)) -> SemesterService:
    return SemesterService(db)


@router.get("", response_model=Page[SemesterOut])
def list_semesters(
    btech_year: Optional[int] = Query(None, ge=1, le=4),
    term_type: Optional[str] = Query(None, description="Monsoon | Winter"),
    status_: Optional[str] = Query(None, alias="status", description="Active | Completed | Upcoming"),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: SemesterService = Depends(get_semester_service),
):
    items, total = service.list_semesters(
        btech_year=btech_year, term_type=term_type, status=status_,
        sort_by=sort_by, order=order, skip=skip, limit=limit,
    )
    out = service.with_counts([SemesterOut.from_semester(s) for s in items])
    return Page(items=out, total=total, skip=skip, limit=limit)


@router.get("/current", response_model=Optional[SemesterOut])
def current_semester(service: SemesterService = Depends(get_semester_service)):
    """The single semester marked as the current operational semester (or null)."""
    s = service.current_semester()
    if s is None:
        return None
    return service.with_counts([SemesterOut.from_semester(s)])[0]


@router.get("/{semester_id}", response_model=SemesterOut)
def get_semester(semester_id: int, service: SemesterService = Depends(get_semester_service)):
    return service.with_counts([SemesterOut.from_semester(service.get_semester(semester_id))])[0]


@router.post("", response_model=SemesterOut, status_code=status.HTTP_201_CREATED)
def create_semester(
    payload: SemesterCreate, service: SemesterService = Depends(get_semester_service)
):
    return SemesterOut.from_semester(service.create_semester(payload))


@router.put("/{semester_id}", response_model=SemesterOut)
def update_semester(
    semester_id: int,
    payload: SemesterUpdate,
    service: SemesterService = Depends(get_semester_service),
):
    return SemesterOut.from_semester(service.update_semester(semester_id, payload))


@router.post("/{semester_id}/set-current", response_model=SemesterOut)
def set_current_semester(
    semester_id: int, service: SemesterService = Depends(get_semester_service)
):
    """Mark this semester as the current operational semester (clears the others)."""
    return SemesterOut.from_semester(service.set_current(semester_id))


@router.delete("/{semester_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_semester(semester_id: int, service: SemesterService = Depends(get_semester_service)):
    service.delete_semester(semester_id)
    return None

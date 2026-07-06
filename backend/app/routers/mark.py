"""HTTP layer for the Marks module.

Routers stay thin: they handle request/response concerns and delegate all
business logic to MarkService.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.mark import (
    BulkMarksIn,
    BulkMarksResult,
    MarkCreate,
    MarkOut,
    MarksInsights,
    MarksSummary,
    MarkUpdate,
    StudentResults,
)
from app.services.mark_service import MarkService

router = APIRouter(prefix="/marks", tags=["Marks"])


def get_mark_service(db: Session = Depends(get_db)) -> MarkService:
    """Dependency that builds a MarkService bound to the request's DB session."""
    return MarkService(db)


@router.get("", response_model=Page[MarkOut])
def list_marks(
    student_id: Optional[int] = Query(None, description="Filter by student"),
    exam_id: Optional[int] = Query(None, description="Filter by exam"),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: MarkService = Depends(get_mark_service),
):
    items, total = service.list_marks(
        student_id=student_id, exam_id=exam_id, sort_by=sort_by, order=order, skip=skip, limit=limit
    )
    return Page(items=[MarkOut.from_mark(m) for m in items], total=total, skip=skip, limit=limit)


@router.get("/student/{student_id}", response_model=StudentResults)
def student_results(student_id: int, service: MarkService = Depends(get_mark_service)):
    """View a student's results across all exams, with a summary."""
    return service.student_results(student_id)


@router.get("/summary", response_model=MarksSummary)
def marks_summary(
    program_id: Optional[int] = Query(None, description="Branch"),
    semester_number: Optional[int] = Query(None, ge=1, le=8),
    section: Optional[str] = Query(None),
    service: MarkService = Depends(get_mark_service),
):
    """Marks dashboard cards, scoped by branch / semester / section."""
    return service.marks_summary(program_id, semester_number, section)


@router.get("/insights", response_model=MarksInsights)
def marks_insights(
    program_id: Optional[int] = Query(None, description="Branch"),
    semester_number: Optional[int] = Query(None, ge=1, le=8),
    section: Optional[str] = Query(None),
    service: MarkService = Depends(get_mark_service),
):
    """Principal / admin performance insights (students, sections, branches, subjects)."""
    return service.marks_insights(program_id, semester_number, section)


@router.get("/{mark_id}", response_model=MarkOut)
def get_mark(mark_id: int, service: MarkService = Depends(get_mark_service)):
    return MarkOut.from_mark(service.get_mark(mark_id))


@router.post("", response_model=MarkOut, status_code=status.HTTP_201_CREATED)
def enter_marks(payload: MarkCreate, service: MarkService = Depends(get_mark_service)):
    """Enter marks for a student on an exam."""
    return MarkOut.from_mark(service.enter_marks(payload))


@router.post("/bulk", response_model=BulkMarksResult)
def bulk_enter_marks(payload: BulkMarksIn, service: MarkService = Depends(get_mark_service)):
    """Enter/update a whole class's marks for one exam in a single call."""
    return service.bulk_upsert(payload)


@router.put("/{mark_id}", response_model=MarkOut)
def update_marks(
    mark_id: int, payload: MarkUpdate, service: MarkService = Depends(get_mark_service)
):
    """Update entered marks."""
    return MarkOut.from_mark(service.update_marks(mark_id, payload))


@router.delete("/{mark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_marks(mark_id: int, service: MarkService = Depends(get_mark_service)):
    """Delete a mark."""
    service.delete_marks(mark_id)
    return None

"""HTTP layer for the Exam module (operations + performance analytics)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.exam import (
    ExamContext,
    ExamCreate,
    ExamInsights,
    ExamOut,
    ExamRoster,
    ExamStats,
    ExamSummary,
    ExamUpdate,
)
from app.services.exam_service import ExamService

router = APIRouter(prefix="/exams", tags=["Exams"])

# Term choices reused across query params.
TermQ = Query(None, description="Monsoon | Winter")


def get_exam_service(db: Session = Depends(get_db)) -> ExamService:
    return ExamService(db)


@router.get("", response_model=Page[ExamOut])
def list_exams(
    search: Optional[str] = Query(None, description="Match exam name"),
    course_id: Optional[int] = Query(None),
    exam_type: Optional[str] = Query(None),
    status_: Optional[str] = Query(None, alias="status"),
    program_id: Optional[int] = Query(None, description="Branch"),
    semester_number: Optional[int] = Query(None, ge=1, le=8),
    btech_year: Optional[int] = Query(None, ge=1, le=4),
    term: Optional[str] = TermQ,
    faculty_id: Optional[int] = Query(None),
    upcoming: bool = Query(False, description="Only exams in the next 7 days"),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: ExamService = Depends(get_exam_service),
):
    items, total = service.list_exams(
        search=search, course_id=course_id, exam_type=exam_type, status=status_,
        program_id=program_id, semester_number=semester_number, btech_year=btech_year,
        term=term, faculty_id=faculty_id, upcoming=upcoming,
        sort_by=sort_by, order=order, skip=skip, limit=limit,
    )
    out = [ExamOut.from_exam(e) for e in items]
    service.attach_marks_summary(out)
    return Page(items=out, total=total, skip=skip, limit=limit)


@router.get("/context", response_model=ExamContext)
def exam_context(
    program_id: int = Query(..., description="Branch"),
    semester_number: Optional[int] = Query(None, ge=1, le=8),
    btech_year: Optional[int] = Query(None, ge=1, le=4),
    term: Optional[str] = TermQ,
    service: ExamService = Depends(get_exam_service),
):
    """Subjects of a branch + semester with per-subject exam stats (Step 6/7)."""
    return service.context(program_id, semester_number, btech_year, term)


@router.get("/summary", response_model=ExamSummary)
def exam_summary(
    program_id: Optional[int] = Query(None),
    semester_number: Optional[int] = Query(None, ge=1, le=8),
    btech_year: Optional[int] = Query(None, ge=1, le=4),
    term: Optional[str] = TermQ,
    faculty_id: Optional[int] = Query(None),
    service: ExamService = Depends(get_exam_service),
):
    """Dashboard summary cards, scoped by the given filters."""
    return service.summary(program_id, semester_number, btech_year, term, faculty_id)


@router.get("/insights", response_model=ExamInsights)
def exam_insights(
    program_id: Optional[int] = Query(None),
    semester_number: Optional[int] = Query(None, ge=1, le=8),
    btech_year: Optional[int] = Query(None, ge=1, le=4),
    term: Optional[str] = TermQ,
    faculty_id: Optional[int] = Query(None),
    service: ExamService = Depends(get_exam_service),
):
    """Principal / management performance insights, scoped by the given filters."""
    return service.insights(program_id, semester_number, btech_year, term, faculty_id)


@router.get("/{exam_id}/stats", response_model=ExamStats)
def exam_stats(exam_id: int, service: ExamService = Depends(get_exam_service)):
    """Per-exam operational + performance stats for the exam detail view."""
    return service.exam_stats(exam_id)


@router.get("/{exam_id}/roster", response_model=ExamRoster)
def exam_roster(
    exam_id: int,
    section: Optional[str] = Query(None, description="Optional section (A-D)"),
    service: ExamService = Depends(get_exam_service),
):
    """Cohort roster for an exam, pre-filled with any entered marks."""
    return service.roster(exam_id, section)


@router.get("/{exam_id}", response_model=ExamOut)
def get_exam(exam_id: int, service: ExamService = Depends(get_exam_service)):
    out = ExamOut.from_exam(service.get_exam(exam_id))
    service.attach_marks_summary([out])
    return out


@router.post("", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
def create_exam(payload: ExamCreate, service: ExamService = Depends(get_exam_service)):
    return ExamOut.from_exam(service.create_exam(payload))


@router.put("/{exam_id}", response_model=ExamOut)
def update_exam(exam_id: int, payload: ExamUpdate, service: ExamService = Depends(get_exam_service)):
    return ExamOut.from_exam(service.update_exam(exam_id, payload))


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(exam_id: int, service: ExamService = Depends(get_exam_service)):
    service.delete_exam(exam_id)
    return None

"""HTTP layer for the Competency module.

Covers competency definitions and student competency scores. Literal sub-paths
(`/scores/...`, `/student/...`) are declared before `/{competency_id}` so they
are not shadowed by the numeric path parameter.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.competency import (
    CompetencyCreate,
    CompetencyOut,
    CompetencyUpdate,
    ScoreCreate,
    ScoreOut,
    ScoreUpdate,
    StudentCompetencyReport,
)
from app.services.competency_service import CompetencyService

router = APIRouter(prefix="/competencies", tags=["Competencies"])


def get_competency_service(db: Session = Depends(get_db)) -> CompetencyService:
    """Dependency that builds a CompetencyService bound to the request's DB session."""
    return CompetencyService(db)


# ----- Student competency scores (literal paths first) -----------------
@router.post("/scores", response_model=ScoreOut, status_code=status.HTTP_201_CREATED)
def assign_score(
    payload: ScoreCreate, service: CompetencyService = Depends(get_competency_service)
):
    """Assign a competency score to a student."""
    return ScoreOut.from_score(service.assign_score(payload))


@router.get("/scores/{score_id}", response_model=ScoreOut)
def get_score(score_id: int, service: CompetencyService = Depends(get_competency_service)):
    return ScoreOut.from_score(service.get_score(score_id))


@router.put("/scores/{score_id}", response_model=ScoreOut)
def update_score(
    score_id: int,
    payload: ScoreUpdate,
    service: CompetencyService = Depends(get_competency_service),
):
    """Update an assigned competency score."""
    return ScoreOut.from_score(service.update_score(score_id, payload))


@router.delete("/scores/{score_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_score(score_id: int, service: CompetencyService = Depends(get_competency_service)):
    """Delete an assigned competency score."""
    service.delete_score(score_id)
    return None


@router.get("/student/{student_id}", response_model=StudentCompetencyReport)
def student_competency_report(
    student_id: int, service: CompetencyService = Depends(get_competency_service)
):
    """View a student's competency report (scores, levels, and summary)."""
    return service.student_report(student_id)


# ----- Competency definitions ------------------------------------------
@router.get("", response_model=Page[CompetencyOut])
def list_competencies(
    search: Optional[str] = Query(None, description="Match against competency_name"),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: CompetencyService = Depends(get_competency_service),
):
    items, total = service.list_competencies(
        search=search, sort_by=sort_by, order=order, skip=skip, limit=limit
    )
    return Page(items=items, total=total, skip=skip, limit=limit)


@router.post("", response_model=CompetencyOut, status_code=status.HTTP_201_CREATED)
def add_competency(
    payload: CompetencyCreate, service: CompetencyService = Depends(get_competency_service)
):
    """Add a new competency."""
    return service.create_competency(payload)


@router.get("/{competency_id}", response_model=CompetencyOut)
def get_competency(
    competency_id: int, service: CompetencyService = Depends(get_competency_service)
):
    return service.get_competency(competency_id)


@router.put("/{competency_id}", response_model=CompetencyOut)
def update_competency(
    competency_id: int,
    payload: CompetencyUpdate,
    service: CompetencyService = Depends(get_competency_service),
):
    """Update a competency (partial)."""
    return service.update_competency(competency_id, payload)


@router.delete("/{competency_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_competency(
    competency_id: int, service: CompetencyService = Depends(get_competency_service)
):
    """Delete a competency."""
    service.delete_competency(competency_id)
    return None

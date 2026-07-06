"""Business logic for the Competency module.

Covers competency definitions (add/update/list/delete), assigning competency
scores to students, and a per-student competency report. Validates foreign keys
and prevents assigning the same competency to a student twice.
"""

from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.competency import Competency, StudentCompetency
from app.models.student import Student
from app.schemas.competency import (
    CompetencyCreate,
    CompetencyUpdate,
    ScoreCreate,
    ScoreOut,
    ScoreUpdate,
    StudentCompetencyReport,
    competency_level,
)
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"competency_id", "competency_name"}


class CompetencyService:
    """Encapsulates competency operations against the shared database."""

    def __init__(self, db: Session):
        self.db = db

    # ----- Competency definitions ---------------------------------------
    def list_competencies(
        self,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        """Return (items, total). `search` matches competency_name."""
        query = self.db.query(Competency)
        if search:
            query = query.filter(Competency.competency_name.ilike(f"%{search}%"))

        query = apply_sort(query, Competency, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Competency.competency_id)
        return paginate(query, skip, limit)

    def get_competency(self, competency_id: int) -> Competency:
        """Return one competency or raise NotFoundError."""
        competency = self.db.get(Competency, competency_id)
        if competency is None:
            raise NotFoundError(f"Competency {competency_id} not found")
        return competency

    def create_competency(self, payload: CompetencyCreate) -> Competency:
        """Add a new competency."""
        competency = Competency(
            competency_name=payload.competency_name, description=payload.description
        )
        self.db.add(competency)
        self._commit()
        self.db.refresh(competency)
        return competency

    def update_competency(self, competency_id: int, payload: CompetencyUpdate) -> Competency:
        """Partially update a competency."""
        competency = self.get_competency(competency_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(competency, field, value)
        self._commit()
        self.db.refresh(competency)
        return competency

    def delete_competency(self, competency_id: int) -> None:
        """Delete a competency by id."""
        competency = self.get_competency(competency_id)
        self.db.delete(competency)
        self._commit()

    # ----- Student competency scores ------------------------------------
    def assign_score(self, payload: ScoreCreate) -> StudentCompetency:
        """Assign a competency score to a student (validates FKs, blocks duplicates)."""
        self._require_student(payload.student_id)
        self._require_competency(payload.competency_id)

        existing = (
            self.db.query(StudentCompetency)
            .filter(
                StudentCompetency.student_id == payload.student_id,
                StudentCompetency.competency_id == payload.competency_id,
            )
            .first()
        )
        if existing is not None:
            raise ConflictError(
                f"Competency {payload.competency_id} already assigned to "
                f"student {payload.student_id} (use update instead)"
            )

        score = StudentCompetency(
            student_id=payload.student_id,
            competency_id=payload.competency_id,
            score=payload.score,
        )
        self.db.add(score)
        self._commit()
        self.db.refresh(score)
        return score

    def get_score(self, score_id: int) -> StudentCompetency:
        """Return one assigned score or raise NotFoundError."""
        score = self.db.get(StudentCompetency, score_id)
        if score is None:
            raise NotFoundError(f"Competency score {score_id} not found")
        return score

    def update_score(self, score_id: int, payload: ScoreUpdate) -> StudentCompetency:
        """Update an assigned competency score."""
        score = self.get_score(score_id)
        score.score = payload.score
        self._commit()
        self.db.refresh(score)
        return score

    def delete_score(self, score_id: int) -> None:
        """Delete an assigned competency score by id."""
        score = self.get_score(score_id)
        self.db.delete(score)
        self._commit()

    def student_report(self, student_id: int) -> StudentCompetencyReport:
        """Build a per-student competency report with a summary."""
        student = self.db.get(Student, student_id)
        if student is None:
            raise NotFoundError(f"Student {student_id} not found")

        scores = (
            self.db.query(StudentCompetency)
            .filter(StudentCompetency.student_id == student_id)
            .order_by(StudentCompetency.competency_id)
            .all()
        )
        items = [ScoreOut.from_score(s) for s in scores]

        values = [i.score for i in items if i.score is not None]
        average = round(sum(values) / len(values), 2) if values else None

        return StudentCompetencyReport(
            student_id=student.student_id,
            student_name=student.full_name,
            items=items,
            competencies_count=len(items),
            average_score=average,
            overall_level=competency_level(average),
        )

    # --- helpers ---------------------------------------------------------
    def _require_student(self, student_id: int) -> None:
        if self.db.get(Student, student_id) is None:
            raise NotFoundError(f"Student {student_id} not found")

    def _require_competency(self, competency_id: int) -> None:
        if self.db.get(Competency, competency_id) is None:
            raise NotFoundError(f"Competency {competency_id} not found")

    def _commit(self) -> None:
        """Commit, converting DB integrity errors into a domain ConflictError."""
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(
                "Operation violates a database constraint "
                "(the competency may still have student scores referencing it)"
            ) from exc

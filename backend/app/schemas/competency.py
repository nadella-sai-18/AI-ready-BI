from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


def competency_level(score: Optional[float]) -> Optional[str]:
    """Classify a score into a level, matching the logic in sql/views.sql.

    < 70 -> 'Weak Area', 70..85 -> 'Moderate', > 85 -> 'Strong'.
    """
    if score is None:
        return None
    if score < 70:
        return "Weak Area"
    if score <= 85:
        return "Moderate"
    return "Strong"


# ----- Competency (definition) -----
class CompetencyBase(BaseModel):
    competency_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class CompetencyCreate(CompetencyBase):
    """Payload for adding a competency."""


class CompetencyUpdate(BaseModel):
    """Payload for updating a competency. All fields optional (partial update)."""

    competency_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class CompetencyOut(CompetencyBase):
    competency_id: int

    model_config = ConfigDict(from_attributes=True)


# ----- Student competency score (assignment) -----
class ScoreCreate(BaseModel):
    """Payload to assign a competency score to a student."""

    student_id: int = Field(..., description="Must reference an existing student")
    competency_id: int = Field(..., description="Must reference an existing competency")
    score: int = Field(..., ge=0, le=100)


class ScoreUpdate(BaseModel):
    """Payload to update an assigned competency score."""

    score: int = Field(..., ge=0, le=100)


class ScoreOut(BaseModel):
    id: int
    student_id: Optional[int] = None
    competency_id: Optional[int] = None
    score: Optional[int] = None
    # Enriched, human-readable context.
    student_name: Optional[str] = None
    competency_name: Optional[str] = None
    level: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_score(cls, sc) -> "ScoreOut":
        """Build an enriched ScoreOut from a StudentCompetency ORM instance."""
        return cls(
            id=sc.id,
            student_id=sc.student_id,
            competency_id=sc.competency_id,
            score=sc.score,
            student_name=sc.student.full_name if sc.student else None,
            competency_name=sc.competency.competency_name if sc.competency else None,
            level=competency_level(sc.score),
        )


class StudentCompetencyReport(BaseModel):
    """A student's competency scores, with a summary."""

    student_id: int
    student_name: Optional[str] = None
    items: list[ScoreOut]
    competencies_count: int
    average_score: Optional[float] = None
    overall_level: Optional[str] = None

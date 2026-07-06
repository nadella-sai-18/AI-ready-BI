from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.grading import PASS_PERCENTAGE, grade_for


class MarkCreate(BaseModel):
    """Payload to enter marks for a student on an exam."""

    student_id: int = Field(..., description="Must reference an existing student")
    exam_id: int = Field(..., description="Must reference an existing exam")
    marks_obtained: int = Field(..., ge=0, description="Must not exceed the exam's max_marks")


class MarkUpdate(BaseModel):
    """Payload to update entered marks."""

    marks_obtained: int = Field(..., ge=0, description="Must not exceed the exam's max_marks")


class BulkMarkItem(BaseModel):
    student_id: int
    marks_obtained: Optional[int] = Field(None, ge=0)  # blank/None when absent
    status: Optional[str] = "Present"                   # Present | Absent
    remarks: Optional[str] = None


class BulkMarksIn(BaseModel):
    """Enter/update a whole class's marks for one exam."""

    exam_id: int
    records: list[BulkMarkItem]


class BulkMarksResult(BaseModel):
    created: int
    updated: int
    total: int


# --- Marks analytics (principal / admin performance view) ------------------


class MarksSummary(BaseModel):
    total_exams: int = 0
    exams_fully_entered: int = 0
    exams_pending: int = 0
    total_marks: int = 0
    appeared: int = 0
    absent_marks: int = 0
    average_percentage: Optional[float] = None
    pass_percentage: Optional[float] = None
    fail_percentage: Optional[float] = None
    students_at_risk: int = 0
    students_with_absences: int = 0
    low_avg_subjects: int = 0


class MarkRow(BaseModel):
    """Flexible row for the various insight lists."""

    id: Optional[int] = None
    name: Optional[str] = None
    detail: Optional[str] = None
    section: Optional[str] = None
    branch: Optional[str] = None
    value: Optional[float] = None
    extra: Optional[float] = None


class MarksInsights(BaseModel):
    scope: str = ""
    top_students: list[MarkRow] = []
    bottom_students: list[MarkRow] = []
    below_threshold: list[MarkRow] = []
    multiple_fails: list[MarkRow] = []
    absentees: list[MarkRow] = []
    at_risk_students: list[MarkRow] = []
    section_performance: list[MarkRow] = []
    branch_performance: list[MarkRow] = []
    weak_subjects: list[MarkRow] = []


def _compute(marks_obtained: Optional[int], max_marks: Optional[int]):
    """Return (percentage, passed, grade, grade_point)."""
    if marks_obtained is None or not max_marks:
        return None, None, None, None
    percentage = round(marks_obtained * 100.0 / max_marks, 2)
    grade, grade_point = grade_for(percentage)
    return percentage, percentage >= PASS_PERCENTAGE, grade, grade_point


class MarkOut(BaseModel):
    mark_id: int
    student_id: Optional[int] = None
    exam_id: Optional[int] = None
    marks_obtained: Optional[int] = None
    student_name: Optional[str] = None
    exam_name: Optional[str] = None
    course_name: Optional[str] = None
    max_marks: Optional[int] = None
    percentage: Optional[float] = None
    passed: Optional[bool] = None
    grade: Optional[str] = None
    grade_point: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_mark(cls, mark) -> "MarkOut":
        """Build an enriched MarkOut from a Mark ORM instance."""
        exam = mark.exam
        max_marks = exam.max_marks if exam else None
        percentage, passed, grade, grade_point = _compute(mark.marks_obtained, max_marks)
        return cls(
            mark_id=mark.mark_id,
            student_id=mark.student_id,
            exam_id=mark.exam_id,
            marks_obtained=mark.marks_obtained,
            student_name=mark.student.full_name if mark.student else None,
            exam_name=exam.exam_name if exam else None,
            course_name=exam.course.course_name if exam and exam.course else None,
            max_marks=max_marks,
            percentage=percentage,
            passed=passed,
            grade=grade,
            grade_point=grade_point,
        )


class StudentResults(BaseModel):
    """A student's results across all exams, with a summary."""

    student_id: int
    student_name: Optional[str] = None
    results: list[MarkOut]
    exams_count: int
    average_percentage: Optional[float] = None
    cgpa: Optional[float] = None  # credit-agnostic GPA: mean of exam grade points
    passed_count: int = 0
    failed_count: int = 0

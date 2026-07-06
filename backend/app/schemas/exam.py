from datetime import date, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.academics import btech_year_of, term_of

# Theory + lab + continuous-assessment exam patterns.
ExamType = Literal[
    "Internal 1", "Internal 2", "Mid Sem", "End Sem",
    "Lab Internal", "Lab External", "Observation", "Record",
    "Assignment", "Quiz",
]
ExamStatus = Literal["Scheduled", "Completed", "Cancelled"]


class ExamBase(BaseModel):
    course_id: int = Field(..., description="Must reference an existing course")
    exam_name: str = Field(..., min_length=1, max_length=50)
    max_marks: int = Field(..., gt=0, le=1000)
    exam_date: Optional[date] = None
    exam_type: Optional[ExamType] = None
    weightage: Optional[int] = Field(None, ge=0, le=100)
    status: Optional[ExamStatus] = "Scheduled"
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    instructions: Optional[str] = None


class ExamCreate(ExamBase):
    """Payload for creating an exam."""


class ExamUpdate(BaseModel):
    """Payload for updating an exam. All fields optional (partial update)."""

    course_id: Optional[int] = None
    exam_name: Optional[str] = Field(None, min_length=1, max_length=50)
    max_marks: Optional[int] = Field(None, gt=0, le=1000)
    exam_date: Optional[date] = None
    exam_type: Optional[ExamType] = None
    weightage: Optional[int] = Field(None, ge=0, le=100)
    status: Optional[ExamStatus] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    instructions: Optional[str] = None


class ExamOut(BaseModel):
    exam_id: int
    course_id: Optional[int] = None
    exam_name: Optional[str] = None
    exam_type: Optional[str] = None
    exam_date: Optional[date] = None
    max_marks: Optional[int] = None
    weightage: Optional[int] = None
    status: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    instructions: Optional[str] = None
    # --- derived academic context (via course) ---
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    program_id: Optional[int] = None
    program_name: Optional[str] = None
    semester_id: Optional[int] = None
    semester_number: Optional[int] = None
    term_type: Optional[str] = None
    btech_year: Optional[int] = None
    faculty_id: Optional[int] = None
    faculty_name: Optional[str] = None
    # --- light marks summary (filled by the service for list rows) ---
    marks_entered: Optional[int] = None
    expected_students: Optional[int] = None
    marks_status: Optional[str] = None  # "Entered" | "Partial" | "Pending"

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_exam(cls, exam) -> "ExamOut":
        """Build an enriched ExamOut from an Exam ORM instance (context only)."""
        course = exam.course
        program = course.program if course else None
        semester = course.semester if course else None
        faculty = course.faculty if course else None
        sem_no = semester.semester_number if semester else None
        return cls(
            exam_id=exam.exam_id,
            course_id=exam.course_id,
            exam_name=exam.exam_name,
            exam_type=exam.exam_type,
            exam_date=exam.exam_date,
            max_marks=exam.max_marks,
            weightage=exam.weightage,
            status=exam.status,
            start_time=exam.start_time,
            end_time=exam.end_time,
            instructions=exam.instructions,
            course_name=course.course_name if course else None,
            course_code=getattr(course, "course_code", None) if course else None,
            program_id=program.program_id if program else None,
            program_name=program.program_name if program else None,
            semester_id=semester.semester_id if semester else None,
            semester_number=sem_no,
            term_type=(semester.term_type if semester and semester.term_type else
                       (term_of(sem_no) if sem_no else None)),
            btech_year=btech_year_of(sem_no) if sem_no else None,
            faculty_id=faculty.faculty_id if faculty else None,
            faculty_name=faculty.full_name if faculty else None,
        )


# --- Subject cards (Step 6/7): subjects of a branch + semester -------------


class ExamSubject(BaseModel):
    course_id: int
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    faculty_id: Optional[int] = None
    faculty_name: Optional[str] = None
    exam_count: int = 0
    completed_count: int = 0
    pending_marks_count: int = 0     # exams with no marks entered
    avg_percentage: Optional[float] = None


class ExamContext(BaseModel):
    program_id: int
    program_name: Optional[str] = None
    semester_number: int
    btech_year: int
    term_type: str
    sections: list[str] = []
    total_subjects: int = 0
    total_exams: int = 0
    subjects: list[ExamSubject] = []


# --- Dashboard summary cards -----------------------------------------------


class ExamSummary(BaseModel):
    total_exams: int = 0
    scheduled: int = 0
    completed: int = 0
    cancelled: int = 0
    todays_exams: int = 0
    upcoming_exams: int = 0          # next 7 days
    average_marks: Optional[float] = None    # average percentage across graded exams
    pass_percentage: Optional[float] = None
    pending_marks_entry: int = 0     # past exams with no marks
    subjects_results_pending: int = 0


# --- Per-exam detail stats -------------------------------------------------


class ExamStats(BaseModel):
    exam_id: int
    expected_students: int = 0
    appeared: int = 0
    absent: int = 0
    marks_entered: int = 0
    pending_marks: int = 0
    average_marks: Optional[float] = None
    average_percentage: Optional[float] = None
    highest: Optional[int] = None
    lowest: Optional[int] = None
    pass_count: int = 0
    fail_count: int = 0
    pass_percentage: Optional[float] = None


# --- Performance insights (principal / management view) --------------------


class NamedScore(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    detail: Optional[str] = None
    value: Optional[float] = None
    extra: Optional[float] = None


class ExamRosterRow(BaseModel):
    student_id: int
    roll_number: Optional[str] = None
    full_name: Optional[str] = None
    section: Optional[str] = None
    marks_obtained: Optional[int] = None
    status: Optional[str] = None  # Present | Absent (existing mark, if any)
    mark_id: Optional[int] = None


class ExamRoster(BaseModel):
    exam_id: int
    exam_name: Optional[str] = None
    exam_type: Optional[str] = None
    course_name: Optional[str] = None
    max_marks: Optional[int] = None
    students: list[ExamRosterRow] = []


class ExamInsights(BaseModel):
    scope: str = ""
    top_students: list[NamedScore] = []
    bottom_students: list[NamedScore] = []
    students_below_threshold: list[NamedScore] = []
    weak_subjects: list[NamedScore] = []
    branch_performance: list[NamedScore] = []
    semester_performance: list[NamedScore] = []
    pending_marks_exams: list[NamedScore] = []
    upcoming_exams: list[NamedScore] = []

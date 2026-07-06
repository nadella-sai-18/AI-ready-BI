from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# Allowed attendance statuses (column is VARCHAR(20) in the schema).
AttendanceStatus = Literal["Present", "Absent", "Late"]


class AttendanceCreate(BaseModel):
    """Payload to mark attendance for a student in a course."""

    student_id: int = Field(..., description="Must reference an existing student")
    course_id: int = Field(..., description="Must reference an existing course")
    status: AttendanceStatus
    # Optional; the service defaults to today when omitted.
    class_date: Optional[date] = None


class AttendanceUpdate(BaseModel):
    """Payload to update an attendance record (partial update)."""

    status: Optional[AttendanceStatus] = None
    class_date: Optional[date] = None


class AttendanceOut(BaseModel):
    attendance_id: int
    student_id: Optional[int] = None
    course_id: Optional[int] = None
    class_date: Optional[date] = None
    status: Optional[str] = None
    # Enriched, human-readable context.
    student_name: Optional[str] = None
    course_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_attendance(cls, att) -> "AttendanceOut":
        """Build an enriched AttendanceOut from an Attendance ORM instance."""
        return cls(
            attendance_id=att.attendance_id,
            student_id=att.student_id,
            course_id=att.course_id,
            class_date=att.class_date,
            status=att.status,
            student_name=att.student.full_name if att.student else None,
            course_name=att.course.course_name if att.course else None,
        )


class AttendanceReportRow(BaseModel):
    """Per-student attendance summary within a course."""

    student_id: int
    student_name: Optional[str] = None
    total_classes: int
    present: int
    absent: int
    late: int
    attendance_percentage: float


class CourseAttendanceReport(BaseModel):
    """Attendance report for a course, broken down per student."""

    course_id: int
    course_name: Optional[str] = None
    rows: list[AttendanceReportRow]


# --- Academic attendance flow (batch -> branch -> semester -> subject) --------


class AttendanceSubject(BaseModel):
    """A subject (course) available for attendance, with how many marks exist."""

    course_id: int
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    semester_id: Optional[int] = None
    semester_number: Optional[int] = None
    term_type: Optional[str] = None
    marked_records: int = 0


class SemesterSubjects(BaseModel):
    """Subjects grouped under one semester, flagged relative to the current one."""

    semester_number: int
    term_type: Optional[str] = None
    is_current: bool = False
    is_past: bool = False
    is_future: bool = False
    subjects: list[AttendanceSubject]


class AttendanceContext(BaseModel):
    """Everything the subject-selection screen needs for a batch + branch."""

    academic_year_id: int
    year_label: Optional[str] = None
    program_id: int
    program_name: Optional[str] = None
    current_year: Optional[int] = None
    current_semester: Optional[int] = None
    term_type: Optional[str] = None
    sections: list[str] = []
    total_students: int = 0
    current_subjects: list[AttendanceSubject] = []
    semesters: list[SemesterSubjects] = []


class RosterRow(BaseModel):
    """One student in a class, with their status for the selected subject+date."""

    student_id: int
    roll_number: Optional[str] = None
    full_name: Optional[str] = None
    section: Optional[str] = None
    status: Optional[str] = None          # None = not yet marked for this date
    attendance_id: Optional[int] = None   # present when a record already exists


class AttendanceRoster(BaseModel):
    """The class roster for a subject on a given date (marking / edit screen)."""

    course_id: int
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    semester_number: Optional[int] = None
    term_type: Optional[str] = None
    class_date: date
    marked_count: int = 0
    students: list[RosterRow]


class BulkAttendanceItem(BaseModel):
    student_id: int
    status: AttendanceStatus


class BulkAttendanceIn(BaseModel):
    """Save/update a whole class's attendance for one subject + date."""

    course_id: int
    class_date: Optional[date] = None
    records: list[BulkAttendanceItem]


class BulkAttendanceResult(BaseModel):
    created: int
    updated: int
    total: int

from typing import Optional

from pydantic import BaseModel


class KpiSummary(BaseModel):
    """Top-level KPI cards for the operational dashboard."""

    total_students: int
    total_faculty: int
    total_courses: int
    total_programs: int
    attendance_percentage: Optional[float] = None
    average_marks: Optional[float] = None
    average_marks_percentage: Optional[float] = None
    risk_students: int
    pass_rate: Optional[float] = None


class ProgramPerformance(BaseModel):
    program_name: Optional[str] = None
    total_students: int
    avg_program_score: Optional[float] = None


class CompetencyAnalysis(BaseModel):
    competency_name: Optional[str] = None
    avg_score: Optional[float] = None
    competency_level: Optional[str] = None


class CoursePerformance(BaseModel):
    course_name: Optional[str] = None
    program_name: Optional[str] = None
    avg_score: Optional[float] = None
    enrolled_students: int


class StatusCount(BaseModel):
    status: Optional[str] = None
    count: int


class ClassAttendance(BaseModel):
    """Today's attendance for one class (branch + section)."""

    branch: Optional[str] = None
    section: Optional[str] = None
    present: int = 0
    total_records: int = 0
    attendance_percentage: Optional[float] = None


# --- Performance insights surfaced on the Dashboard ------------------------


class BranchPerf(BaseModel):
    program_name: Optional[str] = None
    avg_percentage: Optional[float] = None
    pass_percentage: Optional[float] = None


class SectionPerf(BaseModel):
    branch: Optional[str] = None
    section: Optional[str] = None
    semester_number: Optional[int] = None
    avg_percentage: Optional[float] = None


class BranchCount(BaseModel):
    branch: Optional[str] = None
    count: int = 0


class SubjectPerf(BaseModel):
    subject: Optional[str] = None
    branch: Optional[str] = None
    avg_percentage: Optional[float] = None
    fail_percentage: Optional[float] = None


class DashboardPerformance(BaseModel):
    branch_performance: list[BranchPerf] = []
    weak_sections: list[SectionPerf] = []
    at_risk_by_branch: list[BranchCount] = []
    weak_subjects: list[SubjectPerf] = []

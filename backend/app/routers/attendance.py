"""HTTP layer for the Attendance module.

Routers stay thin: they handle request/response concerns and delegate all
business logic to AttendanceService.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import Page
from app.schemas.attendance import (
    AttendanceContext,
    AttendanceCreate,
    AttendanceOut,
    AttendanceRoster,
    AttendanceUpdate,
    BulkAttendanceIn,
    BulkAttendanceResult,
    CourseAttendanceReport,
)
from app.services.attendance_service import AttendanceService

router = APIRouter(prefix="/attendance", tags=["Attendance"])


def get_attendance_service(db: Session = Depends(get_db)) -> AttendanceService:
    """Dependency that builds an AttendanceService bound to the request's DB session."""
    return AttendanceService(db)


@router.get("", response_model=Page[AttendanceOut])
def list_attendance(
    student_id: Optional[int] = Query(None, description="Filter by student"),
    course_id: Optional[int] = Query(None, description="Filter by course"),
    academic_year_id: Optional[int] = Query(None, description="Filter by the student's academic year / batch"),
    program_id: Optional[int] = Query(None, description="Filter by the student's program / branch"),
    section: Optional[str] = Query(None, description="Filter by the student's section (A-D)"),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    service: AttendanceService = Depends(get_attendance_service),
):
    items, total = service.list_attendance(
        student_id=student_id, course_id=course_id,
        academic_year_id=academic_year_id, program_id=program_id, section=section,
        sort_by=sort_by, order=order, skip=skip, limit=limit,
    )
    return Page(
        items=[AttendanceOut.from_attendance(a) for a in items], total=total, skip=skip, limit=limit
    )


@router.get("/context", response_model=AttendanceContext)
def attendance_context(
    academic_year_id: int = Query(..., description="Batch / academic year"),
    program_id: int = Query(..., description="Branch / program"),
    service: AttendanceService = Depends(get_attendance_service),
):
    """Current B.Tech year, semester and subjects for a batch + branch, plus
    all semesters (for historical drill-down)."""
    return service.context(academic_year_id, program_id)


@router.get("/roster", response_model=AttendanceRoster)
def attendance_roster(
    academic_year_id: int = Query(..., description="Batch / academic year"),
    program_id: int = Query(..., description="Branch / program"),
    course_id: int = Query(..., description="Subject"),
    class_date: Optional[date] = Query(None, description="Defaults to today"),
    section: Optional[str] = Query(None, description="Optional section (A-D)"),
    service: AttendanceService = Depends(get_attendance_service),
):
    """Class roster for a subject on a date, pre-filled with existing marks."""
    return service.roster(academic_year_id, program_id, course_id, class_date, section)


@router.post("/bulk", response_model=BulkAttendanceResult)
def bulk_mark_attendance(
    payload: BulkAttendanceIn, service: AttendanceService = Depends(get_attendance_service)
):
    """Save/update a whole class's attendance for one subject + date."""
    return service.bulk_upsert(payload)


@router.get("/student/{student_id}", response_model=list[AttendanceOut])
def student_attendance_history(
    student_id: int, service: AttendanceService = Depends(get_attendance_service)
):
    """View a student's full attendance history."""
    return [AttendanceOut.from_attendance(a) for a in service.student_history(student_id)]


@router.get("/report/course/{course_id}", response_model=CourseAttendanceReport)
def course_attendance_report(
    course_id: int, service: AttendanceService = Depends(get_attendance_service)
):
    """Per-student attendance report (percentages) for a course."""
    return service.course_report(course_id)


@router.get("/{attendance_id}", response_model=AttendanceOut)
def get_attendance(
    attendance_id: int, service: AttendanceService = Depends(get_attendance_service)
):
    return AttendanceOut.from_attendance(service.get_attendance(attendance_id))


@router.post("", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def mark_attendance(
    payload: AttendanceCreate, service: AttendanceService = Depends(get_attendance_service)
):
    """Mark attendance for a student in a course."""
    return AttendanceOut.from_attendance(service.mark_attendance(payload))


@router.put("/{attendance_id}", response_model=AttendanceOut)
def update_attendance(
    attendance_id: int,
    payload: AttendanceUpdate,
    service: AttendanceService = Depends(get_attendance_service),
):
    """Update an attendance record (status and/or date)."""
    return AttendanceOut.from_attendance(service.update_attendance(attendance_id, payload))


@router.delete("/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(
    attendance_id: int, service: AttendanceService = Depends(get_attendance_service)
):
    """Delete an attendance record."""
    service.delete_attendance(attendance_id)
    return None

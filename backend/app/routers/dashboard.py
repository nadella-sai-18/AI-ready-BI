"""HTTP layer for the operational Dashboard (read-only analytics).

All endpoints are backed by the existing semantic layer in sql/views.sql and a
few lightweight aggregate queries. Nothing here writes to the database.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.dashboard import (
    ClassAttendance,
    CompetencyAnalysis,
    CoursePerformance,
    DashboardPerformance,
    KpiSummary,
    ProgramPerformance,
    StatusCount,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_dashboard_service(db: Session = Depends(get_db)) -> DashboardService:
    return DashboardService(db)


@router.get("/kpis", response_model=KpiSummary)
def kpis(service: DashboardService = Depends(get_dashboard_service)):
    """Headline KPI cards for operational users."""
    return service.kpis()


@router.get("/program-performance", response_model=list[ProgramPerformance])
def program_performance(service: DashboardService = Depends(get_dashboard_service)):
    return service.program_performance()


@router.get("/competency-analysis", response_model=list[CompetencyAnalysis])
def competency_analysis(service: DashboardService = Depends(get_dashboard_service)):
    return service.competency_analysis()


@router.get("/course-performance", response_model=list[CoursePerformance])
def course_performance(service: DashboardService = Depends(get_dashboard_service)):
    return service.course_performance()


@router.get("/attendance-distribution", response_model=list[StatusCount])
def attendance_distribution(service: DashboardService = Depends(get_dashboard_service)):
    return service.attendance_distribution()


@router.get("/today-attendance", response_model=list[ClassAttendance])
def today_attendance(service: DashboardService = Depends(get_dashboard_service)):
    """Present students per class (branch + section) for the latest marked day."""
    return service.today_attendance_by_class()


@router.get("/performance-insights", response_model=DashboardPerformance)
def performance_insights(service: DashboardService = Depends(get_dashboard_service)):
    """Principal analytics: branch comparison, weakest sections/subjects, at-risk by branch."""
    return service.performance_insights()

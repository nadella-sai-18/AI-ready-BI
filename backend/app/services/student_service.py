"""Business logic for the Student module (B.Tech ERP)."""

from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.academic_year import AcademicYear
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentUpdate
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {
    "student_id",
    "full_name",
    "roll_number",
    "enrollment_year",
    "current_year",
    "current_semester",
    "section",
    "status",
    "program_id",
}


class StudentService:
    """CRUD for students against the shared database."""

    def __init__(self, db: Session):
        self.db = db

    def list_students(
        self,
        search: Optional[str] = None,
        program_id: Optional[int] = None,
        academic_year_id: Optional[int] = None,
        status: Optional[str] = None,
        section: Optional[str] = None,
        current_year: Optional[int] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        """Return (items, total). `search` matches name / email / roll number."""
        query = self.db.query(Student)

        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Student.full_name.ilike(pattern),
                    Student.email.ilike(pattern),
                    Student.roll_number.ilike(pattern),
                )
            )
        if program_id is not None:
            query = query.filter(Student.program_id == program_id)
        if academic_year_id is not None:
            query = query.filter(Student.academic_year_id == academic_year_id)
        if status:
            query = query.filter(Student.status == status)
        if section:
            query = query.filter(Student.section == section)
        if current_year is not None:
            query = query.filter(Student.current_year == current_year)

        query = apply_sort(query, Student, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Student.student_id)
        return paginate(query, skip, limit)

    def get_student(self, student_id: int) -> Student:
        student = self.db.get(Student, student_id)
        if student is None:
            raise NotFoundError(f"Student {student_id} not found")
        return student

    def create_student(self, payload: StudentCreate) -> Student:
        data = payload.model_dump()
        # Derive study year from the admission batch (whole batch shares a year):
        # current_year = (latest academic year - admission year) + 1, clamped 1..4.
        if data.get("academic_year_id"):
            ay = self.db.get(AcademicYear, data["academic_year_id"])
            max_start = self.db.query(func.max(AcademicYear.start_year)).scalar()
            if ay and ay.start_year:
                # Admission year = the batch's start year (e.g. 2024-2025 -> 2024).
                if not data.get("enrollment_year"):
                    data["enrollment_year"] = ay.start_year
                if not data.get("current_year") and max_start:
                    year = max(1, min(4, (max_start - ay.start_year) + 1))
                    data["current_year"] = year
                    if not data.get("current_semester"):
                        data["current_semester"] = year * 2 - 1
        student = Student(**data)
        self.db.add(student)
        self._commit()
        self.db.refresh(student)
        return student

    def update_student(self, student_id: int, payload: StudentUpdate) -> Student:
        student = self.get_student(student_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(student, field, value)
        self._commit()
        self.db.refresh(student)
        return student

    def delete_student(self, student_id: int) -> None:
        student = self.get_student(student_id)
        self.db.delete(student)
        self._commit()

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(
                "Operation violates a database constraint "
                "(e.g. duplicate roll number)"
            ) from exc

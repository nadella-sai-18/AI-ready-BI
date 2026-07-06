"""Business logic for the Semester module.

Semesters are SHARED across all programs (8 rows, one per number). The program
relationship lives on courses/students/exams, not on semesters (migration 016).
"""

from typing import Optional

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.semester import Semester
from app.models.student import Student
from app.schemas.semester import SemesterCreate, SemesterUpdate
from app.utils.academics import btech_year_of, term_of
from app.utils.exceptions import ConflictError, NotFoundError, ValidationError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"semester_id", "semester_name", "semester_number", "term_type", "btech_year", "status"}


class SemesterService:
    def __init__(self, db: Session):
        self.db = db

    def list_semesters(
        self,
        btech_year: Optional[int] = None,
        term_type: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        query = self.db.query(Semester)
        if btech_year is not None:
            query = query.filter(Semester.btech_year == btech_year)
        if term_type:
            query = query.filter(Semester.term_type == term_type)
        if status:
            query = query.filter(Semester.status == status)
        query = apply_sort(query, Semester, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Semester.semester_number)
        return paginate(query, skip, limit)

    def with_counts(self, semesters) -> list:
        """Attach active_students + courses_offered to a list of SemesterOut."""
        if not semesters:
            return semesters
        numbers = [s.semester_number for s in semesters if s.semester_number]
        ids = [s.semester_id for s in semesters]
        stu = dict(
            self.db.query(Student.current_semester, func.count(Student.student_id))
            .filter(Student.current_semester.in_(numbers) if numbers else False)
            .group_by(Student.current_semester)
            .all()
        )
        crs = dict(
            self.db.query(Course.semester_id, func.count(Course.course_id))
            .filter(Course.semester_id.in_(ids))
            .group_by(Course.semester_id)
            .all()
        )
        for s in semesters:
            s.active_students = int(stu.get(s.semester_number, 0))
            s.courses_offered = int(crs.get(s.semester_id, 0))
        return semesters

    def get_semester(self, semester_id: int) -> Semester:
        semester = self.db.get(Semester, semester_id)
        if semester is None:
            raise NotFoundError(f"Semester {semester_id} not found")
        return semester

    def current_semester(self) -> Optional[Semester]:
        return self.db.query(Semester).filter(Semester.is_current.is_(True)).first()

    def create_semester(self, payload: SemesterCreate) -> Semester:
        self._require_unique_number(payload.semester_number)
        data = payload.model_dump()
        num = data["semester_number"]
        # Auto-derive academic fields when not supplied.
        data["semester_name"] = data.get("semester_name") or f"Semester {num}"
        data["term_type"] = data.get("term_type") or term_of(num)
        data["btech_year"] = data.get("btech_year") or btech_year_of(num)
        data["academic_period"] = data.get("academic_period") or (
            "Jul-Nov" if num % 2 == 1 else "Dec-Apr"
        )
        semester = Semester(**data)
        self.db.add(semester)
        self._commit()
        self.db.refresh(semester)
        if semester.is_current:
            self._make_current(semester.semester_id)
        return semester

    def update_semester(self, semester_id: int, payload: SemesterUpdate) -> Semester:
        semester = self.get_semester(semester_id)
        updates = payload.model_dump(exclude_unset=True)
        new_number = updates.get("semester_number")
        if new_number is not None and new_number != semester.semester_number:
            self._require_unique_number(new_number)
        for field, value in updates.items():
            setattr(semester, field, value)
        self._commit()
        # Enforce a single current semester.
        if updates.get("is_current") is True:
            self._make_current(semester_id)
        self.db.refresh(semester)
        return semester

    def set_current(self, semester_id: int) -> Semester:
        """Mark exactly one semester as the current operational semester."""
        semester = self.get_semester(semester_id)
        self._make_current(semester_id)
        self.db.refresh(semester)
        return semester

    def delete_semester(self, semester_id: int) -> None:
        semester = self.get_semester(semester_id)
        self.db.delete(semester)
        self._commit()

    # --- helpers ---------------------------------------------------------
    def _require_unique_number(self, number: int) -> None:
        exists = (
            self.db.query(Semester.semester_id)
            .filter(Semester.semester_number == number)
            .first()
        )
        if exists is not None:
            raise ValidationError(f"Semester {number} already exists (semesters are unique 1-8).")

    def _make_current(self, semester_id: int) -> None:
        """Set is_current on one semester and clear it on all others."""
        self.db.query(Semester).filter(Semester.semester_id != semester_id).update(
            {Semester.is_current: False}, synchronize_session=False
        )
        self.db.query(Semester).filter(Semester.semester_id == semester_id).update(
            {Semester.is_current: True}, synchronize_session=False
        )
        self.db.commit()

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(
                "Cannot complete: the semester is still referenced by courses"
            ) from exc

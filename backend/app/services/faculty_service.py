"""Business logic for the Faculty module."""

from typing import Optional

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.faculty import Faculty
from app.schemas.faculty import FacultyCreate, FacultyUpdate
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"faculty_id", "full_name", "email", "department"}


class FacultyService:
    """CRUD for faculty against the shared database."""

    def __init__(self, db: Session):
        self.db = db

    def list_faculty(
        self,
        search: Optional[str] = None,
        department: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        query = self.db.query(Faculty)
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(Faculty.full_name.ilike(pattern), Faculty.email.ilike(pattern))
            )
        if department:
            query = query.filter(Faculty.department.ilike(f"%{department}%"))

        query = apply_sort(query, Faculty, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Faculty.faculty_id)
        return paginate(query, skip, limit)

    def get_faculty(self, faculty_id: int) -> Faculty:
        faculty = self.db.get(Faculty, faculty_id)
        if faculty is None:
            raise NotFoundError(f"Faculty {faculty_id} not found")
        return faculty

    def create_faculty(self, payload: FacultyCreate) -> Faculty:
        faculty = Faculty(**payload.model_dump())
        self.db.add(faculty)
        self._commit()
        self.db.refresh(faculty)
        return faculty

    def update_faculty(self, faculty_id: int, payload: FacultyUpdate) -> Faculty:
        faculty = self.get_faculty(faculty_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(faculty, field, value)
        self._commit()
        self.db.refresh(faculty)
        return faculty

    def delete_faculty(self, faculty_id: int) -> None:
        faculty = self.get_faculty(faculty_id)
        self.db.delete(faculty)
        self._commit()

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError("Operation violates a database constraint") from exc

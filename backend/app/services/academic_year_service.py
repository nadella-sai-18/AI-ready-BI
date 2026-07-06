"""Business logic for the Academic Year module."""

from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.academic_year import AcademicYear
from app.schemas.academic_year import AcademicYearCreate, AcademicYearUpdate
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"academic_year_id", "year_label", "start_year", "end_year"}


class AcademicYearService:
    def __init__(self, db: Session):
        self.db = db

    def list_years(
        self,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        query = self.db.query(AcademicYear)
        if search:
            query = query.filter(AcademicYear.year_label.ilike(f"%{search}%"))
        query = apply_sort(query, AcademicYear, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(AcademicYear.start_year)
        return paginate(query, skip, limit)

    def get_year(self, academic_year_id: int) -> AcademicYear:
        year = self.db.get(AcademicYear, academic_year_id)
        if year is None:
            raise NotFoundError(f"Academic year {academic_year_id} not found")
        return year

    def create_year(self, payload: AcademicYearCreate) -> AcademicYear:
        year = AcademicYear(**payload.model_dump())
        self.db.add(year)
        self._commit()
        self.db.refresh(year)
        return year

    def update_year(self, academic_year_id: int, payload: AcademicYearUpdate) -> AcademicYear:
        year = self.get_year(academic_year_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(year, field, value)
        self._commit()
        self.db.refresh(year)
        return year

    def delete_year(self, academic_year_id: int) -> None:
        year = self.get_year(academic_year_id)
        self.db.delete(year)
        self._commit()

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(
                "Cannot complete: the academic year is still referenced by students"
            ) from exc

"""Business logic for the Program module."""

from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.program import Program
from app.schemas.program import ProgramCreate, ProgramUpdate
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"program_id", "program_name", "duration_years"}


class ProgramService:
    def __init__(self, db: Session):
        self.db = db

    def list_programs(
        self,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        query = self.db.query(Program)
        if search:
            query = query.filter(Program.program_name.ilike(f"%{search}%"))
        query = apply_sort(query, Program, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Program.program_id)
        return paginate(query, skip, limit)

    def get_program(self, program_id: int) -> Program:
        program = self.db.get(Program, program_id)
        if program is None:
            raise NotFoundError(f"Program {program_id} not found")
        return program

    def create_program(self, payload: ProgramCreate) -> Program:
        program = Program(**payload.model_dump())
        self.db.add(program)
        self._commit()
        self.db.refresh(program)
        return program

    def update_program(self, program_id: int, payload: ProgramUpdate) -> Program:
        program = self.get_program(program_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(program, field, value)
        self._commit()
        self.db.refresh(program)
        return program

    def delete_program(self, program_id: int) -> None:
        program = self.get_program(program_id)
        self.db.delete(program)
        self._commit()

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(
                "Cannot complete: the program is still referenced by "
                "students, semesters, or courses"
            ) from exc

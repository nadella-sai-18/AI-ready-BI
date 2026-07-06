"""Business logic for the Course module.

Validates program/semester linkage and (optionally) the assigned faculty.
"""

from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.faculty import Faculty
from app.models.program import Program
from app.models.semester import Semester
from app.schemas.course import CourseCreate, CourseUpdate
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"course_id", "course_name", "course_code", "credits", "program_id", "semester_id"}


class CourseService:
    def __init__(self, db: Session):
        self.db = db

    def list_courses(
        self,
        search: Optional[str] = None,
        program_id: Optional[int] = None,
        semester_id: Optional[int] = None,
        faculty_id: Optional[int] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        query = self.db.query(Course)
        if search:
            query = query.filter(Course.course_name.ilike(f"%{search}%"))
        if program_id is not None:
            query = query.filter(Course.program_id == program_id)
        if semester_id is not None:
            query = query.filter(Course.semester_id == semester_id)
        if faculty_id is not None:
            query = query.filter(Course.faculty_id == faculty_id)

        query = apply_sort(query, Course, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Course.course_id)
        return paginate(query, skip, limit)

    def get_course(self, course_id: int) -> Course:
        course = self.db.get(Course, course_id)
        if course is None:
            raise NotFoundError(f"Course {course_id} not found")
        return course

    def create_course(self, payload: CourseCreate) -> Course:
        self._validate_links(payload.program_id, payload.semester_id)
        self._validate_faculty(payload.faculty_id)
        course = Course(**payload.model_dump())
        self.db.add(course)
        self._commit()
        self.db.refresh(course)
        return course

    def update_course(self, course_id: int, payload: CourseUpdate) -> Course:
        course = self.get_course(course_id)
        updates = payload.model_dump(exclude_unset=True)

        new_program_id = updates.get("program_id", course.program_id)
        new_semester_id = updates.get("semester_id", course.semester_id)
        if "program_id" in updates or "semester_id" in updates:
            self._validate_links(new_program_id, new_semester_id)
        if "faculty_id" in updates:
            self._validate_faculty(updates["faculty_id"])

        for field, value in updates.items():
            setattr(course, field, value)
        self._commit()
        self.db.refresh(course)
        return course

    def delete_course(self, course_id: int) -> None:
        course = self.get_course(course_id)
        self.db.delete(course)
        self._commit()

    # --- helpers ---------------------------------------------------------
    def _validate_links(self, program_id: int, semester_id: int) -> None:
        if self.db.get(Program, program_id) is None:
            raise NotFoundError(f"Program {program_id} not found")
        semester = self.db.get(Semester, semester_id)
        if semester is None:
            raise NotFoundError(f"Semester {semester_id} not found")
        if semester.program_id is not None and semester.program_id != program_id:
            raise ConflictError(
                f"Semester {semester_id} does not belong to program {program_id}"
            )

    def _validate_faculty(self, faculty_id: Optional[int]) -> None:
        if faculty_id is not None and self.db.get(Faculty, faculty_id) is None:
            raise NotFoundError(f"Faculty {faculty_id} not found")

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(
                "Operation violates a database constraint (e.g. duplicate course code)"
            ) from exc

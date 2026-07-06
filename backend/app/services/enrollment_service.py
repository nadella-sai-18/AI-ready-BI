"""Business logic for the Enrollment module.

Handles enrolling a student in a course, removing an enrollment, and viewing
enrollments by student or by course. Validates foreign keys (student + course
must exist) and prevents duplicate enrollments of the same student/course.
"""

from datetime import date
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.schemas.enrollment import EnrollmentCreate, EnrollmentUpdate
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"enrollment_id", "student_id", "course_id", "enrollment_date", "status"}


class EnrollmentService:
    """Encapsulates enrollment operations against the shared database."""

    def __init__(self, db: Session):
        self.db = db

    def list_enrollments(
        self,
        student_id: Optional[int] = None,
        course_id: Optional[int] = None,
        status: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        """Return (items, total), optionally filtered by student/course/status."""
        query = self.db.query(Enrollment)
        if student_id is not None:
            query = query.filter(Enrollment.student_id == student_id)
        if course_id is not None:
            query = query.filter(Enrollment.course_id == course_id)
        if status:
            query = query.filter(Enrollment.status == status)

        query = apply_sort(query, Enrollment, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Enrollment.enrollment_id)
        return paginate(query, skip, limit)

    def get_enrollment(self, enrollment_id: int) -> Enrollment:
        """Return one enrollment or raise NotFoundError."""
        enrollment = self.db.get(Enrollment, enrollment_id)
        if enrollment is None:
            raise NotFoundError(f"Enrollment {enrollment_id} not found")
        return enrollment

    def list_by_student(self, student_id: int) -> list[Enrollment]:
        """View all enrollments for a student (validates the student exists)."""
        self._require_student(student_id)
        return (
            self.db.query(Enrollment)
            .filter(Enrollment.student_id == student_id)
            .order_by(Enrollment.enrollment_id)
            .all()
        )

    def list_by_course(self, course_id: int) -> list[Enrollment]:
        """View all enrollments for a course (validates the course exists)."""
        self._require_course(course_id)
        return (
            self.db.query(Enrollment)
            .filter(Enrollment.course_id == course_id)
            .order_by(Enrollment.enrollment_id)
            .all()
        )

    def enroll(self, payload: EnrollmentCreate) -> Enrollment:
        """Enroll a student in a course after validating the linkage."""
        self._require_student(payload.student_id)
        self._require_course(payload.course_id)

        existing = (
            self.db.query(Enrollment)
            .filter(
                Enrollment.student_id == payload.student_id,
                Enrollment.course_id == payload.course_id,
            )
            .first()
        )
        if existing is not None:
            raise ConflictError(
                f"Student {payload.student_id} is already enrolled in course {payload.course_id}"
            )

        enrollment = Enrollment(
            student_id=payload.student_id,
            course_id=payload.course_id,
            enrollment_date=payload.enrollment_date or date.today(),
            status=payload.status or "Ongoing",
        )
        self.db.add(enrollment)
        self._commit()
        self.db.refresh(enrollment)
        return enrollment

    def update_enrollment(self, enrollment_id: int, payload: EnrollmentUpdate) -> Enrollment:
        """Update an enrollment's completion status."""
        enrollment = self.get_enrollment(enrollment_id)
        enrollment.status = payload.status
        self._commit()
        self.db.refresh(enrollment)
        return enrollment

    def remove(self, enrollment_id: int) -> None:
        """Remove an enrollment by id."""
        enrollment = self.get_enrollment(enrollment_id)
        self.db.delete(enrollment)
        self._commit()

    # --- helpers ---------------------------------------------------------
    def _require_student(self, student_id: int) -> None:
        if self.db.get(Student, student_id) is None:
            raise NotFoundError(f"Student {student_id} not found")

    def _require_course(self, course_id: int) -> None:
        if self.db.get(Course, course_id) is None:
            raise NotFoundError(f"Course {course_id} not found")

    def _commit(self) -> None:
        """Commit, converting DB integrity errors into a domain ConflictError."""
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError("Operation violates a database constraint") from exc

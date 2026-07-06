"""Business logic for the Attendance module.

Handles marking and updating attendance, a per-course attendance report, and a
per-student attendance history. Validates foreign keys (student + course must
exist) and prevents duplicate marks for the same student/course/date.
"""

from datetime import date
from typing import Optional

from sqlalchemy import case, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.academic_year import AcademicYear
from app.models.attendance import Attendance
from app.models.course import Course
from app.models.program import Program
from app.models.semester import Semester
from app.models.student import Student
from app.schemas.attendance import (
    AttendanceContext,
    AttendanceCreate,
    AttendanceReportRow,
    AttendanceRoster,
    AttendanceSubject,
    AttendanceUpdate,
    BulkAttendanceIn,
    BulkAttendanceResult,
    CourseAttendanceReport,
    RosterRow,
    SemesterSubjects,
)
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

# Active students only (exclude graduated / discontinued) when building rosters.

SORTABLE = {"attendance_id", "student_id", "course_id", "class_date", "status"}


class AttendanceService:
    """Encapsulates attendance operations against the shared database."""

    def __init__(self, db: Session):
        self.db = db

    def list_attendance(
        self,
        student_id: Optional[int] = None,
        course_id: Optional[int] = None,
        academic_year_id: Optional[int] = None,
        program_id: Optional[int] = None,
        section: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        """Return (items, total), optionally filtered by student and/or course.

        Also supports drilling down by the student's academic year, program
        (branch) and section — these join to the ``students`` table.
        """
        query = self.db.query(Attendance)
        if student_id is not None:
            query = query.filter(Attendance.student_id == student_id)
        if course_id is not None:
            query = query.filter(Attendance.course_id == course_id)

        # Student-attribute filters require a join to the students table.
        if academic_year_id is not None or program_id is not None or section is not None:
            query = query.join(Student, Student.student_id == Attendance.student_id)
            if academic_year_id is not None:
                query = query.filter(Student.academic_year_id == academic_year_id)
            if program_id is not None:
                query = query.filter(Student.program_id == program_id)
            if section is not None:
                query = query.filter(Student.section == section)

        query = apply_sort(query, Attendance, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Attendance.attendance_id)
        return paginate(query, skip, limit)

    def get_attendance(self, attendance_id: int) -> Attendance:
        """Return one attendance record or raise NotFoundError."""
        att = self.db.get(Attendance, attendance_id)
        if att is None:
            raise NotFoundError(f"Attendance {attendance_id} not found")
        return att

    def mark_attendance(self, payload: AttendanceCreate) -> Attendance:
        """Mark attendance after validating linkage and preventing duplicates."""
        self._require_student(payload.student_id)
        self._require_course(payload.course_id)
        class_date = payload.class_date or date.today()

        existing = (
            self.db.query(Attendance)
            .filter(
                Attendance.student_id == payload.student_id,
                Attendance.course_id == payload.course_id,
                Attendance.class_date == class_date,
            )
            .first()
        )
        if existing is not None:
            raise ConflictError(
                f"Attendance already marked for student {payload.student_id} "
                f"in course {payload.course_id} on {class_date}"
            )

        att = Attendance(
            student_id=payload.student_id,
            course_id=payload.course_id,
            class_date=class_date,
            status=payload.status,
        )
        self.db.add(att)
        self._commit()
        self.db.refresh(att)
        return att

    def update_attendance(self, attendance_id: int, payload: AttendanceUpdate) -> Attendance:
        """Partially update an attendance record (status and/or date)."""
        att = self.get_attendance(attendance_id)
        updates = payload.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(att, field, value)
        self._commit()
        self.db.refresh(att)
        return att

    def delete_attendance(self, attendance_id: int) -> None:
        """Delete an attendance record by id."""
        att = self.get_attendance(attendance_id)
        self.db.delete(att)
        self._commit()

    def student_history(self, student_id: int) -> list[Attendance]:
        """Return a student's full attendance history (validates the student exists)."""
        self._require_student(student_id)
        return (
            self.db.query(Attendance)
            .filter(Attendance.student_id == student_id)
            .order_by(Attendance.class_date, Attendance.attendance_id)
            .all()
        )

    def course_report(self, course_id: int) -> CourseAttendanceReport:
        """Build a per-student attendance report for a course."""
        course = self.db.get(Course, course_id)
        if course is None:
            raise NotFoundError(f"Course {course_id} not found")

        present = func.sum(case((Attendance.status == "Present", 1), else_=0))
        absent = func.sum(case((Attendance.status == "Absent", 1), else_=0))
        late = func.sum(case((Attendance.status == "Late", 1), else_=0))

        results = (
            self.db.query(
                Attendance.student_id.label("student_id"),
                Student.full_name.label("student_name"),
                func.count(Attendance.attendance_id).label("total_classes"),
                present.label("present"),
                absent.label("absent"),
                late.label("late"),
            )
            .join(Student, Student.student_id == Attendance.student_id, isouter=True)
            .filter(Attendance.course_id == course_id)
            .group_by(Attendance.student_id, Student.full_name)
            .order_by(Attendance.student_id)
            .all()
        )

        rows = []
        for r in results:
            total = int(r.total_classes or 0)
            present_count = int(r.present or 0)
            pct = round(present_count * 100.0 / total, 2) if total else 0.0
            rows.append(
                AttendanceReportRow(
                    student_id=r.student_id,
                    student_name=r.student_name,
                    total_classes=total,
                    present=present_count,
                    absent=int(r.absent or 0),
                    late=int(r.late or 0),
                    attendance_percentage=pct,
                )
            )

        return CourseAttendanceReport(
            course_id=course.course_id, course_name=course.course_name, rows=rows
        )

    # --- Academic attendance flow --------------------------------------
    def context(self, academic_year_id: int, program_id: int) -> AttendanceContext:
        """Build the batch + branch context: current year/semester and subjects.

        The current semester is taken from the students of this batch + branch
        (their ``current_semester`` is set from the admission cohort), so the
        UI shows the subjects that are actually relevant right now — not old
        subjects from earlier semesters.
        """
        year = self.db.get(AcademicYear, academic_year_id)
        if year is None:
            raise NotFoundError(f"Academic year {academic_year_id} not found")
        program = self.db.get(Program, program_id)
        if program is None:
            raise NotFoundError(f"Program {program_id} not found")

        students = self._roster_query(academic_year_id, program_id).all()
        total_students = len(students)
        sections = sorted({s.section for s in students if s.section})
        cur_year = self._mode([s.current_year for s in students if s.current_year])
        cur_sem = self._mode([s.current_semester for s in students if s.current_semester])

        # The 8 shared academic semesters (subjects are filtered per program below).
        sem_rows = (
            self.db.query(Semester)
            .order_by(Semester.semester_number)
            .all()
        )
        marked = self._marked_counts(academic_year_id, program_id)

        semesters: list[SemesterSubjects] = []
        current_subjects: list[AttendanceSubject] = []
        cur_term = None
        for sem in sem_rows:
            # Semesters are shared across programs, so scope courses to this branch.
            courses = (
                self.db.query(Course)
                .filter(Course.semester_id == sem.semester_id, Course.program_id == program_id)
                .order_by(Course.course_code, Course.course_id)
                .all()
            )
            if not courses:
                continue
            subs = [
                AttendanceSubject(
                    course_id=c.course_id,
                    course_name=c.course_name,
                    course_code=c.course_code,
                    semester_id=sem.semester_id,
                    semester_number=sem.semester_number,
                    term_type=sem.term_type,
                    marked_records=marked.get(c.course_id, 0),
                )
                for c in courses
            ]
            is_current = cur_sem is not None and sem.semester_number == cur_sem
            semesters.append(
                SemesterSubjects(
                    semester_number=sem.semester_number,
                    term_type=sem.term_type,
                    is_current=is_current,
                    is_past=cur_sem is not None and sem.semester_number < cur_sem,
                    is_future=cur_sem is not None and sem.semester_number > cur_sem,
                    subjects=subs,
                )
            )
            if is_current:
                current_subjects = subs
                cur_term = sem.term_type

        return AttendanceContext(
            academic_year_id=academic_year_id,
            year_label=year.year_label,
            program_id=program_id,
            program_name=program.program_name,
            current_year=cur_year,
            current_semester=cur_sem,
            term_type=cur_term,
            sections=sections,
            total_students=total_students,
            current_subjects=current_subjects,
            semesters=semesters,
        )

    def roster(
        self,
        academic_year_id: int,
        program_id: int,
        course_id: int,
        class_date: Optional[date] = None,
        section: Optional[str] = None,
    ) -> AttendanceRoster:
        """Return the class roster for a subject on a date, pre-filled with any
        attendance already marked (so the screen doubles as an edit view)."""
        course = self.db.get(Course, course_id)
        if course is None:
            raise NotFoundError(f"Course {course_id} not found")
        the_date = class_date or date.today()

        query = self._roster_query(academic_year_id, program_id)
        if section:
            query = query.filter(Student.section == section)
        students = query.order_by(Student.section, Student.roll_number, Student.student_id).all()

        # Existing attendance for these students, this course + date.
        existing = self._existing_marks(course_id, the_date, [s.student_id for s in students])

        rows = []
        marked_count = 0
        for s in students:
            att = existing.get(s.student_id)
            if att is not None:
                marked_count += 1
            rows.append(
                RosterRow(
                    student_id=s.student_id,
                    roll_number=s.roll_number,
                    full_name=s.full_name,
                    section=s.section,
                    status=att.status if att else None,
                    attendance_id=att.attendance_id if att else None,
                )
            )

        sem = course.semester
        return AttendanceRoster(
            course_id=course.course_id,
            course_name=course.course_name,
            course_code=course.course_code,
            semester_number=sem.semester_number if sem else None,
            term_type=sem.term_type if sem else None,
            class_date=the_date,
            marked_count=marked_count,
            students=rows,
        )

    def bulk_upsert(self, payload: BulkAttendanceIn) -> BulkAttendanceResult:
        """Save a whole class's attendance for one subject + date in one call.

        Inserts new records and updates existing ones (student + course + date
        is unique), so re-saving simply edits the class's attendance.
        """
        self._require_course(payload.course_id)
        the_date = payload.class_date or date.today()

        student_ids = [r.student_id for r in payload.records]
        existing = self._existing_marks(payload.course_id, the_date, student_ids)

        created = updated = 0
        for rec in payload.records:
            att = existing.get(rec.student_id)
            if att is not None:
                if att.status != rec.status:
                    att.status = rec.status
                updated += 1
            else:
                self.db.add(
                    Attendance(
                        student_id=rec.student_id,
                        course_id=payload.course_id,
                        class_date=the_date,
                        status=rec.status,
                    )
                )
                created += 1
        self._commit()
        return BulkAttendanceResult(created=created, updated=updated, total=len(payload.records))

    def _roster_query(self, academic_year_id: int, program_id: int):
        """Base query for the students of a batch + branch (active cohort)."""
        return self.db.query(Student).filter(
            Student.academic_year_id == academic_year_id,
            Student.program_id == program_id,
            or_(Student.status == "Active", Student.status.is_(None)),
        )

    def _existing_marks(self, course_id: int, class_date: date, student_ids: list[int]) -> dict:
        """student_id -> Attendance for a course + date, limited to given students."""
        if not student_ids:
            return {}
        return {
            a.student_id: a
            for a in self.db.query(Attendance).filter(
                Attendance.course_id == course_id,
                Attendance.class_date == class_date,
                Attendance.student_id.in_(student_ids),
            )
        }

    def _marked_counts(self, academic_year_id: int, program_id: int) -> dict[int, int]:
        """course_id -> number of attendance rows for this batch + branch."""
        rows = (
            self.db.query(Attendance.course_id, func.count(Attendance.attendance_id))
            .join(Student, Student.student_id == Attendance.student_id)
            .filter(
                Student.academic_year_id == academic_year_id,
                Student.program_id == program_id,
            )
            .group_by(Attendance.course_id)
            .all()
        )
        return {course_id: int(count) for course_id, count in rows}

    @staticmethod
    def _mode(values: list) -> Optional[int]:
        """Most common value in a list (ties resolved by the larger value)."""
        if not values:
            return None
        counts: dict[int, int] = {}
        for v in values:
            counts[v] = counts.get(v, 0) + 1
        return max(counts, key=lambda k: (counts[k], k))

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

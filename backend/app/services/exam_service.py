"""Business logic for the Exam module.

Two responsibilities:
  1) operational exam management (CRUD + scheduling + marks-entry status)
  2) academic performance analytics for principal / management / admin

Branch, semester, term and faculty are derived via the exam's course
(course -> program / semester / faculty); nothing is duplicated on exams.
"""

from datetime import date, timedelta
from typing import Optional

from sqlalchemy import case, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.exam import Exam
from app.models.mark import Mark
from app.models.program import Program
from app.models.semester import Semester
from app.models.student import Student
from app.schemas.exam import (
    ExamContext,
    ExamCreate,
    ExamInsights,
    ExamRoster,
    ExamRosterRow,
    ExamStats,
    ExamSubject,
    ExamSummary,
    ExamUpdate,
    NamedScore,
)
from app.utils.academics import btech_year_of, resolve_semester, term_of
from app.utils.exceptions import ConflictError, NotFoundError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"exam_id", "exam_name", "exam_type", "exam_date", "max_marks", "course_id", "status"}
PASS_PCT = 40.0  # a mark is a pass at >= 40%


class ExamService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------ list
    def list_exams(
        self,
        search: Optional[str] = None,
        course_id: Optional[int] = None,
        exam_type: Optional[str] = None,
        status: Optional[str] = None,
        program_id: Optional[int] = None,
        semester_number: Optional[int] = None,
        btech_year: Optional[int] = None,
        term: Optional[str] = None,
        faculty_id: Optional[int] = None,
        upcoming: bool = False,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        query = self._scoped_exams(
            program_id=program_id, semester_number=semester_number,
            btech_year=btech_year, term=term, faculty_id=faculty_id,
        )
        if search:
            query = query.filter(Exam.exam_name.ilike(f"%{search}%"))
        if course_id is not None:
            query = query.filter(Exam.course_id == course_id)
        if exam_type:
            query = query.filter(Exam.exam_type == exam_type)
        if status:
            query = query.filter(Exam.status == status)
        if upcoming:
            today = date.today()
            query = query.filter(Exam.exam_date >= today, Exam.exam_date <= today + timedelta(days=7))

        query = apply_sort(query, Exam, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Exam.exam_id)
        return paginate(query, skip, limit)

    def attach_marks_summary(self, exams_out: list) -> None:
        """Fill marks_entered / expected_students / marks_status on ExamOut rows."""
        if not exams_out:
            return
        exam_ids = [e.exam_id for e in exams_out]
        counts = dict(
            self.db.query(Mark.exam_id, func.count(Mark.mark_id))
            .filter(Mark.exam_id.in_(exam_ids))
            .group_by(Mark.exam_id)
            .all()
        )
        cohort: dict[tuple, int] = {}
        for e in exams_out:
            entered = int(counts.get(e.exam_id, 0))
            expected = self._cohort_size(e.program_id, e.semester_number, cohort)
            e.marks_entered = entered
            e.expected_students = expected
            if entered == 0:
                e.marks_status = "Pending"
            elif expected and entered >= expected:
                e.marks_status = "Entered"
            else:
                e.marks_status = "Partial" if expected else "Entered"

    # ---------------------------------------------------------------- context
    def context(
        self,
        program_id: int,
        semester_number: Optional[int] = None,
        btech_year: Optional[int] = None,
        term: Optional[str] = None,
    ) -> ExamContext:
        """Subjects (courses) of a branch + semester, with per-subject exam stats."""
        program = self.db.get(Program, program_id)
        if program is None:
            raise NotFoundError(f"Program {program_id} not found")
        sem_no = resolve_semester(semester_number, btech_year, term)
        if sem_no is None:
            raise NotFoundError("Provide semester_number or (btech_year + term)")

        courses = (
            self.db.query(Course)
            .join(Semester, Semester.semester_id == Course.semester_id)
            .filter(Course.program_id == program_id, Semester.semester_number == sem_no)
            .order_by(Course.course_code, Course.course_id)
            .all()
        )

        subjects: list[ExamSubject] = []
        total_exams = 0
        for c in courses:
            exams = self.db.query(Exam).filter(Exam.course_id == c.course_id).all()
            exam_ids = [e.exam_id for e in exams]
            completed = sum(1 for e in exams if e.status == "Completed")
            with_marks = set()
            avg_pct = None
            if exam_ids:
                mark_rows = (
                    self.db.query(Mark.exam_id, Mark.marks_obtained, Exam.max_marks)
                    .join(Exam, Exam.exam_id == Mark.exam_id)
                    .filter(Mark.exam_id.in_(exam_ids))
                    .all()
                )
                with_marks = {r.exam_id for r in mark_rows}
                pcts = [
                    r.marks_obtained * 100.0 / r.max_marks
                    for r in mark_rows
                    if r.max_marks and r.marks_obtained is not None
                ]
                avg_pct = round(sum(pcts) / len(pcts), 1) if pcts else None
            pending = sum(1 for e in exams if e.exam_id not in with_marks)
            total_exams += len(exams)
            subjects.append(
                ExamSubject(
                    course_id=c.course_id,
                    course_name=c.course_name,
                    course_code=c.course_code,
                    faculty_id=c.faculty_id,
                    faculty_name=c.faculty.full_name if c.faculty else None,
                    exam_count=len(exams),
                    completed_count=completed,
                    pending_marks_count=pending,
                    avg_percentage=avg_pct,
                )
            )

        sections = [
            r[0] for r in self.db.query(Student.section)
            .filter(
                Student.program_id == program_id,
                Student.current_semester == sem_no,
                Student.section.isnot(None),
                or_(Student.status == "Active", Student.status.is_(None)),
            )
            .distinct().order_by(Student.section).all()
        ]

        return ExamContext(
            program_id=program_id,
            program_name=program.program_name,
            semester_number=sem_no,
            btech_year=btech_year_of(sem_no),
            term_type=term_of(sem_no),
            sections=sections,
            total_subjects=len(subjects),
            total_exams=total_exams,
            subjects=subjects,
        )

    # ---------------------------------------------------------------- summary
    def summary(
        self,
        program_id: Optional[int] = None,
        semester_number: Optional[int] = None,
        btech_year: Optional[int] = None,
        term: Optional[str] = None,
        faculty_id: Optional[int] = None,
    ) -> ExamSummary:
        today = date.today()
        base = self._scoped_exams(program_id, semester_number, btech_year, term, faculty_id)

        by_status = dict(
            base.with_entities(Exam.status, func.count(Exam.exam_id)).group_by(Exam.status).all()
        )
        total = sum(int(v) for v in by_status.values())
        todays = base.filter(Exam.exam_date == today).count()
        upcoming = base.filter(
            Exam.exam_date > today, Exam.exam_date <= today + timedelta(days=7)
        ).count()

        # Marks-derived metrics in scope.
        marks_q = self._scoped_marks(program_id, semester_number, btech_year, term, faculty_id)
        pct_expr = Mark.marks_obtained * 100.0 / Exam.max_marks
        agg = marks_q.with_entities(
            func.avg(pct_expr),
            func.count(Mark.mark_id),
            func.sum(case((pct_expr >= PASS_PCT, 1), else_=0)),
        ).first()
        avg_pct = round(float(agg[0]), 1) if agg and agg[0] is not None else None
        total_marks = int(agg[1] or 0) if agg else 0
        passed = int(agg[2] or 0) if agg else 0
        pass_pct = round(passed * 100.0 / total_marks, 1) if total_marks else None

        # Pending marks entry: past exams in scope with no marks.
        graded_ids = {r[0] for r in marks_q.with_entities(Mark.exam_id).distinct().all()}
        past_exams = base.filter(Exam.exam_date <= today).all()
        pending_marks = sum(1 for e in past_exams if e.exam_id not in graded_ids)
        subjects_pending = len({e.course_id for e in past_exams if e.exam_id not in graded_ids})

        return ExamSummary(
            total_exams=total,
            scheduled=int(by_status.get("Scheduled", 0)),
            completed=int(by_status.get("Completed", 0)),
            cancelled=int(by_status.get("Cancelled", 0)),
            todays_exams=todays,
            upcoming_exams=upcoming,
            average_marks=avg_pct,
            pass_percentage=pass_pct,
            pending_marks_entry=pending_marks,
            subjects_results_pending=subjects_pending,
        )

    # ------------------------------------------------------------ exam stats
    def exam_stats(self, exam_id: int) -> ExamStats:
        exam = self.get_exam(exam_id)
        course = exam.course
        sem_no = course.semester.semester_number if course and course.semester else None
        expected = self._cohort_size(course.program_id if course else None, sem_no, {})

        rows = (
            self.db.query(Mark.marks_obtained)
            .filter(Mark.exam_id == exam_id, Mark.marks_obtained.isnot(None))
            .all()
        )
        scores = [int(r[0]) for r in rows]
        entered = len(scores)
        avg = round(sum(scores) / entered, 1) if entered else None
        avg_pct = (
            round(avg * 100.0 / exam.max_marks, 1) if avg is not None and exam.max_marks else None
        )
        passed = sum(1 for s in scores if exam.max_marks and s * 100.0 / exam.max_marks >= PASS_PCT)
        failed = entered - passed
        return ExamStats(
            exam_id=exam_id,
            expected_students=expected,
            appeared=entered,
            absent=max(expected - entered, 0) if expected else 0,
            marks_entered=entered,
            pending_marks=max(expected - entered, 0) if expected else 0,
            average_marks=avg,
            average_percentage=avg_pct,
            highest=max(scores) if scores else None,
            lowest=min(scores) if scores else None,
            pass_count=passed,
            fail_count=failed,
            pass_percentage=round(passed * 100.0 / entered, 1) if entered else None,
        )

    # -------------------------------------------------------------- insights
    def insights(
        self,
        program_id: Optional[int] = None,
        semester_number: Optional[int] = None,
        btech_year: Optional[int] = None,
        term: Optional[str] = None,
        faculty_id: Optional[int] = None,
    ) -> ExamInsights:
        today = date.today()
        sem_no = resolve_semester(semester_number, btech_year, term)
        scope_bits = []
        if program_id:
            p = self.db.get(Program, program_id)
            scope_bits.append(p.program_name if p else f"Program {program_id}")
        if sem_no:
            scope_bits.append(f"Sem {sem_no}")
        scope = " · ".join(scope_bits) if scope_bits else "All exams"

        pct_expr = Mark.marks_obtained * 100.0 / Exam.max_marks

        # Student averages within scope.
        stu_q = (
            self._scoped_marks(program_id, semester_number, btech_year, term, faculty_id)
            .join(Student, Student.student_id == Mark.student_id)
            .with_entities(
                Student.student_id,
                Student.full_name,
                Student.roll_number,
                func.avg(pct_expr),
                func.count(Mark.mark_id),
                func.sum(case((pct_expr < PASS_PCT, 1), else_=0)),
            )
            .group_by(Student.student_id, Student.full_name, Student.roll_number)
        )
        students = [
            NamedScore(
                id=r[0], name=r[1], detail=r[2],
                value=round(float(r[3]), 1) if r[3] is not None else None,
                extra=float(r[5] or 0),
            )
            for r in stu_q.all()
        ]
        ranked = sorted([s for s in students if s.value is not None], key=lambda s: s.value)
        bottom = ranked[:5]
        top = list(reversed(ranked[-5:])) if ranked else []
        below = [s for s in ranked if s.value is not None and s.value < PASS_PCT][:20]
        # students with multiple failed exams
        multi_fail = sorted(
            [s for s in students if (s.extra or 0) >= 2], key=lambda s: s.extra, reverse=True
        )[:10]
        for s in multi_fail:
            s.detail = f"{int(s.extra)} failed exams"

        # Weak subjects (lowest average %). Course is already joined in _scoped_marks.
        subj_q = (
            self._scoped_marks(program_id, semester_number, btech_year, term, faculty_id)
            .with_entities(
                Course.course_id, Course.course_name,
                func.avg(pct_expr), func.count(Mark.mark_id),
                func.sum(case((pct_expr >= PASS_PCT, 1), else_=0)),
            )
            .group_by(Course.course_id, Course.course_name)
        )
        subjects = [
            NamedScore(
                id=r[0], name=r[1],
                value=round(float(r[2]), 1) if r[2] is not None else None,
                extra=round(float(r[4]) * 100.0 / r[3], 1) if r[3] else None,  # pass %
            )
            for r in subj_q.all()
        ]
        weak_subjects = sorted(
            [s for s in subjects if s.value is not None], key=lambda s: s.value
        )[:8]
        for s in weak_subjects:
            s.detail = f"pass {s.extra}%" if s.extra is not None else None

        # Branch performance (ignores program filter so it can compare).
        branch_q = (
            self._scoped_marks(None, semester_number, btech_year, term, faculty_id)
            .join(Program, Program.program_id == Course.program_id)
            .with_entities(
                Program.program_id, Program.program_name,
                func.avg(pct_expr), func.count(Mark.mark_id),
                func.sum(case((pct_expr >= PASS_PCT, 1), else_=0)),
            )
            .group_by(Program.program_id, Program.program_name)
        )
        branch_performance = sorted(
            [
                NamedScore(
                    id=r[0], name=r[1],
                    value=round(float(r[2]), 1) if r[2] is not None else None,
                    detail=f"pass {round(float(r[4]) * 100.0 / r[3], 1)}%" if r[3] else None,
                )
                for r in branch_q.all()
            ],
            key=lambda s: (s.value is not None, s.value or 0), reverse=True,
        )

        # Semester performance (ignores semester filter to compare across sems).
        sem_q = (
            self._scoped_marks(program_id, None, None, None, faculty_id)
            .with_entities(Semester.semester_number, func.avg(pct_expr))
            .group_by(Semester.semester_number)
        )
        semester_performance = sorted(
            [
                NamedScore(
                    id=r[0], name=f"Semester {r[0]}",
                    value=round(float(r[1]), 1) if r[1] is not None else None,
                )
                for r in sem_q.all()
            ],
            key=lambda s: s.id or 0,
        )

        # Pending marks exams (past, no marks).
        graded_ids = {
            r[0]
            for r in self._scoped_marks(program_id, semester_number, btech_year, term, faculty_id)
            .with_entities(Mark.exam_id).distinct().all()
        }
        past = (
            self._scoped_exams(program_id, semester_number, btech_year, term, faculty_id)
            .filter(Exam.exam_date <= today)
            .all()
        )
        pending_exams = [
            NamedScore(
                id=e.exam_id, name=e.exam_name,
                detail=f"{e.course.course_name if e.course else ''} · {e.exam_type or ''}".strip(" ·"),
            )
            for e in past if e.exam_id not in graded_ids
        ][:15]

        # Upcoming exams (next 7 days).
        upcoming = (
            self._scoped_exams(program_id, semester_number, btech_year, term, faculty_id)
            .filter(Exam.exam_date > today, Exam.exam_date <= today + timedelta(days=7))
            .order_by(Exam.exam_date)
            .all()
        )
        upcoming_exams = [
            NamedScore(
                id=e.exam_id, name=e.exam_name,
                detail=f"{e.course.course_name if e.course else ''} · {e.exam_date}",
            )
            for e in upcoming
        ][:15]

        return ExamInsights(
            scope=scope,
            top_students=top,
            bottom_students=bottom,
            students_below_threshold=below,
            weak_subjects=weak_subjects,
            branch_performance=branch_performance,
            semester_performance=semester_performance,
            pending_marks_exams=pending_exams,
            upcoming_exams=upcoming_exams,
        )

    # ------------------------------------------------------------- marks roster
    def roster(self, exam_id: int, section: Optional[str] = None) -> ExamRoster:
        """Cohort of students for an exam (program + semester), pre-filled with
        any marks already entered — powers the Enter/Edit Marks screen.
        Optionally scoped to a single section."""
        exam = self.get_exam(exam_id)
        course = exam.course
        sem_no = course.semester.semester_number if course and course.semester else None
        students = []
        if course and sem_no is not None:
            q = self.db.query(Student).filter(
                Student.program_id == course.program_id,
                Student.current_semester == sem_no,
                or_(Student.status == "Active", Student.status.is_(None)),
            )
            if section:
                q = q.filter(Student.section == section)
            students = q.order_by(Student.section, Student.roll_number, Student.student_id).all()
        existing = {}
        if students:
            existing = {
                m.student_id: m
                for m in self.db.query(Mark).filter(
                    Mark.exam_id == exam_id,
                    Mark.student_id.in_([s.student_id for s in students]),
                )
            }
        rows = [
            ExamRosterRow(
                student_id=s.student_id,
                roll_number=s.roll_number,
                full_name=s.full_name,
                section=s.section,
                marks_obtained=existing[s.student_id].marks_obtained if s.student_id in existing else None,
                status=existing[s.student_id].status if s.student_id in existing else None,
                mark_id=existing[s.student_id].mark_id if s.student_id in existing else None,
            )
            for s in students
        ]
        return ExamRoster(
            exam_id=exam_id,
            exam_name=exam.exam_name,
            exam_type=exam.exam_type,
            course_name=course.course_name if course else None,
            max_marks=exam.max_marks,
            students=rows,
        )

    # ------------------------------------------------------------------- CRUD
    def get_exam(self, exam_id: int) -> Exam:
        exam = self.db.get(Exam, exam_id)
        if exam is None:
            raise NotFoundError(f"Exam {exam_id} not found")
        return exam

    def create_exam(self, payload: ExamCreate) -> Exam:
        self._require_course(payload.course_id)
        exam = Exam(**payload.model_dump())
        self.db.add(exam)
        self._commit()
        self.db.refresh(exam)
        return exam

    def update_exam(self, exam_id: int, payload: ExamUpdate) -> Exam:
        exam = self.get_exam(exam_id)
        updates = payload.model_dump(exclude_unset=True)
        if "course_id" in updates and updates["course_id"] is not None:
            self._require_course(updates["course_id"])
        for field, value in updates.items():
            setattr(exam, field, value)
        self._commit()
        self.db.refresh(exam)
        return exam

    def delete_exam(self, exam_id: int) -> None:
        exam = self.get_exam(exam_id)
        self.db.delete(exam)
        self._commit()

    # ---------------------------------------------------------------- helpers
    def _scoped_exams(self, program_id, semester_number, btech_year, term, faculty_id):
        """Exam query with academic filters applied via the course join."""
        query = self.db.query(Exam)
        needs_join = any(v is not None for v in (program_id, semester_number, btech_year, term, faculty_id))
        if needs_join:
            query = query.join(Course, Course.course_id == Exam.course_id).join(
                Semester, Semester.semester_id == Course.semester_id
            )
            query = self._apply_academic_filters(
                query, program_id, semester_number, btech_year, term, faculty_id
            )
        return query

    def _scoped_marks(self, program_id, semester_number, btech_year, term, faculty_id):
        """Marks query joined to exam + course + semester, academic filters applied."""
        query = (
            self.db.query(Mark)
            .join(Exam, Exam.exam_id == Mark.exam_id)
            .join(Course, Course.course_id == Exam.course_id)
            .join(Semester, Semester.semester_id == Course.semester_id)
            .filter(Mark.marks_obtained.isnot(None), Exam.max_marks.isnot(None))
        )
        return self._apply_academic_filters(
            query, program_id, semester_number, btech_year, term, faculty_id
        )

    def _apply_academic_filters(self, query, program_id, semester_number, btech_year, term, faculty_id):
        if program_id is not None:
            query = query.filter(Course.program_id == program_id)
        if faculty_id is not None:
            query = query.filter(Course.faculty_id == faculty_id)
        sem_no = resolve_semester(semester_number, btech_year, term)
        if sem_no is not None:
            query = query.filter(Semester.semester_number == sem_no)
        elif btech_year is not None:  # whole year (both terms)
            query = query.filter(Semester.semester_number.in_((btech_year * 2 - 1, btech_year * 2)))
        elif term:  # term only
            query = query.filter(Semester.term_type == term)
        return query

    def _cohort_size(self, program_id, semester_number, cache: dict) -> int:
        """Active students currently in (program, semester) = expected exam takers."""
        if program_id is None or semester_number is None:
            return 0
        key = (program_id, semester_number)
        if key not in cache:
            cache[key] = (
                self.db.query(func.count(Student.student_id))
                .filter(
                    Student.program_id == program_id,
                    Student.current_semester == semester_number,
                    or_(Student.status == "Active", Student.status.is_(None)),
                )
                .scalar()
                or 0
            )
        return int(cache[key])

    def _require_course(self, course_id: int) -> None:
        if self.db.get(Course, course_id) is None:
            raise NotFoundError(f"Course {course_id} not found")

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(
                "Operation violates a database constraint "
                "(the exam may still have marks referencing it)"
            ) from exc

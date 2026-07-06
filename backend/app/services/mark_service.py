"""Business logic for the Marks module (with grade/CGPA computation)."""

from typing import Optional

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.exam import Exam
from app.models.mark import Mark
from app.models.student import Student
from app.schemas.mark import (
    BulkMarksIn,
    BulkMarksResult,
    MarkCreate,
    MarkOut,
    MarkUpdate,
    StudentResults,
)
from app.utils.exceptions import ConflictError, NotFoundError, ValidationError
from app.utils.pagination import apply_sort, paginate

SORTABLE = {"mark_id", "student_id", "exam_id", "marks_obtained"}


class MarkService:
    def __init__(self, db: Session):
        self.db = db

    def list_marks(
        self,
        student_id: Optional[int] = None,
        exam_id: Optional[int] = None,
        sort_by: Optional[str] = None,
        order: str = "asc",
        skip: int = 0,
        limit: int = 100,
    ):
        query = self.db.query(Mark)
        if student_id is not None:
            query = query.filter(Mark.student_id == student_id)
        if exam_id is not None:
            query = query.filter(Mark.exam_id == exam_id)

        query = apply_sort(query, Mark, sort_by, order, SORTABLE)
        if not sort_by:
            query = query.order_by(Mark.mark_id)
        return paginate(query, skip, limit)

    def get_mark(self, mark_id: int) -> Mark:
        mark = self.db.get(Mark, mark_id)
        if mark is None:
            raise NotFoundError(f"Mark {mark_id} not found")
        return mark

    def enter_marks(self, payload: MarkCreate) -> Mark:
        self._require_student(payload.student_id)
        exam = self._require_exam(payload.exam_id)
        self._check_range(payload.marks_obtained, exam)

        existing = (
            self.db.query(Mark)
            .filter(Mark.student_id == payload.student_id, Mark.exam_id == payload.exam_id)
            .first()
        )
        if existing is not None:
            raise ConflictError(
                f"Marks already entered for student {payload.student_id} "
                f"on exam {payload.exam_id}"
            )

        mark = Mark(
            student_id=payload.student_id,
            exam_id=payload.exam_id,
            marks_obtained=payload.marks_obtained,
        )
        self.db.add(mark)
        self._commit()
        self.db.refresh(mark)
        return mark

    def update_marks(self, mark_id: int, payload: MarkUpdate) -> Mark:
        mark = self.get_mark(mark_id)
        exam = self.db.get(Exam, mark.exam_id) if mark.exam_id else None
        self._check_range(payload.marks_obtained, exam)
        mark.marks_obtained = payload.marks_obtained
        self._commit()
        self.db.refresh(mark)
        return mark

    def delete_marks(self, mark_id: int) -> None:
        mark = self.get_mark(mark_id)
        self.db.delete(mark)
        self._commit()

    def bulk_upsert(self, payload: BulkMarksIn) -> BulkMarksResult:
        """Enter/update a whole class's marks for one exam (idempotent upsert).

        Supports Absent (status='Absent' -> marks blank) and optional remarks.
        """
        exam = self._require_exam(payload.exam_id)
        student_ids = [r.student_id for r in payload.records]
        existing = {}
        if student_ids:
            existing = {
                m.student_id: m
                for m in self.db.query(Mark).filter(
                    Mark.exam_id == payload.exam_id, Mark.student_id.in_(student_ids)
                )
            }
        created = updated = 0
        for rec in payload.records:
            absent = (rec.status or "Present") == "Absent"
            marks_value = None if absent else rec.marks_obtained
            if not absent:
                self._check_range(marks_value, exam)
            mark = existing.get(rec.student_id)
            if mark is not None:
                mark.marks_obtained = marks_value
                mark.status = "Absent" if absent else "Present"
                mark.remarks = rec.remarks
                updated += 1
            else:
                self.db.add(
                    Mark(
                        student_id=rec.student_id,
                        exam_id=payload.exam_id,
                        marks_obtained=marks_value,
                        status="Absent" if absent else "Present",
                        remarks=rec.remarks,
                    )
                )
                created += 1
        # Mark the exam completed once results exist.
        if exam.status != "Completed" and (created or existing):
            exam.status = "Completed"
        self._commit()
        return BulkMarksResult(created=created, updated=updated, total=len(payload.records))

    # -------------------------------------------------------- marks analytics
    @staticmethod
    def _scope(program_id, semester_number, section):
        """Build a WHERE clause + params for the marks views."""
        clauses, params = [], {}
        if program_id is not None:
            clauses.append("program_id = :program_id")
            params["program_id"] = program_id
        if semester_number is not None:
            clauses.append("semester_number = :semester_number")
            params["semester_number"] = semester_number
        if section:
            clauses.append("section = :section")
            params["section"] = section
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        return where, params

    def marks_summary(self, program_id=None, semester_number=None, section=None) -> "MarksSummary":
        from app.schemas.mark import MarksSummary

        where, params = self._scope(program_id, semester_number, section)
        perf = self.db.execute(text(f"""
            SELECT
              count(*) AS total_marks,
              count(*) FILTER (WHERE NOT is_absent) AS appeared,
              count(*) FILTER (WHERE is_absent) AS absent_marks,
              round(avg(percentage), 1) AS avg_pct,
              round(100.0 * count(*) FILTER (WHERE passed)
                    / NULLIF(count(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_pct
            FROM v_marks_detail {where}
        """), params).mappings().first()

        # Exams entry progress (section does not apply to exams).
        ex_where, ex_params = [], {}
        if program_id is not None:
            ex_where.append("c.program_id = :program_id"); ex_params["program_id"] = program_id
        if semester_number is not None:
            ex_where.append("sm.semester_number = :semester_number"); ex_params["semester_number"] = semester_number
        ex_clause = ("WHERE " + " AND ".join(ex_where)) if ex_where else ""
        ex = self.db.execute(text(f"""
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE has_marks) AS done
            FROM (
              SELECT e.exam_id, EXISTS(SELECT 1 FROM marks m WHERE m.exam_id = e.exam_id) AS has_marks
              FROM exams e JOIN courses c ON c.course_id = e.course_id
              JOIN semesters sm ON sm.semester_id = c.semester_id {ex_clause}
            ) t
        """), ex_params).mappings().first()

        s_where, s_params = self._scope(program_id, semester_number, section)
        risk = self.db.execute(text(f"""
            SELECT count(*) FILTER (WHERE at_risk) AS at_risk,
                   count(*) FILTER (WHERE absent_count > 0) AS with_absences
            FROM v_marks_student_performance {s_where}
        """), s_params).mappings().first()

        subj_where, subj_params = [], {}
        if program_id is not None:
            subj_where.append("program_id = :program_id"); subj_params["program_id"] = program_id
        if semester_number is not None:
            subj_where.append("semester_number = :semester_number"); subj_params["semester_number"] = semester_number
        subj_clause = ("WHERE " + " AND ".join(subj_where)) if subj_where else ""
        low_subj = self.db.execute(text(f"""
            SELECT count(*) AS n FROM v_marks_subject_performance {subj_clause}
            {"AND" if subj_clause else "WHERE"} avg_percentage < 50
        """), subj_params).scalar()

        total = int(ex["total"] or 0)
        done = int(ex["done"] or 0)
        return MarksSummary(
            total_exams=total,
            exams_fully_entered=done,
            exams_pending=total - done,
            total_marks=int(perf["total_marks"] or 0),
            appeared=int(perf["appeared"] or 0),
            absent_marks=int(perf["absent_marks"] or 0),
            average_percentage=float(perf["avg_pct"]) if perf["avg_pct"] is not None else None,
            pass_percentage=float(perf["pass_pct"]) if perf["pass_pct"] is not None else None,
            fail_percentage=round(100.0 - float(perf["pass_pct"]), 1) if perf["pass_pct"] is not None else None,
            students_at_risk=int(risk["at_risk"] or 0),
            students_with_absences=int(risk["with_absences"] or 0),
            low_avg_subjects=int(low_subj or 0),
        )

    def marks_insights(self, program_id=None, semester_number=None, section=None) -> "MarksInsights":
        from app.schemas.mark import MarkRow, MarksInsights

        where, params = self._scope(program_id, semester_number, section)
        scope_bits = []
        if program_id is not None:
            p = self.db.execute(text("SELECT program_name FROM programs WHERE program_id=:p"),
                                {"p": program_id}).scalar()
            scope_bits.append(p or f"Program {program_id}")
        if semester_number is not None:
            scope_bits.append(f"Sem {semester_number}")
        if section:
            scope_bits.append(f"Sec {section}")
        scope = " · ".join(scope_bits) if scope_bits else "All branches"

        def rows(sql, mapper):
            return [mapper(r) for r in self.db.execute(text(sql), params).mappings().all()]

        top = rows(
            f"SELECT student_id, student_name, section, branch, avg_percentage FROM v_marks_student_performance {where} "
            f"{'AND' if where else 'WHERE'} avg_percentage IS NOT NULL ORDER BY avg_percentage DESC LIMIT 5",
            lambda r: MarkRow(id=r["student_id"], name=r["student_name"], section=r["section"],
                              branch=r["branch"], value=float(r["avg_percentage"])),
        )
        bottom = rows(
            f"SELECT student_id, student_name, section, branch, avg_percentage FROM v_marks_student_performance {where} "
            f"{'AND' if where else 'WHERE'} avg_percentage IS NOT NULL ORDER BY avg_percentage ASC LIMIT 5",
            lambda r: MarkRow(id=r["student_id"], name=r["student_name"], section=r["section"],
                              branch=r["branch"], value=float(r["avg_percentage"])),
        )
        below = rows(
            f"SELECT student_id, student_name, section, branch, avg_percentage FROM v_marks_student_performance {where} "
            f"{'AND' if where else 'WHERE'} avg_percentage < 40 ORDER BY avg_percentage ASC LIMIT 20",
            lambda r: MarkRow(id=r["student_id"], name=r["student_name"], section=r["section"],
                              branch=r["branch"], value=float(r["avg_percentage"])),
        )
        multi = rows(
            f"SELECT student_id, student_name, section, branch, fail_count FROM v_marks_student_performance {where} "
            f"{'AND' if where else 'WHERE'} fail_count >= 3 ORDER BY fail_count DESC LIMIT 15",
            lambda r: MarkRow(id=r["student_id"], name=r["student_name"], section=r["section"],
                              branch=r["branch"], value=float(r["fail_count"]), detail=f"{int(r['fail_count'])} fails"),
        )
        absentees = rows(
            f"SELECT student_id, student_name, section, branch, absent_count FROM v_marks_student_performance {where} "
            f"{'AND' if where else 'WHERE'} absent_count > 0 ORDER BY absent_count DESC LIMIT 15",
            lambda r: MarkRow(id=r["student_id"], name=r["student_name"], section=r["section"],
                              branch=r["branch"], value=float(r["absent_count"]), detail=f"{int(r['absent_count'])} absent"),
        )
        at_risk = rows(
            f"SELECT student_id, student_name, section, branch, avg_percentage FROM v_marks_at_risk {where} "
            f"ORDER BY avg_percentage ASC NULLS FIRST LIMIT 20",
            lambda r: MarkRow(id=r["student_id"], name=r["student_name"], section=r["section"],
                              branch=r["branch"], value=float(r["avg_percentage"]) if r["avg_percentage"] is not None else None),
        )

        # Section performance (ignore section filter so sections compare).
        sec_where, sec_params = self._scope(program_id, semester_number, None)
        section_perf = [
            MarkRow(name=f"Section {r['section']}", branch=r["branch"], section=r["section"],
                    value=float(r["avg_percentage"]) if r["avg_percentage"] is not None else None,
                    detail=f"pass {r['pass_percentage']}%" if r["pass_percentage"] is not None else None)
            for r in self.db.execute(text(
                f"SELECT section, branch, avg_percentage, pass_percentage FROM v_marks_section_performance {sec_where} "
                f"ORDER BY avg_percentage DESC"), sec_params).mappings().all()
        ]
        # Branch performance (ignore program filter to compare branches).
        br_where, br_params = self._scope(None, semester_number, None)
        branch_perf = [
            MarkRow(name=r["branch"], value=float(r["avg_percentage"]) if r["avg_percentage"] is not None else None,
                    detail=f"pass {r['pass_percentage']}%" if r["pass_percentage"] is not None else None)
            for r in self.db.execute(text(
                f"SELECT branch, avg_percentage, pass_percentage FROM v_marks_branch_performance {br_where} "
                f"ORDER BY avg_percentage DESC"), br_params).mappings().all()
        ]
        # Weakest subjects.
        subj_where2, subj_params2 = [], {}
        if program_id is not None:
            subj_where2.append("program_id = :program_id"); subj_params2["program_id"] = program_id
        if semester_number is not None:
            subj_where2.append("semester_number = :semester_number"); subj_params2["semester_number"] = semester_number
        subj_clause2 = ("WHERE " + " AND ".join(subj_where2)) if subj_where2 else ""
        weak_subjects = [
            MarkRow(id=r["course_id"], name=r["subject"], branch=r["branch"],
                    value=float(r["avg_percentage"]) if r["avg_percentage"] is not None else None,
                    detail=f"fail {r['fail_percentage']}%" if r["fail_percentage"] is not None else None)
            for r in self.db.execute(text(
                f"SELECT course_id, subject, branch, avg_percentage, fail_percentage "
                f"FROM v_marks_subject_performance {subj_clause2} ORDER BY avg_percentage ASC LIMIT 8"),
                subj_params2).mappings().all()
        ]

        return MarksInsights(
            scope=scope, top_students=top, bottom_students=bottom, below_threshold=below,
            multiple_fails=multi, absentees=absentees, at_risk_students=at_risk,
            section_performance=section_perf, branch_performance=branch_perf, weak_subjects=weak_subjects,
        )

    def student_results(self, student_id: int) -> StudentResults:
        """A student's results across exams with %, grade, pass/fail and CGPA."""
        student = self.db.get(Student, student_id)
        if student is None:
            raise NotFoundError(f"Student {student_id} not found")

        marks = (
            self.db.query(Mark)
            .filter(Mark.student_id == student_id)
            .order_by(Mark.exam_id)
            .all()
        )
        rows = [MarkOut.from_mark(m) for m in marks]

        pcts = [r.percentage for r in rows if r.percentage is not None]
        gps = [r.grade_point for r in rows if r.grade_point is not None]
        average = round(sum(pcts) / len(pcts), 2) if pcts else None
        cgpa = round(sum(gps) / len(gps), 2) if gps else None

        return StudentResults(
            student_id=student.student_id,
            student_name=student.full_name,
            results=rows,
            exams_count=len(rows),
            average_percentage=average,
            cgpa=cgpa,
            passed_count=sum(1 for r in rows if r.passed),
            failed_count=sum(1 for r in rows if r.passed is False),
        )

    # --- helpers ---------------------------------------------------------
    def _require_student(self, student_id: int) -> None:
        if self.db.get(Student, student_id) is None:
            raise NotFoundError(f"Student {student_id} not found")

    def _require_exam(self, exam_id: int) -> Exam:
        exam = self.db.get(Exam, exam_id)
        if exam is None:
            raise NotFoundError(f"Exam {exam_id} not found")
        return exam

    def _check_range(self, marks_obtained: int, exam: Optional[Exam]) -> None:
        if exam is not None and exam.max_marks is not None and marks_obtained > exam.max_marks:
            raise ValidationError(
                f"marks_obtained ({marks_obtained}) exceeds the exam maximum "
                f"({exam.max_marks})"
            )

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError("Operation violates a database constraint") from exc

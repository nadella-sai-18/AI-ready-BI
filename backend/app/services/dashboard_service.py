"""Read-only dashboard analytics.

This service reuses the EXISTING semantic layer in `sql/views.sql`
(v_kpi_dashboard, v_program_performance, v_competency_analysis,
v_course_performance) plus a few lightweight aggregate queries. It never
modifies data or schema. The same views back Metabase and MinusX AI.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

# Pass threshold as a percentage of an exam's maximum marks (matches the
# Marks module's business rule).
PASS_PERCENTAGE = 40


def _to_float(value):
    return float(value) if value is not None else None


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def kpis(self) -> dict:
        """Aggregate the headline KPI cards from views + small queries."""
        summary = (
            self.db.execute(
                text(
                    "SELECT total_students, total_courses, total_faculty, "
                    "overall_avg_marks, risk_students_count FROM v_kpi_dashboard"
                )
            )
            .mappings()
            .first()
        )

        total_programs = self.db.execute(text("SELECT COUNT(*) FROM programs")).scalar()

        attendance_pct = self.db.execute(
            text(
                "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) "
                "/ NULLIF(COUNT(*), 0), 2) FROM attendance"
            )
        ).scalar()

        avg_pct = self.db.execute(
            text(
                "SELECT ROUND(AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)), 2) "
                "FROM marks m JOIN exams e ON m.exam_id = e.exam_id"
            )
        ).scalar()

        pass_rate = self.db.execute(
            text(
                "SELECT ROUND(100.0 * SUM(CASE WHEN e.max_marks > 0 AND "
                "(m.marks_obtained * 100.0 / e.max_marks) >= :thr THEN 1 ELSE 0 END) "
                "/ NULLIF(COUNT(*), 0), 2) "
                "FROM marks m JOIN exams e ON m.exam_id = e.exam_id"
            ),
            {"thr": PASS_PERCENTAGE},
        ).scalar()

        # Risk students by PERCENTAGE (avg exam % < 40) OR attendance % < 75.
        # This is more correct than the original v_risk_students, which compares
        # raw marks_obtained and misfires when exams have different max_marks.
        risk_students = self.db.execute(
            text(
                "WITH sp AS ("
                "  SELECT s.student_id,"
                "         AVG(m.marks_obtained * 100.0 / NULLIF(e.max_marks, 0)) AS avg_pct"
                "  FROM students s"
                "  LEFT JOIN marks m ON m.student_id = s.student_id"
                "  LEFT JOIN exams e ON e.exam_id = m.exam_id"
                "  GROUP BY s.student_id"
                "), att AS ("
                "  SELECT student_id,"
                "         100.0 * SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)"
                "         / NULLIF(COUNT(*), 0) AS att_pct"
                "  FROM attendance GROUP BY student_id"
                ") "
                "SELECT COUNT(*) FROM students s "
                "LEFT JOIN sp ON sp.student_id = s.student_id "
                "LEFT JOIN att ON att.student_id = s.student_id "
                "WHERE sp.avg_pct < :thr OR att.att_pct < 75"
            ),
            {"thr": PASS_PERCENTAGE},
        ).scalar()

        return {
            "total_students": summary["total_students"] or 0,
            "total_faculty": summary["total_faculty"] or 0,
            "total_courses": summary["total_courses"] or 0,
            "total_programs": total_programs or 0,
            "attendance_percentage": _to_float(attendance_pct),
            "average_marks": _to_float(avg_pct),
            "average_marks_percentage": _to_float(avg_pct),
            "risk_students": risk_students or 0,
            "pass_rate": _to_float(pass_rate),
        }

    def program_performance(self) -> list[dict]:
        rows = (
            self.db.execute(
                text(
                    "SELECT program_name, total_students, avg_program_score "
                    "FROM v_program_performance ORDER BY program_name"
                )
            )
            .mappings()
            .all()
        )
        return [
            {
                "program_name": r["program_name"],
                "total_students": r["total_students"] or 0,
                "avg_program_score": _to_float(r["avg_program_score"]),
            }
            for r in rows
        ]

    def competency_analysis(self) -> list[dict]:
        rows = (
            self.db.execute(
                text(
                    "SELECT competency_name, avg_score, competency_level "
                    "FROM v_competency_analysis ORDER BY avg_score DESC"
                )
            )
            .mappings()
            .all()
        )
        return [
            {
                "competency_name": r["competency_name"],
                "avg_score": _to_float(r["avg_score"]),
                "competency_level": r["competency_level"],
            }
            for r in rows
        ]

    def course_performance(self) -> list[dict]:
        rows = (
            self.db.execute(
                text(
                    "SELECT course_name, program_name, avg_score, enrolled_students "
                    "FROM v_course_performance ORDER BY avg_score DESC NULLS LAST"
                )
            )
            .mappings()
            .all()
        )
        return [
            {
                "course_name": r["course_name"],
                "program_name": r["program_name"],
                "avg_score": _to_float(r["avg_score"]),
                "enrolled_students": r["enrolled_students"] or 0,
            }
            for r in rows
        ]

    def performance_insights(self) -> dict:
        """Principal-facing performance analytics from the marks views."""
        branch = self.db.execute(text("""
            SELECT branch AS program_name,
                   ROUND(AVG(percentage), 1) AS avg_percentage,
                   ROUND(100.0 * COUNT(*) FILTER (WHERE passed)
                         / NULLIF(COUNT(*) FILTER (WHERE NOT is_absent), 0), 1) AS pass_percentage
            FROM v_marks_detail
            GROUP BY branch ORDER BY avg_percentage DESC
        """)).mappings().all()

        weak_sections = self.db.execute(text("""
            SELECT branch, section, semester_number, avg_percentage
            FROM v_marks_section_performance
            WHERE avg_percentage IS NOT NULL
            ORDER BY avg_percentage ASC LIMIT 6
        """)).mappings().all()

        at_risk = self.db.execute(text("""
            SELECT branch, COUNT(*) AS count FROM v_marks_at_risk
            GROUP BY branch ORDER BY count DESC
        """)).mappings().all()

        weak_subjects = self.db.execute(text("""
            SELECT subject, branch, avg_percentage, fail_percentage
            FROM v_marks_subject_performance
            WHERE avg_percentage IS NOT NULL
            ORDER BY avg_percentage ASC LIMIT 6
        """)).mappings().all()

        return {
            "branch_performance": [
                {"program_name": r["program_name"],
                 "avg_percentage": _to_float(r["avg_percentage"]),
                 "pass_percentage": _to_float(r["pass_percentage"])}
                for r in branch
            ],
            "weak_sections": [
                {"branch": r["branch"], "section": r["section"],
                 "semester_number": r["semester_number"],
                 "avg_percentage": _to_float(r["avg_percentage"])}
                for r in weak_sections
            ],
            "at_risk_by_branch": [
                {"branch": r["branch"], "count": r["count"] or 0} for r in at_risk
            ],
            "weak_subjects": [
                {"subject": r["subject"], "branch": r["branch"],
                 "avg_percentage": _to_float(r["avg_percentage"]),
                 "fail_percentage": _to_float(r["fail_percentage"])}
                for r in weak_subjects
            ],
        }

    def today_attendance_by_class(self) -> list[dict]:
        """Present students per class (branch + section) for the latest marked day."""
        rows = (
            self.db.execute(
                text(
                    "SELECT branch, section, present, total_records, attendance_percentage "
                    "FROM v_today_attendance_by_section ORDER BY branch, section"
                )
            )
            .mappings()
            .all()
        )
        return [
            {
                "branch": r["branch"],
                "section": r["section"],
                "present": r["present"] or 0,
                "total_records": r["total_records"] or 0,
                "attendance_percentage": _to_float(r["attendance_percentage"]),
            }
            for r in rows
        ]

    def attendance_distribution(self) -> list[dict]:
        rows = (
            self.db.execute(
                text(
                    "SELECT status, COUNT(*) AS count FROM attendance "
                    "GROUP BY status ORDER BY status"
                )
            )
            .mappings()
            .all()
        )
        return [{"status": r["status"], "count": r["count"]} for r in rows]

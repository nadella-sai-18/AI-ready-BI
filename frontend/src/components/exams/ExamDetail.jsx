import { useCallback, useEffect, useState } from "react";
import api from "../../api/client.js";
import Modal from "../Modal.jsx";
import { Alert, Badge, Button, Spinner } from "../ui.jsx";
import { Icon } from "../Icons.jsx";
import { EXAM_TYPE_TONE, STATUS_TONE } from "./examConstants.js";

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

function Stat({ label, value, tone = "slate" }) {
  const color = {
    slate: "text-slate-800", green: "text-emerald-600", red: "text-red-600",
    amber: "text-amber-600", indigo: "text-brand-600",
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value ?? "—"}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function ExamDetail({ open, examId, onClose, onEdit, onDelete, onEnterMarks }) {
  const [exam, setExam] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!open || !examId) return;
    setLoading(true);
    setError(null);
    try {
      const [e, s] = await Promise.all([
        api.get(`/exams/${examId}`),
        api.get(`/exams/${examId}/stats`),
      ]);
      setExam(e.data);
      setStats(s.data);
    } catch (err) {
      setError(err.userMessage || "Failed to load exam");
    } finally {
      setLoading(false);
    }
  }, [open, examId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Modal
      open={open}
      title={exam?.exam_name || "Exam details"}
      subtitle={exam ? `${exam.course_name || ""}` : ""}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {exam && (
            <>
              <Button variant="secondary" onClick={() => onEdit?.(exam)}>
                <Icon name="edit" className="h-4 w-4" /> Edit
              </Button>
              <Button variant="danger" onClick={() => onDelete?.(exam)}>
                <Icon name="trash" className="h-4 w-4" /> Delete
              </Button>
              <Button onClick={() => onEnterMarks?.(exam)}>
                <Icon name="marks" className="h-4 w-4" /> Enter Marks
              </Button>
            </>
          )}
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : error ? (
        <Alert tone="red">{error}</Alert>
      ) : exam ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {exam.exam_type && <Badge tone={EXAM_TYPE_TONE[exam.exam_type] || "slate"}>{exam.exam_type}</Badge>}
            {exam.status && <Badge tone={STATUS_TONE[exam.status] || "slate"} dot>{exam.status}</Badge>}
            {exam.marks_status && (
              <Badge tone={exam.marks_status === "Pending" ? "red" : exam.marks_status === "Partial" ? "amber" : "green"}>
                Marks {exam.marks_status}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <div>
              <InfoRow label="Branch" value={exam.program_name} />
              <InfoRow label="B.Tech Year" value={exam.btech_year ? `Year ${exam.btech_year}` : null} />
              <InfoRow label="Term" value={exam.term_type} />
              <InfoRow label="Semester" value={exam.semester_number ? `Semester ${exam.semester_number}` : null} />
              <InfoRow label="Subject" value={exam.course_name} />
              <InfoRow label="Faculty" value={exam.faculty_name} />
            </div>
            <div>
              <InfoRow label="Exam Type" value={exam.exam_type} />
              <InfoRow label="Max Marks" value={exam.max_marks} />
              <InfoRow label="Weightage" value={exam.weightage != null ? `${exam.weightage}%` : null} />
              <InfoRow label="Date" value={exam.exam_date} />
              <InfoRow
                label="Time"
                value={exam.start_time ? `${exam.start_time}${exam.end_time ? " – " + exam.end_time : ""}` : null}
              />
              <InfoRow label="Status" value={exam.status} />
            </div>
          </div>

          {exam.instructions && (
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Instructions</div>
              {exam.instructions}
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Result & Operations</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Expected" value={stats?.expected_students} />
              <Stat label="Appeared" value={stats?.appeared} tone="indigo" />
              <Stat label="Absent" value={stats?.absent} tone="amber" />
              <Stat label="Pending Marks" value={stats?.pending_marks} tone={stats?.pending_marks ? "red" : "green"} />
              <Stat label="Average %" value={stats?.average_percentage != null ? `${stats.average_percentage}%` : "—"} tone="indigo" />
              <Stat label="Highest" value={stats?.highest} tone="green" />
              <Stat label="Pass" value={stats?.pass_count} tone="green" />
              <Stat label="Fail" value={stats?.fail_count} tone="red" />
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

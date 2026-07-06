import { useEffect, useState } from "react";
import api from "../../api/client.js";
import { useToast } from "../Toast.jsx";
import Modal from "../Modal.jsx";
import { Badge, Button, Input, Label, Select, Spinner } from "../ui.jsx";
import { Icon } from "../Icons.jsx";
import { EXAM_TYPES } from "./examConstants.js";

/**
 * Create / edit an exam. Academic context (branch, B.Tech year, term,
 * semester) is fixed by the drill-down and shown as read-only chips; the
 * subject list is scoped to that branch + semester. Faculty is derived from
 * the chosen subject.
 */
export default function ExamForm({ open, exam, context, defaultCourseId, onSaved, onClose }) {
  const toast = useToast();
  const editing = !!exam;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (exam) {
      setForm({
        course_id: exam.course_id ?? "",
        exam_type: exam.exam_type ?? "",
        exam_name: exam.exam_name ?? "",
        max_marks: exam.max_marks ?? "",
        weightage: exam.weightage ?? "",
        exam_date: exam.exam_date ?? "",
        start_time: exam.start_time ?? "",
        end_time: exam.end_time ?? "",
        status: exam.status ?? "Scheduled",
        instructions: exam.instructions ?? "",
      });
    } else {
      setForm({
        course_id: defaultCourseId ?? "",
        exam_type: "",
        exam_name: "",
        max_marks: "",
        weightage: "",
        exam_date: "",
        start_time: "",
        end_time: "",
        status: "Scheduled",
        instructions: "",
      });
    }
  }, [open, exam, defaultCourseId]);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // Selecting a type auto-fills name + default max marks (create only).
  const onType = (t) => {
    const meta = EXAM_TYPES.find((x) => x.value === t);
    setForm((s) => ({
      ...s,
      exam_type: t,
      exam_name: !editing && (!s.exam_name || EXAM_TYPES.some((x) => x.value === s.exam_name)) ? t : s.exam_name,
      max_marks: !editing && !s.max_marks && meta ? meta.max : s.max_marks,
    }));
  };

  const subjects = context?.subjects || [];
  const selectedSubject = subjects.find((x) => String(x.course_id) === String(form.course_id));

  const save = async () => {
    setError(null);
    if (!form.course_id) return setError("Please select a subject.");
    if (!form.exam_name) return setError("Exam name is required.");
    if (!form.max_marks) return setError("Maximum marks is required.");
    const payload = {
      course_id: Number(form.course_id),
      exam_name: form.exam_name,
      max_marks: Number(form.max_marks),
      exam_type: form.exam_type || null,
      weightage: form.weightage === "" ? null : Number(form.weightage),
      exam_date: form.exam_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      status: form.status || "Scheduled",
      instructions: form.instructions || null,
    };
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/exams/${exam.exam_id}`, payload);
        toast.success("Exam updated");
      } else {
        await api.post("/exams", payload);
        toast.success("Exam created");
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.userMessage || "Failed to save exam");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? "Edit Exam" : "Create Exam"}
      subtitle={editing ? `#${exam?.exam_id}` : "Add an exam to this subject"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {context && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
            <Badge tone="indigo">{context.program_name}</Badge>
            <Badge tone="blue">Year {context.btech_year}</Badge>
            <Badge tone="amber">{context.term_type}</Badge>
            <Badge tone="slate">Semester {context.semester_number}</Badge>
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label required>Subject</Label>
            <Select value={form.course_id} onChange={(e) => set("course_id", e.target.value)}>
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.course_id} value={s.course_id}>
                  {s.course_code ? `${s.course_code} — ` : ""}{s.course_name}
                </option>
              ))}
            </Select>
            {selectedSubject?.faculty_name && (
              <p className="mt-1 text-xs text-slate-500">Faculty: {selectedSubject.faculty_name}</p>
            )}
          </div>

          <div>
            <Label>Exam Type</Label>
            <Select value={form.exam_type} onChange={(e) => onType(e.target.value)}>
              <option value="">Select type…</option>
              {EXAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.value}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label required>Exam Name</Label>
            <Input value={form.exam_name} onChange={(e) => set("exam_name", e.target.value)} placeholder="e.g. Internal 1" />
          </div>

          <div>
            <Label required>Maximum Marks</Label>
            <Input type="number" min="1" value={form.max_marks} onChange={(e) => set("max_marks", e.target.value)} />
          </div>
          <div>
            <Label>Weightage (%)</Label>
            <Input type="number" min="0" max="100" value={form.weightage} onChange={(e) => set("weightage", e.target.value)} />
          </div>

          <div>
            <Label>Exam Date</Label>
            <Input type="date" value={form.exam_date} onChange={(e) => set("exam_date", e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </Select>
          </div>

          <div>
            <Label>Start Time</Label>
            <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
          </div>
          <div>
            <Label>End Time</Label>
            <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <Label>Instructions</Label>
            <textarea
              rows={3}
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="Optional instructions for students / invigilators"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import { useToast } from "../Toast.jsx";
import Modal from "../Modal.jsx";
import { Alert, Badge, Button, Spinner } from "../ui.jsx";
import { Icon } from "../Icons.jsx";

/**
 * Enter / edit marks for a whole class on one exam. Loads the cohort roster
 * (pre-filled with any existing marks) and saves in one bulk call.
 */
export default function ExamMarksEntry({ open, examId, onClose, onSaved }) {
  const toast = useToast();
  const [roster, setRoster] = useState(null);
  const [values, setValues] = useState({}); // student_id -> string
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!open || !examId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/exams/${examId}/roster`);
      setRoster(data);
      const init = {};
      (data.students || []).forEach((s) => {
        init[s.student_id] = s.marks_obtained ?? "";
      });
      setValues(init);
    } catch (err) {
      setError(err.userMessage || "Failed to load roster");
      setRoster(null);
    } finally {
      setLoading(false);
    }
  }, [open, examId]);

  useEffect(() => { load(); }, [load]);

  const max = roster?.max_marks;
  const set = (id, v) => setValues((m) => ({ ...m, [id]: v }));

  const stats = useMemo(() => {
    const entered = Object.values(values).filter((v) => v !== "" && v != null).length;
    const total = roster?.students?.length || 0;
    return { entered, total, pending: total - entered };
  }, [values, roster]);

  const save = async () => {
    setError(null);
    const records = [];
    for (const [sid, v] of Object.entries(values)) {
      if (v === "" || v == null) continue;
      const n = Number(v);
      if (Number.isNaN(n) || n < 0) return setError("Marks must be zero or a positive number.");
      if (max != null && n > max) return setError(`Marks cannot exceed the maximum (${max}).`);
      records.push({ student_id: Number(sid), marks_obtained: n });
    }
    if (!records.length) return setError("Enter at least one student's marks.");
    setSaving(true);
    try {
      const { data } = await api.post("/marks/bulk", { exam_id: examId, records });
      toast.success(`Marks saved — ${data.created} new, ${data.updated} updated.`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.userMessage || "Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Enter Marks"
      subtitle={roster ? `${roster.course_name} · ${roster.exam_name} · max ${roster.max_marks}` : "Loading…"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading || !roster?.students?.length}>
            {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
            {saving ? "Saving…" : "Save Marks"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="red">{error}</Alert>}

        {!loading && roster && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="green" dot>Entered {stats.entered}</Badge>
            <Badge tone="amber" dot>Pending {stats.pending}</Badge>
            <Badge tone="slate">Total {stats.total}</Badge>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : !roster?.students?.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <Icon name="inbox" className="h-9 w-9" />
            <span className="text-sm font-medium text-slate-500">No students in this cohort</span>
            <span className="max-w-xs text-center text-xs">
              Marks entry uses the students currently in this semester. Only the active
              (current) semester has a cohort right now.
            </span>
          </div>
        ) : (
          <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Roll No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sec</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Marks / {roster.max_marks}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.students.map((s) => (
                  <tr key={s.student_id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{s.roll_number || "—"}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.full_name}</td>
                    <td className="px-3 py-2 text-slate-500">{s.section || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max={roster.max_marks ?? undefined}
                        value={values[s.student_id] ?? ""}
                        onChange={(e) => set(s.student_id, e.target.value)}
                        className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

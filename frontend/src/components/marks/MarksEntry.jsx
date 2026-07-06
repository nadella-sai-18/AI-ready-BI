import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import { useToast } from "../Toast.jsx";
import Modal from "../Modal.jsx";
import { Alert, Badge, Button, Spinner } from "../ui.jsx";
import { Icon } from "../Icons.jsx";

/**
 * Enter / edit marks for a class on one exam. Supports marking a student
 * Absent (marks blank) and optional remarks. Scoped to a section when given.
 * Loads the roster pre-filled with existing marks, saves in one bulk call.
 */
export default function MarksEntry({ open, examId, section, onClose, onSaved }) {
  const toast = useToast();
  const [roster, setRoster] = useState(null);
  const [rows, setRows] = useState({}); // student_id -> {marks, absent, remarks}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!open || !examId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/exams/${examId}/roster`, { params: { section: section || undefined } });
      setRoster(data);
      const init = {};
      (data.students || []).forEach((s) => {
        init[s.student_id] = {
          marks: s.marks_obtained ?? "",
          absent: s.status === "Absent",
          remarks: "",
        };
      });
      setRows(init);
    } catch (err) {
      setError(err.userMessage || "Failed to load roster");
      setRoster(null);
    } finally {
      setLoading(false);
    }
  }, [open, examId, section]);

  useEffect(() => { load(); }, [load]);

  const max = roster?.max_marks;
  const upd = (id, patch) => setRows((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  const markAllPresent = () => setRows((m) => {
    const n = { ...m };
    Object.keys(n).forEach((k) => (n[k] = { ...n[k], absent: false }));
    return n;
  });

  const stats = useMemo(() => {
    let entered = 0, absent = 0;
    Object.values(rows).forEach((r) => {
      if (r.absent) absent += 1;
      else if (r.marks !== "" && r.marks != null) entered += 1;
    });
    const total = roster?.students?.length || 0;
    return { entered, absent, pending: total - entered - absent, total };
  }, [rows, roster]);

  const save = async () => {
    setError(null);
    const records = [];
    for (const s of roster?.students || []) {
      const r = rows[s.student_id];
      if (!r) continue;
      if (r.absent) {
        records.push({ student_id: s.student_id, status: "Absent", remarks: r.remarks || null });
        continue;
      }
      if (r.marks === "" || r.marks == null) continue; // not entered → skip
      const n = Number(r.marks);
      if (Number.isNaN(n) || n < 0) return setError("Marks must be zero or a positive number.");
      if (max != null && n > max) return setError(`Marks cannot exceed the maximum (${max}).`);
      records.push({ student_id: s.student_id, marks_obtained: n, status: "Present", remarks: r.remarks || null });
    }
    if (!records.length) return setError("Enter marks or mark absent for at least one student.");
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
      subtitle={roster ? `${roster.course_name} · ${roster.exam_name} · max ${roster.max_marks}${section ? ` · Section ${section}` : ""}` : "Loading…"}
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
            <Button variant="subtle" size="sm" onClick={markAllPresent} disabled={loading}>Clear all Absent</Button>
            <span className="ml-auto flex items-center gap-2">
              <Badge tone="green" dot>Entered {stats.entered}</Badge>
              <Badge tone="red" dot>Absent {stats.absent}</Badge>
              <Badge tone="amber" dot>Pending {stats.pending}</Badge>
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : !roster?.students?.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <Icon name="inbox" className="h-9 w-9" />
            <span className="text-sm font-medium text-slate-500">No students in this class</span>
            <span className="max-w-xs text-center text-xs">Marks entry uses the students currently in this semester (the active semester has the cohort).</span>
          </div>
        ) : (
          <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Roll No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Marks/{roster.max_marks}</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Absent</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.students.map((s) => {
                  const r = rows[s.student_id] || {};
                  return (
                    <tr key={s.student_id} className="hover:bg-brand-50/40">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{s.roll_number || "—"}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{s.full_name} <span className="text-xs text-slate-400">({s.section})</span></td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number" min="0" max={roster.max_marks ?? undefined}
                          value={r.absent ? "" : (r.marks ?? "")}
                          disabled={r.absent}
                          onChange={(e) => upd(s.student_id, { marks: e.target.value })}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={!!r.absent}
                          onChange={(e) => upd(s.student_id, { absent: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={r.remarks ?? ""} placeholder="—"
                          onChange={(e) => upd(s.student_id, { remarks: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

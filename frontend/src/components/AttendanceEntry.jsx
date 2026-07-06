import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import { useToast } from "./Toast.jsx";
import { Icon } from "./Icons.jsx";
import {
  Alert,
  Badge,
  Button,
  Card,
  Label,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
} from "./ui.jsx";

const STATUSES = [
  { value: "Present", tone: "emerald" },
  { value: "Absent", tone: "red" },
  { value: "Late", tone: "amber" },
];

const ACTIVE = {
  Present: "bg-emerald-600 text-white border-emerald-600",
  Absent: "bg-red-600 text-white border-red-600",
  Late: "bg-amber-500 text-white border-amber-500",
};

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/**
 * Attendance marking + edit screen for a single subject.
 * Loads the class roster for a date (pre-filled with any existing marks) and
 * saves the whole class in one bulk call.
 */
export default function AttendanceEntry({ year, program, subject, sections = [], onBack }) {
  const toast = useToast();
  const [classDate, setClassDate] = useState(todayISO());
  const [section, setSection] = useState(sections.length ? sections[0] : "");
  const [roster, setRoster] = useState([]);
  const [statuses, setStatuses] = useState({}); // student_id -> status
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [existingMarked, setExistingMarked] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/attendance/roster", {
        params: {
          academic_year_id: year.academic_year_id,
          program_id: program.program_id,
          course_id: subject.course_id,
          class_date: classDate,
          section: section || undefined,
        },
      });
      setRoster(data.students || []);
      setExistingMarked(data.marked_count || 0);
      const init = {};
      (data.students || []).forEach((s) => {
        if (s.status) init[s.student_id] = s.status;
      });
      setStatuses(init);
    } catch (err) {
      setError(err.userMessage || "Failed to load the class roster");
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [year, program, subject, classDate, section]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = (studentId, value) =>
    setStatuses((m) => ({ ...m, [studentId]: m[studentId] === value ? undefined : value }));

  const markAll = (value) => {
    const next = {};
    roster.forEach((s) => (next[s.student_id] = value));
    setStatuses(next);
  };

  const counts = useMemo(() => {
    const c = { Present: 0, Absent: 0, Late: 0, unmarked: 0 };
    roster.forEach((s) => {
      const v = statuses[s.student_id];
      if (v) c[v] += 1;
      else c.unmarked += 1;
    });
    return c;
  }, [roster, statuses]);

  const toMark = roster.filter((s) => statuses[s.student_id]);

  const save = async () => {
    if (toMark.length === 0) {
      toast.error("Mark at least one student before saving.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/attendance/bulk", {
        course_id: subject.course_id,
        class_date: classDate,
        records: toMark.map((s) => ({ student_id: s.student_id, status: statuses[s.student_id] })),
      });
      toast.success(
        `Attendance saved — ${data.created} new, ${data.updated} updated (${data.total} students).`
      );
      load();
    } catch (err) {
      toast.error(err.userMessage || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={subject.course_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {subject.course_code && <Badge tone="indigo">{subject.course_code}</Badge>}
            <span className="text-slate-500">
              {program.program_name} · {year.year_label} · Semester {subject.semester_number}
              {subject.term_type ? ` (${subject.term_type})` : ""}
            </span>
          </span>
        }
        actions={
          <Button variant="secondary" onClick={onBack}>
            ← Back to subjects
          </Button>
        }
      />

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44">
            <Label>Class date</Label>
            <input
              type="date"
              value={classDate}
              max={todayISO()}
              onChange={(e) => setClassDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="w-40">
            <Label>Section</Label>
            <Select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="subtle" size="sm" onClick={() => markAll("Present")} disabled={loading}>
              Mark all Present
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStatuses({})} disabled={loading}>
              Clear
            </Button>
            <Button onClick={save} disabled={saving || loading}>
              {saving ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <Icon name="checkCircle" className="h-4 w-4" />}
              Save attendance
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
          {existingMarked > 0 && (
            <Badge tone="blue" dot>
              {existingMarked} already recorded for this date
            </Badge>
          )}
          <Badge tone="green" dot>Present {counts.Present}</Badge>
          <Badge tone="red" dot>Absent {counts.Absent}</Badge>
          <Badge tone="amber" dot>Late {counts.Late}</Badge>
          <Badge tone="slate" dot>Unmarked {counts.unmarked}</Badge>
        </div>
      </Card>

      {error && <Alert tone="red" title="Couldn't load roster">{error}</Alert>}

      {/* Roster table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Roll No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sec</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: 8 }).map((_, r) => (
                  <tr key={`sk-${r}`}>
                    {Array.from({ length: 4 }).map((__, ci) => (
                      <td key={ci} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full max-w-[8rem]" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && roster.length === 0 && !error && (
                <tr>
                  <td colSpan={4} className="px-4 py-14">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Icon name="inbox" className="h-9 w-9" />
                      <span className="text-sm font-medium text-slate-500">No students in this class</span>
                      <span className="text-xs">Try a different section.</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                roster.map((s) => {
                  const cur = statuses[s.student_id];
                  return (
                    <tr key={s.student_id} className="transition-colors hover:bg-brand-50/40">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {s.roll_number || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                        {s.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{s.section || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                            {STATUSES.map((st, i) => {
                              const on = cur === st.value;
                              return (
                                <button
                                  key={st.value}
                                  onClick={() => setStatus(s.student_id, st.value)}
                                  className={`px-3 py-1.5 text-xs font-medium transition ${
                                    i > 0 ? "border-l border-slate-200" : ""
                                  } ${on ? ACTIVE[st.value] : "bg-white text-slate-600 hover:bg-slate-50"}`}
                                >
                                  {st.value}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

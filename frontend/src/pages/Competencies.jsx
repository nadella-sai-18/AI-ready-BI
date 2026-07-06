import { useEffect, useState } from "react";
import api from "../api/client.js";
import CrudPage from "../components/CrudPage.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  Alert,
  Badge,
  Button,
  Card,
  Label,
  PageHeader,
  SectionTitle,
  Select,
  Input,
  Spinner,
} from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";

const levelTone = { "Weak Area": "red", Moderate: "amber", Strong: "green" };

function ScoresPanel() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [competencies, setCompetencies] = useState([]);

  const [assignForm, setAssignForm] = useState({ student_id: "", competency_id: "", score: "" });
  const [assigning, setAssigning] = useState(false);

  const [reportStudent, setReportStudent] = useState("");
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  useEffect(() => {
    // NOTE: list endpoints return a paginated envelope { items, total }.
    api
      .get("/students", { params: { limit: 500 } })
      .then((r) => setStudents(r.data.items || []))
      .catch(() => {});
    api
      .get("/competencies", { params: { limit: 500 } })
      .then((r) => setCompetencies(r.data.items || []))
      .catch(() => {});
  }, []);

  const loadReport = async (sid) => {
    if (!sid) {
      setReport(null);
      return;
    }
    setLoadingReport(true);
    setReportError(null);
    try {
      const { data } = await api.get(`/competencies/student/${sid}`);
      setReport(data);
    } catch (err) {
      setReportError(err.userMessage || "Failed to load report");
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  };

  const assign = async (e) => {
    e.preventDefault();
    setAssigning(true);
    try {
      await api.post("/competencies/scores", {
        student_id: Number(assignForm.student_id),
        competency_id: Number(assignForm.competency_id),
        score: Number(assignForm.score),
      });
      toast.success("Competency score assigned");
      setAssignForm({ student_id: "", competency_id: "", score: "" });
      if (reportStudent && String(reportStudent) === String(assignForm.student_id)) {
        loadReport(reportStudent);
      }
    } catch (err) {
      toast.error(err.userMessage || "Assign failed");
    } finally {
      setAssigning(false);
    }
  };

  const deleteScore = async (id) => {
    try {
      await api.delete(`/competencies/scores/${id}`);
      toast.success("Score removed");
      loadReport(reportStudent);
    } catch (err) {
      toast.error(err.userMessage || "Delete failed");
    }
  };

  const studentOptions = (
    <>
      <option value="">Select a student…</option>
      {students.map((s) => (
        <option key={s.student_id} value={s.student_id}>
          {s.student_id} — {s.full_name}
        </option>
      ))}
    </>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Assign score */}
      <Card className="p-5">
        <SectionTitle>Assign Competency Score</SectionTitle>
        <form onSubmit={assign} className="space-y-4">
          <div>
            <Label required>Student</Label>
            <Select
              value={assignForm.student_id}
              onChange={(e) => setAssignForm((s) => ({ ...s, student_id: e.target.value }))}
            >
              {studentOptions}
            </Select>
          </div>
          <div>
            <Label required>Competency</Label>
            <Select
              value={assignForm.competency_id}
              onChange={(e) => setAssignForm((s) => ({ ...s, competency_id: e.target.value }))}
            >
              <option value="">Select…</option>
              {competencies.map((c) => (
                <option key={c.competency_id} value={c.competency_id}>
                  {c.competency_id} — {c.competency_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label required>Score (0–100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={assignForm.score}
              onChange={(e) => setAssignForm((s) => ({ ...s, score: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={assigning}>
            {assigning && <Spinner size="sm" className="border-white/40 border-t-white" />}
            {assigning ? "Assigning…" : "Assign Score"}
          </Button>
        </form>
      </Card>

      {/* Student report */}
      <Card className="p-5">
        <SectionTitle>Student Competency Report</SectionTitle>
        <Label>Student</Label>
        <Select
          value={reportStudent}
          onChange={(e) => {
            setReportStudent(e.target.value);
            loadReport(e.target.value);
          }}
        >
          {studentOptions}
        </Select>

        {loadingReport && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Spinner size="sm" /> Loading report…
          </div>
        )}
        {reportError && (
          <div className="mt-4">
            <Alert tone="red">{reportError}</Alert>
          </div>
        )}

        {report && !loadingReport && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <div className="text-lg font-bold text-slate-800">{report.competencies_count}</div>
                <div className="text-xs text-slate-500">Competencies</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <div className="text-lg font-bold text-slate-800">
                  {report.average_score == null ? "—" : report.average_score}
                </div>
                <div className="text-xs text-slate-500">Average</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-3">
                {report.overall_level ? (
                  <Badge tone={levelTone[report.overall_level] || "slate"} dot>
                    {report.overall_level}
                  </Badge>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
                <div className="mt-1 text-xs text-slate-500">Overall</div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {report.items.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-400">
                  No competencies assigned yet.
                </p>
              )}
              {report.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">{it.competency_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-right font-semibold tabular-nums text-slate-800">
                      {it.score}
                    </span>
                    <Badge tone={levelTone[it.level] || "slate"}>{it.level}</Badge>
                    <button
                      onClick={() => deleteScore(it.id)}
                      className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove score"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!report && !loadingReport && !reportError && (
          <p className="mt-4 text-sm text-slate-400">
            Select a student to view their competency report.
          </p>
        )}
      </Card>
    </div>
  );
}

export default function Competencies() {
  const [tab, setTab] = useState("definitions");

  const TABS = [
    { id: "definitions", label: "Definitions" },
    { id: "scores", label: "Student Scores" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Competencies"
        subtitle="Manage competency definitions and student competency scores."
      />

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "definitions" ? (
        <CrudPage
          title="Competency Definitions"
          singular="Competency"
          description="The competency areas assessed across students."
          path="/competencies"
          idKey="competency_id"
          searchable
          titleField="competency_name"
          columns={[
            { key: "competency_id", label: "ID", sortable: true },
            {
              key: "competency_name",
              label: "Competency",
              sortable: true,
              render: (r) => (
                <span className="font-medium text-slate-800">{r.competency_name}</span>
              ),
            },
            {
              key: "description",
              label: "Description",
              render: (r) => <span className="text-slate-500">{r.description || "—"}</span>,
            },
          ]}
          createFields={[
            { name: "competency_name", label: "Competency Name", type: "text", required: true },
            { name: "description", label: "Description", type: "text", full: true },
          ]}
        />
      ) : (
        <ScoresPanel />
      )}
    </div>
  );
}

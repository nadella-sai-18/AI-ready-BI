import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import KpiCard from "../components/KpiCard.jsx";
import DataTable from "../components/DataTable.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/Toast.jsx";
import { Alert, Badge, Button, Card, PageHeader, SectionTitle, Skeleton, Spinner } from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";
import ExamForm from "../components/exams/ExamForm.jsx";
import ExamDetail from "../components/exams/ExamDetail.jsx";
import ExamMarksEntry from "../components/exams/ExamMarksEntry.jsx";
import ExamInsights from "../components/exams/ExamInsights.jsx";
import { EXAM_TYPE_TONE, MARKS_TONE, STATUS_TONE, TERMS, semesterFrom } from "../components/exams/examConstants.js";

const TONES = ["indigo", "green", "amber", "red", "slate"];

function Breadcrumb({ trail }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
      {trail.map((t, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-slate-300" />}
          {t.onClick ? (
            <button onClick={t.onClick} className="font-medium text-slate-500 transition hover:text-brand-700">{t.label}</button>
          ) : (
            <span className="font-semibold text-slate-800">{t.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function NavCard({ title, subtitle, tone = "indigo", icon, onClick }) {
  const chip = {
    indigo: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-600",
  }[tone];
  return (
    <button onClick={onClick} className="group text-left">
      <Card hover className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-800">{title}</div>
            {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
          </div>
          {icon && <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${chip}`}><Icon name={icon} className="h-5 w-5" /></div>}
        </div>
        <div className="mt-4 flex justify-end">
          <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500"><Icon name="chevronRight" className="h-5 w-5" /></span>
        </div>
      </Card>
    </button>
  );
}

function SummaryCards({ summary, loading }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard label="Total Exams" value={summary?.total_exams} loading={loading} tone="indigo" icon="exams" />
      <KpiCard label="Scheduled" value={summary?.scheduled} loading={loading} tone="amber" icon="calendarCheck" />
      <KpiCard label="Completed" value={summary?.completed} loading={loading} tone="green" icon="checkCircle" />
      <KpiCard label="Pending Marks" value={summary?.pending_marks_entry} loading={loading} tone="red" icon="alert" hint="past exams with no marks" />
      <KpiCard label="Today's Exams" value={summary?.todays_exams} loading={loading} tone="slate" icon="calendarCheck" />
      <KpiCard label="Upcoming (7d)" value={summary?.upcoming_exams} loading={loading} tone="indigo" icon="calendarCheck" />
      <KpiCard label="Average Marks" value={summary?.average_marks} suffix="%" loading={loading} tone="green" icon="marks" />
      <KpiCard label="Pass Rate" value={summary?.pass_percentage} suffix="%" loading={loading} tone="green" icon="award" />
    </div>
  );
}

export default function Exams() {
  const toast = useToast();
  const [years, setYears] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selYear, setSelYear] = useState(null);
  const [selProgram, setSelProgram] = useState(null);
  const [selSubject, setSelSubject] = useState(null);

  const [btechYear, setBtechYear] = useState(null);
  const [term, setTerm] = useState("Monsoon");

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [ctx, setCtx] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxError, setCtxError] = useState(null);
  const [showInsights, setShowInsights] = useState(false);

  // exam list (subject level)
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(false);

  // modals
  const [formOpen, setFormOpen] = useState(false);
  const [formExam, setFormExam] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [marksId, setMarksId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const semester = semesterFrom(btechYear, term);

  useEffect(() => {
    api.get("/academic-years", { params: { limit: 500 } }).then((r) => setYears(r.data.items || [])).catch(() => setYears([]));
    api.get("/programs", { params: { limit: 500 } }).then((r) => setPrograms(r.data.items || [])).catch(() => setPrograms([]));
  }, []);

  const maxStart = years.reduce((m, y) => Math.max(m, y.start_year || 0), 0);
  const studyYearOf = (y) => (!y || !y.start_year || !maxStart ? null : Math.max(1, Math.min(4, maxStart - y.start_year + 1)));

  // Summary — scoped by current selection level.
  const scopeParams = useCallback(() => {
    const p = {};
    if (selProgram) p.program_id = selProgram.program_id;
    if (semester) p.semester_number = semester;
    return p;
  }, [selProgram, semester]);

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    api.get("/exams/summary", { params: scopeParams() })
      .then((r) => setSummary(r.data)).catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [scopeParams]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Context (subjects) when a branch + semester are known.
  const loadContext = useCallback(() => {
    if (!selProgram || !semester) return;
    setCtxLoading(true); setCtxError(null);
    api.get("/exams/context", { params: { program_id: selProgram.program_id, semester_number: semester } })
      .then((r) => setCtx(r.data)).catch((e) => setCtxError(e.userMessage || "Failed to load subjects"))
      .finally(() => setCtxLoading(false));
  }, [selProgram, semester]);

  useEffect(() => { loadContext(); }, [loadContext]);

  // Exam list for the selected subject.
  const loadExams = useCallback(() => {
    if (!selSubject) return;
    setExamsLoading(true);
    api.get("/exams", { params: { course_id: selSubject.course_id, limit: 100, sort_by: "exam_date", order: "asc" } })
      .then((r) => setExams(r.data.items || [])).catch(() => setExams([]))
      .finally(() => setExamsLoading(false));
  }, [selSubject]);

  useEffect(() => { loadExams(); }, [loadExams]);

  const refreshAll = () => { loadExams(); loadContext(); loadSummary(); };

  const enterBatch = (y) => { setSelYear(y); setBtechYear(studyYearOf(y) || 1); setTerm("Monsoon"); };
  const resetAll = () => { setSelYear(null); setSelProgram(null); setSelSubject(null); };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/exams/${toDelete.exam_id}`);
      toast.success("Exam deleted");
      setToDelete(null); setDetailId(null);
      refreshAll();
    } catch (err) {
      toast.error(err.userMessage || "Delete failed");
    } finally { setDeleting(false); }
  };

  const TermYearBar = () => (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">B.Tech Year</label>
          <select value={btechYear || ""} onChange={(e) => setBtechYear(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200">
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Term</label>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
            {TERMS.map((t, i) => (
              <button key={t} onClick={() => setTerm(t)}
                className={`px-4 py-2 text-sm font-medium transition ${i > 0 ? "border-l border-slate-300" : ""} ${term === t ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Badge tone="indigo">Semester {semester}</Badge>
          <span className="text-xs text-slate-400">auto-derived from Year + Term</span>
        </div>
      </div>
    </Card>
  );

  // ---------- Level 4: exams for a subject ----------
  if (selYear && selProgram && selSubject) {
    const columns = [
      { key: "exam_name", label: "Exam", render: (r) => <span className="font-medium text-slate-800">{r.exam_name}</span> },
      { key: "exam_type", label: "Type", render: (r) => r.exam_type ? <Badge tone={EXAM_TYPE_TONE[r.exam_type] || "slate"}>{r.exam_type}</Badge> : "—" },
      { key: "exam_date", label: "Date" },
      { key: "max_marks", label: "Max", render: (r) => <Badge tone="slate">{r.max_marks}</Badge> },
      { key: "status", label: "Status", render: (r) => r.status ? <Badge tone={STATUS_TONE[r.status] || "slate"} dot>{r.status}</Badge> : "—" },
      { key: "marks_status", label: "Marks", render: (r) => r.marks_status ? <Badge tone={MARKS_TONE[r.marks_status] || "slate"}>{r.marks_status} {r.marks_entered != null && r.expected_students ? `${r.marks_entered}/${r.expected_students}` : ""}</Badge> : "—" },
    ];
    return (
      <div className="space-y-4">
        <Breadcrumb trail={[
          { label: "Exams", onClick: resetAll },
          { label: selYear.year_label, onClick: () => { setSelProgram(null); setSelSubject(null); } },
          { label: selProgram.program_name, onClick: () => setSelSubject(null) },
          { label: selSubject.course_name },
        ]} />
        <PageHeader
          title={selSubject.course_name}
          subtitle={<span className="flex flex-wrap items-center gap-2">
            <Badge tone="indigo">{selProgram.program_name}</Badge>
            <Badge tone="blue">Year {btechYear}</Badge><Badge tone="amber">{term}</Badge><Badge tone="slate">Sem {semester}</Badge>
          </span>}
          actions={<>
            <Button variant="secondary" onClick={() => setSelSubject(null)}>← Back</Button>
            <Button onClick={() => { setFormExam(null); setFormOpen(true); }}><Icon name="plus" className="h-4 w-4" /> Create Exam</Button>
          </>}
        />
        <DataTable
          columns={columns}
          rows={exams}
          loading={examsLoading}
          emptyText="No exams for this subject yet"
          actions={(row) => (
            <>
              <Button variant="secondary" size="sm" onClick={() => setDetailId(row.exam_id)}><Icon name="external" className="h-3.5 w-3.5" /> View</Button>
              <Button variant="secondary" size="sm" onClick={() => setMarksId(row.exam_id)}><Icon name="marks" className="h-3.5 w-3.5" /> Marks</Button>
              <Button variant="secondary" size="sm" onClick={() => { setFormExam(row); setFormOpen(true); }}><Icon name="edit" className="h-3.5 w-3.5" /> Edit</Button>
              <Button variant="danger" size="sm" onClick={() => setToDelete(row)}><Icon name="trash" className="h-3.5 w-3.5" /></Button>
            </>
          )}
        />
        {renderModals()}
      </div>
    );
  }

  // ---------- Level 3: subjects for a branch ----------
  if (selYear && selProgram) {
    return (
      <div className="space-y-5">
        <Breadcrumb trail={[
          { label: "Exams", onClick: resetAll },
          { label: selYear.year_label, onClick: () => setSelProgram(null) },
          { label: selProgram.program_name },
        ]} />
        <PageHeader title={selProgram.program_name} subtitle={`${selYear.year_label} · exam management & performance`} />
        <TermYearBar />
        <SummaryCards summary={summary} loading={summaryLoading} />

        <div>
          <SectionTitle right={
            <Button variant="ghost" size="sm" onClick={() => setShowInsights((v) => !v)}>
              {showInsights ? "Hide" : "Show"} performance insights
              <Icon name="chevronRight" className={`h-4 w-4 transition ${showInsights ? "rotate-90" : ""}`} />
            </Button>
          }>Subjects — Semester {semester}</SectionTitle>

          {ctxError && <Alert tone="red">{ctxError}</Alert>}
          {ctxLoading || !ctx ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
            </div>
          ) : ctx.subjects.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">No subjects mapped to Semester {semester} for this branch. Add them on the Courses page.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ctx.subjects.map((s, i) => (
                <button key={s.course_id} onClick={() => setSelSubject(s)} className="group text-left">
                  <Card hover className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {s.course_code && <Badge tone="indigo">{s.course_code}</Badge>}
                        <div className="mt-2 truncate text-base font-semibold text-slate-800">{s.course_name}</div>
                        {s.faculty_name && <div className="mt-0.5 truncate text-xs text-slate-500">{s.faculty_name}</div>}
                      </div>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="exams" className="h-5 w-5" /></div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge tone="slate">{s.exam_count} exams</Badge>
                        {s.pending_marks_count > 0 && <Badge tone="red">{s.pending_marks_count} pending</Badge>}
                      </div>
                      <span className="font-semibold text-slate-700">{s.avg_percentage != null ? `${s.avg_percentage}% avg` : "—"}</span>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>

        {showInsights && (
          <div><SectionTitle>Performance Insights</SectionTitle>
            <ExamInsights params={{ program_id: selProgram.program_id, semester_number: semester }} />
          </div>
        )}
        {renderModals()}
      </div>
    );
  }

  // ---------- Level 2: branches for a batch ----------
  if (selYear) {
    const sy = studyYearOf(selYear);
    return (
      <div className="space-y-5">
        <Breadcrumb trail={[{ label: "Exams", onClick: () => setSelYear(null) }, { label: selYear.year_label }]} />
        <PageHeader title={`${selYear.year_label} — Exams`} subtitle={sy ? `Batch currently in Year ${sy}. Choose year/term, then a branch.` : "Choose a branch"} />
        <TermYearBar />
        <SummaryCards summary={summary} loading={summaryLoading} />
        <div>
          <SectionTitle>Branches</SectionTitle>
          {programs.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">No programs yet.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {programs.map((p, i) => (
                <NavCard key={p.program_id} title={p.program_name} subtitle={`Semester ${semester} subjects`} icon="programs" tone={TONES[i % TONES.length]} onClick={() => setSelProgram(p)} />
              ))}
            </div>
          )}
        </div>
        {renderModals()}
      </div>
    );
  }

  // ---------- Level 1: landing ----------
  return (
    <div className="space-y-6">
      <PageHeader title="Exams" subtitle="Operational exam management + academic performance analytics." />
      <div><SectionTitle>College-wide Summary</SectionTitle><SummaryCards summary={summary} loading={summaryLoading} /></div>
      <div>
        <SectionTitle right={
          <Button variant="ghost" size="sm" onClick={() => setShowInsights((v) => !v)}>
            {showInsights ? "Hide" : "Show"} performance insights
            <Icon name="chevronRight" className={`h-4 w-4 transition ${showInsights ? "rotate-90" : ""}`} />
          </Button>
        }>Select Academic Year</SectionTitle>
        {years.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">No academic years yet.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {years.map((y, i) => {
              const sy = studyYearOf(y);
              return <NavCard key={y.academic_year_id} title={y.year_label} subtitle={sy ? `Batch · currently Year ${sy}` : "Batch"} icon="academic" tone={TONES[i % TONES.length]} onClick={() => enterBatch(y)} />;
            })}
          </div>
        )}
      </div>
      {showInsights && <div><SectionTitle>College-wide Performance Insights</SectionTitle><ExamInsights params={{}} /></div>}
      {renderModals()}
    </div>
  );

  function renderModals() {
    return (
      <>
        <ExamForm
          open={formOpen}
          exam={formExam}
          context={ctx}
          defaultCourseId={selSubject?.course_id}
          onClose={() => setFormOpen(false)}
          onSaved={refreshAll}
        />
        <ExamDetail
          open={!!detailId}
          examId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(e) => { setDetailId(null); setFormExam(e); setFormOpen(true); }}
          onDelete={(e) => { setDetailId(null); setToDelete(e); }}
          onEnterMarks={(e) => { setDetailId(null); setMarksId(e.exam_id); }}
        />
        <ExamMarksEntry open={!!marksId} examId={marksId} onClose={() => setMarksId(null)} onSaved={refreshAll} />
        <ConfirmDialog
          open={!!toDelete}
          title="Delete Exam"
          message={`Delete "${toDelete?.exam_name}"? This cannot be undone.`}
          onConfirm={confirmDelete}
          onClose={() => setToDelete(null)}
          busy={deleting}
        />
      </>
    );
  }
}

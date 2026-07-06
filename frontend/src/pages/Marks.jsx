import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import KpiCard from "../components/KpiCard.jsx";
import DataTable from "../components/DataTable.jsx";
import { Alert, Badge, Button, Card, PageHeader, SectionTitle, Skeleton } from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";
import MarksEntry from "../components/marks/MarksEntry.jsx";
import MarksInsights from "../components/marks/MarksInsights.jsx";
import { EXAM_TYPE_TONE, MARKS_TONE, STATUS_TONE, TERMS, semesterFrom } from "../components/exams/examConstants.js";

const TONES = ["indigo", "green", "amber", "red", "slate"];
const ALL = "__ALL__";

function Breadcrumb({ trail }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
      {trail.map((t, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-slate-300" />}
          {t.onClick ? <button onClick={t.onClick} className="font-medium text-slate-500 transition hover:text-brand-700">{t.label}</button>
            : <span className="font-semibold text-slate-800">{t.label}</span>}
        </span>
      ))}
    </nav>
  );
}

function NavCard({ title, subtitle, tone = "indigo", icon, onClick }) {
  const chip = { indigo: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-600" }[tone];
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
        <div className="mt-4 flex justify-end"><span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500"><Icon name="chevronRight" className="h-5 w-5" /></span></div>
      </Card>
    </button>
  );
}

function MarksSummaryCards({ s, loading }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard label="Total Exams" value={s?.total_exams} loading={loading} tone="indigo" icon="exams" />
      <KpiCard label="Marks Entered" value={s?.exams_fully_entered} loading={loading} tone="green" icon="checkCircle" />
      <KpiCard label="Pending Entry" value={s?.exams_pending} loading={loading} tone="red" icon="alert" />
      <KpiCard label="Average Marks" value={s?.average_percentage} suffix="%" loading={loading} tone="green" icon="marks" />
      <KpiCard label="Pass Rate" value={s?.pass_percentage} suffix="%" loading={loading} tone="green" icon="award" />
      <KpiCard label="Fail Rate" value={s?.fail_percentage} suffix="%" loading={loading} tone="red" icon="alert" />
      <KpiCard label="At-Risk Students" value={s?.students_at_risk} loading={loading} tone="red" icon="alert" hint="avg marks < 40%" />
      <KpiCard label="With Absences" value={s?.students_with_absences} loading={loading} tone="amber" icon="calendarCheck" />
    </div>
  );
}

export default function Marks() {
  const [years, setYears] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selYear, setSelYear] = useState(null);
  const [selProgram, setSelProgram] = useState(null);
  const [selSection, setSelSection] = useState(null); // letter | ALL | null
  const [selSubject, setSelSubject] = useState(null);
  const [btechYear, setBtechYear] = useState(null);
  const [term, setTerm] = useState("Monsoon");

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [ctx, setCtx] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxError, setCtxError] = useState(null);
  const [showInsights, setShowInsights] = useState(false);

  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [marksExamId, setMarksExamId] = useState(null);

  const semester = semesterFrom(btechYear, term);
  const sectionParam = selSection && selSection !== ALL ? selSection : null;

  useEffect(() => {
    api.get("/academic-years", { params: { limit: 500 } }).then((r) => setYears(r.data.items || [])).catch(() => setYears([]));
    api.get("/programs", { params: { limit: 500 } }).then((r) => setPrograms(r.data.items || [])).catch(() => setPrograms([]));
  }, []);

  const maxStart = years.reduce((m, y) => Math.max(m, y.start_year || 0), 0);
  const studyYearOf = (y) => (!y || !y.start_year || !maxStart ? null : Math.max(1, Math.min(4, maxStart - y.start_year + 1)));

  const scopeParams = useCallback(() => {
    const p = {};
    if (selProgram) p.program_id = selProgram.program_id;
    if (semester) p.semester_number = semester;
    if (sectionParam) p.section = sectionParam;
    return p;
  }, [selProgram, semester, sectionParam]);

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    api.get("/marks/summary", { params: scopeParams() }).then((r) => setSummary(r.data)).catch(() => setSummary(null)).finally(() => setSummaryLoading(false));
  }, [scopeParams]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const loadContext = useCallback(() => {
    if (!selProgram || !semester) return;
    setCtxLoading(true); setCtxError(null);
    api.get("/exams/context", { params: { program_id: selProgram.program_id, semester_number: semester } })
      .then((r) => setCtx(r.data)).catch((e) => setCtxError(e.userMessage || "Failed to load subjects")).finally(() => setCtxLoading(false));
  }, [selProgram, semester]);
  useEffect(() => { loadContext(); }, [loadContext]);

  const loadExams = useCallback(() => {
    if (!selSubject) return;
    setExamsLoading(true);
    api.get("/exams", { params: { course_id: selSubject.course_id, limit: 100, sort_by: "exam_date", order: "asc" } })
      .then((r) => setExams(r.data.items || [])).catch(() => setExams([])).finally(() => setExamsLoading(false));
  }, [selSubject]);
  useEffect(() => { loadExams(); }, [loadExams]);

  const refresh = () => { loadExams(); loadSummary(); loadContext(); };
  const enterBatch = (y) => { setSelYear(y); setBtechYear(studyYearOf(y) || 1); setTerm("Monsoon"); };
  const resetAll = () => { setSelYear(null); setSelProgram(null); setSelSection(null); setSelSubject(null); };

  const TermYearBar = () => (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">B.Tech Year</label>
          <select value={btechYear || ""} onChange={(e) => setBtechYear(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200">
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Term</label>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
            {TERMS.map((t, i) => <button key={t} onClick={() => setTerm(t)} className={`px-4 py-2 text-sm font-medium transition ${i > 0 ? "border-l border-slate-300" : ""} ${term === t ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{t}</button>)}
          </div>
        </div>
        <div className="flex items-center gap-2 pb-1"><Badge tone="indigo">Semester {semester}</Badge><span className="text-xs text-slate-400">auto from Year + Term</span></div>
      </div>
    </Card>
  );

  const modal = <MarksEntry open={!!marksExamId} examId={marksExamId} section={sectionParam} onClose={() => setMarksExamId(null)} onSaved={refresh} />;

  // ---------- Level 5: exams of a subject ----------
  if (selYear && selProgram && selSection && selSubject) {
    const columns = [
      { key: "exam_name", label: "Exam", render: (r) => <span className="font-medium text-slate-800">{r.exam_name}</span> },
      { key: "exam_type", label: "Type", render: (r) => r.exam_type ? <Badge tone={EXAM_TYPE_TONE[r.exam_type] || "slate"}>{r.exam_type}</Badge> : "—" },
      { key: "exam_date", label: "Date" },
      { key: "max_marks", label: "Max", render: (r) => <Badge tone="slate">{r.max_marks}</Badge> },
      { key: "status", label: "Status", render: (r) => r.status ? <Badge tone={STATUS_TONE[r.status] || "slate"} dot>{r.status}</Badge> : "—" },
      { key: "marks_status", label: "Marks", render: (r) => r.marks_status ? <Badge tone={MARKS_TONE[r.marks_status] || "slate"}>{r.marks_status}</Badge> : "—" },
    ];
    return (
      <div className="space-y-4">
        <Breadcrumb trail={[
          { label: "Marks", onClick: resetAll },
          { label: selYear.year_label, onClick: () => { setSelProgram(null); setSelSection(null); setSelSubject(null); } },
          { label: selProgram.program_name, onClick: () => { setSelSection(null); setSelSubject(null); } },
          { label: selSection === ALL ? "All Sections" : `Section ${selSection}`, onClick: () => setSelSubject(null) },
          { label: selSubject.course_name },
        ]} />
        <PageHeader title={selSubject.course_name}
          subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone="indigo">{selProgram.program_name}</Badge><Badge tone="blue">Year {btechYear}</Badge><Badge tone="amber">{term}</Badge><Badge tone="slate">Sem {semester}</Badge><Badge tone="green">{selSection === ALL ? "All Sections" : `Section ${selSection}`}</Badge></span>}
          actions={<Button variant="secondary" onClick={() => setSelSubject(null)}>← Back</Button>} />
        <DataTable columns={columns} rows={exams} loading={examsLoading} emptyText="No exams for this subject"
          actions={(row) => <Button variant="secondary" size="sm" onClick={() => setMarksExamId(row.exam_id)}><Icon name="marks" className="h-3.5 w-3.5" /> Enter / Edit Marks</Button>} />
        {modal}
      </div>
    );
  }

  // ---------- Level 4: subjects of a section ----------
  if (selYear && selProgram && selSection) {
    return (
      <div className="space-y-5">
        <Breadcrumb trail={[
          { label: "Marks", onClick: resetAll },
          { label: selYear.year_label, onClick: () => { setSelProgram(null); setSelSection(null); } },
          { label: selProgram.program_name, onClick: () => setSelSection(null) },
          { label: selSection === ALL ? "All Sections" : `Section ${selSection}` },
        ]} />
        <PageHeader title={selSection === ALL ? `${selProgram.program_name} — All Sections` : `${selProgram.program_name} — Section ${selSection}`}
          subtitle={`${selYear.year_label} · Year ${btechYear} · ${term} · Semester ${semester}`} />
        <MarksSummaryCards s={summary} loading={summaryLoading} />
        <div>
          <SectionTitle right={<Button variant="ghost" size="sm" onClick={() => setShowInsights((v) => !v)}>{showInsights ? "Hide" : "Show"} performance insights<Icon name="chevronRight" className={`h-4 w-4 transition ${showInsights ? "rotate-90" : ""}`} /></Button>}>Subjects — Semester {semester}</SectionTitle>
          {ctxError && <Alert tone="red">{ctxError}</Alert>}
          {ctxLoading || !ctx ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
            : ctx.subjects.length === 0 ? <Card className="p-6 text-sm text-slate-500">No subjects for Semester {semester}.</Card>
            : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ctx.subjects.map((s) => (
                  <button key={s.course_id} onClick={() => setSelSubject(s)} className="group text-left">
                    <Card hover className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {s.course_code && <Badge tone="indigo">{s.course_code}</Badge>}
                          <div className="mt-2 truncate text-base font-semibold text-slate-800">{s.course_name}</div>
                          {s.faculty_name && <div className="mt-0.5 truncate text-xs text-slate-500">{s.faculty_name}</div>}
                        </div>
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="marks" className="h-5 w-5" /></div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2"><Badge tone="slate">{s.exam_count} exams</Badge>{s.pending_marks_count > 0 && <Badge tone="red">{s.pending_marks_count} pending</Badge>}</div>
                        <span className="font-semibold text-slate-700">{s.avg_percentage != null ? `${s.avg_percentage}% avg` : "—"}</span>
                      </div>
                    </Card>
                  </button>
                ))}
              </div>}
        </div>
        {showInsights && <div><SectionTitle>Performance Insights</SectionTitle><MarksInsights params={scopeParams()} /></div>}
        {modal}
      </div>
    );
  }

  // ---------- Level 3: sections of a branch ----------
  if (selYear && selProgram) {
    const sections = ctx?.sections || [];
    return (
      <div className="space-y-5">
        <Breadcrumb trail={[
          { label: "Marks", onClick: resetAll },
          { label: selYear.year_label, onClick: () => setSelProgram(null) },
          { label: selProgram.program_name },
        ]} />
        <PageHeader title={`${selProgram.program_name} — Marks`} subtitle={`${selYear.year_label} · choose section`} />
        <TermYearBar />
        <MarksSummaryCards s={summary} loading={summaryLoading} />
        <div>
          <SectionTitle right={<Button variant="ghost" size="sm" onClick={() => setShowInsights((v) => !v)}>{showInsights ? "Hide" : "Show"} performance insights<Icon name="chevronRight" className={`h-4 w-4 transition ${showInsights ? "rotate-90" : ""}`} /></Button>}>Sections — Semester {semester}</SectionTitle>
          {ctxLoading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
            : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {sections.map((sec, i) => <NavCard key={sec} title={`Section ${sec}`} icon="students" tone={TONES[i % TONES.length]} onClick={() => { setSelSection(sec); setShowInsights(false); }} />)}
                <NavCard title="All Sections" subtitle="combined view" icon="students" tone="slate" onClick={() => { setSelSection(ALL); setShowInsights(false); }} />
              </div>}
        </div>
        {showInsights && <div><SectionTitle>Performance Insights — Semester {semester}</SectionTitle><MarksInsights params={{ program_id: selProgram.program_id, semester_number: semester }} /></div>}
        {modal}
      </div>
    );
  }

  // ---------- Level 2: branches of a batch ----------
  if (selYear) {
    const sy = studyYearOf(selYear);
    return (
      <div className="space-y-5">
        <Breadcrumb trail={[{ label: "Marks", onClick: () => setSelYear(null) }, { label: selYear.year_label }]} />
        <PageHeader title={`${selYear.year_label} — Marks`} subtitle={sy ? `Batch currently in Year ${sy}. Choose year/term, then a branch.` : "Choose a branch"} />
        <TermYearBar />
        <MarksSummaryCards s={summary} loading={summaryLoading} />
        <div><SectionTitle>Branches</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {programs.map((p, i) => <NavCard key={p.program_id} title={p.program_name} subtitle={`Semester ${semester}`} icon="programs" tone={TONES[i % TONES.length]} onClick={() => setSelProgram(p)} />)}
          </div>
        </div>
        {modal}
      </div>
    );
  }

  // ---------- Level 1: landing ----------
  return (
    <div className="space-y-6">
      <PageHeader title="Marks" subtitle="Operational marks entry + academic performance analytics." />
      <div><SectionTitle>College-wide Summary</SectionTitle><MarksSummaryCards s={summary} loading={summaryLoading} /></div>
      <div>
        <SectionTitle right={<Button variant="ghost" size="sm" onClick={() => setShowInsights((v) => !v)}>{showInsights ? "Hide" : "Show"} performance insights<Icon name="chevronRight" className={`h-4 w-4 transition ${showInsights ? "rotate-90" : ""}`} /></Button>}>Select Academic Year</SectionTitle>
        {years.length === 0 ? <Card className="p-6 text-sm text-slate-500">No academic years yet.</Card>
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {years.map((y, i) => { const sy = studyYearOf(y); return <NavCard key={y.academic_year_id} title={y.year_label} subtitle={sy ? `Batch · currently Year ${sy}` : "Batch"} icon="academic" tone={TONES[i % TONES.length]} onClick={() => enterBatch(y)} />; })}
            </div>}
      </div>
      {showInsights && <div><SectionTitle>College-wide Performance Insights</SectionTitle><MarksInsights params={{}} /></div>}
      {modal}
    </div>
  );
}

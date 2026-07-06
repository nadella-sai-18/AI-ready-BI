import { useEffect, useState } from "react";
import api from "../api/client.js";
import AttendanceEntry from "../components/AttendanceEntry.jsx";
import { Alert, Badge, Button, Card, PageHeader, SectionTitle, Skeleton, Spinner } from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";

const TONES = ["indigo", "green", "amber", "red", "slate"];

function Breadcrumb({ trail }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
      {trail.map((t, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-slate-300" />}
          {t.onClick ? (
            <button onClick={t.onClick} className="font-medium text-slate-500 transition hover:text-brand-700">
              {t.label}
            </button>
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
    indigo: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  }[tone];
  return (
    <button onClick={onClick} className="group text-left">
      <Card hover className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-800">{title}</div>
            {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
          </div>
          {icon && (
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${chip}`}>
              <Icon name={icon} className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500">
            <Icon name="chevronRight" className="h-5 w-5" />
          </span>
        </div>
      </Card>
    </button>
  );
}

function SubjectCard({ subject, tone = "indigo", disabled, onClick }) {
  const chip = {
    indigo: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  }[tone];
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <Card hover={!disabled} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {subject.course_code && (
              <Badge tone="indigo">{subject.course_code}</Badge>
            )}
            <div className="mt-2 truncate text-base font-semibold text-slate-800">
              {subject.course_name}
            </div>
          </div>
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${chip}`}>
            <Icon name="courses" className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div className="text-xs text-slate-400">
            {subject.marked_records > 0
              ? `${subject.marked_records} records`
              : "No attendance yet"}
          </div>
          {!disabled && (
            <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500">
              <Icon name="chevronRight" className="h-5 w-5" />
            </span>
          )}
        </div>
      </Card>
    </button>
  );
}

export default function Attendance() {
  const [years, setYears] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selYear, setSelYear] = useState(null);
  const [selProgram, setSelProgram] = useState(null);
  const [selSubject, setSelSubject] = useState(null);

  const [ctx, setCtx] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxError, setCtxError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    api.get("/academic-years", { params: { limit: 500 } })
      .then((r) => setYears(r.data.items || []))
      .catch(() => setYears([]));
    api.get("/programs", { params: { limit: 500 } })
      .then((r) => setPrograms(r.data.items || []))
      .catch(() => setPrograms([]));
  }, []);

  // Load academic context (current year/semester + subjects) for batch + branch.
  useEffect(() => {
    if (!selYear || !selProgram) return;
    let cancelled = false;
    setCtxLoading(true);
    setCtxError(null);
    setCtx(null);
    setShowHistory(false);
    api.get("/attendance/context", {
      params: { academic_year_id: selYear.academic_year_id, program_id: selProgram.program_id },
    })
      .then((r) => !cancelled && setCtx(r.data))
      .catch((e) => !cancelled && setCtxError(e.userMessage || "Failed to load academic context"))
      .finally(() => !cancelled && setCtxLoading(false));
    return () => { cancelled = true; };
  }, [selYear, selProgram]);

  // Derived B.Tech study year for a batch = (latest batch - this batch) + 1, 1..4.
  const maxStart = years.reduce((m, y) => Math.max(m, y.start_year || 0), 0);
  const studyYearOf = (y) =>
    !y || !y.start_year || !maxStart ? null : Math.max(1, Math.min(4, maxStart - y.start_year + 1));

  const resetAll = () => { setSelYear(null); setSelProgram(null); setSelSubject(null); };

  // ---- Level 4: attendance entry for a subject ----
  if (selYear && selProgram && selSubject) {
    return (
      <div className="space-y-4">
        <Breadcrumb
          trail={[
            { label: "Attendance", onClick: resetAll },
            { label: selYear.year_label, onClick: () => { setSelProgram(null); setSelSubject(null); } },
            { label: selProgram.program_name, onClick: () => setSelSubject(null) },
            { label: selSubject.course_name },
          ]}
        />
        <AttendanceEntry
          year={selYear}
          program={selProgram}
          subject={selSubject}
          sections={ctx?.sections || []}
          onBack={() => setSelSubject(null)}
        />
      </div>
    );
  }

  // ---- Level 3: subjects for the current (and past) semesters ----
  if (selYear && selProgram) {
    const pastSemesters = (ctx?.semesters || []).filter((s) => s.is_past && s.subjects.length);
    const futureSemesters = (ctx?.semesters || []).filter((s) => s.is_future && s.subjects.length);

    return (
      <div className="space-y-5">
        <Breadcrumb
          trail={[
            { label: "Attendance", onClick: resetAll },
            { label: selYear.year_label, onClick: () => setSelProgram(null) },
            { label: selProgram.program_name },
          ]}
        />

        {ctxError && <Alert tone="red" title="Couldn't load subjects">{ctxError}</Alert>}

        {ctxLoading || !ctx ? (
          <>
            <Skeleton className="h-16 w-full max-w-md" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
            </div>
          </>
        ) : (
          <>
            <PageHeader
              title={selProgram.program_name}
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone="green" dot>
                    Current: Year {ctx.current_year} · Semester {ctx.current_semester}
                    {ctx.term_type ? ` (${ctx.term_type})` : ""}
                  </Badge>
                  <span className="text-slate-500">
                    {selYear.year_label} · {ctx.total_students} students · Sections{" "}
                    {ctx.sections.length ? ctx.sections.join(", ") : "—"}
                  </span>
                </span>
              }
            />

            <div>
              <SectionTitle>Current Semester Subjects</SectionTitle>
              {ctx.current_subjects.length === 0 ? (
                <Card className="p-6 text-sm text-slate-500">
                  No subjects mapped to the current semester for this branch. Add them on the
                  Courses page.
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {ctx.current_subjects.map((s, i) => (
                    <SubjectCard
                      key={s.course_id}
                      subject={s}
                      tone={TONES[i % TONES.length]}
                      onClick={() => setSelSubject(s)}
                    />
                  ))}
                </div>
              )}
            </div>

            {(pastSemesters.length > 0 || futureSemesters.length > 0) && (
              <div>
                <SectionTitle
                  right={
                    <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
                      {showHistory ? "Hide" : "Show"} previous semesters
                      <Icon name="chevronRight" className={`h-4 w-4 transition ${showHistory ? "rotate-90" : ""}`} />
                    </Button>
                  }
                >
                  History
                </SectionTitle>

                {showHistory && (
                  <div className="space-y-5">
                    {pastSemesters.map((sem) => (
                      <div key={`p${sem.semester_number}`}>
                        <div className="mb-2 text-xs font-semibold text-slate-500">
                          Semester {sem.semester_number}
                          {sem.term_type ? ` · ${sem.term_type}` : ""}{" "}
                          <Badge tone="slate">Past</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {sem.subjects.map((s, i) => (
                            <SubjectCard
                              key={s.course_id}
                              subject={s}
                              tone="slate"
                              onClick={() => setSelSubject(s)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {futureSemesters.map((sem) => (
                      <div key={`f${sem.semester_number}`}>
                        <div className="mb-2 text-xs font-semibold text-slate-500">
                          Semester {sem.semester_number}
                          {sem.term_type ? ` · ${sem.term_type}` : ""}{" "}
                          <Badge tone="amber">Upcoming</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {sem.subjects.map((s) => (
                            <SubjectCard key={s.course_id} subject={s} tone="slate" disabled />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ---- Level 2: branch (program) cards for the selected batch ----
  if (selYear) {
    const sy = studyYearOf(selYear);
    return (
      <div className="space-y-5">
        <Breadcrumb
          trail={[
            { label: "Attendance", onClick: () => setSelYear(null) },
            { label: selYear.year_label },
          ]}
        />
        <PageHeader
          title={`Branches — ${selYear.year_label}`}
          subtitle={sy ? `Currently Year ${sy} · select a branch to see its current subjects` : "Select a branch"}
        />
        {programs.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">
            No branches yet. Add them (e.g. CSE, ECE, Civil, Mechanical) on the Branches page.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {programs.map((p, i) => (
              <NavCard
                key={p.program_id}
                title={p.program_name}
                subtitle={sy ? `Year ${sy} students` : null}
                icon="programs"
                tone={TONES[i % TONES.length]}
                onClick={() => setSelProgram(p)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Level 1: academic-year (batch) cards ----
  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        subtitle="Pick a batch → branch → subject to mark current-semester attendance. Previous semesters stay available under History."
      />
      {years.length === 0 ? (
        <Card className="p-6 text-sm text-slate-500">
          No academic years yet. Add them on the Academic Years page.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {years.map((y, i) => {
            const sy = studyYearOf(y);
            return (
              <NavCard
                key={y.academic_year_id}
                title={y.year_label}
                subtitle={sy ? `Batch · currently Year ${sy}` : "Batch"}
                icon="academic"
                tone={TONES[i % TONES.length]}
                onClick={() => setSelYear(y)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

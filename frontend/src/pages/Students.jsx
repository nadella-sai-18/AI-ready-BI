import { useEffect, useState } from "react";
import api from "../api/client.js";
import CrudPage from "../components/CrudPage.jsx";
import { Badge, Button, Card, PageHeader, Spinner } from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";

const PROGRAM_OPT = { path: "/programs", valueKey: "program_id", labelKey: "program_name" };
const YEAR_OPT = { path: "/academic-years", valueKey: "academic_year_id", labelKey: "year_label" };
const statusTone = { Active: "green", Graduated: "indigo", Discontinued: "red" };
const TONES = ["indigo", "green", "amber", "red", "slate"];

async function countStudents(params) {
  const { data } = await api.get("/students", { params: { ...params, limit: 1 } });
  return data.total ?? 0;
}

function Breadcrumb({ trail }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
      {trail.map((t, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-slate-300" />}
          {t.onClick ? (
            <button
              onClick={t.onClick}
              className="font-medium text-slate-500 transition hover:text-brand-700"
            >
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

function StatCard({ title, subtitle, count, tone, icon, onClick }) {
  const chip = {
    indigo: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  }[tone];
  const text = {
    indigo: "text-brand-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    slate: "text-slate-700",
  }[tone];
  return (
    <button onClick={onClick} className="group text-left">
      <Card hover className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-800">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          {icon && (
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${chip}`}>
              <Icon name={icon} className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className={`text-3xl font-bold tracking-tight ${text}`}>
              {count == null ? <Spinner /> : count}
            </div>
            <div className="text-xs text-slate-400">students</div>
          </div>
          <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500">
            <Icon name="chevronRight" className="h-5 w-5" />
          </span>
        </div>
      </Card>
    </button>
  );
}

export default function Students() {
  const [years, setYears] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selYear, setSelYear] = useState(null);
  const [selProgram, setSelProgram] = useState(null);
  const [counts, setCounts] = useState({}); // keyed cache

  useEffect(() => {
    api.get("/academic-years", { params: { limit: 500 } })
      .then((r) => setYears(r.data.items || []))
      .catch(() => setYears([]));
    api.get("/programs", { params: { limit: 500 } })
      .then((r) => setPrograms(r.data.items || []))
      .catch(() => setPrograms([]));
  }, []);

  // Counts for the year cards.
  useEffect(() => {
    if (selYear || years.length === 0) return;
    years.forEach(async (y) => {
      const key = `y:${y.academic_year_id}`;
      const c = await countStudents({ academic_year_id: y.academic_year_id });
      setCounts((m) => ({ ...m, [key]: c }));
    });
  }, [years, selYear]);

  // Counts for the branch (program) cards within the selected year.
  useEffect(() => {
    if (!selYear || selProgram || programs.length === 0) return;
    programs.forEach(async (p) => {
      const key = `yp:${selYear.academic_year_id}:${p.program_id}`;
      const c = await countStudents({
        academic_year_id: selYear.academic_year_id,
        program_id: p.program_id,
      });
      setCounts((m) => ({ ...m, [key]: c }));
    });
  }, [selYear, selProgram, programs]);

  // Study year for an admission batch = (latest academic year - batch) + 1, 1..4.
  const maxStart = years.reduce((m, y) => Math.max(m, y.start_year || 0), 0);
  const studyYearOf = (y) =>
    !y || !y.start_year || !maxStart
      ? "?"
      : Math.max(1, Math.min(4, maxStart - y.start_year + 1));

  // ---- Level 3: the student table for a year + branch ----
  if (selYear && selProgram) {
    const editFields = [
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "roll_number", label: "Roll Number", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone_number", label: "Phone Number", type: "text" },
      { name: "gender", label: "Gender", type: "static-select", choices: ["Male", "Female", "Other"] },
      { name: "date_of_birth", label: "Date of Birth", type: "date" },
      { name: "program_id", label: "Branch", type: "select-number", options: PROGRAM_OPT },
      { name: "academic_year_id", label: "Academic Year", type: "select-number", options: YEAR_OPT },
      { name: "current_year", label: "Year (1-4)", type: "number", min: 1, max: 4 },
      { name: "current_semester", label: "Current Semester (1-8)", type: "number", min: 1, max: 8 },
      { name: "section", label: "Section", type: "static-select", choices: ["A", "B", "C", "D"] },
      { name: "enrollment_year", label: "Admission Year", type: "number", min: 1900, max: 2100 },
      { name: "status", label: "Status", type: "static-select", choices: ["Active", "Graduated", "Discontinued"] },
    ];

    return (
      <div className="space-y-4">
        <Breadcrumb
          trail={[
            { label: "Students", onClick: () => { setSelYear(null); setSelProgram(null); } },
            { label: selYear.year_label, onClick: () => setSelProgram(null) },
            { label: selProgram.program_name },
          ]}
        />
        <CrudPage
          title={selProgram.program_name}
          singular="Student"
          description={`Students · ${selYear.year_label} · Year ${studyYearOf(selYear)}`}
          path="/students"
          idKey="student_id"
          searchable
          titleField="full_name"
          fixedParams={{
            academic_year_id: selYear.academic_year_id,
            program_id: selProgram.program_id,
          }}
          createDefaults={{
            academic_year_id: selYear.academic_year_id,
            program_id: selProgram.program_id,
          }}
          headerRight={
            <Button variant="secondary" onClick={() => setSelProgram(null)}>
              ← Back
            </Button>
          }
          columns={[
            { key: "student_id", label: "ID", sortable: true },
            { key: "roll_number", label: "Roll No", sortable: true },
            { key: "full_name", label: "Full Name", sortable: true },
            { key: "current_year", label: "Year", sortable: true },
            { key: "section", label: "Sec", sortable: true },
            {
              key: "status",
              label: "Status",
              sortable: true,
              render: (r) =>
                r.status ? <Badge tone={statusTone[r.status] || "slate"}>{r.status}</Badge> : "—",
            },
          ]}
          filters={[
            { name: "status", label: "Status", type: "static-select", choices: ["Active", "Graduated", "Discontinued"] },
            { name: "section", label: "Section", type: "static-select", choices: ["A", "B", "C", "D"] },
          ]}
          createFields={[
            { name: "full_name", label: "Full Name", type: "text", required: true },
          ]}
          editFields={editFields}
        />
      </div>
    );
  }

  // ---- Level 2: branch (program) cards for the selected year ----
  if (selYear) {
    return (
      <div className="space-y-5">
        <Breadcrumb
          trail={[
            { label: "Students", onClick: () => setSelYear(null) },
            { label: selYear.year_label },
          ]}
        />
        <PageHeader
          title={`Branches — ${selYear.year_label}`}
          subtitle={`Year ${studyYearOf(selYear)} · select a branch to manage its students`}
        />
        {programs.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">
            No branches yet. Add them (e.g. CSE, ECE, Civil, Mechanical) on the
            Branches page first.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {programs.map((p, i) => (
              <StatCard
                key={p.program_id}
                title={p.program_name}
                icon="programs"
                count={counts[`yp:${selYear.academic_year_id}:${p.program_id}`]}
                tone={TONES[i % TONES.length]}
                onClick={() => setSelProgram(p)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Level 1: academic-year cards ----
  return (
    <div className="space-y-5">
      <PageHeader
        title="Students"
        subtitle={`Select an admission batch to drill into branches. Study year is derived from the batch (as of ${
          maxStart ? `${maxStart}-${maxStart + 1}` : "the latest year"
        }).`}
      />
      {years.length === 0 ? (
        <Card className="p-6 text-sm text-slate-500">
          No academic years yet. Add them on the Academic Years page.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {years.map((y, i) => (
            <StatCard
              key={y.academic_year_id}
              title={y.year_label}
              subtitle={`Batch · currently Year ${studyYearOf(y)}`}
              icon="academic"
              count={counts[`y:${y.academic_year_id}`]}
              tone={TONES[i % TONES.length]}
              onClick={() => setSelYear(y)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

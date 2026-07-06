import { useEffect, useState } from "react";
import api from "../api/client.js";
import KpiCard from "../components/KpiCard.jsx";
import { HBarChart } from "../components/charts.jsx";
import IntegrationButtons from "../components/IntegrationButtons.jsx";
import { Alert, Badge, Card, PageHeader, SectionTitle } from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kpis, setKpis] = useState({});
  const [competencies, setCompetencies] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classAtt, setClassAtt] = useState([]);
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [k, c, co, a, pi] = await Promise.all([
          api.get("/dashboard/kpis"),
          api.get("/dashboard/competency-analysis"),
          api.get("/dashboard/course-performance"),
          api.get("/dashboard/today-attendance"),
          api.get("/dashboard/performance-insights"),
        ]);
        if (cancelled) return;
        setKpis(k.data);
        setCompetencies(c.data);
        setCourses(co.data);
        setClassAtt(a.data);
        setPerf(pi.data);
      } catch (err) {
        if (!cancelled) setError(err.userMessage || "Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="College Overview"
        subtitle="Live attendance, marks and performance across all branches — updated in real time."
        actions={<IntegrationButtons />}
      />

      {error && <Alert tone="red" title="Couldn't load dashboard">{error}</Alert>}

      {/* KPI cards */}
      <div>
        <SectionTitle>Key Metrics</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Students" value={kpis.total_students} loading={loading} tone="indigo" icon="gradcap" />
          <KpiCard label="Total Faculty" value={kpis.total_faculty} loading={loading} tone="indigo" icon="faculty" />
          <KpiCard label="Total Subjects" value={kpis.total_courses} loading={loading} tone="indigo" icon="courses" />
          <KpiCard label="Total Branches" value={kpis.total_programs} loading={loading} tone="indigo" icon="programs" />
          <KpiCard
            label="Attendance"
            value={kpis.attendance_percentage}
            suffix="%"
            loading={loading}
            tone="green"
            icon="calendarCheck"
          />
          <KpiCard
            label="Average Marks"
            value={kpis.average_marks}
            suffix="%"
            loading={loading}
            tone="green"
            icon="marks"
          />
          <KpiCard
            label="At-Risk Students"
            value={kpis.risk_students}
            loading={loading}
            tone="red"
            icon="alert"
            hint="avg marks below 40% or attendance below 75%"
          />
          <KpiCard
            label="Pass Rate"
            value={kpis.pass_rate}
            suffix="%"
            loading={loading}
            tone="amber"
            icon="award"
          />
        </div>
      </div>

      {/* Charts */}
      <SectionTitle>Academic Analytics</SectionTitle>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HBarChart
          title="Today's Attendance by Class"
          subtitle="Attendance % per class (branch + section), latest day"
          tone="green"
          unit="%"
          data={classAtt.map((c) => ({
            label: `${c.branch} · Sec ${c.section}`,
            value: c.attendance_percentage,
          }))}
          empty="No attendance recorded yet."
        />
        <HBarChart
          title="Competency Analysis"
          subtitle="Average score per competency"
          tone="green"
          data={competencies.map((c) => ({
            label: c.competency_name,
            value: c.avg_score,
            caption: c.competency_level ? `· ${c.competency_level}` : "",
          }))}
        />
      </div>

      {/* Principal / admin performance insights */}
      <SectionTitle>Performance Insights</SectionTitle>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HBarChart
          title="Branch Performance"
          subtitle="Average marks % by branch (with pass rate)"
          tone="indigo"
          data={(perf?.branch_performance || []).map((b) => ({
            label: b.program_name,
            value: b.avg_percentage,
            caption: b.pass_percentage != null ? `· ${b.pass_percentage}% pass` : "",
          }))}
          unit="%"
          empty="No marks yet."
        />
        <HBarChart
          title="At-Risk Students by Branch"
          subtitle="Students needing attention (low marks / fails / absences)"
          tone="red"
          data={(perf?.at_risk_by_branch || []).map((b) => ({
            label: b.branch,
            value: b.count,
          }))}
          empty="No at-risk students 🎉"
        />
        <InsightList
          title="Weakest Sections"
          icon="students"
          rows={perf?.weak_sections}
          empty="No section data"
          render={(r) => (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-slate-700">{r.branch}</span>
                <Badge tone="slate">Sec {r.section}</Badge>
                <span className="text-xs text-slate-400">Sem {r.semester_number}</span>
              </span>
              <span className="font-semibold tabular-nums text-red-600">{r.avg_percentage}%</span>
            </>
          )}
        />
        <InsightList
          title="Weakest Subjects"
          icon="courses"
          rows={perf?.weak_subjects}
          empty="No subject data"
          render={(r) => (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-slate-700">{r.subject}</span>
                <span className="truncate text-xs text-slate-400">· {r.branch}</span>
              </span>
              <span className="font-semibold tabular-nums text-slate-800">{r.avg_percentage}%</span>
            </>
          )}
        />
      </div>

      {/* Subject performance (full list) */}
      <SectionTitle>Subject Performance</SectionTitle>
      <HBarChart
        title="Average Score per Subject"
        subtitle="Across all branches and semesters"
        tone="amber"
        data={courses.map((c) => ({
          label: c.course_name,
          value: c.avg_score,
          caption: `· ${c.enrolled_students} enrolled`,
        }))}
        empty="No graded subjects yet."
      />
    </div>
  );
}

function InsightList({ title, icon, rows, empty, render }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon name={icon} className="h-4 w-4 text-brand-600" />
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      </div>
      {!rows || rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              {render(r)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

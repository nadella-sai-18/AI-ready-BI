import { useEffect, useState } from "react";
import api from "../../api/client.js";
import { Alert, Badge, Card, Skeleton } from "../ui.jsx";
import { Icon } from "../Icons.jsx";

function List({ title, icon, rows, empty, suffix = "%", render }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon name={icon} className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {!rows || rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">{empty || "No data"}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 flex-shrink-0 text-xs text-slate-400">{i + 1}</span>
                <span className="truncate text-slate-700">{r.name}</span>
                {r.section && !r.name?.includes("Section") && <span className="flex-shrink-0 text-xs text-slate-400">· {r.section}</span>}
                {r.detail && <span className="flex-shrink-0 text-xs text-slate-400">· {r.detail}</span>}
              </span>
              {render ? render(r) : (r.value != null && (
                <span className="flex-shrink-0 font-semibold tabular-nums text-slate-800">{r.value}{suffix}</span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function MarksInsights({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const key = JSON.stringify(params || {});
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    api.get("/marks/insights", { params })
      .then((r) => !cancelled && setData(r.data))
      .catch((e) => !cancelled && setError(e.userMessage || "Failed to load insights"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (loading) return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;
  if (error) return <Alert tone="red" title="Couldn't load insights">{error}</Alert>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {data.scope && <p className="text-xs text-slate-500">Scope: <span className="font-medium text-slate-700">{data.scope}</span></p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <List title="Toppers" icon="award" rows={data.top_students} empty="No graded exams" />
        <List title="Bottom Performers" icon="alert" rows={data.bottom_students} empty="No graded exams" />
        <List title="Section Performance" icon="students" rows={data.section_performance} empty="No data" />
        <List title="Branch Comparison" icon="programs" rows={data.branch_performance} empty="No data" />
        <List title="Weakest Subjects" icon="courses" rows={data.weak_subjects} empty="No data" />
        <List title="Students Below 40%" icon="alert" rows={data.below_threshold} empty="None below threshold 🎉"
          render={(r) => <span className="flex-shrink-0 font-semibold tabular-nums text-red-600">{r.value}%</span>} />
        <List title="Multiple Failures" icon="alert" rows={data.multiple_fails} empty="None with 3+ fails 🎉"
          render={() => <Badge tone="red">at risk</Badge>} />
        <List title="Absent in Exams" icon="calendarCheck" rows={data.absentees} empty="No absentees"
          render={() => <Badge tone="amber">absent</Badge>} />
      </div>
    </div>
  );
}

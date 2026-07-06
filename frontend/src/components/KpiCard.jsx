import { Card, Skeleton } from "./ui.jsx";
import { Icon } from "./Icons.jsx";

const TONES = {
  indigo: { chip: "bg-brand-50 text-brand-600", value: "text-slate-900", bar: "bg-brand-500" },
  green: { chip: "bg-emerald-50 text-emerald-600", value: "text-slate-900", bar: "bg-emerald-500" },
  amber: { chip: "bg-amber-50 text-amber-600", value: "text-slate-900", bar: "bg-amber-500" },
  red: { chip: "bg-red-50 text-red-600", value: "text-slate-900", bar: "bg-red-500" },
  slate: { chip: "bg-slate-100 text-slate-600", value: "text-slate-900", bar: "bg-slate-400" },
};

export default function KpiCard({ label, value, suffix, loading, tone = "indigo", hint, icon }) {
  const t = TONES[tone] || TONES.indigo;
  const empty = value === null || value === undefined;

  return (
    <Card hover className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{label}</p>
          <div className="mt-2 flex items-baseline gap-1">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <span className={`text-3xl font-bold tracking-tight ${t.value}`}>
                  {empty ? "—" : value}
                </span>
                {suffix && !empty && (
                  <span className="text-lg font-semibold text-slate-400">{suffix}</span>
                )}
              </>
            )}
          </div>
          {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
        </div>
        {icon && (
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${t.chip}`}>
            <Icon name={icon} className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

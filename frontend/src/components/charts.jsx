import { Card } from "./ui.jsx";

/**
 * Lightweight, dependency-free charts (pure SVG / CSS). Suitable for an
 * operational overview without pulling in a charting library.
 */

const TONES = {
  indigo: "#16a34a",
  green: "#059669",
  amber: "#d97706",
  red: "#dc2626",
  slate: "#475569",
};

function ChartHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-slate-400">
      {text || "No data available."}
    </div>
  );
}

export function HBarChart({ title, subtitle, data, unit = "", tone = "indigo", empty }) {
  const color = TONES[tone] || TONES.indigo;
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));

  return (
    <Card hover className="p-5">
      <ChartHeader title={title} subtitle={subtitle} />
      {data.length === 0 ? (
        <EmptyChart text={empty} />
      ) : (
        <div className="space-y-3.5">
          {data.map((d, i) => {
            const value = Number(d.value) || 0;
            const pct = Math.round((value / max) * 100);
            return (
              <div key={i}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="truncate pr-2 text-slate-600">{d.label}</span>
                  <span className="flex-shrink-0 font-semibold tabular-nums text-slate-800">
                    {d.value == null ? "—" : d.value}
                    {d.value == null ? "" : unit}
                    {d.caption ? (
                      <span className="ml-1 font-normal text-slate-400">{d.caption}</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: value > 0 ? `calc(${pct}% )` : "0%",
                      minWidth: value > 0 ? "6px" : 0,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function Donut({ title, subtitle, data, empty }) {
  const total = data.reduce((a, b) => a + (Number(b.value) || 0), 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Card hover className="p-5">
      <ChartHeader title={title} subtitle={subtitle} />
      {total === 0 ? (
        <EmptyChart text={empty} />
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <svg width="150" height="150" viewBox="0 0 160 160" className="flex-shrink-0">
            <g transform="translate(80,80) rotate(-90)">
              <circle r={radius} fill="none" stroke="#eef2f7" strokeWidth="16" />
              {data.map((d, i) => {
                const value = Number(d.value) || 0;
                const frac = value / total;
                const dash = frac * circumference;
                const seg = (
                  <circle
                    key={i}
                    r={radius}
                    fill="none"
                    stroke={d.color}
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(dash - 2, 0)} ${circumference - Math.max(dash - 2, 0)}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += dash;
                return seg;
              })}
            </g>
            <text
              x="80"
              y="72"
              textAnchor="middle"
              className="fill-slate-900"
              style={{ fontSize: "26px", fontWeight: 700 }}
            >
              {total}
            </text>
            <text
              x="80"
              y="94"
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: "11px" }}
            >
              total
            </text>
          </svg>
          <div className="flex-1 space-y-2">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="flex-1 text-slate-600">{d.label}</span>
                <span className="font-semibold tabular-nums text-slate-800">{d.value}</span>
                <span className="w-10 text-right text-xs tabular-nums text-slate-400">
                  {Math.round(((Number(d.value) || 0) / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

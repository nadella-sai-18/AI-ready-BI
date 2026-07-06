import { Skeleton } from "./ui.jsx";
import { Icon } from "./Icons.jsx";

/**
 * Generic table with optional server-side sorting.
 * columns: [{ key, label, render?(row), sortable?, sortKey? }]
 * actions?: (row) => ReactNode  — rendered in a trailing "Actions" column
 * sortBy / order / onSort — enable clickable sort headers
 */
export default function DataTable({
  columns,
  rows,
  loading,
  error,
  actions,
  emptyText,
  sortBy,
  order,
  onSort,
  skeletonRows = 6,
}) {
  const colCount = columns.length + (actions ? 1 : 0);

  const arrow = (col) => {
    const key = col.sortKey || col.key;
    if (sortBy !== key) return <span className="text-slate-300">↕</span>;
    return <span className="text-brand-600">{order === "desc" ? "↓" : "↑"}</span>;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable && onSort;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      sortable && sortBy === (c.sortKey || c.key)
                        ? order === "desc"
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap ${
                      sortable ? "cursor-pointer select-none hover:text-slate-800" : ""
                    }`}
                    onClick={sortable ? () => onSort(c.sortKey || c.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {c.label}
                      {sortable && arrow(c)}
                    </span>
                  </th>
                );
              })}
              {actions && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: skeletonRows }).map((_, r) => (
                <tr key={`sk-${r}`}>
                  {Array.from({ length: colCount }).map((__, ci) => (
                    <td key={ci} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[8rem]" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && error && (
              <tr>
                <td colSpan={colCount} className="px-4 py-12">
                  <div className="flex flex-col items-center gap-2 text-red-600">
                    <Icon name="alert" className="h-8 w-8" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-14">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Icon name="inbox" className="h-9 w-9" />
                    <span className="text-sm font-medium text-slate-500">
                      {emptyText || "No records found"}
                    </span>
                    <span className="text-xs">Try adjusting your search or filters.</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              rows.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-brand-50/40">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-2">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

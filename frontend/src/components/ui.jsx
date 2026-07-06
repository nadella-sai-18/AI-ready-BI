// Reusable design-system primitives for a consistent, modern ERP look.

export function Button({ variant = "primary", size = "md", type = "button", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]";
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm",
  };
  const variants = {
    primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:ring-brand-500",
    secondary:
      "bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-slate-400",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500",
    ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300",
    subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:ring-brand-300",
  };
  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", invalid = false, ...props }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
        invalid
          ? "border-red-400 focus:border-red-500 focus:ring-red-200"
          : "border-slate-300 focus:border-brand-500 focus:ring-brand-200"
      } ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", invalid = false, children, ...props }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2 ${
        invalid
          ? "border-red-400 focus:border-red-500 focus:ring-red-200"
          : "border-slate-300 focus:border-brand-500 focus:ring-brand-200"
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children, required, className = "" }) {
  return (
    <label className={`mb-1.5 block text-sm font-medium text-slate-700 ${className}`}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

export function Badge({ tone = "slate", children, dot = false }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    indigo: "bg-brand-50 text-brand-700 ring-brand-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  const dotColor = {
    slate: "bg-slate-400",
    green: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    indigo: "bg-brand-500",
    blue: "bg-blue-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor[tone]}`} />}
      {children}
    </span>
  );
}

export function Spinner({ className = "", size = "md" }) {
  const sizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-8 w-8 border-[3px]" };
  return (
    <div
      className={`${sizes[size]} animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 ${className}`}
    />
  );
}

export function Alert({ tone = "red", title, children }) {
  const tones = {
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export function Card({ className = "", hover = false, children, ...props }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-card ${
        hover ? "transition-shadow hover:shadow-card-hover" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** Consistent page header: title, subtitle and right-aligned actions. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small section heading used above cards/charts. */
export function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {right}
    </div>
  );
}

/** Skeleton placeholder block. */
export function Skeleton({ className = "" }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

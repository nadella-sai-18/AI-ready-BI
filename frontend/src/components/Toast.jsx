import { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "./Icons.jsx";

const ToastContext = createContext(null);

let idSeq = 0;

const CONFIG = {
  success: { bar: "bg-emerald-500", icon: "checkCircle", iconColor: "text-emerald-500" },
  error: { bar: "bg-red-500", icon: "alert", iconColor: "text-red-500" },
  info: { bar: "bg-brand-500", icon: "inbox", iconColor: "text-brand-500" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = "success") => {
      const id = ++idSeq;
      setToasts((t) => [...t, { id, message, tone }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const toast = {
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((t) => {
          const c = CONFIG[t.tone] || CONFIG.info;
          return (
            <div
              key={t.id}
              className="animate-slide-in-right flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white pl-0 pr-3 py-3 shadow-lg"
            >
              <span className={`h-full w-1 self-stretch ${c.bar}`} />
              <Icon name={c.icon} className={`mt-0.5 h-5 w-5 flex-shrink-0 ${c.iconColor}`} />
              <p className="flex-1 text-sm text-slate-700">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="mt-0.5 flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

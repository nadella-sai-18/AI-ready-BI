import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROLES, useAuth } from "../auth/AuthContext.jsx";
import { Alert, Button, Input, Label, Select } from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [username, setUsername] = useState("");
  const [role, setRole] = useState("Admin");
  const [error, setError] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }
    login({ username: username.trim(), role });
    navigate(from, { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950 p-4">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-xl font-bold text-white shadow-lg shadow-brand-900/50">
            AI
          </div>
          <h1 className="text-2xl font-bold text-white">AI-Ready BI</h1>
          <p className="text-sm text-brand-300">College Analytics Management System</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
          <p className="mb-5 text-sm text-slate-500">Access your analytics dashboard.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label required>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                autoComplete="username"
                autoFocus
                invalid={!!error}
              />
            </div>
            <div>
              <Label required>Role</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>

            {error && <Alert tone="red">{error}</Alert>}

            <Button type="submit" size="lg" className="w-full">
              <Icon name="logout" className="h-4 w-4 rotate-180" /> Sign in
            </Button>
          </form>

          <p className="mt-6 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Demo sign-in — no password required. Choose your role to continue.</span>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-brand-400">
          College Analytics &amp; ERP
        </p>
      </div>
    </div>
  );
}

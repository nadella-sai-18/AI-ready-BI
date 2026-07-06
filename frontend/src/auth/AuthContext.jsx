import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Local session context.
 *
 * NOTE: The backend does not yet expose an authentication endpoint (the `users`
 * table / JWT auth is a later phase). To keep the UI functional, this stores a
 * local session (username + role) in localStorage. It does NOT fabricate any
 * business data — every page still reads real records from the FastAPI backend.
 * When the backend auth endpoint lands, replace `login()` with a real API call.
 */

const AuthContext = createContext(null);

export const ROLES = ["Admin", "Faculty", "Management"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("auth_user", JSON.stringify(user));
      // Placeholder token until real JWT auth exists.
      localStorage.setItem("auth_token", `local-${user.role}-${user.username}`);
    } else {
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_token");
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      login: ({ username, role }) => setUser({ username, role }),
      logout: () => setUser(null),
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

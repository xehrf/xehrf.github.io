import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client";
import { OnboardingModal } from "../components/OnboardingModal.jsx";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider />");
  return ctx;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));
  const [user, setUser] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async (tokenOverride) => {
    const actualToken = tokenOverride ?? token;
    if (!actualToken) {
      setUser(null);
      return;
    }
    try {
      const me = await apiFetch("/auth/me", {
        method: "GET",
        auth: false,
        headers: { Authorization: `Bearer ${actualToken}` },
      });
      setUser(me);
      // Check if onboarding is needed
      if (me && !me.onboarding_completed) {
        setShowOnboarding(true);
      } else if (me && me.onboarding_completed) {
        setShowOnboarding(false);
      }
    } catch {
      localStorage.removeItem("access_token");
      setToken(null);
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        if (mounted) await refreshMe();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshMe]);

  const login = useCallback(async ({ email, password }) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    localStorage.setItem("access_token", data.access_token);
    setToken(data.access_token);
    await refreshMe(data.access_token);
    return data;
  }, [refreshMe]);

  const register = useCallback(async ({ email, password, display_name }) => {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      auth: false,
      body: { email, password, display_name },
    });
    localStorage.setItem("access_token", data.access_token);
    setToken(data.access_token);
    await refreshMe(data.access_token);
    return data;
  }, [refreshMe]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setToken(null);
    setUser(null);
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false);
    // Дайте серверу время на сохранение, потом обновите профиль
    await new Promise(resolve => setTimeout(resolve, 500));
    await refreshMe();
  }, [refreshMe]);

  const value = useMemo(
    () => ({ token, user, loading, login, register, logout, refreshMe }),
    [token, user, loading, login, register, logout, refreshMe],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
    </AuthContext.Provider>
  );
}


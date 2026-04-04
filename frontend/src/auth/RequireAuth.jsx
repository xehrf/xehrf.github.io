import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }) {
  const { user, loading, token } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted">Загрузка...</div>;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}


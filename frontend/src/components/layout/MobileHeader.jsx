import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";

/**
 * Верхняя панель только на мобильных (< md). Десктоп использует Navbar.
 * @param {{ elo: number, pts: number, display_name: string } | null} props.user
 */
export function MobileHeader({ user }) {
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-[#30363D] bg-[#0D1117]/95 px-4 backdrop-blur-md md:hidden">
      <Link
        to={user ? "/dashboard" : "/"}
        className="flex items-center gap-2 font-semibold tracking-tight text-[#E6EDF3] active:scale-[0.98] transition-transform duration-150"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#30363D] bg-[#161B22] text-xs font-bold text-[#FFD700]">
          CA
        </span>
        <span className="text-sm">CodeArena</span>
      </Link>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <span className="text-xs tabular-nums text-[#FFD700]">{user.pts} PTS</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-[10px] border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-medium text-[#8B949E] active:scale-[0.97] transition-transform duration-150"
            >
              Выйти
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <Link
              to="/login"
              className="rounded-[10px] border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-medium text-[#E6EDF3] active:scale-[0.97] transition-transform duration-150"
            >
              Войти
            </Link>
            <Link
              to="/register"
              className="rounded-[10px] bg-[#FFD700]/15 px-3 py-2 text-xs font-semibold text-[#FFD700] active:scale-[0.97] transition-transform duration-150"
            >
              Регистрация
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { resolveAssetUrl } from "../../api/client";

const navLinkClass = ({ isActive }) =>
  [
    "text-sm font-medium transition-colors duration-200",
    isActive ? "text-accent" : "text-muted hover:text-foreground",
  ].join(" ");

/**
 * @param {object} props
 * @param {{ pts: number, display_name: string, email: string, avatar_url?: string } | null} props.user
 */
export function Navbar({ user }) {
  const { logout } = useAuth();
  const [avatarFailed, setAvatarFailed] = useState(false);

  const displayName = user?.display_name ?? "Guest";
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarUrl = user?.avatar_url ? resolveAssetUrl(user.avatar_url) : "";

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2 font-semibold tracking-tight text-foreground transition-colors hover:text-accent"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-elevated text-xs font-bold text-accent shadow-card transition-all duration-200 group-hover:border-accent/40 group-hover:shadow-glow">
            CA
          </span>
          <span className="hidden sm:inline">CodeArena</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/dashboard" className={navLinkClass}>
            Задачи
          </NavLink>
          <NavLink to="/freelance" className={navLinkClass}>
            Фриланс
          </NavLink>
          <NavLink to="/matchmaking" className={navLinkClass}>
            Матчмейкинг
          </NavLink>
          <NavLink to="/teams" className={navLinkClass}>
            Команды
          </NavLink>

          <NavLink to="/profile" className={navLinkClass}>
            Профиль
          </NavLink>
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden flex-col items-end text-right text-xs leading-tight sm:flex">
            {user ? (
              <>
                <span className="font-medium text-foreground">{displayName}</span>
                <span className="text-muted">
                  PTS <span className="text-accent">{user.pts}</span>
                </span>
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">Гость</span>
                <span className="text-muted">Войдите для решений</span>
              </>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-elevated text-xs font-semibold text-accent transition-all duration-200 hover:border-accent/50 hover:shadow-glow"
                title="Профиль"
              >
                {avatarUrl && !avatarFailed ? (
                  <img
                    src={avatarUrl}
                    alt="User avatar"
                    className="h-full w-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="hidden rounded-btn border border-border bg-elevated px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-foreground sm:inline-flex"
              >
                Выйти
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-btn border border-border bg-elevated px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-foreground"
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="hidden rounded-btn bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/20 sm:inline-flex"
              >
                Регистрация
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

import { NavLink } from "react-router-dom";

const itemClass = ({ isActive }) =>
  [
    "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-[10px] px-2 py-2 text-[10px] font-medium transition-transform duration-150 active:scale-95",
    isActive ? "text-[#FFD700]" : "text-[#8B949E]",
  ].join(" ");

/**
 * Фиксированное нижнее меню: без матчмейкинга (только мобильные экраны).
 */
export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#30363D] bg-[#161B22]/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md md:hidden"
      aria-label="Основная навигация"
    >
      <div className="mx-auto flex max-w-[430px] items-end justify-around px-2">
        <NavLink to="/dashboard" className={itemClass}>
          <span className="text-lg leading-none" aria-hidden>
            🏠
          </span>
          <span>Задачи</span>
        </NavLink>
        <NavLink to="/freelance" className={itemClass}>
          <span className="text-lg leading-none" aria-hidden>
            💼
          </span>
          <span>Публикации</span>
        </NavLink>
        <NavLink to="/profile" className={itemClass}>
          <span className="text-lg leading-none" aria-hidden>
            👤
          </span>
          <span>Профиль</span>
        </NavLink>
      </div>
    </nav>
  );
}

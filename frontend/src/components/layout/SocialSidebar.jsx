import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch } from "../../api/client";

const ICON_ITEMS = [
  { to: "/social/friends", icon: "👥", label: "Друзья", badgeKey: "pending" },
  { to: "/social/messages", icon: "💬", label: "Сообщения", badgeKey: "unread" },
  { to: "/social/activity", icon: "📡", label: "Активность" },
];

function IconButton({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "group relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200",
          isActive
            ? "bg-accent/15 text-accent shadow-glow"
            : "bg-elevated/40 text-muted hover:bg-elevated hover:text-foreground",
        ].join(" ")
      }
    >
      <span className="text-xl">{icon}</span>
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
      {/* Tooltip on hover */}
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-btn border border-border bg-elevated px-2 py-1 text-xs font-semibold text-foreground opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 z-30">
        {label}
      </span>
    </NavLink>
  );
}

/**
 * Discord-style narrow social sidebar. Lives on the left edge on desktop
 * and is hidden on mobile (bottom nav handles small screens).
 *
 * - When `collapsed`, the bar slides off to the left and a small tab with a
 *   right-chevron appears so the user can pull it back. State lives in the
 *   parent (AppShell) and is persisted to localStorage.
 * - Polls /social/friends/pending and /social/dms in the background so the
 *   red-dot badges stay roughly fresh.
 */
export function SocialSidebar({ collapsed = false, onToggleCollapsed }) {
  const [counters, setCounters] = useState({ pending: 0, unread: 0 });

  useEffect(() => {
    let mounted = true;
    let timer;

    async function refresh() {
      try {
        const [pending, dms] = await Promise.all([
          apiFetch("/social/friends/pending").catch(() => []),
          apiFetch("/social/dms").catch(() => []),
        ]);
        if (!mounted) return;
        const pendingIncoming = Array.isArray(pending)
          ? pending.filter((p) => p.direction === "incoming").length
          : 0;
        const unread = Array.isArray(dms)
          ? dms.reduce((acc, c) => acc + (c.unread_count || 0), 0)
          : 0;
        setCounters({ pending: pendingIncoming, unread });
      } catch {
        // Unauthorized or backend offline — skip silently
      }
    }

    refresh();
    timer = setInterval(refresh, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const totalBadge = (counters.pending || 0) + (counters.unread || 0);

  return (
    <>
      <aside
        aria-hidden={collapsed}
        className={[
          "fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-canvas pb-4 pt-[4.5rem] transition-transform duration-200 md:flex",
          collapsed ? "-translate-x-full" : "translate-x-0",
        ].join(" ")}
      >
        <div className="flex flex-col gap-2">
          {ICON_ITEMS.map((item) => (
            <IconButton
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              badge={item.badgeKey ? counters[item.badgeKey] : 0}
            />
          ))}
        </div>

        {/* Collapse button at bottom of sidebar */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Свернуть"
          aria-label="Свернуть сайдбар"
          className="mt-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-elevated/60 text-muted transition hover:border-accent/40 hover:text-accent"
        >
          <span className="text-sm leading-none">◀</span>
        </button>
        <div className="mt-1 px-2 text-center text-[9px] uppercase tracking-wider text-muted/60">
          social
        </div>
      </aside>

      {/* Floating "pull out" tab while collapsed */}
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Открыть социал"
          aria-label="Открыть сайдбар"
          className="fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-border bg-elevated/90 px-1.5 py-3 text-muted shadow-card backdrop-blur transition hover:border-accent/50 hover:text-accent md:flex"
        >
          <span className="text-sm leading-none">▶</span>
          {totalBadge > 0 ? (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          ) : null}
        </button>
      ) : null}
    </>
  );
}

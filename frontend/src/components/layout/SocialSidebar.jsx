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
 * Polls /social/friends/pending and /social/dms in the background so the
 * red-dot badges stay roughly fresh.
 */
export function SocialSidebar() {
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

  return (
    <aside className="fixed left-0 top-14 z-40 hidden h-[calc(100vh-3.5rem)] w-16 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-canvas/80 py-4 backdrop-blur-md md:flex">
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
      <div className="mt-auto px-2 text-center text-[9px] uppercase tracking-wider text-muted/60">
        social
      </div>
    </aside>
  );
}

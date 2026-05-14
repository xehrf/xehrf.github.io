import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, resolveAssetUrl } from "../../api/client.js";
import { Button } from "./Button.jsx";

/**
 * Discord-style mini-profile that pops up next to whatever the user just
 * clicked.
 *
 * Wrap any clickable bit of player UI (a row, an avatar, a nickname) with
 * <PlayerHoverCard userId={...}>...</PlayerHoverCard>. On click:
 *   1. We capture the trigger's bounding rect.
 *   2. We lazy-fetch GET /users/<id>/profile (cached for the session).
 *   3. A portal-mounted card renders next to the trigger with avatar,
 *      banner, role badge, top stats, bio, skills, and an "Перейти в
 *      профиль" link.
 *   4. Click anywhere outside, press Escape, or click the trigger again
 *      to dismiss.
 *
 * Behaviour notes for callers:
 *   - The wrapper is `display: contents`, so it doesn't add a wrapping
 *     box to your layout — the actual `onClick` lives on the child.
 *   - Pass `disabled` (e.g. when this is the player themself) to skip
 *     the hover behaviour entirely. The children still render.
 *   - Multiple PlayerHoverCard instances on the same page share an
 *     in-memory profile cache.
 */

// In-memory cache. Profiles don't change often, and we don't want to spam
// the backend with `/users/<id>/profile` calls every time the user clicks
// the same row twice.
const profileCache = new Map();
const profileInFlight = new Map();

async function loadProfile(userId) {
  const key = String(userId);
  if (profileCache.has(key)) return profileCache.get(key);
  if (profileInFlight.has(key)) return profileInFlight.get(key);
  const promise = apiFetch(`/users/${key}/profile`)
    .then((data) => {
      profileCache.set(key, data);
      profileInFlight.delete(key);
      return data;
    })
    .catch((err) => {
      profileInFlight.delete(key);
      throw err;
    });
  profileInFlight.set(key, promise);
  return promise;
}

function MiniProfileCard({ profile, loading, error, onClose }) {
  if (loading && !profile) {
    return (
      <div className="p-6 text-center text-sm text-muted">Загружаем профиль…</div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-center text-sm text-red-300">{error}</div>
    );
  }
  if (!profile) return null;

  const displayName = profile.nickname || profile.display_name || "Unknown";
  const mentionName = profile.nickname || profile.display_name || "unknown";
  const avatarUrl = resolveAssetUrl(profile.avatar_url || "");
  const bannerUrl = resolveAssetUrl(profile.banner_url || "");
  const bio = profile.bio?.trim?.() || "Игрок ещё не добавил описание.";
  const role = typeof profile.role === "string" ? profile.role.trim() : "";
  const skills = Array.isArray(profile.skills) ? profile.skills.slice(0, 6) : [];
  const technologies = Array.isArray(profile.technologies) ? profile.technologies.slice(0, 5) : [];

  return (
    <div className="overflow-hidden rounded-card border border-border bg-canvas shadow-card">
      {/* Banner */}
      <div className="relative h-16">
        {bannerUrl ? (
          <img src={bannerUrl} alt="banner" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/30 to-transparent" />

        {/* Avatar overlapping the banner */}
        <div className="absolute -bottom-7 left-4">
          <div className="h-14 w-14 overflow-hidden rounded-full border-[3px] border-canvas bg-elevated">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-foreground">
                {(displayName[0] || "?").toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-9">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted">@{mentionName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-2 rounded-btn px-2 py-1 text-muted/70 transition-colors hover:text-foreground"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Quick stats strip */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-btn border border-border bg-elevated/40 px-2 py-1.5">
            <p className="font-mono text-sm font-bold text-accent">{profile.pts ?? 0}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted">PTS</p>
          </div>
          <div className="rounded-btn border border-border bg-elevated/40 px-2 py-1.5">
            <p className="font-mono text-sm font-bold text-foreground capitalize">
              {(profile.level || "—").toString().replace("_", " ")}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-muted">уровень</p>
          </div>
          <div className="rounded-btn border border-border bg-elevated/40 px-2 py-1.5">
            <p className="font-mono text-sm font-bold text-accent">
              {profile.pvp_best_win_streak ?? profile.pvp_win_streak ?? 0}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-muted">серия</p>
          </div>
        </div>

        {/* Role badge */}
        {role ? (
          <div className="mt-3">
            <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              {role}
            </span>
          </div>
        ) : null}

        {/* Bio */}
        <p className="mt-3 rounded-btn border border-border/70 bg-elevated/40 px-3 py-2 text-xs leading-relaxed text-foreground/90">
          {bio}
        </p>

        {/* Skills / technologies chips */}
        {skills.length > 0 || technologies.length > 0 ? (
          <div className="mt-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">
              Стек
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span
                  key={`skill:${skill.id ?? skill.skill_name}`}
                  className="inline-flex items-center rounded-full border border-border bg-elevated/60 px-2 py-0.5 text-[11px] text-foreground"
                >
                  {skill.skill_name}
                  {skill.proficiency ? (
                    <span className="ml-1 text-muted">{skill.proficiency}/5</span>
                  ) : null}
                </span>
              ))}
              {skills.length === 0
                ? technologies.map((tech) => (
                    <span
                      key={`tech:${tech}`}
                      className="inline-flex rounded-full border border-border bg-elevated/60 px-2 py-0.5 text-[11px] text-foreground"
                    >
                      {tech}
                    </span>
                  ))
                : null}
            </div>
          </div>
        ) : null}

        {/* Footer action */}
        <div className="mt-4">
          <a
            href={`/users/${profile.id ?? ""}`}
            onClick={(e) => {
              e.preventDefault();
              window.location.assign(`/users/${profile.id}`);
            }}
            className="block"
          >
            <Button variant="secondary" className="h-9 w-full text-xs">
              Перейти в профиль →
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

function PortalPopover({ anchorRect, onDismiss, children }) {
  const popoverRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

  useEffect(() => {
    function place() {
      const el = popoverRef.current;
      if (!el || !anchorRect) return;
      const width = el.offsetWidth || 300;
      const height = el.offsetHeight || 380;
      const gap = 12;

      let left = anchorRect.right + gap;
      let top = anchorRect.top + anchorRect.height / 2 - height / 2;

      // Flip left if we'd run off the right edge.
      if (left + width > window.innerWidth - 16) {
        left = anchorRect.left - width - gap;
      }
      // If we'd run off the left side too, center over the anchor.
      if (left < 16) {
        left = Math.max(16, Math.min(window.innerWidth - width - 16, anchorRect.left));
        top = anchorRect.bottom + gap;
      }
      // Clamp vertically.
      top = Math.max(12, Math.min(top, window.innerHeight - height - 12));
      setPos({ top, left, ready: true });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRect]);

  // Dismiss on outside click / Escape.
  useEffect(() => {
    function onPointerDown(e) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target)) onDismiss();
    }
    function onKey(e) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: 300,
        zIndex: 250,
        opacity: pos.ready ? 1 : 0,
        transition: "opacity 0.12s ease-out",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export function PlayerHoverCard({ userId, disabled, children }) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef(null);

  const safeId = userId != null ? String(userId) : null;

  function handleTriggerClick(e) {
    if (disabled || !safeId) return;
    // Find the actual click target so we anchor next to the avatar / nickname,
    // not the whole table row.
    const anchor = e.currentTarget;
    triggerRef.current = anchor;
    const rect = anchor.getBoundingClientRect();
    setAnchorRect(rect);
    setOpen(true);
  }

  useEffect(() => {
    if (!open || !safeId) return;
    // If we already have it cached, sync state synchronously.
    if (profileCache.has(safeId)) {
      setProfile(profileCache.get(safeId));
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    let cancelled = false;
    loadProfile(safeId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Не удалось загрузить профиль");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, safeId]);

  const child = useMemo(() => {
    if (!children) return null;
    const onlyChild = Array.isArray(children) ? children[0] : children;
    if (typeof onlyChild === "string" || !onlyChild?.type) {
      return (
        <span
          onClick={handleTriggerClick}
          role={disabled ? undefined : "button"}
          className={disabled ? "" : "cursor-pointer"}
        >
          {children}
        </span>
      );
    }
    return onlyChild;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, disabled]);

  if (disabled || !safeId) return <>{children}</>;

  return (
    <>
      {/* Wrap the child so we can intercept clicks without changing its
          markup. We use display:contents to stay layout-neutral. */}
      <span
        onClick={handleTriggerClick}
        style={{ display: "contents", cursor: "pointer" }}
      >
        {child}
      </span>

      {open && anchorRect ? (
        <PortalPopover anchorRect={anchorRect} onDismiss={() => setOpen(false)}>
          <MiniProfileCard
            profile={profile}
            loading={loading}
            error={error}
            onClose={() => setOpen(false)}
          />
        </PortalPopover>
      ) : null}
    </>
  );
}

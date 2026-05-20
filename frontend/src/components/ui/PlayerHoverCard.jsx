import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { apiFetch, resolveAssetUrl } from "../../api/client.js";
import { Button } from "./Button.jsx";
import { MediaAsset } from "./MediaAsset.jsx";

/**
 * Discord-style mini-profile that pops up next to whatever the user just
 * hovered or clicked.
 *
 * Wrap any bit of player UI (a row, an avatar, a nickname) with
 * <PlayerHoverCard userId={...}>...</PlayerHoverCard>.
 *
 *   - Hover (mouseenter) opens the card with a short delay.
 *   - Mouseleave closes it after a small grace window so the user can
 *     glide onto the popover itself without it vanishing.
 *   - Click pins the card open — it stays until outside-click / Escape.
 *   - `onCompare` (optional) renders a "Сравнить" button inside the card.
 *
 * Behaviour notes for callers:
 *   - The wrapper is `display: contents`, so it doesn't add a wrapping
 *     box to your layout.
 *   - Pass `disabled` (e.g. when this is the player themself) to skip
 *     the hover behaviour entirely. The children still render.
 *   - Multiple PlayerHoverCard instances on the same page share an
 *     in-memory profile cache.
 */

const HOVER_OPEN_DELAY = 220;   // ms before the card pops up on hover
const HOVER_CLOSE_DELAY = 160;  // ms grace window when leaving the trigger

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

function MiniProfileCard({ profile, loading, error, onClose, onCompare, compareDisabled }) {
  const navigate = useNavigate();
  // Image errors are surfaced via `onError` so a broken Cloudinary asset
  // doesn't show its alt text on top of the banner gradient. Hooks live
  // here because the early returns below would otherwise violate rules.
  const [bannerBroken, setBannerBroken] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [friendStatus, setFriendStatus] = useState(null);
  const [friendBusy, setFriendBusy] = useState(false);

  useEffect(() => {
    setBannerBroken(false);
    setAvatarBroken(false);
    setFriendStatus(null);
    if (!profile?.id) return;
    apiFetch(`/social/friendship/${profile.id}`)
      .then((data) => setFriendStatus(data))
      .catch(() => setFriendStatus(null));
  }, [profile?.id]);

  async function handleAddFriend() {
    if (!profile?.id || friendBusy) return;
    setFriendBusy(true);
    try {
      await apiFetch("/social/friends/requests", { method: "POST", body: { user_id: profile.id } });
      const next = await apiFetch(`/social/friendship/${profile.id}`);
      setFriendStatus(next);
    } catch (e) {
      // swallow — keep card open
    } finally {
      setFriendBusy(false);
    }
  }

  async function handleAcceptRequest() {
    if (!friendStatus?.friendship_id || friendBusy) return;
    setFriendBusy(true);
    try {
      await apiFetch(`/social/friends/requests/${friendStatus.friendship_id}/accept`, { method: "POST" });
      const next = await apiFetch(`/social/friendship/${profile.id}`);
      setFriendStatus(next);
    } catch (e) {
      // swallow
    } finally {
      setFriendBusy(false);
    }
  }

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
  const showBanner = bannerUrl && !bannerBroken;
  const showAvatar = avatarUrl && !avatarBroken;

  return (
    <div className="overflow-hidden rounded-card border border-border bg-canvas shadow-card">
      {/* Banner. MediaAsset handles both still images and short videos —
          some users upload looping mp4 banners. */}
      <div className="relative h-16">
        {showBanner ? (
          <MediaAsset
            src={bannerUrl}
            alt={`Баннер ${displayName}`}
            className="h-full w-full object-cover"
            onError={() => setBannerBroken(true)}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/30 to-transparent" />

        {/* Avatar overlapping the banner */}
        <div className="absolute -bottom-7 left-4">
          <div className="h-14 w-14 overflow-hidden rounded-full border-[3px] border-canvas bg-elevated">
            {showAvatar ? (
              <MediaAsset
                src={avatarUrl}
                alt={`Аватар ${displayName}`}
                className="h-full w-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
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

        {/* Footer actions */}
        <div className="mt-4 space-y-2">
          {friendStatus && friendStatus.status !== "self" ? (
            friendStatus.status === "friend" ? (
              <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-btn border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400">
                ✓ В друзьях
              </div>
            ) : friendStatus.status === "pending_outgoing" ? (
              <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-btn border border-border bg-elevated px-3 py-2 text-xs font-semibold text-muted">
                Заявка отправлена
              </div>
            ) : friendStatus.status === "pending_incoming" ? (
              <Button
                variant="primary"
                className="h-9 w-full text-xs"
                onClick={handleAcceptRequest}
                disabled={friendBusy}
              >
                {friendBusy ? "..." : "✓ Принять заявку"}
              </Button>
            ) : (
              <Button
                variant="primary"
                className="h-9 w-full text-xs"
                onClick={handleAddFriend}
                disabled={friendBusy}
              >
                {friendBusy ? "..." : "+ В друзья"}
              </Button>
            )
          ) : null}
          {onCompare ? (
            <Button
              variant="secondary"
              className="h-9 w-full text-xs"
              onClick={() => {
                if (!profile?.id || compareDisabled) return;
                onCompare(profile.id);
                onClose?.();
              }}
              disabled={compareDisabled}
              title={compareDisabled ? "Это вы — сравнение не требуется" : "Сравнить этого игрока"}
            >
              ⇄ Сравнить
            </Button>
          ) : null}
          <Button
            variant={onCompare ? "ghost" : "secondary"}
            className="h-9 w-full text-xs"
            onClick={() => {
              if (!profile?.id) return;
              onClose?.();
              navigate(`/users/${profile.id}`);
            }}
          >
            Перейти в профиль →
          </Button>
        </div>
      </div>
    </div>
  );
}

function PortalPopover({ anchorRect, onDismiss, onMouseEnter, onMouseLeave, pinned, children }) {
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

  // Outside click / Escape only apply when the card is pinned (click-opened).
  // Hover-only cards close via mouseleave, not outside click, so they don't
  // dismiss the moment the cursor wanders elsewhere on screen.
  useEffect(() => {
    if (!pinned) return undefined;
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
  }, [onDismiss, pinned]);

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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

export function PlayerHoverCard({ userId, disabled, children, onCompare, compareDisabled }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Open/close timers. We delay both so quick passes don't flicker the
  // popover, and so the user can travel from the trigger onto the
  // popover without it disappearing under their cursor.
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  const safeId = userId != null ? String(userId) : null;

  function clearTimers() {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }

  function scheduleOpen(rect) {
    clearTimers();
    openTimer.current = setTimeout(() => {
      setAnchorRect(rect);
      setOpen(true);
    }, HOVER_OPEN_DELAY);
  }

  function scheduleClose() {
    if (pinned) return;
    clearTimers();
    closeTimer.current = setTimeout(() => {
      setOpen(false);
    }, HOVER_CLOSE_DELAY);
  }

  function handleEnter(e) {
    if (disabled || !safeId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (open) {
      // Already open — just refresh the anchor & cancel any pending close.
      clearTimers();
      setAnchorRect(rect);
    } else {
      scheduleOpen(rect);
    }
  }

  function handleLeave() {
    if (disabled || !safeId) return;
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    scheduleClose();
  }

  function handleClick(e) {
    if (disabled || !safeId) return;
    clearTimers();
    const rect = e.currentTarget.getBoundingClientRect();
    setAnchorRect(rect);
    // Click toggles the pinned state so the card stays open / closes again.
    if (pinned) {
      setPinned(false);
      setOpen(false);
    } else {
      setPinned(true);
      setOpen(true);
    }
  }

  function dismiss() {
    clearTimers();
    setOpen(false);
    setPinned(false);
  }

  useEffect(() => () => clearTimers(), []);

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
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Не удалось загрузить профиль");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, safeId]);

  if (disabled || !safeId) return <>{children}</>;

  return (
    <>
      {/* Wrap the child so we can intercept hover/click without changing
          its markup. display:contents keeps us layout-neutral. */}
      <span
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleClick}
        style={{ display: "contents", cursor: "pointer" }}
      >
        {children}
      </span>

      {open && anchorRect ? (
        <PortalPopover
          anchorRect={anchorRect}
          onDismiss={dismiss}
          pinned={pinned}
          onMouseEnter={() => { clearTimers(); }}
          onMouseLeave={() => { scheduleClose(); }}
        >
          <MiniProfileCard
            profile={profile}
            loading={loading}
            error={error}
            onClose={dismiss}
            onCompare={onCompare}
            compareDisabled={compareDisabled}
          />
        </PortalPopover>
      ) : null}
    </>
  );
}

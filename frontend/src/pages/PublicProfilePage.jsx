import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

function StatBox({ label, value, accent = false }) {
  return (
    <div className={[
      "rounded-2xl border bg-canvas px-4 py-3 text-center",
      accent ? "border-accent/40 bg-accent/5" : "border-border",
    ].join(" ")}>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={[
        "mt-1 font-mono text-xl font-bold",
        accent ? "text-accent" : "text-foreground",
      ].join(" ")}>
        {value}
      </p>
    </div>
  );
}

export function PublicProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerBroken, setBannerBroken] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const [friendStatus, setFriendStatus] = useState(null);
  const [friendBusy, setFriendBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setBannerBroken(false);
    setAvatarBroken(false);

    (async () => {
      try {
        const p = await apiFetch(`/users/${userId}/profile`);
        if (!mounted) return;
        setProfile(p);
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить профиль");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    if (me?.id && Number(userId) !== Number(me.id)) {
      apiFetch(`/social/friendship/${userId}`)
        .then((data) => { if (mounted) setFriendStatus(data); })
        .catch(() => { if (mounted) setFriendStatus(null); });
    }

    return () => { mounted = false; };
  }, [userId, me?.id]);

  if (me?.id && Number(userId) === Number(me.id)) {
    return <Navigate to="/profile" replace />;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Card className="p-6 text-sm text-muted">Загрузка профиля...</Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Card className="p-6 text-sm text-red-400">{error || "Профиль не найден"}</Card>
      </div>
    );
  }

  const bannerUrl = resolveAssetUrl(profile.banner_url || "");
  const avatarUrl = resolveAssetUrl(profile.avatar_url || "");
  const showBanner = bannerUrl && !bannerBroken;
  const showAvatar = avatarUrl && !avatarBroken;
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const technologies = Array.isArray(profile.technologies) ? profile.technologies : [];
  const role = typeof profile.role === "string" ? profile.role.trim() : "";

  async function refreshStatus() {
    try {
      const next = await apiFetch(`/social/friendship/${profile.id}`);
      setFriendStatus(next);
    } catch {
      // ignore
    }
  }

  async function handleAdd() {
    if (friendBusy) return;
    setFriendBusy(true);
    try {
      await apiFetch("/social/friends/requests", { method: "POST", body: { user_id: profile.id } });
      await refreshStatus();
    } catch (e) {
      setError(e?.message || "Не удалось отправить заявку");
    } finally {
      setFriendBusy(false);
    }
  }

  async function handleAccept() {
    if (!friendStatus?.friendship_id || friendBusy) return;
    setFriendBusy(true);
    try {
      await apiFetch(`/social/friends/requests/${friendStatus.friendship_id}/accept`, { method: "POST" });
      await refreshStatus();
    } catch (e) {
      setError(e?.message || "Не удалось");
    } finally {
      setFriendBusy(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm("Удалить из друзей?")) return;
    setFriendBusy(true);
    try {
      await apiFetch(`/social/friends/${profile.id}`, { method: "DELETE" });
      await refreshStatus();
    } catch (e) {
      setError(e?.message || "Не удалось");
    } finally {
      setFriendBusy(false);
    }
  }

  const status = friendStatus?.status;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xs text-muted hover:text-accent"
        >
          ← Назад
        </button>
      </div>

      {/* HERO */}
      <Card className="overflow-hidden p-0">
        <div className="relative h-40 sm:h-52">
          {showBanner ? (
            <MediaAsset
              src={bannerUrl}
              alt="Banner"
              className="h-full w-full object-cover"
              onError={() => setBannerBroken(true)}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 50%, rgba(255,215,0,0.12), transparent 60%), linear-gradient(135deg, #161B22, #0D1117)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas/95 via-canvas/30 to-transparent" />
        </div>

        <div className="relative px-5 pb-5 sm:px-7">
          <div className="-mt-12 flex flex-col items-start gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-canvas bg-elevated shadow-xl sm:h-28 sm:w-28">
                {showAvatar ? (
                  <MediaAsset
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-foreground">
                    {(profile.nickname || profile.display_name || "?")[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="mb-2">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                  {profile.nickname || profile.display_name}
                </h1>
                <p className="text-sm text-muted">@{profile.nickname || profile.display_name}</p>
                {role ? (
                  <span className="mt-2 inline-flex rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {role}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Action buttons */}
            {me?.id && Number(userId) !== Number(me.id) ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {status === "friend" ? (
                  <>
                    <LinkButton to={`/social/messages/${profile.id}`} variant="primary" className="h-10 px-4 text-sm">
                      💬 Написать
                    </LinkButton>
                    <Button
                      variant="secondary"
                      className="h-10 px-4 text-sm"
                      onClick={handleRemove}
                      disabled={friendBusy}
                    >
                      Удалить из друзей
                    </Button>
                  </>
                ) : status === "pending_outgoing" ? (
                  <Button variant="secondary" className="h-10 px-4 text-sm" disabled>
                    Заявка отправлена
                  </Button>
                ) : status === "pending_incoming" ? (
                  <Button
                    variant="primary"
                    className="h-10 px-4 text-sm"
                    onClick={handleAccept}
                    disabled={friendBusy}
                  >
                    ✓ Принять заявку
                  </Button>
                ) : status ? (
                  <Button
                    variant="primary"
                    className="h-10 px-4 text-sm"
                    onClick={handleAdd}
                    disabled={friendBusy}
                  >
                    + В друзья
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="PTS" value={Number(profile.pts || 0).toLocaleString("ru-RU")} accent />
            <StatBox label="Уровень" value={profile.level?.replace("_", " ") || "—"} />
            <StatBox label="Текущая серия" value={profile.pvp_win_streak ?? 0} />
            <StatBox label="Лучшая серия" value={profile.pvp_best_win_streak ?? 0} />
          </div>

          {/* Bio */}
          {profile.bio ? (
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">О себе</p>
              <p className="mt-2 rounded-2xl border border-border bg-canvas/70 px-4 py-3 text-sm leading-relaxed text-foreground">
                {profile.bio}
              </p>
            </div>
          ) : null}

          {/* Skills */}
          {skills.length > 0 || technologies.length > 0 ? (
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Стек</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={`skill:${s.id ?? s.skill_name}`}
                    className="inline-flex items-center rounded-full border border-border bg-elevated px-2.5 py-1 text-xs text-foreground"
                  >
                    {s.skill_name}
                    {s.proficiency ? <span className="ml-1 text-muted">{s.proficiency}/5</span> : null}
                  </span>
                ))}
                {skills.length === 0
                  ? technologies.map((t) => (
                      <span
                        key={`tech:${t}`}
                        className="inline-flex rounded-full border border-border bg-elevated px-2.5 py-1 text-xs text-foreground"
                      >
                        {t}
                      </span>
                    ))
                  : null}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <Link to="/leaderboard" className="text-muted underline hover:text-accent">
              Посмотреть на лидерборде
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

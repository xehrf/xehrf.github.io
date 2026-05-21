import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { PlayerHoverCard } from "../components/ui/PlayerHoverCard.jsx";
import { apiFetch, getWebSocketBaseUrl, resolveAssetUrl } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

/**
 * TeamPage — Compyra redesign (чёрно-жёлтый).
 *
 * Вся существующая логика сохранена 1:1 (WS, ready votes, invites,
 * captain actions, avatar/banner upload, leave/kick). Изменена только
 * визуальная оболочка:
 *   • Hero с лого-плиткой, live-индикатором, pill-статами справа
 *   • Жёлтая полоса активной задачи команды
 *   • Левая колонка: готовность + участники + Leave
 *   • Правая колонка: табы (Чат / Статистика / История / Инвайты / Настройки)
 *   • Стилистика — terminal/mono labels, gold halos, scanlines
 */

function getWebSocketUrl(teamId) {
  const wsOrigin = getWebSocketBaseUrl();
  const token = localStorage.getItem("access_token") ?? "";
  return `${wsOrigin}/teams/ws/${teamId}?token=${encodeURIComponent(token)}`;
}

const MonoLabel = ({ children, accent = false, size = 10 }) => (
  <span
    className={[
      "font-mono font-semibold uppercase",
      accent ? "text-accent" : "text-muted",
    ].join(" ")}
    style={{ fontSize: size, letterSpacing: "0.22em" }}
  >
    {children}
  </span>
);

const LivePulse = ({ size = 8 }) => (
  <span className="relative inline-flex" style={{ width: size, height: size }}>
    <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-70" />
    <span className="absolute inset-0 rounded-full bg-accent" />
  </span>
);

const Scanlines = () => (
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.04]"
    style={{
      backgroundImage:
        "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,215,0,0.4) 2px 3px)",
    }}
  />
);

export function TeamPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [teamHistory, setTeamHistory] = useState([]);
  const [myInvites, setMyInvites] = useState([]);
  const [inviteeId, setInviteeId] = useState("");
  const [readyVotes, setReadyVotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [wsStatus, setWsStatus] = useState("connecting");
  const [activeTab, setActiveTab] = useState("chat");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [teamBannerBroken, setTeamBannerBroken] = useState(false);
  const [teamAvatarBroken, setTeamAvatarBroken] = useState(false);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const websocketRef = useRef(null);
  const chatEndRef = useRef(null);

  /* ─── load ─────────────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const current = await apiFetch("/teams/current");
        if (!mounted) return;
        if (current == null) { navigate("/matchmaking"); return; }
        setTeam(current);
        setReadyVotes(current.ready_votes ?? {});
        const [stats, history, invites] = await Promise.all([
          apiFetch(`/teams/${current.team_id}/stats`),
          apiFetch(`/teams/${current.team_id}/matches`),
          apiFetch("/teams/invites"),
        ]);
        if (!mounted) return;
        setTeamStats(stats);
        setTeamHistory(history ?? []);
        setMyInvites(invites ?? []);
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить команду");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  /* ─── ws ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!team) return;
    const ws = new WebSocket(getWebSocketUrl(team.team_id));
    websocketRef.current = ws;
    ws.addEventListener("open", () => setWsStatus("connected"));
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const { event: eventName, data } = payload;
      if (eventName === "chat_message") setMessages((p) => [...p, data]);
      if (eventName === "team_formed") setMessages((p) => [...p, { system: true, message: data.message || "Команда собрана." }]);
      if (eventName === "user_joined_team") setMessages((p) => [...p, { system: true, message: `${data.nickname || data.display_name} присоединился.` }]);
      if (eventName === "user_left") setMessages((p) => [...p, { system: true, message: `${data.nickname || data.display_name} вышел.` }]);
      if (eventName === "team_ready_update") setReadyVotes(data.votes ?? {});
      if (eventName === "invitation_accepted") setMessages((p) => [...p, { system: true, message: `Пользователь #${data.user_id} принял приглашение.` }]);
      if (eventName === "task_completed") {
        setTeam((prev) => (!prev?.task || prev.task.task_id !== data.task_id ? prev : { ...prev, task: null }));
        setMessages((p) => [...p, { system: true, message: `Задача #${data.task_id} решена командой.` }]);
      }
    });
    ws.addEventListener("close", () => setWsStatus("disconnected"));
    ws.addEventListener("error", () => setWsStatus("disconnected"));
    return () => { ws.close(); websocketRef.current = null; };
  }, [team]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* ─── actions ──────────────────────────────────────────────── */
  const currentUserId = user?.id ?? 0;
  const isCaptain = currentUserId !== 0 && team?.captain_user_id === currentUserId;
  const myReady = Boolean(readyVotes[currentUserId]);
  const readyCount = Object.values(readyVotes).filter(Boolean).length;
  const totalMembers = team?.members?.length ?? 0;

  function handleSendMessage(e) {
    e.preventDefault();
    if (!chatText.trim() || websocketRef.current?.readyState !== WebSocket.OPEN) return;
    websocketRef.current.send(JSON.stringify({ event: "chat_message", message: chatText.trim() }));
    setChatText("");
  }
  async function handleReadyToggle() {
    if (!team) return;
    try {
      const res = await apiFetch(`/teams/${team.team_id}/ready`, { method: "POST", body: { is_ready: !myReady } });
      setReadyVotes(res.votes ?? {});
    } catch (e) { setError(e?.message || "Ошибка"); }
  }
  async function handleInviteUser(e) {
    e.preventDefault();
    if (!team || !inviteeId.trim()) return;
    try {
      await apiFetch(`/teams/${team.team_id}/invite`, { method: "POST", body: { invitee_user_id: Number(inviteeId) } });
      setInviteeId("");
    } catch (e) { setError(e?.message || "Не удалось отправить приглашение"); }
  }
  async function handleInviteAction(invitationId, action) {
    try {
      await apiFetch(`/teams/invites/${invitationId}/${action}`, { method: "POST" });
      setMyInvites((p) => p.filter((i) => i.invitation_id !== invitationId));
      if (action === "accept") {
        const current = await apiFetch("/teams/current");
        setTeam(current);
      }
    } catch (e) { setError(e?.message || "Ошибка"); }
  }
  async function handleLeaveTeam() {
    if (!team) return;
    try {
      await apiFetch(`/teams/${team.team_id}/leave`, { method: "POST" });
      navigate("/matchmaking");
    } catch (e) { setError(e?.message || "Не удалось выйти"); }
  }
  async function handleKickMember(memberUserId) {
    if (!team) return;
    try {
      await apiFetch(`/teams/${team.team_id}/kick/${memberUserId}`, { method: "POST" });
      setTeam((p) => ({ ...p, members: p.members.filter((m) => m.user_id !== memberUserId) }));
    } catch (e) { setError(e?.message || "Не удалось исключить"); }
  }
  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file));
  }
  function handleBannerChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file); setBannerPreview(URL.createObjectURL(file));
  }
  async function handleSettingsSave() {
    if (!team) return;
    setSettingsLoading(true); setSettingsError(""); setSettingsSuccess("");
    try {
      if (avatarFile) {
        const fd = new FormData(); fd.append("file", avatarFile);
        await apiFetch(`/teams/${team.team_id}/avatar`, { method: "POST", body: fd });
      }
      if (bannerFile) {
        const fd = new FormData(); fd.append("file", bannerFile);
        await apiFetch(`/teams/${team.team_id}/banner`, { method: "POST", body: fd });
      }
      const updated = await apiFetch("/teams/current");
      setTeam(updated); setAvatarFile(null); setBannerFile(null);
      setSettingsSuccess("Изменения сохранены");
      setTimeout(() => setSettingsSuccess(""), 3000);
    } catch (e) {
      setSettingsError(e?.message || "Не удалось сохранить");
    } finally { setSettingsLoading(false); }
  }

  /* ─── render ───────────────────────────────────────────────── */
  if (loading || authLoading) {
    return (
      <Shell>
        <div className="mt-8 h-48 animate-pulse rounded-2xl border border-border bg-elevated" />
      </Shell>
    );
  }
  if (error && !team) {
    return (
      <Shell>
        <div className="mt-8 rounded-card border border-accent/40 bg-canvas px-5 py-4 font-mono text-sm text-accent">{error}</div>
      </Shell>
    );
  }
  if (!team) return null;

  const onlineCount = (team.members || []).filter((m) => m.online).length;
  const avatarUrl = resolveAssetUrl(team.avatar_url || "");

  const tabs = [
    { id: "chat", label: "Чат" },
    { id: "stats", label: "Статистика" },
    { id: "history", label: "История" },
    { id: "invites", label: `Инвайты${myInvites.length ? ` (${myInvites.length})` : ""}` },
    ...(isCaptain ? [{ id: "settings", label: "Настройки" }] : []),
  ];

  return (
    <Shell>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-elevated shadow-card">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[460px] w-[460px] rounded-full bg-accent/[0.18] blur-3xl" />
        <Scanlines />

        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start">
          {/* avatar tile */}
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-accent bg-canvas shadow-glow"
            style={{ boxShadow: "0 0 0 1px rgba(255,215,0,0.35), 0 0 40px rgba(255,215,0,0.25)" }}>
            {avatarUrl && !teamAvatarBroken ? (
              <MediaAsset src={avatarUrl} alt={team.name} className="h-full w-full object-cover" onError={() => setTeamAvatarBroken(true)} />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-sans text-4xl font-extrabold tracking-tight text-accent">
                {team.name?.[0]?.toUpperCase() ?? "T"}
              </div>
            )}
          </div>

          {/* title + status */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <LivePulse />
              <MonoLabel accent>КОМАНДНАЯ КОМНАТА · {wsStatus === "connected" ? "LIVE" : wsStatus === "connecting" ? "ПОДКЛЮЧЕНИЕ" : "OFFLINE"}</MonoLabel>
              <span className="text-border">·</span>
              <MonoLabel>{onlineCount} В СЕТИ</MonoLabel>
            </div>
            <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              {team.name}
            </h1>
            <div className="mt-1.5 font-mono text-[13px] tracking-[0.04em] text-muted">
              ~/{(team.name || "").toLowerCase().replace(/\s+/g, "-")}
            </div>
            {team.description ? (
              <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-muted">{team.description}</p>
            ) : null}
          </div>

          {/* pill stats */}
          <div className="flex gap-2.5">
            <PillStat label="РЕЙТИНГ" value={teamStats?.rating ?? team.rating ?? "—"} accent />
            <PillStat label="МАТЧИ"   value={teamStats?.total_matches ?? "—"} />
            <PillStat label="WIN" value={teamStats ? `${Math.round((teamStats.win_rate ?? 0) * 100)}%` : "—"} accent />
          </div>
        </div>
      </div>

      {/* ── Task callout ── */}
      {team.task ? (
        <div className="mt-4 relative overflow-hidden rounded-card border border-accent bg-accent/[0.06] p-5 shadow-glow"
          style={{ boxShadow: "0 0 0 1px rgba(255,215,0,0.2), 0 0 36px rgba(255,215,0,0.12)" }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-accent/50 bg-canvas/60">
                <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
                  <path d="M 8 4 L 8 28" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 8 6 L 24 6 L 20 12 L 24 18 L 8 18 Z" stroke="#FFD700" strokeWidth="2.5" fill="rgba(255,215,0,0.15)" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <MonoLabel accent>АКТИВНАЯ ЗАДАЧА КОМАНДЫ</MonoLabel>
                <div className="mt-1 text-lg font-bold tracking-tight text-foreground">
                  Задача #{team.task.task_id}{team.task.status ? ` · ${team.task.status}` : ""}
                </div>
              </div>
            </div>
            <Link to={`/tasks/${team.task.task_id}/solve?team=1`} className="inline-flex items-center gap-2 rounded-btn bg-accent px-5 py-3 font-sans text-sm font-bold text-black shadow-glow transition-transform hover:scale-[1.01]">
              Решать <span className="font-mono opacity-70">→</span>
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Main grid ── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Left column */}
        <div className="flex flex-col gap-3.5">
          {/* Ready */}
          <div className="rounded-card border border-border bg-elevated p-5">
            <div className="flex items-center justify-between">
              <MonoLabel accent>ГОТОВНОСТЬ</MonoLabel>
              <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                {readyCount}<span className="text-muted">/{totalMembers}</span>
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,215,0,0.08)" }}>
              <div className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{
                  width: totalMembers ? `${(readyCount / totalMembers) * 100}%` : "0%",
                  boxShadow: "0 0 12px rgba(255,215,0,0.5)",
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleReadyToggle}
              className={[
                "mt-3.5 w-full rounded-btn py-2.5 font-sans text-sm font-bold tracking-tight transition-colors",
                myReady
                  ? "border border-accent text-accent hover:bg-accent/10"
                  : "bg-accent text-black shadow-glow hover:scale-[1.005]",
              ].join(" ")}
            >
              {myReady ? "✓ Я готов — отменить" : "Я готов"}
            </button>
          </div>

          {/* Members */}
          <div className="rounded-card border border-border bg-elevated p-5">
            <div className="mb-3 flex items-center justify-between">
              <MonoLabel accent>УЧАСТНИКИ · {totalMembers}</MonoLabel>
            </div>
            <div className="flex flex-col gap-2">
              {team.members.map((m) => (
                <MemberRow
                  key={m.user_id}
                  m={m}
                  isCap={m.user_id === team.captain_user_id}
                  isSelf={m.user_id === currentUserId}
                  canKick={isCaptain && m.user_id !== currentUserId}
                  ready={Boolean(readyVotes[m.user_id])}
                  onKick={() => handleKickMember(m.user_id)}
                />
              ))}
            </div>
          </div>

          {/* Invite (captain only) */}
          {isCaptain ? (
            <div className="rounded-card border border-border bg-elevated p-5">
              <MonoLabel accent>ПРИГЛАСИТЬ ИГРОКА</MonoLabel>
              <form onSubmit={handleInviteUser} className="mt-3 flex gap-2">
                <input
                  value={inviteeId}
                  onChange={(e) => setInviteeId(e.target.value)}
                  placeholder="user_id"
                  className="w-full rounded-btn border border-border bg-canvas px-3 py-2.5 font-mono text-sm text-foreground outline-none transition focus:border-accent"
                />
                <button type="submit" className="rounded-btn bg-accent px-4 py-2 font-sans text-sm font-bold text-black hover:scale-[1.01]">
                  →
                </button>
              </form>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLeaveTeam}
            className="rounded-card border border-border bg-elevated px-4 py-3 font-sans text-sm text-muted transition-colors hover:border-accent/40 hover:text-foreground"
          >
            Выйти из команды
          </button>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3.5">
          {/* Tabs */}
          <div className="flex gap-1 rounded-btn border border-border bg-elevated p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={[
                  "flex-1 rounded-[6px] px-3 py-2.5 font-sans text-[13px] font-bold tracking-tight transition-colors",
                  activeTab === t.id ? "bg-accent text-black" : "text-muted hover:text-foreground",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Chat */}
          {activeTab === "chat" && (
            <ChatPanel
              messages={messages}
              chatEndRef={chatEndRef}
              currentUserId={currentUserId}
              chatText={chatText}
              setChatText={setChatText}
              wsStatus={wsStatus}
              onSubmit={handleSendMessage}
            />
          )}

          {/* Stats */}
          {activeTab === "stats" && <StatsPanel teamStats={teamStats} />}

          {/* History */}
          {activeTab === "history" && <HistoryPanel rows={teamHistory} />}

          {/* Invites */}
          {activeTab === "invites" && (
            <InvitesPanel invites={myInvites} onAction={handleInviteAction} />
          )}

          {/* Settings — captain only */}
          {activeTab === "settings" && isCaptain && (
            <SettingsPanel
              team={team}
              avatarPreview={avatarPreview}
              bannerPreview={bannerPreview}
              avatarFile={avatarFile}
              bannerFile={bannerFile}
              teamAvatarBroken={teamAvatarBroken}
              teamBannerBroken={teamBannerBroken}
              avatarInputRef={avatarInputRef}
              bannerInputRef={bannerInputRef}
              onAvatarChange={handleAvatarChange}
              onBannerChange={handleBannerChange}
              onSave={handleSettingsSave}
              loading={settingsLoading}
              error={settingsError}
              success={settingsSuccess}
            />
          )}
        </div>
      </div>

      {error && team ? (
        <div className="mt-4 rounded-card border border-accent/40 bg-canvas px-4 py-3 font-mono text-sm text-accent">{error}</div>
      ) : null}
    </Shell>
  );
}

/* ─── building blocks ──────────────────────────────────────────────── */

function Shell({ children }) {
  return (
    <div className="relative min-h-screen bg-canvas text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[15%] top-20 h-[480px] w-[480px] rounded-full bg-accent/[0.06] blur-3xl" />
        <div className="absolute bottom-[10%] right-[10%] h-[360px] w-[360px] rounded-full bg-accent/[0.05] blur-3xl" />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}

function PillStat({ label, value, accent = false }) {
  return (
    <div className="min-w-[96px] rounded-xl border border-border bg-canvas/60 px-3.5 py-3 text-center">
      <MonoLabel size={9}>{label}</MonoLabel>
      <div
        className={[
          "mt-1.5 font-mono text-2xl font-bold leading-none tabular-nums",
          accent ? "text-accent" : "text-foreground",
        ].join(" ")}
      >{value}</div>
    </div>
  );
}

function MemberRow({ m, isCap, isSelf, canKick, ready, onKick }) {
  const [hover, setHover] = useState(false);
  const avatarUrl = resolveAssetUrl(m.avatar_url || "");
  const [broken, setBroken] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={[
        "flex items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors",
        hover ? "border-accent/40 bg-accent/[0.04]" : "border-border bg-canvas/50",
      ].join(" ")}
    >
      <PlayerHoverCard userId={m.user_id} disabled={isSelf}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* avatar + online dot */}
          <div className="relative flex-shrink-0">
            <div className={[
              "h-9 w-9 overflow-hidden rounded-[8px] border bg-elevated",
              isCap ? "border-accent" : "border-border",
            ].join(" ")}>
              {avatarUrl && !broken ? (
                <MediaAsset src={avatarUrl} alt={m.nickname} className="h-full w-full object-cover" onError={() => setBroken(true)} />
              ) : (
                <div className={["flex h-full w-full items-center justify-center font-sans text-sm font-bold tracking-tight",
                  isCap ? "text-accent" : "text-foreground",
                ].join(" ")}>
                  {m.nickname?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <span
              className={[
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full",
                m.online ? "bg-accent" : "bg-border",
              ].join(" ")}
              style={{ boxShadow: "0 0 0 2px var(--color-elevated, #161B22)" }}
            />
          </div>

          {/* name */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-mono text-sm font-semibold text-foreground">{m.nickname}</span>
              {isCap && <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-accent">★ КЭП</span>}
            </div>
            <div className="truncate text-[11px] text-muted">{m.role || "Участник"}</div>
          </div>
        </div>
      </PlayerHoverCard>

      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span
          className={[
            "rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em]",
            ready ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted",
          ].join(" ")}
        >
          {ready ? "ГОТОВ" : "ЖДЁМ"}
        </span>
        {canKick && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onKick(); }}
            className="rounded-[6px] border border-border px-2 py-0.5 font-mono text-[10px] text-muted hover:border-accent/40 hover:text-accent"
          >
            kick
          </button>
        )}
      </div>
    </div>
  );
}

/* Chat */
function ChatPanel({ messages, chatEndRef, currentUserId, chatText, setChatText, wsStatus, onSubmit }) {
  return (
    <div className="flex min-h-[500px] flex-col overflow-hidden rounded-card border border-border bg-elevated">
      <div className="flex items-center justify-between border-b border-border bg-canvas/50 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <LivePulse />
          <MonoLabel accent>#TEAM-CHAT</MonoLabel>
        </div>
        <MonoLabel size={9}>{wsStatus === "connected" ? "WS · CONNECTED" : wsStatus === "connecting" ? "WS · CONNECTING" : "WS · OFFLINE"}</MonoLabel>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto bg-canvas px-5 py-4">
        {messages.length === 0 ? (
          <p className="pt-8 text-center font-mono text-xs text-muted">&gt; начни общение с командой</p>
        ) : (
          messages.map((msg, i) => {
            if (msg.system) {
              return (
                <div key={i} className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border opacity-40" />
                  <span className="font-mono text-[11px] tracking-[0.06em] text-muted">{msg.message}</span>
                  <div className="h-px flex-1 bg-border opacity-40" />
                </div>
              );
            }
            const mine = msg.user_id === currentUserId;
            return (
              <div key={i} className={[
                "flex flex-col gap-1",
                mine ? "items-end" : "items-start",
              ].join(" ")}>
                <span className="font-mono text-[11px] tracking-[0.04em] text-muted">{msg.nickname || msg.display_name}</span>
                <div className={[
                  "max-w-[78%] px-3.5 py-2.5 font-sans text-sm leading-snug",
                  mine
                    ? "rounded-[14px] rounded-br-[4px] border border-accent bg-accent font-semibold text-black"
                    : "rounded-[14px] rounded-bl-[4px] border border-border bg-elevated text-foreground",
                ].join(" ")}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2.5 border-t border-border bg-canvas/50 p-3.5">
        <input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Напиши сообщение..."
          className="w-full rounded-btn border border-border bg-canvas px-3.5 py-2.5 font-sans text-sm text-foreground outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          disabled={!chatText.trim()}
          className="inline-flex items-center gap-1.5 rounded-btn bg-accent px-5 py-2.5 font-sans text-sm font-bold text-black transition-transform hover:scale-[1.01] disabled:opacity-40"
        >
          ↑ Send
        </button>
      </form>
    </div>
  );
}

/* Stats */
function StatsPanel({ teamStats }) {
  if (!teamStats) {
    return (
      <div className="rounded-card border border-border bg-elevated p-10 text-center font-sans text-sm text-muted">
        Пока нет статистики
      </div>
    );
  }
  const totalMatches = teamStats.total_matches ?? 0;
  const winPct  = totalMatches ? (teamStats.wins  / totalMatches) * 100 : 0;
  const lossPct = totalMatches ? (teamStats.losses / totalMatches) * 100 : 0;
  const drawPct = totalMatches ? (teamStats.draws  / totalMatches) * 100 : 0;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatBox k="РЕЙТИНГ" v={teamStats.rating} accent />
        <StatBox k="МАТЧИ" v={totalMatches} />
        <StatBox k="WIN RATE" v={`${Math.round((teamStats.win_rate ?? 0) * 100)}%`} accent />
        <StatBox k="ВСЕГО PTS" v={(teamStats.total_ptc ?? 0).toLocaleString("ru-RU")} />
      </div>
      <div className="rounded-card border border-border bg-elevated p-5">
        <MonoLabel accent>ПОБЕДЫ · ПОРАЖЕНИЯ · НИЧЬИ</MonoLabel>
        <div className="mt-4 flex overflow-hidden rounded-full" style={{ height: 14, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ width: `${winPct}%`,  background: "#FFD700" }} />
          <div style={{ width: `${lossPct}%`, background: "rgba(255,215,0,0.33)", marginLeft: 2 }} />
          <div style={{ width: `${drawPct}%`, background: "rgba(139,148,158,0.55)", marginLeft: 2 }} />
        </div>
        <div className="mt-3.5 flex flex-wrap gap-5 font-mono text-xs">
          <Legend dot="#FFD700" label="ПОБЕДЫ" value={teamStats.wins} accent />
          <Legend dot="rgba(255,215,0,0.4)" label="ПОРАЖЕНИЯ" value={teamStats.losses} />
          <Legend dot="rgba(139,148,158,0.55)" label="НИЧЬИ" value={teamStats.draws} />
        </div>
      </div>
    </div>
  );
}
function StatBox({ k, v, accent = false }) {
  return (
    <div className="rounded-card border border-border bg-elevated p-4">
      <MonoLabel size={9}>{k}</MonoLabel>
      <div className={["mt-2 font-mono text-3xl font-bold leading-none tabular-nums",
        accent ? "text-accent" : "text-foreground"].join(" ")}>{v}</div>
    </div>
  );
}
function Legend({ dot, label, value, accent = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
      <span className={["font-bold tabular-nums", accent ? "text-accent" : "text-foreground"].join(" ")}>{value}</span>
    </span>
  );
}

/* History */
function HistoryPanel({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="rounded-card border border-border bg-elevated p-10 text-center text-sm text-muted">История матчей пуста</div>;
  }
  return (
    <div className="overflow-hidden rounded-card border border-border bg-elevated">
      <div className="flex items-center justify-between border-b border-border bg-canvas/40 px-5 py-3.5">
        <MonoLabel accent>ПОСЛЕДНИЕ МАТЧИ</MonoLabel>
        <MonoLabel size={9}>{rows.length} ЗАПИСЕЙ</MonoLabel>
      </div>
      {rows.map((r, i) => {
        const won = r.result === "win";
        const drew = r.result === "draw";
        return (
          <div key={r.id} className={["grid items-center gap-4 px-5 py-3.5",
            i < rows.length - 1 ? "border-b border-border" : ""].join(" ")}
            style={{ gridTemplateColumns: "80px 1fr 130px 130px" }}>
            <span
              className={[
                "justify-self-start rounded-full border px-2.5 py-1 text-center font-mono text-[10px] font-extrabold tracking-[0.14em]",
                won ? "border-accent bg-accent/15 text-accent" : "border-border text-muted",
              ].join(" ")}
            >{won ? "WIN" : drew ? "DRAW" : "LOSS"}</span>
            <span className="font-mono text-sm text-foreground">Матч #{r.id}</span>
            <span className="font-mono text-xs text-muted">{new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
            <span
              className={[
                "text-right font-mono text-base font-bold tabular-nums",
                r.rating_delta > 0 ? "text-accent" : r.rating_delta < 0 ? "text-accent/70" : "text-muted",
              ].join(" ")}
            >
              {r.rating_delta > 0 ? "+" : ""}{r.rating_delta} PTS
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Invites */
function InvitesPanel({ invites, onAction }) {
  if (!invites || invites.length === 0) {
    return <div className="rounded-card border border-border bg-elevated p-10 text-center text-sm text-muted">Нет входящих приглашений</div>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {invites.map((inv) => (
        <div key={inv.invitation_id} className="flex items-center gap-4 rounded-card border border-border bg-elevated p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-border bg-canvas font-sans text-xl font-bold text-foreground">
            #{inv.team_id}
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-foreground">Команда #{inv.team_id}</div>
            <div className="mt-0.5 font-mono text-xs text-muted">от пользователя <span className="text-foreground">#{inv.inviter_user_id}</span></div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onAction(inv.invitation_id, "accept")}
              className="rounded-btn bg-accent px-4 py-2.5 font-sans text-sm font-bold text-black hover:scale-[1.01]">
              Принять
            </button>
            <button type="button" onClick={() => onAction(inv.invitation_id, "decline")}
              className="rounded-btn border border-border px-4 py-2.5 font-sans text-sm text-muted hover:border-accent/40 hover:text-accent">
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Settings — captain only */
function SettingsPanel({
  team, avatarPreview, bannerPreview, avatarFile, bannerFile,
  teamAvatarBroken, teamBannerBroken,
  avatarInputRef, bannerInputRef,
  onAvatarChange, onBannerChange, onSave, loading, error, success,
}) {
  return (
    <div className="flex flex-col gap-5 rounded-card border border-border bg-elevated p-6">
      <MonoLabel accent>НАСТРОЙКИ КОМАНДЫ</MonoLabel>

      {/* Avatar */}
      <div>
        <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">АВАТАР</div>
        <div className="flex items-center gap-4">
          <div
            className="h-20 w-20 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border bg-canvas transition-colors hover:border-accent/60"
            onClick={() => avatarInputRef.current?.click()}
          >
            {avatarPreview || (resolveAssetUrl(team.avatar_url || "") && !teamAvatarBroken) ? (
              <MediaAsset src={avatarPreview || resolveAssetUrl(team.avatar_url)} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">+ файл</div>
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm text-foreground">{avatarFile ? avatarFile.name : "Файл не выбран"}</div>
            <div className="mt-1 text-xs text-muted">PNG/JPG до 5 МБ, рекомендуется 256×256</div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
          </div>
        </div>
      </div>

      {/* Banner */}
      <div>
        <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">БАННЕР</div>
        <div
          className="relative h-28 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border bg-canvas transition-colors hover:border-accent/60"
          onClick={() => bannerInputRef.current?.click()}
        >
          {bannerPreview || (resolveAssetUrl(team.banner_url || "") && !teamBannerBroken) ? (
            <MediaAsset src={bannerPreview || resolveAssetUrl(team.banner_url)} alt="banner" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">+ выбрать баннер · 1200×300</div>
          )}
        </div>
        {bannerFile && <div className="mt-1.5 text-xs text-muted">Выбран: {bannerFile.name}</div>}
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={onBannerChange} />
      </div>

      {error && (
        <div className="rounded-card border border-accent/40 bg-canvas px-4 py-3 font-mono text-sm text-accent">{error}</div>
      )}
      {success && (
        <div className="rounded-card border border-accent bg-accent/10 px-4 py-3 font-mono text-sm text-accent">✓ {success}</div>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={loading || (!avatarFile && !bannerFile)}
        className="rounded-btn bg-accent py-3 font-sans text-sm font-bold text-black shadow-glow transition-transform hover:scale-[1.005] disabled:opacity-40"
      >
        {loading ? "Сохраняем…" : "Сохранить изменения"}
      </button>
    </div>
  );
}

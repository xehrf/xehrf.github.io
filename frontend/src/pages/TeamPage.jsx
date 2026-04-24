import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch, getWebSocketBaseUrl, resolveAssetUrl } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

function getWebSocketUrl(teamId) {
  const wsOrigin = getWebSocketBaseUrl();
  const token = localStorage.getItem("access_token") ?? "";
  return `${wsOrigin}/teams/ws/${teamId}?token=${encodeURIComponent(token)}`;
}

function MemberCard({ member, isCaptain, captainId, currentUserId, readyVotes, onKick }) {
  const avatarUrl = resolveAssetUrl(member.avatar_url || "");
  const isReady = readyVotes[member.user_id];
  const isCap = member.user_id === captainId;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-canvas p-3 transition hover:border-border/80">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="h-10 w-10 overflow-hidden rounded-xl bg-elevated">
          {avatarUrl ? (
            <img src={avatarUrl} alt={member.nickname} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-foreground">
              {member.nickname?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        {/* Online dot */}
        <span className={[
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-canvas",
          member.online ? "bg-green-400" : "bg-slate-600",
        ].join(" ")} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{member.nickname}</p>
          {isCap && <span className="text-[10px] text-accent">👑</span>}
        </div>
        <p className="truncate text-[11px] text-muted">{member.role || "Участник"}</p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <span className={[
          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
          isReady ? "bg-green-500/15 text-green-400" : "bg-slate-700/50 text-muted",
        ].join(" ")}>
          {isReady ? "Готов" : "Нет"}
        </span>
        {isCaptain && member.user_id !== currentUserId && (
          <button
            type="button"
            onClick={() => onKick(member.user_id)}
            className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted transition hover:border-red-500/40 hover:text-red-400"
          >
            Kick
          </button>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-border bg-canvas p-4 text-center">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function TeamPage() {
  const { user, loading: authLoading } = useAuth();
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
  const [wsStatus, setWsStatus] = useState("connecting"); // connecting | connected | disconnected
  const [activeTab, setActiveTab] = useState("chat"); // chat | stats | history | invites | settings
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const websocketRef = useRef(null);
  const chatEndRef = useRef(null);
  const navigate = useNavigate();

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
      if (eventName === "user_joined_team") setMessages((p) => [...p, { system: true, message: `${data.nickname || data.display_name} присоединился к команде.` }]);
      if (eventName === "user_left") setMessages((p) => [...p, { system: true, message: `${data.nickname || data.display_name} покинул команду.` }]);
      if (eventName === "team_ready_update") setReadyVotes(data.votes ?? {});
      if (eventName === "invitation_accepted") setMessages((p) => [...p, { system: true, message: `Пользователь #${data.user_id} принял приглашение.` }]);
      if (eventName === "task_completed") {
        setTeam((prev) => {
          if (!prev?.task || prev.task.task_id !== data.task_id) return prev;
          return { ...prev, task: null };
        });
        setMessages((p) => [...p, { system: true, message: `Задача #${data.task_id} решена командой.` }]);
      }
    });
    ws.addEventListener("close", () => setWsStatus("disconnected"));
    ws.addEventListener("error", () => setWsStatus("disconnected"));
    return () => { ws.close(); websocketRef.current = null; };
  }, [team]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (event) => {
    event.preventDefault();
    if (!chatText.trim() || websocketRef.current?.readyState !== WebSocket.OPEN) return;
    websocketRef.current.send(JSON.stringify({ event: "chat_message", message: chatText.trim() }));
    setChatText("");
  };

  const currentUserId = user?.id ?? 0;
  const isCaptain = currentUserId !== 0 && team?.captain_user_id === currentUserId;
  const myReady = Boolean(readyVotes[currentUserId]);
  const readyCount = Object.values(readyVotes).filter(Boolean).length;
  const totalMembers = team?.members?.length ?? 0;

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
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleBannerChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  async function handleSettingsSave() {
    if (!team) return;
    setSettingsLoading(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        await apiFetch(`/teams/${team.team_id}/avatar`, { method: "POST", body: fd });
      }
      if (bannerFile) {
        const fd = new FormData();
        fd.append("file", bannerFile);
        await apiFetch(`/teams/${team.team_id}/banner`, { method: "POST", body: fd });
      }
      const updated = await apiFetch("/teams/current");
      setTeam(updated);
      setAvatarFile(null);
      setBannerFile(null);
      setSettingsSuccess("Изменения сохранены!");
      setTimeout(() => setSettingsSuccess(""), 3000);
    } catch (e) {
      setSettingsError(e?.message || "Не удалось сохранить изменения");
    } finally {
      setSettingsLoading(false);
    }
  }

  if (loading || authLoading) return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="h-48 animate-pulse rounded-3xl border border-border bg-canvas" />
    </div>
  );

  if (error) return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Card className="p-6 text-sm text-accent">{error}</Card>
    </div>
  );

  if (!team) return null;

  const bannerUrl = resolveAssetUrl(team.banner_url || "");
  const avatarUrl = resolveAssetUrl(team.avatar_url || "");

  const TABS = [
    { id: "chat", label: "💬 Чат" },
    { id: "stats", label: "📊 Статистика" },
    { id: "history", label: "🏆 История" },
    ...(myInvites.length > 0 ? [{ id: "invites", label: `📨 Инвайты (${myInvites.length})` }] : [{ id: "invites", label: "📨 Инвайты" }]),
    ...(isCaptain ? [{ id: "settings", label: "⚙️ Настройки" }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">

      {/* Team Banner Header */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="relative h-36 sm:h-44">
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* Task button */}
          {team.task ? (
            <Link
              to={`/tasks/${team.task.task_id}/solve?team=1`}
              className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-black transition hover:bg-accent/90"
            >
              ▶ Открыть задачу
            </Link>
          ) : null}

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 p-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-white/20 bg-elevated shadow-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt={team.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                  {team.name?.[0]?.toUpperCase() ?? "T"}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white sm:text-2xl">{team.name}</h1>
              <p className="text-xs text-white/60">{team.description || "Командная комната"}</p>
            </div>
            {/* WS status */}
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-[11px] backdrop-blur-sm">
              <span className={[
                "h-2 w-2 rounded-full",
                wsStatus === "connected" ? "bg-green-400 animate-pulse" : "bg-red-400",
              ].join(" ")} />
              <span className="text-white/70">
                {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Подключение..." : "Отключено"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">

        {/* Left sidebar */}
        <div className="space-y-4">

          {/* Ready status */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Готовность</h2>
              <span className="text-xs font-bold text-foreground">{readyCount}/{totalMembers}</span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-green-400 transition-all duration-500"
                style={{ width: totalMembers ? `${(readyCount / totalMembers) * 100}%` : "0%" }}
              />
            </div>
            <button
              type="button"
              onClick={handleReadyToggle}
              className={[
                "w-full rounded-xl py-2.5 text-sm font-semibold transition",
                myReady
                  ? "bg-green-500/15 text-green-400 hover:bg-green-500/20"
                  : "bg-accent text-black hover:bg-accent/90",
              ].join(" ")}
            >
              {myReady ? "✓ Я готов — отменить" : "Я готов"}
            </button>
          </Card>

          {/* Members */}
          <Card className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Участники · {totalMembers}
            </h2>
            <div className="space-y-2">
              {team.members.map((member) => (
                <MemberCard
                  key={member.user_id}
                  member={member}
                  isCaptain={isCaptain}
                  captainId={team.captain_user_id}
                  currentUserId={currentUserId}
                  readyVotes={readyVotes}
                  onKick={handleKickMember}
                />
              ))}
            </div>
          </Card>

          {/* Invite (captain only) */}
          {isCaptain ? (
            <Card className="p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Пригласить игрока</h2>
              <form onSubmit={handleInviteUser} className="flex gap-2">
                <input
                  value={inviteeId}
                  onChange={(e) => setInviteeId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
                  placeholder="user_id"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-black transition hover:bg-accent/90"
                >
                  →
                </button>
              </form>
            </Card>
          ) : null}

          {/* Leave */}
          <button
            type="button"
            onClick={handleLeaveTeam}
            className="w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-muted transition hover:border-red-500/40 hover:text-red-400"
          >
            Выйти из команды
          </button>
        </div>

        {/* Right main area */}
        <div className="flex flex-col gap-4">

          {/* Task info bar */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Текущая задача</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {team.task ? `Задача #${team.task.task_id}` : "Нет активной задачи"}
                </p>
                {team.task ? (
                  <p className="text-xs text-muted capitalize">{team.task.status ?? "idle"}</p>
                ) : null}
              </div>
              {team.task ? (
                <Link
                  to={`/tasks/${team.task.task_id}/solve?team=1`}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black transition hover:bg-accent/90"
                >
                  Решать →
                </Link>
              ) : null}
            </div>
          </Card>

          {/* Tabs */}
          <Card className="flex-1 overflow-hidden p-0">
            {/* Tab bar */}
            <div className="flex border-b border-border">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex-1 px-3 py-3 text-xs font-semibold transition",
                    activeTab === tab.id
                      ? "border-b-2 border-accent text-accent"
                      : "text-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* CHAT TAB */}
              {activeTab === "chat" && (
                <div className="flex flex-col gap-3">
                  <div className="h-80 space-y-3 overflow-y-auto rounded-2xl border border-border bg-slate-950/30 p-4">
                    {messages.length === 0 ? (
                      <p className="text-center text-xs text-muted pt-6">Начните общение с командой 👋</p>
                    ) : (
                      messages.map((msg, i) => (
                        <div key={i}>
                          {msg.system ? (
                            <p className="text-center text-[11px] text-muted py-0.5">{msg.message}</p>
                          ) : (
                            <div className={msg.user_id === currentUserId ? "flex flex-col items-end" : ""}>
                              <p className="text-[11px] text-muted mb-1">{msg.nickname || msg.display_name}</p>
                              <div className={[
                                "inline-block max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                                msg.user_id === currentUserId
                                  ? "bg-accent text-black rounded-br-sm"
                                  : "bg-elevated text-foreground rounded-bl-sm",
                              ].join(" ")}>
                                {msg.message}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      className="w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
                      placeholder="Напиши сообщение..."
                    />
                    <button
                      type="submit"
                      disabled={!chatText.trim()}
                      className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black transition hover:bg-accent/90 disabled:opacity-40"
                    >
                      ↑
                    </button>
                  </form>
                </div>
              )}

              {/* STATS TAB */}
              {activeTab === "stats" && (
                <div>
                  {teamStats ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatBox label="Рейтинг" value={teamStats.rating} />
                        <StatBox label="Матчи" value={teamStats.total_matches} />
                        <StatBox label="Win Rate" value={`${(teamStats.win_rate * 100).toFixed(0)}%`} />
                        <StatBox label="Общий PTS" value={teamStats.total_ptc} />
                      </div>
                      {/* W/L/D bar */}
                      <div className="rounded-2xl border border-border bg-canvas p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Победы / Поражения / Ничьи</p>
                        <div className="flex gap-1 overflow-hidden rounded-full" style={{ height: 10 }}>
                          {teamStats.total_matches > 0 ? (
                            <>
                              <div className="bg-green-400 transition-all" style={{ width: `${(teamStats.wins / teamStats.total_matches) * 100}%` }} />
                              <div className="bg-red-400 transition-all" style={{ width: `${(teamStats.losses / teamStats.total_matches) * 100}%` }} />
                              <div className="bg-slate-500 transition-all" style={{ width: `${(teamStats.draws / teamStats.total_matches) * 100}%` }} />
                            </>
                          ) : <div className="w-full bg-elevated" />}
                        </div>
                        <div className="mt-2 flex gap-4 text-xs">
                          <span className="text-green-400">✓ {teamStats.wins} побед</span>
                          <span className="text-red-400">✗ {teamStats.losses} поражений</span>
                          <span className="text-muted">― {teamStats.draws} ничьих</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted">Пока нет статистики</div>
                  )}
                </div>
              )}

              {/* HISTORY TAB */}
              {activeTab === "history" && (
                <div>
                  {teamHistory.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted">История матчей пуста</div>
                  ) : (
                    <div className="space-y-2">
                      {teamHistory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-canvas px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={[
                              "rounded-lg px-2 py-1 text-xs font-bold",
                              item.result === "win" ? "bg-green-500/15 text-green-400" :
                              item.result === "loss" ? "bg-red-500/15 text-red-400" :
                              "bg-slate-700/50 text-muted",
                            ].join(" ")}>
                              {item.result === "win" ? "WIN" : item.result === "loss" ? "LOSS" : "DRAW"}
                            </span>
                            <span className="text-sm text-foreground">Матч #{item.id}</span>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${item.rating_delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {item.rating_delta >= 0 ? "+" : ""}{item.rating_delta} pts
                            </p>
                            <p className="text-[11px] text-muted">{new Date(item.created_at).toLocaleDateString("ru-RU")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* INVITES TAB */}
              {activeTab === "invites" && (
                <div>
                  {myInvites.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted">Нет входящих приглашений</div>
                  ) : (
                    <div className="space-y-3">
                      {myInvites.map((inv) => (
                        <div key={inv.invitation_id} className="rounded-2xl border border-border bg-canvas p-4">
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-foreground">Команда #{inv.team_id}</p>
                            <p className="text-xs text-muted">Приглашение от пользователя #{inv.inviter_user_id}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleInviteAction(inv.invitation_id, "accept")}
                              className="flex-1 rounded-xl bg-accent py-2 text-xs font-bold text-black transition hover:bg-accent/90"
                            >
                              Принять
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInviteAction(inv.invitation_id, "decline")}
                              className="flex-1 rounded-xl border border-border py-2 text-xs text-muted transition hover:border-red-500/40 hover:text-red-400"
                            >
                              Отклонить
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* SETTINGS TAB — captain only */}
              {activeTab === "settings" && isCaptain && (
                <div className="space-y-6">
                  {/* Avatar upload */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Аватарка команды</p>
                    <div className="flex items-center gap-4">
                      {/* Preview */}
                      <div
                        className="h-20 w-20 flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border bg-elevated transition hover:border-accent/60"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {avatarPreview || resolveAssetUrl(team.avatar_url || "") ? (
                          <img
                            src={avatarPreview || resolveAssetUrl(team.avatar_url)}
                            alt="avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted">
                            <span className="text-2xl">🖼</span>
                            <span className="text-[10px]">Выбрать</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium">
                          {avatarFile ? avatarFile.name : "Файл не выбран"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">PNG, JPG до 5 МБ. Рекомендуется 256×256</p>
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          className="mt-2 rounded-xl border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent/50 hover:text-accent"
                        >
                          Выбрать файл
                        </button>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banner upload */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Баннер команды</p>
                    <div
                      className="relative h-32 w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border bg-elevated transition hover:border-accent/60"
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      {bannerPreview || resolveAssetUrl(team.banner_url || "") ? (
                        <>
                          <img
                            src={bannerPreview || resolveAssetUrl(team.banner_url)}
                            alt="banner"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100">
                            <span className="rounded-xl bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                              Изменить баннер
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
                          <span className="text-3xl">🖼</span>
                          <span className="text-xs">Нажмите чтобы выбрать баннер</span>
                          <span className="text-[11px] text-muted/60">PNG, JPG до 10 МБ. Рекомендуется 1200×300</span>
                        </div>
                      )}
                    </div>
                    {bannerFile && (
                      <p className="mt-1.5 text-xs text-muted">Выбран: {bannerFile.name}</p>
                    )}
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBannerChange}
                    />
                  </div>

                  {/* Feedback */}
                  {settingsError && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      {settingsError}
                    </div>
                  )}
                  {settingsSuccess && (
                    <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                      ✓ {settingsSuccess}
                    </div>
                  )}

                  {/* Save button */}
                  <button
                    type="button"
                    onClick={handleSettingsSave}
                    disabled={settingsLoading || (!avatarFile && !bannerFile)}
                    className="w-full rounded-2xl bg-accent py-3 text-sm font-bold text-black transition hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {settingsLoading ? "Сохраняем..." : "Сохранить изменения"}
                  </button>
                </div>
              )}

            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

function getWebSocketUrl(teamId) {
  const origin = import.meta.env.VITE_API_URL ?? window.location.origin;
  const wsOrigin = origin.replace(/^http/, "ws").replace(/\/+$/, "");
  const token = localStorage.getItem("access_token") ?? "";
  return `${wsOrigin}/teams/ws/${teamId}?token=${encodeURIComponent(token)}`;
}

export function TeamPage() {
  const { user } = useAuth();
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
  const [statusMessage, setStatusMessage] = useState("Ожидаем подключения…");
  const websocketRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const current = await apiFetch("/teams/current");
        if (!mounted) return;
        if (current == null) {
          navigate("/matchmaking");
          return;
        }
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
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!team) return;
    const ws = new WebSocket(getWebSocketUrl(team.team_id));
    websocketRef.current = ws;

    ws.addEventListener("open", () => setStatusMessage("Подключено к командной комнате"));
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const eventName = payload.event;
      const data = payload.data;
      if (eventName === "chat_message") {
        setMessages((prev) => [...prev, data]);
      }
      if (eventName === "team_formed") {
        setStatusMessage(data.message || "Команда собрана.");
      }
      if (eventName === "user_joined_team") {
        setMessages((prev) => [...prev, { system: true, message: `${data.nickname || data.display_name} присоединился к команде.` }]);
      }
      if (eventName === "user_left") {
        setMessages((prev) => [...prev, { system: true, message: `${data.nickname || data.display_name} покинул команду.` }]);
      }
      if (eventName === "task_assigned") {
        setStatusMessage(`Задача ${data.task_id} назначена.`);
      }
      if (eventName === "team_ready_update") {
        setReadyVotes(data.votes ?? {});
      }
      if (eventName === "invitation_accepted") {
        setMessages((prev) => [...prev, { system: true, message: `Пользователь #${data.user_id} принял приглашение.` }]);
      }
    });

    ws.addEventListener("close", () => setStatusMessage("Соединение отключено."));
    ws.addEventListener("error", () => setStatusMessage("Ошибка websocket-соединения."));

    return () => {
      ws.close();
      websocketRef.current = null;
    };
  }, [team]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!chatText.trim() || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    websocketRef.current.send(JSON.stringify({ event: "chat_message", message: chatText.trim() }));
    setChatText("");
  };

  const currentUserId = user?.id ?? 0;
  const isCaptain = team?.captain_user_id === currentUserId;

  async function handleReadyToggle(nextReady) {
    if (!team) return;
    try {
      const res = await apiFetch(`/teams/${team.team_id}/ready`, {
        method: "POST",
        body: { is_ready: nextReady },
      });
      setReadyVotes(res.votes ?? {});
    } catch (e) {
      setError(e?.message || "Не удалось обновить готовность");
    }
  }

  async function handleInviteUser(e) {
    e.preventDefault();
    if (!team || !inviteeId.trim()) return;
    try {
      await apiFetch(`/teams/${team.team_id}/invite`, {
        method: "POST",
        body: { invitee_user_id: Number(inviteeId) },
      });
      setInviteeId("");
      setStatusMessage("Приглашение отправлено.");
    } catch (e2) {
      setError(e2?.message || "Не удалось отправить приглашение");
    }
  }

  async function handleInviteAction(invitationId, action) {
    try {
      await apiFetch(`/teams/invites/${invitationId}/${action}`, {
        method: "POST",
      });
      setMyInvites((prev) => prev.filter((inv) => inv.invitation_id !== invitationId));
      if (action === "accept") {
        const current = await apiFetch("/teams/current");
        setTeam(current);
      }
    } catch (e) {
      setError(e?.message || "Не удалось обработать приглашение");
    }
  }

  async function handleLeaveTeam() {
    if (!team) return;
    try {
      await apiFetch(`/teams/${team.team_id}/leave`, { method: "POST" });
      navigate("/matchmaking");
    } catch (e) {
      setError(e?.message || "Не удалось выйти из команды");
    }
  }

  async function handleKickMember(memberUserId) {
    if (!team) return;
    try {
      await apiFetch(`/teams/${team.team_id}/kick/${memberUserId}`, { method: "POST" });
      setTeam((prev) => ({
        ...prev,
        members: prev.members.filter((member) => member.user_id !== memberUserId),
      }));
    } catch (e) {
      setError(e?.message || "Не удалось исключить участника");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Card className="p-6 text-sm text-muted">Загрузка командной комнаты...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Card className="p-6 text-sm text-accent">{error}</Card>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Командная комната</h1>
          <p className="mt-1 text-sm text-muted">{team?.description || "Работайте вместе над задачей и обсуждайте ход."}</p>
        </div>
        {team.task ? (
          <Link
            to={`/tasks/${team.task.task_id}/solve`}
            className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            Открыть задачу
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Статус</h2>
            <p className="mt-2 text-sm text-foreground">{statusMessage}</p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Задача</h2>
            <p className="mt-2 text-sm text-foreground">{team.task ? `#${team.task.task_id}` : "Нет активной"}</p>
            <p className="text-xs text-muted">{team.task?.status ?? "idle"}</p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Участники</h2>
            <ul className="mt-3 space-y-2">
              {team.members.map((member) => (
                <li key={member.user_id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-canvas px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">
                      {member.nickname}
                      {member.user_id === team.captain_user_id ? " (капитан)" : ""}
                    </div>
                    <div className="text-[11px] text-muted">{member.role}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {member.online ? "online" : "offline"} · {readyVotes[member.user_id] ? "ready" : "not ready"}
                    </span>
                    {isCaptain && member.user_id !== currentUserId ? (
                      <button
                        type="button"
                        onClick={() => handleKickMember(member.user_id)}
                        className="rounded-full border border-border px-2 py-1 text-[10px] text-accent"
                      >
                        Kick
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Готовность</h2>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleReadyToggle(true)}
                className="rounded-2xl border border-border px-3 py-2 text-xs text-foreground"
              >
                Я готов
              </button>
              <button
                type="button"
                onClick={() => handleReadyToggle(false)}
                className="rounded-2xl border border-border px-3 py-2 text-xs text-muted"
              >
                Не готов
              </button>
            </div>
          </div>

          {isCaptain ? (
            <form className="space-y-2" onSubmit={handleInviteUser}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Пригласить по user_id</h2>
              <input
                value={inviteeId}
                onChange={(e) => setInviteeId(e.target.value)}
                className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
                placeholder="Например, 12"
              />
              <button type="submit" className="rounded-2xl bg-accent px-3 py-2 text-xs font-semibold text-white">
                Отправить инвайт
              </button>
            </form>
          ) : null}

          <button
            type="button"
            onClick={handleLeaveTeam}
            className="mt-4 w-full rounded-2xl border border-border px-3 py-2 text-sm text-accent"
          >
            Выйти из команды
          </button>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Командный чат</h2>
            <span className="text-xs text-muted">WebSocket</span>
          </div>

          <div className="mb-4 h-[360px] space-y-3 overflow-y-auto rounded-3xl border border-border bg-slate-950/5 p-4 text-sm text-foreground">
            {messages.length === 0 ? (
              <div className="text-sm text-muted">Сообщения появятся здесь после подключения.</div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={message.system ? "text-xs text-muted" : "space-y-1"}>
                  {message.system ? (
                    <div>{message.message}</div>
                  ) : (
                    <>
                      <div className="font-medium">{message.nickname || message.display_name}</div>
                      <div>{message.message}</div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className="space-y-3">
            <textarea
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-3xl border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
              placeholder="Напиши сообщение команде…"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              Отправить чат
            </button>
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Статистика команды</h2>
          {teamStats ? (
            <div className="mt-3 space-y-1 text-sm text-foreground">
              <div>Рейтинг: {teamStats.rating}</div>
              <div>Матчи: {teamStats.total_matches}</div>
              <div>W/L/D: {teamStats.wins}/{teamStats.losses}/{teamStats.draws}</div>
              <div>Win rate: {(teamStats.win_rate * 100).toFixed(1)}%</div>
              <div>Общий PTS: {teamStats.total_ptc}</div>
              <div>Средний PTS: {teamStats.average_ptc.toFixed(1)}</div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-muted">Пока нет данных.</div>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">История матчей</h2>
          <div className="mt-3 space-y-2 text-sm">
            {teamHistory.length === 0 ? (
              <div className="text-muted">История пуста.</div>
            ) : (
              teamHistory.map((item) => (
                <div key={item.id} className="rounded-xl border border-border px-3 py-2">
                  {item.result} · Δ{item.rating_delta} · {new Date(item.created_at).toLocaleString()}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Входящие приглашения</h2>
          <div className="mt-3 space-y-2 text-sm">
            {myInvites.length === 0 ? (
              <div className="text-muted">Нет приглашений.</div>
            ) : (
              myInvites.map((inv) => (
                <div key={inv.invitation_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2">
                  <span>Team #{inv.team_id} от user #{inv.inviter_user_id}</span>
                  <button
                    type="button"
                    className="rounded-xl bg-accent px-2 py-1 text-xs text-white"
                    onClick={() => handleInviteAction(inv.invitation_id, "accept")}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-border px-2 py-1 text-xs"
                    onClick={() => handleInviteAction(inv.invitation_id, "decline")}
                  >
                    Отклонить
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

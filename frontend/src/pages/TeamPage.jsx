import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

function getWebSocketUrl(teamId) {
  const origin = import.meta.env.VITE_API_URL ?? window.location.origin;
  const wsOrigin = origin.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${wsOrigin}/team/ws/${teamId}`;
}

export function TeamPage() {
  const [team, setTeam] = useState(null);
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
        const current = await apiFetch("/team/current");
        if (!mounted) return;
        if (current == null) {
          navigate("/matchmaking");
          return;
        }
        setTeam(current);
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
          <p className="mt-1 text-sm text-muted">Работайте вместе над задачей и обсуждайте ход.</p>
        </div>
        <Link
          to={`/tasks/${team.task.task_id}/solve`}
          className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
        >
          Открыть задачу
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Статус</h2>
            <p className="mt-2 text-sm text-foreground">{statusMessage}</p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Задача</h2>
            <p className="mt-2 text-sm text-foreground">#{team.task.task_id}</p>
            <p className="text-xs text-muted">{team.task.status}</p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Участники</h2>
            <ul className="mt-3 space-y-2">
              {team.members.map((member) => (
                <li key={member.user_id} className="flex items-center justify-between rounded-2xl border border-border bg-canvas px-3 py-2 text-sm">
                  <span>{member.nickname}</span>
                  <span className="text-xs text-muted">{member.online ? "online" : "offline"}</span>
                </li>
              ))}
            </ul>
          </div>
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
    </div>
  );
}

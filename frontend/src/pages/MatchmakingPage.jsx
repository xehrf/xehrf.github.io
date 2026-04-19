import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getMatchmakingSocketUrl(token) {
  const origin = import.meta.env.VITE_API_URL ?? window.location.origin;
  const wsOrigin = origin.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${wsOrigin}/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function getMatchRoomSocketUrl(matchId, token) {
  const origin = import.meta.env.VITE_API_URL ?? window.location.origin;
  const wsOrigin = origin.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${wsOrigin}/matchmaking/match/${matchId}/ws?token=${encodeURIComponent(token)}`;
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) return "—";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function levelColor(level) {
  const map = {
    beginner: "#6ee7b7",
    intermediate: "#60a5fa",
    advanced: "#f472b6",
    expert: "#facc15",
  };
  return map[level] ?? "#94a3b8";
}

// ─── MiniProfile (Discord-style hover card) ───────────────────────────────────

function MiniProfile({ participant, online }) {
  return (
    <div className="absolute right-full mr-3 top-0 z-50 w-56 rounded-xl border border-white/10 bg-[#1a1f2e] shadow-2xl p-4 pointer-events-none">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="relative h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
          style={{ background: `linear-gradient(135deg, ${levelColor(participant.level)}, #1e293b)` }}
        >
          {participant.avatar_url ? (
            <img src={participant.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            (participant.display_name || participant.nickname || "?")[0].toUpperCase()
          )}
          {/* online dot */}
          <span
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#1a1f2e]"
            style={{ background: online ? "#4ade80" : "#6b7280" }}
          />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm truncate">
            {participant.display_name || participant.nickname}
          </p>
          <p className="text-xs text-slate-400 truncate">@{participant.nickname}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span
          className="rounded-full px-2 py-0.5 font-semibold"
          style={{ background: levelColor(participant.level) + "22", color: levelColor(participant.level) }}
        >
          {participant.level}
        </span>
        <span className="text-slate-300 font-mono font-bold">{participant.pts} PTS</span>
      </div>
    </div>
  );
}

// ─── ParticipantRow ───────────────────────────────────────────────────────────

function ParticipantRow({ participant, online, isMe }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-default transition-colors hover:bg-white/5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* avatar */}
      <div
        className="relative h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: `linear-gradient(135deg, ${levelColor(participant.level)}, #1e293b)` }}
      >
        {participant.avatar_url ? (
          <img src={participant.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          (participant.display_name || participant.nickname || "?")[0].toUpperCase()
        )}
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0f1420]"
          style={{ background: online ? "#4ade80" : "#6b7280" }}
        />
      </div>

      {/* name */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate">
          {participant.display_name || participant.nickname}
          {isMe && <span className="ml-1 text-slate-500">(вы)</span>}
        </p>
        <p className="text-[10px] text-slate-500 truncate">@{participant.nickname}</p>
      </div>

      {/* pts */}
      <span className="text-xs font-mono text-slate-400">{participant.pts}</span>

      {/* hover mini-profile */}
      {hovered && <MiniProfile participant={participant} online={online} />}
    </div>
  );
}

// ─── QueueProgress ────────────────────────────────────────────────────────────

function QueueProgress({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
        <span>Игроков в очереди</span>
        <span className="font-mono font-bold text-white">
          {current}/{total}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? "#4ade80" : "linear-gradient(90deg, #6366f1, #8b5cf6)",
          }}
        />
      </div>
      <div className="flex gap-1.5 mt-2 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 w-6 rounded-full transition-all duration-500"
            style={{
              background: i < current
                ? (pct >= 100 ? "#4ade80" : "#6366f1")
                : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

function ChatPanel({ messages, myUserId, onSend }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/5 text-xs font-semibold text-slate-400 uppercase tracking-widest">
        Чат
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-slate-600 text-center pt-4">Пока тихо…</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.user_id === myUserId ? "items-end" : "items-start"}`}>
            <span className="text-[10px] text-slate-500 mb-0.5">
              {msg.user_id === myUserId ? "вы" : msg.display_name || msg.nickname}
            </span>
            <div
              className="rounded-xl px-3 py-1.5 text-xs max-w-[85%] break-words"
              style={{
                background: msg.user_id === myUserId
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "rgba(255,255,255,0.06)",
                color: "#e2e8f0",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 px-3 py-2 border-t border-white/5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написать…"
          maxLength={500}
          className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          ↑
        </button>
      </form>
    </div>
  );
}

// ─── MatchArena ───────────────────────────────────────────────────────────────

function MatchArena({ activeMatch, myUserId, onNavigateTask, onReset }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const wsRef = useRef(null);
  const [secondsRemaining, setSecondsRemaining] = useState(null);

  // Timer
  useEffect(() => {
    if (!activeMatch?.ends_at) return;
    const deadline = new Date(activeMatch.ends_at).getTime();
    setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    const id = setInterval(() => {
      setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [activeMatch?.ends_at]);

  // Match room WS
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token || !activeMatch?.match_id) return;

    const ws = new WebSocket(getMatchRoomSocketUrl(activeMatch.match_id, token));
    wsRef.current = ws;

    ws.addEventListener("message", (e) => {
      const payload = JSON.parse(e.data);
      const data = payload.data ?? {};

      if (payload.event === "room_state") {
        setParticipants(data.participants ?? []);
        setOnlineIds(data.online ?? []);
      }
      if (payload.event === "user_joined") {
        setOnlineIds(data.online ?? []);
      }
      if (payload.event === "user_left") {
        setOnlineIds(data.online ?? []);
      }
      if (payload.event === "chat") {
        setMessages((prev) => [...prev, data]);
      }
    });

    return () => ws.close();
  }, [activeMatch?.match_id]);

  function sendChat(text) {
    wsRef.current?.send(JSON.stringify({ event: "chat", text }));
    // Optimistic add
    setMessages((prev) => [
      ...prev,
      {
        user_id: myUserId,
        text,
        display_name: "вы",
        nickname: "вы",
      },
    ]);
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Матч найден</h2>
            <p className="text-xs text-slate-400">
              До конца: <span className="font-mono text-indigo-400">{formatCountdown(secondsRemaining)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onNavigateTask(activeMatch.task_id)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              Открыть задачу →
            </button>
            <button
              onClick={onReset}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 rounded-xl border border-white/8 bg-[#0f1420] min-h-0" style={{ height: "360px" }}>
          <ChatPanel messages={messages} myUserId={myUserId} onSend={sendChat} />
        </div>
      </div>

      {/* Right panel — participants */}
      <div className="w-52 shrink-0 flex flex-col gap-3">
        <div className="rounded-xl border border-white/8 bg-[#0f1420] overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            Участники — {participants.length}
          </div>
          <div className="py-1">
            {participants.map((p) => (
              <ParticipantRow
                key={p.user_id}
                participant={p}
                online={onlineIds.includes(p.user_id)}
                isMe={p.user_id === myUserId}
              />
            ))}
            {participants.length === 0 && (
              <p className="text-xs text-slate-600 px-3 py-3">Загрузка…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MatchmakingPage() {
  const navigate = useNavigate();
  const [activeMatch, setActiveMatch] = useState(null);
  const [queueInfo, setQueueInfo] = useState({ queue_size: 0, queue_position: null, total: 2 });
  const [searching, setSearching] = useState(false);
  const [statusNote, setStatusNote] = useState("Нажмите кнопку, чтобы встать в очередь.");
  const [error, setError] = useState("");
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Get my user id from token (decode JWT payload)
  const myUserId = useMemo(() => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub_id ?? payload.user_id ?? null;
    } catch {
      return null;
    }
  }, []);

  const state = useMemo(() => {
    if (activeMatch) return "matched";
    if (searching) return "searching";
    return "idle";
  }, [activeMatch, searching]);

  function handleFindMatch() {
    if (state === "searching") return;
    setError("");
    setSearching(true);
    setStatusNote("Ищем соперника с близким PTS…");

    (async () => {
      try {
        const res = await apiFetch("/matchmaking/queue", { method: "POST" });
        if (res.status === "matched") {
          setActiveMatch(res);
          setSearching(false);
          return;
        }
        if (res.status === "already_in_match") {
          setActiveMatch(res);
          setSearching(false);
          return;
        }
        if (res.status === "queued") {
          setQueueInfo({
            queue_size: res.queue_size ?? 1,
            queue_position: res.queue_position ?? null,
            total: 2,
          });
          setStatusNote("Вы в очереди. Ожидаем соперника…");
          return;
        }
        setError(res.message || "Ошибка матчмейкинга");
        setSearching(false);
      } catch (e) {
        setError(e?.message || "Ошибка матчмейкинга");
        setSearching(false);
      }
    })();
  }

  function handleReset() {
    setError("");
    (async () => {
      try {
        await apiFetch("/matchmaking/queue", { method: "DELETE" });
      } catch {}
      finally {
        setActiveMatch(null);
        setSearching(false);
        setQueueInfo({ queue_size: 0, queue_position: null, total: 2 });
        setStatusNote("Поиск отменён.");
      }
    })();
  }

  // Load active match on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await apiFetch("/matchmaking/active");
        if (!mounted) return;
        if (current) {
          setActiveMatch(current);
          setSearching(false);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Matchmaking WS
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const ws = new WebSocket(getMatchmakingSocketUrl(token));

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "queue_update") {
        const data = payload.data ?? {};
        setQueueInfo({
          queue_size: data.queue_size ?? 0,
          queue_position: data.queue_position ?? null,
          total: data.total ?? 2,
        });
        const queued = data.status === "queued";
        setSearching(queued);
      }
      if (payload.event === "active_match" || payload.event === "match_found") {
        const data = payload.data ?? {};
        setActiveMatch((prev) => ({ ...(prev ?? {}), ...data }));
        setSearching(false);
        setStatusNote("Соперник найден!");
      }
    });

    return () => ws.close();
  }, []);

  if (isMobile) return <Navigate to="/dashboard" replace />;

  return (
    <div
      className="min-h-screen"
      style={{ background: "radial-gradient(ellipse at 20% 50%, #1a1040 0%, #0a0d18 60%)" }}
    >
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-black tracking-tight"
            style={{ background: "linear-gradient(135deg, #a78bfa, #6366f1, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            PvP матчмейкинг
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Система подберёт соперника с близким PTS и запустит таймер матча
          </p>
        </div>

        {/* MATCHED state */}
        {state === "matched" && (
          <div style={{ height: "520px" }}>
            <MatchArena
              activeMatch={activeMatch}
              myUserId={myUserId}
              onNavigateTask={(taskId) => navigate(`/tasks/${taskId}/solve`)}
              onReset={handleReset}
            />
          </div>
        )}

        {/* IDLE / SEARCHING state */}
        {state !== "matched" && (
          <div
            className="rounded-2xl border p-8 sm:p-12 flex flex-col items-center gap-8"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
          >
            {/* Icon */}
            <div
              className={[
                "flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all duration-500",
                state === "idle" && "border-white/10 bg-white/3",
                state === "searching" && "border-indigo-500/60 bg-indigo-500/5",
              ].filter(Boolean).join(" ")}
              style={state === "searching" ? { animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}}
            >
              {state === "searching" && (
                <span
                  className="h-10 w-10 rounded-full border-2 border-t-transparent"
                  style={{ borderColor: "#6366f1 transparent transparent transparent", animation: "spin 1s linear infinite" }}
                />
              )}
              {state === "idle" && (
                <span className="text-3xl" style={{ filter: "grayscale(0.3)" }}>⚔️</span>
              )}
            </div>

            {/* Text */}
            <div className="text-center w-full max-w-xs">
              {state === "idle" && (
                <>
                  <p className="text-lg font-semibold text-white">Готов к бою?</p>
                  <p className="mt-1 text-sm text-slate-500">Нажми и встань в очередь</p>
                </>
              )}
              {state === "searching" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold text-indigo-400">Поиск соперника…</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Позиция в очереди: {queueInfo.queue_position ?? "—"}
                    </p>
                  </div>
                  <QueueProgress
                    current={Math.min(queueInfo.queue_size, queueInfo.total)}
                    total={queueInfo.total}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex w-full max-w-xs flex-col gap-3">
              {state === "idle" && (
                <button
                  type="button"
                  onClick={handleFindMatch}
                  className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-80"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  Найти матч
                </button>
              )}
              {state === "searching" && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Отменить поиск
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600">{statusNote}</p>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}

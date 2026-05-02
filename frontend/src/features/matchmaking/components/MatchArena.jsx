import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, getWebSocketBaseUrl, resolveAssetUrl } from "../../../api/client.js";
import { useGameEngine } from "../useGameEngine.js";
import { GameStageView, ScoreBar } from "./GameStageView.jsx";

const GAME_EVENT_NAMES = new Set([
  "game_start",
  "game_start_cancelled",
  "game_answer_submitted",
  "game_round_result",
  "game_next_round",
  "game_finished",
]);
const ROOM_SOCKET_RECONNECT_MAX_DELAY_MS = 10000;

function getMatchRoomSocketUrl(matchId, token) {
  const wsOrigin = getWebSocketBaseUrl();
  return `${wsOrigin}/matchmaking/match/${matchId}/ws?token=${encodeURIComponent(token)}`;
}

function logDevError(scope, error) {
  if (import.meta.env.DEV) {
    console.error(`[MatchArena] ${scope}`, error);
  }
}

function normalizeUserId(userId) {
  if (userId == null) {
    return null;
  }

  return String(userId);
}

function isSameUserId(left, right) {
  const normalizedLeft = normalizeUserId(left);
  return normalizedLeft !== null && normalizedLeft === normalizeUserId(right);
}

function hasOnlineUser(onlineIds, userId) {
  if (!Array.isArray(onlineIds)) {
    return false;
  }

  return onlineIds.some((candidateUserId) => isSameUserId(candidateUserId, userId));
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) {
    return "--:--";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getRoomSocketReconnectDelayMs(attempt) {
  return Math.min(1000 * (2 ** Math.max(0, attempt - 1)), ROOM_SOCKET_RECONNECT_MAX_DELAY_MS);
}

export function getOpponentFromParticipants(participants, myUserId) {
  if (!Array.isArray(participants)) {
    return null;
  }

  return participants.find((item) => !isSameUserId(item?.user_id, myUserId)) ?? null;
}

function addParticipantUserIds(target, source) {
  if (!Array.isArray(source)) {
    return;
  }

  source.forEach((participant) => {
    const normalizedUserId = normalizeUserId(participant?.user_id);
    if (normalizedUserId !== null) {
      target.add(normalizedUserId);
    }
  });
}

export function resolveHostUserId({ participants, activeMatch, myUserId }) {
  const candidateIds = new Set();

  addParticipantUserIds(candidateIds, activeMatch?.participants);
  addParticipantUserIds(candidateIds, participants);

  const normalizedMyUserId = normalizeUserId(myUserId);
  if (normalizedMyUserId !== null) {
    candidateIds.add(normalizedMyUserId);
  }

  const normalizedOpponentUserId = normalizeUserId(activeMatch?.opponent?.user_id);
  if (normalizedOpponentUserId !== null) {
    candidateIds.add(normalizedOpponentUserId);
  }

  if (candidateIds.size < 2) {
    return null;
  }

  const sortedIds = [...candidateIds].sort((left, right) => left.localeCompare(right));
  return sortedIds[0] ?? null;
}

function resolveGameEventSenderUserId(eventName, envelopeData, gameData) {
  return normalizeUserId(
    envelopeData?.user_id
    ?? envelopeData?.userId
    ?? gameData?.senderUserId
    ?? (eventName === "game_answer_submitted" ? gameData?.userId : null)
    ?? (eventName === "game_start" ? gameData?.host : null),
  );
}

export function shouldHandleIncomingGameEvent({ eventName, envelopeData, gameData, myUserId }) {
  if (eventName === "game_start_cancelled") {
    return true;
  }

  const normalizedMyUserId = normalizeUserId(myUserId);
  const senderUserId = resolveGameEventSenderUserId(eventName, envelopeData, gameData);

  if (normalizedMyUserId === null || senderUserId === null) {
    return true;
  }

  return senderUserId !== normalizedMyUserId;
}

export function resolveStartControlState({ myUserId, hostUserId, opponentUserId, onlineIds, roomSocketOpen }) {
  const isHost = isSameUserId(myUserId, hostUserId);
  const meOnline = hasOnlineUser(onlineIds, myUserId);
  const opponentOnline = hasOnlineUser(onlineIds, opponentUserId);
  const canStartGame = isHost && roomSocketOpen && meOnline && opponentOnline;

  let startButtonLabel = "Ожидаем готовность";
  if (canStartGame) {
    startButtonLabel = "🚀 Начать игру!";
  } else if (isHost && !roomSocketOpen) {
    startButtonLabel = "⏳ Подключаем комнату";
  } else if (isHost && !opponentOnline) {
    startButtonLabel = "⏳ Ждём соперника";
  }

  return {
    canStartGame,
    opponentOnline,
    startButtonLabel,
  };
}

function findReadyParticipant(readiness, userId) {
  const participants = Array.isArray(readiness?.participants) ? readiness.participants : [];
  return participants.find((participant) => isSameUserId(participant.user_id, userId)) ?? null;
}

export function resolveReadinessState({ myUserId, opponentUserId, readiness, roomSocketOpen }) {
  const myParticipant = findReadyParticipant(readiness, myUserId);
  const opponentParticipant = findReadyParticipant(readiness, opponentUserId);

  return {
    myReady: Boolean(myParticipant?.ready),
    opponentReady: Boolean(opponentParticipant?.ready),
    allReady: Boolean(readiness?.all_ready),
    canToggleReady: Boolean(roomSocketOpen),
    myLabel: myParticipant?.nickname || myParticipant?.display_name || "Вы",
    opponentLabel: opponentParticipant?.nickname || opponentParticipant?.display_name || "Соперник",
  };
}

export function updateReadinessParticipant(readiness, userId, ready) {
  const participants = Array.isArray(readiness?.participants) ? readiness.participants : [];
  const updatedParticipants = participants.map((participant) => (
    isSameUserId(participant.user_id, userId)
      ? { ...participant, ready }
      : participant
  ));

  return {
    ...readiness,
    participants: updatedParticipants,
    all_ready: updatedParticipants.length === 2 && updatedParticipants.every((participant) => participant.ready),
  };
}

const ROLE_BADGE_PALETTES = {
  "back-end": { border: "rgba(99,102,241,0.55)", bg: "rgba(67,56,202,0.24)", text: "#c7d2fe", shadow: "rgba(99,102,241,0.35)" },
  "front-end": { border: "rgba(6,182,212,0.55)", bg: "rgba(8,145,178,0.24)", text: "#a5f3fc", shadow: "rgba(6,182,212,0.35)" },
  "full-stack": { border: "rgba(34,197,94,0.55)", bg: "rgba(22,163,74,0.24)", text: "#bbf7d0", shadow: "rgba(34,197,94,0.35)" },
  "project manager": { border: "rgba(244,114,182,0.55)", bg: "rgba(190,24,93,0.24)", text: "#fbcfe8", shadow: "rgba(244,114,182,0.35)" },
  "ui/ux": { border: "rgba(168,85,247,0.55)", bg: "rgba(126,34,206,0.24)", text: "#e9d5ff", shadow: "rgba(168,85,247,0.35)" },
  "ai/ml": { border: "rgba(245,158,11,0.55)", bg: "rgba(180,83,9,0.24)", text: "#fde68a", shadow: "rgba(245,158,11,0.35)" },
  devops: { border: "rgba(148,163,184,0.55)", bg: "rgba(71,85,105,0.26)", text: "#e2e8f0", shadow: "rgba(148,163,184,0.35)" },
  devop: { border: "rgba(148,163,184,0.55)", bg: "rgba(71,85,105,0.26)", text: "#e2e8f0", shadow: "rgba(148,163,184,0.35)" },
  qa: { border: "rgba(45,212,191,0.55)", bg: "rgba(15,118,110,0.24)", text: "#99f6e4", shadow: "rgba(45,212,191,0.35)" },
};
const DEFAULT_ROLE_BADGE = { border: "rgba(255,214,0,0.45)", bg: "rgba(255,214,0,0.12)", text: "#FFD600", shadow: "rgba(255,214,0,0.28)" };

function getRolePalette(roleLabel) {
  const key = String(roleLabel ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return ROLE_BADGE_PALETTES[key] || DEFAULT_ROLE_BADGE;
}

function getBadgePresentation(badge) {
  return { icon: "R", ...getRolePalette(badge.label) };
}

function ChatPanel({ messages, myUserId, onSend }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex min-h-[320px] flex-col rounded-2xl border" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "rgba(255,214,0,0.12)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FFD600]">Чат матча</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3" style={{ maxHeight: 260 }}>
        {messages.length === 0 ? <p className="text-sm text-white/45">Сообщений пока нет.</p> : null}
        {messages.map((message, index) => {
          const mine = isSameUserId(message.user_id, myUserId);

          return (
            <div key={`${message.user_id}-${index}-${message.text}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%] rounded-xl px-3 py-2 text-xs" style={{ background: mine ? "#FFD600" : "rgba(255,255,255,0.06)", color: mine ? "#111" : "#f8fafc" }}>
                <p className="mb-1 text-[10px] font-semibold opacity-80">{mine ? "вы" : message.display_name || message.nickname}</p>
                <p>{message.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t px-3 py-3" style={{ borderColor: "rgba(255,214,0,0.1)" }}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          placeholder="Написать сообщение..."
          className="h-10 flex-1 rounded-xl bg-black px-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
          style={{ border: "1px solid rgba(255,214,0,0.2)" }}
        />
        <button type="submit" className="h-10 rounded-xl px-4 text-sm font-semibold transition-opacity hover:opacity-85" style={{ background: "#FFD600", color: "#111" }}>Отправить</button>
      </form>
    </div>
  );
}

function OpponentIntelPanel({ opponentUserId, online, myUserId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const safeId = opponentUserId != null && !isSameUserId(opponentUserId, myUserId) ? opponentUserId : null;

  useEffect(() => {
    if (!safeId) {
      setProfile(null);
      return undefined;
    }

    let mounted = true;
    setLoading(true);

    apiFetch(`/users/${safeId}/profile`)
      .then((data) => {
        if (mounted) {
          setProfile(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setProfile(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [safeId]);

  const badges = useMemo(() => {
    const role = String(profile?.role ?? "").trim();
    return role ? [{ label: role, tone: "role" }] : [];
  }, [profile?.role]);

  const bannerUrl = resolveAssetUrl(profile?.banner_url || "");
  const avatarUrl = resolveAssetUrl(profile?.avatar_url || "");
  const displayName = profile?.nickname || profile?.display_name || "Unknown";
  const mentionName = profile?.nickname || profile?.display_name || "unknown";

  return (
    <aside className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#FFD600]">Профиль соперника</h3>
        <span className="text-[11px] font-medium" style={{ color: online ? "#4ade80" : "rgba(255,255,255,0.45)" }}>{online ? "онлайн" : "оффлайн"}</span>
      </div>
      {!opponentUserId ? <p className="text-sm text-white/50">Ожидаем профиль соперника...</p>
        : loading ? <p className="text-sm text-white/50">Загружаем профиль...</p>
        : !profile ? <p className="text-sm text-white/50">Профиль недоступен.</p>
        : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="relative h-24">
                {bannerUrl ? <img src={bannerUrl} alt="Баннер" className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ background: "linear-gradient(135deg, rgba(25,38,66,1) 0%, rgba(10,15,25,1) 100%)" }} />}
              </div>
              <div className="px-4 pb-4">
                <div className="-mt-7 flex items-end gap-3">
                  <div className="relative h-16 w-16 shrink-0 rounded-full border-[3px] border-[#111] bg-slate-800">
                    {avatarUrl ? <img src={avatarUrl} alt="Аватар" className="h-full w-full rounded-full object-cover" /> : <div className="flex h-full w-full items-center justify-center rounded-full text-xl font-bold text-[#FFD600]">{displayName[0]?.toUpperCase() || "?"}</div>}
                    <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#111]" style={{ background: online ? "#22c55e" : "#6b7280", boxShadow: online ? "0 0 10px rgba(34,197,94,0.8)" : "none" }} />
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="truncate text-base font-semibold text-white">{displayName}</p>
                    <p className="truncate text-xs text-white/60">@{mentionName}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                  <span>PTS {profile.pts ?? 0}</span>
                  <span style={{ color: online ? "#4ade80" : "rgba(255,255,255,0.5)" }}>{online ? "онлайн" : "оффлайн"}</span>
                </div>
                {profile.bio ? <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-white/75">{profile.bio}</p> : null}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wider text-white/50">Роль</p>
              <div className="flex flex-wrap gap-2">
                {badges.length > 0 ? badges.map((badge, index) => {
                  const view = getBadgePresentation(badge);
                  return (
                    <span key={`${badge.label}-${index}`} className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium backdrop-blur-sm" style={{ borderColor: view.border, background: `linear-gradient(180deg, rgba(255,255,255,0.08) 0%, ${view.bg} 100%)`, color: view.text, boxShadow: `0 6px 14px ${view.shadow}` }}>
                      <span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border text-[10px] font-semibold" style={{ borderColor: view.border, color: view.text, background: "rgba(0,0,0,0.28)" }}>{view.icon}</span>
                      <span className="leading-none">{badge.label}</span>
                    </span>
                  );
                }) : <span className="text-xs text-white/50">Роль не указана</span>}
              </div>
            </div>
          </div>
        )}
    </aside>
  );
}

export function MatchArena({ activeMatch, myUserId, onNavigateTask, onSurrender, surrendering }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const [secondsRemaining, setSecondsRemaining] = useState(activeMatch?.seconds_remaining ?? null);
  const [showChat, setShowChat] = useState(false);
  const [roomSocketOpen, setRoomSocketOpen] = useState(false);
  const [readiness, setReadiness] = useState({ participants: [], all_ready: false });
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const hostUserId = useMemo(
    () => resolveHostUserId({ participants, activeMatch, myUserId }),
    [activeMatch, myUserId, participants],
  );

  const {
    gameState,
    currentQuestion,
    roundIndex,
    myScore,
    opponentScore,
    myAnswer,
    opponentAnswered,
    roundResult,
    timeLeft,
    countdown,
    totalRounds,
    canAdvanceRound,
    canPlayAgain,
    startGame,
    submitAnswer,
    nextRound,
    handleGameEvent,
  } = useGameEngine({
    wsRef,
    myUserId,
    hostUserId,
  });
  const handleGameEventRef = useRef(handleGameEvent);
  const startGameRef = useRef(startGame);
  const canStartCurrentMatchRef = useRef(false);

  useEffect(() => {
    handleGameEventRef.current = handleGameEvent;
  }, [handleGameEvent]);

  useEffect(() => {
    startGameRef.current = startGame;
  }, [startGame]);

  useEffect(() => {
    if (activeMatch?.seconds_remaining != null) {
      setSecondsRemaining(activeMatch.seconds_remaining);
      return undefined;
    }

    if (!activeMatch?.ends_at) {
      setSecondsRemaining(null);
      return undefined;
    }

    const deadline = new Date(activeMatch.ends_at).getTime();
    const tick = () => setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const timerId = setInterval(tick, 1000);

    return () => clearInterval(timerId);
  }, [activeMatch?.ends_at, activeMatch?.seconds_remaining]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const clearReconnectTimer = () => {
      if (reconnectTimeoutRef.current != null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    if (!token || !activeMatch?.match_id) {
      clearReconnectTimer();
      reconnectAttemptRef.current = 0;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setRoomSocketOpen(false);
      return undefined;
    }

    let disposed = false;

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }

      clearReconnectTimer();
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, getRoomSocketReconnectDelayMs(reconnectAttemptRef.current));
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      if (
        wsRef.current
        && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const ws = new WebSocket(getMatchRoomSocketUrl(activeMatch.match_id, token));
      let disconnectHandled = false;
      wsRef.current = ws;

      const handleDisconnect = () => {
        if (disconnectHandled || wsRef.current !== ws) {
          return;
        }

        disconnectHandled = true;
        wsRef.current = null;
        setRoomSocketOpen(false);
        scheduleReconnect();
      };

      ws.addEventListener("open", () => {
        if (disposed || wsRef.current !== ws) {
          ws.close();
          return;
        }

        reconnectAttemptRef.current = 0;
        clearReconnectTimer();
        setRoomSocketOpen(true);
      });

      ws.addEventListener("message", (event) => {
        const payload = JSON.parse(event.data);
        const data = payload.data ?? {};

        if (GAME_EVENT_NAMES.has(payload.event)) {
          if (shouldHandleIncomingGameEvent({ eventName: payload.event, envelopeData: data, gameData: data, myUserId })) {
            handleGameEventRef.current(payload.event, data);
          }
          return;
        }

        if (payload.event === "room_state") {
          setParticipants(data.participants ?? []);
          setOnlineIds(data.online ?? []);
          setReadiness(data.readiness ?? { participants: [], all_ready: false });
        }

        if (payload.event === "user_joined" || payload.event === "user_left") {
          setOnlineIds(data.online ?? []);
        }

        if (payload.event === "readiness_update") {
          setReadiness(data);
        }

        if (payload.event === "match_start") {
          if (canStartCurrentMatchRef.current) {
            startGameRef.current();
          }
          return;
        }

        if (payload.event === "chat") {
          const text = String(data.text ?? "").trim();

          if (!text) {
            return;
          }

          if (text.startsWith("__GAME__:")) {
            try {
              const { event: gameEvent, data: gameData } = JSON.parse(text.slice(9));
              if (GAME_EVENT_NAMES.has(gameEvent) && shouldHandleIncomingGameEvent({ eventName: gameEvent, envelopeData: data, gameData, myUserId })) {
                handleGameEventRef.current(gameEvent, gameData);
              }
            } catch (error) {
              logDevError("Failed to parse game event from chat payload.", error);
            }
            return;
          }

          setMessages((prev) => [...prev, { ...data, text }]);
        }
      });

      ws.addEventListener("close", handleDisconnect);
      ws.addEventListener("error", (error) => {
        logDevError("Room websocket error.", error);
        setRoomSocketOpen(false);
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
          ws.close();
          return;
        }
        handleDisconnect();
      });
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      reconnectAttemptRef.current = 0;
      if (wsRef.current) {
        wsRef.current.close();
      }
      wsRef.current = null;
      setRoomSocketOpen(false);
    };
  }, [activeMatch?.match_id, myUserId]);

  const opponentFromParticipants = useMemo(
    () => getOpponentFromParticipants(participants, myUserId),
    [participants, myUserId],
  );

  const opponentFromMatch = useMemo(() => {
    if (!activeMatch) {
      return null;
    }

    if (activeMatch.opponent?.user_id != null && !isSameUserId(activeMatch.opponent.user_id, myUserId)) {
      return activeMatch.opponent;
    }

    if (Array.isArray(activeMatch.participants)) {
      return activeMatch.participants.find((participant) => !isSameUserId(participant?.user_id, myUserId)) ?? null;
    }

    return null;
  }, [activeMatch, myUserId]);

  const opponent = opponentFromParticipants ?? opponentFromMatch ?? null;
  const { canStartGame: canStartCurrentMatch, opponentOnline } = useMemo(
    () => resolveStartControlState({
      myUserId,
      hostUserId,
      opponentUserId: opponent?.user_id ?? null,
      onlineIds,
      roomSocketOpen,
    }),
    [hostUserId, myUserId, onlineIds, opponent?.user_id, roomSocketOpen],
  );
  const myName = participants.find((participant) => isSameUserId(participant?.user_id, myUserId))?.nickname ?? "Вы";
  const opponentName = opponent?.nickname ?? opponent?.display_name ?? "Соперник";

  const readinessState = useMemo(
    () => resolveReadinessState({
      myUserId,
      opponentUserId: opponent?.user_id ?? null,
      readiness,
      roomSocketOpen,
    }),
    [myUserId, opponent?.user_id, readiness, roomSocketOpen],
  );

  const sendReadyToggle = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const ready = !readinessState.myReady;
    setReadiness((prev) => updateReadinessParticipant(prev, myUserId, ready));
    wsRef.current.send(JSON.stringify({ event: "ready_toggle", ready }));
  }, [myUserId, readinessState.myReady]);

  useEffect(() => {
    canStartCurrentMatchRef.current = canStartCurrentMatch;
  }, [canStartCurrentMatch]);

  useEffect(() => {
    if (gameState !== "countdown" || readinessState.allReady) {
      return;
    }

    handleGameEvent("game_start_cancelled", { senderUserId: "readiness" });
  }, [gameState, handleGameEvent, readinessState.allReady]);

  function sendChatMessage(text) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({ event: "chat", text }));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,214,0,0.2)", background: "#111" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#FFD600]">⚔️ PvP Дуэль 1v1</h2>
            <p className="text-sm text-white/55">
              До конца матча:{" "}
              <span className="font-mono text-white">{formatCountdown(secondsRemaining)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowChat((value) => !value)}
              className="rounded-xl border px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
              style={{ borderColor: "rgba(255,214,0,0.2)", background: "transparent" }}
            >
              {showChat ? "🎮 Игра" : "💬 Чат"}
            </button>
            <button
              type="button"
              onClick={() => onNavigateTask(activeMatch.task_id)}
              className="rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
              style={{ background: "rgba(255,214,0,0.15)", color: "#FFD600", border: "1px solid rgba(255,214,0,0.3)" }}
            >
              Задача
            </button>
            <button
              type="button"
              onClick={onSurrender}
              disabled={surrendering}
              className="rounded-xl border px-4 py-2 text-sm text-white/50 transition-colors hover:text-white disabled:opacity-40"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "transparent" }}
            >
              Сдаться
            </button>
          </div>
        </div>

        {gameState !== "waiting" ? (
          <div className="mt-4">
            <ScoreBar
              myScore={myScore}
              opponentScore={opponentScore}
              totalRounds={totalRounds}
              myName={myName}
              opponentName={opponentName}
            />
          </div>
        ) : null}
      </div>

      {showChat ? (
        <ChatPanel messages={messages} myUserId={myUserId} onSend={sendChatMessage} />
      ) : (
        <div className="min-h-[360px] rounded-2xl border p-5" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
          <GameStageView
            gameState={gameState}
            currentQuestion={currentQuestion}
            roundIndex={roundIndex}
            totalRounds={totalRounds}
            myAnswer={myAnswer}
            opponentAnswered={opponentAnswered}
            roundResult={roundResult}
            timeLeft={timeLeft}
            countdown={countdown}
            myScore={myScore}
            opponentScore={opponentScore}
            opponentName={opponentName !== "Соперник" ? opponentName : null}
            onAnswer={submitAnswer}
            onNextRound={nextRound}
            onPlayAgain={startGame}
            onSurrender={onSurrender}
            canAdvanceRound={canAdvanceRound}
            canPlayAgain={canPlayAgain}
            readinessState={readinessState}
            onToggleReady={sendReadyToggle}
          />
        </div>
      )}

      <OpponentIntelPanel opponentUserId={opponent?.user_id ?? null} online={opponentOnline} myUserId={myUserId} />
    </div>
  );
}

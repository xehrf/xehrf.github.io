import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, getWebSocketBaseUrl } from "../../api/client.js";

/**
 * Shared matchmaking queue hook used by every mode that talks to the
 * /matchmaking endpoints (currently Duel 1v1 and Code Race).
 *
 * What it owns:
 *  - active match, last-match result, opponent snapshot
 *  - queue info (size + position) + the "searching" boolean
 *  - the matchmaking WebSocket *and* a polling fallback for environments
 *    where the WS dies silently (Render free tier)
 *  - findMatch / leaveQueue / handleRematch / restoreActive helpers
 *
 * What the mode component still has to do itself:
 *  - render the matched / pre-match / post-match UI
 *  - surrender, quests, mode-specific banners, etc.
 *
 * Pass a `mode` ID so the backend can segment queues (Code Race players
 * shouldn't be paired against Quiz Duel players).
 */

const PARTY_SIZE = 2;

function logDevError(scope, error) {
  if (import.meta.env.DEV) {
    console.error(`[useMatchQueue] ${scope}`, error);
  }
}

function getMatchmakingSocketUrl(token) {
  return `${getWebSocketBaseUrl()}/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function normalizeUserId(userId) {
  return userId == null ? null : String(userId);
}

function isSameUserId(left, right) {
  const normalizedLeft = normalizeUserId(left);
  return normalizedLeft !== null && normalizedLeft === normalizeUserId(right);
}

export function useMatchQueue({ user, mode = "duel-1v1" }) {
  const myUserId = user?.id ?? null;

  const [activeMatch, setActiveMatch] = useState(null);
  const activeMatchRef = useRef(null);
  const [opponentSnapshot, setOpponentSnapshot] = useState(null);
  const [queueInfo, setQueueInfo] = useState({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
  const [searching, setSearching] = useState(false);
  const [lastMatchResult, setLastMatchResult] = useState(null);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");

  useEffect(() => {
    activeMatchRef.current = activeMatch;
  }, [activeMatch]);

  const queueState = useMemo(() => {
    if (activeMatch) return "matched";
    if (searching) return "searching";
    return "idle";
  }, [activeMatch, searching]);

  // Restore active match on mount (covers reload-mid-game).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await apiFetch("/matchmaking/active");
        if (!mounted) return;
        if (current) {
          setActiveMatch(current);
          setSearching(false);
          setStatusNote("Активный матч восстановлен.");
        }
      } catch (e) {
        logDevError("Failed to restore active match.", e);
      }
    })();
    return () => { mounted = false; };
  }, [myUserId]);

  // WS with auto-reconnect (Render free tier kills idle sockets after ~60s).
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return undefined;

    let disposed = false;
    let ws = null;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    const handleMessage = (event) => {
      const payload = JSON.parse(event.data);
      const data = payload.data ?? {};

      if (payload.event === "queue_update") {
        // Only react to queue events that belong to *our* mode so a player
        // sitting in Code Race doesn't get confused by stale Duel state.
        if (data.mode && data.mode !== mode) return;
        setQueueInfo({
          queue_size: data.queue_size ?? 0,
          queue_position: data.queue_position ?? null,
          total: data.total ?? PARTY_SIZE,
        });
        setSearching(data.status === "queued");
        if (data.status === "queued") setStatusNote("Ищем соперника с близким PTS...");
      }

      if (payload.event === "match_found" || payload.event === "active_match") {
        // Same mode-filter — a player in Code Race shouldn't receive a Duel
        // match-found event meant for the same user from a different tab.
        if (data.mode && data.mode !== mode) return;
        setActiveMatch((prev) => ({ ...(prev ?? {}), ...data }));
        setLastMatchResult(null);
        setOpponentSnapshot(null);
        setSearching(false);
        setStatusNote("Соперник найден.");
        apiFetch("/matchmaking/active")
          .then((current) => { if (current) setActiveMatch(current); })
          .catch((e) => logDevError("Failed to refresh active match after WS update.", e));
      }

      if (payload.event === "match_finished") {
        const cur = activeMatchRef.current;
        const opp = cur?.opponent ?? cur?.participants?.find((p) => !isSameUserId(p?.user_id, myUserId)) ?? null;
        setOpponentSnapshot(opp);
        setLastMatchResult(data);
        setActiveMatch(null);
        setSearching(false);
        setRematchLoading(false);
        setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
        const iWon = isSameUserId(data.winner_user_id, myUserId);
        const reason = data.reason ?? "";
        if (iWon) {
          setStatusNote(reason === "surrender" ? "Соперник сдался. Победа!" : "Победа в матче!");
        } else if (!data.winner_user_id) {
          setStatusNote("Ничья.");
        } else {
          setStatusNote(reason === "surrender" ? "Вы сдались." : "Поражение. Попробуй ещё раз.");
        }
      }

      if (payload.event === "rematch_offered") {
        setLastMatchResult((prev) => ({ ...(prev ?? {}), match_id: data.match_id }));
        setStatusNote("Соперник предлагает реванш.");
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      reconnectAttempt += 1;
      const delay = Math.min(1000 * 2 ** Math.max(0, reconnectAttempt - 1), 10_000);
      reconnectTimer = window.setTimeout(connect, delay);
    };

    function connect() {
      if (disposed) return;
      try {
        ws = new WebSocket(getMatchmakingSocketUrl(token));
      } catch (e) {
        logDevError("Failed to construct matchmaking WS.", e);
        scheduleReconnect();
        return;
      }
      ws.addEventListener("open", () => { reconnectAttempt = 0; });
      ws.addEventListener("message", handleMessage);
      ws.addEventListener("close", () => { if (!disposed) scheduleReconnect(); });
      ws.addEventListener("error", () => logDevError("Matchmaking WS error.", null));
    }

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [mode, myUserId]);

  // Polling fallback while searching — covers cases where the WS missed
  // match_found (e.g. it was killed by Render right as the event was sent).
  useEffect(() => {
    if (!searching || activeMatch) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const current = await apiFetch("/matchmaking/active");
        if (cancelled) return;
        if (current && current.match_id) {
          setActiveMatch(current);
          setSearching(false);
          setStatusNote("Соперник найден.");
        }
      } catch (e) {
        logDevError("Polling /matchmaking/active failed.", e);
      }
    };
    const interval = window.setInterval(tick, 3500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [searching, activeMatch]);

  const findMatch = useCallback(async () => {
    if (searching) return;
    setError("");
    setSearching(true);
    setStatusNote("Подключаем к очереди...");
    try {
      const result = await apiFetch("/matchmaking/queue", { method: "POST", body: { mode } });
      if (result.status === "matched" || result.status === "already_in_match") {
        setActiveMatch(result);
        setSearching(false);
        setStatusNote("Матч найден.");
        return;
      }
      if (result.status === "queued") {
        setQueueInfo({
          queue_size: result.queue_size ?? 1,
          queue_position: result.queue_position ?? null,
          total: PARTY_SIZE,
        });
        setStatusNote("В очереди. Ожидаем соперника...");
        return;
      }
      setError(result.message || "Ошибка матчмейкинга.");
      setSearching(false);
    } catch (e) {
      setError(e?.message || "Ошибка матчмейкинга.");
      setSearching(false);
    }
  }, [mode, searching]);

  const leaveQueue = useCallback(async () => {
    setError("");
    try {
      await apiFetch("/matchmaking/queue", { method: "DELETE" });
    } catch (e) {
      logDevError("Failed to leave queue.", e);
    }
    setSearching(false);
    setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
    setStatusNote("Поиск отменён.");
  }, []);

  const handleRematch = useCallback(async () => {
    if (!lastMatchResult?.match_id || rematchLoading) return;
    setRematchLoading(true);
    setError("");
    try {
      const result = await apiFetch("/matchmaking/rematch", {
        method: "POST",
        body: { match_id: lastMatchResult.match_id },
      });
      if (result.status === "matched" || result.status === "already_in_match") {
        setActiveMatch(result);
        setSearching(false);
        setLastMatchResult(null);
        setOpponentSnapshot(null);
        setStatusNote("Реванш начинается!");
        return;
      }
      setStatusNote(
        result.status === "waiting_rematch"
          ? "Реванш предложен. Ждём подтверждение."
          : result.message || "Ожидаем подтверждение реванша."
      );
    } catch (e) {
      setError(e?.message || "Не удалось запустить реванш.");
    } finally {
      setRematchLoading(false);
    }
  }, [lastMatchResult, rematchLoading]);

  const dismissResult = useCallback(() => {
    setLastMatchResult(null);
    setOpponentSnapshot(null);
    setStatusNote("");
  }, []);

  return {
    // state
    activeMatch,
    setActiveMatch,
    opponentSnapshot,
    queueInfo,
    queueState,
    searching,
    lastMatchResult,
    rematchLoading,
    error,
    statusNote,
    // actions
    findMatch,
    leaveQueue,
    handleRematch,
    dismissResult,
    setStatusNote,
    setError,
  };
}

export const MATCH_QUEUE_PARTY_SIZE = PARTY_SIZE;

import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

function getMatchmakingSocketUrl(token) {
  const origin = import.meta.env.VITE_API_URL ?? window.location.origin;
  const wsOrigin = origin.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${wsOrigin}/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) return "—";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MatchmakingPage() {
  const navigate = useNavigate();
  const [activeMatch, setActiveMatch] = useState(null);
  const [queueInfo, setQueueInfo] = useState({ queue_size: 0, queue_position: null });
  const [searching, setSearching] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [statusNote, setStatusNote] = useState("Нажмите кнопку, чтобы встать в очередь.");
  const [error, setError] = useState("");
  const isMobile = useMediaQuery("(max-width: 767px)");

  const state = useMemo(() => {
    if (activeMatch) return "matched";
    if (searching) return "searching";
    return "idle";
  }, [activeMatch, searching]);

  function handleFindMatch() {
    if (state === "searching") return;
    setError("");
    setSearching(true);
    setStatusNote("Ищем соперника с близким PTS...");

    (async () => {
      try {
        const res = await apiFetch("/matchmaking/queue", { method: "POST" });
        if (res.status === "matched") {
          setActiveMatch(res);
          setSearching(false);
          const end = res.ends_at ? new Date(res.ends_at).getTime() : null;
          setSecondsRemaining(end ? Math.max(0, Math.floor((end - Date.now()) / 1000)) : null);
          setStatusNote("Матч найден. Можно переходить к задаче.");
          return;
        }
        if (res.status === "already_in_match") {
          setActiveMatch(res);
          setSearching(false);
          setStatusNote("У вас уже есть активный матч.");
          return;
        }
        if (res.status === "queued") {
          setQueueInfo({
            queue_size: res.queue_size ?? 0,
            queue_position: res.queue_position ?? null,
          });
          setStatusNote("Вы в очереди. Ожидаем соперника...");
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
      } catch {
        // If leave fails, we still reset UI.
      } finally {
        setActiveMatch(null);
        setSearching(false);
        setSecondsRemaining(null);
        setQueueInfo({ queue_size: 0, queue_position: null });
        setStatusNote("Поиск отменен.");
      }
    })();
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await apiFetch("/matchmaking/active");
        if (!mounted) return;
        if (current) {
          setActiveMatch(current);
          setSearching(false);
          const end = current.ends_at ? new Date(current.ends_at).getTime() : null;
          setSecondsRemaining(end ? Math.max(0, Math.floor((end - Date.now()) / 1000)) : null);
        }
      } catch {
        // ignore transient polling errors
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
        });
        const queued = data.status === "queued" && (data.queue_position ?? null) != null;
        setSearching(queued);
        if (queued) {
          setStatusNote("Очередь обновлена.");
        }
      }
      if (payload.event === "active_match" || payload.event === "match_found") {
        const data = payload.data ?? {};
        setActiveMatch((prev) => ({ ...(prev ?? {}), ...data }));
        setSearching(false);
        const end = data.ends_at ? new Date(data.ends_at).getTime() : null;
        setSecondsRemaining(end ? Math.max(0, Math.floor((end - Date.now()) / 1000)) : null);
        setStatusNote("Соперник найден.");
      }
    });

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (!activeMatch?.ends_at) return;
    const deadline = new Date(activeMatch.ends_at).getTime();
    const intervalId = window.setInterval(() => {
      setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeMatch]);

  if (isMobile) return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">PvP матчмейкинг</h1>
        <p className="mt-2 text-sm text-muted">Система подберет соперника с близким PTS и запустит таймер матча</p>
      </div>

      <Card className="mt-10 flex flex-col items-center gap-8 p-8 sm:p-12">
        <div
          className={[
            "flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all duration-500",
            state === "idle" && "border-border bg-elevated",
            state === "searching" && "animate-pulse border-accent/60 bg-accent/5 shadow-glow",
            state === "matched" && "scale-105 border-accent bg-accent/10 shadow-glow",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {state === "searching" && (
            <span className="h-10 w-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          )}
          {state === "matched" && (
            <span className="text-3xl font-black text-accent" aria-hidden>
              ✓
            </span>
          )}
          {state === "idle" && <span className="text-2xl font-bold text-muted">⚔</span>}
        </div>

        <div className="text-center">
          {state === "idle" && (
            <>
              <p className="text-lg font-medium text-foreground">Готов к бою?</p>
              <p className="mt-1 text-sm text-muted">Нажми и встань в очередь</p>
            </>
          )}
          {state === "searching" && (
            <>
              <p className="text-lg font-medium text-accent">Поиск соперника…</p>
              <p className="mt-1 text-sm text-muted">
                В очереди: {queueInfo.queue_size} · Ваша позиция: {queueInfo.queue_position ?? "—"}
              </p>
            </>
          )}
          {state === "matched" && (
            <>
              <p className="text-lg font-medium text-accent">Матч найден</p>
              <p className="mt-1 text-sm text-muted">
                До конца матча: {formatCountdown(secondsRemaining)}
              </p>
              {activeMatch?.opponent ? (
                <p className="mt-2 text-xs text-muted">
                  Соперник: {activeMatch.opponent.nickname || activeMatch.opponent.display_name} · PTS {activeMatch.opponent.pts}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3 sm:flex-row sm:justify-center">
          {state !== "matched" ? (
            <Button
              type="button"
              className="w-full sm:w-auto sm:min-w-[200px] py-3.5 text-base"
              onClick={handleFindMatch}
            >
              Найти матч
            </Button>
          ) : (
            <>
              <Button type="button" className="w-full sm:flex-1 py-3.5" onClick={handleReset}>
                Отменить поиск
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:flex-1 py-3.5"
                onClick={() => navigate(`/tasks/${activeMatch.task_id}/solve`)}
              >
                Открыть задачу
              </Button>
            </>
          )}
        </div>

        <div className="text-xs text-muted">{statusNote}</div>
        {error ? <div className="text-sm text-accent">{error}</div> : null}
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

export function MatchmakingPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [activeMatch, setActiveMatch] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const state = useMemo(() => {
    if (activeMatch) return "matched";
    if (searching) return "searching";
    return "idle";
  }, [activeMatch, searching]);

  function handleFindMatch() {
    if (state === "searching") return;
    setError("");
    setSearching(true);

    (async () => {
      try {
        const res = await apiFetch("/matchmaking/queue", { method: "POST" });
        if (res.status === "matched" && res.task_id && res.match_id) {
          setActiveMatch({
            match_id: res.match_id,
            task_id: res.task_id,
            status: "active",
            started_at: null,
            ends_at: res.ends_at ?? null,
            seconds_remaining: null,
          });
          setSearching(false);
          return;
        }
        // queued -> polling via effect
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
      }
    })();
  }

  useEffect(() => {
    if (!searching || activeMatch) return;

    let mounted = true;
    const id = window.setInterval(async () => {
      try {
        const m = await apiFetch("/matchmaking/active");
        if (!mounted) return;
        if (m) {
          setActiveMatch(m);
          setSearching(false);
        }
      } catch {
        // ignore transient polling errors
      }
    }, 1500);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [activeMatch, searching]);

  if (isMobile) return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Матчмейкинг</h1>
        <p className="mt-2 text-sm text-muted">
          4 игрока с похожим ELO · один таймер · честная раздача PTS
        </p>
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
              <p className="text-lg font-medium text-accent">Поиск соперников…</p>
              <p className="mt-1 text-sm text-muted">Подбираем похожий рейтинг</p>
            </>
          )}
          {state === "matched" && (
            <>
              <p className="text-lg font-medium text-accent">Матч найден</p>
              <p className="mt-1 text-sm text-muted">
                Задание откроется в лобби
                {activeMatch?.seconds_remaining != null ? ` (${activeMatch.seconds_remaining}s)` : ""}
              </p>
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
                В очередь снова
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:flex-1 py-3.5"
                onClick={() => navigate(`/tasks/${activeMatch.task_id}/solve`)}
              >
                В лобби
              </Button>
            </>
          )}
        </div>

        {error ? <div className="text-sm text-accent">{error}</div> : null}
      </Card>
    </div>
  );
}

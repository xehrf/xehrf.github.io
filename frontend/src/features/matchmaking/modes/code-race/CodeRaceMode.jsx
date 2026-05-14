import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { useMatchQueue } from "../../useMatchQueue.js";

/**
 * Code Race 1v1.
 *
 * Reuses `useMatchQueue` for queue+WS lifecycle so all the reconnect/poll
 * fallbacks come for free. Once a match is found, this mode does NOT host
 * its own arena UI — it shows a small "race in progress" panel with a
 * direct link to the editor, plus a banner whenever the match ends.
 *
 * Backend already supports the "first passing submission wins" semantics:
 * /submissions immediately calls `complete_match_with_winner` after a
 * pass inside an active match, and broadcasts match_finished to both
 * players via the same WS we listen on here.
 */

function formatCountdown(seconds) {
  if (seconds == null || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useEndsAtCountdown(activeMatch) {
  const [remaining, setRemaining] = useState(activeMatch?.seconds_remaining ?? null);
  useEffect(() => {
    if (!activeMatch?.ends_at) {
      setRemaining(activeMatch?.seconds_remaining ?? null);
      return undefined;
    }
    const deadline = new Date(activeMatch.ends_at).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeMatch?.ends_at, activeMatch?.seconds_remaining]);
  return remaining;
}

function StartingGate({ statusNote, searching, error, onFind, onLeave, queueInfo }) {
  return (
    <Card className="relative overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute right-4 top-4 text-7xl opacity-[0.04]">🏁</div>
      </div>
      <div className="relative">
        <div className="text-5xl">🏁</div>
        <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
          {searching ? "Ищем соперника..." : "Готов гнать?"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {statusNote || "Открывается одна задача. Первый, кто пройдёт все тесты, заберёт PTS."}
        </p>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2 text-xs text-muted">
          <div className="rounded-btn border border-border bg-elevated/50 px-2 py-2">
            <div className="font-mono text-lg font-bold text-accent">1v1</div>
            <div className="text-[10px] uppercase tracking-wider">формат</div>
          </div>
          <div className="rounded-btn border border-border bg-elevated/50 px-2 py-2">
            <div className="font-mono text-lg font-bold text-accent">{queueInfo?.queue_size ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider">в очереди</div>
          </div>
          <div className="rounded-btn border border-border bg-elevated/50 px-2 py-2">
            <div className="font-mono text-lg font-bold text-accent">first</div>
            <div className="text-[10px] uppercase tracking-wider">to pass</div>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-md">
          {searching ? (
            <button
              type="button"
              onClick={onLeave}
              className="inline-flex h-14 w-full items-center justify-center rounded-btn border border-border bg-elevated text-base font-medium text-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              ✕ Отменить поиск
            </button>
          ) : (
            <button
              type="button"
              onClick={onFind}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-btn bg-accent text-base font-bold text-black shadow-glow transition-all hover:bg-accent-hover hover:shadow-[0_0_32px_rgba(255,215,0,0.4)] active:scale-[0.99]"
            >
              🏁 Найти соперника
            </button>
          )}
        </div>

        {error ? (
          <div className="mx-auto mt-4 max-w-md rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function InRace({ activeMatch, onOpenTask }) {
  const remaining = useEndsAtCountdown(activeMatch);
  const opponent = activeMatch?.opponent ?? null;
  const opponentName = opponent?.nickname || opponent?.display_name || "Соперник";
  const timerCritical = remaining != null && remaining > 0 && remaining <= 30;

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Гонка в процессе
        </div>
        <h2 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
          🏁 Соперник найден
        </h2>
        <p className="mt-2 text-sm text-muted">
          Против тебя: <span className="font-semibold text-foreground">{opponentName}</span>
          {opponent?.pts != null ? <> · {opponent.pts} PTS</> : null}
        </p>

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-wider text-muted">До конца матча</p>
          <p
            className={`mt-1 font-mono text-5xl font-bold tabular-nums ${
              timerCritical ? "animate-pulse text-red-400" : "text-accent"
            }`}
          >
            {formatCountdown(remaining)}
          </p>
        </div>

        <Button onClick={onOpenTask} className="mt-6 min-w-[220px]">
          📋 Открыть редактор задачи →
        </Button>

        <p className="mt-4 max-w-md text-xs leading-snug text-muted">
          Первый, чьё решение пройдёт все тесты — забирает матч. Можно сдаться из редактора.
        </p>
      </div>
    </Card>
  );
}

function RaceResult({ result, myUserId, onRace, onDismiss, rematchLoading, onRematch }) {
  const iWon = result?.winner_user_id != null && String(result.winner_user_id) === String(myUserId);
  const isDraw = !result?.winner_user_id;
  const delta = iWon
    ? Number(result?.winner_pts_delta ?? 0)
    : isDraw
      ? 0
      : Number(result?.loser_pts_delta ?? 0);

  return (
    <Card
      className="p-8 text-center"
      style={{
        borderColor: iWon ? "rgba(255,214,0,0.4)" : isDraw ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.3)",
        background: iWon ? "rgba(255,214,0,0.07)" : isDraw ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.05)",
      }}
    >
      <div className="text-5xl">{iWon ? "🏆" : isDraw ? "🤝" : "💀"}</div>
      <h2
        className="mt-3 text-3xl font-bold"
        style={{ color: iWon ? "#FFD600" : isDraw ? "#E6EDF3" : "#f87171" }}
      >
        {iWon ? "ПОБЕДА" : isDraw ? "НИЧЬЯ" : "ПОРАЖЕНИЕ"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {result?.reason === "first_to_pass"
          ? iWon ? "Ты прошёл тесты первым" : "Соперник прошёл тесты первым"
          : result?.reason === "surrender"
            ? iWon ? "Соперник сдался" : "Вы сдались"
            : "Время вышло"}
      </p>
      <p className="mt-6 font-mono text-4xl font-bold" style={{ color: delta >= 0 ? "#22c55e" : "#f87171" }}>
        {delta >= 0 ? "+" : ""}{delta} PTS
      </p>

      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row">
        {result?.match_id ? (
          <Button onClick={onRematch} disabled={rematchLoading} className="flex-1">
            {rematchLoading ? "Запускаем..." : "⚡ Реванш"}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onRace} className="flex-1">🏁 Новая гонка</Button>
        <Button variant="ghost" onClick={onDismiss} className="flex-1">К режимам</Button>
      </div>
    </Card>
  );
}

export function CodeRaceMode({ user }) {
  const navigate = useNavigate();
  const queue = useMatchQueue({ user, mode: "code-race" });
  const {
    activeMatch,
    queueInfo,
    queueState,
    searching,
    lastMatchResult,
    rematchLoading,
    error,
    statusNote,
    findMatch,
    leaveQueue,
    handleRematch,
    dismissResult,
  } = queue;

  function openTask() {
    if (!activeMatch?.task_id) return;
    navigate(`/tasks/${activeMatch.task_id}/solve?match=${activeMatch.match_id}`);
  }

  if (queueState === "matched") {
    return <InRace activeMatch={activeMatch} onOpenTask={openTask} />;
  }

  if (lastMatchResult) {
    return (
      <RaceResult
        result={lastMatchResult}
        myUserId={user?.id ?? null}
        onRace={() => {
          dismissResult();
          findMatch();
        }}
        onDismiss={dismissResult}
        onRematch={handleRematch}
        rematchLoading={rematchLoading}
      />
    );
  }

  return (
    <StartingGate
      statusNote={statusNote}
      searching={searching}
      error={error}
      onFind={findMatch}
      onLeave={leaveQueue}
      queueInfo={queueInfo}
    />
  );
}

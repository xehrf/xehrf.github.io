import { useEffect, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { useMatchQueue } from "../../useMatchQueue.js";
import { CodeRaceArena } from "./CodeRaceArena.jsx";

/**
 * Code Race 1v1.
 *
 * Three rendered phases, picked from the shared `useMatchQueue` hook's
 * `queueState` plus `lastMatchResult`:
 *
 *   StartingGate — idle / searching. Hero "Найти соперника" button.
 *   CodeRaceArena — matched. Full inline editor split-view. The arena also
 *     consumes the `match_finished` event (via parent state) to show the
 *     finish overlay so the player never has to refresh or guess who won.
 *   RaceResult — after the arena overlay is dismissed. Compact card with
 *     "Реванш / Новая гонка / К режимам" actions.
 */

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
          {statusNote || "Одна задача на двоих. Кто первым пройдёт все тесты — забирает PTS."}
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
            <div className="font-mono text-lg font-bold text-accent">10</div>
            <div className="text-[10px] uppercase tracking-wider">мин на матч</div>
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

        <div className="mx-auto mt-6 max-w-md rounded-btn border border-border/60 bg-elevated/30 px-4 py-3 text-left text-xs text-muted">
          <p className="mb-1 font-semibold uppercase tracking-wider text-accent">Правила</p>
          <p>• Задача появится после нахождения соперника.</p>
          <p>• Жми «Запустить тесты» — на каждом проходе матч мгновенно завершается победой.</p>
          <p>• Истёк таймер без победителя — ничья.</p>
        </div>
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
      <p
        className="mt-6 font-mono text-4xl font-bold"
        style={{ color: delta > 0 ? "#22c55e" : delta < 0 ? "#f87171" : "#9ca3af" }}
      >
        {delta > 0 ? "+" : ""}{delta} PTS
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

  // Track whether the user has acknowledged the in-arena finish overlay.
  // While `overlayAcked` is false and we have a fresh result, the arena
  // stays mounted on screen with the overlay on top — preserves context
  // (you see your last code + the winner card). After the user clicks
  // "Закрыть", we transition to the compact RaceResult screen.
  const [overlayAcked, setOverlayAcked] = useState(false);
  const lastMatchRef = useRef(null);

  // Snapshot the active match the moment the WS event nulls it out, so we
  // can keep the arena rendered for the overlay phase. Without this, the
  // arena would unmount as soon as `activeMatch` flips to null.
  if (activeMatch && lastMatchRef.current !== activeMatch) {
    lastMatchRef.current = activeMatch;
  }

  // New result arrived → reset the ack so the overlay re-appears.
  useEffect(() => {
    if (lastMatchResult) setOverlayAcked(false);
  }, [lastMatchResult?.match_id]);

  // Active match in progress.
  if (queueState === "matched") {
    return <CodeRaceArena activeMatch={activeMatch} myUserId={user?.id ?? null} finishedResult={null} />;
  }

  // Match just ended and overlay hasn't been dismissed → keep the arena
  // visible (read-only) with the finish overlay layered on top.
  if (lastMatchResult && !overlayAcked && lastMatchRef.current) {
    return (
      <CodeRaceArena
        activeMatch={lastMatchRef.current}
        myUserId={user?.id ?? null}
        finishedResult={lastMatchResult}
        onAfterClose={() => setOverlayAcked(true)}
      />
    );
  }

  // Overlay acknowledged → compact result card with rematch / new race / exit.
  if (lastMatchResult) {
    return (
      <RaceResult
        result={lastMatchResult}
        myUserId={user?.id ?? null}
        onRace={() => {
          lastMatchRef.current = null;
          setOverlayAcked(false);
          dismissResult();
          findMatch();
        }}
        onDismiss={() => {
          lastMatchRef.current = null;
          setOverlayAcked(false);
          dismissResult();
        }}
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

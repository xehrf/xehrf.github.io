import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, resolveAssetUrl } from "../../../../api/client.js";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { PlayerHoverCard } from "../../../../components/ui/PlayerHoverCard.jsx";

/**
 * Full-screen Code Race arena.
 *
 * Renders directly inside MatchmakingPage (no navigation to TaskSolvePage)
 * so the player keeps the match context: timer, opponent, finish overlay.
 *
 * Layout:
 *   Top bar      — match status pill, big monospace timer, surrender button
 *   Left column  — task title, description, starter code reference
 *   Right column — code editor (textarea) + run-tests button + result list
 *
 * Lifecycle:
 *   - On mount, fetches GET /tasks/<task_id> to render the description.
 *     (Match.task_id was returned by /matchmaking/active or match_found.)
 *   - Submitting POSTS /submissions with match_id. The backend immediately
 *     finalizes the match if the submission passes, broadcasts
 *     `match_finished` via WS — caught by useMatchQueue in the parent.
 *   - When `finishedResult` is supplied (from the parent), we lock the
 *     editor and show a victory/defeat overlay.
 */

function formatCountdown(seconds) {
  if (seconds == null || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useEndsAtCountdown(endsAtIso, secondsRemainingHint) {
  const [remaining, setRemaining] = useState(secondsRemainingHint ?? null);
  useEffect(() => {
    if (!endsAtIso) {
      setRemaining(secondsRemainingHint ?? null);
      return undefined;
    }
    const deadline = new Date(endsAtIso).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAtIso, secondsRemainingHint]);
  return remaining;
}

function TaskBriefCard({ task, opponent, timerEl }) {
  const opponentName = opponent?.nickname || opponent?.display_name || "Соперник";
  const opponentPts = opponent?.pts ?? null;
  const opponentAvatar = resolveAssetUrl(opponent?.avatar_url || "");
  return (
    <Card className="flex h-full flex-col p-5">
      {/* Mobile-only: timer up top because the right column is below */}
      <div className="-mt-1 mb-3 flex items-center justify-between lg:hidden">
        <span className="text-[10px] uppercase tracking-wider text-muted">Таймер</span>
        {timerEl}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            🏁 Code Race
          </span>
          {task ? (
            <h2 className="mt-3 text-xl font-bold text-foreground sm:text-2xl">
              {task.title}
            </h2>
          ) : (
            <div className="mt-3 h-6 w-48 animate-pulse rounded bg-elevated" />
          )}
        </div>
      </div>

      {/* Opponent slim card — clickable for the mini-profile popup */}
      <PlayerHoverCard userId={opponent?.user_id} disabled={!opponent?.user_id}>
        <div className="mt-3 flex cursor-pointer items-center gap-3 rounded-btn border border-border/60 bg-elevated/40 px-3 py-2 transition-colors hover:border-accent/40">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-elevated">
            {opponentAvatar ? (
              <img src={opponentAvatar} alt={opponentName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent/15 text-sm font-bold text-accent">
                {(opponentName[0] || "?").toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{opponentName}</p>
            {opponentPts != null ? (
              <p className="text-[11px] text-muted">{opponentPts} PTS · клик для профиля</p>
            ) : (
              <p className="text-[11px] text-muted">клик для профиля</p>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent">VS</span>
        </div>
      </PlayerHoverCard>

      <div className="mt-4 flex-1 overflow-auto rounded-btn border border-border/60 bg-elevated/30 p-4 text-sm leading-relaxed text-foreground">
        {task ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Задача</p>
            <p className="mt-1.5 whitespace-pre-wrap">{task.description}</p>
            {task.tests_json?.function_name ? (
              <p className="mt-3 text-[11px] text-muted">
                Сигнатура:{" "}
                <code className="rounded bg-canvas px-1 py-0.5 font-mono text-accent">
                  def {task.tests_json.function_name}(...)
                </code>
              </p>
            ) : null}
            <p className="mt-3 text-[11px] uppercase tracking-wider text-muted">Сложность</p>
            <p className="mt-1 font-mono text-accent">{"★".repeat(task.difficulty || 1)}</p>
          </>
        ) : (
          <p className="text-muted">Загружаем задачу...</p>
        )}
      </div>
    </Card>
  );
}

function CodeEditorCard({
  code,
  onCodeChange,
  onRun,
  submitting,
  disabled,
  lastResult,
  timerEl,
}) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="-mt-1 mb-3 hidden items-center justify-between lg:flex">
        <span className="text-[10px] uppercase tracking-wider text-muted">До конца</span>
        {timerEl}
      </div>

      <label htmlFor="code-race-code" className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        Код решения
      </label>
      <textarea
        id="code-race-code"
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        disabled={disabled}
        spellCheck="false"
        wrap="off"
        className="mt-2 min-h-[260px] flex-1 resize-y rounded-btn border border-border bg-canvas px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="# напиши решение здесь"
      />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={onRun}
          disabled={submitting || disabled}
          className="h-12 flex-1 text-base"
        >
          {submitting ? "⚙ Прогоняем тесты..." : "🏁 Запустить тесты"}
        </Button>
      </div>

      {lastResult ? <TestResultRow result={lastResult} /> : null}
    </Card>
  );
}

function TestResultRow({ result }) {
  const passed = result?.verdict === "correct";
  return (
    <div
      className={`mt-3 rounded-btn border px-3 py-2.5 text-sm ${
        passed
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-red-500/40 bg-red-500/10 text-red-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold">
          {passed ? "✓ Все тесты пройдены" : "✗ Тесты не пройдены"}
        </span>
        {result?.passed_tests != null && result?.total_tests != null ? (
          <span className="font-mono text-xs">
            {result.passed_tests}/{result.total_tests}
          </span>
        ) : null}
      </div>
      {result?.message ? (
        <p className="mt-1 text-xs leading-snug opacity-90">{result.message}</p>
      ) : null}
    </div>
  );
}

function FinishOverlay({ result, myUserId, opponent, onClose }) {
  const winnerId = result?.winner_user_id ?? null;
  const iWon = winnerId != null && String(winnerId) === String(myUserId);
  const isDraw = winnerId == null;
  const delta = iWon
    ? Number(result?.winner_pts_delta ?? 0)
    : isDraw
      ? 0
      : Number(result?.loser_pts_delta ?? 0);

  const headline = iWon ? "ПОБЕДА" : isDraw ? "НИЧЬЯ" : "ПОРАЖЕНИЕ";
  const emoji = iWon ? "🏆" : isDraw ? "🤝" : "💀";
  const headlineColor = iWon ? "text-accent" : isDraw ? "text-foreground" : "text-red-300";

  const reasonText =
    result?.reason === "first_to_pass"
      ? iWon
        ? "Ты прошёл все тесты первым"
        : `${opponent?.nickname || opponent?.display_name || "Соперник"} закрыл задачу раньше`
      : result?.reason === "surrender"
        ? iWon ? "Соперник сдался" : "Вы сдались"
        : "Время вышло";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-md animate-fade-in">
      <Card
        className={`w-full max-w-md p-8 text-center ${iWon ? "border-accent/60" : ""}`}
        style={iWon ? { boxShadow: "0 0 64px rgba(255,215,0,0.25)" } : {}}
      >
        <div className="text-7xl">{emoji}</div>
        <h2
          className={`mt-3 text-4xl font-bold tracking-tight ${headlineColor}`}
          style={iWon ? { textShadow: "0 0 32px rgba(255,215,0,0.5)" } : undefined}
        >
          {headline}
        </h2>
        <p className="mt-2 text-sm text-muted">{reasonText}</p>

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-wider text-muted">Изменение PTS</p>
          <p
            className="mt-1 font-mono text-5xl font-bold"
            style={{ color: delta > 0 ? "#22c55e" : delta < 0 ? "#f87171" : "#9ca3af" }}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </p>
        </div>

        <Button onClick={onClose} className="mt-6 min-w-[200px]">
          Закрыть
        </Button>
      </Card>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

function SurrenderModal({ open, loading, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/85 px-4 py-8 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
          Подтверждение
        </p>
        <h2 className="mt-2 text-xl font-bold text-foreground">Сдаться?</h2>
        <p className="mt-2 text-sm text-muted">
          Матч завершится поражением, PTS уменьшатся.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Назад в код
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-btn bg-red-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Сдаёмся..." : "Сдаться"}
          </button>
        </div>
      </Card>
    </div>
  );
}

export function CodeRaceArena({ activeMatch, myUserId, finishedResult, onAfterClose }) {
  const [task, setTask] = useState(null);
  const [taskError, setTaskError] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [showSurrender, setShowSurrender] = useState(false);
  const [surrendering, setSurrendering] = useState(false);
  const taskLoadedFor = useRef(null);

  const remaining = useEndsAtCountdown(activeMatch?.ends_at, activeMatch?.seconds_remaining);
  const timerCritical = remaining != null && remaining > 0 && remaining <= 30;

  // Fetch the task once per match.
  useEffect(() => {
    const taskId = activeMatch?.task_id;
    if (!taskId || taskLoadedFor.current === taskId) return;
    taskLoadedFor.current = taskId;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch(`/tasks/${taskId}`);
        if (cancelled) return;
        setTask(data);
        if (!code && data?.starter_code) {
          setCode(data.starter_code);
        }
      } catch (e) {
        if (!cancelled) setTaskError(e?.message || "Не удалось загрузить задачу");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- code intentionally omitted
  }, [activeMatch?.task_id]);

  const isFinished = Boolean(finishedResult);

  const handleRun = useCallback(async () => {
    if (!activeMatch?.task_id || !activeMatch?.match_id || submitting) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const result = await apiFetch("/submissions", {
        method: "POST",
        body: { task_id: activeMatch.task_id, match_id: activeMatch.match_id, code },
      });
      setLastResult(result);
    } catch (e) {
      setLastResult({
        verdict: "wrong",
        message: e?.message || "Ошибка отправки",
        passed_tests: 0,
        total_tests: 0,
      });
    } finally {
      setSubmitting(false);
    }
  }, [activeMatch?.task_id, activeMatch?.match_id, code, submitting]);

  const handleSurrenderConfirm = useCallback(async () => {
    setSurrendering(true);
    try {
      await apiFetch("/matchmaking/surrender", { method: "POST" });
      // The match_finished WS event will close the overlay via parent state.
    } catch (e) {
      // If the match was already finished server-side, parent will receive
      // the WS event anyway.
      console.error("[CodeRaceArena] surrender failed", e);
    } finally {
      setSurrendering(false);
      setShowSurrender(false);
    }
  }, []);

  const opponent = activeMatch?.opponent ?? null;

  const timerEl = useMemo(
    () => (
      <span
        className={`font-mono text-2xl font-bold tabular-nums ${
          timerCritical ? "animate-pulse text-red-400" : "text-accent"
        } sm:text-3xl`}
      >
        {formatCountdown(remaining)}
      </span>
    ),
    [remaining, timerCritical]
  );

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Гонка идёт
          </div>
          <span className="hidden text-xs text-muted sm:inline">
            Первый прошедший все тесты забирает матч
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSurrender(true)}
            disabled={isFinished || surrendering}
            className="inline-flex h-10 items-center justify-center rounded-btn border border-border bg-elevated/40 px-3 text-xs font-semibold text-muted/80 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-40"
          >
            🏳 Сдаться
          </button>
        </div>
      </Card>

      {taskError ? (
        <Card className="border-red-500/30 p-4 text-sm text-red-300">{taskError}</Card>
      ) : null}

      {/* Split layout */}
      <div className="grid gap-3 lg:grid-cols-[2fr,3fr]">
        <TaskBriefCard task={task} opponent={opponent} timerEl={timerEl} />
        <CodeEditorCard
          code={code}
          onCodeChange={setCode}
          onRun={handleRun}
          submitting={submitting}
          disabled={isFinished}
          lastResult={lastResult}
          timerEl={timerEl}
        />
      </div>

      {finishedResult ? (
        <FinishOverlay
          result={finishedResult}
          myUserId={myUserId}
          opponent={opponent}
          onClose={onAfterClose}
        />
      ) : null}

      <SurrenderModal
        open={showSurrender}
        loading={surrendering}
        onCancel={() => setShowSurrender(false)}
        onConfirm={handleSurrenderConfirm}
      />
    </div>
  );
}

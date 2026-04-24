import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

function toTaskTypeLabel(taskType) {
  if (taskType === "solo") return "Solo";
  if (taskType === "match") return "Match";
  return taskType ?? "";
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TaskSolvePage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const { refreshMe } = useAuth();

  const taskIdNum = useMemo(() => Number(taskId), [taskId]);
  const isTeamContext = searchParams.get("team") === "1";

  const [task, setTask] = useState(null);
  const [activeMatch, setActiveMatch] = useState(null);
  const [teamTask, setTeamTask] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [remainingSec, setRemainingSec] = useState(null);
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const loadAttempt = useCallback(async () => {
    try {
      const a = await apiFetch(`/tasks/${taskIdNum}/attempt`);
      const valid = a && typeof a === "object" && a.id != null ? a : null;
      setAttempt(valid);
      if (valid?.deadline) {
        const end = new Date(valid.deadline).getTime();
        setRemainingSec(Math.max(0, Math.floor((end - Date.now()) / 1000)));
      } else {
        setRemainingSec(null);
      }
    } catch {
      setAttempt(null);
      setRemainingSec(null);
    }
  }, [taskIdNum]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const t = await apiFetch(`/tasks/${taskIdNum}`);
        if (!mounted) return;
        setTask(t);
        if (t.starter_code && code === "") setCode(t.starter_code);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Не удалось загрузить задачу");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIdNum]);

  useEffect(() => {
    if (!task) return;
    loadAttempt();
  }, [task, loadAttempt]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!task) return;
      if (task.task_type !== "match") return;
      try {
        const m = await apiFetch("/matchmaking/active");
        if (mounted) setActiveMatch(m);
      } catch {
        if (mounted) setActiveMatch(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [task]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!task) {
        if (mounted) setTeamTask(null);
        return;
      }
      try {
        const currentTeam = await apiFetch("/teams/current");
        if (!mounted) return;
        const currentTeamTask =
          currentTeam?.task?.task_id === task.id && currentTeam.task.status === "active" ? currentTeam.task : null;
        setTeamTask(currentTeamTask);
      } catch {
        if (mounted) setTeamTask(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [task]);

  useEffect(() => {
    if (!attempt?.id || attempt.status !== "active") return;
    const deadline = new Date(attempt.deadline).getTime();
    const tick = () => {
      const r = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemainingSec(r);
      if (r === 0) {
        loadAttempt();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [attempt, loadAttempt]);

  async function handleStartTask() {
    setStarting(true);
    setError("");
    setResult(null);
    try {
      const a = await apiFetch(`/tasks/${taskIdNum}/start`, { method: "POST" });
      setAttempt(a && a.id != null ? a : null);
      if (a?.deadline) {
        const end = new Date(a.deadline).getTime();
        setRemainingSec(Math.max(0, Math.floor((end - Date.now()) / 1000)));
      }
    } catch (e) {
      setError(e?.message || "Не удалось принять задание");
    } finally {
      setStarting(false);
    }
  }

  const timeUp = attempt?.status === "active" && remainingSec === 0;
  const canSubmit =
    attempt?.id &&
    attempt.status === "active" &&
    remainingSec != null &&
    remainingSec > 0 &&
    !timeUp;
  const hasTeamTaskContext = isTeamContext && teamTask?.task_id === task?.id && teamTask?.status === "active";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!task || !canSubmit) return;

    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const matchId =
        task.task_type === "match" && activeMatch && activeMatch.task_id === task.id
          ? activeMatch.match_id
          : null;

      if (isTeamContext && !hasTeamTaskContext) {
        setError("Командная задача уже не активна.");
        setSubmitting(false);
        return;
      }

      if (task.task_type === "match" && !matchId && !hasTeamTaskContext) {
        setError("Для match-задачи нужен активный матч (queue → match).");
        setSubmitting(false);
        return;
      }

      const submitResult = await apiFetch(`/tasks/${task.id}/submit`, {
        method: "POST",
        body: {
          code,
          match_id: matchId,
        },
      });
      setResult(submitResult);
      if (hasTeamTaskContext && submitResult?.verdict === "correct") {
        setTeamTask(null);
      }
      await refreshMe();
      await loadAttempt();
    } catch (e) {
      setError(e?.message || "Ошибка при отправке");
    } finally {
      setSubmitting(false);
    }
  }

  const timerClass =
    remainingSec != null && remainingSec <= 300 && remainingSec > 0
      ? "text-red-400 font-semibold tabular-nums"
      : "text-accent font-semibold tabular-nums";

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-3xl md:px-6 md:py-8">
      <div className="mb-6">
        <Button
          variant="secondary"
          className="mb-4 h-11 w-full rounded-[12px] md:h-auto md:w-auto md:rounded-btn"
          onClick={() => navigate(-1)}
        >
          Назад
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Решение</h1>
        <p className="mt-1 text-sm text-muted">Примите задание, затем отправьте код до дедлайна</p>
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-muted">Загрузка...</Card>
      ) : error && !task ? (
        <Card className="p-6 text-sm text-muted">{error}</Card>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Card className="p-6">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-muted">Тип: {toTaskTypeLabel(task.task_type)}</div>
              <div className="text-sm text-muted">Сложность: ★{task.difficulty}</div>
              <div className="text-sm text-muted">Лимит: {task.time_limit_minutes} мин</div>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-foreground">{task.title}</h2>
            {task.description && <p className="mt-2 text-sm text-muted">{task.description}</p>}
          </Card>

          {result?.verdict === "correct" ? (
            <Card className="p-6 text-sm text-emerald-400">
              Задача выполнена и засчитана. Повторный старт не требуется.
            </Card>
          ) : !attempt?.id ? (
            <Card className="p-6">
              <p className="text-sm text-muted">Нажмите «Принять задание», чтобы запустить таймер.</p>
              <Button
                type="button"
                className="mt-4 h-12 w-full rounded-[12px] md:h-auto md:w-auto md:rounded-btn"
                onClick={handleStartTask}
                disabled={starting}
              >
                {starting ? "Старт..." : "Принять задание"}
              </Button>
            </Card>
          ) : (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted">Осталось времени</div>
                  <div className={timerClass}>{formatCountdown(remainingSec)}</div>
                </div>
                <div className="text-xs text-muted">
                  Дедлайн (сервер): {attempt.deadline ? new Date(attempt.deadline).toLocaleString() : "—"}
                </div>
              </div>
              {timeUp ? (
                <p className="mt-3 text-sm font-medium text-red-400">Время вышло. Отправка заблокирована. Можно принять задание снова.</p>
              ) : null}
            </Card>
          )}

          <Card className="p-6">
            <label htmlFor="code" className="block text-xs font-medium text-muted">
              Код
            </label>
            <textarea
              id="code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!canSubmit}
              className="mt-2 min-h-[220px] w-full resize-y rounded-btn border border-border bg-canvas px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              placeholder={canSubmit ? "// ваше решение" : "// сначала примите задание и дождитесь активной попытки"}
            />
            <div className="mt-2 text-xs text-muted">
              {task.task_type === "match" && !hasTeamTaskContext && (!activeMatch || activeMatch.task_id !== task.id)
                ? "Для match: сначала найдите матч, чтобы был активный match_id."
                : null}
              {hasTeamTaskContext ? "Эта задача активна у вашей команды, можно отправлять решение сразу." : null}
            </div>
          </Card>

          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            <Button
              type="submit"
              disabled={submitting || !canSubmit}
              className="h-12 w-full min-w-0 rounded-[12px] md:h-auto md:min-w-[180px] md:w-auto md:rounded-btn"
            >
              {submitting ? "Отправляем..." : "Отправить решение"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full min-w-0 rounded-[12px] md:h-auto md:min-w-[180px] md:w-auto md:rounded-btn"
              onClick={() => setCode(task.starter_code ?? "")}
              disabled={submitting || !canSubmit}
            >
              Сброс к starter code
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full min-w-0 rounded-[12px] md:h-auto md:min-w-[180px] md:w-auto md:rounded-btn"
              onClick={() => navigate("/dashboard")}
            >
              К задачам
            </Button>
          </div>

          {error ? <div className="text-sm text-accent">{error}</div> : null}

          {result ? (
            <Card className="p-5">
              <div
                className={[
                  "text-sm font-semibold",
                  result.verdict === "correct" ? "text-emerald-400" : "text-red-400",
                ].join(" ")}
              >
                {result.verdict === "correct" ? "✅ ПРАВИЛЬНО" : "❌ НЕПРАВИЛЬНО"}
              </div>
              <p className="mt-2 text-sm text-muted">{result.message}</p>
              <div className="mt-3 text-sm text-muted">
                Тесты:{" "}
                <span className="text-foreground">
                  {result.passed_tests}/{result.total_tests}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted">
                Попытка: <span className="text-foreground">{result.attempt_status}</span>
              </div>
              <div className="mt-1 text-sm text-muted">
                PTS:{" "}
                <span className={result.pts_delta > 0 ? "text-emerald-400" : "text-muted"}>
                  {result.pts_delta > 0 ? `+${result.pts_delta}` : result.pts_delta}
                </span>
                <span className="mx-1 text-border">·</span>
                Всего: <span className="text-accent">{result.updated_pts}</span>
              </div>
            </Card>
          ) : null}
        </form>
      )}
    </div>
  );
}

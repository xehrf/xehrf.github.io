import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { ptsForDifficulty } from "../utils/taskPts.js";

export function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const taskIdNum = useMemo(() => Number(taskId), [taskId]);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const t = await apiFetch(`/tasks/${taskIdNum}`);
        if (mounted) setTask(t);
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить задачу");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [taskIdNum]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 rounded-[12px] bg-elevated" />
          <div className="h-24 rounded-[12px] bg-elevated" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl">
        <Card className="p-4 text-sm text-accent">{error || "Нет данных"}</Card>
        <Button variant="secondary" className="mt-4 w-full md:w-auto" onClick={() => navigate("/dashboard")}>
          К задачам
        </Button>
      </div>
    );
  }

  const pts = ptsForDifficulty(task.difficulty);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6">
      <Button variant="ghost" className="mb-4 px-0 text-sm text-muted md:px-3" onClick={() => navigate(-1)}>
        ← Назад
      </Button>

      <Card className="p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">{task.title}</h1>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-accent">
            ★{task.difficulty}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted whitespace-pre-wrap">{task.description}</p>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Награда (PTS)</dt>
            <dd className="font-semibold tabular-nums text-accent">+{pts}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Лимит времени</dt>
            <dd className="text-foreground">{task.time_limit_minutes} мин</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Тип</dt>
            <dd className="capitalize text-foreground">{task.task_type}</dd>
          </div>
        </dl>
      </Card>

      <div className="mt-4 space-y-3 md:mt-6 md:flex md:flex-wrap md:gap-3">
        <Link to={`/tasks/${task.id}/solve`} className="block w-full md:inline-block md:w-auto">
          <Button type="button" className="h-12 w-full rounded-[12px] py-3 text-base md:h-auto md:min-w-[200px] md:py-2.5 md:text-sm">
            Принять задание
          </Button>
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full rounded-[12px] md:h-auto md:w-auto"
          onClick={() => navigate("/dashboard")}
        >
          К списку
        </Button>
      </div>
    </div>
  );
}

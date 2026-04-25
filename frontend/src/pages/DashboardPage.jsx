import { useEffect, useMemo, useState } from "react";
import { TaskCard } from "../components/tasks/TaskCard.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

const difficultyOptions = [
  { value: "all", label: "Все" },
  { value: "1", label: "★" },
  { value: "2", label: "★★" },
  { value: "3", label: "★★★" },
  { value: "4", label: "★★★★" },
  { value: "5", label: "★★★★★" },
];

export function DashboardPage() {
  const [filter, setFilter] = useState("all");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch("/tasks");
        if (mounted) setTasks(data);
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить задачи");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => t.task_type === "solo");
    if (filter === "all") return list;
    const n = Number(filter);
    return list.filter((t) => t.difficulty === n);
  }, [filter, tasks]);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Задачи</h1>
          <p className="mt-1 text-sm text-muted">Решай задачи и зарабатывай PTS</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="justify-center rounded-[12px] px-5 py-2.5 text-sm"
          onClick={() => navigate('/achievements')}
        >
          🏆 Достижения
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 md:mb-8">
        <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted">Сложность</span>
        {difficultyOptions.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={filter === opt.value ? "primary" : "secondary"}
            className="px-3 py-1.5 text-xs"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-muted">Загрузка задач...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-accent">{error}</Card>
      ) : filtered.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-elevated/50 py-12 text-center text-sm text-muted">
          Нет задач с этой сложностью. Сбросьте фильтр.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
          {filtered.map((task) => (
            <li key={task.id} className="flex h-full">
              <TaskCard
                task={task}
                actionLabel={isMobile ? "Открыть" : "Решить"}
                showPts={isMobile}
                onSolve={() =>
                  navigate(isMobile ? `/tasks/${task.id}` : `/tasks/${task.id}/solve`)
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [taskTitles, setTaskTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const completedTasks = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of submissions) {
      const ok = s.auto_test_passed === true || s.status === "accepted";
      if (!ok) continue;
      if (seen.has(s.task_id)) continue;
      seen.add(s.task_id);
      out.push({
        taskId: s.task_id,
        title: taskTitles[s.task_id] ?? `Задача #${s.task_id}`,
      });
    }
    return out;
  }, [submissions, taskTitles]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [p, subs, tasks] = await Promise.all([
          apiFetch("/users/me/profile"),
          apiFetch("/submissions/me"),
          apiFetch("/tasks"),
        ]);
        if (!mounted) return;
        setProfile(p);
        setSubmissions(Array.isArray(subs) ? subs : []);
        const map = {};
        for (const t of tasks) map[t.id] = t.title;
        setTaskTitles(map);
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить профиль");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
        <Card className="p-6 text-sm text-muted">Загрузка профиля...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
        <Card className="p-6 text-sm text-accent">{error}</Card>
      </div>
    );
  }

  const u = profile;
  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Профиль</h1>
      <p className="mt-1 text-sm text-muted">@{u.display_name}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Рейтинг</h2>
          <dl className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-muted">PTS</dt>
              <dd className="font-semibold tabular-nums text-accent">{u.pts}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted">Уровень</dt>
              <dd className="font-medium capitalize text-foreground">{u.level}</dd>
            </div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Навыки</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {u.skills.map((s) => (
              <li
                key={s.skill_name}
                className="rounded-full border border-border bg-canvas px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent/40"
              >
                <span className="font-medium">{s.skill_name}</span>
                <span className="ml-2 text-muted">·</span>
                <span className="ml-2 text-accent">{s.proficiency}/5</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Выполненные задачи</h2>
        {completedTasks.length === 0 ? (
          <div className="mt-4 rounded-card border border-dashed border-border bg-elevated/50 px-4 py-6 text-sm text-muted">
            Пока нет засчитанных решений. Решай solo-задачи на вкладке «Задачи».
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {completedTasks.map((row) => (
              <li key={row.taskId}>
                <Link
                  to={`/tasks/${row.taskId}/solve`}
                  className="flex items-center justify-between rounded-[10px] border border-border bg-canvas px-3 py-3 text-sm text-foreground transition-colors active:scale-[0.99] md:hover:border-accent/40"
                >
                  <span className="font-medium">{row.title}</span>
                  <span className="text-xs text-accent">✓</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

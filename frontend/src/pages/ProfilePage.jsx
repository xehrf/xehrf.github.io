import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";

export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [taskTitles, setTaskTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

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
  const bannerBackground =
    u.banner_url ||
    "linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))";
  const bannerUrl = resolveAssetUrl(u.banner_url || "");
  const avatarUrl = resolveAssetUrl(u.avatar_url || "");
  const showBanner = bannerUrl && !bannerLoadError;
  const showAvatar = avatarUrl && !avatarLoadError;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Профиль</h1>
          <p className="mt-1 text-sm text-muted">@{u.nickname || u.display_name}</p>
        </div>
        <LinkButton
          to="/profile/edit"
          className="h-12 justify-center rounded-[12px] px-5 py-2.5 text-sm"
        >
          Редактировать профиль
        </LinkButton>
      </div>

      <Card className="overflow-hidden border-border">
        <div className="relative h-56 bg-slate-950/80 sm:h-72">
          {showBanner ? (
            <img
              src={bannerUrl}
              alt="Banner"
              className="h-full w-full object-cover"
              onError={() => setBannerLoadError(true)}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: bannerBackground }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-end p-4">
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs uppercase tracking-wide text-white">
              {u.level}
            </span>
          </div>
          <div className="absolute left-6 bottom-[-40px] flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-slate-950 bg-slate-800 shadow-xl">
            {showAvatar ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-full w-full object-cover"
                onError={() => setAvatarLoadError(true)}
              />
            ) : (
              <span className="text-4xl font-bold text-white">
                {u.nickname?.[0]?.toUpperCase() ?? u.display_name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-16 sm:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{u.nickname || u.display_name}</h2>
              <p className="text-sm text-muted">{u.display_name}</p>
            </div>
          </div>
          {u.bio ? (
            <p className="rounded-3xl border border-border bg-canvas px-4 py-4 text-sm leading-6 text-foreground">
              {u.bio}
            </p>
          ) : (
            <p className="rounded-3xl border border-dashed border-border bg-elevated/50 px-4 py-4 text-sm text-muted">
              Описание профиля отсутствует. Добавьте его в настройках.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-canvas p-4">
              <div className="text-xs uppercase tracking-wider text-muted">PTS</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{u.pts}</div>
            </div>
            <div className="rounded-3xl border border-border bg-canvas p-4">
              <div className="text-xs uppercase tracking-wider text-muted">Уровень</div>
              <div className="mt-2 text-2xl font-semibold capitalize text-foreground">{u.level}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Навыки</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {u.skills.map((s) => (
              <li
                key={s.skill_name}
                className="rounded-full border border-border bg-canvas px-3 py-1.5 text-sm text-foreground transition hover:border-accent/40"
              >
                <span className="font-medium">{s.skill_name}</span>
                <span className="ml-2 text-muted">·</span>
                <span className="ml-2 text-accent">{s.proficiency}/5</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
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
    </div>
  );
}

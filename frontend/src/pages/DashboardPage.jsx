import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TaskCard } from "../components/tasks/TaskCard.jsx";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { ptsForDifficulty } from "../utils/taskPts.js";

const difficultyOptions = [
  { value: "all", label: "Все", icon: "✦" },
  { value: "1", label: "Лёгкие", icon: "★" },
  { value: "2", label: "Средние", icon: "★★" },
  { value: "3", label: "Сложные", icon: "★★★" },
  { value: "4", label: "Эксперт", icon: "★★★★" },
  { value: "5", label: "Легендарные", icon: "★★★★★" },
];

const sortOptions = [
  { value: "default", label: "По умолчанию" },
  { value: "difficulty_asc", label: "Сложность ↑" },
  { value: "difficulty_desc", label: "Сложность ↓" },
  { value: "time_asc", label: "Быстрые сверху" },
  { value: "time_desc", label: "Долгие сверху" },
  { value: "pts_desc", label: "Больше PTS" },
];

/**
 * Picks one task as "challenge of the day" deterministically by date,
 * so the same task is featured for everyone on the same UTC day. Skips
 * tasks the user has already solved when possible.
 */
function pickDailyChallenge(tasks, solvedIds) {
  if (!tasks.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  // Simple stable hash from the date string.
  let h = 0;
  for (let i = 0; i < today.length; i++) h = (h * 31 + today.charCodeAt(i)) | 0;
  const seed = Math.abs(h);

  const unsolved = tasks.filter((t) => !solvedIds.has(t.id));
  const pool = unsolved.length > 0 ? unsolved : tasks;
  return pool[seed % pool.length];
}

function StatTile({ label, value, sub, accent }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p
        className={`mt-2 font-mono text-2xl font-bold ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}

function DailyChallengeCard({ task, alreadySolved, onSolve }) {
  if (!task) return null;
  return (
    <Card className="relative overflow-hidden border-accent/30 p-6">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
            ⚡ Челлендж дня
          </div>
          <h2 className="mt-3 truncate text-2xl font-bold text-foreground sm:text-3xl">
            {task.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>
              Сложность:{" "}
              <span className="font-mono text-accent">
                {"★".repeat(task.difficulty)}
              </span>
            </span>
            <span className="text-border">·</span>
            <span>
              Лимит:{" "}
              <span className="font-mono text-foreground">
                {task.time_limit_minutes} мин
              </span>
            </span>
            <span className="text-border">·</span>
            <span>
              Награда:{" "}
              <span className="font-mono text-accent">
                +{ptsForDifficulty(task.difficulty)} PTS
              </span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          {alreadySolved ? (
            <span className="inline-flex items-center justify-center rounded-btn border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent">
              ✓ Уже решено
            </span>
          ) : null}
          <Button onClick={onSolve} className="min-w-[160px]">
            {alreadySolved ? "Пересмотреть" : "⚔ Принять вызов"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
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
        // /submissions/me requires auth; treat 401 as "not signed in" and
        // continue to render tasks without solved annotations.
        const [tasksData, subsData] = await Promise.all([
          apiFetch("/tasks"),
          apiFetch("/submissions/me").catch(() => []),
        ]);
        if (!mounted) return;
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setSubmissions(Array.isArray(subsData) ? subsData : []);
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

  // Set of task IDs the user has successfully passed (auto-test or accepted).
  const solvedIds = useMemo(() => {
    const ids = new Set();
    for (const s of submissions) {
      if (s.auto_test_passed === true || s.status === "accepted") {
        ids.add(s.task_id);
      }
    }
    return ids;
  }, [submissions]);

  const soloTasks = useMemo(
    () => tasks.filter((t) => t.task_type === "solo"),
    [tasks]
  );

  const dailyChallenge = useMemo(
    () => pickDailyChallenge(soloTasks, solvedIds),
    [soloTasks, solvedIds]
  );

  // Stats for the top bar.
  const stats = useMemo(() => {
    const total = soloTasks.length;
    const solved = soloTasks.filter((t) => solvedIds.has(t.id)).length;
    const earned = soloTasks
      .filter((t) => solvedIds.has(t.id))
      .reduce((sum, t) => sum + ptsForDifficulty(t.difficulty), 0);
    const hardestSolved = soloTasks
      .filter((t) => solvedIds.has(t.id))
      .reduce((max, t) => Math.max(max, t.difficulty), 0);
    return { total, solved, earned, hardestSolved };
  }, [soloTasks, solvedIds]);

  const filtered = useMemo(() => {
    let list = soloTasks;

    if (filter !== "all") {
      const n = Number(filter);
      list = list.filter((t) => t.difficulty === n);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }

    const comparators = {
      difficulty_asc: (a, b) => a.difficulty - b.difficulty,
      difficulty_desc: (a, b) => b.difficulty - a.difficulty,
      time_asc: (a, b) => a.time_limit_minutes - b.time_limit_minutes,
      time_desc: (a, b) => b.time_limit_minutes - a.time_limit_minutes,
      pts_desc: (a, b) =>
        ptsForDifficulty(b.difficulty) - ptsForDifficulty(a.difficulty),
    };
    const cmp = comparators[sortBy];
    return cmp ? [...list].sort(cmp) : list;
  }, [soloTasks, filter, searchQuery, sortBy]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
          🎯 Solo-арена
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          <span className="text-gradient-accent">Задачи</span>
        </h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Решай в одиночку, зарабатывай PTS, поднимайся в рейтинге.
        </p>
      </div>

      {/* Stats tiles */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Всего задач" value={stats.total} />
        <StatTile
          label="Решено"
          value={stats.solved}
          sub={
            stats.total > 0
              ? `${Math.round((stats.solved / stats.total) * 100)}% коллекции`
              : null
          }
          accent
        />
        <StatTile
          label="Заработано"
          value={`${stats.earned}`}
          sub="PTS суммарно"
          accent
        />
        <StatTile
          label="Сложнейшая"
          value={stats.hardestSolved > 0 ? "★".repeat(stats.hardestSolved) : "—"}
          sub={stats.hardestSolved > 0 ? `уровень ${stats.hardestSolved}` : "пока ничего"}
        />
      </div>

      {/* Daily challenge */}
      {dailyChallenge ? (
        <div className="mb-8">
          <DailyChallengeCard
            task={dailyChallenge}
            alreadySolved={solvedIds.has(dailyChallenge.id)}
            onSolve={() =>
              navigate(
                isMobile
                  ? `/tasks/${dailyChallenge.id}`
                  : `/tasks/${dailyChallenge.id}/solve`
              )
            }
          />
        </div>
      ) : null}

      {/* Search + sort */}
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,auto]">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full rounded-btn border border-border bg-elevated/50 py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-btn border border-border bg-elevated/50 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Difficulty pills */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {difficultyOptions.map((opt) => {
          const isActive = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "border-accent bg-accent text-black shadow-glow"
                  : "border-border bg-elevated/50 text-muted hover:border-accent/40 hover:text-foreground"
              }`}
            >
              <span className="font-mono">{opt.icon}</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted">Загрузка задач...</Card>
      ) : error ? (
        <Card className="border-red-500/30 p-8 text-center text-sm text-red-300">
          {error}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed bg-elevated/30 p-12 text-center text-sm text-muted">
          {searchQuery
            ? `По запросу «${searchQuery}» ничего не найдено.`
            : "Нет задач с этой сложностью. Сбрось фильтр."}
        </Card>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted">
            Показано: <span className="font-mono text-accent">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "задача" : "задач"}
          </p>
          <ul className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((task) => (
              <li key={task.id} className="flex h-full">
                <TaskCard
                  task={task}
                  solved={solvedIds.has(task.id)}
                  actionLabel={isMobile ? "Открыть" : "Решить"}
                  showPts={isMobile}
                  onSolve={() =>
                    navigate(isMobile ? `/tasks/${task.id}` : `/tasks/${task.id}/solve`)
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Helpful link to leaderboard */}
      {!loading && !error && stats.solved > 0 ? (
        <div className="mt-10 text-center">
          <LinkButton to="/leaderboard" variant="secondary">
            Посмотреть рейтинг →
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}

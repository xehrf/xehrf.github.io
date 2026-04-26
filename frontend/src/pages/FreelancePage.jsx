import { useEffect, useMemo, useState } from "react";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { formatDate, formatMoney, getPostStatusMeta } from "../utils/freelanceStatus.js";

const INITIAL_FILTERS = {
  q: "",
  minBudget: "",
  maxBudget: "",
  tech: "",
  status: "",
};

const TECH_TAGS = ["React", "FastAPI", "Python", "Node.js", "TypeScript", "Vue", "Django", "PostgreSQL"];

function getDifficulty(budget) {
  if (!budget || budget < 5000) return { label: "Легко", textCls: "text-green-400" };
  if (budget < 20000) return { label: "Средне", textCls: "text-yellow-400" };
  return { label: "Сложно", textCls: "text-red-400" };
}

function StatBox({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-border bg-canvas p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted">{icon} {label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function PostCard({ post }) {
  const statusMeta = getPostStatusMeta(post.status);
  const difficulty = getDifficulty(post.budget);
  const isNew = post.created_at && (Date.now() - new Date(post.created_at)) < 1000 * 60 * 60 * 24;
  const techs = post.tech_stack
    ? post.tech_stack.split(",").map(t => t.trim()).filter(Boolean)
    : [];

  return (
    <Card className="flex flex-col gap-4 p-5 transition hover:border-accent/40">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex-1 text-sm font-semibold leading-snug text-foreground">
          {post.title}
        </h2>
        <div className="flex flex-shrink-0 items-center gap-2">
          {isNew && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              Новый
            </span>
          )}
          <span className={[
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            statusMeta.badgeClass,
          ].join(" ")}>
            {statusMeta.label}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-xs leading-relaxed text-muted">
        {post.description}
      </p>

      {/* Tech tags */}
      {techs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {techs.map(tech => (
            <span
              key={tech}
              className="rounded-lg border border-border bg-elevated px-2 py-0.5 text-[10px] font-semibold text-muted"
            >
              {tech}
            </span>
          ))}
        </div>
      )}

      {/* Budget + Difficulty */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-elevated px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Бюджет</p>
          <p className="mt-0.5 text-base font-bold text-accent">{formatMoney(post.budget)}</p>
        </div>
        <div className="rounded-xl border border-border bg-elevated px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Сложность</p>
          <p className={["mt-0.5 text-sm font-bold", difficulty.textCls].join(" ")}>
            {difficulty.label}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Дедлайн: <span className="font-medium text-foreground">{formatDate(post.deadline)}</span></span>
        <span>{post.proposals_count ?? 0} откликов</span>
      </div>

      {/* CTA */}
      <LinkButton
        to={`/freelance/posts/${post.id}`}
        className="w-full justify-center rounded-xl py-2.5 text-sm font-bold"
      >
        Подробнее →
      </LinkButton>
    </Card>
  );
}

export function FreelancePage() {
  const [posts, setPosts] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...INITIAL_FILTERS }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTech, setActiveTech] = useState("");

  const openCount = useMemo(() => posts.filter(p => p.status === "open").length, [posts]);
  const inProgressCount = useMemo(() => posts.filter(p => p.status === "in_progress").length, [posts]);
  const totalBudget = useMemo(() => posts.reduce((s, p) => s + (p.budget || 0), 0), [posts]);

  function updateFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  async function loadPosts(nextFilters = filters, techOverride) {
    setLoading(true);
    setError("");
    const techVal = techOverride !== undefined ? techOverride : activeTech;
    try {
      const params = new URLSearchParams();
      if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
      if (nextFilters.minBudget) params.set("min_budget", nextFilters.minBudget);
      if (nextFilters.maxBudget) params.set("max_budget", nextFilters.maxBudget);
      if (nextFilters.tech.trim() || techVal) params.set("tech", nextFilters.tech.trim() || techVal);
      if (nextFilters.status) params.set("status", nextFilters.status);
      const query = params.toString();
      const data = await apiFetch(`/posts${query ? `?${query}` : ""}`);
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    const cleared = { ...INITIAL_FILTERS };
    setFilters(cleared);
    setActiveTech("");
    loadPosts(cleared, "");
  }

  function toggleTech(tag) {
    const next = activeTech === tag ? "" : tag;
    setActiveTech(next);
    loadPosts(filters, next);
  }

  useEffect(() => { loadPosts(); }, []);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">

      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Фриланс-заказы
          </h1>
          <p className="mt-1 text-sm text-muted">
            Система подберёт заказ по твоему стеку — выполняй и прокачивай профиль.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <LinkButton
            to="/freelance/create"
            className="h-12 justify-center rounded-[12px] py-3 md:h-auto md:rounded-btn md:py-2.5"
          >
            + Создать заказ
          </LinkButton>
          <LinkButton
            to="/freelance/my-jobs"
            variant="secondary"
            className="h-12 justify-center rounded-[12px] py-3 md:h-auto md:rounded-btn md:py-2.5"
          >
            Мои заказы
          </LinkButton>
        </div>
      </div>

      {/* STATS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Всего заказов" value={posts.length} icon="📋" />
        <StatBox label="Открытые" value={openCount} icon="🟢" />
        <StatBox label="В работе" value={inProgressCount} icon="⚡" />
        <StatBox label="Общий бюджет" value={formatMoney(totalBudget)} icon="💰" />
      </div>

      {/* TECH QUICK FILTER */}
      <div className="mb-4">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">Быстрый фильтр по стеку</p>
        <div className="flex flex-wrap gap-2">
          {TECH_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTech(tag)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                activeTech === tag
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-foreground",
              ].join(" ")}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* FILTERS */}
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input
            value={filters.q}
            onChange={e => updateFilter("q", e.target.value)}
            placeholder="Поиск по названию или описанию"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60 lg:col-span-2"
          />
          <input
            value={filters.minBudget}
            onChange={e => updateFilter("minBudget", e.target.value)}
            placeholder="Мин. бюджет"
            type="number" min="0"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60"
          />
          <input
            value={filters.maxBudget}
            onChange={e => updateFilter("maxBudget", e.target.value)}
            placeholder="Макс. бюджет"
            type="number" min="0"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60"
          />
          <select
            value={filters.status}
            onChange={e => updateFilter("status", e.target.value)}
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60"
          >
            <option value="">Все статусы</option>
            <option value="open">Открыт</option>
            <option value="in_progress">В работе</option>
            <option value="completed">Завершён</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => loadPosts()}
              className="rounded-btn bg-accent py-2 text-sm font-bold text-black transition hover:bg-accent/90"
            >
              Найти
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-btn border border-border bg-canvas py-2 text-sm text-muted transition hover:border-accent/40 hover:text-foreground"
            >
              Сброс
            </button>
          </div>
        </div>
      </Card>

      {/* RESULTS COUNT */}
      {!loading && !error && (
        <p className="mb-4 text-xs text-muted">
          Найдено <span className="font-semibold text-foreground">{posts.length}</span> заказов
        </p>
      )}

      {/* LOADING */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm text-muted">Загружаем заказы...</p>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <Card className="p-4 text-sm text-accent">{error}</Card>
      )}

      {/* EMPTY */}
      {!loading && !error && posts.length === 0 && (
        <Card className="p-8 text-center">
          <p className="mb-3 text-3xl">🔍</p>
          <h2 className="text-base font-semibold text-foreground">Заказов не найдено</h2>
          <p className="mt-1 text-sm text-muted">
            Попробуй ослабить фильтры или создай первый заказ.
          </p>
          <LinkButton
            to="/freelance/create"
            className="mt-4 inline-flex justify-center rounded-xl px-6 py-2.5 text-sm font-bold"
          >
            Создать заказ
          </LinkButton>
        </Card>
      )}

      {/* POSTS GRID */}
      {!loading && !error && posts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

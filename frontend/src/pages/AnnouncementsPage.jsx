import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { CompyraEmoji } from "../components/ui/CompyraEmoji.jsx";
import { apiFetch } from "../api/client";
import {
  CATEGORY_META,
  SKILL_LEVELS,
  SKILL_META,
  calcRemainingPercent,
  formatSalary,
  formatTtl,
  getCategoryMeta,
  getSkillMeta,
  getSourceMeta,
  getTtlColor,
} from "../utils/announcements.js";

const INITIAL_FILTERS = {
  q: "",
  category: "",
  skill_level: "",
  source: "",
  min_rating: "",
  tag: "",
  fresh_hours: "",
  expiring_in_hours: "",
  saved_only: false,
  sort: "recent",
};

const SORT_OPTIONS = [
  { value: "recent", label: "Новые" },
  { value: "rating", label: "По рейтингу" },
  { value: "views", label: "Популярные" },
  { value: "expiring", label: "Скоро истекут" },
];

function SkillLevelChip({ level, size = "sm" }) {
  const meta = getSkillMeta(level);
  if (!meta) return null;
  const cls = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide ${cls}`}
      style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  );
}

function TtlProgress({ announcement }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  // Recompute ttl_seconds on the client so the bar ticks down without
  // refetching: the backend value is a snapshot from when we loaded the list.
  const liveTtl = useMemo(() => {
    const exp = new Date(announcement.expires_at).getTime();
    return Math.max(0, Math.floor((exp - now) / 1000));
  }, [announcement.expires_at, now]);
  const percent = useMemo(
    () => calcRemainingPercent({ ...announcement, ttl_seconds: liveTtl }),
    [announcement, liveTtl],
  );
  const color = getTtlColor(percent);
  const isUrgent = percent < 25;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 text-muted">
          <span aria-hidden>⏱️</span>
          <span>Истечет через</span>
        </span>
        <span
          className={`font-semibold tabular-nums ${isUrgent ? "animate-pulse" : ""}`}
          style={{ color }}
        >
          {formatTtl(liveTtl)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StatPill({ icon, value, label }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-canvas px-2 py-1 text-[11px]">
      <span aria-hidden>{icon}</span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}

function SourceChip({ source, externalUrl }) {
  const meta = getSourceMeta(source, externalUrl);
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}

function AnnouncementCard({ announcement, onSaveToggle }) {
  const navigate = useNavigate();
  const catMeta = getCategoryMeta(announcement.category);
  const isHH = announcement.source_type === "hh";
  const salary = formatSalary(announcement);
  const subtitle = isHH
    ? [announcement.employer_name, announcement.area_name].filter(Boolean).join(" • ")
    : (announcement.author_display_name ?? "Аноним") +
      (announcement.contact_handle ? ` • ${announcement.contact_handle}` : "");

  function handleOpen() {
    // View counter is incremented on the details page mount — avoid double count here.
    navigate(`/announcements/${announcement.id}`);
  }

  async function handleSave(e) {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/announcements/${announcement.id}/save`, { method: "POST" });
      onSaveToggle?.(announcement.id, res.saved, res.save_count);
    } catch {
      // Silently ignored — Card.handleSave is fire-and-forget
    }
  }

  return (
    <Card className="flex cursor-pointer flex-col gap-3 p-4 transition hover:border-accent/40">
      <div onClick={handleOpen} className="flex flex-col gap-3">
        <TtlProgress announcement={announcement} />

        <div className="flex items-start justify-between gap-3">
          <h2 className="flex-1 text-sm font-semibold leading-snug text-foreground">
            <span className="mr-1.5" aria-hidden>{catMeta.icon}</span>
            {announcement.title}
          </h2>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            <SkillLevelChip level={announcement.skill_level} />
            <SourceChip source={announcement.source_type} externalUrl={announcement.external_url} />
            {announcement.rating_count > 0 ? (
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <span className="text-accent">★</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {announcement.rating_avg.toFixed(1)}
                </span>
                <span>({announcement.rating_count})</span>
              </span>
            ) : null}
          </div>
        </div>

        {salary ? (
          <div className="text-sm font-bold text-accent">💰 {salary}</div>
        ) : null}

        <p className="line-clamp-2 text-xs leading-relaxed text-muted">{announcement.description}</p>

        {announcement.tags && announcement.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {announcement.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-lg border border-border bg-elevated px-2 py-0.5 text-[10px] font-semibold text-muted"
              >
                #{tag}
              </span>
            ))}
            {announcement.tags.length > 5 ? (
              <span className="text-[10px] text-muted">+{announcement.tags.length - 5}</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <StatPill icon="👁️" value={announcement.view_count} label="" />
          <StatPill icon="🔗" value={announcement.click_count} label="" />
          <StatPill icon="💾" value={announcement.save_count} label="" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="truncate text-[11px] text-muted">{subtitle}</span>
        <button
          type="button"
          onClick={handleSave}
          aria-label={announcement.is_saved_by_me ? "Удалить из сохранённых" : "Сохранить"}
          className={[
            "rounded-full border px-2 py-1 text-[11px] font-semibold transition",
            announcement.is_saved_by_me
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-accent",
          ].join(" ")}
        >
          {announcement.is_saved_by_me ? "✓ Сохранено" : "💾 Сохранить"}
        </button>
      </div>
    </Card>
  );
}

function FilterSection({ filters, setFilter, onReset, onSubmit }) {
  return (
    <Card className="mb-6 flex flex-col gap-4 p-4">
      <input
        value={filters.q}
        onChange={(e) => setFilter("q", e.target.value)}
        placeholder="🔍 Поиск по названию или описанию"
        className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted">📂 Категория</span>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "", label: "Все" },
              ...Object.entries(CATEGORY_META).map(([value, m]) => ({
                value,
                label: `${m.icon} ${m.label}`,
              })),
            ].map((opt) => (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => setFilter("category", opt.value)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  filters.category === opt.value
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-foreground",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted">
            <CompyraEmoji name="target" size={13} />
            Уровень скила
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("skill_level", "")}
              className={[
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                filters.skill_level === ""
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-foreground",
              ].join(" ")}
            >
              Все
            </button>
            {SKILL_LEVELS.map((level) => {
              const meta = SKILL_META[level];
              const active = filters.skill_level === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFilter("skill_level", level)}
                  className="rounded-full border px-3 py-1 text-xs font-bold uppercase transition"
                  style={{
                    color: meta.color,
                    backgroundColor: active ? meta.bg : "transparent",
                    borderColor: active ? meta.color : meta.border,
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted">📡 Источник</span>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "", label: "Все" },
            { value: "community", label: "👤 Сообщество" },
            { value: "hh", label: "💼 hh.ru" },
          ].map((opt) => (
            <button
              key={opt.value || "any"}
              type="button"
              onClick={() => setFilter("source", opt.value)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                filters.source === opt.value
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-foreground",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <select
          value={filters.fresh_hours}
          onChange={(e) => setFilter("fresh_hours", e.target.value)}
          className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60"
        >
          <option value="">⏱️ Любое время</option>
          <option value="1">Свежие (&lt; 1ч)</option>
          <option value="6">Свежие (&lt; 6ч)</option>
          <option value="12">Сегодня (&lt; 12ч)</option>
        </select>
        <select
          value={filters.expiring_in_hours}
          onChange={(e) => setFilter("expiring_in_hours", e.target.value)}
          className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60"
        >
          <option value="">⌛ Срочность</option>
          <option value="3">Скоро истекут (&lt; 3ч)</option>
          <option value="6">Истекают (&lt; 6ч)</option>
          <option value="12">Истекают (&lt; 12ч)</option>
        </select>
        <select
          value={filters.min_rating}
          onChange={(e) => setFilter("min_rating", e.target.value)}
          className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60"
        >
          <option value="">Любой рейтинг</option>
          <option value="3">★★★ 3.0+</option>
          <option value="4">★★★★ 4.0+</option>
          <option value="4.5">★★★★★ 4.5+</option>
        </select>
        <select
          value={filters.sort}
          onChange={(e) => setFilter("sort", e.target.value)}
          className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent/60"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              ↕ {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={filters.saved_only}
            onChange={(e) => setFilter("saved_only", e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Только сохранённые
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-btn border border-border bg-canvas px-4 py-2 text-sm text-muted transition hover:border-accent/40 hover:text-foreground"
          >
            Сброс
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-btn bg-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-accent/90"
          >
            Применить
          </button>
        </div>
      </div>
    </Card>
  );
}

export function AnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...INITIAL_FILTERS }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reqIdRef = useRef(0);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const load = useCallback(async (nextFilters) => {
    setLoading(true);
    setError("");
    const myReqId = ++reqIdRef.current;
    try {
      const params = new URLSearchParams();
      if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
      if (nextFilters.category) params.set("category", nextFilters.category);
      if (nextFilters.skill_level) params.set("skill_level", nextFilters.skill_level);
      if (nextFilters.source) params.set("source", nextFilters.source);
      if (nextFilters.min_rating) params.set("min_rating", nextFilters.min_rating);
      if (nextFilters.tag.trim()) params.set("tag", nextFilters.tag.trim());
      if (nextFilters.fresh_hours) params.set("fresh_hours", nextFilters.fresh_hours);
      if (nextFilters.expiring_in_hours) params.set("expiring_in_hours", nextFilters.expiring_in_hours);
      if (nextFilters.saved_only) params.set("saved_only", "true");
      if (nextFilters.sort) params.set("sort", nextFilters.sort);
      const qs = params.toString();
      const data = await apiFetch(`/announcements${qs ? `?${qs}` : ""}`);
      if (myReqId !== reqIdRef.current) return;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      setError(e?.message || "Не удалось загрузить объявления");
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(INITIAL_FILTERS);
  }, [load]);

  function handleReset() {
    const cleared = { ...INITIAL_FILTERS };
    setFilters(cleared);
    load(cleared);
  }

  function handleSubmit() {
    load(filters);
  }

  function handleSaveToggle(id, saved, saveCount) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_saved_by_me: saved, save_count: saveCount } : item,
      ),
    );
  }

  const counts = useMemo(() => {
    const total = items.length;
    const offers = items.filter((i) => i.category === "job_offer").length;
    const searches = items.filter((i) => i.category === "work_search").length;
    const urgent = items.filter((i) => i.ttl_seconds <= 3 * 3600).length;
    return { total, offers, searches, urgent };
  }, [items]);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Объявления
          </h1>
          <p className="mt-1 text-sm text-muted">
            Свежие вакансии и анкеты от сообщества. Объявления живут до 7 дней — действуй быстро.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <LinkButton
            to="/announcements/create"
            className="h-12 justify-center rounded-[12px] py-3 md:h-auto md:rounded-btn md:py-2.5"
          >
            + Опубликовать
          </LinkButton>
          <LinkButton
            to="/announcements/mine"
            variant="secondary"
            className="h-12 justify-center rounded-[12px] py-3 md:h-auto md:rounded-btn md:py-2.5"
          >
            Мои объявления
          </LinkButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Всего активных" value={counts.total} icon="📋" />
        <StatBox label="Вакансий" value={counts.offers} icon="💼" />
        <StatBox label="Анкет" value={counts.searches} icon="🔍" />
        <StatBox label="Скоро истекут" value={counts.urgent} icon="⌛" />
      </div>

      <FilterSection
        filters={filters}
        setFilter={setFilter}
        onReset={handleReset}
        onSubmit={handleSubmit}
      />

      {!loading && !error ? (
        <p className="mb-4 text-xs text-muted">
          Найдено <span className="font-semibold text-foreground">{items.length}</span> объявлений
        </p>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm text-muted">Загружаем...</p>
        </div>
      ) : null}

      {error ? <Card className="p-4 text-sm text-accent">{error}</Card> : null}

      {!loading && !error && items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="mb-3 text-3xl">🔍</p>
          <h2 className="text-base font-semibold text-foreground">Объявлений не найдено</h2>
          <p className="mt-1 text-sm text-muted">
            Сбросьте фильтры или опубликуйте первое объявление.
          </p>
          <LinkButton
            to="/announcements/create"
            className="mt-4 inline-flex justify-center rounded-xl px-6 py-2.5 text-sm font-bold"
          >
            Опубликовать
          </LinkButton>
        </Card>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <AnnouncementCard
              key={item.id}
              announcement={item}
              onSaveToggle={handleSaveToggle}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-8 text-center text-[11px] text-muted">
        💡 Объявления автоматически удаляются по истечении срока. Контактные данные защищены частично.
        <br />
        <Link to="/announcements/mine" className="text-accent hover:underline">
          Управлять моими объявлениями →
        </Link>
      </p>
    </div>
  );
}

function StatBox({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-border bg-canvas p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted">
        <span className="mr-1" aria-hidden>{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

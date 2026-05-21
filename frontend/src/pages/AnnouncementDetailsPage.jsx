import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { CompyraEmoji, CompyraText } from "../components/ui/CompyraEmoji.jsx";
import { PlayerHoverCard } from "../components/ui/PlayerHoverCard.jsx";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  SKILL_LEVELS,
  SKILL_META,
  calcRemainingPercent,
  extractContactLink,
  formatDateTime,
  formatSalary,
  formatTtl,
  getCategoryMeta,
  getSkillMeta,
  getSourceMeta,
  getTtlColor,
} from "../utils/announcements.js";

function SkillBadge({ level, size = "md" }) {
  const meta = getSkillMeta(level);
  if (!meta) {
    return (
      <span className="rounded-full border border-border bg-elevated px-3 py-1 text-xs font-semibold text-muted">
        Любой уровень
      </span>
    );
  }
  const cls = size === "lg" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide ${cls}`}
      style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  );
}

function TtlBar({ announcement, refreshTrigger }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [refreshTrigger]);
  const liveTtl = useMemo(() => {
    const exp = new Date(announcement.expires_at).getTime();
    return Math.max(0, Math.floor((exp - now) / 1000));
  }, [announcement.expires_at, now]);
  const percent = useMemo(
    () => calcRemainingPercent({ ...announcement, ttl_seconds: liveTtl }),
    [announcement, liveTtl],
  );
  const color = getTtlColor(percent);
  const urgent = percent < 25;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted">
          <span aria-hidden>⏱️</span>
          <span>Истекает: {formatDateTime(announcement.expires_at)}</span>
        </span>
        <span className={`font-semibold tabular-nums ${urgent ? "animate-pulse" : ""}`} style={{ color }}>
          {formatTtl(liveTtl)} ({percent}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function RatingStars({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(star)}
          className={[
            "text-2xl transition-transform",
            value >= star ? "text-accent" : "text-border",
            disabled ? "cursor-default" : "hover:scale-110 hover:text-accent",
          ].join(" ")}
          aria-label={`Оценить на ${star}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ContactsBlock({ announcement, onLinkClick }) {
  const contacts = [
    { label: "Telegram", value: announcement.contact_handle, icon: "📨" },
    { label: "Ссылка", value: announcement.contact_link, icon: "🔗", isLink: true },
    { label: "Телефон", value: announcement.contact_phone, icon: "📞" },
    { label: "Email", value: announcement.contact_email, icon: "📧", isEmail: true },
  ].filter((c) => c.value);

  if (contacts.length === 0) {
    return <p className="text-sm text-muted">Контактные данные не указаны.</p>;
  }

  return (
    <div className="grid gap-2">
      {contacts.map((c) => {
        if (c.isLink) {
          const href = extractContactLink(c.value);
          return href ? (
            <a
              key={c.label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onLinkClick}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{c.icon}</span>
                <span className="truncate">{c.value}</span>
              </span>
              <span className="text-xs text-muted">Открыть →</span>
            </a>
          ) : (
            <div
              key={c.label}
              className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-foreground"
            >
              <span aria-hidden>{c.icon}</span>
              <span className="truncate">{c.value}</span>
            </div>
          );
        }
        if (c.isEmail) {
          return (
            <a
              key={c.label}
              href={`mailto:${c.value}`}
              onClick={onLinkClick}
              className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent"
            >
              <span aria-hidden>{c.icon}</span>
              <span className="truncate">{c.value}</span>
            </a>
          );
        }
        return (
          <div
            key={c.label}
            className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          >
            <span aria-hidden>{c.icon}</span>
            <span className="truncate">{c.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function RecommendedSkillBar({ stats }) {
  if (!stats || !stats.recommended_skill_level) {
    return (
      <p className="text-xs text-muted">
        Пока недостаточно данных для рекомендации уровня. Оцените объявление, чтобы помочь системе.
      </p>
    );
  }
  const meta = SKILL_META[stats.recommended_skill_level];
  if (!meta) return null;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">Рекомендуемый уровень</span>
        <span className="font-bold uppercase tracking-wide" style={{ color: meta.color }}>
          {meta.label} ({stats.recommended_score}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${stats.recommended_score}%`, backgroundColor: meta.color }}
        />
      </div>
    </div>
  );
}

function SkillBucketsBlock({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid gap-2">
      <p className="text-[11px] uppercase tracking-wider text-muted">Оценки по уровням</p>
      <div className="grid gap-1.5">
        {SKILL_LEVELS.map((level) => {
          const bucket = stats.rating_by_skill_level?.[level];
          const meta = SKILL_META[level];
          const filled = Math.round(bucket?.average ?? 0);
          return (
            <div key={level} className="flex items-center gap-2 text-xs">
              <span
                className="w-16 rounded-full px-2 py-0.5 text-center font-bold uppercase"
                style={{ color: meta.color, backgroundColor: meta.bg }}
              >
                {meta.label}
              </span>
              <span className="text-accent">
                {"★".repeat(filled)}
                <span className="text-border">{"★".repeat(5 - filled)}</span>
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                {bucket?.count ? bucket.average.toFixed(1) : "—"}
              </span>
              <span className="text-muted">
                ({bucket?.count ?? 0} {bucket?.count === 1 ? "оценка" : "оценок"})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnnouncementDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingSkill, setRatingSkill] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [savedToast, setSavedToast] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [refreshingHH, setRefreshingHH] = useState(false);
  const isOwner = announcement?.author_id === user?.id && announcement?.author_id != null;
  const isHH = announcement?.source_type === "hh";

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [annData, statsData] = await Promise.all([
        apiFetch(`/announcements/${id}`),
        apiFetch(`/announcements/${id}/stats`).catch(() => null),
      ]);
      setAnnouncement(annData);
      setStats(statsData);
      if (annData.my_rating) setRating(annData.my_rating);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить объявление.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Count this open as a "view" once per mount. We use a noop-on-error promise
  // because views shouldn't block UX (e.g. expired item).
  useEffect(() => {
    if (!id) return;
    apiFetch(`/announcements/${id}/view`, { method: "POST", auth: false }).catch(() => {});
  }, [id]);

  // For hh-sourced rows, the data we already have is just the search snippet.
  // Ask the backend to pull the full /vacancies/{id} payload from hh and
  // upgrade our local copy with the complete description + any contacts the
  // employer exposed.
  useEffect(() => {
    if (!announcement) return;
    if (announcement.source_type !== "hh") return;
    if (refreshingHH) return;
    let cancelled = false;
    setRefreshingHH(true);
    apiFetch(`/announcements/${announcement.id}/refresh-hh`, { method: "POST", auth: false })
      .then((updated) => {
        if (cancelled || !updated) return;
        setAnnouncement(updated);
      })
      .catch(() => {
        // Non-fatal — keep the snippet we already have.
      })
      .finally(() => {
        if (!cancelled) setRefreshingHH(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement?.id, announcement?.source_type]);

  async function handleRate() {
    if (!rating) return;
    setSubmittingRating(true);
    try {
      const updated = await apiFetch(`/announcements/${id}/rate`, {
        method: "POST",
        body: { rating, user_skill_level: ratingSkill || null },
      });
      setAnnouncement(updated);
      // Reload stats so the recommended level recalculates.
      const newStats = await apiFetch(`/announcements/${id}/stats`).catch(() => null);
      if (newStats) setStats(newStats);
      setSavedToast("Оценка сохранена");
      setTimeout(() => setSavedToast(""), 2500);
    } catch (e) {
      setError(e?.message || "Не удалось сохранить оценку.");
    } finally {
      setSubmittingRating(false);
    }
  }

  async function handleSave() {
    try {
      const res = await apiFetch(`/announcements/${id}/save`, { method: "POST" });
      setAnnouncement((prev) =>
        prev ? { ...prev, is_saved_by_me: res.saved, save_count: res.save_count } : prev,
      );
    } catch {
      // intentionally swallow — save errors don't block the page
    }
  }

  async function handleDelete() {
    if (!isOwner) return;
    if (!window.confirm("Удалить это объявление? Действие необратимо.")) return;
    setDeleting(true);
    try {
      await apiFetch(`/announcements/${id}`, { method: "DELETE" });
      navigate("/announcements/mine");
    } catch (e) {
      setError(e?.message || "Не удалось удалить.");
      setDeleting(false);
    }
  }

  function trackClick() {
    apiFetch(`/announcements/${id}/click`, { method: "POST", auth: false }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <p className="text-sm text-muted">Загружаем...</p>
      </div>
    );
  }

  if (error && !announcement) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <Card className="p-6 text-center">
          <p className="mb-2 text-3xl">⚠️</p>
          <p className="text-sm text-accent">{error}</p>
          <LinkButton to="/announcements" className="mt-4 inline-flex">
            ← Назад к списку
          </LinkButton>
        </Card>
      </div>
    );
  }

  if (!announcement) return null;

  const catMeta = getCategoryMeta(announcement.category);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-4xl md:px-6 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <LinkButton to="/announcements" variant="ghost" className="text-sm">
          ← Назад
        </LinkButton>
        {isOwner ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-btn border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:border-red-500 hover:text-red-200 disabled:opacity-50"
          >
            {deleting ? "Удаляем..." : "🗑 Удалить"}
          </button>
        ) : null}
      </div>

      <Card className="mb-4 grid gap-4">
        <TtlBar announcement={announcement} refreshTrigger={announcement.id} />

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-canvas px-3 py-1 text-xs font-semibold text-muted">
              {catMeta.icon} {catMeta.label}
            </span>
            <SkillBadge level={announcement.skill_level} size="lg" />
            {(() => {
              const sm = getSourceMeta(announcement.source_type, announcement.external_url);
              return (
                <span
                  className="rounded-full border px-3 py-1 text-xs font-bold uppercase"
                  style={{ color: sm.color, backgroundColor: sm.bg, borderColor: sm.border }}
                >
                  {sm.icon} {sm.label}
                </span>
              );
            })()}
          </div>

          <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {announcement.title}
          </h1>

          {formatSalary(announcement) ? (
            <p className="text-lg font-bold text-accent">💰 {formatSalary(announcement)}</p>
          ) : null}

          <div className="text-xs text-muted">
            {isHH ? (
              <>
                {announcement.employer_name ?? "Работодатель"}
                {announcement.area_name ? ` • ${announcement.area_name}` : ""}
                {" • "}Опубликовано {formatDateTime(announcement.created_at)}
              </>
            ) : (
              <>
                Опубликовано {formatDateTime(announcement.created_at)} •{" "}
                <PlayerHoverCard userId={announcement.author_id} disabled={!announcement.author_id}>
                  <span className={announcement.author_id ? "cursor-pointer text-foreground/80 underline-offset-2 hover:text-accent hover:underline" : ""}>
                    {announcement.author_display_name ?? "Аноним"}
                  </span>
                </PlayerHoverCard>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(announcement.tags ?? []).map((tag) => (
            <span
              key={tag}
              className="rounded-lg border border-border bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="rounded-xl border border-border/60 bg-canvas/40 p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {announcement.description}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <Metric icon="👁️" value={announcement.view_count} label="просм." />
          <Metric icon="🔗" value={announcement.click_count} label="клик." />
          <Metric icon="💾" value={announcement.save_count} label="сохр." />
          <Metric
            icon="⭐"
            value={announcement.rating_avg ? announcement.rating_avg.toFixed(1) : "—"}
            label={`(${announcement.rating_count})`}
          />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="grid gap-3">
          {isHH ? (
            <>
              {(() => {
                const sm = getSourceMeta(announcement.source_type, announcement.external_url);
                return (
                  <>
                    <h2 className="text-sm font-semibold text-foreground">💼 Вакансия на {sm.label}</h2>
                    <p className="text-xs text-muted">
                      Это вакансия с {sm.label}. Контакты соискателя доступны только зарегистрированному
                      пользователю HH. Откликнитесь на сайте.
                    </p>
                    {announcement.external_url ? (
                      <a
                        href={announcement.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={trackClick}
                        className="inline-flex items-center justify-center gap-2 rounded-btn px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
                        style={{ backgroundColor: "#D6001C" }}
                      >
                        🔗 Откликнуться на {sm.label}
                      </a>
                    ) : null}
                  </>
                );
              })()}
              <button
                type="button"
                onClick={handleSave}
                className={[
                  "rounded-btn border px-4 py-2.5 text-sm font-semibold transition",
                  announcement.is_saved_by_me
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-accent",
                ].join(" ")}
              >
                {announcement.is_saved_by_me ? "✓ Сохранено" : "💾 Сохранить"}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-foreground">📞 Контакты</h2>
              <ContactsBlock announcement={announcement} onLinkClick={trackClick} />
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleSave}
                  className={[
                    "flex-1 rounded-btn border px-4 py-2.5 text-sm font-semibold transition",
                    announcement.is_saved_by_me
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-accent",
                  ].join(" ")}
                >
                  {announcement.is_saved_by_me ? "✓ Сохранено" : "💾 Сохранить"}
                </button>
              </div>
            </>
          )}
        </Card>

        {isHH ? (
          <Card className="grid gap-3">
            <h2 className="text-sm font-semibold text-foreground">📊 Сводка</h2>
            <div className="grid gap-1.5 text-sm text-foreground">
              {announcement.employer_name ? (
                <div className="flex justify-between">
                  <span className="text-muted">Компания:</span>
                  <span className="font-semibold">{announcement.employer_name}</span>
                </div>
              ) : null}
              {announcement.area_name ? (
                <div className="flex justify-between">
                  <span className="text-muted">Регион:</span>
                  <span className="font-semibold">{announcement.area_name}</span>
                </div>
              ) : null}
              {announcement.skill_level ? (
                <div className="flex justify-between">
                  <span className="text-muted">Уровень:</span>
                  <span className="font-semibold">
                    {SKILL_META[announcement.skill_level]?.label ?? announcement.skill_level}
                  </span>
                </div>
              ) : null}
              {formatSalary(announcement) ? (
                <div className="flex justify-between">
                  <span className="text-muted">Зарплата:</span>
                  <span className="font-semibold text-accent">{formatSalary(announcement)}</span>
                </div>
              ) : null}
            </div>

            {/* Contacts block — only renders rows that have data. For most
                hh-vacancies all of these are empty (employer didn't opt in). */}
            {(announcement.contact_handle || announcement.contact_phone || announcement.contact_email) ? (
              <>
                <div className="my-1 border-t border-border/40" />
                <p className="text-[11px] uppercase tracking-wider text-muted">Контакты</p>
                <div className="grid gap-1.5 text-sm">
                  {announcement.contact_handle ? (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted">👤</span>
                      <span className="flex-1 text-right font-medium text-foreground">
                        {announcement.contact_handle}
                      </span>
                    </div>
                  ) : null}
                  {announcement.contact_phone ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted">📞 Телефон / WhatsApp</span>
                      <a
                        href={`tel:${announcement.contact_phone.replace(/\s+/g, "")}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {announcement.contact_phone}
                      </a>
                    </div>
                  ) : null}
                  {announcement.contact_email ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted">📧 Email</span>
                      <a
                        href={`mailto:${announcement.contact_email}`}
                        className="truncate font-semibold text-accent hover:underline"
                      >
                        {announcement.contact_email}
                      </a>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            <p className="mt-2 text-[11px] text-muted">
              Источник: {getSourceMeta(announcement.source_type, announcement.external_url).label}.
              {refreshingHH ? " Обновляем описание…" : " Данные обновляются автоматически."}
            </p>
          </Card>
        ) : (
          <Card className="grid gap-4">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <CompyraEmoji name="target" size={16} />
              Анализ уровня
            </h2>
            <RecommendedSkillBar stats={stats} />
            <SkillBucketsBlock stats={stats} />
          </Card>
        )}
      </div>

      {isHH ? null : isOwner ? (
        <Card className="mt-4 p-4 text-xs text-muted">
          Это ваше объявление — оценка от автора отключена. Вы видите полный номер телефона.
        </Card>
      ) : (
        <Card className="mt-4 grid gap-3 p-4">
          <h2 className="text-sm font-semibold text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CompyraEmoji name="star" size={16} />
              Оцените это объявление
            </span>
          </h2>
          <p className="text-xs text-muted">
            Ваша оценка поможет другим. Укажите свой уровень — это сделает рекомендацию точнее.
          </p>
          <RatingStars value={rating} onChange={setRating} disabled={submittingRating} />
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">
              Ваш уровень (необязательно)
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRatingSkill("")}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  ratingSkill === ""
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-foreground",
                ].join(" ")}
              >
                Не указывать
              </button>
              {SKILL_LEVELS.map((level) => {
                const meta = SKILL_META[level];
                const active = ratingSkill === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setRatingSkill(level)}
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
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {savedToast || (announcement.my_rating ? `Ваша оценка: ${announcement.my_rating}/5` : "")}
            </span>
            <Button onClick={handleRate} disabled={!rating || submittingRating}>
              {submittingRating ? "Сохраняем..." : announcement.my_rating ? "Обновить" : "Оценить"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({ icon, value, label }) {
  return (
    <div className="rounded-xl border border-border bg-canvas px-3 py-2 text-center">
      <p className="text-xl font-bold text-foreground tabular-nums">
        <span className="mr-1" aria-hidden>
          <CompyraText size={20}>{icon}</CompyraText>
        </span>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

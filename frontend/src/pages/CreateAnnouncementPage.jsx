import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import {
  CATEGORY_META,
  DURATION_OPTIONS,
  SKILL_LEVELS,
  SKILL_META,
} from "../utils/announcements.js";

function FieldLabel({ children, hint }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-foreground">{children}</span>
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLASS =
  "h-12 w-full rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground outline-none transition focus:border-accent/60 md:h-auto md:rounded-btn md:py-2";
const TEXTAREA_CLASS =
  "min-h-[180px] w-full rounded-[12px] border border-border bg-canvas px-3 py-3 text-sm text-foreground outline-none transition focus:border-accent/60 md:rounded-btn";

export function CreateAnnouncementPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("work_search");
  const [skillLevel, setSkillLevel] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [contactHandle, setContactHandle] = useState("");
  const [contactLink, setContactLink] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const tags = useMemo(
    () =>
      tagsText
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 20),
    [tagsText],
  );

  const hasAnyContact = Boolean(
    contactHandle.trim() || contactLink.trim() || contactPhone.trim() || contactEmail.trim(),
  );

  const isValid = useMemo(
    () =>
      title.trim().length >= 3 &&
      description.trim().length >= 10 &&
      hasAnyContact &&
      DURATION_OPTIONS.some((o) => o.hours === durationHours),
    [title, description, hasAnyContact, durationHours],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    if (!isValid) {
      setSubmitting(false);
      setError("Заполните название (3+), описание (10+) и хотя бы один способ связи.");
      return;
    }
    try {
      const created = await apiFetch("/announcements", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          category,
          skill_level: skillLevel || null,
          duration_hours: durationHours,
          contact_handle: contactHandle.trim() || null,
          contact_link: contactLink.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
          tags,
        },
      });
      navigate(`/announcements/${created.id}`);
    } catch (e2) {
      setError(e2?.message || "Не удалось опубликовать объявление.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-3xl md:px-6 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Опубликовать объявление</h1>
          <p className="mt-1 text-sm text-muted">
            Объявление будет видно сообществу в течение выбранного срока. После — удалится автоматически.
          </p>
        </div>
        <LinkButton to="/announcements" variant="secondary" className="hidden md:inline-flex">
          Назад
        </LinkButton>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <FieldLabel>
            Название
            <input
              className={INPUT_CLASS}
              placeholder="Ищу Middle React разработчика на проект"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </FieldLabel>

          <FieldLabel hint="Минимум 10 символов. Опишите задачу, требования и условия.">
            Описание
            <textarea
              className={TEXTAREA_CLASS}
              placeholder="Стек: React 18, TypeScript, TailwindCSS. Удалёнка, ставка договорная..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </FieldLabel>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Категория</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_META).map(([value, meta]) => {
                const active = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={[
                      "rounded-full border px-4 py-2 text-sm font-semibold transition",
                      active
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-foreground",
                    ].join(" ")}
                  >
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              Уровень скила <span className="text-muted">(необязательно)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSkillLevel("")}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  skillLevel === ""
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-foreground",
                ].join(" ")}
              >
                Любой
              </button>
              {SKILL_LEVELS.map((level) => {
                const meta = SKILL_META[level];
                const active = skillLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSkillLevel(level)}
                    className="rounded-full border px-4 py-2 text-sm font-bold uppercase transition"
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

          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              Сколько объявление держится в ленте
            </span>
            <p className="text-[11px] text-muted">
              По истечении срока объявление автоматически удаляется. Статистика не сохраняется.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
              {DURATION_OPTIONS.map((opt) => {
                const active = durationHours === opt.hours;
                return (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => setDurationHours(opt.hours)}
                    className={[
                      "relative flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-sm font-semibold transition",
                      active
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-canvas text-muted hover:border-accent/40 hover:text-foreground",
                    ].join(" ")}
                  >
                    <span>{opt.label}</span>
                    {opt.recommended ? (
                      <span className="text-[9px] uppercase tracking-wider text-accent/80">рекоменд.</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-canvas/50 p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">📞 Контакты</p>
            <p className="mb-4 text-[11px] text-muted">
              Укажите хотя бы один способ связи. Телефон будет частично замаскирован для других пользователей.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel hint="Например: @nickname">
                Telegram handle
                <input
                  className={INPUT_CLASS}
                  placeholder="@username"
                  value={contactHandle}
                  onChange={(e) => setContactHandle(e.target.value)}
                  maxLength={255}
                />
              </FieldLabel>
              <FieldLabel hint="Например: https://t.me/...">
                Ссылка
                <input
                  className={INPUT_CLASS}
                  placeholder="https://..."
                  value={contactLink}
                  onChange={(e) => setContactLink(e.target.value)}
                  maxLength={500}
                />
              </FieldLabel>
              <FieldLabel>
                Телефон
                <input
                  className={INPUT_CLASS}
                  placeholder="+7..."
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  maxLength={50}
                />
              </FieldLabel>
              <FieldLabel>
                Email
                <input
                  className={INPUT_CLASS}
                  type="email"
                  placeholder="you@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  maxLength={255}
                />
              </FieldLabel>
            </div>
          </div>

          <FieldLabel hint="Через запятую. Например: react, typescript, startup, remote">
            Теги
            <input
              className={INPUT_CLASS}
              placeholder="react, typescript, remote"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
          </FieldLabel>
          {tags.length > 0 ? (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-border bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          {error ? <div className="text-sm text-accent">{error}</div> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <LinkButton
              to="/announcements"
              variant="secondary"
              className="h-12 w-full justify-center rounded-[12px] sm:h-auto sm:w-auto sm:rounded-btn"
            >
              Отмена
            </LinkButton>
            <Button
              type="submit"
              disabled={submitting || !isValid}
              className="h-12 w-full rounded-[12px] text-base sm:h-auto sm:w-auto sm:rounded-btn sm:text-sm"
            >
              {submitting ? "Публикация..." : "Опубликовать"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

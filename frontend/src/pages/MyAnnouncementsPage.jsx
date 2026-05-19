import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import {
  calcRemainingPercent,
  formatDateTime,
  formatTtl,
  getCategoryMeta,
  getSkillMeta,
  getTtlColor,
} from "../utils/announcements.js";

function Row({ announcement, onDelete }) {
  const catMeta = getCategoryMeta(announcement.category);
  const skillMeta = getSkillMeta(announcement.skill_level);
  const percent = calcRemainingPercent(announcement);
  const color = getTtlColor(percent);

  return (
    <Card className="grid gap-3 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <Link
            to={`/announcements/${announcement.id}`}
            className="text-sm font-semibold text-foreground transition hover:text-accent"
          >
            <span className="mr-1.5" aria-hidden>{catMeta.icon}</span>
            {announcement.title}
          </Link>
          <p className="mt-1 text-[11px] text-muted">
            Создано {formatDateTime(announcement.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {skillMeta ? (
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: skillMeta.color, backgroundColor: skillMeta.bg, borderColor: skillMeta.border }}
            >
              {skillMeta.label}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onDelete(announcement.id)}
            className="rounded-btn border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-300 transition hover:border-red-500 hover:text-red-200"
          >
            🗑
          </button>
        </div>
      </div>

      <div className="grid gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">⏱️ Истечёт через</span>
          <span className="font-semibold tabular-nums" style={{ color }}>
            {formatTtl(announcement.ttl_seconds)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
          <div className="h-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
        <Metric label="Просм." value={announcement.view_count} />
        <Metric label="Клик." value={announcement.click_count} />
        <Metric label="Сохр." value={announcement.save_count} />
        <Metric
          label={`(${announcement.rating_count})`}
          value={announcement.rating_avg ? `★ ${announcement.rating_avg.toFixed(1)}` : "—"}
        />
      </div>
    </Card>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-canvas px-2 py-1.5">
      <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-muted">{label}</p>
    </div>
  );
}

export function MyAnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/announcements/mine");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить ваши объявления.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id) {
    if (!window.confirm("Удалить это объявление? Действие необратимо.")) return;
    try {
      await apiFetch(`/announcements/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e?.message || "Не удалось удалить.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-4xl md:px-6 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Мои объявления</h1>
          <p className="mt-1 text-sm text-muted">
            Активные объявления, которые вы опубликовали. После истечения срока они удаляются автоматически.
          </p>
        </div>
        <LinkButton to="/announcements/create" className="hidden md:inline-flex">
          + Новое
        </LinkButton>
      </div>

      <div className="mb-4 flex gap-2 md:hidden">
        <LinkButton to="/announcements" variant="secondary" className="flex-1 justify-center">
          ← Лента
        </LinkButton>
        <LinkButton to="/announcements/create" className="flex-1 justify-center">
          + Новое
        </LinkButton>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm text-muted">Загружаем...</p>
        </div>
      ) : null}

      {error ? <Card className="p-4 text-sm text-accent">{error}</Card> : null}

      {!loading && !error && items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="mb-3 text-3xl">📋</p>
          <h2 className="text-base font-semibold text-foreground">У вас нет активных объявлений</h2>
          <p className="mt-1 text-sm text-muted">
            Опубликуйте первое и получайте отклики от сообщества.
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
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Row key={item.id} announcement={item} onDelete={handleDelete} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

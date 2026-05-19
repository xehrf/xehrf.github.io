import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card.jsx";
import { CompyraText } from "../components/ui/CompyraEmoji.jsx";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { PlayerHoverCard } from "../components/ui/PlayerHoverCard.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";

const KIND_PRESENTATION = {
  match_win: { icon: "🏆", verb: "победил в матче", tone: "text-yellow-400" },
  match_loss: { icon: "💢", verb: "проиграл матч", tone: "text-red-400" },
  rating_change: { icon: "📊", verb: "получил очки", tone: "text-accent" },
  submission_accepted: { icon: "✅", verb: "решил задачу", tone: "text-green-400" },
  friend_added: { icon: "🤝", verb: "добавил в друзья", tone: "text-blue-400" },
};

function Avatar({ user }) {
  const [broken, setBroken] = useState(false);
  const url = resolveAssetUrl(user?.avatar_url || "");
  const initial = (user?.nickname || user?.display_name || "?")[0]?.toUpperCase();
  return (
    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-border bg-elevated">
      {url && !broken ? (
        <MediaAsset src={url} alt={user?.display_name} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-foreground">{initial}</div>
      )}
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU");
}

function EventRow({ event }) {
  const pres = KIND_PRESENTATION[event.kind] || { icon: "•", verb: event.kind, tone: "text-muted" };
  const payload = event.payload || {};
  let detail = "";
  if (event.kind === "rating_change") {
    const d = payload.pts_delta || 0;
    detail = `${d >= 0 ? "+" : ""}${d} PTS · ${payload.reason || ""}`;
  } else if (event.kind === "match_win") {
    detail = `Матч #${payload.match_id} · +${payload.pts_awarded ?? 0} PTS`;
  } else if (event.kind === "submission_accepted") {
    detail = `Задача #${payload.task_id}`;
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-canvas/70 p-3">
      <div className="text-2xl">
        <CompyraText size={26}>{pres.icon}</CompyraText>
      </div>
      <PlayerHoverCard userId={event.actor?.id}>
        <div className="flex flex-1 cursor-pointer items-start gap-3 min-w-0">
          <Avatar user={event.actor} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{event.actor?.display_name || "Игрок"}</span>{" "}
              <span className="text-muted">{pres.verb}</span>
            </p>
            {detail ? <p className={`text-xs ${pres.tone}`}>{detail}</p> : null}
            <p className="mt-0.5 text-[11px] text-muted">{timeAgo(event.created_at)}</p>
          </div>
        </div>
      </PlayerHoverCard>
    </div>
  );
}

export function ActivityPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch("/social/activity?limit=50");
        if (!mounted) return;
        setEvents(data || []);
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить ленту");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Активность</h1>
        <p className="mt-1 text-sm text-muted">Что происходит у вас и друзей</p>
      </header>

      <Card className="p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Загрузка...</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-400">{error}</p>
        ) : events.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl">📡</p>
            <p className="mt-3 text-sm text-muted">Здесь пока тихо. Добавьте друзей или сыграйте матч.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((ev, i) => (
              <EventRow key={`${ev.kind}-${ev.created_at}-${i}`} event={ev} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

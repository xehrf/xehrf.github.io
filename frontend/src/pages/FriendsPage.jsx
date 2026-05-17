import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { PlayerHoverCard } from "../components/ui/PlayerHoverCard.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";

function Avatar({ user, size = 10 }) {
  const [broken, setBroken] = useState(false);
  const url = resolveAssetUrl(user?.avatar_url || "");
  const initial = (user?.nickname || user?.display_name || "?")[0]?.toUpperCase();
  const dim = `h-${size} w-${size}`;
  return (
    <div className={`${dim} flex-shrink-0 overflow-hidden rounded-full border border-border bg-elevated`}>
      {url && !broken ? (
        <MediaAsset src={url} alt={user.display_name} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-foreground">{initial}</div>
      )}
    </div>
  );
}

function FriendRow({ friend, onRemove, onMessage }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-canvas/70 p-3 transition hover:border-accent/30">
      <PlayerHoverCard userId={friend.user.id}>
        <div className="flex flex-1 cursor-pointer items-center gap-3 min-w-0">
          <Avatar user={friend.user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{friend.user.display_name}</p>
            <p className="truncate text-xs text-muted">@{friend.user.nickname} · {friend.user.pts ?? 0} PTS</p>
          </div>
        </div>
      </PlayerHoverCard>
      <div className="flex gap-2">
        <Link
          to={`/social/messages/${friend.user.id}`}
          onClick={onMessage}
          className="rounded-xl border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent/50 hover:text-accent"
        >
          💬
        </Link>
        <button
          type="button"
          onClick={() => onRemove(friend.user.id)}
          className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted transition hover:border-red-500/40 hover:text-red-400"
          title="Удалить из друзей"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function PendingRow({ entry, onAccept, onDecline, onCancel }) {
  const incoming = entry.direction === "incoming";
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-canvas/70 p-3">
      <PlayerHoverCard userId={entry.user.id}>
        <div className="flex flex-1 cursor-pointer items-center gap-3 min-w-0">
          <Avatar user={entry.user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{entry.user.display_name}</p>
            <p className="truncate text-xs text-muted">
              {incoming ? "хочет добавить в друзья" : "ожидает ответа"}
            </p>
          </div>
        </div>
      </PlayerHoverCard>
      <div className="flex gap-2">
        {incoming ? (
          <>
            <button
              type="button"
              onClick={() => onAccept(entry.id)}
              className="rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-black transition hover:bg-accent/90"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => onDecline(entry.id)}
              className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted transition hover:border-red-500/40 hover:text-red-400"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onCancel(entry.user.id)}
            className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted transition hover:border-red-500/40 hover:text-red-400"
          >
            Отменить
          </button>
        )}
      </div>
    </div>
  );
}

function SearchResultRow({ user, onAdd, isFriendOrPending }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-canvas/70 p-3">
      <PlayerHoverCard userId={user.id}>
        <div className="flex flex-1 cursor-pointer items-center gap-3 min-w-0">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{user.display_name}</p>
            <p className="truncate text-xs text-muted">@{user.nickname} · {user.pts ?? 0} PTS</p>
          </div>
        </div>
      </PlayerHoverCard>
      <button
        type="button"
        onClick={() => onAdd(user.id)}
        disabled={isFriendOrPending}
        className="rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-black transition hover:bg-accent/90 disabled:opacity-40"
      >
        {isFriendOrPending ? "✓" : "+ Добавить"}
      </button>
    </div>
  );
}

export function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState("friends");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const knownUserIds = new Set([
    ...friends.map((f) => f.user.id),
    ...pending.map((p) => p.user.id),
  ]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [f, p] = await Promise.all([
        apiFetch("/social/friends"),
        apiFetch("/social/friends/pending"),
      ]);
      setFriends(f || []);
      setPending(p || []);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await apiFetch(`/social/users/search?q=${encodeURIComponent(query.trim())}`);
        setSearchResults(data || []);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function handleAdd(userId) {
    try {
      await apiFetch("/social/friends/requests", { method: "POST", body: { user_id: userId } });
      await refresh();
    } catch (e) {
      setError(e?.message || "Не удалось отправить заявку");
    }
  }

  async function handleAccept(friendshipId) {
    try {
      await apiFetch(`/social/friends/requests/${friendshipId}/accept`, { method: "POST" });
      await refresh();
    } catch (e) { setError(e?.message || "Ошибка"); }
  }

  async function handleDecline(friendshipId) {
    try {
      await apiFetch(`/social/friends/requests/${friendshipId}/decline`, { method: "POST" });
      await refresh();
    } catch (e) { setError(e?.message || "Ошибка"); }
  }

  async function handleRemove(userId) {
    if (!window.confirm("Удалить из друзей?")) return;
    try {
      await apiFetch(`/social/friends/${userId}`, { method: "DELETE" });
      await refresh();
    } catch (e) { setError(e?.message || "Ошибка"); }
  }

  const incoming = pending.filter((p) => p.direction === "incoming");
  const outgoing = pending.filter((p) => p.direction === "outgoing");

  const tabs = [
    { id: "friends", label: `Друзья · ${friends.length}` },
    { id: "incoming", label: `Входящие · ${incoming.length}` },
    { id: "outgoing", label: `Отправленные · ${outgoing.length}` },
    { id: "search", label: "Поиск" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Друзья</h1>
        <p className="mt-1 text-sm text-muted">Соберите свою команду и следите за прогрессом</p>
      </header>

      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "min-w-[120px] whitespace-nowrap px-4 py-3 text-xs font-semibold transition",
                activeTab === tab.id ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

          {activeTab === "search" ? (
            <div className="space-y-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по никнейму..."
                className="w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
              />
              <div className="space-y-2">
                {searchResults.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">
                    {query.trim() ? "Ничего не найдено" : "Начните вводить, чтобы найти игрока"}
                  </p>
                ) : (
                  searchResults.map((u) => (
                    <SearchResultRow key={u.id} user={u} onAdd={handleAdd} isFriendOrPending={knownUserIds.has(u.id)} />
                  ))
                )}
              </div>
            </div>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-muted">Загрузка...</p>
          ) : activeTab === "friends" ? (
            <div className="space-y-2">
              {friends.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-4xl">🤝</p>
                  <p className="mt-2 text-sm text-muted">Пока нет друзей. Поищите кого-нибудь во вкладке «Поиск».</p>
                </div>
              ) : (
                friends.map((f) => <FriendRow key={f.id} friend={f} onRemove={handleRemove} />)
              )}
            </div>
          ) : activeTab === "incoming" ? (
            <div className="space-y-2">
              {incoming.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">Нет входящих заявок</p>
              ) : (
                incoming.map((p) => (
                  <PendingRow key={p.id} entry={p} onAccept={handleAccept} onDecline={handleDecline} />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {outgoing.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">Нет отправленных заявок</p>
              ) : (
                outgoing.map((p) => (
                  <PendingRow key={p.id} entry={p} onCancel={handleRemove} onAccept={handleAccept} onDecline={handleDecline} />
                ))
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

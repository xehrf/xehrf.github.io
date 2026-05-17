import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { PlayerHoverCard } from "../components/ui/PlayerHoverCard.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

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

function ConversationRow({ conv, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
        active ? "border-accent/50 bg-accent/10" : "border-border bg-canvas/70 hover:border-border/80",
      ].join(" ")}
    >
      <Avatar user={conv.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{conv.user.display_name}</p>
          {conv.unread_count > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {conv.unread_count}
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted">{conv.last_message || "—"}</p>
      </div>
    </button>
  );
}

function Bubble({ msg, mine }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
          mine ? "rounded-br-sm bg-accent text-black" : "rounded-bl-sm bg-elevated text-foreground",
        ].join(" ")}
      >
        <p className="break-words whitespace-pre-wrap">{msg.body}</p>
        <p className={`mt-1 text-[10px] ${mine ? "text-black/60" : "text-muted"}`}>
          {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export function MessagesPage() {
  const { user } = useAuth();
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [thread, setThread] = useState([]);
  const [partner, setPartner] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const pollRef = useRef(null);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await apiFetch("/social/dms");
      setConversations(data || []);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить");
    }
  }, []);

  const refreshThread = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await apiFetch(`/social/dms/${id}`);
      setThread(data || []);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить чат");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refreshConversations().finally(() => setLoading(false));
  }, [refreshConversations]);

  useEffect(() => {
    if (!partnerId) {
      setThread([]);
      setPartner(null);
      return;
    }
    refreshThread(partnerId);
    apiFetch(`/users/${partnerId}/profile`)
      .then((p) => setPartner(p))
      .catch(() => setPartner(null));

    // Light polling: every 5s refresh active thread for incoming messages
    pollRef.current = setInterval(() => {
      refreshThread(partnerId);
      refreshConversations();
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [partnerId, refreshThread, refreshConversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !partnerId || sending) return;
    setSending(true);
    const body = text.trim();
    setText("");
    try {
      const msg = await apiFetch(`/social/dms/${partnerId}`, { method: "POST", body: { body } });
      setThread((prev) => [...prev, msg]);
      refreshConversations();
    } catch (err) {
      setError(err?.message || "Не отправилось");
      setText(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Сообщения</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <Card className="p-3">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">Диалоги</h2>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted">Загрузка...</p>
          ) : conversations.length === 0 ? (
            <p className="py-6 px-2 text-center text-sm text-muted">
              Пока нет диалогов. Напишите другу со страницы «Друзья».
            </p>
          ) : (
            <div className="space-y-2">
              {conversations.map((c) => (
                <ConversationRow
                  key={c.user.id}
                  conv={c}
                  active={Number(partnerId) === c.user.id}
                  onClick={() => navigate(`/social/messages/${c.user.id}`)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Thread */}
        <Card className="flex min-h-[480px] flex-col p-0">
          {!partnerId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <p className="text-4xl">💬</p>
                <p className="mt-2 text-sm text-muted">Выберите диалог слева</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border p-3">
                <PlayerHoverCard userId={partnerId}>
                  <div className="flex cursor-pointer items-center gap-3">
                    <Avatar user={partner} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {partner?.display_name || "..."}
                      </p>
                      <p className="truncate text-xs text-muted">@{partner?.nickname || ""}</p>
                    </div>
                  </div>
                </PlayerHoverCard>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: 480 }}>
                {thread.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">Начните разговор 👋</p>
                ) : (
                  thread.map((m) => (
                    <Bubble key={m.id} msg={m} mine={m.sender_id === user?.id} />
                  ))
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                  placeholder="Сообщение..."
                  className="flex-1 rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black transition hover:bg-accent/90 disabled:opacity-40"
                >
                  ↑
                </button>
              </form>
            </>
          )}
        </Card>
      </div>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

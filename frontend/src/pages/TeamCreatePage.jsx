import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { apiFetch } from "../api/client";

const MAX_MEMBERS_OPTIONS = [2, 3, 4, 5, 6, 8, 10];

export function TeamCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(5);
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) { setError("Название не может быть пустым"); return; }
    setLoading(true);
    setError("");
    try {
      const team = await apiFetch("/teams", {
        method: "POST",
        body: { name: name.trim(), description: description.trim(), max_members: maxMembers, is_open: isOpen },
      });
      navigate(team?.team_id ? `/team/${team.team_id}` : "/team");
    } catch (err) {
      setError(err?.message || "Не удалось создать команду");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate("/team")}
        className="mb-6 flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
      >
        ← Назад к командам
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Создать команду</h1>
        <p className="mt-1 text-sm text-muted">Придумайте название, соберите состав и побеждайте вместе.</p>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Decorative header */}
        <div className="h-2 w-full bg-gradient-to-r from-accent via-yellow-300 to-accent" />

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Название команды <span className="text-accent">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
              placeholder="Например: Alpha Squad"
            />
            <p className="mt-1 text-right text-[11px] text-muted">{name.length}/40</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full resize-none rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
              placeholder="Расскажите о команде: цели, стек, кого ищете..."
            />
            <p className="mt-1 text-right text-[11px] text-muted">{description.length}/200</p>
          </div>

          {/* Max members */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Максимум участников
            </label>
            <div className="flex flex-wrap gap-2">
              {MAX_MEMBERS_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxMembers(n)}
                  className={[
                    "h-10 w-10 rounded-xl border text-sm font-semibold transition",
                    maxMembers === n
                      ? "border-accent bg-accent text-black"
                      : "border-border bg-canvas text-foreground hover:border-accent/50",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Open / Invite */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Тип вступления
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  isOpen ? "border-accent bg-accent/5" : "border-border bg-canvas hover:border-accent/30",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-foreground">🌐 Открытая</p>
                <p className="mt-1 text-xs text-muted">Любой может подать заявку</p>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  !isOpen ? "border-accent bg-accent/5" : "border-border bg-canvas hover:border-accent/30",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-foreground">🔒 По инвайту</p>
                <p className="mt-1 text-xs text-muted">Только по приглашению капитана</p>
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full h-12 rounded-2xl text-sm font-bold"
          >
            {loading ? "Создаём..." : "Создать команду →"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

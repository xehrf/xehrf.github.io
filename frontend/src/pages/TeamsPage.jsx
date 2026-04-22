import { useEffect, useState } from "react";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";

export function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextQuery = "") {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/teams${nextQuery ? `?search=${encodeURIComponent(nextQuery)}` : ""}`);
      setTeams(data ?? []);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить команды");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Команды</h1>
          <p className="mt-1 text-sm text-muted">Найдите команду или создайте свою</p>
        </div>
        <LinkButton
          to="/team/create"
          className="h-12 justify-center rounded-[12px] px-6 py-3 text-sm font-semibold"
        >
          + Создать команду
        </LinkButton>
      </div>

      {/* Search */}
      <div className="mb-6 flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(query)}
          className="w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          placeholder="Поиск по названию команды..."
        />
        <button
          type="button"
          onClick={() => load(query)}
          className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-accent/90"
        >
          Найти
        </button>
      </div>

      {/* States */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl border border-border bg-canvas" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-5 text-sm text-accent">{error}</Card>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-canvas py-20 text-center">
          <div className="text-4xl">🛡️</div>
          <p className="mt-3 text-base font-semibold text-foreground">Команды не найдены</p>
          <p className="mt-1 text-sm text-muted">Попробуйте другой запрос или создайте свою команду</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <TeamCard key={team.team_id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team }) {
  const bannerUrl = resolveAssetUrl(team.banner_url || "");
  const avatarUrl = resolveAssetUrl(team.avatar_url || "");
  const memberCount = team.member_count ?? 0;
  const maxMembers = team.max_members ?? 5;
  const fillPct = Math.round((memberCount / maxMembers) * 100);

  return (
    <a
      href={`/team/${team.team_id}`}
      className="group block overflow-hidden rounded-3xl border border-border bg-canvas transition-all duration-200 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5"
    >
      {/* Banner */}
      <div className="relative h-24 overflow-hidden">
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
        )}
        {/* Rating badge */}
        <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-accent backdrop-blur-sm">
          ⭐ {team.team_rating ?? 0}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-border bg-elevated shadow-md">
            {avatarUrl ? (
              <img src={avatarUrl} alt={team.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-foreground">
                {team.name?.[0]?.toUpperCase() ?? "T"}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground group-hover:text-accent transition-colors">{team.name}</p>
            {team.description ? (
              <p className="truncate text-xs text-muted">{team.description}</p>
            ) : null}
          </div>
        </div>

        {/* Members fill bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>Участники</span>
            <span className="font-medium text-foreground">{memberCount} / {maxMembers}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Tags row */}
        <div className="mt-3 flex flex-wrap gap-2">
          {team.is_open !== false ? (
            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-400">
              Открытая
            </span>
          ) : (
            <span className="rounded-full border border-border bg-elevated px-2.5 py-1 text-[11px] text-muted">
              По инвайту
            </span>
          )}
          {team.tags?.map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-elevated px-2.5 py-1 text-[11px] text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
}

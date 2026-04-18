import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

export function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextQuery = "") {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/team${nextQuery ? `?q=${encodeURIComponent(nextQuery)}` : ""}`);
      setTeams(data ?? []);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить команды");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Поиск команд</h1>
        <Link to="/team/create" className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          Создать команду
        </Link>
      </div>
      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm"
            placeholder="Поиск по названию"
          />
          <button
            type="button"
            onClick={() => load(query)}
            className="rounded-2xl border border-border px-4 py-3 text-sm"
          >
            Найти
          </button>
        </div>
      </Card>
      {loading ? <Card className="p-5 text-sm text-muted">Загрузка...</Card> : null}
      {error ? <Card className="p-5 text-sm text-accent">{error}</Card> : null}
      {!loading && !error ? (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.team_id} className="p-5">
              <div className="text-lg font-semibold text-foreground">{team.name}</div>
              <div className="mt-2 text-sm text-muted">
                Участников: {team.member_count} · Рейтинг: {team.team_rating}
              </div>
              <div className="mt-1 text-xs text-muted">Капитан user_id: {team.captain_user_id}</div>
            </Card>
          ))}
          {teams.length === 0 ? <Card className="p-5 text-sm text-muted">Ничего не найдено.</Card> : null}
        </div>
      ) : null}
    </div>
  );
}

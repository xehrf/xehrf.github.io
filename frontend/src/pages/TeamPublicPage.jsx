import { useEffect, useState } from "react";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { useParams } from "react-router-dom";

function StatCard({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </Card>
  );
}

export function TeamPublicPage() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [teamData, statsData, historyData, currentData] = await Promise.all([
          apiFetch(`/teams/${teamId}`),
          apiFetch(`/teams/${teamId}/stats`),
          apiFetch(`/teams/${teamId}/matches`),
          apiFetch("/teams/current"),
        ]);
        if (!mounted) return;
        setTeam(teamData);
        setStats(statsData);
        setHistory(Array.isArray(historyData) ? historyData : []);
        setCurrentTeam(currentData);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Не удалось загрузить команду");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [teamId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="h-48 animate-pulse rounded-3xl border border-border bg-canvas" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Card className="p-5 text-sm text-accent">{error}</Card>
      </div>
    );
  }

  if (!team) return null;

  const isMyTeam = Number(currentTeam?.team_id) === Number(team.team_id);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{team.name}</h1>
          <p className="mt-1 text-sm text-muted">{team.description || "Описание команды не заполнено"}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <LinkButton to="/team" variant="secondary" className="h-11 rounded-[12px] px-4 py-2 md:rounded-btn">
            К списку команд
          </LinkButton>
          {isMyTeam ? (
            <LinkButton to="/team/current" className="h-11 rounded-[12px] px-4 py-2 md:rounded-btn">
              Открыть мою команду
            </LinkButton>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Рейтинг" value={stats?.rating ?? 0} />
        <StatCard label="Матчи" value={stats?.total_matches ?? 0} />
        <StatCard label="Победы" value={stats?.wins ?? 0} />
        <StatCard label="Участники" value={team.member_count ?? team.members?.length ?? 0} />
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-foreground">Состав команды</h2>
        <div className="mt-3 grid gap-2">
          {(team.members || []).map((member) => (
            <div key={member.user_id} className="rounded-xl border border-border bg-canvas px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{member.display_name || member.nickname}</p>
                  <p className="truncate text-xs text-muted">@{member.nickname}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-muted">{member.role}</p>
                  <p className="text-sm font-medium text-foreground">PTS {member.pts}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-foreground">История матчей</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">История матчей пока пустая.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {history.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foreground">Матч #{item.match_id ?? item.id}</p>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-muted">{item.result}</p>
                  <p className="text-sm font-medium text-foreground">
                    {item.rating_delta > 0 ? "+" : ""}
                    {item.rating_delta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

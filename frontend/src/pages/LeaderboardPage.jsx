import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card.jsx";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function pointsToPath(points, width, height, padding) {
  if (!points.length) return "";
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const toCanvasX = (x) => padding + ((x - minX) / spanX) * (width - padding * 2);
  const toCanvasY = (y) => height - padding - ((y - minY) / spanY) * (height - padding * 2);
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${toCanvasX(point.x).toFixed(2)} ${toCanvasY(point.y).toFixed(2)}`)
    .join(" ");
}

function HistoryChart({ points }) {
  const width = 800;
  const height = 260;
  const padding = 24;
  const chartPoints = useMemo(() => {
    let cumulative = 0;
    return (points || []).map((point, index) => {
      cumulative += Number(point.total_delta || 0);
      return { x: index, y: cumulative, label: point.date };
    });
  }, [points]);
  const path = useMemo(() => pointsToPath(chartPoints, width, height, padding), [chartPoints]);
  const min = chartPoints.length ? Math.min(...chartPoints.map((p) => p.y)) : 0;
  const max = chartPoints.length ? Math.max(...chartPoints.map((p) => p.y)) : 0;

  if (!chartPoints.length) {
    return <p className="text-sm text-muted">No history points yet.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>Delta range</span>
        <span>
          {formatNumber(min)} to {formatNumber(max)}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[240px] w-full rounded-btn border border-border bg-canvas">
        <defs>
          <linearGradient id="ratingLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f8d553" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#ratingLine)" strokeWidth="3" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{chartPoints[0]?.label}</span>
        <span>{chartPoints[chartPoints.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function buildFilterQuery(filters) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.season) params.set("season", filters.season);
  if (filters.categoryType) params.set("category_type", filters.categoryType);
  if (filters.category) params.set("category", filters.category);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params.toString();
}

export function LeaderboardPage() {
  const { user } = useAuth();
  const [meta, setMeta] = useState({ periods: ["all_time"], seasons: [], languages: [], topics: [] });
  const [filters, setFilters] = useState({
    period: "all_time",
    season: "",
    categoryType: "",
    category: "",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaderboard, setLeaderboard] = useState({ items: [], total: 0, me: null });
  const [position, setPosition] = useState(null);
  const [history, setHistory] = useState({ chart: [], items: [] });
  const [compareUserId, setCompareUserId] = useState("");
  const [compareData, setCompareData] = useState(null);
  const [compareError, setCompareError] = useState("");

  const categoryOptions = useMemo(() => {
    if (filters.categoryType === "language") return meta.languages || [];
    if (filters.categoryType === "topic") return meta.topics || [];
    return [];
  }, [filters.categoryType, meta.languages, meta.topics]);

  async function loadMeta() {
    const [seasonsData, categoriesData] = await Promise.all([
      apiFetch("/rating/seasons"),
      apiFetch("/rating/categories"),
    ]);
    setMeta({
      periods: Array.isArray(seasonsData?.periods) ? seasonsData.periods : ["all_time"],
      seasons: Array.isArray(seasonsData?.seasons) ? seasonsData.seasons : [],
      languages: Array.isArray(categoriesData?.languages) ? categoriesData.languages : [],
      topics: Array.isArray(categoriesData?.topics) ? categoriesData.topics : [],
    });
  }

  async function loadMain() {
    setLoading(true);
    setError("");
    try {
      const query = buildFilterQuery(filters);
      const suffix = query ? `?${query}` : "";
      const [lb, pos, hist] = await Promise.all([
        apiFetch(`/rating/leaderboard${suffix}`),
        apiFetch(`/rating/position/me${suffix}`),
        apiFetch(`/rating/history/me${suffix}`),
      ]);
      setLeaderboard(lb || { items: [], total: 0, me: null });
      setPosition(pos || null);
      setHistory(hist || { chart: [], items: [] });
    } catch (e) {
      setError(e?.message || "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  async function loadCompare(otherId) {
    if (!otherId) {
      setCompareData(null);
      setCompareError("");
      return;
    }
    setCompareError("");
    try {
      const params = new URLSearchParams();
      params.set("other_user_id", String(otherId));
      if (filters.period) params.set("period", filters.period);
      if (filters.season) params.set("season", filters.season);
      if (filters.categoryType) params.set("category_type", filters.categoryType);
      if (filters.category) params.set("category", filters.category);
      const data = await apiFetch(`/rating/compare?${params.toString()}`);
      setCompareData(data);
    } catch (e) {
      setCompareError(e?.message || "Could not compare users");
      setCompareData(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadMeta();
        if (mounted) await loadMain();
      } catch (e) {
        if (mounted) {
          setError(e?.message || "Could not load rating metadata");
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCompare(compareUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareUserId]);

  const compareCandidates = useMemo(() => {
    return (leaderboard.items || []).filter((item) => Number(item.user_id) !== Number(user?.id));
  }, [leaderboard.items, user?.id]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters({
      period: "all_time",
      season: "",
      categoryType: "",
      category: "",
      search: "",
    });
  }

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Rating & Leaderboard</h1>
          <p className="mt-1 text-sm text-muted">PTS ranking, rating history, filters, and player comparison.</p>
        </div>
        <LinkButton to="/dashboard" variant="secondary" className="h-11 rounded-[12px] px-4 py-2 md:rounded-btn">
          Back to tasks
        </LinkButton>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <select
            value={filters.period}
            onChange={(e) => updateFilter("period", e.target.value)}
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          >
            {(meta.periods || []).map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
          <select
            value={filters.season}
            onChange={(e) => updateFilter("season", e.target.value)}
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          >
            <option value="">No season override</option>
            {(meta.seasons || []).map((season) => (
              <option key={season.code} value={season.code}>
                {season.title}
              </option>
            ))}
          </select>
          <select
            value={filters.categoryType}
            onChange={(e) => {
              updateFilter("categoryType", e.target.value);
              updateFilter("category", "");
            }}
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          >
            <option value="">All categories</option>
            <option value="language">Language</option>
            <option value="topic">Topic</option>
          </select>
          <select
            value={filters.category}
            onChange={(e) => updateFilter("category", e.target.value)}
            disabled={!filters.categoryType}
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground disabled:opacity-60"
          >
            <option value="">All {filters.categoryType || "categories"}</option>
            {categoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Search player"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={loadMain} className="h-11 rounded-[12px] md:rounded-btn">
              Apply
            </Button>
            <Button onClick={resetFilters} variant="secondary" className="h-11 rounded-[12px] md:rounded-btn">
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {loading ? <Card className="text-sm text-muted">Loading rating...</Card> : null}
      {error ? <Card className="text-sm text-accent">{error}</Card> : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">My rank</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">#{position?.rank ?? "-"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Percentile</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatPercent(position?.percentile || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Period delta</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(position?.pts_period || 0)}</p>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-foreground">Leaderboard</h2>
            <p className="mt-1 text-xs text-muted">Total players: {formatNumber(leaderboard.total || 0)}</p>
            {(leaderboard.items || []).length === 0 ? (
              <p className="mt-3 text-sm text-muted">No players match selected filters.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-4">Rank</th>
                      <th className="py-2 pr-4">Player</th>
                      <th className="py-2 pr-4">Total PTS</th>
                      <th className="py-2 pr-4">Period PTS</th>
                      <th className="py-2 pr-4">Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.items.map((row) => (
                      <tr key={row.user_id} className="border-b border-border/60 text-foreground">
                        <td className="py-2 pr-4 font-semibold">#{row.rank}</td>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{row.display_name}</div>
                          <div className="text-xs text-muted">{row.level}</div>
                        </td>
                        <td className="py-2 pr-4">{formatNumber(row.pts_total)}</td>
                        <td className="py-2 pr-4">{formatNumber(row.pts_period)}</td>
                        <td className="py-2 pr-4">{formatNumber(row.pvp_win_streak)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-foreground">Rating history chart</h2>
            <p className="mt-1 text-xs text-muted">Cumulative PTS delta for selected filters.</p>
            <div className="mt-3">
              <HistoryChart points={history.chart || []} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-foreground">Compare with another user</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(220px,320px)_1fr] sm:items-start">
              <select
                value={compareUserId}
                onChange={(e) => setCompareUserId(e.target.value)}
                className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select player from current leaderboard</option>
                {compareCandidates.map((item) => (
                  <option key={item.user_id} value={item.user_id}>
                    {item.display_name} (#{item.rank})
                  </option>
                ))}
              </select>
              {compareError ? <p className="text-sm text-accent">{compareError}</p> : null}
              {compareData ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-btn border border-border bg-canvas p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">{compareData.left.display_name}</p>
                    <p className="mt-1 text-sm text-foreground">Total: {formatNumber(compareData.left.pts_total)}</p>
                    <p className="text-sm text-foreground">Period: {formatNumber(compareData.left.pts_period)}</p>
                    <p className="text-sm text-muted">Rank: {compareData.left.rank ?? "-"}</p>
                  </div>
                  <div className="rounded-btn border border-border bg-canvas p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">{compareData.right.display_name}</p>
                    <p className="mt-1 text-sm text-foreground">Total: {formatNumber(compareData.right.pts_total)}</p>
                    <p className="text-sm text-foreground">Period: {formatNumber(compareData.right.pts_period)}</p>
                    <p className="text-sm text-muted">Rank: {compareData.right.rank ?? "-"}</p>
                  </div>
                  <div className="rounded-btn border border-border bg-canvas p-3 sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted">Difference (you - opponent)</p>
                    <p className="mt-1 text-sm text-foreground">
                      Total: {formatNumber(compareData.pts_total_diff)} | Period: {formatNumber(compareData.pts_period_diff)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

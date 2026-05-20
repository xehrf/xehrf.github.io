import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/Card.jsx";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { CompyraEmoji, CompyraText } from "../components/ui/CompyraEmoji.jsx";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { PlayerHoverCard } from "../components/ui/PlayerHoverCard.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

// Crosshair plugin — vertical dashed line on hover
const crosshairPlugin = {
  id: "crosshair",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const tooltip = chart.tooltip;
    if (!tooltip || !tooltip._active || !tooltip._active.length) return;
    const x = tooltip._active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255, 214, 0, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};
ChartJS.register(crosshairPlugin);

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function HistoryChart({ points }) {
  const chartRef = useRef(null);
  const [tooltipData, setTooltipData] = useState(null);

  const { labels, values } = useMemo(() => {
    let cumulative = 0;
    const processed = (points || []).map((point) => {
      cumulative += Number(point.total_delta || 0);
      return { y: cumulative, label: point.date };
    });
    return {
      labels: processed.map((p) => p.label),
      values: processed.map((p) => p.y),
    };
  }, [points]);

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const isPositive = values.length >= 2 ? values[values.length - 1] >= values[0] : true;
  const growth = values.length >= 2 ? values[values.length - 1] - values[0] : 0;

  if (!values.length) {
    return <p className="text-sm text-muted">Нет данных для графика за выбранный период.</p>;
  }

  const chartDataConfig = {
    labels,
    datasets: [{
      data: values,
      borderColor: "#FFD700",
      backgroundColor(context) {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return "rgba(255,215,0,0.08)";
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, "rgba(255,215,0,0.20)");
        gradient.addColorStop(0.6, "rgba(255,215,0,0.05)");
        gradient.addColorStop(1, "rgba(255,215,0,0)");
        return gradient;
      },
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: "#FFD700",
      pointHoverBorderColor: "#111",
      pointHoverBorderWidth: 2.5,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: "easeInOutQuart" },
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external(context) {
          const model = context.tooltip;
          if (model.opacity === 0) { setTooltipData(null); return; }
          if (model.dataPoints?.length) {
            const idx = model.dataPoints[0].dataIndex;
            setTooltipData({ value: values[idx], label: labels[idx], x: model.caretX, y: model.caretY });
          }
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "rgba(255,255,255,0.35)",
          font: { size: 11, family: "ui-monospace, monospace" },
          maxTicksLimit: 6,
          maxRotation: 0,
        },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.06)", drawBorder: false },
        border: { display: false },
        ticks: {
          color: "rgba(255,255,255,0.35)",
          font: { size: 11, family: "ui-monospace, monospace" },
          callback: (v) => formatNumber(v),
        },
      },
    },
  };

  return (
    <div>
      {/* Range header */}
      <div className="mb-4 flex items-center justify-between text-xs text-muted">
        <span>Диапазон дельты</span>
        <span>{formatNumber(min)} .. {formatNumber(max)}</span>
      </div>

      {/* Metric cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Начало", value: formatNumber(values[0]) + " PTS", sub: labels[0] || "—", accent: false },
          { label: "Сейчас", value: formatNumber(values[values.length - 1]) + " PTS", sub: labels[labels.length - 1] || "—", accent: false },
          {
            label: "Прирост",
            value: (growth >= 0 ? "+" : "") + formatNumber(growth) + " PTS",
            sub: (isPositive ? "↑" : "↓") + " за период",
            accent: true,
            positive: isPositive,
          },
        ].map((card, i) => (
          <div
            key={i}
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              background: card.accent ? "rgba(255,215,0,0.07)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${card.accent ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6, fontFamily: "ui-monospace, monospace" }}>
              {card.label}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", color: card.accent ? "#FFD700" : "rgba(255,255,255,0.9)", marginBottom: 3, lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: card.accent ? (card.positive ? "#4ade80" : "#f87171") : "rgba(255,255,255,0.3)" }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ position: "relative", height: 240, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", padding: "16px 12px 10px", background: "rgba(255,255,255,0.02)" }}>
        <Line ref={chartRef} data={chartDataConfig} options={chartOptions} />

        {/* React tooltip */}
        {tooltipData && (
          <div style={{
            position: "absolute",
            left: tooltipData.x,
            top: tooltipData.y - 52,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 10,
            background: "rgba(18,18,18,0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,215,0,0.3)",
            borderRadius: 10,
            padding: "8px 14px",
            textAlign: "center",
            minWidth: 110,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#FFD700", fontFamily: "ui-monospace, monospace", marginBottom: 2 }}>
              {formatNumber(tooltipData.value)} PTS
            </div>
            <div style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
              {tooltipData.label}
            </div>
          </div>
        )}
      </div>

      {/* Date labels */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
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

function PodiumStand({ player, place, height, className = "" }) {
  if (!player) {
    return <div className={["rounded-btn border border-dashed border-border", height, className].join(" ")} />;
  }
  const avatar = resolveAssetUrl(player.avatar_url || "");
  const name = player.display_name || player.nickname || "—";
  const pts = player.pts_total ?? 0;
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  const isFirst = place === 1;

  return (
    <div className={["flex flex-col items-center", className].join(" ")}>
      {/* Аватар + имя кликабельны и открывают мини-профиль через portal. */}
      <PlayerHoverCard userId={player.user_id} disabled={!player.user_id}>
        <div className="flex flex-col items-center">
          <div
            className={[
              "relative mb-2 cursor-pointer overflow-hidden rounded-full border-2 transition-transform hover:scale-105",
              isFirst ? "h-20 w-20 border-accent shadow-glow" : "h-16 w-16 border-border",
            ].join(" ")}
          >
            {avatar ? (
              <MediaAsset src={avatar} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-elevated text-2xl font-bold text-foreground">
                {name[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 text-2xl">
              <CompyraText size={26}>{medal}</CompyraText>
            </div>
          </div>

          <div className="mb-2 max-w-full text-center">
            <p className={["truncate font-semibold", isFirst ? "text-foreground" : "text-foreground/90"].join(" ")}>
              {name}
            </p>
            <p className="font-mono text-xs text-accent">{formatNumber(pts)} PTS</p>
          </div>
        </div>
      </PlayerHoverCard>

      <div
        className={[
          "flex w-full items-start justify-center rounded-t-btn border border-b-0 pt-3 font-mono text-2xl font-bold transition-colors",
          height,
          isFirst
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-border bg-elevated text-muted",
        ].join(" ")}
      >
        #{place}
      </div>
    </div>
  );
}

export function LeaderboardContent({ embedded = false }) {
  const { user } = useAuth();

  const [filters] = useState({
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

  const compareSectionRef = useRef(null);

  const compareCandidates = useMemo(() => {
    return (leaderboard.items || []).filter((item) => Number(item.user_id) !== Number(user?.id));
  }, [leaderboard.items, user?.id]);

  async function loadCompare(otherId, nextFilters = filters) {
    if (!otherId) {
      setCompareData(null);
      setCompareError("");
      return;
    }

    setCompareError("");

    try {
      const params = new URLSearchParams();
      params.set("other_user_id", String(otherId));
      if (nextFilters.period) params.set("period", nextFilters.period);
      if (nextFilters.season) params.set("season", nextFilters.season);
      if (nextFilters.categoryType) params.set("category_type", nextFilters.categoryType);
      if (nextFilters.category) params.set("category", nextFilters.category);
      const data = await apiFetch(`/rating/compare?${params.toString()}`);
      setCompareData(data);
    } catch (e) {
      setCompareError(e?.message || "Не удалось сравнить пользователей");
      setCompareData(null);
    }
  }

  async function loadMain(nextFilters = filters) {
    setLoading(true);
    setError("");

    try {
      const query = buildFilterQuery(nextFilters);
      const suffix = query ? `?${query}` : "";

      const [lb, pos, hist] = await Promise.all([
        apiFetch(`/rating/leaderboard${suffix}`),
        apiFetch(`/rating/position/me${suffix}`),
        apiFetch(`/rating/history/me${suffix}`),
      ]);

      setLeaderboard(lb || { items: [], total: 0, me: null });
      setPosition(pos || null);
      setHistory(hist || { chart: [], items: [] });
      await loadCompare(compareUserId, nextFilters);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить рейтинг");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (mounted) await loadMain();
      } catch (e) {
        if (mounted) {
          setError(e?.message || "Не удалось загрузить рейтинг");
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectUserForCompare(userId, { scroll = false } = {}) {
    const candidateId = Number(userId);
    if (!candidateId || candidateId === Number(user?.id)) return;

    const nextId = String(candidateId);
    setCompareUserId(nextId);
    loadCompare(nextId);

    if (scroll) {
      window.requestAnimationFrame(() => {
        compareSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  const topThree = (leaderboard.items || []).slice(0, 3);

  return (
    <div className={embedded ? "space-y-4" : "mx-auto w-full max-w-[430px] space-y-4 px-4 py-6 md:max-w-6xl md:px-6 md:py-8"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
            <CompyraEmoji name="trophy" size={14} />
            Арена · сезон
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Рейтинг <span className="text-gradient-accent">PvP</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Кто сильнее — решает арена. Попади в топ-100 и работодатели увидят твой профиль.</p>
        </div>
        {!embedded ? (
          <LinkButton to="/dashboard" variant="secondary" className="h-11 rounded-[12px] px-4 py-2 md:rounded-btn">
            Назад к задачам
          </LinkButton>
        ) : null}
      </div>


      {loading ? <Card className="text-sm text-muted">Загрузка рейтинга...</Card> : null}
      {error ? <Card className="text-sm text-accent">{error}</Card> : null}

      {!loading && !error ? (
        <>
          {/* PODIUM — топ-3 на пьедестале */}
          {topThree.length >= 3 ? (
            <Card className="p-4 sm:p-6">
              <h2 className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Лучшие из лучших
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                {/* 2-е место */}
                <PodiumStand player={topThree[1]} place={2} height="h-28" className="order-2 sm:order-1" />
                {/* 1-е место */}
                <PodiumStand player={topThree[0]} place={1} height="h-36" className="order-1 sm:order-2" />
                {/* 3-е место */}
                <PodiumStand player={topThree[2]} place={3} height="h-20" className="order-3" />
              </div>
            </Card>
          ) : null}

          {/* MY POSITION CARDS */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Моё место</p>
              <p className="mt-1 text-2xl font-bold text-accent">#{position?.rank ?? "-"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Процентиль</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{formatPercent(position?.percentile || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">PTS за период</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{formatNumber(position?.pts_period || 0)}</p>
            </Card>
          </div>

          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-foreground">Таблица лидеров</h2>
            <p className="mt-1 text-xs text-muted">Игроков в выборке: {formatNumber(leaderboard.total || 0)}</p>
            <p className="mt-1 text-xs text-muted">
              Наведи курсор на игрока — появится мини-профиль с кнопкой «Сравнить».
            </p>

            {(leaderboard.items || []).length === 0 ? (
              <p className="mt-3 text-sm text-muted">По этим фильтрам нет игроков.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-btn border border-border/70">
                  <table className="min-w-[720px] w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                        <th className="py-2 pl-3 pr-4">Место</th>
                        <th className="py-2 pr-4">Игрок</th>
                        <th className="py-2 pr-4">Общий PTS</th>
                        <th className="py-2 pr-4">PTS за период</th>
                        <th className="py-2 pr-4">Серия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.items.map((row) => {
                        const rowId = Number(row.user_id);
                        const isSelf = rowId === Number(user?.id);
                        const avatarUrl = resolveAssetUrl(row.avatar_url || "");

                        return (
                          <tr
                            key={row.user_id}
                            className="border-b border-border/60 text-foreground transition-colors hover:bg-canvas/60"
                            aria-label={`Игрок ${row.display_name}`}
                          >
                            <td className="py-2 pl-3 pr-4 font-semibold">#{row.rank}</td>

                            <td className="py-2 pr-4">
                              <PlayerHoverCard
                                userId={rowId}
                                onCompare={(id) => selectUserForCompare(id, { scroll: true })}
                                compareDisabled={isSelf}
                              >
                                <div className="flex cursor-pointer items-center gap-3">
                                  <div className="h-9 w-9 overflow-hidden rounded-full border border-border bg-elevated">
                                    {avatarUrl ? (
                                      <MediaAsset src={avatarUrl} alt={`Аватар ${row.display_name}`} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-foreground">
                                        {(row.display_name || "?")[0]?.toUpperCase() || "?"}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">{row.display_name}</div>
                                    <div className="truncate text-xs text-muted">
                                      @{row.nickname} | {row.level}
                                    </div>
                                  </div>
                                </div>
                              </PlayerHoverCard>
                            </td>

                            <td className="py-2 pr-4">{formatNumber(row.pts_total)}</td>
                            <td className="py-2 pr-4">{formatNumber(row.pts_period)}</td>
                            <td className="py-2 pr-4">{formatNumber(row.pvp_win_streak)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-foreground">График изменения PTS</h2>
            <p className="mt-1 text-xs text-muted">Накопленная дельта по выбранным фильтрам.</p>
            <div className="mt-3">
              <HistoryChart points={history.chart || []} />
            </div>
          </Card>

          <div ref={compareSectionRef}>
            <Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Сравнение игроков</h2>
                  <p className="mt-0.5 text-xs text-muted">Выберите соперника для сравнения PTS</p>
                </div>
                <select
                  value={compareUserId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setCompareUserId(nextId);
                    loadCompare(nextId);
                  }}
                  className="w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground sm:w-auto"
                >
                  <option value="">Выберите игрока...</option>
                  {compareCandidates.map((item) => (
                    <option key={item.user_id} value={item.user_id}>
                      {item.display_name} (#{item.rank})
                    </option>
                  ))}
                </select>
              </div>

              {compareError ? <p className="mt-3 text-sm text-accent">{compareError}</p> : null}

              {compareData ? (() => {
                const leftPts = Number(compareData.left.pts_total) || 0;
                const rightPts = Number(compareData.right.pts_total) || 0;
                const total = leftPts + rightPts || 1;
                const leftPct = Math.round((leftPts / total) * 100);
                const rightPct = 100 - leftPct;
                const diff = Number(compareData.pts_total_diff) || 0;
                const diffPeriod = Number(compareData.pts_period_diff) || 0;
                const leftWins = leftPts >= rightPts;

                return (
                  <div className="mt-5">
                    {/* Player headers */}
                    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)]">
                      <div className={`order-1 min-w-0 rounded-2xl border p-4 sm:order-1 ${leftWins ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-canvas"}`}>
                        <p className="text-[11px] uppercase tracking-wider text-muted">Вы</p>
                        <p className="mt-1 truncate text-base font-bold text-foreground">{compareData.left.display_name}</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">{formatNumber(leftPts)}</p>
                        <p className="text-xs text-muted">PTS общий</p>
                        {leftWins && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-yellow-400">
                            <CompyraEmoji name="crown" size={14} />
                            Лидер
                          </p>
                        )}
                      </div>

                      <div className="order-2 flex items-center justify-center sm:order-2">
                        <span className="rounded-full bg-elevated px-2 py-1 text-xs font-bold text-muted">VS</span>
                      </div>

                      <div className={`order-3 min-w-0 rounded-2xl border p-4 sm:order-3 ${!leftWins ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-canvas"}`}>
                        <p className="text-[11px] uppercase tracking-wider text-muted">Соперник</p>
                        <p className="mt-1 truncate text-base font-bold text-foreground">{compareData.right.display_name}</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">{formatNumber(rightPts)}</p>
                        <p className="text-xs text-muted">PTS общий</p>
                        {!leftWins && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-yellow-400">
                            <CompyraEmoji name="crown" size={14} />
                            Лидер
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex overflow-hidden rounded-full" style={{ height: 8 }}>
                        <div
                          className="bg-yellow-400 transition-all duration-500"
                          style={{ width: `${leftPct}%` }}
                        />
                        <div
                          className="bg-slate-600 transition-all duration-500"
                          style={{ width: `${rightPct}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-muted">
                        <span>{leftPct}%</span>
                        <span>{rightPct}%</span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-canvas p-3 text-center">
                        <p className="text-[11px] uppercase tracking-wider text-muted">Место</p>
                        <p className="mt-1 text-lg font-bold text-foreground">#{compareData.left.rank ?? "-"}</p>
                        <p className="text-xs text-muted">vs #{compareData.right.rank ?? "-"}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-canvas p-3 text-center">
                        <p className="text-[11px] uppercase tracking-wider text-muted">Разница</p>
                        <p className={`mt-1 text-lg font-bold ${diff >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {diff >= 0 ? "+" : ""}{formatNumber(diff)}
                        </p>
                        <p className="text-xs text-muted">PTS общий</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-canvas p-3 text-center">
                        <p className="text-[11px] uppercase tracking-wider text-muted">Период</p>
                        <p className={`mt-1 text-lg font-bold ${diffPeriod >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {diffPeriod >= 0 ? "+" : ""}{formatNumber(diffPeriod)}
                        </p>
                        <p className="text-xs text-muted">Разница</p>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="mt-4 flex items-center justify-center rounded-2xl border border-dashed border-border bg-elevated/30 py-8 text-sm text-muted">
                  Выберите игрока для сравнения
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function LeaderboardPage() {
  return <LeaderboardContent embedded={false} />;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/Card.jsx";
import { Button, LinkButton } from "../components/ui/Button.jsx";
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
    const { ctx, tooltip, chartArea } = chart;
    if (!tooltip._active?.length) return;
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
      <div className="mb-5 grid grid-cols-3 gap-3">
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

function LeaderboardMiniProfileCard({ row, profile, loading, pinned, isSelf, onTogglePin, onCompare, anchorRect }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

  useEffect(() => {
    if (!anchorRect || !cardRef.current) return;
    const cardW = cardRef.current.offsetWidth || 300;
    const cardH = cardRef.current.offsetHeight || 340;

    let left = anchorRect.right + 14;
    let top = anchorRect.top + anchorRect.height / 2 - cardH / 2;

    // Flip left if overflows right edge
    if (left + cardW > window.innerWidth - 16) {
      left = anchorRect.left - cardW - 14;
    }
    // Clamp vertically
    top = Math.max(8, Math.min(top, window.innerHeight - cardH - 8));

    setPos({ top, left, ready: true });
  }, [anchorRect]);

  if (!row) return null;

  const nickname = profile?.nickname || row.nickname || row.display_name || "unknown";
  const displayName = profile?.nickname || profile?.display_name || row.display_name || "Unknown";
  const avatarUrl = resolveAssetUrl(profile?.avatar_url || row.avatar_url || "");
  const bannerUrl = resolveAssetUrl(profile?.banner_url || "");
  const bio = profile?.bio?.trim() || "Пока без описания. Нажмите «Сравнить», чтобы посмотреть разницу по PTS.";
  const role = typeof profile?.role === "string" ? profile.role.trim() : "";

  const hasProfileSkills = Array.isArray(profile?.skills) && profile.skills.length > 0;
  const skillChips = hasProfileSkills
    ? profile.skills.map((item) => ({
        key: `skill:${item.id ?? item.skill_name}`,
        label: item.skill_name,
        proficiency: item.proficiency,
      }))
    : (Array.isArray(profile?.technologies) && profile.technologies.length > 0
        ? profile.technologies
        : Array.isArray(row.technologies)
          ? row.technologies
          : []
      ).map((tech) => ({
        key: `tech:${tech}`,
        label: tech,
        proficiency: null,
      }));

  return (
    <div
      ref={cardRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: 300,
        zIndex: 9999,
        opacity: pos.ready ? 1 : 0,
        pointerEvents: pos.ready ? "auto" : "none",
        transition: "opacity 0.15s ease",
      }}
      className="overflow-hidden rounded-btn border border-border bg-canvas shadow-2xl"
    >
      <div className="relative h-20">
        {bannerUrl ? (
          <img src={bannerUrl} alt={`Баннер ${displayName}`} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        )}
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          <div className="h-16 w-16 overflow-hidden rounded-full border-[3px] border-canvas bg-elevated">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`Аватар ${displayName}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-foreground">
                {displayName[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 pt-12">
        <div className="flex items-end gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted">@{nickname}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span>PTS {formatNumber(row.pts_total)}</span>
          <span>|</span>
          <span>Серия {formatNumber(row.pvp_win_streak)}</span>
          <span>|</span>
          <span className="capitalize">{row.level}</span>
        </div>

        {role ? (
          <p className="mt-2 inline-flex rounded-full border border-border bg-elevated px-2 py-1 text-[11px] uppercase tracking-wide text-accent">
            Роль: {role}
          </p>
        ) : null}

        <p className="mt-3 rounded-btn border border-border/70 bg-elevated/60 px-3 py-2 text-xs leading-5 text-foreground/90">
          {bio}
        </p>

        <div className="mt-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">Навыки</p>
          <div className="flex flex-wrap gap-2">
            {skillChips.length === 0 ? (
              <span className="rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted">
                Навыки не указаны
              </span>
            ) : (
              skillChips.slice(0, 8).map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center rounded-full border border-border bg-elevated px-2.5 py-1 text-xs text-foreground"
                >
                  {chip.label}
                  {chip.proficiency ? <span className="ml-1 text-muted">{chip.proficiency}/5</span> : null}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="mt-4">
          <Button
            onClick={onCompare}
            variant="secondary"
            disabled={isSelf}
            className="h-10 w-full rounded-[10px] px-3"
            title={isSelf ? "Сравнение с самим собой не требуется" : "Сравнить этого игрока"}
          >
            Сравнить
          </Button>
        </div>

        {loading ? <p className="mt-2 text-xs text-muted">Загружаем дополнительные данные профиля…</p> : null}
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

  const [hoveredUserId, setHoveredUserId] = useState(null);
  const [pinnedUserId, setPinnedUserId] = useState(null);
  const [profileByUserId, setProfileByUserId] = useState({});
  const [profileLoadingByUserId, setProfileLoadingByUserId] = useState({});
  const [anchorRect, setAnchorRect] = useState(null);
  const tableRef = useRef(null);

  const compareSectionRef = useRef(null);

  // Close pinned popup on click outside the table
  useEffect(() => {
    function handleClickOutside(e) {
      if (tableRef.current && !tableRef.current.contains(e.target)) {
        setPinnedUserId(null);
        setHoveredUserId(null);
        setAnchorRect(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const compareCandidates = useMemo(() => {
    return (leaderboard.items || []).filter((item) => Number(item.user_id) !== Number(user?.id));
  }, [leaderboard.items, user?.id]);

  const rowByUserId = useMemo(() => {
    return new Map((leaderboard.items || []).map((row) => [Number(row.user_id), row]));
  }, [leaderboard.items]);

  const activePreviewUserId = pinnedUserId ?? hoveredUserId;
  const activePreviewRow =
    activePreviewUserId == null ? null : (rowByUserId.get(Number(activePreviewUserId)) ?? null);
  const activePreviewKey = activePreviewUserId == null ? "" : String(activePreviewUserId);
  const activePreviewProfile = activePreviewKey ? profileByUserId[activePreviewKey] ?? null : null;
  const activePreviewLoading = activePreviewKey ? Boolean(profileLoadingByUserId[activePreviewKey]) : false;

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

  async function ensureProfileLoaded(userId) {
    if (userId == null || userId === "") return;
    const key = String(userId);
    if (profileLoadingByUserId[key]) return;
    if (Object.prototype.hasOwnProperty.call(profileByUserId, key)) return;

    setProfileLoadingByUserId((prev) => ({ ...prev, [key]: true }));

    try {
      const profile = await apiFetch(`/users/${key}/profile`);
      setProfileByUserId((prev) => ({ ...prev, [key]: profile || null }));
    } catch {
      setProfileByUserId((prev) => ({ ...prev, [key]: null }));
    } finally {
      setProfileLoadingByUserId((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
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

  useEffect(() => {
    const knownIds = new Set((leaderboard.items || []).map((item) => Number(item.user_id)));

    if (hoveredUserId != null && !knownIds.has(Number(hoveredUserId))) {
      setHoveredUserId(null);
    }

    if (pinnedUserId != null && !knownIds.has(Number(pinnedUserId))) {
      setPinnedUserId(null);
    }
  }, [leaderboard.items, hoveredUserId, pinnedUserId]);

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

  function handleLeaderboardRowHover(row, rect) {
    // Only show hover preview if nothing is pinned
    if (pinnedUserId == null) {
      setHoveredUserId(row.user_id);
      if (rect) setAnchorRect(rect);
      ensureProfileLoaded(row.user_id);
    }
  }

  function handleLeaderboardRowClick(row, rect) {
    const rowId = Number(row.user_id);
    const alreadyPinned = Number(pinnedUserId) === rowId;

    if (alreadyPinned) {
      // Unpin on second click
      setPinnedUserId(null);
      setHoveredUserId(null);
      setAnchorRect(null);
    } else {
      // Pin this row
      setPinnedUserId(rowId);
      setHoveredUserId(rowId);
      if (rect) setAnchorRect(rect);
      ensureProfileLoaded(rowId);
      selectUserForCompare(rowId, { scroll: false });
    }
  }

  return (
    <div className={embedded ? "space-y-4" : "mx-auto w-full max-w-[430px] space-y-4 px-4 py-6 md:max-w-6xl md:px-6 md:py-8"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Рейтинг PvP</h1>
          <p className="mt-1 text-sm text-muted">Таблица лидеров, график PTS и сравнение игроков.</p>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Место</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">#{position?.rank ?? "-"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Перцентиль</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatPercent(position?.percentile || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">PTS за период</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(position?.pts_period || 0)}</p>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-foreground">Таблица лидеров</h2>
            <p className="mt-1 text-xs text-muted">Игроков в выборке: {formatNumber(leaderboard.total || 0)}</p>
            <p className="mt-1 text-xs text-muted">Hover показывает минипрофиль, клик закрепляет карточку и добавляет игрока в сравнение.</p>

            {(leaderboard.items || []).length === 0 ? (
              <p className="mt-3 text-sm text-muted">По этим фильтрам нет игроков.</p>
            ) : (
              <div ref={tableRef} className="mt-3 overflow-x-auto rounded-btn border border-border/70">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                        <th className="py-2 pl-3 pr-4">Место</th>
                        <th className="py-2 pr-4">Игрок</th>
                        <th className="py-2 pr-4">Общий PTS</th>
                        <th className="py-2 pr-4">PTS за период</th>
                        <th className="py-2 pr-4">Серия</th>
                      </tr>
                    </thead>
                    <tbody onMouseLeave={() => {
                      // Only clear hover preview, pinned stays
                      if (pinnedUserId == null) {
                        setHoveredUserId(null);
                        setAnchorRect(null);
                      }
                    }}>
                      {leaderboard.items.map((row) => {
                        const rowId = Number(row.user_id);
                        const isActive = Number(activePreviewUserId) === rowId;
                        const isPinned = Number(pinnedUserId) === rowId;
                        const avatarUrl = resolveAssetUrl(row.avatar_url || "");

                        return (
                          <tr
                            key={row.user_id}
                            className={[
                              "cursor-pointer border-b border-border/60 text-foreground transition-colors",
                              isActive ? "bg-accent/10" : "hover:bg-canvas/60",
                            ].join(" ")}
                            onMouseEnter={(e) => {
                              const avatarEl = e.currentTarget.querySelector(".avatar-anchor");
                              const rect = avatarEl ? avatarEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
                              handleLeaderboardRowHover(row, rect);
                            }}
                            onClick={(e) => {
                              const avatarEl = e.currentTarget.querySelector(".avatar-anchor");
                              const rect = avatarEl ? avatarEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
                              handleLeaderboardRowClick(row, rect);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleLeaderboardRowClick(row);
                              }
                            }}
                            tabIndex={0}
                            aria-label={`Игрок ${row.display_name}`}
                          >
                            <td className="py-2 pl-3 pr-4 font-semibold">
                              <div className="flex items-center gap-2">
                                <span>#{row.rank}</span>
                                {isPinned ? <span className="h-2 w-2 rounded-full bg-accent" title="Закреплён" /> : null}
                              </div>
                            </td>

                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-3">
                                <div className="avatar-anchor h-9 w-9 overflow-hidden rounded-full border border-border bg-elevated">
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt={`Аватар ${row.display_name}`} className="h-full w-full object-cover" />
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

          <LeaderboardMiniProfileCard
            row={activePreviewRow}
            profile={activePreviewProfile}
            loading={activePreviewLoading}
            pinned={Boolean(activePreviewRow && Number(pinnedUserId) === Number(activePreviewRow.user_id))}
            isSelf={Boolean(activePreviewRow && Number(activePreviewRow.user_id) === Number(user?.id))}
            anchorRect={anchorRect}
            onTogglePin={() => {
              if (!activePreviewRow) return;
              const activeId = Number(activePreviewRow.user_id);
              const isAlreadyPinned = Number(pinnedUserId) === activeId;
              setPinnedUserId(isAlreadyPinned ? null : activeId);
              ensureProfileLoaded(activeId);
            }}
            onCompare={() => {
              if (!activePreviewRow) return;
              selectUserForCompare(activePreviewRow.user_id, { scroll: true });
            }}
          />

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-foreground">График изменения PTS</h2>
            <p className="mt-1 text-xs text-muted">Накопленная дельта по выбранным фильтрам.</p>
            <div className="mt-3">
              <HistoryChart points={history.chart || []} />
            </div>
          </Card>

          <div ref={compareSectionRef}>
            <Card className="p-5">
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
                    ensureProfileLoaded(nextId);
                  }}
                  className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
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
                    <div className="grid grid-cols-[1fr_48px_1fr] items-center gap-2">
                      <div className={`rounded-2xl border p-4 ${leftWins ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-canvas"}`}>
                        <p className="text-[11px] uppercase tracking-wider text-muted">Вы</p>
                        <p className="mt-1 truncate text-base font-bold text-foreground">{compareData.left.display_name}</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">{formatNumber(leftPts)}</p>
                        <p className="text-xs text-muted">PTS общий</p>
                        {leftWins && <p className="mt-2 text-xs font-semibold text-yellow-400">👑 Лидер</p>}
                      </div>

                      <div className="flex items-center justify-center">
                        <span className="rounded-full bg-elevated px-2 py-1 text-xs font-bold text-muted">VS</span>
                      </div>

                      <div className={`rounded-2xl border p-4 ${!leftWins ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-canvas"}`}>
                        <p className="text-[11px] uppercase tracking-wider text-muted">Соперник</p>
                        <p className="mt-1 truncate text-base font-bold text-foreground">{compareData.right.display_name}</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">{formatNumber(rightPts)}</p>
                        <p className="text-xs text-muted">PTS общий</p>
                        {!leftWins && <p className="mt-2 text-xs font-semibold text-yellow-400">👑 Лидер</p>}
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
                    <div className="mt-4 grid grid-cols-3 gap-2">
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

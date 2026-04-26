import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/Card.jsx";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value || 0));
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
    return <p className="text-sm text-muted">Нет данных для графика за выбранный период.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>Диапазон дельты</span>
        <span>
          {formatNumber(min)} .. {formatNumber(max)}
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
      </div>

      <div className="p-4">
        <div className="-mt-10 flex items-end gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-full border-[3px] border-canvas bg-elevated">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`Аватар ${displayName}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-foreground">
                {displayName[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
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

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={onTogglePin} variant={pinned ? "secondary" : "primary"} className="h-10 rounded-[10px] px-3">
            {pinned ? "Открепить" : "Закрепить"}
          </Button>
          <Button
            onClick={onCompare}
            variant="secondary"
            disabled={isSelf}
            className="h-10 rounded-[10px] px-3"
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

  const compareSectionRef = useRef(null);

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
    setHoveredUserId(row.user_id);
    if (rect) setAnchorRect(rect);
    ensureProfileLoaded(row.user_id);
  }

  function handleLeaderboardRowClick(row) {
    const rowId = Number(row.user_id);
    const alreadyPinned = Number(pinnedUserId) === rowId;

    setPinnedUserId(alreadyPinned ? null : rowId);
    setHoveredUserId(rowId);
    ensureProfileLoaded(rowId);

    if (!alreadyPinned) {
      selectUserForCompare(rowId, { scroll: true });
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
              <p className="text-xs uppercase tracking-wide text-muted">Дельта периода</p>
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
              <div className="mt-3 overflow-x-auto rounded-btn border border-border/70">
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
                    <tbody onMouseLeave={() => { setHoveredUserId(null); setAnchorRect(null); }}>
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
                            onClick={() => handleLeaderboardRowClick(row)}
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
                              <span>#{row.rank}</span>
                              {isPinned ? <span className="ml-2 text-[10px] uppercase tracking-wide text-accent">pin</span> : null}
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
              <h2 className="text-lg font-semibold text-foreground">Сравнение с другим игроком</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(220px,320px)_1fr] sm:items-start">
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
                  <option value="">Выберите игрока из таблицы</option>
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
                      <p className="mt-1 text-sm text-foreground">Общий: {formatNumber(compareData.left.pts_total)}</p>
                      <p className="text-sm text-foreground">Период: {formatNumber(compareData.left.pts_period)}</p>
                      <p className="text-sm text-muted">Место: {compareData.left.rank ?? "-"}</p>
                    </div>
                    <div className="rounded-btn border border-border bg-canvas p-3">
                      <p className="text-xs uppercase tracking-wide text-muted">{compareData.right.display_name}</p>
                      <p className="mt-1 text-sm text-foreground">Общий: {formatNumber(compareData.right.pts_total)}</p>
                      <p className="text-sm text-foreground">Период: {formatNumber(compareData.right.pts_period)}</p>
                      <p className="text-sm text-muted">Место: {compareData.right.rank ?? "-"}</p>
                    </div>
                    <div className="rounded-btn border border-border bg-canvas p-3 sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted">Разница (вы - соперник)</p>
                      <p className="mt-1 text-sm text-foreground">
                        Общий: {formatNumber(compareData.pts_total_diff)} | Период: {formatNumber(compareData.pts_period_diff)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
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

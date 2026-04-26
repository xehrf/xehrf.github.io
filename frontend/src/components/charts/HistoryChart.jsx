import { useMemo } from "react";

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value || 0));
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

export function HistoryChart({ points }) {
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

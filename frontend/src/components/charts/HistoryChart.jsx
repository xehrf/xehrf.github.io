import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0));
}

// Crosshair plugin — vertical dashed line on hover
const crosshairPlugin = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const { ctx, tooltip, chartArea, scales } = chart;
    if (!tooltip._active || !tooltip._active.length) return;

    const activePoint = tooltip._active[0];
    const x = activePoint.element.x;

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  }
};

ChartJS.register(crosshairPlugin);

export function HistoryChart({ points }) {
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);
  const [isDark, setIsDark] = useState(false);
  const [metrics, setMetrics] = useState({ initial: 0, final: 0, growth: 0, growthPercent: 0 });
  const [tooltipData, setTooltipData] = useState(null);

  useEffect(() => {
    const checkTheme = () => setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    checkTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', checkTheme);
    return () => mq.removeEventListener('change', checkTheme);
  }, []);

  const chartData = useMemo(() => {
    let cumulative = 0;
    const processed = (points || []).map(point => {
      cumulative += Number(point.total_delta || 0);
      return { y: cumulative, label: point.date };
    });

    const labels = processed.map(p => p.label);
    const values = processed.map(p => p.y);
    const initialValue = values[0] || 0;
    const finalValue = values[values.length - 1] || 0;
    const growth = finalValue - initialValue;
    const growthPercent = initialValue !== 0 ? (growth / initialValue) * 100 : 0;

    setMetrics({ initial: initialValue, final: finalValue, growth, growthPercent });
    return { labels, values };
  }, [points]);

  const createGradient = (ctx, chartArea) => {
    if (!ctx || !chartArea) return 'rgba(255,215,0,0.1)';
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, isDark ? 'rgba(255,215,0,0.22)' : 'rgba(255,215,0,0.28)');
    gradient.addColorStop(0.6, isDark ? 'rgba(255,215,0,0.06)' : 'rgba(255,215,0,0.08)');
    gradient.addColorStop(1, 'rgba(255,215,0,0)');
    return gradient;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeInOutQuart' },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external(context) {
          const tooltipModel = context.tooltip;
          if (tooltipModel.opacity === 0) {
            setTooltipData(null);
            return;
          }
          if (tooltipModel.dataPoints?.length) {
            const idx = tooltipModel.dataPoints[0].dataIndex;
            const position = context.chart.canvas.getBoundingClientRect();
            setTooltipData({
              value: chartData.values[idx],
              label: chartData.labels[idx],
              x: tooltipModel.caretX,
              y: tooltipModel.caretY,
              canvasLeft: position.left + window.scrollX,
              canvasTop: position.top + window.scrollY
            });
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
          font: { size: 11, family: "'DM Mono', monospace", weight: '400' },
          maxTicksLimit: 6,
          maxRotation: 0
        }
      },
      y: {
        grid: {
          color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          drawBorder: false
        },
        border: { display: false, dash: [4, 4] },
        ticks: {
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
          font: { size: 11, family: "'DM Mono', monospace" },
          callback: v => formatNumber(v)
        }
      }
    }
  };

  const chartDataConfig = {
    labels: chartData.labels,
    datasets: [{
      label: 'PTS',
      data: chartData.values,
      borderColor: '#FFD700',
      backgroundColor(context) {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return null;
        return createGradient(ctx, chartArea);
      },
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: '#FFD700',
      pointHoverBorderColor: isDark ? '#1a1a1a' : '#ffffff',
      pointHoverBorderWidth: 2.5
    }]
  };

  const isPositive = metrics.growth >= 0;

  if (!chartData.values.length) {
    return (
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
        Нет данных за выбранный период.
      </p>
    );
  }

  return (
    <div style={{ width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 28, height: 2,
          background: 'linear-gradient(90deg, #FFD700, rgba(255,215,0,0.2))',
          borderRadius: 2
        }} />
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
        }}>
          Динамика PTS
        </span>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          {
            label: 'Начало',
            value: formatNumber(metrics.initial) + ' PTS',
            sub: chartData.labels[0] || '—',
            accent: false
          },
          {
            label: 'Сейчас',
            value: formatNumber(metrics.final) + ' PTS',
            sub: chartData.labels[chartData.labels.length - 1] || '—',
            accent: false
          },
          {
            label: 'Прирост',
            value: (isPositive ? '+' : '') + formatNumber(metrics.growth) + ' PTS',
            sub: (isPositive ? '↑' : '↓') + ' ' + Math.abs(metrics.growthPercent).toFixed(1) + '%',
            accent: true,
            positive: isPositive
          }
        ].map((card, i) => (
          <div
            key={i}
            style={{
              borderRadius: 14,
              padding: '14px 16px',
              background: isDark
                ? (card.accent ? 'rgba(255,215,0,0.07)' : 'rgba(255,255,255,0.04)')
                : (card.accent ? 'rgba(255,215,0,0.08)' : 'rgba(0,0,0,0.03)'),
              border: `1px solid ${
                card.accent
                  ? 'rgba(255,215,0,0.25)'
                  : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
              }`,
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{
              fontSize: 10,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              marginBottom: 8
            }}>
              {card.label}
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: card.accent
                ? '#FFD700'
                : isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
              marginBottom: 4,
              lineHeight: 1
            }}>
              {card.value}
            </div>
            <div style={{
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              color: card.accent
                ? (card.positive ? '#4ade80' : '#f87171')
                : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
            }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Chart Container */}
      <div style={{
        position: 'relative',
        borderRadius: 16,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        padding: '20px 16px 12px',
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        height: 280
      }}>
        <Line ref={chartRef} data={chartDataConfig} options={chartOptions} />

        {/* React-rendered tooltip */}
        {tooltipData && (
          <div
            ref={tooltipRef}
            style={{
              position: 'absolute',
              left: tooltipData.x,
              top: tooltipData.y - 56,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 10,
              background: isDark ? 'rgba(18,18,18,0.92)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${isDark ? 'rgba(255,215,0,0.3)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 10,
              padding: '9px 14px',
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.5)'
                : '0 4px 20px rgba(0,0,0,0.12)',
              minWidth: 120,
              textAlign: 'center'
            }}
          >
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#FFD700',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '-0.01em',
              marginBottom: 2
            }}>
              {formatNumber(tooltipData.value)} PTS
            </div>
            <div style={{
              fontSize: 10,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.05em',
              color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
            }}>
              {tooltipData.label}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

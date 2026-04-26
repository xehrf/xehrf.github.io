import React, { useEffect, useRef, useState } from 'react';
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

const BeautifulLineChart = ({ data = {}, height = 400, className = '' }) => {
  const chartRef = useRef(null);
  const [isDark, setIsDark] = useState(false);
  const [metrics, setMetrics] = useState({
    initial: 0,
    final: 0,
    growth: 0,
    growthPercent: 0
  });

  // Default data if not provided
  const chartData = data.labels && data.values ? data : {
    labels: ['24 апр', '25 апр'],
    values: [110, 135]
  };

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(darkMode);
    };

    checkTheme();
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);
    
    return () => mediaQuery.removeEventListener('change', checkTheme);
  }, []);

  // Calculate metrics
  useEffect(() => {
    const initialValue = chartData.values[0];
    const finalValue = chartData.values[chartData.values.length - 1];
    const growth = finalValue - initialValue;
    const growthPercent = initialValue !== 0 ? ((growth / initialValue) * 100) : 0;

    setMetrics({
      initial: initialValue,
      final: finalValue,
      growth,
      growthPercent
    });
  }, [chartData]);

  // Create gradient
  const createGradient = (ctx) => {
    if (!ctx) return null;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    
    if (isDark) {
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
    }
    
    return gradient;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false,
        external: function(context) {
          // Tooltip Element
          let tooltipEl = document.getElementById('chartjs-tooltip');

          if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartjs-tooltip';
            tooltipEl.className = 'custom-tooltip';
            document.body.appendChild(tooltipEl);
          }

          // Hide if no tooltip
          const tooltipModel = context.tooltip;
          if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = 0;
            return;
          }

          // Set Text
          if (tooltipModel.body) {
            const dataIndex = tooltipModel.dataPoints[0].dataIndex;
            const value = chartData.values[dataIndex];
            const label = chartData.labels[dataIndex];

            tooltipEl.innerHTML = `
              <div class="tooltip-value">${value.toLocaleString('ru-RU')} PTS</div>
              <div class="tooltip-label">${label} 2026</div>
            `;
          }

          const position = context.chart.canvas.getBoundingClientRect();

          // Display, position, and set styles for font
          tooltipEl.style.opacity = 1;
          tooltipEl.style.position = 'absolute';
          tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
          tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY - 40 + 'px';
          tooltipEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          tooltipEl.style.fontSize = '13px';
          tooltipEl.style.fontStyle = tooltipModel._bodyFontStyle;
          tooltipEl.style.padding = '12px 16px';
          tooltipEl.style.pointerEvents = 'none';
          tooltipEl.style.transition = 'all 0.2s ease';
          tooltipEl.style.transform = 'translateX(-50%)';
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      y: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
          drawBorder: false
        },
        ticks: {
          color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          font: {
            size: 12,
            weight: '500'
          },
          callback: function(value) {
            return value.toLocaleString('ru-RU') + ' PTS';
          }
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
      backgroundColor: function(context) {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        if (!chartArea) {
          return null;
        }
        return createGradient(ctx);
      },
      borderWidth: 2.5,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#FFD700',
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 2,
      pointBackgroundColor: '#FFD700',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 0
    }]
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Custom Legend */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-0.5 w-6 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500"></div>
        <span className="text-sm font-medium text-foreground">Динамика показателей</span>
      </div>

      {/* Metrics Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-elevated/50 p-4 transition-all hover:shadow-sm">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Начальное значение</div>
          <div className="mb-1 text-2xl font-bold text-foreground">
            {metrics.initial.toLocaleString('ru-RU')} PTS
          </div>
          <div className="text-xs text-muted">24 апр 2026</div>
        </div>
        <div className="rounded-card border border-border bg-elevated/50 p-4 transition-all hover:shadow-sm">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Текущее значение</div>
          <div className="mb-1 text-2xl font-bold text-foreground">
            {metrics.final.toLocaleString('ru-RU')} PTS
          </div>
          <div className="text-xs text-muted">25 апр 2026</div>
        </div>
        <div className="rounded-card border border-border bg-elevated/50 p-4 transition-all hover:shadow-sm">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Прирост</div>
          <div className="mb-1 text-2xl font-bold text-foreground">
            {metrics.growth > 0 ? '+' : ''}{metrics.growth.toLocaleString('ru-RU')} PTS
          </div>
          <div className={`text-xs ${metrics.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {metrics.growth >= 0 ? '↑' : '↓'} {Math.abs(metrics.growthPercent).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-card border border-border bg-elevated/50 p-6" style={{ height: `${height}px` }}>
        <Line ref={chartRef} data={chartDataConfig} options={chartOptions} />
      </div>

      {/* Global styles for custom tooltip */}
      <style jsx>{`
        .custom-tooltip {
          background: ${isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)'};
          backdrop-filter: blur(12px);
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'};
          border-radius: 12px;
          padding: 12px 16px;
          box-shadow: 0 4px 20px ${isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.15)'};
          font-size: 13px;
          font-weight: 500;
          color: ${isDark ? '#ffffff' : '#1a1a1a'};
          pointer-events: none;
          transition: all 0.2s ease;
        }

        .tooltip-value {
          font-size: 16px;
          font-weight: 700;
          color: #FFD700;
          margin-bottom: 4px;
        }

        .tooltip-label {
          opacity: 0.8;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};

export default BeautifulLineChart;

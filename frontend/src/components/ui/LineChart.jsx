import { useEffect, useRef, useState } from 'react';

export function LineChart({ data, title, subtitle, height = 300 }) {
  const canvasRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [metrics, setMetrics] = useState({ initial: 0, final: 0, increment: 0 });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkTheme(mediaQuery.matches);
    
    const handleChange = (e) => setIsDarkTheme(e.matches);
    mediaQuery.addListener(handleChange);
    
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!data || data.length === 0) return;
    
    const initial = data[0].value;
    const final = data[data.length - 1].value;
    const increment = final - initial;
    
    setMetrics({ initial, final, increment });
  }, [data]);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const chartHeight = height - 60; // Leave space for labels
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate data bounds
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    const valuePadding = valueRange * 0.1;
    
    const adjustedMin = minValue - valuePadding;
    const adjustedMax = maxValue + valuePadding;
    const adjustedRange = adjustedMax - adjustedMin;
    
    // Draw grid
    ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // Y-axis labels
      const value = adjustedMax - (adjustedRange / 5) * i;
      ctx.fillStyle = isDarkTheme ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(0), padding.left - 10, y + 4);
    }
    
    // Vertical grid lines
    const step = Math.max(1, Math.floor(data.length / 8));
    for (let i = 0; i < data.length; i += step) {
      const x = padding.left + (chartWidth / (data.length - 1)) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
    
    // Create gradient for fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.3)'); // Cyan color with opacity
    gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
    
    // Draw filled area
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * index;
      const y = padding.top + chartHeight - ((point.value - adjustedMin) / adjustedRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        // Smooth curve using quadratic bezier
        const prevX = padding.left + (chartWidth / (data.length - 1)) * (index - 1);
        const prevY = padding.top + chartHeight - ((data[index - 1].value - adjustedMin) / adjustedRange) * chartHeight;
        const cpx = (prevX + x) / 2;
        const cpy = (prevY + y) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpx, cpy);
      }
    });
    
    // Complete the fill area
    const lastX = padding.left + chartWidth;
    const lastY = padding.top + chartHeight - ((data[data.length - 1].value - adjustedMin) / adjustedRange) * chartHeight;
    ctx.lineTo(lastX, lastY);
    ctx.lineTo(lastX, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = '#22D3EE'; // Cyan color
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    data.forEach((point, index) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * index;
      const y = padding.top + chartHeight - ((point.value - adjustedMin) / adjustedRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = padding.left + (chartWidth / (data.length - 1)) * (index - 1);
        const prevY = padding.top + chartHeight - ((data[index - 1].value - adjustedMin) / adjustedRange) * chartHeight;
        const cpx = (prevX + x) / 2;
        const cpy = (prevY + y) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpx, cpy);
      }
    });
    ctx.stroke();
    
    // Draw hover points
    if (hoveredPoint !== null) {
      const x = padding.left + (chartWidth / (data.length - 1)) * hoveredPoint;
      const y = padding.top + chartHeight - ((data[hoveredPoint].value - adjustedMin) / adjustedRange) * chartHeight;
      
      // Outer white border
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      
      // Inner cyan point
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22D3EE';
      ctx.fill();
    }
    
    // X-axis labels
    ctx.fillStyle = isDarkTheme ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    
    const labelStep = Math.max(1, Math.floor(data.length / 6));
    data.forEach((point, index) => {
      if (index % labelStep === 0 || index === data.length - 1) {
        const x = padding.left + (chartWidth / (data.length - 1)) * index;
        const date = new Date(point.date);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        ctx.fillText(label, x, height - 15);
      }
    });
    
  }, [data, height, isDarkTheme, hoveredPoint]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !data || data.length === 0) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = { left: 50, right: 20 };
    const chartWidth = rect.width - padding.left - padding.right;
    
    const relativeX = x - padding.left;
    const index = Math.round((relativeX / chartWidth) * (data.length - 1));
    
    if (index >= 0 && index < data.length && relativeX >= 0 && relativeX <= chartWidth) {
      setHoveredPoint(index);
    } else {
      setHoveredPoint(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div className="w-full">
      {title && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
      )}
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-canvas p-4">
          <div className="text-xs uppercase tracking-wider text-muted">Начальное значение</div>
          <div className="mt-2 text-xl font-semibold text-foreground">{metrics.initial}</div>
        </div>
        <div className="rounded-xl border border-border bg-canvas p-4">
          <div className="text-xs uppercase tracking-wider text-muted">Конечное значение</div>
          <div className="mt-2 text-xl font-semibold text-foreground">{metrics.final}</div>
        </div>
        <div className="rounded-xl border border-border bg-canvas p-4">
          <div className="text-xs uppercase tracking-wider text-muted">Прирост</div>
          <div className="mt-2 text-xl font-semibold text-accent">
            {metrics.increment >= 0 ? '+' : ''}{metrics.increment}
          </div>
        </div>
      </div>
      
      {/* Chart Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          style={{ height: `${height}px` }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        
        {/* Custom Tooltip */}
        {hoveredPoint !== null && data[hoveredPoint] && (
          <div
            className={`absolute pointer-events-none px-3 py-2 rounded-lg shadow-lg border ${
              isDarkTheme 
                ? 'bg-slate-800 border-slate-700' 
                : 'bg-white border-gray-200'
            }`}
            style={{
              left: `${((hoveredPoint / (data.length - 1)) * 100)}%`,
              bottom: `${height + 10}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className={`text-xs font-medium ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
              {data[hoveredPoint].value}
            </div>
            <div className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
              {new Date(data[hoveredPoint].date).toLocaleDateString('ru-RU')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

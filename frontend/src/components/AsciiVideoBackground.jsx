import { useEffect, useRef } from "react";

/**
 * Renders a user's uploaded video as a tightly packed symbol background.
 *
 * The source video is sampled into a tiny offscreen canvas and re-drawn onto
 * a visible canvas with a hybrid character ramp. By default the symbols keep
 * the original video colors so the effect feels more alive.
 */
const HYBRID_CHAR_SET = " .,:-~=+*#0123456789%@";

const CHAR_SETS = {
  hybrid: HYBRID_CHAR_SET,
  ascii: HYBRID_CHAR_SET,
  digits: HYBRID_CHAR_SET,
  binary: HYBRID_CHAR_SET,
};

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function getVideoSymbolColor(red, green, blue, luminance) {
  // Dark pixels need a small lift so they stay visible on the canvas
  // background, while brighter pixels keep most of the original color.
  const boost = luminance < 0.35 ? 1.35 : 1.12;
  const lift = luminance < 0.35 ? 24 : 12;

  return `rgb(${clampByte(red * boost + lift)}, ${clampByte(green * boost + lift)}, ${clampByte(blue * boost + lift)})`;
}

export function AsciiVideoBackground({
  videoUrl,
  variant = "hybrid",
  cellPx = 10,
  colorMode = "video",
  lightColor = "#FFFFFF",
  darkColor = "#FFD700",
  background = "#0D1117",
  opacity = 1,
  fps = 30,
  lightThreshold = 0.62,
  className = "",
  fullscreen = true,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const samplerRef = useRef(null);

  useEffect(() => {
    if (!videoUrl) return undefined;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    if (!samplerRef.current) {
      samplerRef.current = document.createElement("canvas");
    }

    const sampler = samplerRef.current;
    const samplerCtx = sampler.getContext("2d", { willReadFrequently: true });
    if (!samplerCtx) return undefined;

    const chars = CHAR_SETS[variant] ?? CHAR_SETS.hybrid;
    const charsLastIdx = chars.length - 1;
    const frameInterval = Math.max(16, Math.floor(1000 / Math.max(10, fps)));
    const fontSize = Math.max(7, Math.round(cellPx));
    const cellHeight = Math.max(6, Math.round(fontSize * 0.9));

    let mounted = true;
    let rafId = 0;
    let lastFrameAt = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width || window.innerWidth));
      const height = Math.max(1, Math.floor(rect.height || window.innerHeight));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function tick(now) {
      if (!mounted) return;
      rafId = window.requestAnimationFrame(tick);

      if (now - lastFrameAt < frameInterval) return;
      lastFrameAt = now;

      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      const widthCss = canvas.clientWidth || window.innerWidth;
      const heightCss = canvas.clientHeight || window.innerHeight;

      ctx.font = `700 ${fontSize}px ui-monospace, "JetBrains Mono", monospace`;
      ctx.textBaseline = "top";

      const measuredCharWidth = ctx.measureText("8").width || fontSize * 0.62;
      const cellWidth = Math.max(4, Math.round(measuredCharWidth * 0.9));
      const cols = Math.max(1, Math.ceil(widthCss / cellWidth));
      const rows = Math.max(1, Math.ceil(heightCss / cellHeight));

      sampler.width = cols;
      sampler.height = rows;

      try {
        samplerCtx.drawImage(video, 0, 0, cols, rows);
      } catch {
        return;
      }

      let pixels;
      try {
        pixels = samplerCtx.getImageData(0, 0, cols, rows).data;
      } catch {
        return;
      }

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, widthCss, heightCss);

      for (let y = 0; y < rows; y++) {
        let runText = "";
        let runColor = null;
        let runStartX = 0;

        function flushRun() {
          if (!runText || !runColor) return;
          ctx.fillStyle = runColor;
          ctx.fillText(runText, runStartX * cellWidth, y * cellHeight);
          runText = "";
          runColor = null;
        }

        for (let x = 0; x < cols; x++) {
          const idx = (y * cols + x) * 4;
          const red = pixels[idx];
          const green = pixels[idx + 1];
          const blue = pixels[idx + 2];
          const lum = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
          const charIdx = Math.min(charsLastIdx, Math.max(0, Math.round(lum * charsLastIdx)));
          const ch = chars[charIdx];

          if (ch === " ") {
            flushRun();
            continue;
          }

          const symbolColor =
            colorMode === "duotone"
              ? lum >= lightThreshold
                ? lightColor
                : darkColor
              : getVideoSymbolColor(red, green, blue, lum);
          if (!runText) {
            runText = ch;
            runColor = symbolColor;
            runStartX = x;
            continue;
          }

          if (runColor !== symbolColor) {
            flushRun();
            runText = ch;
            runColor = symbolColor;
            runStartX = x;
            continue;
          }

          runText += ch;
        }

        flushRun();
      }
    }

    resize();
    window.addEventListener("resize", resize);

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }

    rafId = window.requestAnimationFrame(tick);

    return () => {
      mounted = false;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      try {
        video.pause();
      } catch {
        // ignore
      }
    };
  }, [videoUrl, variant, cellPx, colorMode, lightColor, darkColor, background, fps, lightThreshold]);

  if (!videoUrl) return null;

  const positionClasses = fullscreen
    ? "pointer-events-none fixed inset-0 z-0 overflow-hidden"
    : "pointer-events-none absolute inset-0 overflow-hidden";

  return (
    <div className={`${positionClasses} ${className}`} style={{ opacity }} aria-hidden="true">
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          opacity: 0,
          width: "1px",
          height: "1px",
          pointerEvents: "none",
        }}
      />
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

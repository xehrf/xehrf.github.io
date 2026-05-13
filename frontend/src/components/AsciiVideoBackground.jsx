import { useEffect, useRef } from "react";

/**
 * Renders a video as live ASCII/number art behind the page.
 *
 * The user's uploaded video is decoded onto an offscreen canvas at a tiny
 * resolution (one pixel per "cell"). Each pixel is mapped to a character
 * based on luminance and drawn in monospace on a full-screen canvas. The
 * raw video element is hidden — only the rendered characters are visible.
 *
 * Variants:
 *   variant="ascii"   → " .:-=+*#%@" gradient
 *   variant="digits"  → "0123456789" gradient (matrix-style numbers)
 *   variant="binary"  → "01" gradient
 *
 * Performance: scales render to a grid of ~`cellPx` blocks. On a 1080p screen
 * with cellPx=10 that's ~190x108 = 20k cells per frame. Frame budget is
 * roughly 4–6ms on a modern laptop. Cap at ~30fps to be friendly to mobile.
 */
const CHAR_SETS = {
  ascii: " .:-=+*#%@",
  digits: " 0123456789",
  binary: " 01",
};

export function AsciiVideoBackground({
  videoUrl,
  variant = "digits",
  cellPx = 10,
  color = "#FFD700",
  background = "#0D1117",
  opacity = 1,
  fps = 30,
  className = "",
  // When true (default) the component covers the viewport via `fixed inset-0`.
  // When false it fills its containing block so it can be embedded inside a
  // preview card or any other bounded layout.
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

    // Offscreen low-res sampler — created once per mount.
    if (!samplerRef.current) {
      samplerRef.current = document.createElement("canvas");
    }
    const sampler = samplerRef.current;
    const samplerCtx = sampler.getContext("2d", { willReadFrequently: true });

    const chars = CHAR_SETS[variant] ?? CHAR_SETS.digits;
    const charsLastIdx = chars.length - 1;
    const cellWidth = Math.max(6, cellPx);
    const cellHeight = Math.max(6, Math.round(cellPx * 1.2));
    const frameInterval = Math.max(16, Math.floor(1000 / Math.max(10, fps)));

    let mounted = true;
    let rafId = 0;
    let lastFrameAt = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Use the actual rendered size of the canvas so the same component
      // works fullscreen and inside a preview card.
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width || window.innerWidth));
      const h = Math.max(1, Math.floor(rect.height || window.innerHeight));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function tick(now) {
      if (!mounted) return;
      rafId = window.requestAnimationFrame(tick);

      // Throttle to target fps.
      if (now - lastFrameAt < frameInterval) return;
      lastFrameAt = now;

      if (
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return;
      }

      const widthCss = canvas.clientWidth || window.innerWidth;
      const heightCss = canvas.clientHeight || window.innerHeight;
      const cols = Math.max(1, Math.ceil(widthCss / cellWidth));
      const rows = Math.max(1, Math.ceil(heightCss / cellHeight));

      sampler.width = cols;
      sampler.height = rows;
      try {
        samplerCtx.drawImage(video, 0, 0, cols, rows);
      } catch {
        // Source may not be ready or CORS may have failed — skip this frame.
        return;
      }

      let pixels;
      try {
        pixels = samplerCtx.getImageData(0, 0, cols, rows).data;
      } catch {
        // CORS taint on the video. Caller must pass a cross-origin-safe URL.
        return;
      }

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, widthCss, heightCss);
      ctx.fillStyle = color;
      ctx.font = `${cellHeight}px ui-monospace, "JetBrains Mono", monospace`;
      ctx.textBaseline = "top";

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = (y * cols + x) * 4;
          // Rec. 709 luminance approximation, normalized to 0..1.
          const lum =
            (pixels[idx] * 0.2126 +
              pixels[idx + 1] * 0.7152 +
              pixels[idx + 2] * 0.0722) /
            255;
          const charIdx = Math.min(
            charsLastIdx,
            Math.max(0, Math.round(lum * charsLastIdx))
          );
          const ch = chars[charIdx];
          if (ch !== " ") {
            ctx.fillText(ch, x * cellWidth, y * cellHeight);
          }
        }
      }
    }

    resize();
    window.addEventListener("resize", resize);

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Autoplay can be blocked in some contexts — the canvas will simply
        // remain on the last frame until something resumes playback.
      });
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
  }, [videoUrl, variant, cellPx, color, background, fps]);

  if (!videoUrl) return null;

  const positionClasses = fullscreen
    ? "pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    : "pointer-events-none absolute inset-0 overflow-hidden";

  return (
    <div
      className={`${positionClasses} ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* Hidden source. crossOrigin="anonymous" so the canvas isn't tainted
          when the video is served from Cloudinary (it returns Access-Control-Allow-Origin: *). */}
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

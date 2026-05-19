/**
 * Plain video background — the source video plays full-bleed behind the app
 * with reduced brightness + opacity so foreground UI stays readable. This is
 * the simpler alternative to AsciiVideoBackground for users who prefer the
 * original footage over the symbol overlay.
 */
export function VideoBackground({
  videoUrl,
  fullscreen = true,
  opacity = 0.3,
  brightness = 0.55,
  blurPx = 0,
  className = "",
}) {
  if (!videoUrl) return null;

  const positionClasses = fullscreen
    ? "pointer-events-none fixed inset-0 z-0 overflow-hidden"
    : "pointer-events-none absolute inset-0 overflow-hidden";

  const filterParts = [];
  if (brightness !== 1) filterParts.push(`brightness(${brightness})`);
  if (blurPx > 0) filterParts.push(`blur(${blurPx}px)`);
  const filter = filterParts.length ? filterParts.join(" ") : undefined;

  return (
    <div className={`${positionClasses} ${className}`} style={{ opacity }} aria-hidden="true">
      <video
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        crossOrigin="anonymous"
        className="h-full w-full object-cover"
        style={{ filter }}
      />
      {/* Subtle dark wash so colored frames stay readable against the UI */}
      <div className="absolute inset-0 bg-canvas/30" />
    </div>
  );
}

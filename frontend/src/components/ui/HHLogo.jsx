/**
 * Round hh.ru / hh.kz brand mark — inline SVG so it scales cleanly and works
 * offline. Recognisable approximation of the official red-circle "hh" badge.
 * Used wherever we surface that an item came from HH (announcement cards,
 * details page chip, filter pills).
 */
export function HHLogo({ size = 16, title = "hh.ru", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <circle cx="16" cy="16" r="16" fill="#D6001C" />
      {/* "hh" wordmark — two stylised h's, kerned tight to evoke the official
          logo without trying to clone the exact bezier paths. */}
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontFamily="-apple-system, 'Segoe UI', system-ui, Arial, sans-serif"
        fontSize="17"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="-1"
      >
        hh
      </text>
    </svg>
  );
}

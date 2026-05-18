/**
 * Shared tuning for AsciiVideoBackground.
 *
 * The "page" preset is what users actually see across the whole app — picked
 * to feel like a Matrix-style overlay: the source video is still recognisable
 * (colors + outlines), but the field is dim enough that buttons and text on
 * top stay easy to read. The "preview" preset mirrors `page` so the file the
 * user uploads in Settings looks the same in the small preview as it does
 * once it's live across the site.
 */
export const PAGE_BACKGROUND_PRESET = {
  opacity: 0.32,
  cellPx: 13,
  symbolScale: 0.92,
  densityScale: 1.05,
  fps: 18,
  variableSizing: true,
  renderDpr: 1,
  maxCols: 160,
  maxRows: 80,
};

export const PREVIEW_BACKGROUND_PRESET = {
  ...PAGE_BACKGROUND_PRESET,
  // Inside the small bordered preview box we don't have to fight foreground
  // content for readability, so we bump opacity to make the effect pop.
  opacity: 0.85,
  cellPx: 9,
  fps: 24,
  maxCols: Infinity,
  maxRows: Infinity,
};

/**
 * Plain (non-ASCII) video background tuning. Used when the user prefers the
 * raw footage as a wallpaper rather than the symbol overlay.
 */
export const PLAIN_VIDEO_PAGE_PRESET = {
  opacity: 0.28,
  brightness: 0.55,
  blurPx: 0,
};

export const PLAIN_VIDEO_PREVIEW_PRESET = {
  opacity: 0.85,
  brightness: 0.7,
  blurPx: 0,
};

export const BG_MODE_ASCII = "ascii";
export const BG_MODE_PLAIN = "plain";
export const BG_MODE_STORAGE_KEY = "bg_video_mode";

export function getStoredBgMode() {
  if (typeof window === "undefined") return BG_MODE_ASCII;
  const raw = window.localStorage.getItem(BG_MODE_STORAGE_KEY);
  return raw === BG_MODE_PLAIN ? BG_MODE_PLAIN : BG_MODE_ASCII;
}

export function setStoredBgMode(mode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BG_MODE_STORAGE_KEY, mode);
}

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

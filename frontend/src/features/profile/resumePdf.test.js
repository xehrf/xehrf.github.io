import { describe, expect, it } from "vitest";
import { escapeHtml, getCanvasSliceHeights, getPdfPageHeightPx } from "./resumePdf.js";

describe("resumePdf helpers", () => {
  it("escapes user-provided HTML", () => {
    expect(escapeHtml(`<b class="x">Tom & 'Jerry'</b>`)).toBe(
      "&lt;b class=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;",
    );
  });

  it("calculates a positive PDF page height in pixels", () => {
    expect(getPdfPageHeightPx(794)).toBeGreaterThan(0);
  });

  it("splits tall canvases into integer-height slices without zero-height pages", () => {
    expect(getCanvasSliceHeights(4491, 2245.2)).toEqual([
      { srcY: 0, height: 2245 },
      { srcY: 2245, height: 2245 },
      { srcY: 4490, height: 1 },
    ]);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompyraEmoji, CompyraText, COMPYRA_EMOJI_NAMES } from "./CompyraEmoji.jsx";

describe("CompyraEmoji", () => {
  it("renders known custom emoji as svg", () => {
    const html = renderToStaticMarkup(<CompyraEmoji name="trophy" size={32} />);

    expect(html).toContain("<svg");
    expect(html).toContain('width="32"');
  });

  it("keeps the public emoji registry available", () => {
    expect(COMPYRA_EMOJI_NAMES).toContain("trophy");
    expect(COMPYRA_EMOJI_NAMES).toContain("speech");
  });

  it("replaces mapped text emoji and skips variation selectors", () => {
    const html = renderToStaticMarkup(<CompyraText>⚔️ Дуэль</CompyraText>);

    expect(html).toContain("<svg");
    expect(html).toContain("Дуэль");
    expect(html).not.toContain("️");
  });
});

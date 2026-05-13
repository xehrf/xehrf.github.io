import { describe, expect, it } from "vitest";
import { getAssetMediaKind, isVideoAsset } from "./media.js";

describe("media utils", () => {
  it("detects videos by mime type for local preview URLs", () => {
    expect(getAssetMediaKind("blob:http://localhost/preview", "video/mp4")).toBe("video");
  });

  it("detects cloudinary video asset URLs", () => {
    expect(isVideoAsset("https://res.cloudinary.com/demo/video/upload/v1/sample.mp4")).toBe(true);
  });

  it("detects image extensions", () => {
    expect(getAssetMediaKind("https://cdn.example.com/avatar.webp")).toBe("image");
  });
});

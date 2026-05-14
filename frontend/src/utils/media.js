const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"]);

function extractExtension(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url, window.location.origin);
    const filename = parsed.pathname.split("/").pop() || "";
    const cleanName = filename.split(".").pop() || "";
    return cleanName.toLowerCase();
  } catch {
    const cleanUrl = String(url).split("?")[0].split("#")[0];
    const filename = cleanUrl.split("/").pop() || "";
    return (filename.split(".").pop() || "").toLowerCase();
  }
}

export function getAssetMediaKind(url, mimeType = "") {
  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();
  if (normalizedMimeType.startsWith("video/")) return "video";
  if (normalizedMimeType.startsWith("image/")) return "image";

  const normalizedUrl = String(url || "").trim().toLowerCase();
  if (!normalizedUrl) return "unknown";

  if (normalizedUrl.includes("/video/upload/")) return "video";
  if (normalizedUrl.includes("/image/upload/")) return "image";

  const extension = extractExtension(normalizedUrl);
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";

  return "unknown";
}

export function isVideoAsset(url, mimeType = "") {
  return getAssetMediaKind(url, mimeType) === "video";
}

import { getAssetMediaKind } from "../../utils/media.js";

export function MediaAsset({
  src,
  mimeType = "",
  alt = "",
  className = "",
  onError,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  preload = "metadata",
}) {
  const mediaKind = getAssetMediaKind(src, mimeType);
  if (!src) return null;

  if (mediaKind === "video") {
    return (
      <video
        src={src}
        className={className}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
        onError={onError}
      />
    );
  }

  return <img src={src} alt={alt} className={className} onError={onError} />;
}

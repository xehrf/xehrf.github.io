import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons.jsx";
import { AsciiVideoBackground } from "../components/AsciiVideoBackground.jsx";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_PROFILE_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 15 * 1024 * 1024;

function formatFileSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function ConnectionBadge({ label, connected }) {
  return (
    <div
      className={`rounded-btn border px-4 py-3 transition-colors ${
        connected
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-elevated/30"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-bold ${
          connected ? "text-accent" : "text-foreground/70"
        }`}
      >
        {connected ? "✓ Подключён" : "Не подключён"}
      </p>
    </div>
  );
}

function AsciiBackgroundPreview({ videoUrl }) {
  return (
    <AsciiVideoBackground
      videoUrl={videoUrl}
      fullscreen={false}
      // Tighter cell size keeps the effect readable inside the small preview.
      cellPx={8}
      fps={24}
    />
  );
}

export function EditProfilePage() {
  const [profile, setProfile] = useState(null);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bgVideoFile, setBgVideoFile] = useState(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [bannerPreviewError, setBannerPreviewError] = useState(false);
  const navigate = useNavigate();
  const { refreshMe, user } = useAuth();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await apiFetch("/users/me/profile");
        if (!mounted) return;
        setProfile(p);
        setNickname(p.nickname || p.display_name || "");
        setBio(p.bio || "");
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить профиль");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const bannerPreview = useMemo(() => {
    if (bannerFile) return URL.createObjectURL(bannerFile);
    return resolveAssetUrl(profile?.banner_url ?? "");
  }, [bannerFile, profile]);

  const avatarPreview = useMemo(() => {
    if (avatarFile) return URL.createObjectURL(avatarFile);
    return resolveAssetUrl(profile?.avatar_url ?? "");
  }, [avatarFile, profile]);

  useEffect(() => {
    return () => {
      if (bannerPreview && bannerFile) URL.revokeObjectURL(bannerPreview);
      if (avatarPreview && avatarFile) URL.revokeObjectURL(avatarPreview);
    };
  }, [bannerPreview, bannerFile, avatarPreview, avatarFile]);

  const bgVideoPreview = useMemo(() => {
    if (bgVideoFile) return URL.createObjectURL(bgVideoFile);
    return resolveAssetUrl(profile?.bg_video_url ?? "");
  }, [bgVideoFile, profile]);

  useEffect(() => {
    return () => {
      if (bgVideoFile && bgVideoPreview) URL.revokeObjectURL(bgVideoPreview);
    };
  }, [bgVideoFile, bgVideoPreview]);

  const handleBgVideoFile = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setBgVideoFile(null);
      return;
    }
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setBgError("Неподдерживаемый формат. Используй MP4, WebM или MOV.");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      setBgError(`Видео слишком большое. Максимум ${formatFileSize(MAX_VIDEO_SIZE)}.`);
      return;
    }
    setBgError("");
    setBgVideoFile(file);
  };

  const handleBgVideoUpload = async () => {
    if (!bgVideoFile) {
      setBgError("Сначала выбери файл видео.");
      return;
    }
    setBgUploading(true);
    setBgError("");
    try {
      const payload = new FormData();
      payload.append("video", bgVideoFile);
      const updated = await apiFetch("/users/me/bg-video", {
        method: "POST",
        body: payload,
        timeoutMs: 60000,
        headers: {},
      });
      setProfile(updated);
      setBgVideoFile(null);
      await refreshMe();
    } catch (e) {
      setBgError(e?.message || "Не удалось загрузить видео");
    } finally {
      setBgUploading(false);
    }
  };

  const handleBgVideoRemove = async () => {
    setBgUploading(true);
    setBgError("");
    try {
      const updated = await apiFetch("/users/me/bg-video", { method: "DELETE" });
      setProfile(updated);
      setBgVideoFile(null);
      await refreshMe();
    } catch (e) {
      setBgError(e?.message || "Не удалось удалить видео");
    } finally {
      setBgUploading(false);
    }
  };

  useEffect(() => {
    setAvatarPreviewError(false);
    setBannerPreviewError(false);
  }, [avatarPreview, bannerPreview]);

  const handleFile = (setter) => (event) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setter(null);
      return;
    }
    if (!ALLOWED_PROFILE_MEDIA_TYPES.includes(file.type)) {
      setError("Неподдерживаемый формат. Используйте JPG, PNG, GIF, WEBP, MP4, WebM или MOV.");
      return;
    }
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const maxAllowedSize = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
    if (file.size > maxAllowedSize) {
      setError(
        isVideo
          ? `Видео слишком большое. Максимум ${formatFileSize(MAX_VIDEO_SIZE)}.`
          : `Файл слишком большой. Максимум ${formatFileSize(MAX_FILE_SIZE)}.`,
      );
      return;
    }
    setError("");
    setter(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!nickname.trim()) {
      setError("Nickname не может быть пустым.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append("nickname", nickname.trim());
      payload.append("bio", bio.trim());
      if (avatarFile) payload.append("avatar", avatarFile);
      if (bannerFile) payload.append("banner", bannerFile);

      await apiFetch("/users/me", {
        method: "PATCH",
        body: payload,
        timeoutMs: 30000,
        headers: {},
      });
      await refreshMe();
      navigate("/profile");
    } catch (e) {
      setError(e?.message || "Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
        <Card className="p-6 text-sm text-muted">Загрузка профиля...</Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
        <Card className="p-6 text-sm text-accent">Профиль не найден.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
          ⚙ Настройки профиля
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Редактировать <span className="text-gradient-accent">профиль</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Аватар, баннер, видео-фон, никнейм и описание. Сохраняется одним нажатием.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Быстрый вход
              </h2>
              <p className="mt-2 text-sm text-foreground">
                Подключи Google или GitHub — следующие входы без пароля.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ConnectionBadge label="Пароль" connected={user?.password_login_enabled} />
              <ConnectionBadge label="Google" connected={user?.google_connected} />
              <ConnectionBadge label="GitHub" connected={user?.github_connected} />
            </div>

            <SocialAuthButtons mode="link" next="/profile/edit" title="Подключить провайдер" />
          </div>
        </Card>

        {/* Видео-фон в стиле ASCII / Matrix */}
        <Card className="p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Видео-фон (ASCII / Matrix)
            </h2>
            <p className="text-sm text-muted">
              Загрузи короткое видео (MP4 / WebM / MOV, до 15 МБ). На странице
              профиля оно будет нарисовано символами — настоящие пиксели
              скрыты, видны только цифры или ASCII-знаки.
            </p>
          </div>

          {/* Live preview of the ASCII effect inside a bordered viewport. */}
          <div className="relative mt-4 h-56 overflow-hidden rounded-2xl border border-border bg-canvas">
            {bgVideoPreview ? (
              <div className="absolute inset-0">
                <AsciiBackgroundPreview videoUrl={bgVideoPreview} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                Видео не загружено — выбери файл, чтобы увидеть превью.
              </div>
            )}
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-foreground">
              Файл видео
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleBgVideoFile}
                className="mt-2 w-full text-sm text-foreground"
              />
            </label>
          </div>

          {bgError ? (
            <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {bgError}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleBgVideoUpload}
              disabled={!bgVideoFile || bgUploading}
              className="rounded-[12px] px-4 py-2"
            >
              {bgUploading
                ? "Загружаем..."
                : bgVideoFile
                  ? "Сохранить видео"
                  : "Выбери файл"}
            </Button>
            {profile?.bg_video_url ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleBgVideoRemove}
                disabled={bgUploading}
                className="rounded-[12px] px-4 py-2"
              >
                Удалить видео
              </Button>
            ) : null}
            <p className="ml-auto text-xs text-muted">
              Совет: лучше всего смотрятся короткие петли 5–10 секунд с
              контрастным движением.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="relative h-52 bg-slate-950/80">
            {bannerPreview && !bannerPreviewError ? (
              <MediaAsset
                src={bannerPreview}
                mimeType={bannerFile?.type}
                alt="Banner preview"
                className="h-full w-full object-cover"
                onError={() => setBannerPreviewError(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-sm text-muted">
                {bannerPreviewError ? "Не удалось загрузить баннер" : "Баннер не установлен"}
              </div>
            )}
            <div className="absolute left-6 bottom-[-30px]">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-slate-950 bg-slate-900">
                {avatarPreview && !avatarPreviewError ? (
                  <MediaAsset
                    src={avatarPreview}
                    mimeType={avatarFile?.type}
                    alt="Avatar preview"
                    className="h-full w-full object-cover"
                    onError={() => setAvatarPreviewError(true)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-700 text-2xl font-bold text-white">
                    {profile.nickname?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 pt-20 pb-6 sm:px-8">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">
                Никнейм
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="mt-2 w-full rounded-btn border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <span className="mt-1 block text-[11px] text-muted">
                  {nickname.length}/100
                </span>
              </label>

              <label className="block text-sm font-medium text-foreground">
                Описание профиля
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-btn border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </label>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">
                Аватар (image или video)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                  onChange={handleFile(setAvatarFile)}
                  className="mt-2 w-full text-sm text-foreground"
                />
                <span className="mt-1 block text-[11px] text-muted">
                  JPG/PNG/GIF/WEBP или MP4/WebM/MOV
                </span>
              </label>
              <label className="block text-sm font-medium text-foreground">
                Баннер (image или video)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                  onChange={handleFile(setBannerFile)}
                  className="mt-2 w-full text-sm text-foreground"
                />
                <span className="mt-1 block text-[11px] text-muted">
                  JPG/PNG/GIF/WEBP или MP4/WebM/MOV
                </span>
              </label>
            </div>

            {error ? (
              <div className="rounded-btn border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                Изображения до 5 МБ. Видео для аватарки, баннера и фонового режима — до 15 МБ.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/profile")}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Сохраняем..." : "✓ Сохранить"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}

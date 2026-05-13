import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons.jsx";
import { AsciiVideoBackground } from "../components/AsciiVideoBackground.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 15 * 1024 * 1024;
const BG_VARIANTS = [
  { id: "digits", label: "Цифры 0–9" },
  { id: "binary", label: "Бинарный код" },
  { id: "ascii", label: "ASCII символы" },
];

function formatFileSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function AsciiBackgroundPreview({ videoUrl, variant }) {
  return (
    <AsciiVideoBackground
      videoUrl={videoUrl}
      variant={variant}
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
  const [bgVariant, setBgVariant] = useState("digits");
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
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Неподдерживаемый формат. Используйте JPG, PNG или GIF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`Файл слишком большой. Максимум ${formatFileSize(MAX_FILE_SIZE)}.`);
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
    <div className="mx-auto w-full max-w-[800px] px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Редактировать профиль</h1>
          <p className="mt-1 text-sm text-muted">Обновите аватар, баннер, никнейм и описание.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Быстрый вход</h2>
              <p className="mt-1 text-sm text-muted">
                Подключите Google или GitHub, чтобы новые входы были без отдельного пароля.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-canvas px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Пароль</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {user?.password_login_enabled ? "Доступен" : "Недоступен"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-canvas px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Google</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {user?.google_connected ? "Подключен" : "Не подключен"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-canvas px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted">GitHub</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {user?.github_connected ? "Подключен" : "Не подключен"}
                </p>
              </div>
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
                <AsciiBackgroundPreview
                  videoUrl={bgVideoPreview}
                  variant={bgVariant}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                Видео не загружено — выбери файл, чтобы увидеть превью.
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr,auto] sm:items-end">
            <label className="block text-sm font-medium text-foreground">
              Файл видео
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleBgVideoFile}
                className="mt-2 w-full text-sm text-foreground"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Стиль символов
              <select
                value={bgVariant}
                onChange={(event) => setBgVariant(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-canvas px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
              >
                {BG_VARIANTS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
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
              <img
                src={bannerPreview}
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
                  <img
                    src={avatarPreview}
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
                  className="mt-2 w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
                />
              </label>

              <label className="block text-sm font-medium text-foreground">
                Описание профиля
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
                />
              </label>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">
                Аватар (JPG, PNG)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleFile(setAvatarFile)}
                  className="mt-2 w-full text-sm text-foreground"
                />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Баннер (GIF поддерживается)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleFile(setBannerFile)}
                  className="mt-2 w-full text-sm text-foreground"
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">Максимальный размер файла: 5MB.</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-[12px] px-4 py-2"
                  onClick={() => navigate("/profile")}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="rounded-[12px] px-4 py-2"
                  disabled={saving}
                >
                  {saving ? "Сохраняем..." : "Сохранить профиль"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}

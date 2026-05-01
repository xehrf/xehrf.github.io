import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function formatFileSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function EditProfilePage() {
  const [profile, setProfile] = useState(null);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
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

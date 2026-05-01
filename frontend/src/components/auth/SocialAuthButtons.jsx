import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { Button } from "../ui/Button.jsx";

const PROVIDERS = [
  { id: "google", label: "Google", accent: "from-[#fef3c7] to-[#fde68a]", text: "text-slate-950" },
  { id: "github", label: "GitHub", accent: "from-slate-200 to-slate-100", text: "text-slate-950" },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#EA4335" d="M12.23 10.25v3.91h5.44c-.24 1.26-.96 2.33-2.05 3.05l3.31 2.57c1.93-1.78 3.04-4.39 3.04-7.49 0-.72-.06-1.41-.19-2.04z" />
      <path fill="#4285F4" d="M12 22c2.75 0 5.06-.91 6.74-2.47l-3.31-2.57c-.91.61-2.08.98-3.43.98-2.64 0-4.88-1.79-5.68-4.19H2.9v2.63A10 10 0 0 0 12 22" />
      <path fill="#FBBC05" d="M6.32 13.75A5.97 5.97 0 0 1 6 12c0-.61.11-1.19.32-1.75V7.62H2.9A10 10 0 0 0 2 12c0 1.61.38 3.13 1.05 4.38z" />
      <path fill="#34A853" d="M12 6.06c1.49 0 2.83.51 3.89 1.5l2.92-2.92C17.06 2.99 14.75 2 12 2A10 10 0 0 0 2.9 7.62l3.42 2.63C7.12 7.85 9.36 6.06 12 6.06" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.41-4.04-1.41-.55-1.38-1.33-1.75-1.33-1.75-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.23 1.84 1.23 1.08 1.84 2.82 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.46-1.33-5.46-5.9 0-1.3.47-2.36 1.23-3.19-.12-.3-.53-1.53.12-3.18 0 0 1-.32 3.3 1.22a11.4 11.4 0 0 1 6 0c2.29-1.54 3.29-1.22 3.29-1.22.65 1.65.24 2.88.12 3.18.77.83 1.23 1.89 1.23 3.19 0 4.58-2.8 5.59-5.48 5.89.43.37.81 1.11.81 2.24v3.31c0 .32.22.7.83.58A12 12 0 0 0 12 .5" />
    </svg>
  );
}

function ProviderIcon({ providerId }) {
  if (providerId === "google") {
    return <GoogleIcon />;
  }
  return <GitHubIcon />;
}

export function SocialAuthButtons({ mode = "login", next = "/dashboard", title = "Быстрый вход" }) {
  const { beginOAuth } = useAuth();
  const [submittingProvider, setSubmittingProvider] = useState("");
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    let mounted = true;

    apiFetch("/auth/oauth/providers", { auth: false })
      .then((data) => {
        if (mounted) {
          setAvailability(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setAvailability(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleProviderClick(provider) {
    setError("");
    setSubmittingProvider(provider);
    try {
      await beginOAuth(provider, { mode, next });
    } catch (eventError) {
      setError(eventError?.message || "Не удалось начать OAuth-вход.");
      setSubmittingProvider("");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">{title}</p>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3">
        {PROVIDERS.map((provider) => {
          const configured = availability?.[provider.id]?.configured;
          const isKnownUnavailable = configured === false;
          const disabled = isKnownUnavailable || (submittingProvider !== "" && submittingProvider !== provider.id);

          return (
            <Button
              key={provider.id}
              type="button"
              variant="secondary"
              disabled={disabled}
              className={[
                "w-full justify-between rounded-[16px] border px-4 py-3 text-left shadow-none",
                "bg-gradient-to-r hover:border-accent/30",
                provider.accent,
                provider.text,
                isKnownUnavailable ? "opacity-60 saturate-50" : "",
              ].join(" ")}
              onClick={() => handleProviderClick(provider.id)}
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/75 text-slate-900 shadow-sm">
                  <ProviderIcon providerId={provider.id} />
                </span>
                <span className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Продолжить через {provider.label}</span>
                  <span className="text-[11px] text-slate-700/80">
                    {isKnownUnavailable
                      ? "Сервер пока не настроен для этого провайдера"
                      : mode === "link"
                        ? "Привязать провайдер к текущему аккаунту"
                        : "Вход и регистрация без отдельного пароля"}
                  </span>
                </span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                {isKnownUnavailable ? "Soon" : submittingProvider === provider.id ? "..." : "OAuth"}
              </span>
            </Button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}

import { useState } from "react";
import { Button } from "../ui/Button.jsx";
import { useAuth } from "../../auth/AuthProvider.jsx";

const PROVIDERS = [
  { id: "google", label: "Google", accent: "from-[#fef3c7] to-[#fde68a]", text: "text-slate-950" },
  { id: "github", label: "GitHub", accent: "from-slate-200 to-slate-100", text: "text-slate-950" },
];

export function SocialAuthButtons({ mode = "login", next = "/dashboard", title = "Быстрый вход" }) {
  const { beginOAuth } = useAuth();
  const [submittingProvider, setSubmittingProvider] = useState("");
  const [error, setError] = useState("");

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
        {PROVIDERS.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="secondary"
            disabled={submittingProvider !== "" && submittingProvider !== provider.id}
            className={[
              "w-full justify-between rounded-[16px] border px-4 py-3 text-left shadow-none",
              "bg-gradient-to-r hover:border-accent/30",
              provider.accent,
              provider.text,
            ].join(" ")}
            onClick={() => handleProviderClick(provider.id)}
          >
            <span className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950/10 text-base font-black">
                {provider.id === "google" ? "G" : "GH"}
              </span>
              <span className="flex flex-col items-start">
                <span className="text-sm font-semibold">Продолжить через {provider.label}</span>
                <span className="text-[11px] text-slate-700/80">
                  {mode === "link" ? "Привязать провайдер к текущему аккаунту" : "Вход и регистрация без отдельного пароля"}
                </span>
              </span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.22em]">
              {submittingProvider === provider.id ? "..." : "OAuth"}
            </span>
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}

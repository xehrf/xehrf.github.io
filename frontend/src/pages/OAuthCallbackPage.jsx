import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { acceptToken } = useAuth();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const token = searchParams.get("token");
      const nextPath = searchParams.get("next") || "/dashboard";
      const oauthError = searchParams.get("error");

      if (oauthError) {
        if (active) {
          setError(oauthError);
          setProcessing(false);
        }
        return;
      }

      if (!token) {
        if (active) {
          setError("OAuth вход не вернул access token.");
          setProcessing(false);
        }
        return;
      }

      try {
        await acceptToken(token);
        if (active) {
          navigate(nextPath, { replace: true });
        }
      } catch (eventError) {
        if (active) {
          setError(eventError?.message || "Не удалось завершить вход через OAuth.");
          setProcessing(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [acceptToken, navigate, searchParams]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md border-border/80 p-8 shadow-glow sm:p-10">
        {processing ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-accent/30 bg-accent/10" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Завершаем вход</h1>
            <p className="text-sm text-muted">Получаем ваш аккаунт и подготавливаем сессию.</p>
          </div>
        ) : (
          <div className="space-y-5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">OAuth не завершился</h1>
            <p className="text-sm text-accent">{error}</p>
            <div className="flex flex-col gap-3">
              <Button type="button" onClick={() => navigate("/login", { replace: true })}>
                Вернуться ко входу
              </Button>
              <Link to="/" className="text-sm text-muted transition-colors hover:text-accent">
                На главную
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

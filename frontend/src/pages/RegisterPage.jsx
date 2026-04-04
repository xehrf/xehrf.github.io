import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await register({ email, password, display_name: displayName });
      navigate("/dashboard");
    } catch (e) {
      setError(e?.message || "Ошибка регистрации");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-center sm:justify-start">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-accent"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-elevated text-xs font-bold text-accent">
              CA
            </span>
            CodeArena
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-border/80 p-8 shadow-glow sm:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Создайте аккаунт</h1>
            <p className="mt-2 text-sm text-muted">Зарегистрируйтесь, чтобы отправлять решения</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-xs font-medium text-muted">
                Имя для отображения
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="dev_junior"
                className="w-full rounded-btn border border-border bg-canvas px-4 py-3 text-sm text-foreground placeholder:text-muted/70 transition-colors duration-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-medium text-muted">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-btn border border-border bg-canvas px-4 py-3 text-sm text-foreground placeholder:text-muted/70 transition-colors duration-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-medium text-muted">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                className="w-full rounded-btn border border-border bg-canvas px-4 py-3 text-sm text-foreground placeholder:text-muted/70 transition-colors duration-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {error ? <div className="text-sm text-accent">{error}</div> : null}

            <Button type="submit" className="mt-2 w-full py-3 text-base" disabled={submitting}>
              {submitting ? "Создаём..." : "Регистрация"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted">
            Уже есть аккаунт?{" "}
            <Link to="/login" className="text-accent transition-colors hover:text-accent-hover">
              Войти
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}


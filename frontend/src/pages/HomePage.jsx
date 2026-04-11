import { useMemo } from "react";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

const highlightsDesktop = [
  ["Матчмейкинг", "Четыре игрока, один таймер, PTS за победы."],
  ["Solo-задачи", "Мини-фриланс, PTS и отзывы исполнителей."],
  ["Чистый UI", "Тёмная тема GitHub + жёлтые акценты арены."],
];

export function HomePage() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const highlights = useMemo(() => {
    if (!isMobile) return highlightsDesktop;
    return highlightsDesktop.map(([title, desc]) =>
      title === "Матчмейкинг"
        ? ["Публикации", "Заказы клиентов и отклики — в нижнем меню «Публикации»."]
        : [title, desc],
    );
  }, [isMobile]);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-12 sm:py-16 md:max-w-6xl md:px-6 md:py-24">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-20 h-64 w-64 rounded-full bg-accent/[0.06] blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-accent/[0.04] blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">CodeArena</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Арена для <span className="text-gradient-accent">джунов</span>
        </h1>
        <p className="mt-4 text-base text-muted sm:text-lg">
           Докажи чего ты <span className="text-accent">СТОИШЬ</span>
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton to="/login" className="min-w-[160px] px-8 py-3 text-base font-semibold">
            Войти
          </LinkButton>
          <LinkButton to="/dashboard" variant="secondary" className="min-w-[160px] px-8 py-3 text-base">
            К задачам
          </LinkButton>
        </div>
      </div>

      <div className="mt-20 grid gap-4 sm:grid-cols-3">
        {highlights.map(([title, desc]) => (
          <Card key={title} className="transition-transform duration-200 hover:-translate-y-0.5 hover:border-accent/25">
            <h2 className="text-sm font-semibold text-accent">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
          </Card>
        ))}
      </div>

      <p className="mt-16 text-center text-xs text-muted">
        Уже есть аккаунт?{" "}
        <LinkButton to="/login" variant="ghost" className="inline-flex px-2 py-1 text-xs text-accent">
          Login
        </LinkButton>
      </p>
    </div>
  );
}

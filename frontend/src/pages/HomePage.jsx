import { useEffect, useMemo, useState } from "react";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { PlayerHoverCard } from "../components/ui/PlayerHoverCard.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client.js";
import { useArenaStats } from "../hooks/useArenaStats.js";

// ============================================================
// [1] HERO — первый экран
// ============================================================
function Hero({ stats, loading }) {
  const online = stats?.online ?? 0;
  const matchesToday = stats?.matches_today ?? 0;
  const hasLiveOnline = !loading && stats != null && online > 0;

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Декоративные свечения */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-10 h-72 w-72 rounded-full bg-accent/[0.08] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-accent/[0.05] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,215,0,0.06),transparent_60%)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-28 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          {/* Live-индикатор */}
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 text-xs font-medium text-accent">
            <span className="relative flex h-2 w-2">
              {hasLiveOnline && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {loading
              ? "Загружаем арену..."
              : hasLiveOnline
                ? `${online.toLocaleString("ru-RU")} ${
                    online === 1 ? "игрок онлайн" : "игроков онлайн"
                  }`
                : "Будь первым на арене"}
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Арена для тех, кто <span className="text-gradient-accent">кодит</span>
            <br />
            <span className="text-gradient-accent">лучше других</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
            PvP-дуэли на собеседовательских задачах. 30 минут, один таймер, реальное давление.
            Поднимай <span className="font-semibold text-accent">PTS</span>, попадай в топ,
            продавай навыки на фрилансе.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton
              to="/matchmaking"
              className="w-full py-3.5 text-base font-bold sm:min-w-[200px] sm:w-auto sm:px-8"
            >
              ⚔ Сыграть матч
            </LinkButton>
            <LinkButton
              to="/dashboard"
              variant="secondary"
              className="w-full py-3.5 text-base sm:min-w-[200px] sm:w-auto sm:px-8"
            >
              К задачам
            </LinkButton>
          </div>

          {/* Метрики */}
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
            <Metric value={matchesToday} label="матчей сегодня" loading={loading} />
            <Metric value="30" label="минут на матч" suffix="мин" />
            <Metric value={online} label="онлайн прямо сейчас" loading={loading} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label, suffix, loading }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-accent sm:text-3xl">
        {loading ? (
          <span className="inline-block h-6 w-12 animate-pulse rounded bg-accent/20" />
        ) : typeof value === "number" ? (
          value.toLocaleString("ru-RU")
        ) : (
          value
        )}
        {!loading && suffix ? (
          <span className="ml-1 text-base text-muted">{suffix}</span>
        ) : null}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

// ============================================================
// [2] DEMO — анимированный мини-матч
// ============================================================
const playerACode = [
  "def two_sum(nums, target):",
  "    seen = {}",
  "    for i, n in enumerate(nums):",
  "        need = target - n",
  "        if need in seen:",
  "            return [seen[need], i]",
  "        seen[n] = i",
];

const playerBCode = [
  "def two_sum(nums, target):",
  "    for i in range(len(nums)):",
  "        for j in range(i+1, len(nums)):",
  "            if nums[i]+nums[j]==target:",
  "                return [i, j]",
  "    return []",
];

function DemoSection() {
  const [timer, setTimer] = useState(1730); // 28:50 в секундах
  const [linesA, setLinesA] = useState(0);
  const [linesB, setLinesB] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTimer((s) => (s > 0 ? s - 1 : 1800)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const a = setInterval(() => {
      setLinesA((n) => (n >= playerACode.length ? 0 : n + 1));
    }, 700);
    const b = setInterval(() => {
      setLinesB((n) => (n >= playerBCode.length ? 0 : n + 1));
    }, 950);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  const mm = String(Math.floor(timer / 60)).padStart(2, "0");
  const ss = String(timer % 60).padStart(2, "0");

  return (
    <section className="border-b border-border bg-elevated/30 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Live demo</p>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Вот как выглядит матч
          </h2>
          <p className="mt-3 text-muted">
            Два игрока. Одна задача. Кто первым пройдёт все тесты — забирает PTS.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-card border border-border bg-canvas shadow-card">
          {/* Top bar: таймер и задача */}
          <div className="flex flex-col gap-3 border-b border-border bg-elevated px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                Two Sum · сложность 3/5
              </span>
            </div>
            <div className="flex w-full items-center justify-between gap-2 font-mono text-lg font-bold tabular-nums text-accent sm:w-auto sm:justify-start">
              <span className="text-xs uppercase tracking-wider text-muted">Таймер</span>
              {mm}:{ss}
            </div>
          </div>

          {/* Code split */}
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <PlayerPane name="codewarrior_42" pts="1247" code={playerACode} linesShown={linesA} testsPassed={3} testsTotal={4} winning />
            <PlayerPane name="ты" pts="—" code={playerBCode} linesShown={linesB} testsPassed={2} testsTotal={4} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PlayerPane({ name, pts, code, linesShown, testsPassed, testsTotal, winning }) {
  return (
    <div className="bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${winning ? "bg-accent" : "bg-muted"} ${winning ? "animate-pulse" : ""}`}
          />
          <span className="text-sm font-semibold text-foreground">{name}</span>
          <span className="text-xs text-muted">{pts} PTS</span>
        </div>
        <span className="text-xs font-mono text-muted">
          tests:{" "}
          <span className={testsPassed === testsTotal ? "text-accent" : "text-foreground"}>
            {testsPassed}/{testsTotal}
          </span>
        </span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 sm:text-[13px]">
        {code.map((line, i) => (
          <div
            key={i}
            className={`transition-opacity duration-300 ${i < linesShown ? "opacity-100" : "opacity-25"}`}
          >
            <span className="mr-3 inline-block w-4 select-none text-right text-muted">{i + 1}</span>
            <span className="text-foreground">{line}</span>
            {i === linesShown - 1 && (
              <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-accent align-middle" />
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}

// ============================================================
// [3] КАК ЭТО РАБОТАЕТ
// ============================================================
const steps = [
  {
    n: "01",
    icon: "🔍",
    title: "Тебя матчат",
    desc: "Алгоритм находит соперника твоего уровня за 10–30 секунд.",
  },
  {
    n: "02",
    icon: "⌨",
    title: "Кодишь 30 минут",
    desc: "Одна задача с реального собеседования. Тесты прогоняются в реальном времени.",
  },
  {
    n: "03",
    icon: "🏆",
    title: "Получаешь PTS",
    desc: "Победил — забираешь рейтинг. Проиграл — теряешь и идёшь готовиться.",
  },
];

function HowItWorks() {
  return (
    <section className="border-b border-border py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">3 шага</p>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Как это работает
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.n} className="relative overflow-hidden">
              <div className="absolute right-4 top-3 font-mono text-5xl font-bold text-accent/10">
                {s.n}
              </div>
              <div className="text-3xl">{s.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// [4] ЗАЧЕМ (выгоды)
// ============================================================
const benefits = [
  {
    icon: "🎯",
    title: "Готовься к собесам",
    desc: "Реальные задачи из FAANG, Яндекса, Тинькофф в формате стресса с таймером — такие же условия, как в продакшен-интервью.",
  },
  {
    icon: "💰",
    title: "Зарабатывай на навыках",
    desc: "PTS — это не просто цифра. Топ-исполнители получают доступ к платному фриланс-маркету прямо внутри платформы.",
  },
  {
    icon: "👀",
    title: "Тебя заметят",
    desc: "Топ-100 рейтинга видят работодатели. Никаких CV — твой профиль с матчами говорит сам за себя.",
  },
];

function Benefits() {
  return (
    <section className="border-b border-border bg-elevated/30 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Зачем</p>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Что ты получаешь
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {benefits.map((b) => (
            <Card
              key={b.title}
              className="transition-transform duration-200 hover:-translate-y-1 hover:border-accent/40"
            >
              <div className="text-3xl">{b.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{b.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// [5] LEADERBOARD PREVIEW — реальные данные с fallback
// ============================================================
const fallbackLeaderboard = [
  { rank: 1, display_name: "deadcode_master", pts_total: 2847, avatar_url: null },
  { rank: 2, display_name: "vovan_da_juice", pts_total: 2712, avatar_url: null },
  { rank: 3, display_name: "анонимус_42", pts_total: 2598, avatar_url: null },
  { rank: 4, display_name: "leetcode_killer", pts_total: 2401, avatar_url: null },
  { rank: 5, display_name: "junior_no_more", pts_total: 2356, avatar_url: null },
  { rank: 6, display_name: "fastfingers", pts_total: 2298, avatar_url: null },
  { rank: 7, display_name: "py_god", pts_total: 2245, avatar_url: null },
  { rank: 8, display_name: "code_wolverine", pts_total: 2210, avatar_url: null },
  { rank: 9, display_name: "midnight_dev", pts_total: 2189, avatar_url: null },
  { rank: 10, display_name: "alex_strong", pts_total: 2150, avatar_url: null },
];

function rankBadge(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function LeaderboardPreview() {
  const [items, setItems] = useState(fallbackLeaderboard);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch("/rating/leaderboard?period=all_time&limit=10");
        if (!mounted) return;
        const rows = (data?.items || []).slice(0, 10);
        if (rows.length > 0) {
          setItems(rows);
          setIsLive(true);
        }
      } catch {
        // Не авторизован или backend недоступен — оставляем демо-данные
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="border-b border-border py-20 sm:py-24">
      <div className="mx-auto w-full max-w-4xl px-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-medium text-accent">
            {isLive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Live leaderboard
              </>
            ) : (
              <>Превью рейтинга</>
            )}
          </div>
          <h2 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
            Топ-10 арены
          </h2>
          <p className="mt-3 text-muted">
            {isLive
              ? "Реальные игроки прямо сейчас. Попадёшь сюда — работодатели заметят."
              : "Войди, чтобы увидеть живой рейтинг и попасть в топ."}
          </p>
        </div>

        <Card className="mt-10 p-0">
          <ul className="divide-y divide-border">
            {(loading ? fallbackLeaderboard : items).map((p, idx) => {
              const rank = p.rank ?? idx + 1;
              const name = p.display_name || p.nickname || "anonymous";
              const pts = p.pts_total ?? 0;
              const badge = rankBadge(rank);
              const avatar = resolveAssetUrl(p.avatar_url || "");
              return (
                <li
                  key={`${rank}-${name}`}
                  className={`flex flex-wrap items-start justify-between gap-2 px-5 py-3.5 transition-colors hover:bg-accent/5 sm:flex-nowrap sm:items-center ${
                    rank <= 3 ? "bg-accent/[0.03]" : ""
                  }`}
                >
                  <PlayerHoverCard userId={p.user_id} disabled={!p.user_id}>
                    <div className="flex flex-1 cursor-pointer items-center gap-4">
                      <span
                        className={`w-8 text-center font-mono text-sm font-bold ${
                          rank <= 3 ? "text-accent" : "text-muted"
                        }`}
                      >
                        {badge || `#${rank}`}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-full border border-border bg-elevated">
                          {avatar ? (
                            <MediaAsset
                              src={avatar}
                              alt={name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-foreground">
                              {name[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-foreground">{name}</span>
                      </div>
                    </div>
                  </PlayerHoverCard>
                  <span className="w-full pl-12 text-right font-mono font-bold text-accent sm:w-auto sm:pl-0">
                    {Number(pts).toLocaleString("ru-RU")}{" "}
                    <span className="text-xs text-muted">PTS</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="mt-8 text-center">
          <LinkButton to="/leaderboard" variant="secondary">
            Посмотреть весь рейтинг →
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// [6] SOCIAL PROOF
// ============================================================
const testimonials = [
  {
    name: "Артём, 22",
    role: "Junior Backend, Тинькофф",
    text: "За 3 недели на CodeArena стал спокойнее решать live-coding на интервью. Стресс на собесе теперь воспринимается как обычный матч.",
  },
  {
    name: "Маша, 20",
    role: "Frontend trainee",
    text: "Раньше задачи на LeetCode решала по 2 часа. После 30 матчей здесь — укладываюсь в 25 минут. Это просто другая динамика.",
  },
  {
    name: "Даня, 24",
    role: "ML Engineer",
    text: "Думал, что PvP в кодинге — это маркетинг. Сыграл 5 матчей и подсел. Особенно когда выиграл у чела с +400 PTS надо мной.",
  },
];

function SocialProof({ stats }) {
  const users = stats?.users_total ?? 0;
  const matches = stats?.matches_total ?? 0;
  const hasUsers = users > 0;

  return (
    <section className="border-b border-border bg-elevated/30 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Что говорят
          </p>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            {hasUsers ? (
              <>
                Уже играют{" "}
                <span className="text-gradient-accent">
                  {users.toLocaleString("ru-RU")}{" "}
                  {users === 1 ? "игрок" : users < 5 ? "игрока" : "игроков"}
                </span>
              </>
            ) : (
              <>
                Стань <span className="text-gradient-accent">первым</span> на арене
              </>
            )}
          </h2>
          <p className="mt-3 text-muted">
            {matches > 0
              ? `${matches.toLocaleString("ru-RU")} ${
                  matches === 1
                    ? "матч сыгран"
                    : matches < 5
                      ? "матча сыграно"
                      : "матчей сыграно"
                } с момента запуска`
              : "Открой счёт первым матчем"}
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.name}>
              <div className="flex gap-1 text-accent">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground">"{t.text}"</p>
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-sm font-semibold text-foreground">{t.name}</div>
                <div className="text-xs text-muted">{t.role}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// [7] FAQ
// ============================================================
const faq = [
  {
    q: "Это правда бесплатно?",
    a: "Да. Все матчи, рейтинг, профиль — бесплатно навсегда. Платная часть — только комиссия с фриланс-сделок (5%) и premium-функции для работодателей.",
  },
  {
    q: "На каких языках можно играть?",
    a: "Сейчас Python. JavaScript, TypeScript и Go добавим в ближайшие 2 месяца. Если нужен конкретный язык — напиши в Telegram.",
  },
  {
    q: "А если меня будут матчить со слишком сильными?",
    a: "Алгоритм подбирает соперников с похожим PTS (±150). В первые 5 матчей идёт калибровка — они не влияют на основной рейтинг.",
  },
  {
    q: "Куда идут деньги с фриланса?",
    a: "Заказчик платит исполнителю напрямую через escrow. Платформа забирает 5% комиссии после успешной приёмки работы. Никаких скрытых платежей.",
  },
  {
    q: "Можно играть с друзьями?",
    a: "Да. В разделе «Команды» можно создавать команды до 4 человек и устраивать 2vs2 или 4vs4 матчи.",
  },
];

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="border-b border-border py-20 sm:py-24">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Частые вопросы
          </h2>
        </div>

        <div className="mt-12 space-y-3">
          {faq.map((item, i) => (
            <Card key={i} className="cursor-pointer p-0" onClick={() => setOpen(open === i ? -1 : i)}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-semibold text-foreground">{item.q}</span>
                <span
                  className={`text-accent transition-transform duration-200 ${
                    open === i ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
              {open === i && (
                <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted">
                  {item.a}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// [8] FINAL CTA
// ============================================================
function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.08] blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Готов <span className="text-gradient-accent">доказать</span>?
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
          Первый матч — без регистрации. 30 минут твоего времени → понимание, на что ты способен.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton
            to="/matchmaking"
            className="w-full py-4 text-base font-bold sm:min-w-[220px] sm:w-auto sm:px-10"
          >
            ⚔ Начать матч
          </LinkButton>
          <LinkButton
            to="/register"
            variant="secondary"
            className="w-full py-4 text-base sm:min-w-[220px] sm:w-auto sm:px-10"
          >
            Создать аккаунт
          </LinkButton>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-sm text-muted sm:gap-6">
          <a
            href="https://t.me/codearena"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-accent"
          >
            <span>✈</span> Telegram
          </a>
          <span className="text-border">•</span>
          <a
            href="https://discord.gg/p9qcEqbe5"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-accent"
          >
            <span>💬</span> Discord
          </a>
          <span className="text-border">•</span>
          <a
            href="https://github.com/xehrf/codearena"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-accent"
          >
            <span>⌥</span> GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Главная страница
// ============================================================
export function HomePage() {
  const { stats, loading } = useArenaStats({ refreshMs: 30_000 });

  return (
    <div className="w-full">
      <Hero stats={stats} loading={loading} />
      <DemoSection />
      <HowItWorks />
      <Benefits />
      <LeaderboardPreview />
      <SocialProof stats={stats} />
      <FAQ />
      <FinalCTA />
    </div>
  );
}

/**
 * "Глитч в системе" — incident response scenarios.
 *
 * Each scenario is a self-contained on-call simulation:
 *   - 4 services with health states
 *   - a triggering alert
 *   - log streams (mostly noise, hand-placed signal lines)
 *   - metrics dictionaries revealed on inspect
 *   - a `correctFix` action that resolves the incident
 *   - `partialFix` / `wrongFix` actions that waste time or delay cascade
 *
 * Player wins by:
 *   1. Investigating (tail/inspect) to find the tells
 *   2. Reasoning about the root cause
 *   3. Taking the correct fix action before the timer runs out
 *
 * Scoring (total = 10):
 *   correct fix         → +7
 *   each distinct investigation step (max 3) → +1
 *   wrong fix attempt   → -2 each (clamped to 0)
 *
 * Verdicts come from the existing backend accuracy threshold:
 *   Offer >= 85% (need at least 9/10)
 *   Next round >= 65% (need at least 7/10)
 */

export const SERVICES = [
  { id: "auth-svc", label: "auth-svc", role: "Аутентификация" },
  { id: "payment-svc", label: "payment-svc", role: "Оплаты" },
  { id: "db-primary", label: "db-primary", role: "Postgres primary" },
  { id: "cdn", label: "cdn", role: "Статика / кеш" },
];

export const ACTIONS = [
  {
    id: "tail",
    label: "tail logs",
    kind: "investigation",
    needsTarget: true,
    cooldown: 4,
    description: "Показать последние строки лога выбранного сервиса.",
  },
  {
    id: "restart",
    label: "restart svc",
    kind: "fix",
    needsTarget: true,
    cooldown: 12,
    penaltySeconds: 6,
    description: "Перезапустить сервис. Иногда фикс, иногда временно.",
  },
  {
    id: "check_locks",
    label: "check db locks",
    kind: "investigation",
    needsTarget: false,
    cooldown: 8,
    penaltySeconds: 4,
    description: "Проверить блокировки и долгие запросы в primary DB.",
  },
  {
    id: "scale",
    label: "scale up",
    kind: "fix",
    needsTarget: true,
    cooldown: 14,
    penaltySeconds: 5,
    description: "Добавить реплики/воркеры выбранному сервису.",
  },
  {
    id: "rollback",
    label: "rollback deploy",
    kind: "fix",
    needsTarget: false,
    cooldown: 15,
    penaltySeconds: 7,
    description: "Откатить последний релиз. Помогает если виноват код.",
  },
  {
    id: "inspect",
    label: "inspect metric",
    kind: "investigation",
    needsTarget: true,
    cooldown: 4,
    description: "Снапшот метрик: CPU, память, коннекты, latency.",
  },
];

// Helper to build a noisy log mixed with signal lines.
function logEntry(text, signal = false) {
  return { text, signal };
}

export const SCENARIOS = [
  {
    id: "db-pool-exhausted",
    title: "auth-svc отвечает 503",
    summary: "Клиенты не могут залогиниться. Error rate 80% на auth-svc.",
    initialHealth: {
      "auth-svc": "critical",
      "payment-svc": "ok",
      "db-primary": "warning",
      "cdn": "ok",
    },
    cascade: {
      // If not fixed within this many seconds, payment-svc also goes critical.
      afterSeconds: 35,
      service: "payment-svc",
      narrative: "payment-svc тоже упал — он жил на тех же DB-коннектах.",
    },
    logs: {
      "auth-svc": [
        logEntry("12:14:02 INFO  jwt validated user=84210"),
        logEntry("12:14:03 ERROR connection pool exhausted (timeout=10s)", true),
        logEntry("12:14:03 INFO  shutting connection borrower"),
        logEntry("12:14:04 ERROR DB query timeout after 9.8s", true),
        logEntry("12:14:05 INFO  /health 200 12ms"),
        logEntry("12:14:06 ERROR 503 GET /api/login"),
        logEntry("12:14:07 INFO  jwt validated user=12005"),
      ],
      "payment-svc": [
        logEntry("12:14:01 INFO  charge $42.00 ok"),
        logEntry("12:14:03 INFO  charge $9.99 ok"),
        logEntry("12:14:05 INFO  webhook delivered stripe_evt_91"),
      ],
      "db-primary": [
        logEntry("12:13:55 INFO  autovacuum: users (0.2s)"),
        logEntry("12:14:00 WARN  long-running query pid=4521 47s SELECT * FROM submissions WHERE ...", true),
        logEntry("12:14:04 INFO  connections=98/100", true),
        logEntry("12:14:06 INFO  checkpoint complete"),
      ],
      "cdn": [
        logEntry("12:14:00 HIT  /assets/main.css"),
        logEntry("12:14:01 HIT  /favicon.ico"),
        logEntry("12:14:02 HIT  /assets/app.js"),
      ],
    },
    metrics: {
      "auth-svc": { cpu: "14%", mem: "61%", connections: "100/100", p99: "9800ms" },
      "payment-svc": { cpu: "8%", mem: "45%", connections: "12/100", p99: "120ms" },
      "db-primary": { cpu: "38%", mem: "72%", connections: "98/100", long_queries: 1 },
      "cdn": { cpu: "11%", mem: "30%", hit_rate: "99%", p99: "40ms" },
    },
    dbLocks: [
      "pid=4521 age=47s state=active wait=ClientRead query='SELECT * FROM submissions WHERE ...'",
      "blocked sessions: auth-svc pool waiters=31, payment-svc pool waiters=4",
      "mitigation: terminated blocker pid=4521; pool begins draining",
    ],
    correctFix: { action: "check_locks" },
    partialFix: {
      "restart:auth-svc": {
        narrative: "auth-svc поднялся, но через 20с снова упёрся в DB. Корень не устранён.",
      },
    },
    wrongFix: {
      "rollback": "Откатили последний релиз — error rate не изменился. Проблема не в коде.",
      "check_locks": "Блокировки уже проверены, но без хвоста auth-svc ты не подтвердил симптом. Действие сработало, но время ушло на рискованную гипотезу.",
      "scale:auth-svc": "Добавили auth-svc реплики, но все они упёрлись в тот же DB pool.",
      "scale:db-primary": "Primary DB нельзя просто масштабировать одной кнопкой во время активной блокировки.",
      "scale:payment-svc": "payment-svc был здоров. Масштабирование не помогло.",
      "scale:cdn": "CDN не имеет отношения к DB pool.",
      "restart:payment-svc": "payment-svc был здоров. Зря его перезапустили.",
      "restart:db-primary": "Перезапуск primary БД — это инцидент сам по себе. Не делайте так.",
      "restart:cdn": "CDN ни при чём.",
    },
    explanation:
      "В db-primary висел SELECT на 47с, который держал коннекты. auth-svc не мог взять коннект из пула и отдавал 503. Правильный ход — check db locks: найти blocker и прибить его.",
  },
  {
    id: "memory-leak",
    title: "payment-svc крашится с OOM",
    summary: "Каждые 2 минуты payment-svc уходит в OOMKilled и перезапускается.",
    initialHealth: {
      "auth-svc": "ok",
      "payment-svc": "critical",
      "db-primary": "ok",
      "cdn": "ok",
    },
    cascade: {
      afterSeconds: 40,
      service: "auth-svc",
      narrative: "К auth-svc подсела очередь webhook'ов от payment-svc — он тоже начал лагать.",
    },
    logs: {
      "auth-svc": [
        logEntry("12:14:00 INFO  /api/me 200 18ms"),
        logEntry("12:14:01 INFO  jwt validated"),
        logEntry("12:14:02 INFO  /api/me 200 21ms"),
      ],
      "payment-svc": [
        logEntry("12:13:58 INFO  charge $12 ok"),
        logEntry("12:14:00 WARN  heap usage 480MB / 512MB", true),
        logEntry("12:14:01 ERROR java.lang.OutOfMemoryError: Java heap space", true),
        logEntry("12:14:01 INFO  jvm: writing heap dump payment-heap-12:14.hprof"),
        logEntry("12:14:02 ERROR process killed by oom_reaper", true),
        logEntry("12:14:05 INFO  payment-svc starting up"),
      ],
      "db-primary": [
        logEntry("12:14:00 INFO  connections=8/100"),
        logEntry("12:14:01 INFO  checkpoint complete"),
      ],
      "cdn": [
        logEntry("12:14:00 HIT  /assets/main.css"),
        logEntry("12:14:01 HIT  /assets/app.js"),
      ],
    },
    metrics: {
      "auth-svc": { cpu: "10%", mem: "55%", connections: "8/100", p99: "30ms" },
      "payment-svc": { cpu: "85%", mem: "94% (растёт)", connections: "5/100", p99: "1200ms" },
      "db-primary": { cpu: "22%", mem: "60%", connections: "8/100", long_queries: 0 },
      "cdn": { cpu: "9%", mem: "28%", hit_rate: "98%", p99: "35ms" },
    },
    correctFix: { action: "restart", target: "payment-svc" },
    partialFix: {},
    wrongFix: {
      "rollback": "Откатились на прошлую версию — утечка существовала и там. Не помогло.",
      "check_locks": "В БД нет блокировок и долгих запросов. Это не помогло.",
      "scale:payment-svc": "Реплики поднимаются, но новая реплика тоже быстро съедает память. Нужна короткая стабилизация рестартом и разбор heap dump.",
      "scale:auth-svc": "auth-svc здоров. Масштабирование не помогло.",
      "scale:db-primary": "DB здорова. Масштабирование не помогло.",
      "scale:cdn": "CDN ни при чём.",
      "restart:auth-svc": "auth-svc был здоров. Зря его трогали.",
      "restart:db-primary": "Перезапуск primary БД — это инцидент сам по себе.",
      "restart:cdn": "CDN ни при чём.",
    },
    explanation:
      "payment-svc течёт по памяти — heap 480/512MB, OOMKilled. Чистый рестарт даёт временную передышку и время на расследование (heap dump уже сохранён).",
  },
  {
    id: "bad-deploy",
    title: "auth-svc 5xx с момента деплоя",
    summary: "После релиза в 12:10 error rate на auth-svc подскочил до 60%.",
    initialHealth: {
      "auth-svc": "critical",
      "payment-svc": "ok",
      "db-primary": "ok",
      "cdn": "ok",
    },
    cascade: {
      afterSeconds: 45,
      service: "payment-svc",
      narrative: "payment-svc не может позвать auth для верификации токенов — упал тоже.",
    },
    logs: {
      "auth-svc": [
        logEntry("12:10:00 INFO  deploy v2.41.0 started", true),
        logEntry("12:10:34 INFO  deploy v2.41.0 ready"),
        logEntry("12:10:40 ERROR TypeError: cannot read property 'roles' of undefined", true),
        logEntry("12:10:40 ERROR at file=/app/middleware/rbac.js:24:18", true),
        logEntry("12:10:41 ERROR 500 GET /api/me"),
        logEntry("12:10:42 ERROR TypeError: cannot read property 'roles' of undefined"),
        logEntry("12:10:43 ERROR 500 POST /api/login"),
      ],
      "payment-svc": [
        logEntry("12:10:00 INFO  charge $25 ok"),
        logEntry("12:10:02 INFO  charge $7.50 ok"),
      ],
      "db-primary": [
        logEntry("12:10:00 INFO  connections=12/100"),
        logEntry("12:10:02 INFO  checkpoint complete"),
      ],
      "cdn": [
        logEntry("12:10:00 HIT  /assets/main.css"),
      ],
    },
    metrics: {
      "auth-svc": { cpu: "18%", mem: "63%", connections: "10/100", p99: "45ms", error_rate: "62%" },
      "payment-svc": { cpu: "9%", mem: "44%", connections: "6/100", p99: "90ms" },
      "db-primary": { cpu: "22%", mem: "58%", connections: "12/100", long_queries: 0 },
      "cdn": { cpu: "10%", mem: "26%", hit_rate: "99%", p99: "38ms" },
    },
    correctFix: { action: "rollback" },
    partialFix: {
      "restart:auth-svc": {
        narrative: "auth-svc рестартанул — ошибка та же. Это не временная проблема памяти.",
      },
    },
    wrongFix: {
      "check_locks": "БД не виновата.",
      "scale:auth-svc": "Масштабирование размножило багнутый релиз. 500 стало больше, а не меньше.",
      "scale:payment-svc": "payment-svc здоров.",
      "scale:db-primary": "БД не виновата.",
      "scale:cdn": "Кеш CDN не влияет на серверные 500.",
      "restart:payment-svc": "payment-svc здоров.",
      "restart:db-primary": "Перезапуск primary БД — это инцидент сам по себе.",
      "restart:cdn": "CDN ни при чём.",
    },
    explanation:
      "TypeError в новом rbac middleware (deploy v2.41.0). Это код, не инфра. Откат релиза — корректный фикс.",
  },
  {
    id: "cache-stampede",
    title: "cdn p99 8s, БД залита запросами",
    summary: "Все запросы за статикой летят в БД. CDN не закрывает их.",
    initialHealth: {
      "auth-svc": "warning",
      "payment-svc": "ok",
      "db-primary": "warning",
      "cdn": "critical",
    },
    cascade: {
      afterSeconds: 40,
      service: "auth-svc",
      narrative: "БД захлёбывается — auth-svc следом отвалился.",
    },
    logs: {
      "auth-svc": [
        logEntry("12:14:00 INFO  /api/me 200 1200ms"),
        logEntry("12:14:01 WARN  DB query slow 980ms"),
        logEntry("12:14:02 INFO  /api/me 200 1450ms"),
      ],
      "payment-svc": [
        logEntry("12:14:00 INFO  charge $10 ok"),
        logEntry("12:14:01 INFO  charge $5 ok"),
      ],
      "db-primary": [
        logEntry("12:14:00 WARN  query rate 4200 qps (baseline 600)", true),
        logEntry("12:14:01 WARN  query: SELECT * FROM profiles WHERE id=?"),
        logEntry("12:14:01 INFO  connections=86/100"),
        logEntry("12:14:02 WARN  query rate 5100 qps"),
      ],
      "cdn": [
        logEntry("12:13:58 INFO  cache flush triggered manually", true),
        logEntry("12:13:59 MISS /profile/12 → origin"),
        logEntry("12:14:00 MISS /profile/13 → origin"),
        logEntry("12:14:00 WARN  cache hit rate 4% (baseline 95%)", true),
        logEntry("12:14:01 MISS /profile/14 → origin"),
        logEntry("12:14:02 INFO  thundering herd at /profile/*", true),
      ],
    },
    metrics: {
      "auth-svc": { cpu: "42%", mem: "65%", connections: "20/100", p99: "1400ms" },
      "payment-svc": { cpu: "11%", mem: "44%", connections: "6/100", p99: "120ms" },
      "db-primary": { cpu: "88%", mem: "78%", connections: "86/100", qps: "5100 (baseline 600)" },
      "cdn": { cpu: "55%", mem: "35%", hit_rate: "4%", p99: "8000ms" },
    },
    correctFix: { action: "scale", target: "cdn" },
    partialFix: {
      "restart:cdn": {
        narrative: "CDN рестартанул, но кеш всё ещё пуст — stampede продолжается.",
      },
    },
    wrongFix: {
      "rollback": "Деплоя не было, откатывать нечего.",
      "check_locks": "Запросы короткие, блокировок нет. Проблема в stampede, а не в blocker query.",
      "scale:auth-svc": "auth тормозит как симптом, не как причина.",
      "scale:payment-svc": "payment-svc здоров.",
      "scale:db-primary": "DB уже перегружена короткими запросами; добавлять нагрузку на primary опасно.",
      "restart:auth-svc": "auth тормозит как симптом, не как причина.",
      "restart:payment-svc": "payment-svc здоров.",
      "restart:db-primary": "Перезапуск primary БД — это инцидент сам по себе.",
    },
    explanation:
      "Кто-то вручную сбросил CDN кеш в 12:13:58 → одновременно прилетели тысячи запросов на пустой кеш → thundering herd на БД. Правильный ход — scale up cdn: добавить воркеры на прогрев/защиту origin и остановить лавину miss'ов.",
  },
  {
    id: "config-explosion",
    title: "Половина запросов 500, другая половина OK",
    summary: "Подозрительно ровно 50% запросов на auth-svc возвращают 500.",
    initialHealth: {
      "auth-svc": "warning",
      "payment-svc": "ok",
      "db-primary": "ok",
      "cdn": "ok",
    },
    cascade: {
      afterSeconds: 50,
      service: "payment-svc",
      narrative: "50% юзеров не могут залогиниться → payment-svc недополучает токены.",
    },
    logs: {
      "auth-svc": [
        logEntry("12:14:00 INFO  feature flag rollout 'new-jwt-validator' = 50%", true),
        logEntry("12:14:01 ERROR Invalid signature algorithm 'none' rejected", true),
        logEntry("12:14:01 INFO  /api/me 200 18ms"),
        logEntry("12:14:02 ERROR Invalid signature algorithm 'none' rejected"),
        logEntry("12:14:02 INFO  /api/me 200 22ms"),
        logEntry("12:14:03 ERROR 500 GET /api/me"),
        logEntry("12:14:03 INFO  /api/me 200 19ms"),
      ],
      "payment-svc": [
        logEntry("12:14:00 INFO  charge $14 ok"),
        logEntry("12:14:02 INFO  charge $7 ok"),
      ],
      "db-primary": [
        logEntry("12:14:00 INFO  connections=14/100"),
        logEntry("12:14:01 INFO  query rate 600 qps (baseline)"),
      ],
      "cdn": [
        logEntry("12:14:00 HIT  /assets/main.css"),
      ],
    },
    metrics: {
      "auth-svc": { cpu: "16%", mem: "59%", connections: "14/100", p99: "55ms", error_rate: "49%" },
      "payment-svc": { cpu: "10%", mem: "44%", connections: "6/100", p99: "95ms" },
      "db-primary": { cpu: "21%", mem: "60%", connections: "14/100", long_queries: 0 },
      "cdn": { cpu: "10%", mem: "26%", hit_rate: "99%", p99: "38ms" },
    },
    correctFix: { action: "rollback" },
    partialFix: {
      "restart:auth-svc": {
        narrative: "auth-svc рестартанул — флаг по-прежнему включён на 50%. Ошибки возвращаются.",
      },
    },
    wrongFix: {
      "check_locks": "БД не виновата.",
      "scale:auth-svc": "Масштабирование оставляет feature flag включённым на 50%.",
      "scale:payment-svc": "payment-svc здоров.",
      "scale:db-primary": "БД не виновата.",
      "scale:cdn": "CDN ни при чём.",
      "restart:payment-svc": "payment-svc здоров.",
      "restart:db-primary": "Перезапуск primary БД — это инцидент сам по себе.",
      "restart:cdn": "CDN ни при чём.",
    },
    explanation:
      "Включили feature flag 'new-jwt-validator' на 50% юзеров — новый валидатор отвергает токены, подписанные старым алгоритмом. 50% error rate ровно потому что flag 50%. rollback откатывает деплой с этим флагом.",
  },
];

export function pickGlitchScenario(random = Math.random) {
  return SCENARIOS[Math.floor(random() * SCENARIOS.length)];
}

/**
 * Compute final score from action history.
 *
 *   correct fix taken                     +7
 *   each distinct investigation step      +1  (max 3, so +3)
 *   each wrong fix attempt                -2
 *
 * Clamped to [0, 10]. `total` is always 10 so the accuracy maps to
 * the existing backend verdict thresholds.
 */
export function computeGlitchScore(scenario, history) {
  let score = 0;
  const investigatedKeys = new Set();
  let correctFixApplied = false;
  let wrongFixCount = 0;

  for (const entry of history) {
    if (entry.kind === "investigation") {
      const key = `${entry.action}:${entry.target ?? "*"}`;
      investigatedKeys.add(key);
    } else if (entry.kind === "fix") {
      if (entry.result === "correct") {
        correctFixApplied = true;
      } else if (entry.result === "wrong") {
        wrongFixCount += 1;
      }
      // partial fixes are neither rewarded nor penalised — they're a trap that
      // wastes time but doesn't actively hurt the score.
    }
  }

  if (correctFixApplied) score += 7;
  score += Math.min(3, investigatedKeys.size);
  score -= wrongFixCount * 2;

  return {
    correct: Math.max(0, Math.min(10, score)),
    total: 10,
    correctFixApplied,
    investigationCount: Math.min(3, investigatedKeys.size),
    wrongFixCount,
  };
}

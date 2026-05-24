// Skill level palette: yellow (Junior) → red (Lead).
// We use inline color values because Tailwind's JIT can't see dynamic class names.
export const SKILL_LEVELS = ["junior", "middle", "senior", "lead"];

export const SKILL_META = {
  junior: {
    label: "Junior",
    color: "#FFEB3B",
    bg: "rgba(255, 235, 59, 0.15)",
    border: "rgba(255, 235, 59, 0.4)",
    textOnBg: "#FFEB3B",
  },
  middle: {
    label: "Middle",
    color: "#FFA500",
    bg: "rgba(255, 165, 0, 0.15)",
    border: "rgba(255, 165, 0, 0.4)",
    textOnBg: "#FFA500",
  },
  senior: {
    label: "Senior",
    color: "#FF6B35",
    bg: "rgba(255, 107, 53, 0.15)",
    border: "rgba(255, 107, 53, 0.4)",
    textOnBg: "#FF6B35",
  },
  lead: {
    label: "Lead",
    color: "#FF3333",
    bg: "rgba(255, 51, 51, 0.15)",
    border: "rgba(255, 51, 51, 0.4)",
    textOnBg: "#FF3333",
  },
};

export const CATEGORY_META = {
  work_search: { label: "Ищу работу", icon: "🔍" },
  job_offer: { label: "Предлагаю работу", icon: "💼" },
};

export const DURATION_OPTIONS = [
  { hours: 6, label: "6 часов" },
  { hours: 12, label: "12 часов" },
  { hours: 24, label: "24 часа", recommended: true },
  { hours: 48, label: "2 дня" },
  { hours: 72, label: "3 дня" },
  { hours: 168, label: "7 дней" },
];

export function getSkillMeta(level) {
  if (!level) return null;
  return SKILL_META[level] ?? null;
}

export function getCategoryMeta(category) {
  return CATEGORY_META[category] ?? { label: category, icon: "📌" };
}

export function formatTtl(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s <= 0) return "Истекло";
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  // ≥1 day: show days + hours + minutes (visible minute change).
  if (days > 0) return `${days}д ${hours}ч ${minutes}м`;
  // ≥1 hour: classic HH:MM:SS countdown.
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  // <1 hour: MM:SS countdown — most "alive"-feeling part.
  return `${pad(minutes)}:${pad(secs)}`;
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Returns the % of total lifetime that is still remaining, [0..100].
 */
export function calcRemainingPercent({ created_at, expires_at, ttl_seconds }) {
  if (!created_at || !expires_at) return 0;
  const created = new Date(created_at).getTime();
  const expires = new Date(expires_at).getTime();
  if (Number.isNaN(created) || Number.isNaN(expires) || expires <= created) return 0;
  const total = expires - created;
  const remaining = Math.max(0, Math.min(total, (Number(ttl_seconds) || 0) * 1000));
  return Math.round((remaining / total) * 100);
}

/**
 * Picks a color for the time-left progress bar based on % remaining.
 */
export function getTtlColor(percent) {
  if (percent >= 75) return "#22C55E"; // green
  if (percent >= 50) return "#FFD700"; // accent yellow
  if (percent >= 25) return "#FFA500"; // orange
  return "#FF3333"; // red
}

export function extractContactLink(link) {
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.href;
  } catch {
    if (link.startsWith("@")) {
      return `https://t.me/${link.slice(1)}`;
    }
    return null;
  }
}

export function buildStarString(value) {
  const filled = Math.round(Math.max(0, Math.min(5, Number(value) || 0)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export const SOURCE_META = {
  manual: { label: "Сообщество", icon: "👤", color: "#8B949E", bg: "rgba(139, 148, 158, 0.12)", border: "rgba(139, 148, 158, 0.4)" },
  telegram: { label: "Telegram", icon: "📡", color: "#38BDF8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.4)" },
  hh: { label: "HH", icon: "💼", color: "#D6001C", bg: "rgba(214, 0, 28, 0.15)", border: "rgba(214, 0, 28, 0.4)" },
};

/**
 * Returns metadata for the announcement's source. For hh.*, the displayed
 * label is derived from the URL so KZ vacancies say "hh.kz" instead of "hh.ru".
 */
export function getSourceMeta(source, externalUrl) {
  const base = SOURCE_META[source] ?? SOURCE_META.manual;
  if (source === "hh" && externalUrl) {
    try {
      const host = new URL(externalUrl).host.replace(/^www\./, "");
      return { ...base, label: host };
    } catch {
      return base;
    }
  }
  return base;
}

const CURRENCY_SYMBOL = {
  RUR: "₽",
  RUB: "₽",
  USD: "$",
  EUR: "€",
  KZT: "₸",
  BYR: "Br",
  BYN: "Br",
  UAH: "₴",
  GEL: "₾",
};

function fmtNumber(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function formatSalary({ salary_from, salary_to, salary_currency } = {}) {
  if (!salary_from && !salary_to) return null;
  const sym = CURRENCY_SYMBOL[salary_currency] ?? (salary_currency || "");
  if (salary_from && salary_to) return `${fmtNumber(salary_from)}–${fmtNumber(salary_to)} ${sym}`.trim();
  if (salary_from) return `от ${fmtNumber(salary_from)} ${sym}`.trim();
  return `до ${fmtNumber(salary_to)} ${sym}`.trim();
}

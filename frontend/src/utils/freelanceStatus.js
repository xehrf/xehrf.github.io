const CONTRACT_STATUS_META = {
  active: {
    label: "В работе",
    progress: 40,
    badgeClass: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  },
  submitted: {
    label: "Отправлен",
    progress: 75,
    badgeClass: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  },
  completed: {
    label: "Завершён",
    progress: 100,
    badgeClass: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  },
};

const POST_STATUS_META = {
  open: {
    label: "Открыт",
    badgeClass: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  },
  in_progress: {
    label: "В работе",
    badgeClass: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  },
  completed: {
    label: "Завершён",
    badgeClass: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  },
};

const FALLBACK_CONTRACT_META = {
  label: "Неизвестно",
  progress: 0,
  badgeClass: "border-border bg-canvas text-muted",
};

const FALLBACK_POST_META = {
  label: "Неизвестно",
  badgeClass: "border-border bg-canvas text-muted",
};

export function getContractStatusMeta(status) {
  return CONTRACT_STATUS_META[status] ?? FALLBACK_CONTRACT_META;
}

export function getPostStatusMeta(status) {
  return POST_STATUS_META[status] ?? FALLBACK_POST_META;
}

export function formatMoney(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("ru-RU").format(numeric);
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

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(date);
}

export function resolveTimelineEventLabel(eventType) {
  switch (eventType) {
    case "contract_started":
      return "Контракт начат";
    case "result_submitted":
      return "Результат отправлен";
    case "revision_requested":
      return "Запрошена доработка";
    case "contract_completed":
      return "Контракт завершён";
    case "message_sent":
      return "Новое сообщение";
    default:
      return eventType;
  }
}

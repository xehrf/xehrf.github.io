const CONTRACT_STATUS_META = {
  active: {
    label: "In progress",
    progress: 40,
    badgeClass: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  },
  submitted: {
    label: "Submitted",
    progress: 75,
    badgeClass: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  },
  completed: {
    label: "Completed",
    progress: 100,
    badgeClass: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  },
};

const POST_STATUS_META = {
  open: {
    label: "Open",
    badgeClass: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  },
  in_progress: {
    label: "In progress",
    badgeClass: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  },
  completed: {
    label: "Completed",
    badgeClass: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  },
};

const FALLBACK_CONTRACT_META = {
  label: "Unknown",
  progress: 0,
  badgeClass: "border-border bg-canvas text-muted",
};

const FALLBACK_POST_META = {
  label: "Unknown",
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
  return new Intl.NumberFormat("en-US").format(numeric);
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

export function resolveTimelineEventLabel(eventType) {
  switch (eventType) {
    case "contract_started":
      return "Contract started";
    case "result_submitted":
      return "Result submitted";
    case "revision_requested":
      return "Revision requested";
    case "contract_completed":
      return "Contract completed";
    case "message_sent":
      return "New message";
    default:
      return eventType;
  }
}

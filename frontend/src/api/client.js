export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stringifyDetail(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
          const msg = item.msg || item.message || JSON.stringify(item);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    return detail.message || JSON.stringify(detail);
  }
  return String(detail ?? "");
}

// Пустой BASE_URL → запросы на тот же origin при локальной разработке.
// В продакшене frontend и backend хостятся отдельно.
// Обязательно задайте именно домен backend без /api, например:
// VITE_API_URL=https://your-render-backend.onrender.com
const rawBaseUrl = import.meta.env.VITE_API_URL ?? "";
const BASE_URL = rawBaseUrl.replace(/\/+$/, "");

if (BASE_URL.includes("/api")) {
  throw new Error(
    "VITE_API_URL не должен содержать '/api'. Укажите только домен backend без префикса /api, например https://your-backend.onrender.com."
  );
}

if (!BASE_URL && !import.meta.env.DEV) {
  throw new Error(
    "VITE_API_URL не задан. Установите переменную окружения VITE_API_URL на URL backend-сервера."
  );
}

export function resolveAssetUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

export async function apiFetch(
  path,
  { method = "GET", body, auth = true, timeoutMs = 10000, headers: customHeaders = {} } = {},
) {
  const headers = { ...customHeaders };
  if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = localStorage.getItem("access_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new ApiError(
        0,
        "Сервер не отвечает (таймаут). Если вы загружаете файл, попробуйте уменьшить размер или подождать дольше."
      );
    }
    throw new ApiError(0, "Не удалось подключиться к серверу.");
  } finally {
    window.clearTimeout(timeoutId);
  }

  const text = await res.text();

  if (!res.ok) {
    const errJson = safeJson(text);
    if (res.status === 404) {
      throw new ApiError(404, `Endpoint not found: ${method} ${BASE_URL}${path}`, errJson);
    }
    const message =
      (errJson && stringifyDetail(errJson.detail ?? errJson.message)) || text || `Request failed: ${res.status}`;
    throw new ApiError(res.status, message, errJson);
  }

  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  // Важно: JSON `null` должен остаться null (например GET /tasks/{id}/attempt без активной попытки).
  return safeJson(trimmed);
}


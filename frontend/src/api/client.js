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

function normalizeBaseUrl(rawValue) {
  const trimmed = (rawValue ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  const withoutApiSuffix = withoutTrailingSlash.replace(/\/api$/i, "");

  if (withoutTrailingSlash !== withoutApiSuffix) {
    console.warn("VITE_API_URL ended with /api. It was normalized automatically.");
  }

  return withoutApiSuffix;
}

const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);

if (!API_BASE_URL && !import.meta.env.DEV) {
  console.error("VITE_API_URL is empty in production. Requests will use the frontend origin.");
}

if (
  !import.meta.env.DEV &&
  (API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1"))
) {
  console.error("VITE_API_URL points to localhost in production. Use a public backend URL.");
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getWebSocketBaseUrl() {
  const origin = API_BASE_URL || window.location.origin;
  return origin.replace(/^http/i, "ws").replace(/\/+$/, "");
}

export function resolveAssetUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
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

  const requestPath = path.startsWith("/") ? path : `/${path}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${requestPath}`, {
      method,
      headers,
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new ApiError(0, "Server timeout. Please try again.");
    }
    throw new ApiError(0, "Could not connect to server.");
  } finally {
    window.clearTimeout(timeoutId);
  }

  const text = await res.text();

  if (!res.ok) {
    const errJson = safeJson(text);
    if (res.status === 404) {
      throw new ApiError(404, `Endpoint not found: ${method} ${API_BASE_URL}${requestPath}`, errJson);
    }
    const message =
      (errJson && stringifyDetail(errJson.detail ?? errJson.message)) || text || `Request failed: ${res.status}`;
    throw new ApiError(res.status, message, errJson);
  }

  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  return safeJson(trimmed);
}
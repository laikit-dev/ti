import { handleForbiddenNavigation } from "./utils/authRedirect";
import { translate } from "./i18n";
import { userAuthHeaders } from "./utils/shared";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "0.0.0.0"
    || hostname === "::1"
    || hostname === "[::1]";
}

function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (configured) return normalizeBaseUrl(configured);

  if (typeof window !== "undefined") {
    const { origin, protocol, hostname } = window.location;
    if (isLocalHostname(hostname)) {
      return `${protocol}//${hostname}:3000`;
    }
    return normalizeBaseUrl(origin);
  }

  return "";
}

export const apiBaseUrl = resolveApiBaseUrl();

function toNetworkError(err: unknown): Error {
  const message = String((err as Error)?.message ?? err);
  if (message.includes("Failed to fetch") || message.includes("ERR_CONNECTION_REFUSED")) {
    return new Error(translate("api.backendUnavailable", { url: apiBaseUrl }));
  }
  return new Error(message);
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    ...(init?.headers ?? {}),
    ...userAuthHeaders()
  };
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  } catch (err) {
    throw toNetworkError(err);
  }

  if (response.status === 403) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(handleForbiddenNavigation(payload?.error));
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return apiFetchWithBody<T>("POST", path, body, init);
}

export async function apiPatch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return apiFetchWithBody<T>("PATCH", path, body, init);
}

export async function apiDelete<T = void>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
    ...userAuthHeaders()
  };
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: "DELETE",
      ...init,
      headers
    });
  } catch (err) {
    throw toNetworkError(err);
  }
  if (response.status === 403) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(handleForbiddenNavigation(payload?.error));
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = String(payload?.error ?? `HTTP ${response.status}`);
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  return payload as T;
}

async function apiFetchWithBody<T>(method: string, path: string, body: unknown, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
    ...userAuthHeaders()
  };
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      ...init,
      headers,
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw toNetworkError(err);
  }
  const payload = await response.json().catch(() => ({}));

  if (response.status === 403) {
    throw new Error(handleForbiddenNavigation(payload?.error));
  }

  if (!response.ok) {
    const message = String(payload?.error ?? `HTTP ${response.status}`);
    throw new Error(message);
  }
  return payload as T;
}

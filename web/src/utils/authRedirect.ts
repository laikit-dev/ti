import { translate } from "../i18n";

export const BANNED_ROUTE_PATH = "/auth/banned";

const LOCAL_USER_KEY = "ti.user";
const LOCAL_ADMIN_TOKEN_KEY = "ti.admin.token";
const LOCAL_SESSION_KEY = "ti.session";

interface StoredUserSnapshot {
  isBanned?: boolean;
  [key: string]: unknown;
}

function readStoredUserSnapshot(): StoredUserSnapshot | null {
  const raw = localStorage.getItem(LOCAL_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUserSnapshot;
  } catch {
    localStorage.removeItem(LOCAL_USER_KEY);
    return null;
  }
}

function markStoredUserAsBanned() {
  const current = readStoredUserSnapshot();
  if (!current) return;
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({
    ...current,
    isBanned: true
  }));
}

export function isBannedMessage(message: unknown): boolean {
  const text = String(message ?? "").toLowerCase();
  return text.includes("封禁") || text.includes("banned");
}

export function handleForbiddenNavigation(message: unknown): string {
  const text = String(message ?? translate("api.forbidden"));

  if (isBannedMessage(text)) {
    try {
      markStoredUserAsBanned();
      localStorage.removeItem(LOCAL_ADMIN_TOKEN_KEY);
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } catch { }

    if (typeof window !== "undefined" && window.location.pathname !== BANNED_ROUTE_PATH) {
      window.location.assign(BANNED_ROUTE_PATH);
    }
    return text;
  }

  try {
    localStorage.removeItem(LOCAL_USER_KEY);
    localStorage.removeItem(LOCAL_ADMIN_TOKEN_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch { }

  if (typeof window !== "undefined" && window.location.pathname !== "/auth/login") {
    window.location.assign("/auth/login");
  }

  return text;
}

import { apiBaseUrl, apiGet, apiPatch, apiPost } from "../api";
import { clearBearerSession, saveBearerSession, userAuthHeaders } from "../utils/shared";

export type AutosaveIntervalSeconds = 0 | 30 | 60 | 120 | 300 | 600;

export interface AuthUser {
  id: number;
  uid: string;
  username: string;
  email: string;
  avatarUrl: string;
  profileCoverUrl: string;
  bio: string;
  isAdmin: boolean;
  isBanned: boolean;
  recordsPublic: boolean;
  aiModelId?: string;
  submissionAnalysisMode?: "none" | "wrong_only" | "all";
  autosaveIntervalSeconds?: AutosaveIntervalSeconds;
  highlighterEnabled?: boolean;
  createdAt: string;
}

export type PublicUserProfile = Pick<
  AuthUser,
  "uid" | "username" | "avatarUrl" | "profileCoverUrl" | "bio" | "isAdmin" | "isBanned" | "recordsPublic" | "createdAt"
>;

export interface PersonalExportStatus {
  canExport: boolean;
  lastExportedAt: string | null;
  nextAvailableAt: string | null;
  cooldownDays: number;
  minimumAccountAgeDays: number;
  restrictionReason: "registration_wait" | "cooldown" | null;
  isUnlimited: boolean;
}

interface UserResponse {
  user: PublicUserProfile;
}

interface MySettingsResponse {
  settings: {
    recordsPublic: boolean;
    profileCoverUrl: string;
    submissionAnalysisMode: "none" | "wrong_only" | "all";
    autosaveIntervalSeconds: AutosaveIntervalSeconds;
    aiModelId: string;
    highlighterEnabled: boolean;
  };
  user: AuthUser;
}

interface CpoauthSessionResponse {
  session: {
    user: AuthUser;
    returnTo: string;
    token: string;
  };
}

interface AdminTokenSessionResponse {
  session: {
    user: AuthUser;
    token: string;
  };
}

const LOCAL_USER_KEY = "ti.user";

export function buildCpoauthAuthorizeUrl(returnTo = "/problemset"): string {
  const url = new URL("/api/oauth/cpoauth/authorize", apiBaseUrl);
  url.searchParams.set("returnTo", returnTo);
  if (typeof window !== "undefined") {
    url.searchParams.set("webBaseUrl", window.location.origin);
  }
  return url.toString();
}

export async function redeemCpoauthTicket(ticket: string): Promise<{ user: AuthUser; returnTo: string }> {
  const result = await apiPost<CpoauthSessionResponse>("/api/oauth/cpoauth/session", { ticket });
  saveBearerSession(result.session.token);
  return {
    user: result.session.user,
    returnTo: result.session.returnTo || "/problemset"
  };
}

export async function loginWithAdminToken(token: string): Promise<AuthUser> {
  const normalized = String(token ?? "").trim();
  const result = await apiPost<AdminTokenSessionResponse>("/api/auth/admin-token/session", {
    token: normalized
  });
  saveBearerSession(result.session.token);
  return result.session.user;
}

export function saveLocalUser(user: AuthUser) {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
}

export function loadLocalUser(): AuthUser | null {
  const raw = localStorage.getItem(LOCAL_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearLocalUser() {
  localStorage.removeItem(LOCAL_USER_KEY);
  clearBearerSession();
}

export async function getUserByUid(uid: string): Promise<PublicUserProfile> {
  const result = await apiGet<UserResponse>(`/api/users/${encodeURIComponent(uid)}`);
  return result.user;
}

export async function getMySettings(): Promise<MySettingsResponse["settings"]> {
  const result = await apiGet<MySettingsResponse>("/api/users/_me/settings");
  return result.settings;
}

export async function updateMySettings(payload: {
  recordsPublic: boolean;
  profileCoverUrl: string;
  submissionAnalysisMode: "none" | "wrong_only" | "all";
  autosaveIntervalSeconds: AutosaveIntervalSeconds;
  aiModelId: string;
  highlighterEnabled: boolean;
}): Promise<{ settings: MySettingsResponse["settings"]; user: AuthUser }> {
  const result = await apiPatch<MySettingsResponse>("/api/users/_me/settings", payload);
  return {
    settings: result.settings,
    user: result.user
  };
}

export async function getPersonalExportStatus(): Promise<PersonalExportStatus> {
  return apiGet<PersonalExportStatus>("/api/users/_me/export-status");
}

export async function requestPersonalDataExport(): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${apiBaseUrl}/api/users/_me/export`, {
    method: "POST",
    headers: userAuthHeaders()
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
  const disposition = String(response.headers.get("Content-Disposition") ?? "");
  const filenameMatch = disposition.match(/filename="([^"]+)"/i);
  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] || "ti-personal-data.pdf"
  };
}

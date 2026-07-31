import { apiGet, apiPost, apiBaseUrl } from "../api";
import { loadAdminTokenSession, loadLocalUser, type AuthUser } from "./auth";
import type { ChoiceOption, ProblemQuestion, ProblemsetSummary } from "./problemset";
import { invalidatePublicSiteContentCache, type SystemPage } from "./siteContent";

interface UsersResponse {
  users: AuthUser[];
}

interface UserResponse {
  user: AuthUser;
}

interface CpoauthConfigResponse {
  config: CpoauthConfig;
}

interface AiConfigResponse {
  config: AiConfig;
}

interface AdminTokensResponse {
  tokens: AdminToken[];
}

interface AdminTokenResponse {
  token: AdminToken;
}

interface ProblemsetsResponse {
  problemsets: AdminProblemset[];
}

interface ProblemsetResponse {
  problemset: AdminProblemset;
}

interface QuestionResponse {
  question: ProblemQuestion;
}

interface SystemPageResponse {
  page: SystemPage;
}

interface AdminSystemPagesResponse {
  loginNoticeMarkdown: string;
  userAgreementPage: SystemPage | null;
  privacyPolicyPage: SystemPage | null;
  pages: SystemPage[];
}

export interface CpoauthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scope: string;
}

export interface AiConfig {
  defaultModelId: string;
  prompts: {
    hintSystemPrompt: string;
    solutionSystemPrompt: string;
    hintUserPrompt: string;
    solutionUserPrompt: string;
  };
  models: AiModelConfig[];
}

export interface AiModelConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  dailyLimit: number;
  enabled: boolean;
}

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  prefix: string;
  concurrency: string;
  forcePathStyle: string;
  cdnBaseUrl: string;
}

export interface AdminProblemset extends ProblemsetSummary {
  createdByUid?: string;
  createdAt?: string;
}

export interface AdminToken {
  id: number;
  token: string;
  createdByUid: string;
  createdAt: string;
}

export interface AdminSystemPagesPayload {
  loginNoticeMarkdown: string;
  userAgreementPage: {
    slug: string;
    title: string;
    content: string;
  };
  privacyPolicyPage: {
    slug: string;
    title: string;
    content: string;
  };
}

function adminHeaders() {
  const user = loadLocalUser();
  const adminToken = loadAdminTokenSession();
  return {
    "x-admin-uid": user?.uid ?? "",
    "x-admin-token": adminToken
  };
}

export async function fetchAdminUsers(): Promise<AuthUser[]> {
  const result = await apiGet<UsersResponse>("/api/admin/users", {
    headers: adminHeaders()
  });
  return result.users;
}

export async function promoteUser(uid: string) {
  await apiPost<{ ok: boolean }>(
    `/api/admin/users/${encodeURIComponent(uid)}/promote`,
    {},
    { headers: adminHeaders() }
  );
}

export async function banUser(uid: string, banned: boolean) {
  await apiPost<{ ok: boolean }>(
    `/api/admin/users/${encodeURIComponent(uid)}/ban`,
    { banned },
    { headers: adminHeaders() }
  );
}

export async function deleteUser(uid: string) {
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "DELETE",
    headers: adminHeaders()
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
}

export async function updateUser(
  uid: string,
  payload: Partial<{
    uid: string;
    username: string;
    email: string;
    isAdmin: boolean;
    isBanned: boolean;
  }>
): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  return (data as UserResponse).user;
}

export async function createQuestion(
  problemsetId: number,
  payload: {
    index?: number;
    type?: "option" | "input";
    stem: string;
    inputPlaceholder?: string;
    options: ChoiceOption[];
    score: number;
    answer: string;
    analysis: string;
  }
): Promise<ProblemQuestion> {
  const result = await apiPost<QuestionResponse>(
    `/api/admin/problemsets/${problemsetId}/questions`,
    payload,
    { headers: adminHeaders() }
  );
  return result.question;
}

export async function fetchAdminProblemsets(): Promise<AdminProblemset[]> {
  const result = await apiGet<ProblemsetsResponse>("/api/admin/problemsets", {
    headers: adminHeaders()
  });
  return result.problemsets;
}

export async function fetchAdminProblemsetQuestions(problemsetId: number): Promise<ProblemQuestion[]> {
  const result = await apiGet<{ questions: ProblemQuestion[] }>(`/api/admin/problemsets/${problemsetId}/questions`, {
    headers: adminHeaders()
  });
  return result.questions;
}

export async function updateAdminProblemset(
  problemsetId: number,
  payload: Partial<{
    id: number;
    title: string;
    description: string;
    durationMinutes: number;
    questionConfig: string;
  }>
): Promise<AdminProblemset> {
  const response = await fetch(`${apiBaseUrl}/api/admin/problemsets/${problemsetId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  return (data as ProblemsetResponse).problemset;
}

export async function deleteAdminProblemset(problemsetId: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/admin/problemsets/${problemsetId}`, {
    method: "DELETE",
    headers: adminHeaders()
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
}

export async function deleteAllProblemsetQuestions(problemsetId: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/admin/problemsets/${problemsetId}/questions`, {
    method: "DELETE",
    headers: adminHeaders()
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
}

export async function updateQuestion(
  questionId: string | number,
  payload: Partial<{
    index: number;
    type: "option" | "input";
    stem: string;
    inputPlaceholder: string;
    options: ChoiceOption[];
    score: number;
    answer: string;
    analysis: string;
  }>
): Promise<ProblemQuestion> {
  const response = await fetch(`${apiBaseUrl}/api/admin/questions/${encodeURIComponent(String(questionId))}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  return (data as QuestionResponse).question;
}

export async function deleteQuestion(questionId: string | number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/admin/questions/${encodeURIComponent(String(questionId))}`, {
    method: "DELETE",
    headers: adminHeaders()
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
}

export async function fetchCpoauthConfig(): Promise<CpoauthConfig> {
  const result = await apiGet<CpoauthConfigResponse>("/api/admin/oauth/cpoauth", {
    headers: adminHeaders()
  });
  return result.config;
}

export async function updateCpoauthConfig(payload: CpoauthConfig): Promise<CpoauthConfig> {
  const response = await fetch(`${apiBaseUrl}/api/admin/oauth/cpoauth`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  return (data as CpoauthConfigResponse).config;
}

export async function fetchAiConfig(): Promise<AiConfig> {
  const result = await apiGet<AiConfigResponse>("/api/admin/ai/config", {
    headers: adminHeaders()
  });
  return result.config;
}

export async function updateAiConfig(payload: AiConfig): Promise<AiConfig> {
  const response = await fetch(`${apiBaseUrl}/api/admin/ai/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  return (data as AiConfigResponse).config;
}

interface S3ConfigResponse {
  config: S3Config;
}

export async function fetchS3Config(): Promise<S3Config> {
  const result = await apiGet<S3ConfigResponse>("/api/admin/s3/config", {
    headers: adminHeaders()
  });
  return result.config;
}

export async function updateS3Config(payload: S3Config): Promise<S3Config> {
  const response = await fetch(`${apiBaseUrl}/api/admin/s3/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  return (data as S3ConfigResponse).config;
}

export async function fetchAdminTokens(): Promise<AdminToken[]> {
  const result = await apiGet<AdminTokensResponse>("/api/admin/admin-tokens", {
    headers: adminHeaders()
  });
  return result.tokens;
}

export async function createAdminToken(): Promise<AdminToken> {
  const result = await apiPost<AdminTokenResponse>("/api/admin/admin-tokens", {}, {
    headers: adminHeaders()
  });
  return result.token;
}

export async function deleteAdminToken(id: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/admin/admin-tokens/${id}`, {
    method: "DELETE",
    headers: adminHeaders()
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
}

export async function fetchAdminSystemPages(): Promise<AdminSystemPagesResponse> {
  return apiGet<AdminSystemPagesResponse>("/api/admin/system-pages", {
    headers: adminHeaders()
  });
}

export async function updateAdminSystemPageSettings(payload: AdminSystemPagesPayload): Promise<AdminSystemPagesResponse> {
  const response = await fetch(`${apiBaseUrl}/api/admin/system-pages/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  invalidatePublicSiteContentCache();
  return data as AdminSystemPagesResponse;
}

export async function createAdminSystemPage(payload: {
  slug: string;
  title: string;
  content: string;
}): Promise<SystemPage> {
  const response = await fetch(`${apiBaseUrl}/api/admin/system-pages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  invalidatePublicSiteContentCache();
  return (data as SystemPageResponse).page;
}

export async function updateAdminSystemPage(
  id: number,
  payload: {
    slug: string;
    title: string;
    content: string;
  }
): Promise<SystemPage> {
  const response = await fetch(`${apiBaseUrl}/api/admin/system-pages/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error ?? `HTTP ${response.status}`));
  }
  invalidatePublicSiteContentCache();
  return (data as SystemPageResponse).page;
}

export async function deleteAdminSystemPage(id: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/admin/system-pages/${id}`, {
    method: "DELETE",
    headers: adminHeaders()
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
  invalidatePublicSiteContentCache();
}


export interface BackupSelections {
  problemsets: boolean;
  oauth: boolean;
  systemPages: boolean;
  users: boolean;
  aiConfig: boolean;
  submissions: boolean;
  s3Config: boolean;
}

export async function exportBackup(selections: BackupSelections, password: string): Promise<unknown> {
  const url = `${apiBaseUrl}/api/admin/backup/export`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ selections, password: password || "" })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
  return payload;
}

export async function restoreBackup(backupData: unknown, selections: BackupSelections, password: string): Promise<void> {
  const url = `${apiBaseUrl}/api/admin/backup/restore`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...adminHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ ...(backupData as Record<string, unknown>), selections, password: password || "" })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error ?? `HTTP ${response.status}`));
  }
}

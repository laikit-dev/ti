// @ts-nocheck
import express from "express";
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "node:crypto";
import { dbPool, pingDb } from "./db.js";
import { pingRedis, redis } from "./redis.js";
import { buildGravatarUrl, normalizeEmail } from "./auth.js";
import { env } from "./env.js";
import { parseQuestionConfig } from "./questionConfigParser.js";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function normalizeUid(value) {
  return String(value ?? "").trim();
}

function isValidUid(value) {
  return /^[A-Za-z0-9_][A-Za-z0-9_-]{1,31}$/.test(normalizeUid(value));
}

function normalizeBio(raw) {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 4000);
}

function toPublicUser(row) {
  return {
    id: Number(row.id),
    uid: String(row.uid ?? ""),
    username: String(row.name ?? ""),
    email: String(row.email ?? ""),
    avatarUrl: String(row.avatar_url ?? ""),
    profileCoverUrl: String(row.profile_cover_url ?? ""),
    bio: normalizeBio(row.bio),
    isAdmin: Boolean(row.is_admin),
    isBanned: Boolean(row.is_banned),
    recordsPublic: Boolean(row.records_public),
    aiModelId: normalizeAiModelId(row.ai_model_id),
    submissionAnalysisMode: normalizeSubmissionAnalysisMode(row.submission_analysis_mode, "wrong_only"),
    autosaveIntervalSeconds: normalizeAutosaveIntervalSeconds(row.autosave_interval_seconds, 30),
    createdAt: row.created_at
  };
}

function normalizeSubmissionAnalysisMode(raw, fallback = "wrong_only") {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "none" || value === "wrong_only" || value === "all") return value;
  return fallback;
}

function normalizeAutosaveIntervalSeconds(raw, fallback = 30) {
  const value = Number(raw);
  if (value === 0 || value === 30 || value === 60 || value === 120 || value === 300 || value === 600) {
    return value;
  }
  return fallback;
}

const DEFAULT_PROFILE_COVERS = [
  "https://resources.cn-sy1.rains3.com/ti/banner_1.webp",
  "https://resources.cn-sy1.rains3.com/ti/banner_2.webp",
  "https://resources.cn-sy1.rains3.com/ti/banner_3.webp"
];

function pickDefaultProfileCover() {
  const index = randomBytes(1)[0] % DEFAULT_PROFILE_COVERS.length;
  return DEFAULT_PROFILE_COVERS[index];
}

function toQuestion(row) {
  return {
    id: String(row.id),
    index: Number(row.question_index),
    type: String(row.question_type ?? "option"),
    materialGroupIndex: row.material_group_index === null || row.material_group_index === undefined
      ? null
      : Number(row.material_group_index),
    groupQuestionIndex: row.group_question_index === null || row.group_question_index === undefined
      ? null
      : Number(row.group_question_index),
    groupQuestionCount: row.group_question_count === null || row.group_question_count === undefined
      ? null
      : Number(row.group_question_count),
    groupTitle: String(row.group_title ?? ""),
    sharedMaterial: String(row.shared_material ?? ""),
    stem: String(row.stem ?? ""),
    inputPlaceholder: String(row.input_placeholder ?? ""),
    options: Array.isArray(row.options_json)
      ? row.options_json
      : JSON.parse(String(row.options_json ?? "[]")),
    score: Number(row.score),
    answer: String(row.answer ?? ""),
    analysis: String(row.analysis ?? "")
  };
}

function toProblemsetSummary(row) {
  const summary = {
    id: Number(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    questionCount: Number(row.question_count ?? 0),
    durationHours: Number(row.duration_minutes ?? 120) / 60,
    problemsetType: String(row.problemset_type ?? "official_public")
  };
  if (row.created_by_uid !== undefined) {
    summary.createdByUid = String(row.created_by_uid ?? "");
  }
  if (row.created_at !== undefined) {
    summary.createdAt = row.created_at;
  }
  return summary;
}

const PROBLEMSET_TYPES = {
  official_public: "official_public",
  personal_featured: "personal_featured",
  personal_public: "personal_public",
  personal_private: "personal_private"
};

function normalizeProblemsetType(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (
    value === PROBLEMSET_TYPES.official_public ||
    value === PROBLEMSET_TYPES.personal_featured ||
    value === PROBLEMSET_TYPES.personal_public ||
    value === PROBLEMSET_TYPES.personal_private
  ) {
    return value;
  }
  return "";
}

function canUserEditProblemset(problemsetRow, user) {
  if (!user) return false;
  if (Boolean(user.is_admin)) return true;
  return String(problemsetRow?.created_by_uid ?? "") === String(user.uid ?? "");
}

function canUserViewProblemset(problemsetRow, user) {
  const type = String(problemsetRow?.problemset_type ?? PROBLEMSET_TYPES.official_public);
  if (
    type === PROBLEMSET_TYPES.official_public ||
    type === PROBLEMSET_TYPES.personal_featured ||
    type === PROBLEMSET_TYPES.personal_public
  ) {
    return true;
  }
  return canUserEditProblemset(problemsetRow, user);
}

function parseProblemsetListTab(raw) {
  const tab = String(raw ?? "").trim().toLowerCase();
  if (tab === "all" || tab === "featured" || tab === "official") return tab;
  return "official";
}

function normalizeQuestionType(rawType) {
  const value = String(rawType ?? "").trim().toLowerCase();
  if (value === "option" || value === "input") return value;
  return "";
}

function parseQuestionOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  const normalized = [];
  for (let index = 0; index < rawOptions.length && index < 26; index += 1) {
    const item = rawOptions[index] ?? {};
    const text = String(item.text ?? "").trim();
    if (!text) continue;
    const candidateKey = String(item.key ?? "").trim().toUpperCase();
    const key = /^[A-Z]$/.test(candidateKey) ? candidateKey : String.fromCharCode(65 + index);
    if (normalized.some((option) => option.key === key)) continue;
    normalized.push({ key, text });
  }
  return normalized;
}

function normalizeQuestionAnswer(answerRaw) {
  return Array.from(
    new Set(
      String(answerRaw ?? "")
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => /^[A-Z]$/.test(item))
    )
  ).join(",");
}

const CPOAUTH_SETTING_KEYS = {
  clientId: "cpoauth.client_id",
  clientSecret: "cpoauth.client_secret",
  callbackUrl: "cpoauth.callback_url",
  scope: "cpoauth.scope"
};

const AI_SETTING_KEYS = {
  baseUrl: "ai.base_url",
  apiKey: "ai.api_key",
  model: "ai.model",
  config: "ai.config"
};

const S3_SETTING_KEYS = {
  region: "s3.region",
  bucket: "s3.bucket",
  accessKeyId: "s3.access_key_id",
  secretAccessKey: "s3.secret_access_key",
  endpoint: "s3.endpoint",
  prefix: "s3.prefix",
  concurrency: "s3.concurrency",
  forcePathStyle: "s3.force_path_style",
  cdnBaseUrl: "s3.cdn_base_url"
};

const SITE_SETTING_KEYS = {
  loginNoticeMarkdown: "site.login_notice_markdown"
};

const SYSTEM_PAGE_KEYS = {
  userAgreement: "user_agreement",
  privacyPolicy: "privacy_policy"
};

const SYSTEM_PAGE_SLUGS = {
  [SYSTEM_PAGE_KEYS.userAgreement]: "user-agreement",
  [SYSTEM_PAGE_KEYS.privacyPolicy]: "privacy-policy"
};

function normalizeSystemPageSystemKey(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === SYSTEM_PAGE_KEYS.userAgreement || value === SYSTEM_PAGE_KEYS.privacyPolicy) {
    return value;
  }
  return "";
}

function normalizeSystemPageSlug(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/.test(value)) return "";
  return value;
}

function normalizeSystemPageTitle(raw) {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 191);
}

function normalizeSystemPageContent(raw) {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 200000);
}

function getReservedSystemPageSlug(systemKey) {
  return String(SYSTEM_PAGE_SLUGS[systemKey] ?? "").trim();
}

function toSystemPage(row) {
  return {
    id: Number(row.id),
    systemKey: String(row.system_key ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSystemPageSummary(row) {
  return {
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    systemKey: String(row.system_key ?? "")
  };
}

function readSystemPageInput(raw) {
  const slug = normalizeSystemPageSlug(raw?.slug);
  const title = normalizeSystemPageTitle(raw?.title);
  const content = normalizeSystemPageContent(raw?.content);
  if (!slug) return { error: "slug must be 1-64 chars of lowercase letters, numbers, - or _" };
  if (!title) return { error: "title is required" };
  return { slug, title, content };
}

function readReservedSystemPageInput(raw, systemKey) {
  const slug = getReservedSystemPageSlug(systemKey);
  const title = normalizeSystemPageTitle(raw?.title);
  const content = normalizeSystemPageContent(raw?.content);
  if (!slug) return { error: "invalid reserved system page slug" };
  if (!title) return { error: "title is required" };
  return { slug, title, content };
}

function buildDefaultCallbackUrl(req) {
  return `${resolvePublicApiBaseUrl(req).replace(/\/$/, "")}/api/oauth/cpoauth/callback`;
}

function normalizeReturnTo(raw) {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/problemset";
  }
  return value;
}

const ADMIN_TOKEN_LENGTH = 32;
const ADMIN_TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function isValidAdminToken(raw) {
  return /^[A-Za-z0-9]{32}$/.test(String(raw ?? "").trim());
}

function generateAdminToken() {
  const bytes = randomBytes(ADMIN_TOKEN_LENGTH);
  let token = "";
  for (let i = 0; i < ADMIN_TOKEN_LENGTH; i += 1) {
    token += ADMIN_TOKEN_ALPHABET[bytes[i] % ADMIN_TOKEN_ALPHABET.length];
  }
  return token;
}

function toRootUser() {
  return {
    id: 0,
    uid: "root",
    username: "root",
    email: "",
    avatarUrl: "",
    profileCoverUrl: "",
    bio: "",
    isAdmin: true,
    isBanned: false,
    recordsPublic: false,
    aiModelId: "",
    autosaveIntervalSeconds: 30,
    createdAt: "1970-01-01T00:00:00.000Z"
  };
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value ?? "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] ?? "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host") || `localhost:${env.port}`;
  return `${protocol}://${host}`;
}

function resolvePublicApiBaseUrl(req) {
  return env.publicApiBaseUrl || getRequestOrigin(req);
}

function isAllowedWebHostname(currentHostname, desiredHostname) {
  if (!currentHostname || !desiredHostname) return false;
  if (currentHostname === desiredHostname) return true;
  if (currentHostname.startsWith("api.") && currentHostname.slice(4) === desiredHostname) return true;
  if (desiredHostname.startsWith("api.") && desiredHostname.slice(4) === currentHostname) return true;
  return false;
}

function resolveWebBaseUrl(req, candidate) {
  const fallback = env.webBaseUrl || getRequestOrigin(req);
  const raw = String(candidate ?? "").trim();
  if (!isHttpUrl(raw)) return fallback;
  try {
    const desired = new URL(raw);
    if (env.webBaseUrl && isHttpUrl(env.webBaseUrl)) {
      const configured = new URL(env.webBaseUrl);
      return configured.origin === desired.origin ? desired.origin : configured.origin;
    }
    const current = new URL(getRequestOrigin(req));
    if (!isAllowedWebHostname(current.hostname, desired.hostname)) return fallback;
    return desired.origin;
  } catch {
    return fallback;
  }
}

function normalizeOauthScope(scopeRaw) {
  return String(scopeRaw ?? "")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");
}

async function getAppSettings(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return {};
  const placeholders = keys.map(() => "?").join(", ");
  const [rows] = await dbPool.query(
    `SELECT \`key\`, \`value\` FROM app_settings WHERE \`key\` IN (${placeholders})`,
    keys
  );
  const map = {};
  for (const row of rows) {
    map[row.key] = row.value ?? "";
  }
  return map;
}

async function setAppSetting(key, value) {
  await dbPool.query(
    "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    [key, value]
  );
}

async function getSystemPageBySlug(slug) {
  const [rows] = await dbPool.query(
    "SELECT id, system_key, slug, title, content, created_at, updated_at FROM system_pages WHERE slug = ? LIMIT 1",
    [slug]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function getSystemPageById(id) {
  const [rows] = await dbPool.query(
    "SELECT id, system_key, slug, title, content, created_at, updated_at FROM system_pages WHERE id = ? LIMIT 1",
    [id]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function getSystemPageBySystemKey(systemKey) {
  const [rows] = await dbPool.query(
    "SELECT id, system_key, slug, title, content, created_at, updated_at FROM system_pages WHERE system_key = ? LIMIT 1",
    [systemKey]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function listCustomSystemPages() {
  const [rows] = await dbPool.query(
    `
      SELECT id, system_key, slug, title, content, created_at, updated_at
      FROM system_pages
      WHERE system_key IS NULL
      ORDER BY updated_at DESC, id DESC
    `
  );
  return Array.isArray(rows) ? rows : [];
}

async function getSitePublicContent() {
  const settings = await getAppSettings([SITE_SETTING_KEYS.loginNoticeMarkdown]);
  const [pages] = await dbPool.query(
    `
      SELECT id, system_key, slug, title, content, created_at, updated_at
      FROM system_pages
      WHERE system_key IN (?, ?)
    `,
    [SYSTEM_PAGE_KEYS.userAgreement, SYSTEM_PAGE_KEYS.privacyPolicy]
  );

  const result = {
    loginNoticeMarkdown: String(settings[SITE_SETTING_KEYS.loginNoticeMarkdown] ?? ""),
    userAgreementPage: null,
    privacyPolicyPage: null
  };

  for (const row of Array.isArray(pages) ? pages : []) {
    const systemKey = String(row.system_key ?? "");
    if (systemKey === SYSTEM_PAGE_KEYS.userAgreement) {
      result.userAgreementPage = toSystemPageSummary(row);
    } else if (systemKey === SYSTEM_PAGE_KEYS.privacyPolicy) {
      result.privacyPolicyPage = toSystemPageSummary(row);
    }
  }

  return result;
}

async function getCpoauthConfig(req) {
  const settings = await getAppSettings(Object.values(CPOAUTH_SETTING_KEYS));
  return {
    clientId: String(settings[CPOAUTH_SETTING_KEYS.clientId] ?? "").trim(),
    clientSecret: String(settings[CPOAUTH_SETTING_KEYS.clientSecret] ?? "").trim(),
    callbackUrl: String(settings[CPOAUTH_SETTING_KEYS.callbackUrl] ?? "").trim() || buildDefaultCallbackUrl(req),
    scope: normalizeOauthScope(String(settings[CPOAUTH_SETTING_KEYS.scope] ?? "").trim() || "openid profile email")
  };
}

async function getS3Config() {
  const settings = await getAppSettings(Object.values(S3_SETTING_KEYS));
  return {
    region: String(settings[S3_SETTING_KEYS.region] ?? "").trim(),
    bucket: String(settings[S3_SETTING_KEYS.bucket] ?? "").trim(),
    accessKeyId: String(settings[S3_SETTING_KEYS.accessKeyId] ?? "").trim(),
    secretAccessKey: String(settings[S3_SETTING_KEYS.secretAccessKey] ?? "").trim(),
    endpoint: String(settings[S3_SETTING_KEYS.endpoint] ?? "").trim(),
    prefix: String(settings[S3_SETTING_KEYS.prefix] ?? "").trim(),
    concurrency: String(settings[S3_SETTING_KEYS.concurrency] ?? "8").trim(),
    forcePathStyle: String(settings[S3_SETTING_KEYS.forcePathStyle] ?? "true").trim(),
    cdnBaseUrl: String(settings[S3_SETTING_KEYS.cdnBaseUrl] ?? "").trim()
  };
}

function normalizeAiBaseUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (!isHttpUrl(value)) return "";
  return value.replace(/\/$/, "");
}

function normalizeAiModel(raw) {
  return String(raw ?? "").trim().slice(0, 120);
}

function normalizeAiModelId(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function normalizeAiPrompt(raw, fallback) {
  const value = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  return (value || fallback).slice(0, 12000);
}

const DEFAULT_AI_PROMPTS = {
  hintSystemPrompt: [
    "你是一个竞赛题辅导助手。",
    "你必须严格只依据用户提供的题目内容回答，不允许补充、猜测或改写成其他题目。",
    "如果题目信息不足以作答，直接回复：题目信息不足，无法生成准确提示。",
    "输出使用简体中文，不要输出与题目无关的内容。"
  ].join(""),
  solutionSystemPrompt: [
    "你是一个竞赛题辅导助手。",
    "你必须严格只依据用户提供的题目内容回答，不允许补充、猜测或改写成其他题目。",
    "如果题目信息不足以作答，直接回复：题目信息不足，无法生成准确解析。",
    "输出使用简体中文，不要输出与题目无关的内容。"
  ].join(""),
  hintUserPrompt: [
    "请为下面这道题生成提示。",
    "",
    "【题目开始】",
    "{{question}}",
    "【题目结束】",
    "",
    "只输出该题目的提示正文，不要输出“题目复述”“选项抄写”“免责声明”“额外建议”。"
  ].join("\n"),
  solutionUserPrompt: [
    "请为下面这道题生成解析。",
    "",
    "【题目开始】",
    "{{question}}",
    "【题目结束】",
    "",
    "只输出该题目的解析正文，不要输出“题目复述”“选项抄写”“免责声明”“额外建议”。"
  ].join("\n")
};

function readAiModelConfig(raw, index) {
  const source = raw && typeof raw === "object" ? raw : {};
  const baseUrl = normalizeAiBaseUrl(source.baseUrl);
  const model = normalizeAiModel(source.model);
  const apiKey = String(source.apiKey ?? "").trim();
  const id = normalizeAiModelId(source.id) || normalizeAiModelId(source.model) || `model-${index + 1}`;
  const name = String(source.name ?? "").trim().slice(0, 80) || model || id;
  const dailyLimit = Math.max(0, Math.min(100000, Math.floor(Number(source.dailyLimit ?? 0) || 0)));
  return { id, name, baseUrl, model, apiKey, dailyLimit, enabled: source.enabled !== false };
}

function normalizeAiConfigPayload(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const sourceModels = Array.isArray(source.models) ? source.models : [];
  const models = [];
  const usedIds = new Set();
  for (let index = 0; index < sourceModels.length && models.length < 20; index += 1) {
    const model = readAiModelConfig(sourceModels[index], index);
    if (!model.id || !model.baseUrl || !model.model || !model.apiKey) continue;
    let id = model.id;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${model.id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    models.push({ ...model, id });
  }
  const enabledModels = models.filter((item) => item.enabled);
  let defaultModelId = normalizeAiModelId(source.defaultModelId);
  if (!models.some((item) => item.id === defaultModelId && item.enabled)) {
    defaultModelId = enabledModels[0]?.id || models[0]?.id || "";
  }
  return {
    models,
    defaultModelId,
    prompts: {
      hintSystemPrompt: normalizeAiPrompt(source.prompts?.hintSystemPrompt, DEFAULT_AI_PROMPTS.hintSystemPrompt),
      solutionSystemPrompt: normalizeAiPrompt(source.prompts?.solutionSystemPrompt, DEFAULT_AI_PROMPTS.solutionSystemPrompt),
      hintUserPrompt: normalizeAiPrompt(source.prompts?.hintUserPrompt, DEFAULT_AI_PROMPTS.hintUserPrompt),
      solutionUserPrompt: normalizeAiPrompt(source.prompts?.solutionUserPrompt, DEFAULT_AI_PROMPTS.solutionUserPrompt)
    }
  };
}

async function getAiConfig() {
  const settings = await getAppSettings(Object.values(AI_SETTING_KEYS));
  const rawConfig = settings[AI_SETTING_KEYS.config];
  if (rawConfig) {
    return normalizeAiConfigPayload(safeJsonParse(rawConfig, {}));
  }

  const legacyModel = {
    id: "default",
    name: normalizeAiModel(settings[AI_SETTING_KEYS.model]) || "DeepSeek",
    baseUrl: normalizeAiBaseUrl(settings[AI_SETTING_KEYS.baseUrl]) || "https://api.deepseek.com/v1",
    apiKey: String(settings[AI_SETTING_KEYS.apiKey] ?? "").trim(),
    model: normalizeAiModel(settings[AI_SETTING_KEYS.model]) || "deepseek-v4-flash",
    dailyLimit: 0,
    enabled: true
  };
  return normalizeAiConfigPayload({
    models: legacyModel.apiKey ? [legacyModel] : [],
    defaultModelId: legacyModel.id,
    prompts: DEFAULT_AI_PROMPTS
  });
}

async function saveAiConfig(config) {
  await setAppSetting(AI_SETTING_KEYS.config, JSON.stringify(normalizeAiConfigPayload(config)));
}

async function getDefaultAiModelId() {
  const config = await getAiConfig();
  return normalizeAiModelId(config.defaultModelId);
}

function toPublicAiModel(model) {
  return {
    id: String(model.id ?? ""),
    name: String(model.name ?? ""),
    model: String(model.model ?? ""),
    dailyLimit: Number(model.dailyLimit ?? 0),
    enabled: Boolean(model.enabled)
  };
}

async function getAiUsageMap(userUid, models) {
  const uid = normalizeUid(userUid);
  if (!uid || !Array.isArray(models) || models.length === 0) return new Map();
  const ids = models.map((item) => String(item.id ?? "")).filter(Boolean);
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await dbPool.query(
    `SELECT model_id, used_count FROM ai_usage_daily WHERE user_uid = ? AND usage_date = CURRENT_DATE AND model_id IN (${placeholders})`,
    [uid, ...ids]
  );
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    map.set(String(row.model_id ?? ""), Number(row.used_count ?? 0));
  }
  return map;
}

function toPublicAiModelWithUsage(model, usedCount) {
  const dailyLimit = Number(model.dailyLimit ?? 0);
  const used = Math.max(0, Number(usedCount ?? 0));
  return {
    ...toPublicAiModel(model),
    usedCount: used,
    remainingCount: dailyLimit > 0 ? Math.max(0, dailyLimit - used) : null
  };
}

function toAdminAiConfig(config) {
  return {
    defaultModelId: config.defaultModelId,
    prompts: config.prompts,
    models: config.models.map((model) => ({ ...model }))
  };
}

function pickAiModel(config, requestedModelId) {
  const enabled = config.models.filter((item) => item.enabled);
  const requested = normalizeAiModelId(requestedModelId);
  return enabled.find((item) => item.id === requested)
    || enabled.find((item) => item.id === config.defaultModelId)
    || enabled[0]
    || null;
}

function renderAiPrompt(template, question) {
  const value = String(template ?? "");
  return value.includes("{{question}}") ? value.replace(/\{\{question\}\}/g, question) : `${value}\n\n${question}`;
}

async function reserveAiUsage(userUid, modelConfig) {
  const uid = normalizeUid(userUid);
  const modelId = normalizeAiModelId(modelConfig?.id);
  const dailyLimit = Number(modelConfig?.dailyLimit ?? 0);
  if (!uid || !modelId || dailyLimit <= 0) return;

  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `
        INSERT INTO ai_usage_daily (user_uid, model_id, usage_date, used_count)
        VALUES (?, ?, CURRENT_DATE, 0)
        ON DUPLICATE KEY UPDATE used_count = used_count
      `,
      [uid, modelId]
    );
    const [rows] = await connection.query(
      "SELECT used_count FROM ai_usage_daily WHERE user_uid = ? AND model_id = ? AND usage_date = CURRENT_DATE FOR UPDATE",
      [uid, modelId]
    );
    const usedCount = Number(rows?.[0]?.used_count ?? 0);
    if (usedCount >= dailyLimit) {
      await connection.rollback();
      const err = new Error("AI_DAILY_LIMIT_EXCEEDED");
      err.statusCode = 429;
      err.dailyLimit = dailyLimit;
      err.usedCount = usedCount;
      err.remainingCount = 0;
      throw err;
    }
    await connection.query(
      "UPDATE ai_usage_daily SET used_count = used_count + 1 WHERE user_uid = ? AND model_id = ? AND usage_date = CURRENT_DATE",
      [uid, modelId]
    );
    await connection.commit();
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    connection.release();
  }
}

async function refundAiUsage(userUid, modelConfig) {
  const uid = normalizeUid(userUid);
  const modelId = normalizeAiModelId(modelConfig?.id);
  const dailyLimit = Number(modelConfig?.dailyLimit ?? 0);
  if (!uid || !modelId || dailyLimit <= 0) return;
  await dbPool.query(
    "UPDATE ai_usage_daily SET used_count = GREATEST(used_count - 1, 0) WHERE user_uid = ? AND model_id = ? AND usage_date = CURRENT_DATE",
    [uid, modelId]
  );
}

async function requestAiAssist({ mode, question, user, modelId }) {
  const config = await getAiConfig();
  const effectiveModelId = modelId || user?.ai_model_id;
  const modelConfig = pickAiModel(config, effectiveModelId);
  if (!modelConfig?.apiKey) {
    throw new Error("AI config missing enabled model/apiKey");
  }

  await reserveAiUsage(user?.uid, modelConfig);
  const systemPrompt = mode === "solution" ? config.prompts.solutionSystemPrompt : config.prompts.hintSystemPrompt;
  const userPromptTemplate = mode === "solution" ? config.prompts.solutionUserPrompt : config.prompts.hintUserPrompt;
  const userPrompt = renderAiPrompt(userPromptTemplate, question);
  const endpoint = `${modelConfig.baseUrl.replace(/\/$/, "")}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.model,
        temperature: 0,
        top_p: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(payload?.error?.message ?? payload?.message ?? `ai request failed (HTTP ${response.status})`).trim();
      throw new Error(message || `ai request failed (HTTP ${response.status})`);
    }

    const content = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      throw new Error("AI returned empty content");
    }
    return content;
  } catch (err) {
    await refundAiUsage(user?.uid, modelConfig);
    throw err;
  }
}

function buildCpoauthAuthorizeUrl(config, state) {
  const authorizeUrl = new URL("/oauth/authorize", env.cpoauthBaseUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.callbackUrl);
  authorizeUrl.searchParams.set("scope", config.scope);
  authorizeUrl.searchParams.set("state", state);
  return authorizeUrl.toString();
}

function pickOauthErrorMessage(payload, fallback) {
  const errorDescription = String(payload?.error_description ?? "").trim();
  if (errorDescription) return errorDescription;

  const message = String(payload?.message ?? "").trim();
  if (message) return message;

  const error = payload?.error;
  if (typeof error === "string" && error.trim()) return error.trim();

  return fallback;
}

async function exchangeCpoauthToken({ code, clientId, clientSecret, callbackUrl }) {
  const response = await fetch(new URL("/api/oauth/token", env.cpoauthBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(pickOauthErrorMessage(payload, `token exchange failed (HTTP ${response.status})`));
  }
  const accessToken = String(payload?.access_token ?? "").trim();
  if (!accessToken) {
    throw new Error("token exchange failed: empty access_token");
  }
  return accessToken;
}

async function fetchCpoauthUserInfo(accessToken) {
  const response = await fetch(new URL("/api/oauth/userinfo", env.cpoauthBaseUrl), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(pickOauthErrorMessage(payload, `userinfo failed (HTTP ${response.status})`));
  }
  return payload;
}

function sanitizeUsername(rawName) {
  const normalized = String(rawName ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 64);
  if (normalized.length >= 2) return normalized;
  return "cpo-user";
}

function pickDisplayName(profile) {
  const displayName = sanitizeUsername(profile?.display_name);
  if (displayName !== "cpo-user") return displayName;
  const username = sanitizeUsername(profile?.username);
  if (username !== "cpo-user") return username;
  return "CPOAuth 鐢ㄦ埛";
}

async function buildUniqueDisplayName(baseUsername) {
  const base = sanitizeUsername(baseUsername);
  for (let idx = 0; idx < 10000; idx += 1) {
    const suffix = idx === 0 ? "" : `_${idx + 1}`;
    const maxBaseLength = 64 - suffix.length;
    const candidate = `${base.slice(0, maxBaseLength)}${suffix}`;
    const [rows] = await dbPool.query("SELECT id FROM users WHERE name = ? LIMIT 1", [candidate]);
    if (!Array.isArray(rows) || rows.length === 0) return candidate;
  }
  throw new Error("failed to allocate username");
}

async function findOrCreateCpoauthUser(profile) {
  const subject = String(profile?.sub ?? "").trim();
  if (!subject) {
    throw new Error("userinfo missing sub");
  }

  const displayName = pickDisplayName(profile);
  const rawEmail = String(profile?.email ?? "").trim();
  const emailFromOauth = rawEmail && isEmail(rawEmail) ? normalizeEmail(rawEmail) : null;
  const avatarFromOauth = String(profile?.avatar_url ?? "").trim();
  const bioFromOauth = normalizeBio(profile?.bio);
  const fallbackAvatarBySubject = buildGravatarUrl(`cpo-${subject}@auth.luogu.me`);

  const [boundRows] = await dbPool.query(
    "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, is_admin, is_banned, records_public, created_at FROM users WHERE oauth_provider = ? AND oauth_subject = ? LIMIT 1",
    ["cpoauth", subject]
  );
  if (Array.isArray(boundRows) && boundRows.length > 0) {
    const boundUser = boundRows[0];

    let mergedEmail = emailFromOauth;
    if (mergedEmail) {
      const [emailRows] = await dbPool.query(
        "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
        [mergedEmail, Number(boundUser.id)]
      );
      if (Array.isArray(emailRows) && emailRows.length > 0) {
        mergedEmail = null;
      }
    }
    if (!mergedEmail) {
      const currentEmail = String(boundUser.email ?? "").trim();
      mergedEmail = currentEmail && isEmail(currentEmail) ? normalizeEmail(currentEmail) : null;
    }

    const mergedAvatar = avatarFromOauth
      || (mergedEmail ? buildGravatarUrl(mergedEmail) : fallbackAvatarBySubject);

    await dbPool.query(
      "UPDATE users SET name = ?, email = ?, avatar_url = ?, bio = ? WHERE id = ?",
      [displayName, mergedEmail, mergedAvatar, bioFromOauth || null, Number(boundUser.id)]
    );

    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, is_admin, is_banned, records_public, created_at FROM users WHERE id = ? LIMIT 1",
      [Number(boundUser.id)]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("bound user not found");
    }
    return toPublicUser(rows[0]);
  }

  const cpoUsername = normalizeUid(profile?.username);
  if (!isValidUid(cpoUsername)) {
    throw new Error("userinfo missing valid username");
  }

  const [uidRows] = await dbPool.query("SELECT id FROM users WHERE uid = ? LIMIT 1", [cpoUsername]);
  if (Array.isArray(uidRows) && uidRows.length > 0) {
    throw new Error(`uid already exists: ${cpoUsername}`);
  }

  const username = await buildUniqueDisplayName(displayName);
  const avatarUrl = avatarFromOauth
    || (emailFromOauth ? buildGravatarUrl(emailFromOauth) : fallbackAvatarBySubject);
  const profileCoverUrl = pickDefaultProfileCover();

  try {
    const [result] = await dbPool.query(
      "INSERT INTO users (uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, oauth_provider, oauth_subject) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [cpoUsername, username, emailFromOauth, avatarUrl, profileCoverUrl, bioFromOauth || null, await getDefaultAiModelId(), "cpoauth", subject]
    );

    const userId = Number(result.insertId);
    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, is_admin, is_banned, records_public, created_at FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("created user not found");
    }
    return toPublicUser(rows[0]);
  } catch (err) {
    const message = String(err?.message ?? "");
    if (!message.includes("Duplicate entry")) throw err;
    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, is_admin, is_banned, records_public, created_at FROM users WHERE oauth_provider = ? AND oauth_subject = ? LIMIT 1",
      ["cpoauth", subject]
    );
    if (!Array.isArray(rows) || rows.length === 0) throw err;
    return toPublicUser(rows[0]);
  }
}

async function getAdminByHeader(req) {
  const adminUid = String(req.header("x-admin-uid") ?? "").trim();
  if (!adminUid) return null;

  if (adminUid === "root") {
    const adminToken = String(req.header("x-admin-token") ?? "").trim();
    if (!isValidAdminToken(adminToken)) return null;
    const [tokenRows] = await dbPool.query(
      "SELECT id FROM admin_tokens WHERE BINARY token = ? LIMIT 1",
      [adminToken]
    );
    if (!Array.isArray(tokenRows) || tokenRows.length === 0) return null;
    return {
      id: 0,
      uid: "root",
      is_admin: 1,
      is_banned: 0
    };
  }

  const [rows] = await dbPool.query(
    "SELECT id, uid, is_admin, is_banned FROM users WHERE uid = ? LIMIT 1",
    [adminUid]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const admin = rows[0];
  if (!admin.is_admin || admin.is_banned) return null;
  return admin;
}

async function requireAdmin(req, res) {
  const admin = await getAdminByHeader(req);
  if (!admin) {
    res.status(403).json({ error: "admin permission required" });
    return null;
  }
  return admin;
}

async function getUserByHeader(req) {
  const uid = normalizeUid(req.header("x-user-uid"));
  if (!uid) return null;
  const [rows] = await dbPool.query(
    "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, is_admin, is_banned, records_public, created_at FROM users WHERE uid = ? LIMIT 1",
    [uid]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function requireUser(req, res) {
  const user = await getUserByHeader(req);
  if (!user) {
    res.status(401).json({ error: "login required" });
    return null;
  }
  if (user.is_banned) {
    res.status(403).json({ error: "该用户已被封禁。" });
    return null;
  }
  return user;
}

async function requireSelfOrAdmin(req, res, targetUid) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.uid === targetUid || user.is_admin) return user;
  res.status(403).json({ error: "permission denied" });
  return null;
}

function parseBooleanInput(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
      return false;
    }
  }
  return fallback;
}

async function getNextProblemsetIdByType(problemsetType) {
  let minId = 1000;
  let maxId = 99999;
  if (problemsetType === PROBLEMSET_TYPES.personal_featured || problemsetType === PROBLEMSET_TYPES.personal_public) {
    minId = 100000;
    maxId = 999999;
  } else if (problemsetType === PROBLEMSET_TYPES.personal_private) {
    minId = 1000000;
    maxId = 999999999;
  }

  const [rows] = await dbPool.query(
    `
      SELECT GREATEST(
        COALESCE((SELECT MAX(id) FROM problemsets WHERE id BETWEEN ? AND ?), ?),
        COALESCE((SELECT MAX(problemset_id) FROM questions WHERE problemset_id BETWEEN ? AND ?), ?)
      ) AS max_id
    `,
    [minId, maxId, minId - 1, minId, maxId, minId - 1]
  );
  return Number(rows[0]?.max_id ?? minId - 1) + 1;
}

async function getProblemsetById(problemsetId) {
  const [rows] = await dbPool.query(
    "SELECT id, title, description, duration_minutes, question_config, created_by_uid, problemset_type FROM problemsets WHERE id = ? LIMIT 1",
    [problemsetId]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

function safeJsonParse(raw, fallback) {
  try {
    if (raw === null || raw === undefined || raw === "") return fallback;
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

function toSubmissionSummary(row) {
  return {
    id: Number(row.id),
    userUid: String(row.user_uid ?? ""),
    problemsetId: Number(row.problemset_id),
    problemsetTitle: row.problemset_title !== undefined ? String(row.problemset_title ?? "") : "",
    mode: String(row.mode ?? "training"),
    status: String(row.status ?? "submitted"),
    score: Number(row.score ?? 0),
    maxScore: Number(row.max_score ?? 0),
    remainingSeconds: row.remaining_seconds === null || row.remaining_seconds === undefined
      ? null
      : Number(row.remaining_seconds),
    startedAt: row.started_at ?? null,
    submittedAt: row.submitted_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function toSubmissionDetail(row) {
  return {
    ...toSubmissionSummary(row),
    answers: safeJsonParse(row.answers_json, {}),
    results: safeJsonParse(row.results_json, [])
  };
}

function normalizeSubmissionAnswers(rawAnswers) {
  const source = rawAnswers && typeof rawAnswers === "object" ? rawAnswers : {};
  const normalized = {};
  for (const [key, value] of Object.entries(source)) {
    normalized[String(key)] = String(value ?? "").trim();
  }
  return normalized;
}

async function calculateSubmission(problemsetId, answersInput) {
  const [rows] = await dbPool.query(
    "SELECT id, question_index, question_type, score, answer FROM questions WHERE problemset_id = ? ORDER BY question_index ASC",
    [problemsetId]
  );
  const answers = normalizeSubmissionAnswers(answersInput);
  let score = 0;
  let maxScore = 0;
  const results = [];

  for (const row of rows) {
    const questionId = String(row.id);
    const questionType = String(row.question_type ?? "option");
    const standardAnswer = String(row.answer ?? "").trim();
    const userAnswer = String(answers[questionId] ?? "").trim();
    const weight = Number(row.score ?? 0);
    maxScore += weight;

    let correct = false;
    if (questionType === "option") {
      correct = normalizeQuestionAnswer(userAnswer) === normalizeQuestionAnswer(standardAnswer);
    } else {
      correct = userAnswer === standardAnswer;
    }
    const earned = correct ? weight : 0;
    score += earned;
    results.push({
      questionId,
      questionIndex: Number(row.question_index),
      questionType,
      userAnswer,
      standardAnswer,
      correct,
      earned
    });
  }

  return {
    answers,
    results,
    score: Number(score.toFixed(2)),
    maxScore: Number(maxScore.toFixed(2))
  };
}

export function buildRouter() {
  const router = express.Router();

  router.get("/health", async (_req, res) => {
    try {
      await Promise.all([pingDb(), pingRedis()]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err?.message ?? err) });
    }
  });

  router.get("/site-content", async (_req, res) => {
    const content = await getSitePublicContent();
    return res.json(content);
  });

  router.get("/system-pages/:slug", async (req, res) => {
    const slug = normalizeSystemPageSlug(req.params.slug);
    if (!slug) {
      return res.status(400).json({ error: "invalid system page slug" });
    }
    const page = await getSystemPageBySlug(slug);
    if (!page) {
      return res.status(404).json({ error: "system page not found" });
    }
    return res.json({ page: toSystemPage(page) });
  });

  router.get("/problemsets", async (req, res) => {
    const actor = await getUserByHeader(req);
    const tab = parseProblemsetListTab(req.query?.tab);

    let whereClause = "WHERE p.problemset_type = 'official_public'";
    const params = [];

    if (tab === "featured") {
      whereClause = "WHERE p.problemset_type = 'personal_featured'";
    } else if (tab === "all") {
      if (actor?.is_admin) {
        whereClause = "";
      } else if (actor?.uid) {
        whereClause = "WHERE p.problemset_type <> 'personal_private' OR p.created_by_uid = ?";
        params.push(String(actor.uid));
      } else {
        whereClause = "WHERE p.problemset_type <> 'personal_private'";
      }
    }

    const [rows] = await dbPool.query(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.duration_minutes,
        p.problemset_type,
        p.created_by_uid,
        COALESCE(COUNT(q.id), 0) AS question_count
      FROM problemsets p
      LEFT JOIN questions q ON q.problemset_id = p.id
      ${whereClause}
      GROUP BY p.id, p.title, p.description, p.duration_minutes, p.problemset_type, p.created_by_uid
      ORDER BY p.id ASC
    `,
      params
    );
    return res.json({
      problemsets: rows.map((row) => toProblemsetSummary(row))
    });
  });

  router.get("/problemsets/search", async (req, res) => {
    const keyword = String(req.query?.q ?? "").trim();
    if (!keyword) {
      return res.json({ problemsets: [] });
    }

    const escapedKeyword = keyword.replace(/[\\%_]/g, "\\$&");
    const fuzzyKeyword = `%${escapedKeyword}%`;
    const titlePrefixKeyword = `${escapedKeyword}%`;
    const exactId = Number.isInteger(Number(keyword)) && Number(keyword) > 0 ? Number(keyword) : 0;

    const [rows] = await dbPool.query(
      `
        SELECT
          p.id,
          p.title,
          p.description,
          p.duration_minutes,
          p.problemset_type,
          p.created_by_uid,
          COALESCE(COUNT(q.id), 0) AS question_count
        FROM problemsets p
        LEFT JOIN questions q ON q.problemset_id = p.id
        WHERE p.problemset_type IN ('official_public', 'personal_featured', 'personal_public')
          AND (
            p.title LIKE ?
            OR p.description LIKE ?
            OR p.created_by_uid LIKE ?
            OR CAST(p.id AS CHAR) LIKE ?
          )
        GROUP BY p.id, p.title, p.description, p.duration_minutes, p.problemset_type, p.created_by_uid
        ORDER BY
          CASE
            WHEN ? > 0 AND p.id = ? THEN 0
            WHEN p.title LIKE ? THEN 1
            WHEN p.created_by_uid LIKE ? THEN 2
            ELSE 3
          END,
          p.id ASC
        LIMIT 100
      `,
      [
        fuzzyKeyword,
        fuzzyKeyword,
        fuzzyKeyword,
        fuzzyKeyword,
        exactId,
        exactId,
        titlePrefixKeyword,
        titlePrefixKeyword
      ]
    );

    return res.json({
      problemsets: rows.map((row) => toProblemsetSummary(row))
    });
  });

  router.get("/problemsets/:id", async (req, res) => {
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }

    const actor = await getUserByHeader(req);
    const [summaryRows] = await dbPool.query(
      "SELECT id, title, description, duration_minutes, problemset_type, created_by_uid FROM problemsets WHERE id = ? LIMIT 1",
      [problemsetId]
    );
    if (!Array.isArray(summaryRows) || summaryRows.length === 0) {
      return res.status(404).json({ error: "problemset not found" });
    }
    const problemsetRow = summaryRows[0];
    if (!canUserViewProblemset(problemsetRow, actor)) {
      return res.status(403).json({ error: "无权访问该题目。" });
    }

    const [questionRows] = await dbPool.query(
      "SELECT id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis FROM questions WHERE problemset_id = ? ORDER BY question_index ASC",
      [problemsetId]
    );

    const summary = summaryRows[0];
    return res.json({
      summary: {
        id: Number(summary.id),
        title: summary.title,
        description: summary.description,
        questionCount: questionRows.length,
        durationHours: Number(summary.duration_minutes ?? 120) / 60,
        problemsetType: String(summary.problemset_type ?? "official_public"),
        createdByUid: String(summary.created_by_uid ?? "")
      },
      questions: questionRows.map(toQuestion)
    });
  });

  router.post("/problemsets", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const title = String(req.body?.title ?? "").trim();
      const description = String(req.body?.description ?? "").trim();
      const durationMinutes = Number(req.body?.durationMinutes ?? 120);
      const requestedId = req.body?.id;
      const questionConfig = String(req.body?.questionConfig ?? "");
      const typeRaw = req.body?.problemsetType;
      const problemsetType = normalizeProblemsetType(typeRaw) || PROBLEMSET_TYPES.official_public;

      if (!user.is_admin && (problemsetType === PROBLEMSET_TYPES.official_public || problemsetType === PROBLEMSET_TYPES.personal_featured)) {
        return res.status(403).json({ error: "普通用户仅可创建个人公开/个人私有题目" });
      }

      if (!title) {
        return res.status(400).json({ error: "title is required" });
      }
      if (!description) {
        return res.status(400).json({ error: "description is required" });
      }
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return res.status(400).json({ error: "durationMinutes must be positive" });
      }

      const parsed = parseQuestionConfig(questionConfig);
      if (parsed.errors.length > 0) {
        return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });
      }

      let problemsetId = Number(requestedId);
      if (Number.isFinite(problemsetId)) {
        if (!user.is_admin) {
          return res.status(403).json({ error: "only admin can set custom problemset id" });
        }
        if (!Number.isInteger(problemsetId) || problemsetId <= 0) {
          return res.status(400).json({ error: "id must be a positive integer" });
        }
      } else {
        problemsetId = await getNextProblemsetIdByType(problemsetType);
      }

      const [idRows] = await dbPool.query(
        "SELECT id FROM problemsets WHERE id = ? LIMIT 1",
        [problemsetId]
      );
      if (Array.isArray(idRows) && idRows.length > 0) {
        return res.status(409).json({ error: `problemset id ${problemsetId} already exists` });
      }
      const [questionConflictRows] = await dbPool.query(
        "SELECT id FROM questions WHERE problemset_id = ? LIMIT 1",
        [problemsetId]
      );
      if (Array.isArray(questionConflictRows) && questionConflictRows.length > 0) {
        return res.status(409).json({ error: `problemset id ${problemsetId} is occupied by existing questions` });
      }

      const connection = await dbPool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          "INSERT INTO problemsets (id, title, description, duration_minutes, question_config, created_by_uid, problemset_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [problemsetId, title, description, Math.round(durationMinutes), questionConfig, user.uid, problemsetType]
        );

        for (let index = 0; index < parsed.questions.length; index += 1) {
          const question = parsed.questions[index];
          await connection.query(
            "INSERT INTO questions (problemset_id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              problemsetId,
              index + 1,
              question.type,
              question.materialGroupIndex,
              question.groupQuestionIndex,
              question.groupQuestionCount,
              question.groupTitle || null,
              question.sharedMaterial || null,
              question.stem,
              question.inputPlaceholder,
              JSON.stringify(question.options),
              question.score,
              question.answer,
              question.analysis
            ]
          );
        }
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        const message = String(err?.message ?? "");
        if (message.includes("Duplicate entry")) {
          return res.status(409).json({ error: "problemset id conflict, please retry" });
        }
        return res.status(500).json({ error: "create problemset failed" });
      } finally {
        connection.release();
      }

      return res.status(201).json({
        problemset: {
          id: problemsetId,
          title,
          description,
          questionCount: parsed.questions.length,
          durationHours: Math.round(durationMinutes) / 60,
          problemsetType,
          createdByUid: String(user.uid)
        }
      });
    } catch {
      return res.status(500).json({ error: "create problemset failed" });
    }
  });

  router.get("/problemsets/:id/edit", async (req, res) => {
    const actor = await requireUser(req, res);
    if (!actor) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }
    const problemset = await getProblemsetById(problemsetId);
    if (!problemset) {
      return res.status(404).json({ error: "problemset not found" });
    }
    if (!canUserEditProblemset(problemset, actor)) {
      return res.status(403).json({ error: "permission denied" });
    }
    return res.json({
      problemset: {
        id: Number(problemset.id),
        title: String(problemset.title ?? ""),
        description: String(problemset.description ?? ""),
        durationMinutes: Number(problemset.duration_minutes ?? 120),
        questionConfig: String(problemset.question_config ?? ""),
        problemsetType: String(problemset.problemset_type ?? PROBLEMSET_TYPES.official_public),
        createdByUid: String(problemset.created_by_uid ?? "")
      }
    });
  });

  router.patch("/problemsets/:id", async (req, res) => {
    const actor = await requireUser(req, res);
    if (!actor) return;

    const sourceId = Number(req.params.id);
    if (!Number.isFinite(sourceId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }

    const current = await getProblemsetById(sourceId);
    if (!current) {
      return res.status(404).json({ error: "problemset not found" });
    }
    if (!canUserEditProblemset(current, actor)) {
      return res.status(403).json({ error: "permission denied" });
    }

    const title = String(req.body?.title ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    const durationMinutes = Number(req.body?.durationMinutes ?? 120);
    const questionConfig = String(req.body?.questionConfig ?? "");
    const nextTypeRaw = req.body?.problemsetType;
    const nextType = normalizeProblemsetType(nextTypeRaw) || String(current.problemset_type ?? PROBLEMSET_TYPES.official_public);
    const requestedId = req.body?.id;

    if (!title) return res.status(400).json({ error: "title is required" });
    if (!description) return res.status(400).json({ error: "description is required" });
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res.status(400).json({ error: "durationMinutes must be positive" });
    }

    if (!actor.is_admin && (nextType === PROBLEMSET_TYPES.official_public || nextType === PROBLEMSET_TYPES.personal_featured)) {
      return res.status(403).json({ error: "普通用户仅可设置个人公开/个人私有" });
    }

    const parsed = parseQuestionConfig(questionConfig);
    if (parsed.errors.length > 0) {
      return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });
    }

    let targetId = sourceId;
    if (requestedId !== undefined && requestedId !== null && String(requestedId).trim() !== "") {
      if (!actor.is_admin) {
        return res.status(403).json({ error: "only admin can change problemset id" });
      }
      const nextId = Number(requestedId);
      if (!Number.isInteger(nextId) || nextId <= 0) {
        return res.status(400).json({ error: "id must be a positive integer" });
      }
      targetId = nextId;
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      if (targetId !== sourceId) {
        const [idRows] = await connection.query("SELECT id FROM problemsets WHERE id = ? LIMIT 1", [targetId]);
        if (Array.isArray(idRows) && idRows.length > 0) {
          await connection.rollback();
          return res.status(409).json({ error: `problemset id ${targetId} already exists` });
        }
      }

      await connection.query(
        "UPDATE problemsets SET id = ?, title = ?, description = ?, duration_minutes = ?, question_config = ?, problemset_type = ? WHERE id = ?",
        [targetId, title, description, Math.round(durationMinutes), questionConfig, nextType, sourceId]
      );

      if (targetId !== sourceId) {
        await connection.query("UPDATE questions SET problemset_id = ? WHERE problemset_id = ?", [targetId, sourceId]);
      }

      await connection.query("DELETE FROM questions WHERE problemset_id = ?", [targetId]);
      for (let index = 0; index < parsed.questions.length; index += 1) {
        const question = parsed.questions[index];
        await connection.query(
          "INSERT INTO questions (problemset_id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            targetId,
            index + 1,
            question.type,
            question.materialGroupIndex,
            question.groupQuestionIndex,
            question.groupQuestionCount,
            question.groupTitle || null,
            question.sharedMaterial || null,
            question.stem,
            question.inputPlaceholder,
            JSON.stringify(question.options),
            question.score,
            question.answer,
            question.analysis
          ]
        );
      }

      await connection.commit();
      return res.json({
        problemset: {
          id: targetId,
          title,
          description,
          questionCount: parsed.questions.length,
          durationHours: Math.round(durationMinutes) / 60,
          problemsetType: nextType,
          createdByUid: String(current.created_by_uid ?? "")
        }
      });
    } catch (err) {
      await connection.rollback();
      const message = String(err?.message ?? "");
      if (message.includes("Duplicate entry")) {
        return res.status(409).json({ error: "problemset id conflict" });
      }
      return res.status(500).json({ error: "update problemset failed" });
    } finally {
      connection.release();
    }
  });

  router.delete("/problemsets/:id", async (req, res) => {
    const actor = await requireUser(req, res);
    if (!actor) return;

    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }

    const current = await getProblemsetById(problemsetId);
    if (!current) {
      return res.status(404).json({ error: "problemset not found" });
    }
    if (!canUserEditProblemset(current, actor)) {
      return res.status(403).json({ error: "permission denied" });
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("DELETE FROM questions WHERE problemset_id = ?", [problemsetId]);
      const [result] = await connection.query("DELETE FROM problemsets WHERE id = ?", [problemsetId]);
      await connection.commit();
      if (!result?.affectedRows) {
        return res.status(404).json({ error: "problemset not found" });
      }
      return res.status(204).send();
    } catch {
      await connection.rollback();
      return res.status(500).json({ error: "delete problemset failed" });
    } finally {
      connection.release();
    }
  });

  router.get("/users", async (_req, res) => {
    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, is_admin, is_banned, records_public, created_at FROM users ORDER BY id ASC LIMIT 100"
    );
    res.json({ users: rows.map(toPublicUser) });
  });

  router.get("/users/_me/settings", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const aiConfig = await getAiConfig();
    const aiModel = pickAiModel(aiConfig, user.ai_model_id);
    return res.json({
      settings: {
        recordsPublic: Boolean(user.records_public),
        profileCoverUrl: String(user.profile_cover_url ?? ""),
        submissionAnalysisMode: normalizeSubmissionAnalysisMode(user.submission_analysis_mode, "wrong_only"),
        autosaveIntervalSeconds: normalizeAutosaveIntervalSeconds(user.autosave_interval_seconds, 30),
        aiModelId: aiModel?.id || aiConfig.defaultModelId
      },
      user: toPublicUser(user)
    });
  });

  router.patch("/users/_me/settings", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const recordsPublic = parseBooleanInput(req.body?.recordsPublic, Boolean(user.records_public));
    const profileCoverUrlInput = String(req.body?.profileCoverUrl ?? "").trim();
    const profileCoverUrl = profileCoverUrlInput || pickDefaultProfileCover();
    const submissionAnalysisMode = normalizeSubmissionAnalysisMode(req.body?.submissionAnalysisMode, normalizeSubmissionAnalysisMode(user.submission_analysis_mode, "wrong_only"));
    const autosaveIntervalSeconds = normalizeAutosaveIntervalSeconds(
      req.body?.autosaveIntervalSeconds,
      normalizeAutosaveIntervalSeconds(user.autosave_interval_seconds, 30)
    );
    const aiConfig = await getAiConfig();
    const requestedAiModelId = normalizeAiModelId(req.body?.aiModelId);
    const availableModel = requestedAiModelId ? pickAiModel(aiConfig, requestedAiModelId) : null;
    if (aiConfig.models.length > 0 && (!requestedAiModelId || !availableModel || availableModel.id !== requestedAiModelId)) {
      return res.status(400).json({ error: "请选择一个可用的默认 AI 模型。" });
    }
    if (profileCoverUrlInput && !isHttpUrl(profileCoverUrlInput)) {
      return res.status(400).json({ error: "profileCoverUrl 必须是 http(s) 地址，或留空。" });
    }

    await dbPool.query(
      "UPDATE users SET records_public = ?, profile_cover_url = ?, submission_analysis_mode = ?, autosave_interval_seconds = ?, ai_model_id = ? WHERE id = ?",
      [recordsPublic ? 1 : 0, profileCoverUrl, submissionAnalysisMode, autosaveIntervalSeconds, aiConfig.models.length > 0 ? requestedAiModelId : "", Number(user.id)]
    );

    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, is_admin, is_banned, records_public, created_at FROM users WHERE id = ? LIMIT 1",
      [Number(user.id)]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "user not found" });
    }

    const resolvedAiModel = pickAiModel(aiConfig, rows[0].ai_model_id);
    return res.json({
      settings: {
        recordsPublic: Boolean(rows[0].records_public),
        profileCoverUrl: String(rows[0].profile_cover_url ?? ""),
        submissionAnalysisMode: normalizeSubmissionAnalysisMode(rows[0].submission_analysis_mode, "wrong_only"),
        autosaveIntervalSeconds: normalizeAutosaveIntervalSeconds(rows[0].autosave_interval_seconds, 30),
        aiModelId: resolvedAiModel?.id || aiConfig.defaultModelId
      },
      user: toPublicUser(rows[0])
    });
  });

  router.get("/users/:uid", async (req, res) => {
    const uid = normalizeUid(req.params.uid);
    if (!uid) {
      return res.status(400).json({ error: "uid is required" });
    }
    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, is_admin, is_banned, records_public, created_at FROM users WHERE uid = ? LIMIT 1",
      [uid]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "user not found" });
    }
    return res.json({ user: toPublicUser(rows[0]) });
  });

  router.get("/users/:uid/problemsets", async (req, res) => {
    const targetUid = normalizeUid(req.params.uid);
    if (!targetUid) {
      return res.status(400).json({ error: "uid is required" });
    }
    const actor = await getUserByHeader(req);
    const canSeePrivate = Boolean(actor?.is_admin) || String(actor?.uid ?? "") === targetUid;
    const [rows] = await dbPool.query(
      `
        SELECT
          p.id,
          p.title,
          p.description,
          p.duration_minutes,
          p.problemset_type,
          p.created_by_uid,
          p.created_at,
          COALESCE(COUNT(q.id), 0) AS question_count
        FROM problemsets p
        LEFT JOIN questions q ON q.problemset_id = p.id
        WHERE p.created_by_uid = ?
          AND (p.problemset_type <> 'personal_private' OR ?)
        GROUP BY p.id, p.title, p.description, p.duration_minutes, p.problemset_type, p.created_by_uid, p.created_at
        ORDER BY p.id DESC
      `,
      [targetUid, canSeePrivate ? 1 : 0]
    );
    return res.json({ problemsets: rows.map((row) => toProblemsetSummary(row)) });
  });

  router.post("/auth/admin-token/session", async (req, res) => {
    const token = String(req.body?.token ?? "").trim();
    if (!isValidAdminToken(token)) {
      return res.status(400).json({ error: "token must be 32 chars with A-Z a-z 0-9" });
    }

    const [rows] = await dbPool.query(
      "SELECT id FROM admin_tokens WHERE BINARY token = ? LIMIT 1",
      [token]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(401).json({ error: "鏃犳晥鐨凾oken" });
    }

    return res.status(201).json({
      session: {
        user: toRootUser()
      }
    });
  });

  router.get("/oauth/cpoauth/authorize", async (req, res) => {
    const config = await getCpoauthConfig(req);
    if (!config.clientId || !config.clientSecret) {
      return res.status(503).json({ error: "cpoauth is not configured" });
    }
    if (!isHttpUrl(config.callbackUrl)) {
      return res.status(503).json({ error: "invalid cpoauth callback url" });
    }

    const state = randomBytes(24).toString("hex");
    const returnTo = normalizeReturnTo(req.query?.returnTo);
    const webBaseUrl = resolveWebBaseUrl(req, req.query?.webBaseUrl);
    await pingRedis();
    await redis.set(`oauth:cpoauth:state:${state}`, JSON.stringify({ returnTo, webBaseUrl }), "EX", 600);
    return res.redirect(302, buildCpoauthAuthorizeUrl(config, state));
  });

  router.get("/oauth/cpoauth/callback", async (req, res) => {
    const loginCallbackUrl = new URL("/auth/cpoauth/callback", resolveWebBaseUrl(req));
    const oauthError = String(req.query?.error ?? "").trim();
    const oauthErrorDescription = String(req.query?.error_description ?? req.query?.message ?? "").trim();
    if (oauthError) {
      loginCallbackUrl.searchParams.set(
        "error",
        oauthErrorDescription || (oauthError === "true" ? "cpoauth authorize failed" : oauthError)
      );
      return res.redirect(302, loginCallbackUrl.toString());
    }

    const code = String(req.query?.code ?? "").trim();
    const state = String(req.query?.state ?? "").trim();
    if (!code || !state) {
      loginCallbackUrl.searchParams.set("error", "missing_code_or_state");
      return res.redirect(302, loginCallbackUrl.toString());
    }

    await pingRedis();
    const stateKey = `oauth:cpoauth:state:${state}`;
    const statePayloadRaw = await redis.get(stateKey);
    await redis.del(stateKey);
    if (!statePayloadRaw) {
      loginCallbackUrl.searchParams.set("error", "invalid_state");
      return res.redirect(302, loginCallbackUrl.toString());
    }

    let statePayload = {};
    try {
      statePayload = JSON.parse(statePayloadRaw);
    } catch {
      loginCallbackUrl.searchParams.set("error", "invalid_state_payload");
      return res.redirect(302, loginCallbackUrl.toString());
    }
    const returnTo = normalizeReturnTo(statePayload?.returnTo);
    const webBaseUrl = resolveWebBaseUrl(req, statePayload?.webBaseUrl);
    loginCallbackUrl.href = new URL("/auth/cpoauth/callback", webBaseUrl).toString();

    try {
      const config = await getCpoauthConfig(req);
      if (!config.clientId || !config.clientSecret || !isHttpUrl(config.callbackUrl)) {
        throw new Error("cpoauth is not configured");
      }

      const accessToken = await exchangeCpoauthToken({
        code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        callbackUrl: config.callbackUrl
      });
      const profile = await fetchCpoauthUserInfo(accessToken);
      const user = await findOrCreateCpoauthUser(profile);
      if (user.isBanned) {
        throw new Error("user is banned");
      }

      const ticket = randomBytes(24).toString("hex");
      await redis.set(`oauth:cpoauth:ticket:${ticket}`, JSON.stringify({ uid: user.uid, returnTo }), "EX", 120);

      loginCallbackUrl.searchParams.set("ticket", ticket);
      loginCallbackUrl.searchParams.set("returnTo", returnTo);
      return res.redirect(302, loginCallbackUrl.toString());
    } catch (err) {
      loginCallbackUrl.searchParams.set("error", String(err?.message ?? err));
      return res.redirect(302, loginCallbackUrl.toString());
    }
  });

  router.post("/oauth/cpoauth/session", async (req, res) => {
    const ticket = String(req.body?.ticket ?? "").trim();
    if (!ticket) {
      return res.status(400).json({ error: "ticket is required" });
    }

    await pingRedis();
    const key = `oauth:cpoauth:ticket:${ticket}`;
    const payloadRaw = await redis.get(key);
    await redis.del(key);
    if (!payloadRaw) {
      return res.status(401).json({ error: "invalid or expired ticket" });
    }

    let payload = {};
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return res.status(401).json({ error: "invalid ticket payload" });
    }
    const uid = normalizeUid(payload?.uid);
    const returnTo = normalizeReturnTo(payload?.returnTo);

    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, is_admin, is_banned, records_public, created_at FROM users WHERE uid = ? LIMIT 1",
      [uid]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "user not found" });
    }
    if (rows[0].is_banned) {
      return res.status(403).json({ error: "user is banned" });
    }

    return res.status(201).json({
      session: {
        user: toPublicUser(rows[0]),
        returnTo
      }
    });
  });

  router.get("/problemsets/:id/questions", async (req, res) => {
    const actor = await getUserByHeader(req);
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }
    const problemset = await getProblemsetById(problemsetId);
    if (!problemset) {
      return res.status(404).json({ error: "problemset not found" });
    }
    if (!canUserViewProblemset(problemset, actor)) {
      return res.status(403).json({ error: "无权访问该题目。" });
    }
    const [rows] = await dbPool.query(
      "SELECT id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis FROM questions WHERE problemset_id = ? ORDER BY question_index ASC",
      [problemsetId]
    );
    return res.json({ questions: rows.map(toQuestion) });
  });

  router.get("/problemsets/:id/submissions", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }
    const problemset = await getProblemsetById(problemsetId);
    if (!problemset) {
      return res.status(404).json({ error: "problemset not found" });
    }
    if (!canUserViewProblemset(problemset, user)) {
      return res.status(403).json({ error: "无权访问该题目。" });
    }

    const [historyRows] = await dbPool.query(
      `
        SELECT s.*, p.title AS problemset_title
        FROM submissions s
        LEFT JOIN problemsets p ON p.id = s.problemset_id
        WHERE s.user_uid = ? AND s.problemset_id = ? AND s.status = 'submitted'
        ORDER BY COALESCE(s.submitted_at, s.updated_at, s.created_at) DESC
      `,
      [user.uid, problemsetId]
    );
    const [activeRows] = await dbPool.query(
      `
        SELECT s.*, p.title AS problemset_title
        FROM submissions s
        LEFT JOIN problemsets p ON p.id = s.problemset_id
        WHERE s.user_uid = ? AND s.problemset_id = ? AND s.mode = 'exam' AND s.status IN ('in_progress', 'paused')
        ORDER BY s.updated_at DESC
        LIMIT 1
      `,
      [user.uid, problemsetId]
    );

    return res.json({
      submissions: historyRows.map(toSubmissionSummary),
      activeExam: Array.isArray(activeRows) && activeRows.length > 0 ? toSubmissionSummary(activeRows[0]) : null
    });
  });

  router.get("/submissions/:id", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const submissionId = Number(req.params.id);
    if (!Number.isFinite(submissionId)) {
      return res.status(400).json({ error: "invalid submission id" });
    }

    const [rows] = await dbPool.query(
      `
        SELECT s.*, p.title AS problemset_title
        FROM submissions s
        LEFT JOIN problemsets p ON p.id = s.problemset_id
        WHERE s.id = ?
        LIMIT 1
      `,
      [submissionId]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "submission not found" });
    }
    const submission = rows[0];
    if (submission.user_uid !== user.uid && !user.is_admin) {
      return res.status(403).json({ error: "permission denied" });
    }
    return res.json({ submission: toSubmissionDetail(submission) });
  });

  router.post("/problemsets/:id/exam/start", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }
    const forceNew = req.body?.forceNew === true;

    const problemset = await getProblemsetById(problemsetId);
    if (!problemset) {
      return res.status(404).json({ error: "problemset not found" });
    }
    if (!canUserViewProblemset(problemset, user)) {
      return res.status(403).json({ error: "无权访问该题目。" });
    }

    const [activeRows] = await dbPool.query(
      "SELECT * FROM submissions WHERE user_uid = ? AND mode = 'exam' AND status IN ('in_progress', 'paused') ORDER BY updated_at DESC LIMIT 1",
      [user.uid]
    );
    if (Array.isArray(activeRows) && activeRows.length > 0 && !forceNew) {
      return res.status(409).json({
        error: "active exam exists",
        activeExam: toSubmissionSummary(activeRows[0])
      });
    }
    if (Array.isArray(activeRows) && activeRows.length > 0 && forceNew) {
      await dbPool.query(
        "UPDATE submissions SET status = 'replaced' WHERE user_uid = ? AND mode = 'exam' AND status IN ('in_progress', 'paused')",
        [user.uid]
      );
    }

    const [scoreRows] = await dbPool.query(
      "SELECT COALESCE(SUM(score), 0) AS max_score FROM questions WHERE problemset_id = ?",
      [problemsetId]
    );
    const maxScore = Number(scoreRows[0]?.max_score ?? 0);
    const remainingSeconds = Math.max(60, Number(problemset?.duration_minutes ?? 120) * 60);

    const [result] = await dbPool.query(
      `
        INSERT INTO submissions (
          user_uid, problemset_id, mode, status, answers_json, results_json,
          score, max_score, remaining_seconds, started_at
        ) VALUES (?, ?, 'exam', 'in_progress', ?, ?, 0, ?, ?, NOW())
      `,
      [user.uid, problemsetId, JSON.stringify({}), JSON.stringify([]), maxScore, remainingSeconds]
    );

    const [rows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [result.insertId]);
    return res.status(201).json({ submission: toSubmissionDetail(rows[0]) });
  });

  router.post("/problemsets/:id/training/start", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }

    const problemset = await getProblemsetById(problemsetId);
    if (!problemset) {
      return res.status(404).json({ error: "problemset not found" });
    }
    if (!canUserViewProblemset(problemset, user)) {
      return res.status(403).json({ error: "无权访问该题目。" });
    }

    const [scoreRows] = await dbPool.query(
      "SELECT COALESCE(SUM(score), 0) AS max_score FROM questions WHERE problemset_id = ?",
      [problemsetId]
    );
    const maxScore = Number(scoreRows[0]?.max_score ?? 0);

    const [result] = await dbPool.query(
      `
        INSERT INTO submissions (
          user_uid, problemset_id, mode, status, answers_json, results_json,
          score, max_score, remaining_seconds, started_at
        ) VALUES (?, ?, 'training', 'in_progress', ?, ?, 0, ?, 0, NOW())
      `,
      [user.uid, problemsetId, JSON.stringify({}), JSON.stringify([]), maxScore]
    );

    const [rows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [result.insertId]);
    return res.status(201).json({ submission: toSubmissionDetail(rows[0]) });
  });

  router.post("/problemsets/:id/training/submit", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }

    const problemset = await getProblemsetById(problemsetId);
    if (!problemset) {
      return res.status(404).json({ error: "problemset not found" });
    }
    if (!canUserViewProblemset(problemset, user)) {
      return res.status(403).json({ error: "无权访问该题目。" });
    }

    const submissionId = Number(req.body?.submissionId ?? NaN);

    if (Number.isFinite(submissionId) && submissionId > 0) {
      // Update existing in_progress training submission to submitted
      const [rows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ error: "submission not found" });
      }
      const submission = rows[0];
      if (submission.user_uid !== user.uid) {
        return res.status(403).json({ error: "permission denied" });
      }
      if (submission.mode !== "training" || submission.status !== "in_progress") {
        return res.status(400).json({ error: "submission is not an in-progress training session" });
      }

      const calc = await calculateSubmission(problemsetId, req.body?.answers ?? {});
      await dbPool.query(
        `
          UPDATE submissions
          SET status = 'submitted',
              answers_json = ?,
              results_json = ?,
              score = ?,
              max_score = ?,
              submitted_at = NOW()
          WHERE id = ?
        `,
        [JSON.stringify(calc.answers), JSON.stringify(calc.results), calc.score, calc.maxScore, submissionId]
      );
      const [updatedRows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
      return res.json({ submission: toSubmissionDetail(updatedRows[0]) });
    }

    // Legacy: create new submitted submission directly (guest or old flow)
    const calc = await calculateSubmission(problemsetId, req.body?.answers ?? {});
    const [result] = await dbPool.query(
      `
        INSERT INTO submissions (
          user_uid, problemset_id, mode, status, answers_json, results_json,
          score, max_score, submitted_at, started_at
        ) VALUES (?, ?, 'training', 'submitted', ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        user.uid,
        problemsetId,
        JSON.stringify(calc.answers),
        JSON.stringify(calc.results),
        calc.score,
        calc.maxScore
      ]
    );
    const [newRows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [result.insertId]);
    return res.status(201).json({ submission: toSubmissionDetail(newRows[0]) });
  });

  router.post("/submissions/:id/autosave", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const submissionId = Number(req.params.id);
    if (!Number.isFinite(submissionId)) {
      return res.status(400).json({ error: "invalid submission id" });
    }

    const [rows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "submission not found" });
    }
    const submission = rows[0];
    if (submission.user_uid !== user.uid) {
      return res.status(403).json({ error: "permission denied" });
    }
    if ((submission.mode !== "exam" && submission.mode !== "training") || submission.status !== "in_progress") {
      return res.status(400).json({ error: "submission is not an in-progress exam or training session" });
    }

    const answers = normalizeSubmissionAnswers(req.body?.answers ?? {});
    const remainingSecondsRaw = req.body?.remainingSeconds;
    const remainingSeconds = Number.isFinite(Number(remainingSecondsRaw))
      ? Math.max(0, Math.floor(Number(remainingSecondsRaw)))
      : submission.remaining_seconds;
    await dbPool.query(
      "UPDATE submissions SET answers_json = ?, remaining_seconds = ? WHERE id = ?",
      [JSON.stringify(answers), remainingSeconds, submissionId]
    );
    return res.json({ ok: true });
  });

  router.post("/submissions/:id/pause", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const submissionId = Number(req.params.id);
    if (!Number.isFinite(submissionId)) {
      return res.status(400).json({ error: "invalid submission id" });
    }
    const [rows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "submission not found" });
    }
    const submission = rows[0];
    if (submission.user_uid !== user.uid) {
      return res.status(403).json({ error: "permission denied" });
    }
    if (submission.mode !== "exam" || submission.status !== "in_progress") {
      return res.status(400).json({ error: "submission is not pausable" });
    }

    const answers = normalizeSubmissionAnswers(req.body?.answers ?? {});
    const remainingSecondsRaw = req.body?.remainingSeconds;
    const remainingSeconds = Number.isFinite(Number(remainingSecondsRaw))
      ? Math.max(0, Math.floor(Number(remainingSecondsRaw)))
      : submission.remaining_seconds;
    await dbPool.query(
      "UPDATE submissions SET status = 'paused', answers_json = ?, remaining_seconds = ? WHERE id = ?",
      [JSON.stringify(answers), remainingSeconds, submissionId]
    );
    const [updatedRows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
    return res.json({ submission: toSubmissionDetail(updatedRows[0]) });
  });

  router.post("/submissions/:id/resume", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const submissionId = Number(req.params.id);
    if (!Number.isFinite(submissionId)) {
      return res.status(400).json({ error: "invalid submission id" });
    }
    const [rows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "submission not found" });
    }
    const submission = rows[0];
    if (submission.user_uid !== user.uid) {
      return res.status(403).json({ error: "permission denied" });
    }
    if ((submission.mode !== "exam" && submission.mode !== "training") || (submission.status !== "paused" && submission.status !== "in_progress")) {
      return res.status(400).json({ error: "submission is not resumable" });
    }

    await dbPool.query(
      "UPDATE submissions SET status = 'in_progress' WHERE id = ?",
      [submissionId]
    );
    const [updatedRows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
    return res.json({ submission: toSubmissionDetail(updatedRows[0]) });
  });

  router.post("/submissions/:id/submit", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const submissionId = Number(req.params.id);
    if (!Number.isFinite(submissionId)) {
      return res.status(400).json({ error: "invalid submission id" });
    }

    const [rows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "submission not found" });
    }
    const submission = rows[0];
    if (submission.user_uid !== user.uid) {
      return res.status(403).json({ error: "permission denied" });
    }
    if (submission.status !== "in_progress" && submission.status !== "paused") {
      return res.status(400).json({ error: "submission is not submittable" });
    }

    const mergedAnswers = {
      ...safeJsonParse(submission.answers_json, {}),
      ...normalizeSubmissionAnswers(req.body?.answers ?? {})
    };
    const calc = await calculateSubmission(Number(submission.problemset_id), mergedAnswers);
    const remainingSecondsRaw = req.body?.remainingSeconds;
    const remainingSeconds = Number.isFinite(Number(remainingSecondsRaw))
      ? Math.max(0, Math.floor(Number(remainingSecondsRaw)))
      : submission.remaining_seconds;

    await dbPool.query(
      `
        UPDATE submissions
        SET status = 'submitted',
            answers_json = ?,
            results_json = ?,
            score = ?,
            max_score = ?,
            remaining_seconds = ?,
            submitted_at = NOW()
        WHERE id = ?
      `,
      [
        JSON.stringify(calc.answers),
        JSON.stringify(calc.results),
        calc.score,
        calc.maxScore,
        remainingSeconds,
        submissionId
      ]
    );
    const [updatedRows] = await dbPool.query("SELECT * FROM submissions WHERE id = ? LIMIT 1", [submissionId]);
    return res.json({ submission: toSubmissionDetail(updatedRows[0]) });
  });

  router.get("/users/:uid/active-exam", async (req, res) => {
    const targetUid = normalizeUid(req.params.uid);
    const actor = await requireSelfOrAdmin(req, res, targetUid);
    if (!actor) return;
    const [rows] = await dbPool.query(
      `
        SELECT s.*, p.title AS problemset_title
        FROM submissions s
        LEFT JOIN problemsets p ON p.id = s.problemset_id
        WHERE s.user_uid = ? AND s.mode IN ('exam', 'training') AND s.status IN ('paused', 'in_progress')
        ORDER BY s.updated_at DESC
        LIMIT 1
      `,
      [targetUid]
    );
    return res.json({
      submission: Array.isArray(rows) && rows.length > 0 ? toSubmissionSummary(rows[0]) : null
    });
  });

  router.get("/users/:uid/submissions", async (req, res) => {
    const targetUid = normalizeUid(req.params.uid);
    const [userRows] = await dbPool.query(
      "SELECT uid, records_public FROM users WHERE uid = ? LIMIT 1",
      [targetUid]
    );
    if (!Array.isArray(userRows) || userRows.length === 0) {
      return res.status(404).json({ error: "user not found" });
    }

    const actor = await getUserByHeader(req);
    const isOwnerOrAdmin = Boolean(actor) && (String(actor.uid) === targetUid || Boolean(actor.is_admin));
    const canView = isOwnerOrAdmin || Boolean(userRows[0].records_public);
    if (!canView) {
      return res.status(403).json({ error: "permission denied" });
    }

    // Owner/admin can see in_progress/paused training sessions for resume.
    // Everyone else only sees submitted records.
    const statusFilter = isOwnerOrAdmin
      ? "s.status IN ('submitted', 'paused', 'in_progress')"
      : "s.status = 'submitted'";
    const [rows] = await dbPool.query(
      `
        SELECT s.*, p.title AS problemset_title
        FROM submissions s
        LEFT JOIN problemsets p ON p.id = s.problemset_id
        WHERE s.user_uid = ? AND ${statusFilter}
        ORDER BY COALESCE(s.submitted_at, s.updated_at, s.created_at) DESC
        LIMIT 100
      `,
      [targetUid]
    );
    return res.json({ submissions: rows.map(toSubmissionSummary) });
  });

  router.get("/ai/models", async (req, res) => {
    const config = await getAiConfig();
    const actor = await getUserByHeader(req);
    const enabledModels = config.models.filter((item) => item.enabled);
    const usageMap = actor?.uid ? await getAiUsageMap(actor.uid, enabledModels) : new Map();
    const models = enabledModels.map((item) => (
      actor?.uid ? toPublicAiModelWithUsage(item, usageMap.get(item.id)) : toPublicAiModel(item)
    ));
    return res.json({
      models,
      defaultModelId: config.defaultModelId
    });
  });

  router.post("/ai/generate", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const mode = String(req.body?.mode ?? "").trim().toLowerCase();
    if (mode !== "hint" && mode !== "solution") {
      return res.status(400).json({ error: "mode must be hint or solution" });
    }
    const question = String(req.body?.question ?? "").trim();
    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }
    if (question.length > 20000) {
      return res.status(400).json({ error: "question is too long" });
    }
    const modelId = String(req.body?.modelId ?? "").trim() || null;

    try {
      const content = await requestAiAssist({ mode, question, user, modelId });
      return res.json({ content });
    } catch (err) {
      const statusCode = Number(err?.statusCode ?? 500);
      if (statusCode === 429) {
        return res.status(429).json({
          error: "今日该 AI 模型可用次数已用完。",
          dailyLimit: Number(err?.dailyLimit ?? 0),
          usedCount: Number(err?.usedCount ?? 0),
          remainingCount: Number(err?.remainingCount ?? 0)
        });
      }
      return res.status(500).json({ error: String(err?.message ?? "ai generation failed") });
    }
  });

  router.get("/admin/problemsets", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const [rows] = await dbPool.query(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.duration_minutes,
        p.problemset_type,
        p.created_by_uid,
        p.created_at,
        COALESCE(COUNT(q.id), 0) AS question_count
      FROM problemsets p
      LEFT JOIN questions q ON q.problemset_id = p.id
      GROUP BY p.id, p.title, p.description, p.duration_minutes, p.problemset_type, p.created_by_uid, p.created_at
      ORDER BY p.id ASC
    `);
    return res.json({ problemsets: rows.map(toProblemsetSummary) });
  });

  router.get("/admin/problemsets/:id/questions", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }
    const [problemsetRows] = await dbPool.query(
      "SELECT id FROM problemsets WHERE id = ? LIMIT 1",
      [problemsetId]
    );
    if (!Array.isArray(problemsetRows) || problemsetRows.length === 0) {
      return res.status(404).json({ error: "problemset not found" });
    }

    const [rows] = await dbPool.query(
      "SELECT id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis FROM questions WHERE problemset_id = ? ORDER BY question_index ASC",
      [problemsetId]
    );
    return res.json({ questions: rows.map(toQuestion) });
  });

  router.delete("/admin/problemsets/:id/questions", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }
    const [problemsetRows] = await dbPool.query(
      "SELECT id FROM problemsets WHERE id = ? LIMIT 1",
      [problemsetId]
    );
    if (!Array.isArray(problemsetRows) || problemsetRows.length === 0) {
      return res.status(404).json({ error: "problemset not found" });
    }

    await dbPool.query("DELETE FROM questions WHERE problemset_id = ?", [problemsetId]);
    return res.status(204).send();
  });

  router.patch("/admin/problemsets/:id", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const sourceId = Number(req.params.id);
    if (!Number.isFinite(sourceId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }

    const [existsRows] = await dbPool.query(
      "SELECT id FROM problemsets WHERE id = ? LIMIT 1",
      [sourceId]
    );
    if (!Array.isArray(existsRows) || existsRows.length === 0) {
      return res.status(404).json({ error: "problemset not found" });
    }

    const requestedId = req.body?.id;
    const nextId = Number.isFinite(Number(requestedId)) ? Number(requestedId) : sourceId;
    if (!Number.isInteger(nextId) || nextId <= 0) {
      return res.status(400).json({ error: "id must be a positive integer" });
    }

    const titleInput = req.body?.title;
    const descriptionInput = req.body?.description;
    const durationInput = req.body?.durationMinutes;
    const configInput = req.body?.questionConfig;
    const typeInput = req.body?.problemsetType;

    const sets = [];
    const values = [];
    if (nextId !== sourceId) {
      sets.push("id = ?");
      values.push(nextId);
    }
    if (typeof titleInput === "string") {
      const title = titleInput.trim();
      if (!title) return res.status(400).json({ error: "title cannot be empty" });
      sets.push("title = ?");
      values.push(title);
    }
    if (typeof descriptionInput === "string") {
      const description = descriptionInput.trim();
      if (!description) return res.status(400).json({ error: "description cannot be empty" });
      sets.push("description = ?");
      values.push(description);
    }
    if (durationInput !== undefined) {
      const durationMinutes = Number(durationInput);
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return res.status(400).json({ error: "durationMinutes must be positive" });
      }
      sets.push("duration_minutes = ?");
      values.push(Math.round(durationMinutes));
    }
    if (typeof configInput === "string") {
      sets.push("question_config = ?");
      values.push(configInput);
    }
    if (typeInput !== undefined) {
      const normalizedType = normalizeProblemsetType(typeInput);
      if (!normalizedType) {
        return res.status(400).json({ error: "invalid problemsetType" });
      }
      sets.push("problemset_type = ?");
      values.push(normalizedType);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: "nothing to update" });
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      if (nextId !== sourceId) {
        const [idRows] = await connection.query(
          "SELECT id FROM problemsets WHERE id = ? LIMIT 1",
          [nextId]
        );
        if (Array.isArray(idRows) && idRows.length > 0) {
          await connection.rollback();
          return res.status(409).json({ error: `problemset id ${nextId} already exists` });
        }
        const [questionConflictRows] = await connection.query(
          "SELECT id FROM questions WHERE problemset_id = ? LIMIT 1",
          [nextId]
        );
        if (Array.isArray(questionConflictRows) && questionConflictRows.length > 0) {
          await connection.rollback();
          return res.status(409).json({ error: `problemset id ${nextId} is occupied by existing questions` });
        }
      }

      await connection.query(
        `UPDATE problemsets SET ${sets.join(", ")} WHERE id = ?`,
        [...values, sourceId]
      );
      if (nextId !== sourceId) {
        await connection.query(
          "UPDATE questions SET problemset_id = ? WHERE problemset_id = ?",
          [nextId, sourceId]
        );
      }

      const [rows] = await connection.query(
        `
          SELECT
            p.id,
            p.title,
            p.description,
            p.duration_minutes,
            p.problemset_type,
            p.created_by_uid,
            p.created_at,
            COALESCE(COUNT(q.id), 0) AS question_count
          FROM problemsets p
          LEFT JOIN questions q ON q.problemset_id = p.id
          WHERE p.id = ?
          GROUP BY p.id, p.title, p.description, p.duration_minutes, p.problemset_type, p.created_by_uid, p.created_at
          LIMIT 1
        `,
        [nextId]
      );

      await connection.commit();
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ error: "problemset not found after update" });
      }
      return res.json({ problemset: toProblemsetSummary(rows[0]) });
    } catch (err) {
      await connection.rollback();
      const message = String(err?.message ?? "");
      if (message.includes("Duplicate entry")) {
        return res.status(409).json({ error: "problemset id conflict" });
      }
      return res.status(500).json({ error: "update problemset failed" });
    } finally {
      connection.release();
    }
  });

  router.delete("/admin/problemsets/:id", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("DELETE FROM questions WHERE problemset_id = ?", [problemsetId]);
      const [result] = await connection.query("DELETE FROM problemsets WHERE id = ?", [problemsetId]);
      await connection.commit();
      if (!result?.affectedRows) {
        return res.status(404).json({ error: "problemset not found" });
      }
      return res.status(204).send();
    } catch {
      await connection.rollback();
      return res.status(500).json({ error: "delete problemset failed" });
    } finally {
      connection.release();
    }
  });

  router.patch("/admin/questions/:questionId", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const questionId = Number(req.params.questionId);
    if (!Number.isFinite(questionId)) {
      return res.status(400).json({ error: "invalid question id" });
    }

    const [rows] = await dbPool.query(
      "SELECT id, problemset_id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis FROM questions WHERE id = ? LIMIT 1",
      [questionId]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "question not found" });
    }

    const current = rows[0];
    const mergedType = req.body?.type !== undefined
      ? normalizeQuestionType(req.body?.type)
      : String(current.question_type ?? "option");
    if (!mergedType) {
      return res.status(400).json({ error: "type must be option or input" });
    }

    const mergedIndex = req.body?.index !== undefined ? Number(req.body?.index) : Number(current.question_index);
    if (!Number.isInteger(mergedIndex) || mergedIndex <= 0) {
      return res.status(400).json({ error: "index must be a positive integer" });
    }

    const mergedStem = req.body?.stem !== undefined ? String(req.body?.stem ?? "").trim() : String(current.stem ?? "");
    if (!mergedStem) {
      return res.status(400).json({ error: "stem is required" });
    }

    const mergedScore = req.body?.score !== undefined ? Number(req.body?.score) : Number(current.score);
    if (!Number.isFinite(mergedScore) || mergedScore <= 0) {
      return res.status(400).json({ error: "score must be positive" });
    }

    const mergedAnalysis = req.body?.analysis !== undefined
      ? String(req.body?.analysis ?? "").trim()
      : String(current.analysis ?? "");
    const mergedAnswerRaw = req.body?.answer !== undefined
      ? String(req.body?.answer ?? "").trim()
      : String(current.answer ?? "").trim();

    let mergedOptions = req.body?.options !== undefined
      ? parseQuestionOptions(req.body?.options)
      : parseQuestionOptions(current.options_json);
    let mergedInputPlaceholder = req.body?.inputPlaceholder !== undefined
      ? String(req.body?.inputPlaceholder ?? "").trim()
      : String(current.input_placeholder ?? "").trim();
    let mergedAnswer = mergedAnswerRaw;

    if (mergedType === "option") {
      if (mergedOptions.length < 2 || mergedOptions.length > 26) {
        return res.status(400).json({ error: "option question must have 2-26 options" });
      }
      const allowedKeys = new Set(mergedOptions.map((option) => option.key));
      mergedAnswer = normalizeQuestionAnswer(mergedAnswerRaw)
        .split(",")
        .filter((key) => allowedKeys.has(key))
        .join(",");
      if (!mergedAnswer) {
        return res.status(400).json({ error: "option answer must contain valid option keys" });
      }
      mergedInputPlaceholder = "";
    } else {
      mergedOptions = [];
      if (!mergedAnswer) {
        return res.status(400).json({ error: "input question answer is required" });
      }
    }

    try {
      await dbPool.query(
        "UPDATE questions SET question_index = ?, question_type = ?, stem = ?, input_placeholder = ?, options_json = ?, score = ?, answer = ?, analysis = ? WHERE id = ?",
        [
          mergedIndex,
          mergedType,
          mergedStem,
          mergedInputPlaceholder,
          JSON.stringify(mergedOptions),
          mergedScore,
          mergedAnswer,
          mergedAnalysis,
          questionId
        ]
      );
    } catch (err) {
      const message = String(err?.message ?? "");
      if (message.includes("Duplicate entry")) {
        return res.status(409).json({ error: "question index already exists in this problemset" });
      }
      return res.status(500).json({ error: "update question failed" });
    }

    const [updatedRows] = await dbPool.query(
      "SELECT id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis FROM questions WHERE id = ? LIMIT 1",
      [questionId]
    );
    return res.json({ question: toQuestion(updatedRows[0]) });
  });

  router.delete("/admin/questions/:questionId", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const questionId = Number(req.params.questionId);
    if (!Number.isFinite(questionId)) {
      return res.status(400).json({ error: "invalid question id" });
    }

    const [result] = await dbPool.query("DELETE FROM questions WHERE id = ?", [questionId]);
    if (!result?.affectedRows) {
      return res.status(404).json({ error: "question not found" });
    }
    return res.status(204).send();
  });

  router.get("/admin/users", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, is_admin, is_banned, records_public, created_at FROM users ORDER BY id ASC"
    );
    return res.json({ users: rows.map(toPublicUser) });
  });

  router.get("/admin/oauth/cpoauth", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const config = await getCpoauthConfig(req);
    return res.json({ config });
  });

  router.get("/admin/system-pages", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const [settings, userAgreementPage, privacyPolicyPage, customPages] = await Promise.all([
      getAppSettings([SITE_SETTING_KEYS.loginNoticeMarkdown]),
      getSystemPageBySystemKey(SYSTEM_PAGE_KEYS.userAgreement),
      getSystemPageBySystemKey(SYSTEM_PAGE_KEYS.privacyPolicy),
      listCustomSystemPages()
    ]);

    return res.json({
      loginNoticeMarkdown: String(settings[SITE_SETTING_KEYS.loginNoticeMarkdown] ?? ""),
      userAgreementPage: userAgreementPage ? toSystemPage(userAgreementPage) : null,
      privacyPolicyPage: privacyPolicyPage ? toSystemPage(privacyPolicyPage) : null,
      pages: customPages.map(toSystemPage)
    });
  });

  router.put("/admin/system-pages/settings", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userAgreementInput = readReservedSystemPageInput(req.body?.userAgreementPage, SYSTEM_PAGE_KEYS.userAgreement);
    if (userAgreementInput.error) {
      return res.status(400).json({ error: `userAgreementPage: ${userAgreementInput.error}` });
    }
    const privacyPolicyInput = readReservedSystemPageInput(req.body?.privacyPolicyPage, SYSTEM_PAGE_KEYS.privacyPolicy);
    if (privacyPolicyInput.error) {
      return res.status(400).json({ error: `privacyPolicyPage: ${privacyPolicyInput.error}` });
    }

    const loginNoticeMarkdown = normalizeSystemPageContent(req.body?.loginNoticeMarkdown);
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `
          INSERT INTO system_pages (system_key, slug, title, content)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            slug = VALUES(slug),
            title = VALUES(title),
            content = VALUES(content)
        `,
        [
          SYSTEM_PAGE_KEYS.userAgreement,
          userAgreementInput.slug,
          userAgreementInput.title,
          userAgreementInput.content
        ]
      );

      await connection.query(
        `
          INSERT INTO system_pages (system_key, slug, title, content)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            slug = VALUES(slug),
            title = VALUES(title),
            content = VALUES(content)
        `,
        [
          SYSTEM_PAGE_KEYS.privacyPolicy,
          privacyPolicyInput.slug,
          privacyPolicyInput.title,
          privacyPolicyInput.content
        ]
      );

      await connection.query(
        "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        [SITE_SETTING_KEYS.loginNoticeMarkdown, loginNoticeMarkdown]
      );

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      const message = String(err?.message ?? "");
      if (message.includes("Duplicate entry")) {
        return res.status(409).json({ error: "system page slug already exists" });
      }
      return res.status(500).json({ error: "save system page settings failed" });
    } finally {
      connection.release();
    }

    const [settings, userAgreementPage, privacyPolicyPage, customPages] = await Promise.all([
      getAppSettings([SITE_SETTING_KEYS.loginNoticeMarkdown]),
      getSystemPageBySystemKey(SYSTEM_PAGE_KEYS.userAgreement),
      getSystemPageBySystemKey(SYSTEM_PAGE_KEYS.privacyPolicy),
      listCustomSystemPages()
    ]);

    return res.json({
      loginNoticeMarkdown: String(settings[SITE_SETTING_KEYS.loginNoticeMarkdown] ?? ""),
      userAgreementPage: userAgreementPage ? toSystemPage(userAgreementPage) : null,
      privacyPolicyPage: privacyPolicyPage ? toSystemPage(privacyPolicyPage) : null,
      pages: customPages.map(toSystemPage)
    });
  });

  router.post("/admin/system-pages", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const input = readSystemPageInput(req.body);
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }

    try {
      const [result] = await dbPool.query(
        "INSERT INTO system_pages (system_key, slug, title, content) VALUES (NULL, ?, ?, ?)",
        [input.slug, input.title, input.content]
      );
      const page = await getSystemPageById(Number(result.insertId));
      return res.status(201).json({ page: toSystemPage(page) });
    } catch (err) {
      const message = String(err?.message ?? "");
      if (message.includes("Duplicate entry")) {
        return res.status(409).json({ error: "system page slug already exists" });
      }
      return res.status(500).json({ error: "create system page failed" });
    }
  });

  router.patch("/admin/system-pages/:id", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const pageId = Number(req.params.id);
    if (!Number.isFinite(pageId)) {
      return res.status(400).json({ error: "invalid system page id" });
    }

    const current = await getSystemPageById(pageId);
    if (!current) {
      return res.status(404).json({ error: "system page not found" });
    }
    if (String(current.system_key ?? "").trim()) {
      return res.status(400).json({ error: "reserved system page must be updated from settings" });
    }

    const input = readSystemPageInput({
      slug: req.body?.slug ?? current.slug,
      title: req.body?.title ?? current.title,
      content: req.body?.content ?? current.content
    });
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }

    try {
      await dbPool.query(
        "UPDATE system_pages SET slug = ?, title = ?, content = ? WHERE id = ?",
        [input.slug, input.title, input.content, pageId]
      );
      const page = await getSystemPageById(pageId);
      return res.json({ page: toSystemPage(page) });
    } catch (err) {
      const message = String(err?.message ?? "");
      if (message.includes("Duplicate entry")) {
        return res.status(409).json({ error: "system page slug already exists" });
      }
      return res.status(500).json({ error: "update system page failed" });
    }
  });

  router.delete("/admin/system-pages/:id", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const pageId = Number(req.params.id);
    if (!Number.isFinite(pageId)) {
      return res.status(400).json({ error: "invalid system page id" });
    }

    const current = await getSystemPageById(pageId);
    if (!current) {
      return res.status(404).json({ error: "system page not found" });
    }
    if (String(current.system_key ?? "").trim()) {
      return res.status(400).json({ error: "reserved system page cannot be deleted" });
    }

    await dbPool.query("DELETE FROM system_pages WHERE id = ?", [pageId]);
    return res.status(204).send();
  });

  router.put("/admin/oauth/cpoauth", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const clientId = String(req.body?.clientId ?? "").trim();
    const clientSecret = String(req.body?.clientSecret ?? "").trim();
    const callbackUrlInput = String(req.body?.callbackUrl ?? "").trim();
    const callbackUrl = callbackUrlInput || buildDefaultCallbackUrl(req);
    const scope = normalizeOauthScope(String(req.body?.scope ?? "").trim() || "openid profile email");

    if (!clientId) return res.status(400).json({ error: "clientId is required" });
    if (!clientSecret) return res.status(400).json({ error: "clientSecret is required" });
    if (!isHttpUrl(callbackUrl)) {
      return res.status(400).json({ error: "callbackUrl must be a valid http/https url" });
    }

    await Promise.all([
      setAppSetting(CPOAUTH_SETTING_KEYS.clientId, clientId),
      setAppSetting(CPOAUTH_SETTING_KEYS.clientSecret, clientSecret),
      setAppSetting(CPOAUTH_SETTING_KEYS.callbackUrl, callbackUrl),
      setAppSetting(CPOAUTH_SETTING_KEYS.scope, scope)
    ]);

    return res.json({
      config: {
        clientId,
        clientSecret,
        callbackUrl,
        scope
      }
    });
  });

  // ── S3 配置 ──
  router.get("/admin/s3/config", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const config = await getS3Config();
    return res.json({ config });
  });

  router.put("/admin/s3/config", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const region = String(req.body?.region ?? "").trim();
    const bucket = String(req.body?.bucket ?? "").trim();
    const accessKeyId = String(req.body?.accessKeyId ?? "").trim();
    const secretAccessKey = String(req.body?.secretAccessKey ?? "").trim();
    const endpoint = String(req.body?.endpoint ?? "").trim();
    const prefix = String(req.body?.prefix ?? "").trim();
    const concurrency = String(req.body?.concurrency ?? "8").trim();
    const forcePathStyle = String(req.body?.forcePathStyle ?? "true").trim();
    const cdnBaseUrl = String(req.body?.cdnBaseUrl ?? "").trim();

    if (!region) return res.status(400).json({ error: "region is required" });
    if (!bucket) return res.status(400).json({ error: "bucket is required" });
    if (!accessKeyId) return res.status(400).json({ error: "accessKeyId is required" });
    if (!secretAccessKey) return res.status(400).json({ error: "secretAccessKey is required" });
    if (!endpoint) return res.status(400).json({ error: "endpoint is required" });

    await Promise.all([
      setAppSetting(S3_SETTING_KEYS.region, region),
      setAppSetting(S3_SETTING_KEYS.bucket, bucket),
      setAppSetting(S3_SETTING_KEYS.accessKeyId, accessKeyId),
      setAppSetting(S3_SETTING_KEYS.secretAccessKey, secretAccessKey),
      setAppSetting(S3_SETTING_KEYS.endpoint, endpoint),
      setAppSetting(S3_SETTING_KEYS.prefix, prefix),
      setAppSetting(S3_SETTING_KEYS.concurrency, concurrency),
      setAppSetting(S3_SETTING_KEYS.forcePathStyle, forcePathStyle),
      setAppSetting(S3_SETTING_KEYS.cdnBaseUrl, cdnBaseUrl)
    ]);

    return res.json({
      config: {
        region,
        bucket,
        accessKeyId,
        secretAccessKey,
        endpoint,
        prefix,
        concurrency,
        forcePathStyle,
        cdnBaseUrl
      }
    });
  });

  router.get("/admin/ai/config", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const config = await getAiConfig();
    return res.json({ config: toAdminAiConfig(config) });
  });

  router.put("/admin/ai/config", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const config = normalizeAiConfigPayload(req.body);

    if (config.models.length === 0) {
      return res.status(400).json({ error: "at least one AI model is required" });
    }
    if (!config.defaultModelId || !config.models.some((item) => item.id === config.defaultModelId && item.enabled)) {
      return res.status(400).json({ error: "defaultModelId must point to an enabled model" });
    }

    await saveAiConfig(config);

    return res.json({
      config: toAdminAiConfig(config)
    });
  });

  router.get("/admin/admin-tokens", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const [rows] = await dbPool.query(
      "SELECT id, token, created_by_uid, created_at FROM admin_tokens ORDER BY id DESC"
    );
    return res.json({
      tokens: rows.map((row) => ({
        id: Number(row.id),
        token: String(row.token ?? ""),
        createdByUid: String(row.created_by_uid ?? ""),
        createdAt: row.created_at
      }))
    });
  });

  router.post("/admin/admin-tokens", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const [countRows] = await dbPool.query("SELECT COUNT(*) AS cnt FROM admin_tokens");
    const count = Number(countRows?.[0]?.cnt ?? 0);
    if (count >= 2) {
      return res.status(400).json({ error: "最多只能保留 2 个 admin token" });
    }

    let createdToken = "";
    let insertId = 0;
    for (let i = 0; i < 8; i += 1) {
      const candidate = generateAdminToken();
      try {
        const [result] = await dbPool.query(
          "INSERT INTO admin_tokens (token, created_by_uid) VALUES (?, ?)",
          [candidate, String(admin.uid ?? "") || null]
        );
        createdToken = candidate;
        insertId = Number(result?.insertId ?? 0);
        break;
      } catch (err) {
        const message = String(err?.message ?? "");
        if (message.includes("Duplicate entry")) continue;
        throw err;
      }
    }

    if (!createdToken || !insertId) {
      return res.status(500).json({ error: "failed to generate admin token" });
    }

    const [rows] = await dbPool.query(
      "SELECT id, token, created_by_uid, created_at FROM admin_tokens WHERE id = ? LIMIT 1",
      [insertId]
    );
    const row = rows[0];
    return res.status(201).json({
      token: {
        id: Number(row.id),
        token: String(row.token ?? ""),
        createdByUid: String(row.created_by_uid ?? ""),
        createdAt: row.created_at
      }
    });
  });

  router.delete("/admin/admin-tokens/:id", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "invalid token id" });
    }
    const [result] = await dbPool.query("DELETE FROM admin_tokens WHERE id = ?", [id]);
    if (!result?.affectedRows) {
      return res.status(404).json({ error: "token not found" });
    }
    return res.status(204).send();
  });

  router.patch("/admin/users/:uid", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const targetUid = normalizeUid(req.params.uid);
    const uidInput = req.body?.uid;
    const username = req.body?.username;
    const emailRaw = req.body?.email;
    const isAdmin = req.body?.isAdmin;
    const isBanned = req.body?.isBanned;

    const sets = [];
    const values = [];
    let nextUid = targetUid;

    if (typeof uidInput === "string" && uidInput.trim()) {
      const uid = normalizeUid(uidInput);
      if (!isValidUid(uid)) {
        return res.status(400).json({ error: "invalid uid" });
      }
      sets.push("uid = ?");
      values.push(uid);
      nextUid = uid;
    }
    if (typeof username === "string" && username.trim()) {
      sets.push("name = ?");
      values.push(username.trim());
    }
    if (typeof emailRaw === "string" && emailRaw.trim()) {
      const email = normalizeEmail(emailRaw);
      if (!isEmail(email)) {
        return res.status(400).json({ error: "invalid email" });
      }
      sets.push("email = ?");
      values.push(email);
      sets.push("avatar_url = ?");
      values.push(buildGravatarUrl(email));
    }
    if (typeof isAdmin === "boolean") {
      if (targetUid === admin.uid && !isAdmin) {
        return res.status(400).json({ error: "admin cannot remove self admin permission" });
      }
      sets.push("is_admin = ?");
      values.push(isAdmin ? 1 : 0);
    }
    if (typeof isBanned === "boolean") {
      if (targetUid === admin.uid && isBanned) {
        return res.status(400).json({ error: "admin cannot ban self" });
      }
      sets.push("is_banned = ?");
      values.push(isBanned ? 1 : 0);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: "nothing to update" });
    }

    values.push(targetUid);
    try {
      await dbPool.query(`UPDATE users SET ${sets.join(", ")} WHERE uid = ?`, values);
    } catch (err) {
      if (String(err?.message ?? "").includes("Duplicate entry")) {
        return res.status(409).json({ error: "uid or email already exists" });
      }
      throw err;
    }

    const [rows] = await dbPool.query(
      "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, is_admin, is_banned, records_public, created_at FROM users WHERE uid = ? LIMIT 1",
      [nextUid]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: "user not found" });
    }
    return res.json({ user: toPublicUser(rows[0]) });
  });

  router.post("/admin/users/:uid/promote", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const targetUid = normalizeUid(req.params.uid);
    await dbPool.query("UPDATE users SET is_admin = 1 WHERE uid = ?", [targetUid]);
    return res.json({ ok: true });
  });

  router.post("/admin/users/:uid/ban", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const targetUid = normalizeUid(req.params.uid);
    const banned = req.body?.banned !== false;
    if (targetUid === admin.uid && banned) {
      return res.status(400).json({ error: "admin cannot ban self" });
    }
    await dbPool.query("UPDATE users SET is_banned = ? WHERE uid = ?", [banned ? 1 : 0, targetUid]);
    return res.json({ ok: true });
  });

  router.delete("/admin/users/:uid", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const targetUid = normalizeUid(req.params.uid);
    await dbPool.query("DELETE FROM users WHERE uid = ?", [targetUid]);
    return res.status(204).send();
  });

  router.post("/admin/problemsets/:id/questions", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const problemsetId = Number(req.params.id);
    if (!Number.isFinite(problemsetId)) {
      return res.status(400).json({ error: "invalid problemset id" });
    }

    const [problemsetRows] = await dbPool.query(
      "SELECT id FROM problemsets WHERE id = ? LIMIT 1",
      [problemsetId]
    );
    if (!Array.isArray(problemsetRows) || problemsetRows.length === 0) {
      return res.status(404).json({ error: "problemset not found" });
    }

    const type = normalizeQuestionType(req.body?.type ?? "option");
    if (!type) {
      return res.status(400).json({ error: "type must be option or input" });
    }
    const stem = String(req.body?.stem ?? "").trim();
    const analysis = String(req.body?.analysis ?? "").trim();
    const score = Number(req.body?.score ?? 1.5);
    const indexRaw = req.body?.index;
    const answerRaw = String(req.body?.answer ?? "").trim();
    if (!stem) {
      return res.status(400).json({ error: "stem is required" });
    }
    if (!Number.isFinite(score) || score <= 0) {
      return res.status(400).json({ error: "score must be positive" });
    }

    let nextIndex = Number(indexRaw);
    if (!Number.isInteger(nextIndex) || nextIndex <= 0) {
      const [maxRows] = await dbPool.query(
        "SELECT COALESCE(MAX(question_index), 0) AS max_index FROM questions WHERE problemset_id = ?",
        [problemsetId]
      );
      nextIndex = Number(maxRows[0]?.max_index ?? 0) + 1;
    }

    let options = parseQuestionOptions(req.body?.options);
    let inputPlaceholder = String(req.body?.inputPlaceholder ?? "").trim();
    let answer = answerRaw;
    if (type === "option") {
      if (options.length < 2 || options.length > 26) {
        return res.status(400).json({ error: "option question must have 2-26 options" });
      }
      const allowedKeys = new Set(options.map((item) => item.key));
      answer = normalizeQuestionAnswer(answerRaw)
        .split(",")
        .filter((item) => allowedKeys.has(item))
        .join(",");
      if (!answer) {
        return res.status(400).json({ error: "option answer must contain valid option keys" });
      }
      inputPlaceholder = "";
    } else {
      options = [];
      if (!answer) {
        return res.status(400).json({ error: "input question answer is required" });
      }
    }

    let result;
    try {
      [result] = await dbPool.query(
        "INSERT INTO questions (problemset_id, question_index, question_type, stem, input_placeholder, options_json, score, answer, analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [problemsetId, nextIndex, type, stem, inputPlaceholder, JSON.stringify(options), score, answer, analysis]
      );
    } catch (err) {
      const message = String(err?.message ?? "");
      if (message.includes("Duplicate entry")) {
        return res.status(409).json({ error: "question index already exists in this problemset" });
      }
      return res.status(500).json({ error: "create question failed" });
    }

    const [rows] = await dbPool.query(
      "SELECT id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis FROM questions WHERE id = ? LIMIT 1",
      [result.insertId]
    );
    return res.status(201).json({ question: toQuestion(rows[0]) });
  });

  // ── Backup helpers ──

  const BACKUP_ENCRYPTION_ALGORITHM = "aes-256-gcm";
  const BACKUP_PBKDF2_ITERATIONS = 210000;
  const BACKUP_KEY_LENGTH = 32;

  function encryptBackupPayload(plaintext, password) {
    const salt = randomBytes(16);
    const key = pbkdf2Sync(password, salt, BACKUP_PBKDF2_ITERATIONS, BACKUP_KEY_LENGTH, "sha256");
    const iv = randomBytes(12);
    const cipher = createCipheriv(BACKUP_ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      v: 1,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      data: encrypted.toString("hex")
    });
  }

  function decryptBackupPayload(envelope, password) {
    let parsed;
    try {
      parsed = typeof envelope === "string" ? JSON.parse(envelope) : envelope;
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.v !== 1 || !parsed.salt || !parsed.iv || !parsed.tag || !parsed.data) return null;
    const salt = Buffer.from(parsed.salt, "hex");
    const iv = Buffer.from(parsed.iv, "hex");
    const tag = Buffer.from(parsed.tag, "hex");
    const encrypted = Buffer.from(parsed.data, "hex");
    const key = pbkdf2Sync(password, salt, BACKUP_PBKDF2_ITERATIONS, BACKUP_KEY_LENGTH, "sha256");
    try {
      const decipher = createDecipheriv(BACKUP_ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return JSON.parse(decrypted.toString("utf8"));
    } catch {
      return null;
    }
  }

  // ── POST /api/admin/backup/export ──

  router.post("/admin/backup/export", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const selections = req.body?.selections;
    const includeProblemsets = selections?.problemsets !== false;
    const includeOauth = selections?.oauth !== false;
    const includeSystemPages = selections?.systemPages !== false;
    const includeUsers = selections?.users !== false;
    const includeAiConfig = selections?.aiConfig !== false;
    const includeSubmissions = selections?.submissions !== false;
    const includeS3Config = selections?.s3Config !== false;
    const password = typeof req.body?.password === "string" && req.body.password.trim()
      ? req.body.password.trim()
      : "";

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      encrypted: false,
      data: {}
    };

    try {
      if (includeProblemsets) {
        const [psRows] = await dbPool.query(
          "SELECT id, title, description, duration_minutes, problemset_type, created_by_uid, question_config FROM problemsets ORDER BY id ASC"
        );
        const problemsets = [];
        for (const ps of psRows) {
          const [qRows] = await dbPool.query(
            "SELECT question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis FROM questions WHERE problemset_id = ? ORDER BY question_index ASC",
            [ps.id]
          );
          problemsets.push({
            id: Number(ps.id),
            title: String(ps.title ?? ""),
            description: String(ps.description ?? ""),
            durationMinutes: Number(ps.duration_minutes ?? 120),
            problemsetType: String(ps.problemset_type ?? "official_public"),
            createdByUid: String(ps.created_by_uid ?? ""),
            questionConfig: ps.question_config ? String(ps.question_config) : null,
            questions: qRows.map((q) => ({
              index: Number(q.question_index),
              type: String(q.question_type ?? "option"),
              materialGroupIndex: q.material_group_index === null || q.material_group_index === undefined ? null : Number(q.material_group_index),
              groupQuestionIndex: q.group_question_index === null || q.group_question_index === undefined ? null : Number(q.group_question_index),
              groupQuestionCount: q.group_question_count === null || q.group_question_count === undefined ? null : Number(q.group_question_count),
              groupTitle: String(q.group_title ?? ""),
              sharedMaterial: String(q.shared_material ?? ""),
              stem: String(q.stem ?? ""),
              inputPlaceholder: String(q.input_placeholder ?? ""),
              options: typeof q.options_json === "object" ? q.options_json : safeJsonParse(q.options_json, []),
              score: Number(q.score),
              answer: String(q.answer ?? ""),
              analysis: String(q.analysis ?? "")
            }))
          });
        }
        backup.data.problemsets = problemsets;
      }

      if (includeOauth) {
        const cpoauthSettings = await getAppSettings(Object.values(CPOAUTH_SETTING_KEYS));
        backup.data.cpoauth = {
          clientId: String(cpoauthSettings[CPOAUTH_SETTING_KEYS.clientId] ?? ""),
          clientSecret: String(cpoauthSettings[CPOAUTH_SETTING_KEYS.clientSecret] ?? ""),
          callbackUrl: String(cpoauthSettings[CPOAUTH_SETTING_KEYS.callbackUrl] ?? ""),
          scope: String(cpoauthSettings[CPOAUTH_SETTING_KEYS.scope] ?? "openid profile email")
        };
      }

      if (includeSystemPages) {
        const [settings, userAgreementPage, privacyPolicyPage, customPages] = await Promise.all([
          getAppSettings([SITE_SETTING_KEYS.loginNoticeMarkdown]),
          getSystemPageBySystemKey(SYSTEM_PAGE_KEYS.userAgreement),
          getSystemPageBySystemKey(SYSTEM_PAGE_KEYS.privacyPolicy),
          listCustomSystemPages()
        ]);
        backup.data.systemPages = {
          loginNoticeMarkdown: String(settings[SITE_SETTING_KEYS.loginNoticeMarkdown] ?? ""),
          userAgreement: userAgreementPage ? {
            systemKey: SYSTEM_PAGE_KEYS.userAgreement,
            slug: String(userAgreementPage.slug ?? "user-agreement"),
            title: String(userAgreementPage.title ?? "User Agreement"),
            content: String(userAgreementPage.content ?? "")
          } : null,
          privacyPolicy: privacyPolicyPage ? {
            systemKey: SYSTEM_PAGE_KEYS.privacyPolicy,
            slug: String(privacyPolicyPage.slug ?? "privacy-policy"),
            title: String(privacyPolicyPage.title ?? "Privacy Policy"),
            content: String(privacyPolicyPage.content ?? "")
          } : null,
          customPages: customPages.map((row) => ({
            systemKey: row.system_key ? String(row.system_key) : null,
            slug: String(row.slug ?? ""),
            title: String(row.title ?? ""),
            content: String(row.content ?? "")
          }))
        };
      }

      if (includeUsers) {
        const [userRows] = await dbPool.query(
          "SELECT id, uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, oauth_provider, oauth_subject, is_admin, is_banned, records_public, created_at FROM users ORDER BY id ASC"
        );
        backup.data.users = userRows.map((row) => ({
          uid: String(row.uid ?? ""),
          name: String(row.name ?? ""),
          email: String(row.email ?? ""),
          avatarUrl: String(row.avatar_url ?? ""),
          profileCoverUrl: String(row.profile_cover_url ?? ""),
          bio: row.bio ? String(row.bio) : "",
          aiModelId: row.ai_model_id ? String(row.ai_model_id) : "",
          submissionAnalysisMode: normalizeSubmissionAnalysisMode(row.submission_analysis_mode, "wrong_only"),
          autosaveIntervalSeconds: normalizeAutosaveIntervalSeconds(row.autosave_interval_seconds, 30),
          oauthProvider: row.oauth_provider ? String(row.oauth_provider) : null,
          oauthSubject: row.oauth_subject ? String(row.oauth_subject) : null,
          isAdmin: Boolean(row.is_admin),
          isBanned: Boolean(row.is_banned),
          recordsPublic: Boolean(row.records_public),
          createdAt: row.created_at
        }));
      }

      if (includeAiConfig) {
        const aiConfig = await getAiConfig();
        backup.data.aiConfig = {
          defaultModelId: aiConfig.defaultModelId,
          prompts: aiConfig.prompts,
          models: aiConfig.models.map((m) => ({
            id: m.id,
            name: m.name,
            baseUrl: m.baseUrl,
            apiKey: m.apiKey,
            model: m.model,
            dailyLimit: m.dailyLimit,
            enabled: m.enabled
          }))
        };
      }

      if (includeS3Config) {
        const s3Settings = await getAppSettings(Object.values(S3_SETTING_KEYS));
        backup.data.s3Config = {
          region: String(s3Settings[S3_SETTING_KEYS.region] ?? ""),
          bucket: String(s3Settings[S3_SETTING_KEYS.bucket] ?? ""),
          accessKeyId: String(s3Settings[S3_SETTING_KEYS.accessKeyId] ?? ""),
          secretAccessKey: String(s3Settings[S3_SETTING_KEYS.secretAccessKey] ?? ""),
          endpoint: String(s3Settings[S3_SETTING_KEYS.endpoint] ?? ""),
          prefix: String(s3Settings[S3_SETTING_KEYS.prefix] ?? ""),
          concurrency: String(s3Settings[S3_SETTING_KEYS.concurrency] ?? "8"),
          forcePathStyle: String(s3Settings[S3_SETTING_KEYS.forcePathStyle] ?? "true"),
          cdnBaseUrl: String(s3Settings[S3_SETTING_KEYS.cdnBaseUrl] ?? "")
        };
      }

      if (includeSubmissions) {
        const [submissionRows] = await dbPool.query(
          "SELECT id, user_uid, problemset_id, mode, status, answers_json, results_json, score, max_score, remaining_seconds, started_at, submitted_at, created_at, updated_at FROM submissions ORDER BY id ASC"
        );
        backup.data.submissions = submissionRows.map((row) => ({
          id: Number(row.id),
          userUid: String(row.user_uid ?? ""),
          problemsetId: Number(row.problemset_id),
          mode: String(row.mode ?? "training"),
          status: String(row.status ?? "submitted"),
          answersJson: row.answers_json ? String(row.answers_json) : null,
          resultsJson: row.results_json ? String(row.results_json) : null,
          score: Number(row.score ?? 0),
          maxScore: Number(row.max_score ?? 0),
          remainingSeconds: row.remaining_seconds === null || row.remaining_seconds === undefined ? null : Number(row.remaining_seconds),
          startedAt: row.started_at ?? null,
          submittedAt: row.submitted_at ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      }

      let responseBody = JSON.stringify(backup);
      if (password) {
        responseBody = encryptBackupPayload(responseBody, password);
        const envelope = JSON.parse(responseBody);
        return res.json({
          encrypted: true,
          ...envelope
        });
      }

      return res.json(backup);
    } catch (err) {
      return res.status(500).json({ error: "Failed to export backup: " + String(err?.message ?? err) });
    }
  });

  // ── POST /api/admin/backup/restore ──

  router.post("/admin/backup/restore", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const password = typeof req.body?.password === "string" && req.body.password.trim()
      ? req.body.password.trim()
      : "";
    const selections = req.body?.selections;
    const restoreProblemsets = selections?.problemsets !== false;
    const restoreOauth = selections?.oauth !== false;
    const restoreSystemPages = selections?.systemPages !== false;
    const restoreUsers = selections?.users !== false;
    const restoreAiConfig = selections?.aiConfig !== false;
    const restoreSubmissions = selections?.submissions !== false;
    const restoreS3Config = selections?.s3Config !== false;

    let backup;
    if (req.body?.encrypted) {
      if (!password) {
        return res.status(400).json({ error: "Password is required to decrypt this backup." });
      }
      const envelope = {
        v: req.body?.v,
        salt: req.body?.salt,
        iv: req.body?.iv,
        tag: req.body?.tag,
        data: req.body?.data
      };
      backup = decryptBackupPayload(envelope, password);
      if (!backup) {
        return res.status(400).json({ error: "Failed to decrypt backup. Wrong password or corrupted data." });
      }
    } else {
      backup = req.body;
    }

    if (!backup || typeof backup !== "object" || !backup.data) {
      return res.status(400).json({ error: "Invalid backup data." });
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();

      if (restoreProblemsets && Array.isArray(backup.data.problemsets)) {
        for (const ps of backup.data.problemsets) {
          await connection.query(
            `INSERT INTO problemsets (id, title, description, duration_minutes, problemset_type, created_by_uid, question_config)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               title = VALUES(title),
               description = VALUES(description),
               duration_minutes = VALUES(duration_minutes),
               problemset_type = VALUES(problemset_type),
               created_by_uid = VALUES(created_by_uid),
               question_config = VALUES(question_config)`,
            [
              Number(ps.id),
              String(ps.title ?? ""),
              String(ps.description ?? ""),
              Number(ps.durationMinutes ?? 120),
              String(ps.problemsetType ?? "official_public"),
              String(ps.createdByUid ?? ""),
              ps.questionConfig || null
            ]
          );
          if (Array.isArray(ps.questions) && ps.questions.length > 0) {
            await connection.query("DELETE FROM questions WHERE problemset_id = ?", [Number(ps.id)]);
            for (const q of ps.questions) {
              await connection.query(
                `INSERT INTO questions (problemset_id, question_index, question_type, material_group_index, group_question_index, group_question_count, group_title, shared_material, stem, input_placeholder, options_json, score, answer, analysis)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  Number(ps.id),
                  Number(q.index),
                  String(q.type ?? "option"),
                  q.materialGroupIndex ?? null,
                  q.groupQuestionIndex ?? null,
                  q.groupQuestionCount ?? null,
                  String(q.groupTitle ?? ""),
                  String(q.sharedMaterial ?? ""),
                  String(q.stem ?? ""),
                  String(q.inputPlaceholder ?? ""),
                  JSON.stringify(Array.isArray(q.options) ? q.options : []),
                  Number(q.score ?? 1.5),
                  String(q.answer ?? ""),
                  String(q.analysis ?? "")
                ]
              );
            }
          }
        }
      }

      if (restoreOauth && backup.data.cpoauth && typeof backup.data.cpoauth === "object") {
        const oa = backup.data.cpoauth;
        if (typeof oa.clientId === "string") {
          await connection.query(
            "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
            [CPOAUTH_SETTING_KEYS.clientId, String(oa.clientId)]
          );
        }
        if (typeof oa.clientSecret === "string") {
          await connection.query(
            "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
            [CPOAUTH_SETTING_KEYS.clientSecret, String(oa.clientSecret)]
          );
        }
        if (typeof oa.callbackUrl === "string") {
          await connection.query(
            "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
            [CPOAUTH_SETTING_KEYS.callbackUrl, String(oa.callbackUrl)]
          );
        }
        if (typeof oa.scope === "string") {
          await connection.query(
            "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
            [CPOAUTH_SETTING_KEYS.scope, String(oa.scope)]
          );
        }
      }

      if (restoreSystemPages && backup.data.systemPages && typeof backup.data.systemPages === "object") {
        const sp = backup.data.systemPages;
        if (typeof sp.loginNoticeMarkdown === "string") {
          await connection.query(
            "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
            [SITE_SETTING_KEYS.loginNoticeMarkdown, normalizeSystemPageContent(sp.loginNoticeMarkdown)]
          );
        }
        for (const key of ["userAgreement", "privacyPolicy"]) {
          const page = sp[key];
          if (page && typeof page === "object" && page.slug && page.title) {
            await connection.query(
              `INSERT INTO system_pages (system_key, slug, title, content)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 slug = VALUES(slug),
                 title = VALUES(title),
                 content = VALUES(content)`,
              [
                page.systemKey || null,
                normalizeSystemPageSlug(page.slug),
                normalizeSystemPageTitle(page.title),
                normalizeSystemPageContent(page.content ?? "")
              ]
            );
          }
        }
        if (Array.isArray(sp.customPages)) {
          for (const page of sp.customPages) {
            if (page && typeof page === "object" && page.slug && page.title) {
              await connection.query(
                "INSERT INTO system_pages (system_key, slug, title, content) VALUES (NULL, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)",
                [
                  normalizeSystemPageSlug(page.slug),
                  normalizeSystemPageTitle(page.title),
                  normalizeSystemPageContent(page.content ?? "")
                ]
              );
            }
          }
        }
      }

      if (restoreUsers && Array.isArray(backup.data.users)) {
        for (const u of backup.data.users) {
          await connection.query(
            `INSERT INTO users (uid, name, email, avatar_url, profile_cover_url, bio, ai_model_id, submission_analysis_mode, autosave_interval_seconds, oauth_provider, oauth_subject, is_admin, is_banned, records_public)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               name = VALUES(name),
               email = VALUES(email),
               avatar_url = VALUES(avatar_url),
               profile_cover_url = VALUES(profile_cover_url),
               bio = VALUES(bio),
               ai_model_id = VALUES(ai_model_id),
               submission_analysis_mode = VALUES(submission_analysis_mode),
               autosave_interval_seconds = VALUES(autosave_interval_seconds),
               oauth_provider = VALUES(oauth_provider),
               oauth_subject = VALUES(oauth_subject),
               is_admin = VALUES(is_admin),
               is_banned = VALUES(is_banned),
               records_public = VALUES(records_public)`,
            [
              String(u.uid ?? ""),
              String(u.name ?? ""),
              String(u.email ?? ""),
              String(u.avatarUrl ?? ""),
              String(u.profileCoverUrl ?? ""),
              String(u.bio ?? ""),
              String(u.aiModelId ?? ""),
              normalizeSubmissionAnalysisMode(u.submissionAnalysisMode, "wrong_only"),
              normalizeAutosaveIntervalSeconds(u.autosaveIntervalSeconds, 30),
              u.oauthProvider || null,
              u.oauthSubject || null,
              u.isAdmin ? 1 : 0,
              u.isBanned ? 1 : 0,
              u.recordsPublic ? 1 : 0
            ]
          );
        }
      }

      if (restoreAiConfig && backup.data.aiConfig && typeof backup.data.aiConfig === "object") {
        const aiCfg = backup.data.aiConfig;
        const normalized = normalizeAiConfigPayload(aiCfg);
        await connection.query(
          "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
          [AI_SETTING_KEYS.config, JSON.stringify(normalized)]
        );
      }

      if (restoreS3Config && backup.data.s3Config && typeof backup.data.s3Config === "object") {
        const s3Cfg = backup.data.s3Config;
        const s3Pairs = [
          [S3_SETTING_KEYS.region, s3Cfg.region],
          [S3_SETTING_KEYS.bucket, s3Cfg.bucket],
          [S3_SETTING_KEYS.accessKeyId, s3Cfg.accessKeyId],
          [S3_SETTING_KEYS.secretAccessKey, s3Cfg.secretAccessKey],
          [S3_SETTING_KEYS.endpoint, s3Cfg.endpoint],
          [S3_SETTING_KEYS.prefix, s3Cfg.prefix],
          [S3_SETTING_KEYS.concurrency, s3Cfg.concurrency],
          [S3_SETTING_KEYS.forcePathStyle, s3Cfg.forcePathStyle],
          [S3_SETTING_KEYS.cdnBaseUrl, s3Cfg.cdnBaseUrl]
        ];
        for (const [key, value] of s3Pairs) {
          if (typeof value === "string") {
            await connection.query(
              "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
              [key, String(value)]
            );
          }
        }
      }

      if (restoreSubmissions && Array.isArray(backup.data.submissions)) {
        for (const sub of backup.data.submissions) {
          await connection.query(
            `INSERT INTO submissions (id, user_uid, problemset_id, mode, status, answers_json, results_json, score, max_score, remaining_seconds, started_at, submitted_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               user_uid = VALUES(user_uid),
               problemset_id = VALUES(problemset_id),
               mode = VALUES(mode),
               status = VALUES(status),
               answers_json = VALUES(answers_json),
               results_json = VALUES(results_json),
               score = VALUES(score),
               max_score = VALUES(max_score),
               remaining_seconds = VALUES(remaining_seconds),
               started_at = VALUES(started_at),
               submitted_at = VALUES(submitted_at),
               updated_at = VALUES(updated_at)`,
            [
              Number(sub.id),
              String(sub.userUid ?? ""),
              Number(sub.problemsetId),
              String(sub.mode ?? "training"),
              String(sub.status ?? "submitted"),
              sub.answersJson ?? null,
              sub.resultsJson ?? null,
              Number(sub.score ?? 0),
              Number(sub.maxScore ?? 0),
              sub.remainingSeconds === null || sub.remainingSeconds === undefined ? null : Number(sub.remainingSeconds),
              sub.startedAt ?? null,
              sub.submittedAt ?? null,
              sub.createdAt ?? null,
              sub.updatedAt ?? null
            ]
          );
        }
      }

      await connection.commit();
      return res.json({ ok: true });
    } catch (err) {
      await connection.rollback();
      return res.status(500).json({ error: "Failed to restore backup: " + String(err?.message ?? err) });
    } finally {
      connection.release();
    }
  });

  return router;
}

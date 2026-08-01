// @ts-nocheck
import Redis from "ioredis";
import { env } from "./env.js";

const REDIS_RETRY_COOLDOWN_MS = 10_000;
const MAX_MEMORY_ENTRIES = 5_000;

export const redis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  lazyConnect: true,
  connectTimeout: 1_500,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null
});

let retryRedisAfter = 0;
let lastRedisError = null;
const memoryStore = new Map();

// ioredis emits `error` independently of rejected command promises. Always
// attach a listener so an unavailable optional Redis service cannot terminate
// the API process with an unhandled EventEmitter error.
redis.on("error", (err) => {
  lastRedisError = err;
});

function cleanExpiredMemoryEntries(now = Date.now()) {
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

function setMemoryValue(key, value, ttlSeconds) {
  cleanExpiredMemoryEntries();
  if (memoryStore.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = memoryStore.keys().next().value;
    if (oldestKey !== undefined) memoryStore.delete(oldestKey);
  }
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, Math.min(Number(ttlSeconds) || 1, 3600)) * 1000
  });
}

function consumeMemoryValue(key) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  memoryStore.delete(key);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

async function ensureRedisReady() {
  if (redis.status === "ready") return;
  if (redis.status === "connecting" || redis.status === "connect") {
    await redis.ping();
    return;
  }
  await redis.connect();
  if (redis.status !== "ready") await redis.ping();
}

async function tryRedis(operation) {
  if (Date.now() < retryRedisAfter) return { ok: false, value: null };
  try {
    await ensureRedisReady();
    const value = await operation();
    lastRedisError = null;
    return { ok: true, value };
  } catch (err) {
    lastRedisError = err;
    retryRedisAfter = Date.now() + REDIS_RETRY_COOLDOWN_MS;
    return { ok: false, value: null };
  }
}

export async function pingRedis() {
  const result = await tryRedis(() => redis.ping());
  if (!result.ok) {
    throw new Error(`Redis unavailable: ${String(lastRedisError?.message ?? "connection failed")}`);
  }
  return result.value;
}

export async function setTemporaryValue(key, value, ttlSeconds) {
  const result = await tryRedis(() => redis.set(key, value, "EX", ttlSeconds));
  if (result.ok) return "redis";
  setMemoryValue(key, value, ttlSeconds);
  return "memory";
}

export async function consumeTemporaryValue(key) {
  // Values written during a Redis outage live only in this process. Consume
  // those first even if Redis has recovered since the authorization started.
  const memoryValue = consumeMemoryValue(key);
  if (memoryValue !== null) return memoryValue;

  const result = await tryRedis(() => redis.getdel(key));
  if (!result.ok) return null;
  return result.value ?? null;
}

import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = [
  path.resolve(currentDir, "..", "..", ".env"),
  path.resolve(currentDir, "..", "..", "..", ".env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env")
].find(existsSync);

if (envPath) dotenv.config({ path: envPath });

const port = Number(process.env.PORT ?? 3000);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port,
  publicApiBaseUrl: String(process.env.PUBLIC_API_BASE_URL ?? "").trim(),
  webBaseUrl: String(process.env.WEB_BASE_URL ?? "").trim(),
  cpoauthBaseUrl: process.env.CPOAUTH_BASE_URL ?? "https://auth.luogu.me",
  db: {
    host: process.env.DATABASE_HOST ?? process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DATABASE_PORT ?? process.env.DB_PORT ?? 3306),
    user: process.env.DATABASE_USER ?? process.env.DB_USER ?? "app",
    password: process.env.DATABASE_PASSWORD ?? process.env.DB_PASSWORD ?? "app",
    name: process.env.DATABASE_NAME ?? process.env.DB_NAME ?? "luogu_ti"
  },
  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379)
  }
};

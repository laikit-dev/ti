// @ts-nocheck
import cors from "cors";
import express from "express";
import { dbPool, ensureUserSchema } from "./db.js";
import { env } from "./env.js";
import { buildRouter } from "./routes.js";
import { readBearerSession } from "./session.js";

const app = express();

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set({
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
  next();
});
app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
app.use(express.json({ limit: "50mb" }));
app.use("/api", async (req, res, next) => {
  try {
    const session = readBearerSession(req.header("authorization"));
    if (!session || session.kind !== "user") return next();
    const [rows] = await dbPool.query("SELECT is_banned FROM users WHERE uid = ? LIMIT 1", [session.uid]);
    if (Array.isArray(rows) && rows[0]?.is_banned) {
      return res.status(403).json({ error: "该用户已被封禁。" });
    }
    return next();
  } catch (err) {
    return next(err);
  }
});
app.use("/api", buildRouter());

app.get("/", (_req, res) => {
  res.type("text").send("pong");
});

async function bootstrap() {
  if (env.nodeEnv === "production" && String(process.env.SESSION_SECRET ?? "").trim().length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production");
  }
  await ensureUserSchema();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on :${env.port}`);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[api] bootstrap failed:", err);
  process.exit(1);
});

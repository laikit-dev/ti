// @ts-nocheck
import cors from "cors";
import express from "express";
import { dbPool, ensureUserSchema } from "./db.js";
import { env } from "./env.js";
import { buildRouter } from "./routes.js";

const app = express();

app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
app.use(express.json({ limit: "50mb" }));

app.use("/api", async (req, res, next) => {
  try {
    const uid = String(req.header("x-user-uid") ?? "").trim();
    if (!uid) return next();

    const [rows] = await dbPool.query("SELECT is_banned FROM users WHERE uid = ? LIMIT 1", [uid]);
    if (Array.isArray(rows) && rows.length > 0 && rows[0].is_banned) {
      return res.status(403).json({ error: "该用户已被封禁。" });
    }
    return next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/api ban-check failed:", err);
    return next();
  }
}, buildRouter());

app.get("/", (_req, res) => {
  res.type("text").send("pong");
});

async function bootstrap() {
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



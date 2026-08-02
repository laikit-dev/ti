import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

const SESSION_VERSION = "v1";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionClaims {
  uid: string;
  exp: number;
  kind: "user" | "root";
  adminTokenId?: number;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string): string {
  return createHmac("sha256", env.sessionSecret).update(value).digest("base64url");
}

export function createSessionToken(
  uid: string,
  kind: SessionClaims["kind"] = "user",
  adminTokenId?: number
): string {
  const payload = encode(JSON.stringify({
    uid,
    kind,
    ...(kind === "root" ? { adminTokenId } : {}),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  }));
  const signedValue = `${SESSION_VERSION}.${payload}`;
  return `${signedValue}.${sign(signedValue)}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  const [version, payload, signature, extra] = String(token ?? "").split(".");
  if (version !== SESSION_VERSION || !payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(`${version}.${payload}`), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (!claims.uid || (claims.kind !== "user" && claims.kind !== "root")) return null;
    if (claims.kind === "root" && (!Number.isSafeInteger(claims.adminTokenId) || Number(claims.adminTokenId) <= 0)) return null;
    if (!Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function readBearerSession(authorization: unknown): SessionClaims | null {
  const match = /^Bearer\s+([^\s]+)$/i.exec(String(authorization ?? "").trim());
  return match ? verifySessionToken(match[1]) : null;
}

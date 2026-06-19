import crypto from "node:crypto";

export const CHPP_SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-ya_chpp_session"
    : "ya_chpp_session";

export const CHPP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 * 16;

type ChppSessionPayload = {
  v: 2;
  accessToken: string;
  accessSecret: string;
  iat: number;
  exp: number;
};

function getCookieKey() {
  const raw = process.env.CHPP_COOKIE_SECRET;
  if (!raw) {
    throw new Error("Missing CHPP_COOKIE_SECRET");
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
    throw new Error("CHPP_COOKIE_SECRET must be 32 bytes base64-encoded");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CHPP_COOKIE_SECRET must be 32 bytes base64-encoded");
  }

  return key;
}

export function sealChppSession(input: {
  accessToken: string;
  accessSecret: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: ChppSessionPayload = {
    v: 2,
    accessToken: input.accessToken,
    accessSecret: input.accessSecret,
    iat: now,
    exp: now + CHPP_SESSION_MAX_AGE_SECONDS,
  };

  const key = getCookieKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function openChppSession(
  value: string | null | undefined
): ChppSessionPayload | null {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  try {
    const key = getCookieKey();
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      return null;
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    const parsed = JSON.parse(
      plaintext.toString("utf8")
    ) as Partial<ChppSessionPayload>;

    if (parsed.v !== 2) return null;
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken) {
      return null;
    }
    if (typeof parsed.accessSecret !== "string" || !parsed.accessSecret) {
      return null;
    }
    if (typeof parsed.iat !== "number" || !Number.isFinite(parsed.iat)) {
      return null;
    }
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp <= now) return null;

    return {
      v: 2,
      accessToken: parsed.accessToken,
      accessSecret: parsed.accessSecret,
      iat: parsed.iat,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export const chppSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: CHPP_SESSION_MAX_AGE_SECONDS,
};

/**
 * Sesi login berbentuk token bertanda tangan HMAC-SHA256 di cookie httpOnly.
 * Memakai Web Crypto agar bisa dipakai di middleware (edge) maupun route Node.
 */
export const SESSION_COOKIE = "kinra_session";
export const SESSION_TTL = 8 * 60 * 60; // detik

export interface Session { sub: string; username: string; nama: string; exp: number }

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new Error("AUTH_SECRET belum diisi (minimal 32 karakter).");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(data: Omit<Session, "exp">): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/** Kembalikan isi sesi bila tanda tangan valid dan belum kedaluwarsa; selain itu null. */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    return typeof s.exp === "number" && s.exp > Date.now() / 1000 ? s : null;
  } catch { return null; }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Format hash: scrypt$N$r$p$salt(base64)$hash(base64)
const N = 16384, R = 8, P = 1, LEN = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((ok, fail) =>
    scrypt(password, salt, LEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, key) => (e ? fail(e) : ok(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hash pengganti agar waktu respons sama ketika username tidak ditemukan. */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

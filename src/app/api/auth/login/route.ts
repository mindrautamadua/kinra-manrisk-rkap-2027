import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server-db";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { cookieOptions, SESSION_COOKIE, SESSION_TTL, signSession } from "@/lib/session";

export const runtime = "nodejs";

const MAX_GAGAL = 5;
const KUNCI_MENIT = 15;
const GAGAL = "Username atau password salah.";

interface AppUser {
  id: string; username: string; nama: string; password_hash: string; aktif: boolean;
  gagal_login: number; terkunci_sampai: string | null;
}

export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password || username.length > 64 || password.length > 256) {
    return NextResponse.json({ error: GAGAL }, { status: 401 });
  }

  const db = adminDb();
  const { data, error } = await db.from("app_user").select("*").eq("username", username).maybeSingle<AppUser>();
  if (error) return NextResponse.json({ error: "Layanan login sedang bermasalah." }, { status: 500 });

  if (data?.terkunci_sampai && new Date(data.terkunci_sampai) > new Date()) {
    const menit = Math.ceil((new Date(data.terkunci_sampai).getTime() - Date.now()) / 60000);
    return NextResponse.json({ error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.` }, { status: 429 });
  }

  // Tetap hitung hash walau user tidak ada, agar waktu respons tidak membocorkan username yang valid.
  const cocok = await verifyPassword(password, data?.password_hash ?? DUMMY_HASH);
  if (!data || !cocok || !data.aktif) {
    if (data) {
      const gagal = data.gagal_login + 1;
      await db.from("app_user").update({
        gagal_login: gagal >= MAX_GAGAL ? 0 : gagal,
        terkunci_sampai: gagal >= MAX_GAGAL ? new Date(Date.now() + KUNCI_MENIT * 60000).toISOString() : null,
      }).eq("id", data.id);
    }
    return NextResponse.json({ error: GAGAL }, { status: 401 });
  }

  await db.from("app_user").update({ gagal_login: 0, terkunci_sampai: null, login_terakhir: new Date().toISOString() }).eq("id", data.id);

  const token = await signSession({ sub: data.id, username: data.username, nama: data.nama });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL });
  return res;
}

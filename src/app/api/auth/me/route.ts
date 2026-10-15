import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function GET() {
  const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: "Belum login." }, { status: 401 });
  return NextResponse.json({ username: s.username, nama: s.nama, exp: s.exp });
}

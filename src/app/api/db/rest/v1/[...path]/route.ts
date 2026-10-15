import { NextRequest, NextResponse } from "next/server";
import { SECRET_KEY, SUPABASE_URL } from "@/lib/server-db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Proxy PostgREST: browser tidak lagi memegang akses langsung ke tabel.
 * Setiap permintaan dicek sesinya, dibatasi ke tabel kertas kerja, lalu diteruskan ke Supabase dengan secret key.
 * Tabel app_user sengaja tidak termasuk daftar sehingga tidak bisa dibaca dari browser.
 */
const TABLES = new Set([
  "app_settings", "kategori_risiko", "taksonomi", "kriteria_dampak", "risk_driver", "ras", "ras_tambahan",
  "risk_register", "parameter_sheet", "ram_pengendalian", "ram_tambahan", "cat_aksi", "challenge_log", "snapshot",
]);
const FWD_REQ = ["accept", "content-type", "prefer", "range", "range-unit", "accept-profile", "content-profile"];
const FWD_RES = ["content-type", "content-range", "preference-applied", "range-unit"];

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ message: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
  }
  // Tolak permintaan lintas situs (CSRF) untuk metode yang mengubah data.
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ message: "Asal permintaan tidak diizinkan." }, { status: 403 });
  }
  const { path } = await ctx.params;
  if (path.length !== 1 || !TABLES.has(path[0])) {
    return NextResponse.json({ message: "Sumber data tidak diizinkan." }, { status: 404 });
  }
  if (!SUPABASE_URL || !SECRET_KEY) {
    return NextResponse.json({ message: "SUPABASE_SECRET_KEY belum diisi di server." }, { status: 500 });
  }

  const headers = new Headers({ apikey: SECRET_KEY });
  if (SECRET_KEY.startsWith("eyJ")) headers.set("authorization", `Bearer ${SECRET_KEY}`); // service_role key (JWT lama)
  for (const h of FWD_REQ) { const v = req.headers.get(h); if (v) headers.set(h, v); }

  const upstream = await fetch(`${SUPABASE_URL}/rest/v1/${path[0]}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    cache: "no-store",
  });
  const out = new Headers({ "cache-control": "no-store" });
  for (const h of FWD_RES) { const v = upstream.headers.get(h); if (v) out.set(h, v); }
  return new NextResponse(upstream.status === 204 ? null : await upstream.text(), { status: upstream.status, headers: out });
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };

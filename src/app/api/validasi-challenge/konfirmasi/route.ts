import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server-db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Konfirmasi manual status Selesai, hanya untuk masukan yang putusan Validasi AI terakhirnya "verifikasi_manual"
 * (hal yang tidak bisa dibuktikan dari isi kertas kerja). Wajib menyertakan bukti/keterangan; tercatat atas nama pengguna.
 */
export async function POST(req: Request) {
  const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
  let input: { id?: string; bukti?: string };
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  const bukti = input.bukti?.trim() ?? "";
  if (!input.id || bukti.length < 10) return NextResponse.json({ error: "Tuliskan bukti atau keterangan penyelesaian (minimal 10 karakter)." }, { status: 400 });

  const db = adminDb();
  const { data, error } = await db.from("challenge_log").select("id,status,tanggapan,validasi_ai").eq("id", input.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Masukan tidak ditemukan." }, { status: 404 });
  if ((data.validasi_ai as { putusan?: string } | null)?.putusan !== "verifikasi_manual") {
    return NextResponse.json({ error: "Konfirmasi manual hanya untuk masukan yang dinilai AI \"perlu dicek manual\". Jalankan Validasi AI terlebih dahulu." }, { status: 403 });
  }

  const waktu = new Date().toISOString();
  const tgl = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  const catatan = `Dikonfirmasi manual oleh ${s.nama || s.username} ${tgl}: ${bukti}`;
  const { error: e } = await db.from("challenge_log").update({
    status: "Selesai", updated_at: waktu,
    tanggapan: data.tanggapan ? `${data.tanggapan}\n${catatan}` : catatan,
    validasi_ai: { ...(data.validasi_ai as object), konfirmasi_manual: { oleh: s.username, waktu, bukti } },
  }).eq("id", input.id);
  if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

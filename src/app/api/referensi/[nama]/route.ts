import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server-db";

/**
 * Dokumen referensi strategis dari bucket privat Supabase Storage "referensi" (diunggah oleh
 * scripts/referensi-unggah.mjs). Middleware sudah mewajibkan login untuk semua /api.
 * JSON dikirim langsung; PDF dialihkan ke signed URL berumur pendek karena ukurannya melebihi
 * batas body respons serverless.
 */
const JSON_OK = new Set(["referensi-strategis.json", "referensi-halaman.json"]);
const PDF_OK = new Set(["renstra.pdf", "dkmr.pdf"]);

export async function GET(_req: Request, { params }: { params: Promise<{ nama: string }> }) {
  const { nama } = await params;
  const bucket = adminDb().storage.from("referensi");

  if (PDF_OK.has(nama)) {
    const { data, error } = await bucket.createSignedUrl(nama, 15 * 60);
    if (error || !data) return NextResponse.json({ error: `PDF ${nama} belum diunggah: ${error?.message ?? ""}` }, { status: 404 });
    return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (JSON_OK.has(nama)) {
    const { data, error } = await bucket.download(nama);
    if (error || !data) return NextResponse.json({ error: `Data ${nama} belum diunggah. Jalankan scripts/referensi-unggah.mjs.` }, { status: 404 });
    return new NextResponse(await data.text(), { headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=300" } });
  }
  return NextResponse.json({ error: "Dokumen tidak dikenal." }, { status: 404 });
}

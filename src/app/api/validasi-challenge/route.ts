import { NextResponse } from "next/server";
import type { HasilValidasi, ValidasiInput } from "@/lib/validasi-challenge";
import { callStructured } from "@/lib/openai";
import { PROFIL_KINRA } from "@/lib/isi-ai-prompt";
import { adminDb } from "@/lib/server-db";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `Anda reviewer Lini 2 manajemen risiko PTPN III (Persero) yang memverifikasi tindak lanjut challenge session RKAP 2027 PT KINRA.
Tugas: untuk SETIAP masukan challenge session, nilai apakah isian kertas kerja saat ini (data JSON) sudah memenuhi permintaan masukan tersebut.

Putusan:
- "terpenuhi": isian kertas kerja secara nyata sudah memuat perbaikan yang diminta. Wajib ada bukti konkret di data (kutip/sebut nilai, kolom, risiko, atau parameter yang membuktikannya).
- "belum": isian belum mencerminkan perbaikan, perbaikan baru sebagian, atau masih ada bagian permintaan yang tidak terpenuhi.
- "verifikasi_manual": permintaan tidak dapat dibuktikan dari isi kertas kerja (mis. menjadwalkan pembahasan dengan Holding, kajian eksternal, keputusan rapat), sehingga perlu dicek manusia.

Aturan:
- Bersikap ketat. Bila ragu antara "terpenuhi" dan "belum", pilih "belum". Masukan bersifat "menelaah/menilai apakah perlu" dianggap terpenuhi bila hasil telaahnya tercermin di data (mis. risiko sudah ditambahkan) atau kolom tanggapan menjelaskan keputusan tidak menambahkan beserta alasan yang wajar.
- Kolom "tanggapan" adalah komitmen/penjelasan entitas; pakai sebagai konteks, tetapi klaim di tanggapan tetap harus terlihat di data bila menyangkut isi kertas kerja.
- Jangan mengarang fakta di luar data.
- alasan: 1-3 kalimat bukti atau dasar putusan. kekurangan: hal konkret yang masih perlu dilengkapi; string kosong bila terpenuhi.
- id WAJIB persis id masukan. Kembalikan satu hasil untuk setiap masukan.
- Bahasa Indonesia formal.

${PROFIL_KINRA}`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hasil"],
  properties: {
    hasil: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "putusan", "alasan", "kekurangan"],
        properties: {
          id: { type: "string" },
          putusan: { type: "string", enum: ["terpenuhi", "belum", "verifikasi_manual"] },
          alasan: { type: "string" },
          kekurangan: { type: "string" },
        },
      },
    },
  },
};

/**
 * Validasi AI atas masukan challenge session. Teks masukan dan tanggapan diambil dari database (bukan dari browser),
 * lalu hasilnya disimpan di server: putusan "terpenuhi" menjadi satu-satunya jalan otomatis ke status Selesai.
 */
export async function POST(req: Request) {
  let input: ValidasiInput;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  const ids = [...new Set((input.masukan ?? []).map((m) => m.id))];
  if (!ids.length) return NextResponse.json({ hasil: [] });

  const db = adminDb();
  const { data: rows, error } = await db.from("challenge_log").select("id,ref_label,masukan,tanggapan,status").in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const terbuka = (rows ?? []).filter((r) => r.status !== "Selesai");
  if (!terbuka.length) return NextResponse.json({ hasil: [] });

  const masukan = terbuka.map(({ id, ref_label, masukan, tanggapan }) => ({ id, ref_label, masukan, tanggapan }));
  const r = await callStructured<{ hasil: HasilValidasi[] }>({
    system: SYSTEM, name: "validasi_challenge", schema: SCHEMA,
    user: `Lembar: ${input.lembar}\n\nMasukan challenge session (JSON):\n${JSON.stringify(masukan)}\n\nIsi kertas kerja saat ini (JSON):\n${JSON.stringify(input.data)}`,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const byId = new Map(terbuka.map((x) => [x.id, x]));
  const hasil = r.data.hasil.filter((h) => byId.has(h.id));
  const waktu = new Date().toISOString();
  const tgl = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  for (const h of hasil) {
    const lama = byId.get(h.id)!;
    const patch: Record<string, unknown> = {
      validasi_ai: { putusan: h.putusan, alasan: h.alasan, kekurangan: h.kekurangan, model: r.model, waktu }, updated_at: waktu,
    };
    if (h.putusan === "terpenuhi") {
      patch.status = "Selesai";
      if (!lama.tanggapan) patch.tanggapan = `Divalidasi AI ${tgl}: ${h.alasan}`;
    }
    const { error: e } = await db.from("challenge_log").update(patch).eq("id", h.id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }
  return NextResponse.json({ hasil, model: r.model });
}

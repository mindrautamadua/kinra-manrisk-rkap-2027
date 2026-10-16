import { NextResponse } from "next/server";
import type { HasilValidasi, ValidasiInput } from "@/lib/validasi-challenge";
import { callStructured } from "@/lib/openai";
import { PROFIL_KINRA } from "@/lib/isi-ai-prompt";

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

export async function POST(req: Request) {
  let input: ValidasiInput;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  if (!input.masukan?.length) return NextResponse.json({ hasil: [] });

  const r = await callStructured<{ hasil: HasilValidasi[] }>({
    system: SYSTEM, name: "validasi_challenge", schema: SCHEMA,
    user: `Lembar: ${input.lembar}\n\nMasukan challenge session (JSON):\n${JSON.stringify(input.masukan)}\n\nIsi kertas kerja saat ini (JSON):\n${JSON.stringify(input.data)}`,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const ids = new Set(input.masukan.map((m) => m.id));
  return NextResponse.json({ hasil: r.data.hasil.filter((h) => ids.has(h.id)), model: r.model });
}

import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import { ATURAN_PIC } from "@/lib/isi-ai-prompt";
import { KATEGORI_MITIGASI } from "@/lib/types";
import type { SaranMitigasiRequest, SaranMitigasiResponse } from "@/lib/saran-mitigasi";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `Anda reviewer manajemen risiko untuk Kertas Kerja Perencanaan Manajemen Risiko RKAP 2027 (template PT DAM v.2, Taksonomi Risiko PTPN Group) entitas anak perusahaan di lingkungan PTPN III (Persero).
Tugas: memberi masukan rencana mitigasi untuk satu risk event pada Risk Register.

Aturan:
- evaluasi: bila rencana mitigasi saat ini terisi, beri 1-3 kalimat penilaian (apakah menyasar root cause, berbeda dari existing control, serta memuat PIC/fungsi, waktu, dan target terukur) beserta hal yang perlu diperbaiki. Bila kosong, isi "".
- opsi: 3 alternatif rencana mitigasi BARU untuk RKAP 2027 yang berbeda pendekatannya (mis. satu Preventive yang menyasar root cause, satu Detective/peringatan dini, satu Corrective/pemulihan dampak; sesuaikan bila tidak relevan).
- rencana: 1-2 kalimat Bahasa Indonesia formal, spesifik dan terukur, WAJIB memuat Bagian PIC pelaksana, waktu (mis. "paling lambat TW II 2027"), dan target terukur. Jangan mengulang existing control.
- JANGAN mengarang fakta spesifik (nominal, nama bank/mitra, nomor dokumen). Angka target yang belum diketahui ditulis "[...]%" atau "[...]".
- kategori: Preventive bila mencegah penyebab, Detective bila mendeteksi dini, Corrective bila memulihkan dampak.
- alasan: 1 kalimat mengapa opsi ini efektif terhadap root cause/dampak risiko tersebut.`;

export async function POST(req: Request) {
  let input: SaranMitigasiRequest;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  if (!input.risiko?.risk_event) return NextResponse.json({ error: "Pilih Risk Event dari taksonomi terlebih dahulu." }, { status: 400 });

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["evaluasi", "opsi"],
    properties: {
      evaluasi: { type: "string" },
      opsi: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["rencana", "kategori", "alasan"],
          properties: { rencana: { type: "string" }, kategori: { type: "string", enum: [...KATEGORI_MITIGASI] }, alasan: { type: "string" } },
        },
      },
    },
  };

  const r = await callStructured<Omit<SaranMitigasiResponse, "model">>({
    system: `${SYSTEM}\n\n${ATURAN_PIC}`, user: `Data risiko (JSON): ${JSON.stringify(input.risiko)}`, name: "saran_mitigasi", schema, effort: "low",
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const out: SaranMitigasiResponse = { evaluasi: r.data.evaluasi, opsi: r.data.opsi.slice(0, 5), model: r.model };
  return NextResponse.json(out);
}

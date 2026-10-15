import { NextResponse } from "next/server";
import type { HasilReview, ReviewInput, TemuanAI } from "@/lib/review-ai";
import { callStructured } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `Anda reviewer senior manajemen risiko (Lini 2) di PTPN III (Persero) yang menyiapkan challenge session RKAP 2027 untuk anak perusahaan.
Tugas: menilai KUALITAS ISI kertas kerja manajemen risiko, bukan kelengkapan kolom (kelengkapan sudah diperiksa sistem lain).

Nilai hal berikut:
1. RAS: apakah rasionalisasi benar-benar menjelaskan alasan pemilihan sikap risiko sesuai karakter usaha entitas (bukan sekadar mengulang pernyataan), dan apakah pernyataan konsisten dengan sikapnya (mis. "Zero Tolerance" tetapi kalimatnya menerima penyimpangan).
2. Risk Register: apakah root cause benar-benar penyebab (bukan gejala atau pengulangan risk event), apakah deskripsi dampak masuk akal, dan apakah rencana mitigasi menyasar root cause, spesifik, terukur, dan berbeda dari existing control. Prioritaskan risiko top_risk=true.
3. RAM: untuk parameter berstatus Kuning/Oranye/Merah, apakah inisiatif/kebijakan/program pengendalian relevan dan cukup kuat untuk mengembalikan parameter ke dalam threshold.

Aturan:
- Hanya laporkan masalah nyata dan spesifik; jangan mengarang fakta di luar data. Jika suatu bagian kosong, cukup satu temuan singkat (kelengkapan bukan fokus).
- severity: "kritis" = akan dipersoalkan serius oleh reviewer/dapat membuat sikap atau mitigasi tidak dapat dipertahankan; "perhatian" = perlu dipertajam; "info" = saran perbaikan kecil.
- ref_id WAJIB persis id dari data (id RAS, id risiko, atau kode parameter). ref_label singkat, mis. "RAS Risiko Pasar", "Risiko #2 Kegagalan Memperoleh Pendanaan", "Parameter 1b Penurunan Market Share".
- saran berupa perbaikan konkret (boleh berisi contoh kalimat). pertanyaan_reviewer = satu pertanyaan tajam yang kemungkinan diajukan saat challenge session.
- Gunakan Bahasa Indonesia formal. Maksimal 25 temuan, urutkan dari paling penting.
- ringkasan: 2-3 kalimat penilaian umum kualitas kertas kerja.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ringkasan", "temuan"],
  properties: {
    ringkasan: { type: "string" },
    temuan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "ref_id", "ref_label", "severity", "aspek", "masalah", "saran", "pertanyaan_reviewer"],
        properties: {
          area: { type: "string", enum: ["RAS", "Risk Register", "RAM"] },
          ref_id: { type: "string" },
          ref_label: { type: "string" },
          severity: { type: "string", enum: ["kritis", "perhatian", "info"] },
          aspek: { type: "string", description: "Aspek yang dinilai, mis. Rasionalisasi, Root Cause, Relevansi Mitigasi" },
          masalah: { type: "string" },
          saran: { type: "string" },
          pertanyaan_reviewer: { type: "string" },
        },
      },
    },
  },
};

export async function POST(req: Request) {
  let input: ReviewInput;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }

  const r = await callStructured<{ ringkasan: string; temuan: TemuanAI[] }>({
    system: SYSTEM, name: "review_kualitas", schema: SCHEMA,
    user: `Entitas: ${input.entitas}\n\nData kertas kerja (JSON):\n${JSON.stringify({ ras: input.ras, risiko: input.risiko, parameter: input.parameter })}`,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const out: HasilReview = { ...r.data, model: r.model, waktu: new Date().toISOString() };
  return NextResponse.json(out);
}

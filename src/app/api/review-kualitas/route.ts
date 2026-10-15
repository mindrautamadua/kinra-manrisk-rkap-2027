import { NextResponse } from "next/server";
import type { HasilReview, ReviewInput, TemuanAI } from "@/lib/review-ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

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
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "OPENAI_API_KEY belum diisi di .env.local." }, { status: 500 });

  let input: ReviewInput;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "medium",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Entitas: ${input.entitas}\n\nData kertas kerja (JSON):\n${JSON.stringify({ ras: input.ras, risiko: input.risiko, parameter: input.parameter })}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "review_kualitas", strict: true, schema: SCHEMA } },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json({ error: `OpenAI: ${body?.error?.message ?? res.statusText}` }, { status: 502 });
  }
  const msg = body?.choices?.[0]?.message;
  if (msg?.refusal) return NextResponse.json({ error: `Model menolak: ${msg.refusal}` }, { status: 502 });
  try {
    const parsed = JSON.parse(msg?.content ?? "") as { ringkasan: string; temuan: TemuanAI[] };
    const out: HasilReview = { ...parsed, model: body.model ?? MODEL, waktu: new Date().toISOString() };
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "Respons model tidak dapat dibaca. Coba lagi." }, { status: 502 });
  }
}

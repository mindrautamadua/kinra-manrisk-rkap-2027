import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import type { KaitkanRequest, KaitkanResponse } from "@/lib/kaitkan-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `Anda asisten penyusun Kertas Kerja Perencanaan Manajemen Risiko RKAP 2027 (template PT DAM v.2, Taksonomi Risiko PTPN Group) untuk entitas anak perusahaan di lingkungan PTPN III (Persero).
Tugas: dari daftar pilihan yang diberikan, pilih item yang paling relevan dengan satu risk event pada Risk Register.

Aturan:
- Hanya pilih kode yang ada di daftar pilihan. Pilih 1-3 item yang paling kuat kaitannya; jangan memilih item yang kaitannya lemah atau dipaksakan.
- Urutkan dari yang paling relevan.
- alasan: 1 kalimat Bahasa Indonesia formal yang menjelaskan hubungan langsung antara risk event (atau root cause/dampaknya) dengan item tersebut.
- catatan: 1 kalimat ringkas bila ada hal yang perlu diverifikasi pengguna; kosongkan ("") bila tidak ada.`;

const KHUSUS = {
  parameter: `Daftar pilihan: parameter Risk Acceptance Matrix (RAM).
Pilih parameter yang nilainya akan bergerak (memburuk) bila risk event ini terjadi, atau yang menangkap risk driver-nya. Utamakan parameter sekategori dengan risiko dan yang berstatus diterapkan.`,
  sasaran: `Daftar pilihan: Sasaran Strategis RJPP 2026-2030.
Pilih sasaran strategis yang pencapaiannya terancam bila risk event ini terjadi (dampak risiko menghambat sasaran tersebut).`,
} as const;

export async function POST(req: Request) {
  let input: KaitkanRequest;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  if (!(input.jenis in KHUSUS) || !Array.isArray(input.pilihan) || input.pilihan.length === 0 || !input.risiko?.risk_event) {
    return NextResponse.json({ error: "Permintaan tidak lengkap." }, { status: 400 });
  }

  const kode = input.pilihan.map((p) => p.kode);
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["saran", "catatan"],
    properties: {
      saran: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["kode", "alasan"],
          properties: { kode: { type: "string", enum: kode }, alasan: { type: "string" } },
        },
      },
      catatan: { type: "string" },
    },
  };

  const user = [
    `Risk event (JSON): ${JSON.stringify(input.risiko)}`,
    `Daftar pilihan (JSON): ${JSON.stringify(input.pilihan)}`,
  ].join("\n\n");

  const r = await callStructured<{ saran: { kode: string; alasan: string }[]; catatan: string }>({
    system: `${SYSTEM}\n\n${KHUSUS[input.jenis]}`, user, name: "kaitkan_item", schema, effort: "low",
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  // Buang duplikat dan batasi jumlah saran.
  const seen = new Set<string>();
  const saran = r.data.saran.filter((s) => kode.includes(s.kode) && !seen.has(s.kode) && seen.add(s.kode)).slice(0, 5);
  const out: KaitkanResponse = { saran, catatan: r.data.catatan, model: r.model };
  return NextResponse.json(out);
}

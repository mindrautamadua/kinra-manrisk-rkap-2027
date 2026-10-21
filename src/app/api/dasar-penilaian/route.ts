import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import { PROFIL_KINRA } from "@/lib/isi-ai-prompt";
import { adminDb } from "@/lib/server-db";
import type { DasarPenilaianRequest, SaranDasarPenilaian } from "@/lib/dasar-penilaian";

export const runtime = "nodejs";
export const maxDuration = 240;

const SYSTEM = `Anda analis manajemen risiko yang menulis kolom "Dasar Penilaian Probabilitas & Dampak" pada Risk Register RKAP 2027 PT KINRA
(arahan Challenge Session: probabilitas dan dampak didukung data historis, proyeksi RKAP 2027, dan analisis skenario yang dapat dipertanggungjawabkan).
Untuk SETIAP risiko tulis dasar_penilaian dengan tiga bagian berlabel, ringkas (total 4-7 kalimat):
"Historis: ..." — HANYA dari data historis pada konteks (tren realisasi vs RKAP 2021-2025 Renstra, analisis DKMR), sebut sumbernya (mis. "Renstra hal 75", "DKMR hal 42"). Bila tidak ada data kejadian yang relevan, tulis "Data kejadian historis belum tersedia; [perlu dilengkapi <Bagian> dari loss event database/laporan insiden 2021-2025]". DILARANG mengarang angka atau kejadian historis.
"Proyeksi RKAP 2027: ..." — kaitkan nilai_dampak dengan pos RKAP 2027 yang terdampak (sebut nilai pos dan persentasenya), hanya memakai angka pada konteks.
"Skenario: ringan Rp..., dasar Rp..., berat Rp..." — skenario dampak yang konsisten dengan proyeksi; skenario dasar sebaiknya mendekati nilai_dampak. Jelaskan asumsi tiap skenario singkat. Bila probabilitas diisi, jelaskan dasar probabilitasnya (frekuensi historis atau penilaian ahli).
perlu_tinjau = true bila nilai_dampak atau probabilitas yang tercatat jauh (lebih dari 2x) dari skenario dasar, atau datanya tidak memadai; sebutkan alasannya di akhir dengan awalan "⚠ ".
Jangan mengubah angka yang tercatat. Bahasa Indonesia formal. Nilai rupiah dalam format "Rp7,5 M" / "Rp750 jt". id WAJIB persis.

${PROFIL_KINRA}`;

/** Halaman Renstra (tren dan proyeksi) dan DKMR (ringkasan, asumsi, analisis risiko) dari Storage privat. */
async function referensi() {
  const { data } = await adminDb().storage.from("referensi").download("referensi-halaman.json");
  if (!data) return "(dokumen referensi belum diunggah)";
  const hal = JSON.parse(await data.text()) as { dok: string; hal: number; judul: string; isi: string }[];
  const pilih = (dok: string, list: number[]) => hal.filter((h) => h.dok === dok && list.includes(h.hal)).map((h) => `## ${dok === "dkmr" ? "DKMR" : "Renstra"} hal ${h.hal} — ${h.judul}\n${h.isi}`);
  return [...pilih("renstra", [3, 17, 20, 75, 76, 77]), ...pilih("dkmr", [12, 13, 35, 36, 41, 42, 43, 44, 45])].join("\n\n").slice(0, 60_000);
}

export async function POST(req: Request) {
  let input: DasarPenilaianRequest;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  if (!input.risiko?.length) return NextResponse.json({ hasil: [] });

  const schema = {
    type: "object", additionalProperties: false, required: ["hasil"],
    properties: { hasil: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["id", "dasar_penilaian", "perlu_tinjau"],
      properties: { id: { type: "string" }, dasar_penilaian: { type: "string" }, perlu_tinjau: { type: "boolean" } },
    } } },
  };
  const user = [
    `Angka RKAP 2027 (Data Keuangan aktif): ${JSON.stringify(input.rkap)}`,
    `Risiko (JSON; nilai_dampak dalam rupiah penuh, probabilitas 0-1): ${JSON.stringify(input.risiko)}`,
    `Dokumen referensi:\n${await referensi().catch(() => "(gagal memuat referensi)")}`,
  ].join("\n\n");

  const r = await callStructured<{ hasil: SaranDasarPenilaian[] }>({ system: SYSTEM, user, name: "dasar_penilaian", schema, effort: "medium" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const ids = new Set(input.risiko.map((x) => x.id));
  return NextResponse.json({ hasil: r.data.hasil.filter((h) => ids.has(h.id)), model: r.model });
}

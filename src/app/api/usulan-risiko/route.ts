import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import { ATURAN_PIC } from "@/lib/isi-ai-prompt";
import type { UsulanRisikoRequest, UsulanRisikoResponse } from "@/lib/usulan-risiko";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `Anda analis manajemen risiko untuk Kertas Kerja Perencanaan Manajemen Risiko RKAP 2027 (template PT DAM v.2, Taksonomi Risiko PTPN Group) entitas anak perusahaan di lingkungan PTPN III (Persero).
Tugas: mengusulkan Risk Event BARU untuk Risk Register yang relevan dengan model bisnis entitas, Sasaran Strategis RJPP 2026-2030, serta target dan program RKAP 2027.

Aturan:
- Pilih risiko HANYA dari daftar kandidat taksonomi (kode). Jangan mengusulkan risiko yang sudah ada di register.
- Usulkan 5-8 risiko yang paling material, diurutkan dari yang paling penting. Utamakan risiko yang mengancam pos pendapatan/laba RKAP terbesar, sasaran strategis RJPP, dan program strategis 2027. Sebarkan ke beberapa kategori bila relevan.
- deskripsi: 1-2 kalimat yang menerjemahkan risiko korporat taksonomi ke konteks spesifik entitas (segmen usaha, kawasan, pos RKAP yang terdampak).
- root_cause: penyebab mendasar yang wajar untuk entitas, boleh 2 penyebab bernomor "1) ... 2) ...".
- deskripsi_dampak: konsekuensi finansial dan/atau non-finansial; sebut pos RKAP yang terdampak bila ada. JANGAN mengarang angka; gunakan "[...]" bila perlu.
- sasaran: kode Sasaran Strategis RJPP yang terancam (1-3 kode dari daftar), atau [] bila tidak ada.
- alasan: 1 kalimat mengapa risiko ini relevan bagi entitas berdasarkan RJPP/RKAP pada konteks.
- catatan: 1-2 kalimat asumsi atau hal yang perlu diverifikasi pengguna.`;

const MAX = 60_000;

export async function POST(req: Request) {
  let input: UsulanRisikoRequest;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  if (!Array.isArray(input.kandidat) || !input.kandidat.length) {
    return NextResponse.json({ error: "Semua risiko taksonomi sudah ada di register." }, { status: 400 });
  }

  const kode = input.kandidat.map((k) => k.kode);
  const kodeSasaran = (input.sasaran ?? []).map((s) => s.kode);
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["usulan", "catatan"],
    properties: {
      usulan: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          required: ["kode", "deskripsi", "root_cause", "deskripsi_dampak", "sasaran", "alasan"],
          properties: {
            kode: { type: "string", enum: kode },
            deskripsi: { type: "string" }, root_cause: { type: "string" }, deskripsi_dampak: { type: "string" },
            sasaran: { type: "array", items: kodeSasaran.length ? { type: "string", enum: kodeSasaran } : { type: "string" } },
            alasan: { type: "string" },
          },
        },
      },
      catatan: { type: "string" },
    },
  };

  const user = [
    `Entitas: ${input.entitas}`,
    `Arahan pengguna: ${input.instruksi?.trim() || "(tidak ada)"}`,
    `Sasaran Strategis RJPP 2026-2030 (JSON): ${JSON.stringify(input.sasaran ?? [])}`,
    `Ringkasan RKAP 2027 (JSON): ${JSON.stringify(input.rkap ?? {}).slice(0, 15_000)}`,
    `Risk event yang sudah ada di register (JSON): ${JSON.stringify(input.register ?? [])}`,
    `Kandidat taksonomi (JSON): ${JSON.stringify(input.kandidat)}`,
  ].join("\n\n").slice(0, MAX);

  const r = await callStructured<Omit<UsulanRisikoResponse, "model">>({
    system: `${SYSTEM}\n\n${ATURAN_PIC}`, user, name: "usulan_risiko", schema, effort: "medium",
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const seen = new Set<string>();
  const usulan = r.data.usulan
    .filter((u) => kode.includes(u.kode) && !seen.has(u.kode) && seen.add(u.kode))
    .map((u) => ({ ...u, sasaran: [...new Set(u.sasaran.filter((s) => kodeSasaran.includes(s)))].slice(0, 3) }))
    .slice(0, 10);
  const out: UsulanRisikoResponse = { usulan, catatan: r.data.catatan, model: r.model };
  return NextResponse.json(out);
}

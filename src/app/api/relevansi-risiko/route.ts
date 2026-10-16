import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import { PROFIL_KINRA } from "@/lib/isi-ai-prompt";
import { TINGKAT, type HasilRelevansi, type RelevansiRequest } from "@/lib/relevansi-risiko";

export const runtime = "nodejs";
export const maxDuration = 180;

const SYSTEM = `Anda reviewer senior manajemen risiko (Lini 2) di PTPN III (Persero) yang menguji RELEVANSI Risk Register RKAP 2027 milik PT KINRA sebelum challenge session.

${PROFIL_KINRA}

Tugas: untuk SETIAP risiko di register, nilai apakah risiko itu relevan dengan konteks bisnis KINRA dan apakah uraiannya sudah dikontekstualkan.
- "Relevan": risiko jelas terkait segmen usaha, pos RKAP, sasaran RJPP, atau program strategis KINRA, dan deskripsi/root cause/dampak sudah spesifik untuk KINRA.
- "Perlu dikontekstualkan": risikonya relevan, tetapi uraian masih generik (menyalin definisi taksonomi), menyebut konteks entitas lain (mis. kebun, TBS, CPO, PKS, tanaman), atau tidak menyebut segmen/pos/sasaran yang terdampak.
- "Kurang relevan": risiko tidak punya jalur yang masuk akal ke bisnis KINRA (mis. risiko budidaya/produksi komoditas yang tidak dijalankan KINRA), atau materialitasnya sangat kecil dibanding pos RKAP. Jelaskan mengapa, dan bila ada versi yang relevan bagi KINRA, sebut di saran_deskripsi.

Aturan:
- alasan: 1-2 kalimat, sebut dasar konkret (nama pos RKAP beserta nilainya, kode sasaran, atau nama program).
- kaitan: 0-4 rujukan singkat yang benar-benar ada di data, mis. "Pendapatan Pengolahan Air Bersih", "SG-2", "Program: ...". Kosongkan bila tidak ada.
- masalah: 1 kalimat kelemahan uraian terkait konteks; "" bila tidak ada.
- saran_deskripsi: usulan Deskripsi Risk Event 1-2 kalimat yang spesifik KINRA (segmen, kawasan, pos RKAP terdampak) bila relevansi bukan "Relevan"; "" bila sudah memadai. JANGAN mengarang angka, nama mitra, atau tanggal; pakai "[...]" bila perlu.
- celah: 0-5 tema risiko material bagi KINRA (berdasarkan pos pendapatan terbesar, sasaran RJPP, atau program strategis) yang BELUM tercakup register. Hanya bila dasarnya jelas dari data.
- ringkasan: 2-3 kalimat kesimpulan tingkat register (sebaran relevansi, pola masalah utama).
- Nilai semua risiko yang diberikan, masing-masing tepat satu kali dengan id yang sama. Bahasa Indonesia formal, ringkas.`;

export async function POST(req: Request) {
  let d: RelevansiRequest;
  try { d = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  const risiko = (d?.risiko ?? []).filter((r) => r.id && r.risk_event);
  if (!risiko.length) return NextResponse.json({ error: "Belum ada risiko berisi Risk Event untuk dinilai." }, { status: 400 });

  const ids = risiko.map((r) => r.id);
  const schema = {
    type: "object", additionalProperties: false, required: ["ringkasan", "penilaian", "celah"],
    properties: {
      ringkasan: { type: "string" },
      penilaian: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["id", "relevansi", "alasan", "kaitan", "masalah", "saran_deskripsi"],
          properties: {
            id: { type: "string", enum: ids },
            relevansi: { type: "string", enum: [...TINGKAT] },
            alasan: { type: "string" },
            kaitan: { type: "array", items: { type: "string" } },
            masalah: { type: "string" },
            saran_deskripsi: { type: "string" },
          },
        },
      },
      celah: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["tema", "alasan"], properties: { tema: { type: "string" }, alasan: { type: "string" } } },
      },
    },
  };

  const user = [
    `Entitas: ${d.entitas}`,
    `Data Keuangan RKAP 2027, Rp setahun (JSON): ${JSON.stringify(d.konteks?.keuangan_rkap_2027 ?? "(tidak ada)")}`,
    `Sasaran Strategis RJPP 2026-2030 (JSON): ${JSON.stringify(d.konteks?.sasaran ?? [])}`,
    `Program Strategis RKAP 2027 (JSON): ${JSON.stringify(d.konteks?.program ?? []).slice(0, 15_000)}`,
    `Risk Register (JSON): ${JSON.stringify(risiko, (k, v) => (k === "sidik" ? undefined : v))}`,
  ].join("\n\n");

  const r = await callStructured<Omit<HasilRelevansi, "model" | "waktu">>({ system: SYSTEM, user, name: "relevansi_risiko", schema, effort: "medium" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const sidik = new Map(risiko.map((x) => [x.id, x.sidik]));
  const seen = new Set<string>();
  const out: HasilRelevansi = {
    ringkasan: r.data.ringkasan,
    penilaian: r.data.penilaian
      .filter((p) => sidik.has(p.id) && !seen.has(p.id) && seen.add(p.id))
      .map((p) => ({ ...p, kaitan: p.kaitan.slice(0, 4), sidik: sidik.get(p.id)! })),
    celah: r.data.celah.slice(0, 5),
    model: r.model, waktu: new Date().toISOString(),
  };
  return NextResponse.json(out);
}

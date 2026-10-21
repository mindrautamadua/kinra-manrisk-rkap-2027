import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import { PROFIL_KINRA } from "@/lib/isi-ai-prompt";
import { adminDb } from "@/lib/server-db";
import { PROSES_BISNIS, type KeterkaitanRequest, type SaranKeterkaitan } from "@/lib/keterkaitan-rkap";

export const runtime = "nodejs";
export const maxDuration = 180;

const SYSTEM = `Anda analis manajemen risiko yang memetakan setiap risk event PT KINRA ke RKAP 2027 (arahan Challenge Session: Risk Register disusun berdasarkan sasaran strategis, proses bisnis, program kerja, serta asumsi dan target RKAP 2027).
Untuk SETIAP risiko tentukan:
- proses_bisnis: 1-3 proses bisnis yang paling terdampak/menjadi sumber risiko, HANYA dari daftar pilihan.
- pos_rkap: 1-3 kode pos RKAP 2027 yang targetnya terancam bila risiko terjadi, HANYA dari daftar pos. Pilih pos pendapatan segmen yang relevan; tambahkan pos beban bila risiko menaikkan biaya; EBITDA/laba bersih hanya bila dampaknya lintas segmen.
- program_kerja_rkap: 1-2 kalimat menyebut program kerja dan/atau asumsi RKAP 2027 yang terkait, mengutip angka asumsi dari "asumsi_rkap_dkmr" bila ada (sebut "DKMR hal N"). Jangan mengarang angka atau nama program yang tidak ada di konteks; bila tidak ada rujukan, tulis program kerja yang wajar dengan penanda "[...]" untuk angkanya.
- id WAJIB persis id risiko. Satu hasil per risiko. Bahasa Indonesia formal.

${PROFIL_KINRA}`;

/** Asumsi utama dan program kerja pencapaian target RKAP 2027 dari Presentasi DKMR (Storage privat), bila sudah diunggah. */
async function asumsiDkmr() {
  const { data } = await adminDb().storage.from("referensi").download("referensi-halaman.json");
  if (!data) return null;
  const hal = JSON.parse(await data.text()) as { dok: string; hal: number; judul: string; isi: string }[];
  return hal.filter((h) => h.dok === "dkmr" && h.hal >= 4 && h.hal <= 13).map((h) => `## DKMR hal ${h.hal} — ${h.judul}\n${h.isi}`).join("\n\n").slice(0, 30_000);
}

export async function POST(req: Request) {
  let input: KeterkaitanRequest;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  if (!input.risiko?.length) return NextResponse.json({ hasil: [] });

  const kodePos = input.pos.map((p) => p.kode);
  const schema = {
    type: "object", additionalProperties: false, required: ["hasil"],
    properties: {
      hasil: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["id", "proses_bisnis", "pos_rkap", "program_kerja_rkap"],
          properties: {
            id: { type: "string" },
            proses_bisnis: { type: "array", items: { type: "string", enum: [...PROSES_BISNIS] } },
            pos_rkap: { type: "array", items: { type: "string", enum: kodePos } },
            program_kerja_rkap: { type: "string" },
          },
        },
      },
    },
  };

  const asumsi = await asumsiDkmr().catch(() => null);
  const user = [
    `Daftar proses bisnis: ${JSON.stringify(PROSES_BISNIS)}`,
    `Daftar pos RKAP 2027 (kode dan nilai): ${JSON.stringify(input.pos)}`,
    `Risiko (JSON): ${JSON.stringify(input.risiko)}`,
    `asumsi_rkap_dkmr:\n${asumsi ?? "(belum tersedia)"}`,
  ].join("\n\n");

  const r = await callStructured<{ hasil: SaranKeterkaitan[] }>({ system: SYSTEM, user, name: "keterkaitan_rkap", schema, effort: "low" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const ids = new Set(input.risiko.map((x) => x.id));
  return NextResponse.json({ hasil: r.data.hasil.filter((h) => ids.has(h.id)), model: r.model });
}

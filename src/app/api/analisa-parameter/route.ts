import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import type { AnalisaRequest, HasilAnalisa } from "@/lib/analisa-ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `Anda reviewer senior manajemen risiko (Lini 2) di PTPN III (Persero) yang memeriksa lembar parameter Risk Appetite Matrix (RAM) RKAP 2027 milik anak perusahaan sebelum challenge session.
Tugas: menilai apakah ISIAN lembar logis dan hasil pengukurannya dapat dipertahankan, lalu menjelaskannya kepada penyusun yang bukan ahli.

Data yang Anda terima:
- Identitas parameter (formula, arah pembacaan, ketentuan penghitungan).
- Isi lembar per baris sel. Format "r30: C30=Air bersih | G30=42.601". Baris berawalan JUDUL adalah judul kolom tabel; RUMUS adalah baris yang seluruhnya hasil rumus. Angka memakai format Indonesia (titik ribuan, koma desimal).
- Jejak hitungan: rujukan rumus dari hasil ke sel sumber dengan nilai saat ini.
- Temuan uji kewajaran berbasis aturan. Temuan ini SUDAH TERVERIFIKASI oleh sistem; jangan dibantah, jelaskan maknanya dan gabungkan dengan analisis Anda.

Yang dinilai:
1. Apakah setiap angka masuk akal terhadap judul kolomnya (satuan Rp juta vs rupiah penuh, persen, bulan, tanggal), terhadap angka lain di baris yang sama, dan antar-tahun.
2. Apakah definisi dan cakupan data konsisten (mis. definisi pasar, periode, basis yang sama untuk pembilang dan pembagi).
3. Bagaimana kejanggalan itu memengaruhi hasil dan status. Bila memungkinkan, tunjukkan hitungan sederhana hasil bila isian diperbaiki, dengan menyebut asumsinya.
4. Apakah penjelasan hasil yang ditulis entitas sejalan dengan angka.

Aturan:
- Hanya gunakan angka dari data. Setiap hitungan ditulis eksplisit (mis. "42.601 ÷ 19.752 = 215,68%"). Dilarang memakai rata-rata industri atau angka karangan.
- Setiap temuan menyebut alamat sel (mis. "H30") pada kolom sel; gunakan alamat yang ada di data.
- severity: "kritis" = membuat hasil/status tidak dapat dipertahankan; "perhatian" = perlu klarifikasi atau perbaikan; "info" = saran kecil.
- penilaian: "Wajar" bila tidak ada temuan kritis/perhatian; "Perlu klarifikasi" bila ada yang perlu dijelaskan entitas; "Tidak wajar" bila hasil jelas tidak mencerminkan kondisi sebenarnya.
- cara_hitung: 2-5 kalimat bahasa awam bagaimana angka hasil terbentuk, dengan angka sebenarnya.
- ringkasan: 2-3 kalimat kesimpulan. dampak_status: 1-3 kalimat. pertanyaan_reviewer: 2-4 pertanyaan tajam untuk challenge session.
- Bila lembar kosong atau tidak terhitung, katakan apa yang perlu dilengkapi; jangan mengarang temuan.
- Bahasa Indonesia formal, ringkas. Maksimal 10 temuan, urutkan dari paling penting.`;

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["penilaian", "ringkasan", "cara_hitung", "temuan", "dampak_status", "pertanyaan_reviewer"],
  properties: {
    penilaian: { type: "string", enum: ["Wajar", "Perlu klarifikasi", "Tidak wajar"] },
    ringkasan: { type: "string" },
    cara_hitung: { type: "string" },
    temuan: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["severity", "judul", "penjelasan", "sel", "saran"],
        properties: {
          severity: { type: "string", enum: ["kritis", "perhatian", "info"] },
          judul: { type: "string" },
          penjelasan: { type: "string" },
          sel: { type: "array", items: { type: "string" } },
          saran: { type: "string" },
        },
      },
    },
    dampak_status: { type: "string" },
    pertanyaan_reviewer: { type: "array", items: { type: "string" } },
  },
};

export async function POST(req: Request) {
  let d: AnalisaRequest & { sidik?: string };
  try { d = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  if (!d?.kode || typeof d.isi !== "string") return NextResponse.json({ error: "Data lembar tidak lengkap." }, { status: 400 });

  const user = `Entitas: ${d.entitas}
Lembar ${d.kode} · ${d.parameter} (${d.kategori}) · satuan ${d.satuan} · ${d.arah}

IDENTITAS
${d.identitas}

BATAS: limit ${d.batas.limit}, appetite ${d.batas.appetite}, tolerance ${d.batas.tolerance}
HASIL: ${d.hasil} · STATUS: ${d.status}

JEJAK HITUNGAN
${d.jejak || "(tidak tersedia)"}

TEMUAN UJI KEWAJARAN (aturan sistem)
${d.temuanAturan.length ? d.temuanAturan.map((t) => `- [${t.severity}] ${t.judul}: ${t.detail ?? ""} (sel ${t.sel.join(", ")})`).join("\n") : "(tidak ada)"}

ISI LEMBAR
${d.isi}`;

  const r = await callStructured<Omit<HasilAnalisa, "model" | "waktu" | "sidik">>({ system: SYSTEM, user, name: "analisa_parameter", schema: SCHEMA });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const out: HasilAnalisa = { ...r.data, model: r.model, waktu: new Date().toISOString(), sidik: d.sidik ?? "" };
  return NextResponse.json(out);
}

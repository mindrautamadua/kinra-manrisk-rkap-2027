import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import type { IsiRequest, IsiResponse, JenisIsi } from "@/lib/isi-ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const UMUM = `Anda asisten penyusun Kertas Kerja Perencanaan Manajemen Risiko RKAP 2027 (template PT DAM v.2, Taksonomi Risiko PTPN Group) untuk entitas anak perusahaan di lingkungan PTPN III (Persero).
Tugas: menyusun DRAF isi kolom kertas kerja yang diminta, berdasarkan uraian pengguna dan konteks data kertas kerja. Draf akan direviu pengguna sebelum disimpan.

Aturan umum:
- Isi hanya kolom yang diminta. Gunakan Bahasa Indonesia formal, ringkas seperti isi sel kertas kerja (1-3 kalimat; bila berisi beberapa butir, gunakan penomoran singkat "1) ... 2) ...").
- Bila kolom sudah berisi nilai, pertahankan fakta di dalamnya dan pertajam (lebih spesifik, terukur, konsisten). Jangan membuang informasi pengguna.
- JANGAN mengarang fakta yang tidak ada di uraian atau konteks: angka/nominal, persentase, nama bank/mitra, nomor pasal, nomor dokumen, atau tanggal. Gunakan penanda "[...]" untuk bagian yang wajib dilengkapi pengguna, misalnya "Anggaran Dasar Pasal [...]".
- Kolom yang punya daftar pilihan wajib diisi salah satu nilai dari daftar itu.
- Bila uraian pengguna terlalu minim untuk suatu kolom, tetap beri draf yang paling wajar dan sebutkan asumsinya di catatan.
- catatan: 1-4 butir singkat tentang hal yang wajib diverifikasi atau dilengkapi pengguna (termasuk angka yang harus diisi manual dan asumsi yang dipakai).`;

const KHUSUS: Record<JenisIsi, string> = {
  cat: `Lembar: Corporate Action Threshold (CAT).
- Aksi korporasi adalah tindakan Direksi yang memerlukan persetujuan Dewan Komisaris/RUPS menurut Anggaran Dasar, misalnya mengagunkan aset, menerima pinjaman jangka panjang, penyertaan modal, pendirian/pelepasan anak perusahaan, pelepasan aset tetap, atau kerja sama jangka panjang.
- jenis: kategori aksi singkat (mis. "Mengagunkan aset"). nama: judul aksi spesifik. rencana_detail: apa, objek, tujuan, dan skema transaksinya.
- dasar_kewenangan: rujukan Anggaran Dasar tentang tindakan Direksi yang memerlukan persetujuan; nomor pasal pakai "[...]".
- rencana_waktu: periode pelaksanaan di 2027 (mis. "Triwulan II 2027") bila dapat disimpulkan; bila tidak, "[...] 2027".
- parameter: parameter akumulasi transaksi yang memantau dampak kumulatif aksi tersebut (mis. Loan to Value, Debt to Equity Ratio, DSCR, akumulasi nilai pelepasan aset terhadap total aset). formula: rumus eksplisit dengan pembilang dan penyebut.
- rasionalisasi_parameter: alasan parameter itu paling tepat mengukur eksposur aksi korporasi tersebut.
- rasionalisasi_threshold: dasar penetapan limit/appetite/tolerance (mis. covenant kreditur, kebijakan Induk, kapasitas pembayaran). Jangan menyebut angka threshold; angka diisi pengguna.`,
  risiko: `Lembar: Risk Register.
- risk_driver: pilih dari daftar pilihan yang paling menjelaskan sumber risiko.
- root_cause: penyebab mendasar (bukan gejala, bukan pengulangan risk event). Boleh 2-3 penyebab bernomor.
- deskripsi_dampak: konsekuensi bila risiko terjadi, finansial dan/atau non-finansial, selaras dengan kriteria dampak acuan.
- kriteria_dampak: bila diminta, pilih kriteria dampak acuan yang paling sesuai dari daftar.
- existing_control: kontrol yang lazimnya sudah berjalan saat ini (kebijakan, SOP, kontrak, monitoring).
- rencana_mitigasi: tindakan BARU untuk RKAP 2027 yang menyasar root cause, spesifik dan terukur (apa, PIC/fungsi, target, waktu), berbeda dari existing control.
- kategori_mitigasi: Preventive bila mencegah penyebab, Detective bila mendeteksi dini, Corrective bila memulihkan dampak.`,
  ras: `Lembar: Risk Appetite Statement (RAS).
- sikap: bila diminta, pilih dari daftar pilihan (daftar sudah dibatasi agar sama atau lebih ketat dari sikap Induk).
- pernyataan: Pernyataan Selera Risiko entitas untuk kategori ini: risiko apa yang diterima/tidak diterima dan batas kualitatifnya. Harus konsisten dengan sikap (mis. Zero Tolerance tidak boleh menerima penyimpangan) dan tidak lebih longgar dari pernyataan Induk. Sesuaikan dengan karakter usaha entitas.
- rasionalisasi: alasan pemilihan sikap tersebut berdasarkan karakter usaha, kondisi, dan strategi entitas; jangan sekadar mengulang pernyataan.`,
  ram: `Lembar: Risk Acceptance Matrix (RAM), kolom Rencana Pengendalian.
- Tujuan pengendalian: menjaga atau mengembalikan hasil parameter ke dalam threshold (limit/appetite/tolerance) dengan memperhatikan arah parameter dan status saat ini.
- inisiatif: inisiatif strategis tingkat korporat (arah besar).
- kebijakan: kebijakan/limit/prosedur yang ditetapkan untuk mengendalikan parameter.
- program: program kerja konkret 2027 dengan target terukur dan waktu; kaitkan dengan root cause atau mitigasi risiko terkait bila ada.
- Jangan mengisi angka anggaran.`,
};

const MAX_KONTEKS = 40_000;

export async function POST(req: Request) {
  let input: IsiRequest;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  if (!KHUSUS[input.jenis] || !Array.isArray(input.fields) || input.fields.length === 0) {
    return NextResponse.json({ error: "Permintaan tidak lengkap." }, { status: 400 });
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["saran", "catatan"],
    properties: {
      saran: {
        type: "object",
        additionalProperties: false,
        required: input.fields.map((f) => f.key),
        properties: Object.fromEntries(input.fields.map((f) => [f.key, {
          type: "string", description: f.label, ...(f.options?.length ? { enum: [...f.options] } : {}),
        }])),
      },
      catatan: { type: "string" },
    },
  };

  const konteks = JSON.stringify(input.konteks ?? {}).slice(0, MAX_KONTEKS);
  const user = [
    `Entitas: ${input.entitas}`,
    `Uraian pengguna: ${input.instruksi?.trim() || "(tidak ada; susun draf dari konteks)"}`,
    `Kolom yang diminta: ${JSON.stringify(input.fields.map((f) => ({ key: f.key, label: f.label, pilihan: f.options })))}`,
    `Nilai kolom saat ini: ${JSON.stringify(input.nilai ?? {})}`,
    `Konteks kertas kerja (JSON): ${konteks}`,
  ].join("\n\n");

  const r = await callStructured<{ saran: Record<string, string>; catatan: string }>({
    system: `${UMUM}\n\n${KHUSUS[input.jenis]}`, user, name: "isi_kertas_kerja", schema, effort: "low",
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const out: IsiResponse = { ...r.data, model: r.model };
  return NextResponse.json(out);
}

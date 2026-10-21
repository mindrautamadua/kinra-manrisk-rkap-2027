import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import type { IsiRequest, IsiResponse, JenisIsi } from "@/lib/isi-ai";
import { ATURAN_PIC, UMUM } from "@/lib/isi-ai-prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

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
- rencana_mitigasi: tindakan BARU untuk RKAP 2027 yang menyasar root cause, spesifik dan terukur (apa, Bagian PIC, target, waktu), berbeda dari existing control.
- kategori_mitigasi: Preventive bila mencegah penyebab, Detective bila mendeteksi dini, Corrective bila memulihkan dampak.`,
  ras: `Lembar: Risk Appetite Statement (RAS).
- sikap: bila diminta, pilih dari daftar pilihan (daftar sudah dibatasi agar sama atau lebih ketat dari sikap Induk).
- pernyataan: Pernyataan Selera Risiko entitas untuk kategori ini: risiko apa yang diterima/tidak diterima dan batas kualitatifnya. Harus konsisten dengan sikap (mis. Zero Tolerance tidak boleh menerima penyimpangan) dan tidak lebih longgar dari pernyataan Induk. Sesuaikan dengan karakter usaha entitas.
- rasionalisasi: alasan pemilihan sikap tersebut berdasarkan karakter usaha, kondisi, dan strategi entitas; jangan sekadar mengulang pernyataan.
- Bila konteks memuat data_pendukung, rasionalisasi WAJIB berpijak pada data itu dengan susunan "1) ... 2) ... 3) ... 4) ...": 1) karakteristik bisnis entitas yang relevan dengan kategori; 2) kondisi keuangan (pakai angka RKAP 2027 dari konteks bila relevan); 3) eksposur risiko dan Risiko Utama pada kategori ini (sebut risk event dan levelnya); 4) hasil pengukuran parameter RAM kategori ini (status dan posisinya terhadap threshold; bila belum diukur atau tidak diterapkan, katakan demikian). Tutup dengan alasan mengapa sikap terpilih (bukan yang lebih ketat/longgar) paling sesuai dan bagaimana sikap itu selaras dengan ambang batas RAM dan materialitas Risiko Utama.
- Ikuti arahan_challenge_session yang relevan dengan kategori (mis. Moderate untuk kegiatan usaha berjalan dan Aggressive untuk program strategis RJPP/penugasan Pemerintah pada Risiko Strategis serta Investasi dan Proyek; kapasitas pendanaan dijaga lewat sikap Conservative Risiko Keuangan). Bila sikap yang diisi bertentangan dengan arahan, jangan ubah sikapnya; tulis di catatan.
- Angka hanya boleh dikutip dari konteks. Rasionalisasi boleh 4-6 kalimat.`,
  ram: `Lembar: Risk Acceptance Matrix (RAM), kolom Rencana Pengendalian.
- Tujuan pengendalian: menjaga atau mengembalikan hasil parameter ke dalam threshold (limit/appetite/tolerance) dengan memperhatikan arah parameter dan status saat ini.
- inisiatif: inisiatif strategis tingkat korporat (arah besar).
- kebijakan: kebijakan/limit/prosedur yang ditetapkan untuk mengendalikan parameter.
- program: program kerja konkret 2027 dengan target terukur dan waktu; kaitkan dengan root cause atau mitigasi risiko terkait bila ada.
- Jangan mengisi angka anggaran.`,
  program: `Lembar: 7.4 Program atau Inisiatif Strategis GRCS (satu kartu program pada Executive Summary RKAP 2027).
- Pilar GRCS: Governance (tata kelola, GCG, struktur dan kebijakan organ perusahaan), Risk Management (penerapan ERM, model dan budaya risiko), Compliance (kepatuhan regulasi, anti-fraud/anti-suap, sistem manajemen kepatuhan), Sustainability (ESG, lingkungan, sosial, pelaporan keberlanjutan). Program harus sesuai pilar pada konteks.
- Prioritaskan program yang menjawab risiko utama, parameter RAM berstatus non-hijau, atau rencana pengendalian RAM pada konteks; jangan menduplikasi program lain yang sudah ada.
- nama: judul program singkat dan spesifik (mis. "Pengembangan Pemodelan Risiko Berbasis Statistik").
- inisiatif_rjpp: inisiatif strategi RJPP yang dinaungi program; nama resmi yang tidak diketahui ditulis "[...]".
- objective_scorecard: sasaran/objective pada scorecard yang didukung, berupa kondisi yang hendak dicapai (mis. "Ketersediaan Model Risiko atas Taksonomi Risiko DAM").
- program_kerja: nama program kerja 2027 yang konkret.
- pemimpin: Bagian pelaksana di entitas. pemilik: pemilik program (entitas atau Induk/fungsi pemilik).
- bulan_mulai dan bulan_selesai: format "Januari 2027"; dalam tahun 2027 kecuali uraian pengguna menyebut lain.
- deskripsi: 1-2 kalimat apa yang dilakukan dan untuk apa.
- tujuan_kualitatif dan tujuan_kuantitatif: 2-3 poin, SATU POIN PER BARIS (pisahkan dengan baris baru, tanpa penomoran). Kuantitatif wajib memuat angka/persentase terukur.
- target: keluaran akhir yang terukur pada akhir program (deliverable).
- risiko_implementasi: 2-3 hambatan pelaksanaan program, satu per baris. mitigasi: tindakan yang menjawab tiap risiko implementasi secara berurutan, satu per baris.
- Jangan mengisi angka anggaran OPEX/CAPEX; sebutkan di catatan bahwa anggaran diisi manual.`,
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
    system: `${UMUM}\n\n${ATURAN_PIC}\n\n${KHUSUS[input.jenis]}`, user, name: "isi_kertas_kerja", schema, effort: "low",
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const out: IsiResponse = { ...r.data, model: r.model };
  return NextResponse.json(out);
}

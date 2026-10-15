/**
 * Bantuan AI untuk lembar parameter (5c, 5d, 6a, 6b, 8a): konfigurasi tabel dan sel per lembar,
 * dipakai bersama oleh komponen SheetAiModal dan /api/isi-ai/lembar.
 *
 * Satuan yang dipertukarkan dengan model: rp/angka apa adanya, persen dalam satuan persen (13,5 = 13,5%),
 * tanggal "YYYY-MM-DD". Konversi ke/dari nilai sel dilakukan di klien.
 */

export type TipeKolom = "teks" | "pilihan" | "rp" | "angka" | "persen" | "tanggal";
export const TIPE_ANGKA: readonly TipeKolom[] = ["rp", "angka", "persen", "tanggal"];

export interface KolomAi { key: string; col: string; label: string; tipe: TipeKolom; options?: readonly string[] }

export interface TabelAi {
  id: string; judul: string;
  /** Rentang baris isian (inklusif). */
  dari: number; sampai: number;
  kolom: KolomAi[];
  /** Kolom penanda baris sudah terisi sekaligus judul baris di pratinjau. */
  kunci: string;
  /**
   * true: AI boleh mengusulkan baris baru (skenario hipotetis).
   * false: baris baru hanya boleh diekstrak dari uraian pengguna (data fakta: proyek, perkara).
   */
  usulBaru: boolean;
}

export interface SelAi { key: string; addr: string; label: string; tipe: "teks" | "rp" | "persen" }

export interface SheetAiConfig {
  code: string; judul: string; tabel: TabelAi[]; sel: SelAi[];
  /** Label -> alamat sel yang dikirim sebagai konteks (read-only bagi AI). */
  konteks: Record<string, string>;
  placeholder: string;
}

export type BarisAi = { baris: number } & Record<string, string | number | null>;

export interface LembarRequest {
  code: string; entitas: string; instruksi: string;
  tabel: Record<string, { ada: BarisAi[]; barisBaru: number[] }>;
  sel: Record<string, string | number | null>;
  konteks: Record<string, unknown>;
}

export interface LembarResponse {
  tabel: Record<string, BarisAi[]>;
  sel: Record<string, string | number | null>;
  catatan: string;
  model: string;
}

const rp = (key: string, col: string, label: string): KolomAi => ({ key, col, label, tipe: "rp" });
const teks = (key: string, col: string, label: string): KolomAi => ({ key, col, label, tipe: "teks" });
const tgl = (key: string, col: string, label: string): KolomAi => ({ key, col, label, tipe: "tanggal" });
const penjelasan = (addr: string): SelAi => ({ key: "penjelasan_hasil", addr, label: "Penjelasan hasil pengukuran", tipe: "teks" });
const rasionalisasi = (baris: number): SelAi[] => (["limit", "appetite", "tolerance"] as const).map((b, i) => ({
  key: `rasionalisasi_${b}`, addr: `G${baris + i}`, label: `Rasionalisasi ${b[0].toUpperCase()}${b.slice(1)}`, tipe: "teks" as const,
}));
const ebitda = (addr: string): SelAi => ({ key: "ebitda", addr, label: "EBITDA RKAP 2027 (Rp)", tipe: "rp" });
const umum = (hasil: string, status: string, ket: string, usulan?: number): Record<string, string> => ({
  parameter: "E8", formula: "E11", arah: "E13", ketentuan: "E15", hasil_pengukuran: hasil, status, keterangan_hasil: ket,
  limit_berlaku: "I20", appetite_berlaku: "I21", tolerance_berlaku: "I22",
  ...(usulan ? { usulan_limit: `E${usulan}`, usulan_appetite: `E${usulan + 1}`, usulan_tolerance: `E${usulan + 2}` } : {}),
});
const historis = (a: number) => ({ historis_rata_rata: `I${a}`, historis_terendah: `I${a + 1}`, historis_tertinggi: `I${a + 2}`, historis_stdev: `I${a + 3}` });

export const SHEET_AI: Record<string, SheetAiConfig> = {
  "5c": {
    code: "5c", judul: "Skenario Potensi Kerugian Fraud",
    tabel: [{
      id: "fraud", judul: "Skenario fraud", dari: 31, sampai: 50, kunci: "kejadian", usulBaru: true,
      kolom: [
        teks("area", "C", "Potensi Area/Fungsi"), teks("proses", "D", "Proses"),
        { key: "beneficiary", col: "E", label: "Potential Beneficiary", tipe: "pilihan", options: ["Internal", "External"] },
        teks("kejadian", "F", "Nama Kejadian"),
        rp("kehilangan_pendapatan", "G", "Kehilangan pendapatan"), rp("biaya_penanganan", "H", "Biaya penanganan"), rp("biaya_hukum", "I", "Biaya hukum"),
        rp("kompensasi", "J", "Kompensasi pelanggan"), rp("biaya_lainnya", "K", "Biaya lainnya"), rp("penggantian", "L", "Penggantian dari pelaku"),
        teks("catatan", "N", "Catatan"),
      ],
    }],
    sel: [ebitda("I53"), penjelasan("I61"), ...rasionalisasi(96)],
    konteks: { ...umum("I57", "I58", "K57", 96), ...historis(89), catatan_tabel: "B28" },
    placeholder: "Contoh: Nilai pengadaan barang/jasa 2027 Rp24 miliar, kebocoran HPS bisa menaikkan harga 10%. Pendapatan sewa lahan tenant Rp8 miliar/tahun, potensi diskon tidak resmi 15%. Biaya investigasi per kasus Rp150 juta. EBITDA RKAP 2027 Rp45 miliar.",
  },
  "5d": {
    code: "5d", judul: "Skenario Kecelakaan Kerja dan Bencana",
    tabel: [
      {
        id: "kecelakaan", judul: "Skenario kecelakaan kerja", dari: 31, sampai: 45, kunci: "area", usulBaru: true,
        kolom: [
          teks("area", "C", "Potensi Area/Fungsi"), teks("proses", "D", "Proses"), { key: "probabilitas", col: "E", label: "Probabilitas kejadian", tipe: "persen" },
          rp("kehilangan_pendapatan", "F", "Kehilangan pendapatan"), rp("biaya_penanganan", "G", "Biaya penanganan"), rp("biaya_lainnya", "H", "Biaya lainnya"),
          rp("asuransi", "I", "Insurance coverage"), teks("catatan", "K", "Catatan"),
        ],
      },
      {
        id: "bencana", judul: "Skenario bencana", dari: 52, sampai: 66, kunci: "area", usulBaru: true,
        kolom: [
          teks("area", "C", "Potensi Area/Fungsi"), teks("aset", "D", "Aset terdampak"), { key: "probabilitas", col: "E", label: "Probabilitas kejadian", tipe: "persen" },
          rp("nilai_buku", "F", "Nilai buku aset"), rp("kehilangan_pendapatan", "G", "Kehilangan pendapatan"), rp("biaya_penanganan", "H", "Biaya penanganan"),
          rp("biaya_hukum", "I", "Biaya hukum"), rp("kompensasi", "J", "Kompensasi pelanggan"), rp("penggantian_aset", "K", "Penggantian aset"),
          rp("biaya_lainnya", "L", "Biaya lainnya"), rp("asuransi", "M", "Insurance coverage"), teks("catatan", "O", "Catatan"),
        ],
      },
    ],
    sel: [ebitda("I70"), penjelasan("I78"), ...rasionalisasi(113)],
    konteks: { ...umum("I74", "I75", "K74", 113), ...historis(106), catatan_kecelakaan: "B28", lingkup_bencana: "B48" },
    placeholder: "Contoh: WWTP kawasan kapasitas 5.000 m³/hari, bila berhenti 7 hari pendapatan jasa air limbah hilang Rp35 juta/hari. Nilai buku gudang Rp4,2 miliar, diasuransikan 80%. Biaya evakuasi dan perawatan korban sekitar Rp200 juta per kejadian. EBITDA RKAP 2027 Rp45 miliar.",
  },
  "6a": {
    code: "6a", judul: "Data Proyek Investasi (IRR vs Hurdle Rate)",
    tabel: [{
      id: "proyek", judul: "Proyek RKAP 2027", dari: 33, sampai: 52, kunci: "nama", usulBaru: false,
      kolom: [
        teks("nama", "C", "Nama Proyek"), teks("milestone", "D", "Milestone"), { key: "nilai_investasi", col: "E", label: "Nilai investasi awal (Rp juta)", tipe: "angka" },
        { key: "irr", col: "F", label: "IRR", tipe: "persen" }, { key: "wacc", col: "G", label: "WACC", tipe: "persen" }, { key: "hurdle", col: "H", label: "Hurdle rate", tipe: "persen" },
        tgl("mulai", "I", "Tanggal mulai"), tgl("selesai", "J", "Rencana selesai"), tgl("beroperasi", "K", "Tanggal beroperasi"),
        { key: "proyeksi_pendapatan", col: "L", label: "Proyeksi pendapatan per periode (Rp juta)", tipe: "angka" },
        { key: "kategori", col: "M", label: "Kategori proyek", tipe: "pilihan", options: ["Greenfield", "Brownfield", "Ekspansi", "Replacement", "Lainnya"] },
        teks("catatan", "N", "Catatan"),
      ],
    }],
    sel: [{ key: "hurdle_entitas", addr: "I27", label: "Hurdle rate entitas", tipe: "persen" }, penjelasan("I87"), ...rasionalisasi(126)],
    konteks: { ...umum("I83", "I84", "K83", 126), rata_rata_irr_proyek: "I78", keterangan_hurdle: "K27", petunjuk_tabel: "B30", historis_rata_rasio_irr_hurdle: "I119" },
    placeholder: "Tempel/ketik data proyek dari kajian kelayakan. Contoh: Pembangunan SFB Kawasan Tahap I, investasi Rp380.034 juta, IRR 13,06%, WACC 9,8%, hurdle 12%, mulai 1 Feb 2026, selesai 31 Des 2027, beroperasi 1 Mar 2028, proyeksi pendapatan Rp49.240 juta/tahun, greenfield.",
  },
  "6b": {
    code: "6b", judul: "Jadwal Proyek (Schedule Overrun)",
    tabel: [{
      id: "proyek", judul: "Jadwal proyek RKAP 2027", dari: 30, sampai: 49, kunci: "nama", usulBaru: false,
      kolom: [
        teks("nama", "C", "Nama Proyek"), teks("milestone", "D", "Milestone"), tgl("mulai", "E", "Tanggal mulai"),
        tgl("rencana_selesai", "F", "Rencana selesai"), tgl("perkiraan_selesai", "G", "Perkiraan selesai (RKAP 2027)"),
        tgl("beroperasi", "H", "Tanggal beroperasi"), teks("catatan", "M", "Catatan"),
      ],
    }],
    sel: [penjelasan("I57")],
    konteks: { ...umum("I53", "I54", "K53"), ketentuan_limit: "E20", ketentuan_appetite: "E21", ketentuan_tolerance: "E22", judul_tabel: "B27" },
    placeholder: "Tempel/ketik jadwal proyek. Contoh: Pembangunan SFB Kawasan Tahap I, milestone serah terima bangunan, mulai 1 Feb 2026, rencana selesai 31 Des 2027, perkiraan selesai 31 Mar 2028 karena keterlambatan perizinan, beroperasi 1 Mei 2028.",
  },
  "8a": {
    code: "8a", judul: "Daftar Perkara Hukum",
    tabel: [{
      id: "perkara", judul: "Perkara hukum", dari: 30, sampai: 129, kunci: "nama", usulBaru: false,
      kolom: [
        teks("nama", "C", "Nama Perkara"),
        { key: "tipe", col: "D", label: "Tipe perkara", tipe: "pilihan", options: ["Perdata", "Pidana", "TUN", "Arbitrase", "PKPU", "Kepailitan", "Ketenagakerjaan", "Pajak", "Lainnya"] },
        { key: "status", col: "E", label: "Status perkara", tipe: "pilihan", options: ["Potensi", "Pra-gugatan", "Gugatan masuk", "Persidangan", "Banding", "Kasasi", "PK", "Eksekusi", "Selesai"] },
        { key: "lembaga", col: "F", label: "Pengadilan/Lembaga", tipe: "pilihan", options: ["PN", "PTUN", "Arbitrase", "MA", "KPPU", "Pengadilan Hubungan Industrial", "Lainnya"] },
        teks("nomor", "G", "Nomor perkara"), teks("penggugat", "H", "Pihak penggugat"), teks("tergugat", "I", "Pihak yang digugat"),
        teks("ringkasan", "J", "Ringkasan gugatan"), teks("penyebab", "K", "Penyebab gugatan"), teks("dasar", "L", "Kontrak/dokumen dasar"),
        tgl("tanggal_gugatan", "M", "Tanggal gugatan"), teks("estimasi_selesai", "N", "Estimasi penyelesaian"),
        rp("tuntutan", "O", "Nilai tuntutan penggugat"), rp("potensi_bayar", "P", "Potensi pembayaran atas tuntutan"),
        rp("tuntutan_balik", "Q", "Nilai tuntutan balik"), rp("recovery", "R", "Potensi recovery"), rp("cadangan", "S", "Cadangan dibentuk"),
      ],
    }],
    sel: [ebitda("I133"), penjelasan("I140"), ...rasionalisasi(176)],
    konteks: { ...umum("I137", "I138", "K137", 176), ...historis(169), ketentuan_tuntutan_balik: "B130", ketentuan_status: "K132" },
    placeholder: "Tempel/ketik ringkasan perkara dari Divisi Hukum. Contoh: Gugatan wanprestasi oleh PT X atas kontrak sewa lahan 2024, perdata di PN Medan nomor 45/Pdt.G/2026/PN Mdn, persidangan, tuntutan Rp12 miliar, menurut kuasa hukum potensi bayar Rp3 miliar, cadangan Rp1 miliar.",
  },
};

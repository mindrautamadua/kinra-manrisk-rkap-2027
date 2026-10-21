export type Sikap = "Zero Tolerance" | "Conservative" | "Moderate" | "Aggressive" | string;
export type StatusUkur = "Hijau" | "Merah" | "Data belum lengkap" | "Tidak diterapkan" | "Batas belum diisi" | string;
export const KATEGORI_DAMPAK = ["Sangat Rendah", "Rendah", "Moderat", "Tinggi", "Sangat Tinggi"] as const;
export const KATEGORI_MITIGASI = ["Preventive", "Detective", "Corrective"] as const;
export const SIKAP = ["Zero Tolerance", "Conservative", "Moderate", "Aggressive"] as const;

export interface KategoriRisiko { no: number; nama: string; nama_en: string | null; definisi: string | null }
export interface Taksonomi {
  kode: string; kategori: string; def_kategori: string | null; aspek: string | null; def_aspek: string | null;
  risiko_korporat: string | null; def_risiko_korporat: string | null; risiko_spesifik: string | null;
  def_risiko_spesifik: string | null; jumlah_unit: number;
}
export interface KriteriaDampak {
  id: number; kategori: string; kode: string; kriteria: string; perhitungan: string | null;
  sangat_rendah: string | null; rendah: string | null; moderat: string | null; tinggi: string | null; sangat_tinggi: string | null;
}
export interface RiskDriver { id: number; kategori: string; driver: string; bentuk: string | null; tambahan: boolean }
export interface Ras {
  id: number; no: number; kategori: string; sikap_induk: string | null; pernyataan_induk: string | null;
  sikap: string | null; pernyataan: string | null; rasionalisasi: string | null;
}
export interface RasTambahan { id: number; kategori: string | null; sikap: string | null; pernyataan: string | null; rasionalisasi: string | null }
export interface RiskRegister {
  id: string; urutan: number; kategori: string | null; taksonomi_kode: string | null; risk_driver: string | null;
  risk_event: string | null; deskripsi: string | null; root_cause: string | null; probabilitas: number | null;
  deskripsi_dampak: string | null; nilai_dampak: number | null; kriteria_dampak: string | null; kategori_dampak: string | null;
  expected_loss: number | null; existing_control: string | null; rencana_mitigasi: string | null; kategori_mitigasi: string | null;
  /** Kode parameter RAM terkait (1a..U10 / kode parameter unik). Kolom dari migrasi 0002. */
  parameter_ram?: string[] | null;
  /** Kode Sasaran Strategis RJPP terkait (PD-1, SG-2, NB-3, FD-1, ...). Kolom dari migrasi 0006. */
  sasaran_strategis?: string[] | null;
  /** Target residual setelah mitigasi RKAP 2027. Kolom dari migrasi 0008. */
  target_probabilitas?: number | null;
  target_nilai_dampak?: number | null;
  target_kategori_dampak?: string | null;
  /** Dasar penetapan probabilitas dan dampak (data historis, proyeksi RKAP, skenario). Kolom dari migrasi 0010. */
  dasar_penilaian?: string | null;
  /** Keterkaitan RKAP 2027 (migrasi 0012): proses bisnis, kode pos Data Keuangan RKAP, program kerja/asumsi. */
  proses_bisnis?: string[] | null;
  pos_rkap?: string[] | null;
  program_kerja_rkap?: string | null;
}
export const TRIWULAN = ["TW I", "TW II", "TW III", "TW IV"] as const;
/** Rencana aksi mitigasi terstruktur satu risiko (migrasi 0008). */
export interface MitigasiAksi {
  id: string; risk_id: string; urutan: number; aksi: string | null; kategori: string | null; pic: string | null;
  biaya: number | null; jadwal: string[]; output: string | null;
  /** Bukti dukung: tautan/rujukan dokumen, satu per baris. Kolom dari migrasi 0009. */
  bukti?: string | null;
}
export interface ParamSummary { limit?: number | string | null; appetite?: number | string | null; tolerance?: number | string | null; hasil?: number | string | null; status?: string | null }
export interface ParameterSheet {
  code: string; title: string; grup: string; urutan: number; diterapkan: string | null;
  inputs: Record<string, CellValue>; summary: ParamSummary; updated_at?: string;
  /** Justifikasi bila parameter tidak diterapkan. Kolom dari migrasi 0010. */
  alasan_tidak_diterapkan?: string | null;
}
export interface RamPengendalian { kode: string; inisiatif: string | null; kebijakan: string | null; program: string | null; anggaran: number | null; indikator?: string | null }
export interface RamTambahan {
  id: string; kategori: string; kode: string | null; parameter: string | null; formula: string | null; satuan: string | null;
  limit_v: number | null; appetite_v: number | null; tolerance_v: number | null; arah: string | null; hasil: number | null;
  inisiatif: string | null; kebijakan: string | null; program: string | null; anggaran: number | null;
  /** Indikator keberhasilan pengendalian. Kolom dari migrasi 0010. */
  indikator?: string | null;
}
export interface CatAksi {
  id: string; urutan: number; jenis: string | null; nama: string | null; rencana_detail: string | null; dasar_kewenangan: string | null;
  rencana_waktu: string | null; parameter: string | null; formula: string | null; hasil: number | null; rasionalisasi_parameter: string | null;
  limit_v: number | null; appetite_v: number | null; tolerance_v: number | null; rasionalisasi_threshold: string | null;
  /** Polaritas; null/kosong dianggap "Makin tinggi makin buruk" (kolom dari migrasi 0007). */
  arah?: string | null;
}
export const PILAR_GRCS = ["Governance", "Risk Management", "Compliance", "Sustainability"] as const;
export interface ProgramStrategis {
  id: string; urutan: number; pilar: string; nama: string | null; inisiatif_rjpp: string | null; objective_scorecard: string | null;
  program_kerja: string | null; pemimpin: string | null; pemilik: string | null; bulan_mulai: string | null; bulan_selesai: string | null;
  deskripsi: string | null; tujuan_kualitatif: string | null; tujuan_kuantitatif: string | null; target: string | null;
  opex: number | null; capex: number | null; risiko_implementasi: string | null; mitigasi: string | null;
  /** Milestone 2027. Kolom dari migrasi 0010. */
  milestone?: Milestone[] | null;
}
export interface Milestone { bulan: string; uraian: string }
/** Induk Sasaran Strategis RJPP 2026-2030: 3 pilar strategis + Sasaran Korporasi sebagai Fondasi. */
export const PILAR_RJPP = ["Performance Driven", "Stability and Growth", "New Business Expansion", "Fondasi"] as const;
export interface SasaranStrategis { kode: string; urutan: number; pilar: string; nama: string; target: string | null; rujukan: string | null }
export interface Sampul { nama_entitas: string; posisi_data: string | null; tanggal_penyusunan: string | null; versi: string; catatan: string | null }

export type CellValue = string | number | boolean | null;
export interface TemplateCell { v?: CellValue; f?: string; bg?: string; b?: 1; i?: 1; fc?: string; sz?: number; ha?: string; w?: 1; nf?: string; bd?: 1 }
export interface SheetTemplate {
  code: string; title: string; maxRow: number; maxCol: number; cells: Record<string, TemplateCell>;
  merges: string[]; widths: Record<string, number>; validations: { sqref: string; list: string }[];
}

export const STATUS_LOG = ["Terbuka", "Dalam proses", "Selesai"] as const;
export const PRIORITAS = ["Tinggi", "Sedang", "Rendah"] as const;
export interface ChallengeLog {
  id: string; created_at: string; updated_at: string; ref_type: "umum" | "lembar" | "parameter" | "risiko" | string;
  ref_id: string | null; ref_label: string | null; masukan: string; challenger: string | null; prioritas: string;
  tanggapan: string | null; pic: string | null; tenggat: string | null; status: string;
  /** Hasil Validasi AI terakhir; ditulis server saja (migrasi 0011). */
  validasi_ai?: ValidasiAiLog | null;
}
export interface ValidasiAiLog {
  putusan: "terpenuhi" | "belum" | "verifikasi_manual"; alasan: string; kekurangan: string; model?: string; waktu: string;
  konfirmasi_manual?: { oleh: string; waktu: string; bukti: string };
}
/** Status yang boleh dipilih manual; "Selesai" hanya lewat Validasi AI. */
export const STATUS_MANUAL = ["Terbuka", "Dalam proses"] as const;
export interface Snapshot { id: string; created_at: string; nama: string; catatan: string | null; data?: SnapshotData }
export interface SnapshotData {
  sampul: Sampul; ras: Ras[]; ras_tambahan: RasTambahan[]; register: RiskRegister[];
  params: Pick<ParameterSheet, "code" | "diterapkan" | "summary" | "inputs">[];
  pengendalian: RamPengendalian[]; ram_tambahan: RamTambahan[]; cat: CatAksi[];
  /** Tidak ada pada snapshot sebelum migrasi 0008. */
  mitigasi_aksi?: MitigasiAksi[];
}
export interface ModePresentasi { aktif: boolean; sejak?: string | null }

// ---------- Data Keuangan RKAP 2027 (migrasi 0005) ----------
/** Satu pos laba rugi dalam rupiah penuh. `bulan` = Januari..Desember 2027. */
export interface RkapPos { tahun: number | null; bulan: (number | null)[]; pembanding: Record<string, number | null> }
/** Satu baris laporan arus kas/neraca apa adanya dari Kertas Kerja RKAP, rupiah penuh. */
export interface RkapBaris { uraian: string; tahun: number | null; bulan: (number | null)[] }
export interface RkapData {
  sheet: string; pembanding: string[]; pos: Record<string, RkapPos>;
  /** Sheet Fin4-CF 2027 dan Fin1-BS 2027; tidak ada pada versi yang diunggah sebelum fitur ini. */
  arus_kas?: RkapBaris[]; neraca?: RkapBaris[];
}
export interface RkapKeuangan {
  id: string; created_at: string; nama: string; sumber: string | null; catatan: string | null;
  aktif: boolean; ebitda_basis: "holding" | "komite"; data: RkapData;
}

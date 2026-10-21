/**
 * Keterkaitan risk event dengan RKAP 2027 (arahan Challenge Session 2a): proses bisnis, pos/target keuangan RKAP
 * yang terdampak, dan program kerja/asumsi RKAP terkait. Dipakai Risk Register dan /api/keterkaitan-rkap.
 */
import { POS } from "./rkap-baca";
import type { RkapKeuangan } from "./types";

/** Proses bisnis PT KINRA sebagai pengelola KEK Sei Mangkei (segmen pendapatan RKAP + fungsi pendukung). */
export const PROSES_BISNIS = [
  "Pemasaran & Penjualan Lahan", "Pengolahan Air Bersih", "Pengolahan Limbah", "Pengolahan & Distribusi Listrik",
  "Tank Farm", "Logistik (PT SMNT)", "Jasa & Layanan Kawasan", "Pengembangan Usaha & Investasi",
  "Keuangan & Akuntansi", "SDM & Umum", "Teknologi Informasi", "Hukum, Kepatuhan & Tata Kelola",
] as const;

/** Pos RKAP yang dapat dipilih: segmen pendapatan dan pos ringkasan laba rugi utama. */
export const POS_PILIHAN = POS.filter((p) => p.segmen || ["total_pendapatan", "beban_pengolahan", "beban_overhead", "beban_pemasaran", "beban_adm", "laba_operasional", "laba_bersih", "ebitda_holding"].includes(p.kode));

const rpM = (v: number) => `Rp${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
/** "Pengolahan Listrik (Rp348,85 M)" bila Data Keuangan RKAP aktif tersedia. */
export function labelPos(kode: string, rkap?: RkapKeuangan | null) {
  const p = POS.find((x) => x.kode === kode);
  const v = rkap?.data.pos[kode]?.tahun;
  const nama = p ? (p.segmen ? `Pendapatan ${p.label}` : p.label) : kode;
  return v != null ? `${nama} (${rpM(v)})` : nama;
}

export interface KeterkaitanRequest {
  risiko: { id: string; kategori: string | null; risk_event: string | null; deskripsi: string | null; root_cause: string | null; deskripsi_dampak: string | null; sasaran: string[] }[];
  pos: { kode: string; label: string }[];
}
export interface SaranKeterkaitan { id: string; proses_bisnis: string[]; pos_rkap: string[]; program_kerja_rkap: string }
export interface KeterkaitanResponse { hasil: SaranKeterkaitan[]; model: string }

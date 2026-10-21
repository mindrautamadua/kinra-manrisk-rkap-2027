/**
 * Dasar penilaian probabilitas dan dampak (arahan Challenge Session 2f): data historis, proyeksi RKAP 2027,
 * dan analisis skenario. Tipe bersama Risk Register dan /api/dasar-penilaian.
 */
export interface DasarPenilaianRequest {
  risiko: {
    id: string; no: number; kategori: string | null; risk_event: string | null; deskripsi: string | null; root_cause: string | null;
    probabilitas: number | null; nilai_dampak: number | null; deskripsi_dampak: string | null; kriteria_dampak: string | null;
    kategori_dampak: string | null; pos_rkap: string[]; program_kerja_rkap: string | null;
  }[];
  /** Angka RKAP 2027 aktif (laba rugi, arus kas, neraca), sudah berlabel dan dalam Rp miliar. */
  rkap: Record<string, string>;
}
export interface SaranDasarPenilaian { id: string; dasar_penilaian: string; perlu_tinjau: boolean }
export interface DasarPenilaianResponse { hasil: SaranDasarPenilaian[]; model: string }

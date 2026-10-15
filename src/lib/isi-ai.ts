/** Bantuan pengisian kertas kerja dengan AI: tipe bersama untuk komponen AiFill dan /api/isi-ai. */

export type JenisIsi = "cat" | "risiko" | "ras" | "ram";

/** Kolom yang diminta untuk diisi. `options` membatasi jawaban ke daftar pilihan (dropdown). */
export interface FieldSpec { key: string; label: string; options?: readonly string[] }

export interface IsiRequest {
  jenis: JenisIsi;
  entitas: string;
  /** Uraian bebas dari pengguna tentang apa yang ingin diisi. */
  instruksi: string;
  /** Data pendukung yang sudah ada di kertas kerja (read-only bagi AI). */
  konteks: Record<string, unknown>;
  fields: FieldSpec[];
  /** Nilai kolom saat ini; bila terisi, AI mempertajam alih-alih menulis ulang. */
  nilai: Record<string, string | null>;
}

export interface IsiResponse { saran: Record<string, string>; catatan: string; model: string }

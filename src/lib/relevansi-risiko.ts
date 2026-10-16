import type { RiskRegister } from "./types";

/** Data yang dikirim ke /api/relevansi-risiko: register beserta konteks bisnis entitas. */
export interface RelevansiRequest {
  entitas: string;
  konteks: {
    /** Pos laba rugi RKAP 2027 (Rp setahun), termasuk segmen pendapatan. */
    keuangan_rkap_2027: Record<string, number> | string;
    sasaran: { kode: string; pilar: string; nama: string; target: string | null }[];
    program: { pilar: string; nama: string | null; inisiatif_rjpp: string | null; deskripsi: string | null }[];
  };
  risiko: {
    id: string; no: number; kategori: string | null; taksonomi_kode: string | null; risk_driver: string | null;
    risk_event: string | null; deskripsi: string | null; root_cause: string | null; deskripsi_dampak: string | null;
    nilai_dampak: number | null; kategori_dampak: string | null; sasaran_terkait: string[]; parameter_ram_terkait: string[];
    sidik: string;
  }[];
}

export const TINGKAT = ["Relevan", "Perlu dikontekstualkan", "Kurang relevan"] as const;
export type Tingkat = (typeof TINGKAT)[number];

export interface PenilaianRelevansi {
  id: string; relevansi: Tingkat; alasan: string;
  /** Pos RKAP, kode sasaran RJPP, atau program strategis yang menjadi dasar relevansi. */
  kaitan: string[];
  masalah: string;
  /** Usulan Deskripsi Risk Event yang dikontekstualkan; kosong bila sudah memadai. */
  saran_deskripsi: string;
  sidik: string;
  /** true bila usulan deskripsi sudah dipakai; sidik diperbarui ke isian setelah dipakai. */
  diterapkan?: boolean;
}
export interface CelahRisiko { tema: string; alasan: string }
export interface HasilRelevansi {
  ringkasan: string; penilaian: PenilaianRelevansi[]; celah: CelahRisiko[]; model: string; waktu: string;
}

/** Sidik isian yang menentukan relevansi satu risiko, untuk menandai penilaian yang sudah usang. */
export function sidikRisiko(r: Pick<RiskRegister, "kategori" | "risk_event" | "deskripsi" | "root_cause" | "deskripsi_dampak">) {
  const s = [r.kategori, r.risk_event, r.deskripsi, r.root_cause, r.deskripsi_dampak].map((x) => (x ?? "").trim()).join("\u0001");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const KUNCI = "relevansi-risiko";
export function bacaRelevansi(): HasilRelevansi | null {
  try { const s = localStorage.getItem(KUNCI); return s ? (JSON.parse(s) as HasilRelevansi) : null; } catch { return null; }
}
export function simpanRelevansi(h: HasilRelevansi) {
  try { localStorage.setItem(KUNCI, JSON.stringify(h)); } catch { /* penyimpanan browser tidak tersedia */ }
}

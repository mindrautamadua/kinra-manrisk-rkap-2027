import { isTopRisk, nilaiParam } from "./format";
import { perluPengendalian, type RamRow } from "./ram";
import type { Ras, RiskRegister } from "./types";
import type { Severity } from "./kesiapan";

/** Data ringkas yang dikirim ke /api/review-kualitas. Hanya isi kertas kerja yang perlu dinilai kualitasnya. */
export interface ReviewInput {
  entitas: string;
  ras: { id: string; kategori: string; sikap_induk: string | null; sikap: string | null; pernyataan: string | null; rasionalisasi: string | null }[];
  risiko: {
    id: string; no: number; kategori: string | null; risk_driver: string | null; risk_event: string | null; deskripsi: string | null;
    root_cause: string | null; deskripsi_dampak: string | null; kategori_dampak: string | null; existing_control: string | null;
    rencana_mitigasi: string | null; kategori_mitigasi: string | null; top_risk: boolean;
  }[];
  parameter: {
    kode: string; kategori: string; parameter: string; status: string; hasil: string; tolerance: string;
    inisiatif: string | null; kebijakan: string | null; program: string | null;
  }[];
}

export type AreaReview = "RAS" | "Risk Register" | "RAM";

export interface TemuanAI {
  area: AreaReview; ref_id: string; ref_label: string; severity: Severity;
  aspek: string; masalah: string; saran: string; pertanyaan_reviewer: string;
}
export interface HasilReview { ringkasan: string; temuan: TemuanAI[]; model: string; waktu: string }

export function buildReviewInput(entitas: string, ras: Ras[], register: RiskRegister[], ram: RamRow[]): ReviewInput {
  return {
    entitas,
    ras: ras.map((r) => ({ id: String(r.id), kategori: r.kategori, sikap_induk: r.sikap_induk, sikap: r.sikap, pernyataan: r.pernyataan, rasionalisasi: r.rasionalisasi })),
    risiko: register.filter((r) => r.risk_event).map((r, i) => ({
      id: r.id, no: i + 1, kategori: r.kategori, risk_driver: r.risk_driver, risk_event: r.risk_event, deskripsi: r.deskripsi,
      root_cause: r.root_cause, deskripsi_dampak: r.deskripsi_dampak, kategori_dampak: r.kategori_dampak, existing_control: r.existing_control,
      rencana_mitigasi: r.rencana_mitigasi, kategori_mitigasi: r.kategori_mitigasi, top_risk: isTopRisk(r.kategori_dampak),
    })),
    // Hanya parameter di luar Hijau: rencana pengendaliannya yang diuji reviewer.
    parameter: ram.filter((r) => r.diterapkan && perluPengendalian(r.status)).map((r) => {
      const src = r.tambahan ?? r.pengendalian;
      return {
        kode: r.kode, kategori: r.kategori, parameter: r.parameter, status: r.status,
        hasil: nilaiParam(r.hasil, r.satuan), tolerance: nilaiParam(r.tolerance, r.satuan),
        inisiatif: src?.inisiatif ?? null, kebijakan: src?.kebijakan ?? null, program: src?.program ?? null,
      };
    }),
  };
}

/** Halaman tujuan "Perbaiki" untuk tiap area. */
export const hrefArea = (t: TemuanAI) =>
  t.area === "RAS" ? "/ras" : t.area === "RAM" ? "/ram" : "/risk-register";

/** Referensi untuk Log Challenge. */
export const refTemuan = (t: TemuanAI) => ({
  type: t.area === "RAS" ? "lembar" : t.area === "RAM" ? "parameter" : "risiko",
  id: t.area === "RAS" ? "/ras" : t.ref_id,
  label: t.ref_label,
});

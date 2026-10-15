import type { RisikoRingkas } from "@/lib/kaitkan-ai";

export interface SaranMitigasiRequest {
  risiko: RisikoRingkas & { existing_control: string | null; kategori_mitigasi: string | null; parameter_ram_terkait: string[]; sasaran_strategis_terkait: string[] };
}
export interface OpsiMitigasi { rencana: string; kategori: string; alasan: string }
export interface SaranMitigasiResponse { evaluasi: string; opsi: OpsiMitigasi[]; model: string }

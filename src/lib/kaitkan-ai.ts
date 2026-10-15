import { useState } from "react";
import type { RiskRegister } from "@/lib/types";

export type JenisKaitan = "parameter" | "sasaran";

/** Ringkasan risk event yang dikirim ke AI sebagai dasar pemilihan. */
export type RisikoRingkas = Pick<RiskRegister, "kategori" | "risk_driver" | "risk_event" | "deskripsi" | "root_cause" | "deskripsi_dampak" | "kriteria_dampak" | "rencana_mitigasi">;

export interface KaitkanRequest {
  jenis: JenisKaitan;
  risiko: RisikoRingkas;
  pilihan: Record<string, string | boolean | null>[];
}
export interface SaranKaitan { kode: string; alasan: string }
export interface KaitkanResponse { saran: SaranKaitan[]; catatan: string; model: string }

export function ringkasRisiko(r: RiskRegister): RisikoRingkas {
  const { kategori, risk_driver, risk_event, deskripsi, root_cause, deskripsi_dampak, kriteria_dampak, rencana_mitigasi } = r;
  return { kategori, risk_driver, risk_event, deskripsi, root_cause, deskripsi_dampak, kriteria_dampak, rencana_mitigasi };
}

/** State permintaan saran AI untuk satu picker. */
export function useSaranKaitan(jenis: JenisKaitan) {
  const [loading, setLoading] = useState(false);
  const [hasil, setHasil] = useState<KaitkanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minta = async (risiko: RisikoRingkas, pilihan: KaitkanRequest["pilihan"]) => {
    if (!risiko.risk_event) { setHasil(null); setError("Pilih Risk Event dari taksonomi terlebih dahulu."); return; }
    setLoading(true); setError(null); setHasil(null);
    try {
      const req: KaitkanRequest = { jenis, risiko, pilihan };
      const res = await fetch("/api/kaitkan-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Gagal meminta saran AI.");
      setHasil(body as KaitkanResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal meminta saran AI.");
    } finally {
      setLoading(false);
    }
  };
  const reset = () => { setHasil(null); setError(null); };
  return { loading, hasil, error, minta, reset };
}

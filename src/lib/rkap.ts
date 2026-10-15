"use client";
import { api } from "./data";
import { loadTemplate, Workbook } from "./engine";
import type { CellValue, ParameterSheet, RkapKeuangan } from "./types";
export * from "./rkap-baca";

export const ebitda = (r: Pick<RkapKeuangan, "data" | "ebitda_basis">) =>
  r.data.pos[r.ebitda_basis === "komite" ? "ebitda_komite" : "ebitda_holding"]?.tahun ?? null;

// ---------- keterkaitan ke lembar parameter ----------
export interface Tautan { code: string; addr: string; sumber: "ebitda" | "total_pendapatan"; satuan: "Rp" | "Rp juta" }

/** Sel isian lembar parameter yang nilainya berasal dari RKAP 2027. Satuan mengikuti label sel di template. */
export const TAUTAN: Tautan[] = [
  { code: "2a", addr: "I137", sumber: "ebitda", satuan: "Rp juta" },
  { code: "2b", addr: "I79", sumber: "ebitda", satuan: "Rp juta" },
  { code: "3a", addr: "I62", sumber: "ebitda", satuan: "Rp juta" },
  { code: "5a", addr: "I53", sumber: "ebitda", satuan: "Rp" },
  { code: "5b", addr: "I53", sumber: "ebitda", satuan: "Rp" },
  { code: "5c", addr: "I53", sumber: "ebitda", satuan: "Rp" },
  { code: "5d", addr: "I70", sumber: "ebitda", satuan: "Rp" },
  { code: "8a", addr: "I133", sumber: "ebitda", satuan: "Rp" },
  { code: "8b", addr: "I62", sumber: "ebitda", satuan: "Rp" },
  { code: "K4", addr: "I53", sumber: "total_pendapatan", satuan: "Rp juta" },
];
export const LABEL_SUMBER = { ebitda: "EBITDA RKAP 2027", total_pendapatan: "Total pendapatan RKAP 2027" } as const;

/** Nilai yang seharusnya diisi pada sel tautan, sudah dikonversi ke satuan sel. */
export function nilaiTautan(t: Tautan, r: RkapKeuangan): number | null {
  const rp = t.sumber === "ebitda" ? ebitda(r) : r.data.pos.total_pendapatan?.tahun ?? null;
  if (rp == null) return null;
  return t.satuan === "Rp juta" ? Math.round(rp / 1e4) / 100 : Math.round(rp);
}

export const samaNilai = (a: CellValue | undefined, b: number | null) =>
  typeof a === "number" && b != null && Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 1e-9);

/** Isi sel tautan pada lembar parameter dari versi RKAP aktif, lalu hitung ulang ringkasan hasil pengukuran. */
export async function terapkanKeParameter(r: RkapKeuangan, codes?: string[]) {
  const target = TAUTAN.filter((t) => !codes || codes.includes(t.code));
  const perLembar = new Map<string, Tautan[]>();
  for (const t of target) perLembar.set(t.code, [...(perLembar.get(t.code) ?? []), t]);
  const sampul = await api.sampul();
  const hasil: string[] = [];
  for (const [code, ts] of perLembar) {
    const [tpl, row] = await Promise.all([loadTemplate(code), api.param(code)]);
    if (!row) continue;
    const inputs = { ...(row.inputs ?? {}) };
    for (const t of ts) { const v = nilaiTautan(t, r); if (v != null) inputs[t.addr] = v; }
    const wb = new Workbook([tpl], { [code]: inputs }, sampul.nama_entitas ?? "PT KINRA");
    const summary = wb.summary(code);
    wb.destroy();
    await api.update<ParameterSheet>("parameter_sheet", "code", code, { inputs, summary, updated_at: new Date().toISOString() });
    hasil.push(code);
  }
  return hasil;
}

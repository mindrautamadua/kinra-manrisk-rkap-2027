import { arahParameter, REKAP } from "./static";
import { RAM_LAYOUT } from "./static";
import { hitungStatus, statusBiner } from "./format";
import type { ParameterSheet, RamPengendalian, RamTambahan, Ras } from "./types";

export interface RamRow {
  key: string; kategoriNo: number; kategori: string; kode: string; parameter: string; formula: string; satuan: string;
  kategoriParameter: string; diterapkan: boolean; limit: unknown; appetite: unknown; tolerance: unknown; sikap: string;
  hasil: unknown; status: string; arah: string; tambahan?: RamTambahan; pengendalian?: RamPengendalian | null;
  /** Justifikasi parameter yang tidak diterapkan (arahan Challenge Session 6f). */
  alasanTidak?: string | null;
}

export const KATEGORI_URUT = [
  "Risiko Strategis", "Risiko Pasar", "Risiko Keuangan", "Risiko Kredit", "Risiko Operasional",
  "Risiko Investasi dan Proyek", "Risiko Reputasi", "Risiko Peraturan, Hukum dan Kepatuhan",
];

/** Cakupan tiap pernyataan RAS pada kategori yang dipecah dua oleh Induk (urut sesuai template PT DAM). */
const CAKUPAN_RAS: Record<string, string[]> = {
  "Risiko Strategis": ["Kegiatan usaha berjalan", "Pertumbuhan & transformasi bisnis"],
  "Risiko Investasi dan Proyek": ["Di luar program strategis RJPP & penugasan", "Program strategis RJPP & penugasan Pemerintah"],
  "Risiko Operasional": ["Operasional umum & BCM", "K3"],
};

/** Label cakupan baris RAS; null bila kategori hanya punya satu pernyataan. */
export function cakupanRas(r: Ras, ras: Ras[]) {
  const rows = ras.filter((x) => x.kategori === r.kategori);
  return rows.length > 1 ? CAKUPAN_RAS[r.kategori]?.[rows.indexOf(r)] ?? null : null;
}

/** Sikap risiko RAM mengikuti RAS: 6b = pernyataan pelaksanaan proyek, 5d = K3 + umum Risiko Operasional. */
export function sikapUntuk(kode: string, kategori: string, ras: Ras[]) {
  const rows = ras.filter((r) => r.kategori === kategori);
  if (kode === "6b") return rows[1]?.sikap ?? rows[0]?.sikap ?? "";
  if (kode === "5d") return `K3: ${rows[1]?.sikap ?? "-"} · BCM: ${rows[0]?.sikap ?? "-"}`;
  return rows[0]?.sikap ?? "";
}

export function buildRam(params: ParameterSheet[], ras: Ras[], pengendalian: RamPengendalian[], tambahan: RamTambahan[]): RamRow[] {
  const out: RamRow[] = [];
  let kat = "";
  let katNo = 0;
  for (const l of RAM_LAYOUT) {
    if (l.kategori_no) { katNo = l.kategori_no; kat = KATEGORI_URUT[katNo - 1]; }
    if (!l.kode) continue;
    const meta = REKAP.find((r) => r.kode === l.kode)!;
    const p = params.find((x) => x.code === l.kode);
    const diterapkan = meta.grup === "Parameter Standar" || p?.diterapkan === "Ya";
    const s = p?.summary ?? {};
    const arah = arahParameter(l.kode);
    // Ringkasan tersimpan bisa berasal dari rumus lama; hasil angka dihitung ulang dengan aturan dua warna. K1 dinilai per sub-item di kertas kerja.
    const status = typeof s.hasil === "number" && l.kode !== "K1" ? hitungStatus(s.hasil, s.limit, s.appetite, s.tolerance, arah) : statusBiner(String(s.status ?? "Data belum lengkap"));
    out.push({
      key: l.kode, kategoriNo: katNo, kategori: kat, kode: l.kode, parameter: l.parameter ?? "", formula: l.formula ?? "", satuan: l.satuan ?? "",
      kategoriParameter: l.kategori_parameter ?? "", diterapkan,
      limit: diterapkan ? s.limit : null, appetite: diterapkan ? s.appetite : null, tolerance: diterapkan ? s.tolerance : null,
      sikap: sikapUntuk(l.kode, kat, ras), hasil: diterapkan ? s.hasil : null,
      status: diterapkan ? status : "Tidak diterapkan", arah,
      pengendalian: pengendalian.find((x) => x.kode === l.kode) ?? null,
      alasanTidak: diterapkan ? null : p?.alasan_tidak_diterapkan ?? null,
    });
  }
  for (const t of tambahan) {
    const katNo2 = KATEGORI_URUT.indexOf(t.kategori) + 1;
    out.push({
      key: t.id, kategoriNo: katNo2, kategori: t.kategori, kode: t.kode ?? "", parameter: t.parameter ?? "", formula: t.formula ?? "", satuan: t.satuan ?? "",
      kategoriParameter: "Parameter Unik", diterapkan: true, limit: t.limit_v, appetite: t.appetite_v, tolerance: t.tolerance_v,
      sikap: sikapUntuk("", t.kategori, ras), hasil: t.hasil,
      status: hitungStatus(t.hasil, t.limit_v, t.appetite_v, t.tolerance_v, t.arah), arah: t.arah ?? "Makin tinggi makin buruk", tambahan: t,
    });
  }
  return out.sort((a, b) => a.kategoriNo - b.kategoriNo);
}

export const perluPengendalian = (s: string) => s === "Merah";

/**
 * Target residual risk dan rencana aksi mitigasi: perbandingan inheren vs target, kesesuaian dengan
 * sikap risiko (RAS) per kategori, dan kelengkapan rencana aksi (PIC, biaya, jadwal, output).
 */
import { isTopRisk } from "./format";
import { LEVEL_DAMPAK, type Isu } from "./kualitas-register";
import type { MitigasiAksi, Ras, RiskRegister } from "./types";

/**
 * Kategori dampak target tertinggi yang masih dalam selera risiko per sikap RAS.
 * Aturan aplikasi (bukan dari template): makin ketat sikapnya, makin rendah target residual yang dapat diterima.
 */
export const BATAS_SIKAP: Record<string, (typeof LEVEL_DAMPAK)[number]> = {
  "Zero Tolerance": "Sangat Rendah", Conservative: "Rendah", Moderate: "Moderat", Aggressive: "Tinggi",
};
const lv = (k?: string | null) => (k ? LEVEL_DAMPAK.indexOf(k as (typeof LEVEL_DAMPAK)[number]) : -1);

/** Sikap risiko entitas untuk kategori risiko; jatuh ke sikap Induk bila entitas belum mengisi. */
export function sikapKategori(ras: Ras[], kategori?: string | null) {
  const r = ras.find((x) => x.kategori === kategori);
  return r?.sikap || r?.sikap_induk || null;
}

export const elInheren = (r: RiskRegister) =>
  r.expected_loss != null ? Number(r.expected_loss) : r.probabilitas != null && r.nilai_dampak != null ? Number(r.probabilitas) * Number(r.nilai_dampak) : null;
export const elTarget = (r: RiskRegister) =>
  r.target_probabilitas != null && r.target_nilai_dampak != null ? Number(r.target_probabilitas) * Number(r.target_nilai_dampak) : null;

export type StatusSelera = "Dalam selera" | "Di atas selera";
export interface RingkasTarget {
  sikap: string | null; batas: string | null; status: StatusSelera | null;
  elInheren: number | null; elTarget: number | null; biaya: number; isu: Isu[];
}

const isi = (s?: string | null) => !!s && s.trim() !== "";
/** Aksi dianggap lengkap bila uraian, PIC, jadwal, dan output terisi; biaya boleh 0 (tanpa anggaran tambahan) tetapi tidak kosong. */
export const kurangAksi = (a: MitigasiAksi) =>
  [!isi(a.aksi) && "uraian", !isi(a.pic) && "PIC", a.biaya == null && "biaya", !a.jadwal.length && "jadwal", !isi(a.output) && "output"].filter(Boolean) as string[];

export function ringkasTarget(r: RiskRegister, aksi: MitigasiAksi[], ras: Ras[]): RingkasTarget {
  const sikap = sikapKategori(ras, r.kategori);
  const batas = sikap ? BATAS_SIKAP[sikap] ?? null : null;
  const t = r.target_kategori_dampak;
  const status: StatusSelera | null = t && batas ? (lv(t) <= lv(batas) ? "Dalam selera" : "Di atas selera") : null;
  const out: RingkasTarget = { sikap, batas, status, elInheren: elInheren(r), elTarget: elTarget(r), biaya: aksi.reduce((s, a) => s + Number(a.biaya ?? 0), 0), isu: [] };
  const isu = (pesan: string, kolom = "Target Residual") => out.isu.push({ kolom, pesan });

  const adaTarget = r.target_probabilitas != null || r.target_nilai_dampak != null || !!t;
  if (isTopRisk(r.kategori_dampak) && !adaTarget) isu(`Risiko utama wajib punya target residual setelah mitigasi${batas ? ` (sikap ${sikap}: paling tinggi ${batas})` : ""}.`);
  if (adaTarget && (r.target_probabilitas == null || r.target_nilai_dampak == null || !t)) isu("Lengkapi target probabilitas, nilai dampak, dan kategori dampak.");
  if (status === "Di atas selera") isu(`Target ${t} masih di atas selera risiko kategori ini (sikap ${sikap}, paling tinggi ${batas}). Perkuat mitigasi atau beri justifikasi pada challenge session.`);
  if (adaTarget) {
    const naik = [
      r.target_probabilitas != null && r.probabilitas != null && Number(r.target_probabilitas) > Number(r.probabilitas) && "probabilitas",
      r.target_nilai_dampak != null && r.nilai_dampak != null && Number(r.target_nilai_dampak) > Number(r.nilai_dampak) && "nilai dampak",
      t && r.kategori_dampak && lv(t) > lv(r.kategori_dampak) && "kategori dampak",
    ].filter(Boolean);
    if (naik.length) isu(`Target ${naik.join(", ")} lebih tinggi dari inheren. Target residual tidak boleh melebihi risiko inheren.`);
    else if (out.elInheren != null && out.elTarget != null && out.elTarget >= out.elInheren && t === r.kategori_dampak) {
      isu("Target sama dengan inheren, artinya mitigasi tidak menurunkan risiko. Turunkan probabilitas atau dampak yang ditargetkan.");
    }
  }

  if (isTopRisk(r.kategori_dampak) && aksi.length === 0) isu("Risiko utama belum punya rencana aksi terstruktur (PIC, biaya, jadwal, output).", "Rencana Aksi");
  const tidakLengkap = aksi.map((a, i) => ({ i, k: kurangAksi(a) })).filter((x) => x.k.length);
  if (tidakLengkap.length) isu(tidakLengkap.map((x) => `aksi ${x.i + 1} belum ada ${x.k.join(", ")}`).join("; ") + ".", "Rencana Aksi");
  if (out.biaya > 0 && out.elInheren != null && out.elTarget != null && out.biaya > out.elInheren - out.elTarget) {
    isu("Biaya mitigasi melebihi penurunan expected loss. Pastikan ada manfaat non-finansial yang menjustifikasi (kepatuhan, reputasi, keselamatan).", "Rencana Aksi");
  }
  return out;
}

/**
 * Dasar pemeringkatan Risiko Utama (arahan Challenge Session 3g): seluruh risiko diurutkan objektif menurut expected loss
 * inheren, dikaitkan dengan sikap/batas selera RAS kategorinya dan status terburuk parameter RAM yang tertaut.
 * Penetapan Risiko Utama tetap mengikuti aturan template PT DAM v.2 (kategori dampak Moderat ke atas).
 */
import { isTopRisk } from "./format";
import type { RamRow } from "./ram";
import { BATAS_SIKAP, elInheren, sikapKategori } from "./target-risiko";
import type { Ras, RiskRegister } from "./types";

const LEVEL = ["Sangat Rendah", "Rendah", "Moderat", "Tinggi", "Sangat Tinggi"];
const STATUS_URUT = ["Merah", "Oranye", "Kuning", "Hijau"];

export interface PeringkatRisiko {
  r: RiskRegister; no: number; peringkat: number; el: number | null;
  utama: boolean; sikap: string | null; batas: string | null;
  /** Kategori dampak inheren dibanding batas selera sikap RAS. */
  terhadapSelera: "Di atas selera" | "Dalam selera" | null;
  /** Status parameter RAM tertaut yang paling buruk, beserta kodenya. */
  ram: { status: string; kode: string } | null;
  pemantauan: string;
}

export function peringkatRisiko(register: RiskRegister[], ras: Ras[], ram: RamRow[]): PeringkatRisiko[] {
  const isi = register.filter((r) => r.risk_event);
  const urut = [...isi].sort((a, b) => (elInheren(b) ?? -1) - (elInheren(a) ?? -1));
  return urut.map((r, i) => {
    const sikap = sikapKategori(ras, r.kategori);
    const batas = sikap ? BATAS_SIKAP[sikap] ?? null : null;
    const lv = LEVEL.indexOf(r.kategori_dampak ?? "");
    const terhadapSelera = lv < 0 || !batas ? null : lv > LEVEL.indexOf(batas) ? "Di atas selera" : "Dalam selera";
    const tertaut = ram.filter((p) => p.kode && (r.parameter_ram ?? []).includes(p.kode) && STATUS_URUT.includes(p.status))
      .sort((a, b) => STATUS_URUT.indexOf(a.status) - STATUS_URUT.indexOf(b.status));
    const utama = isTopRisk(r.kategori_dampak);
    const ramTerburuk = tertaut[0] ? { status: tertaut[0].status, kode: tertaut[0].kode } : null;
    const pemantauan = utama
      ? terhadapSelera === "Di atas selera" || ["Merah", "Oranye"].includes(ramTerburuk?.status ?? "")
        ? "Risiko Utama prioritas: pemantauan bulanan dan eskalasi"
        : "Risiko Utama: pemantauan triwulanan"
      : "Non-utama: tetap tercatat di Risk Register, pemantauan semesteran";
    return { r, no: isi.indexOf(r) + 1, peringkat: i + 1, el: elInheren(r), utama, sikap, batas, terhadapSelera, ram: ramTerburuk, pemantauan };
  });
}

/**
 * Data pendukung untuk menyusun Rasionalisasi Sikap Risiko dengan AI (lembar RAS).
 * Sesuai arahan Challenge Session (surat tindak lanjut butir 1e): rasionalisasi harus mempertimbangkan karakteristik
 * bisnis, kondisi keuangan, eksposur risiko, dan hasil pengukuran RAM, serta selaras dengan Risiko Utama.
 */
import { api, challengeApi } from "./data";
import { isTopRisk } from "./format";
import { buildRam } from "./ram";
import { ebitda, POS } from "./rkap";
import type { ChallengeLog, RiskRegister, RkapKeuangan } from "./types";

export interface DataPendukungRas {
  register: RiskRegister[];
  ram: ReturnType<typeof buildRam>;
  rkap: RkapKeuangan | null;
  arahan: ChallengeLog[];
}

export async function muatPendukungRas(): Promise<DataPendukungRas> {
  const [register, params, ras, pengendalian, tambahan, rkap, log] = await Promise.all([
    api.register(), api.params(), api.ras(), api.pengendalian(), api.ramTambahan(),
    api.rkapAktif().catch(() => null), challengeApi.list().catch(() => [] as ChallengeLog[]),
  ]);
  // Arahan challenger yang menyangkut RAS (lembar RAS atau menyebut RAS/sikap risiko).
  const arahan = log.filter((c) => c.status !== "Selesai" && (c.ref_id === "/ras" || /\bRAS\b|sikap risiko/i.test(c.masukan)));
  return { register, ram: buildRam(params, ras, pengendalian, tambahan), rkap, arahan };
}

const rp = (v: number | null | undefined) => (v == null ? null : `Rp${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`);
/** Nilai parameter apa adanya, kecuali persen (disimpan sebagai pecahan) ditampilkan "98%" agar tidak disalahbaca AI. */
const nilai = (v: unknown, satuan: string) =>
  typeof v === "number" && satuan === "%" ? `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%` : v ?? null;
const eksposur = (r: RiskRegister) =>
  Number(r.expected_loss) > 0 ? Number(r.expected_loss) : r.probabilitas != null && r.nilai_dampak != null ? Number(r.probabilitas) * Number(r.nilai_dampak) : null;

/** Ringkasan data kertas kerja untuk satu kategori risiko, dikirim sebagai konteks AI. */
export function konteksRasionalisasi(kategori: string | null, d: DataPendukungRas) {
  const risiko = d.register.filter((r) => r.risk_event && r.kategori === kategori);
  const pos = d.rkap?.data.pos;
  return {
    keuangan_rkap_2027: d.rkap ? {
      total_pendapatan: rp(pos?.total_pendapatan?.tahun), ebitda: rp(ebitda(d.rkap)), laba_bersih: rp(pos?.laba_bersih?.tahun),
      pendapatan_per_segmen: Object.fromEntries(POS.filter((p) => p.segmen && pos?.[p.kode]?.tahun).map((p) => [p.label, rp(pos![p.kode].tahun)])),
    } : "Data Keuangan RKAP 2027 belum diunggah",
    risiko_kategori_ini: risiko.map((r) => ({
      risk_event: r.risk_event, kategori_dampak: r.kategori_dampak, risiko_utama: isTopRisk(r.kategori_dampak),
      eksposur_inheren: rp(eksposur(r)), root_cause: r.root_cause?.slice(0, 300),
    })),
    jumlah_risiko_utama_seluruh_kategori: d.register.filter((r) => r.risk_event && isTopRisk(r.kategori_dampak)).length,
    parameter_ram_kategori_ini: d.ram.filter((r) => r.kategori === kategori).map((r) => ({
      kode: r.kode, parameter: r.parameter, satuan: r.satuan, diterapkan: r.diterapkan, arah: r.arah,
      limit: nilai(r.limit, r.satuan), appetite: nilai(r.appetite, r.satuan), tolerance: nilai(r.tolerance, r.satuan),
      hasil: nilai(r.hasil, r.satuan), status: r.status || "belum diukur",
    })),
    arahan_challenge_session: d.arahan.map((c) => c.masukan),
  };
}

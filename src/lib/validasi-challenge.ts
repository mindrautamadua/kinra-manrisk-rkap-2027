import { api } from "./data";
import { isTopRisk } from "./format";
import { buildRam, type RamRow } from "./ram";
import type { ChallengeLog, MitigasiAksi, RiskRegister } from "./types";

/** Masukan yang dikirim ke /api/validasi-challenge. */
export interface ValidasiInput {
  lembar: string;
  masukan: { id: string; ref_label: string | null; masukan: string; tanggapan: string | null }[];
  data: Record<string, unknown>;
}

export type Putusan = "terpenuhi" | "belum" | "verifikasi_manual";
export interface HasilValidasi { id: string; putusan: Putusan; alasan: string; kekurangan: string }

const ramRingkas = (rows: RamRow[]) => rows.map((r) => ({
  kode: r.kode, kategori: r.kategori, parameter: r.parameter, formula: r.formula, satuan: r.satuan, diterapkan: r.diterapkan, sikap: r.sikap,
  limit: r.limit, appetite: r.appetite, tolerance: r.tolerance, hasil: r.hasil, status: r.status, arah: r.arah,
  inisiatif: (r.tambahan ?? r.pengendalian)?.inisiatif ?? null, kebijakan: (r.tambahan ?? r.pengendalian)?.kebijakan ?? null,
  program: (r.tambahan ?? r.pengendalian)?.program ?? null, anggaran: (r.tambahan ?? r.pengendalian)?.anggaran ?? null,
}));

const risikoRingkas = (register: RiskRegister[], aksi: MitigasiAksi[] | null) => register.filter((r) => r.risk_event).map((r, i) => ({
  no: i + 1, id: r.id, kategori: r.kategori, taksonomi: r.taksonomi_kode, risk_driver: r.risk_driver, risk_event: r.risk_event,
  deskripsi: r.deskripsi, root_cause: r.root_cause, probabilitas: r.probabilitas, deskripsi_dampak: r.deskripsi_dampak,
  nilai_dampak: r.nilai_dampak, kategori_dampak: r.kategori_dampak, top_risk: isTopRisk(r.kategori_dampak), expected_loss: r.expected_loss,
  existing_control: r.existing_control, rencana_mitigasi: r.rencana_mitigasi, kategori_mitigasi: r.kategori_mitigasi,
  parameter_ram: r.parameter_ram ?? [], target_probabilitas: r.target_probabilitas, target_nilai_dampak: r.target_nilai_dampak,
  aksi_mitigasi: (aksi ?? []).filter((a) => a.risk_id === r.id).map(({ aksi, kategori, pic, biaya, jadwal, output }) => ({ aksi, kategori, pic, biaya, jadwal, output })),
}));

async function ram() {
  const [params, ras, pengendalian, tambahan] = await Promise.all([api.params(), api.ras(), api.pengendalian(), api.ramTambahan()]);
  return ramRingkas(buildRam(params, ras, pengendalian, tambahan));
}

/** Isi kertas kerja yang relevan untuk lembar yang sedang dibuka. */
export async function dataLembar(path: string): Promise<Record<string, unknown>> {
  const p = path.match(/^\/parameter\/(.+)$/);
  if (p) {
    const [sheet, rows] = await Promise.all([api.param(p[1]), ram()]);
    return { parameter: sheet ? { code: sheet.code, title: sheet.title, diterapkan: sheet.diterapkan, summary: sheet.summary, inputs: sheet.inputs } : null, ram: rows.find((r) => r.kode === p[1]) ?? null };
  }
  switch (path) {
    case "/ras": {
      const [ras, tambahan] = await Promise.all([api.ras(), api.rasTambahan()]);
      return { ras, ras_tambahan: tambahan };
    }
    case "/ram": return { ram: await ram() };
    case "/risk-register":
    case "/risiko-utama": {
      const [register, aksi, rows] = await Promise.all([api.register(), api.mitigasiAksi(), ram()]);
      const risiko = risikoRingkas(register, aksi);
      return { risiko: path === "/risiko-utama" ? risiko.filter((r) => r.top_risk) : risiko, ram: rows };
    }
    case "/program-strategis": return { program_strategis: await api.program() };
    case "/cat": return { cat: await api.cat() };
    case "/risk-driver": return { risk_driver: await api.drivers() };
    case "/kriteria-dampak": return { kriteria_dampak: await api.kriteria() };
    default: {
      const [ras, register, aksi, rows, program] = await Promise.all([api.ras(), api.register(), api.mitigasiAksi(), ram(), api.program()]);
      return { ras, risiko: risikoRingkas(register, aksi), ram: rows, program_strategis: program };
    }
  }
}

export async function validasiChallenge(path: string, label: string, items: ChallengeLog[]): Promise<HasilValidasi[]> {
  const input: ValidasiInput = {
    lembar: label, data: await dataLembar(path),
    masukan: items.map((l) => ({ id: l.id, ref_label: l.ref_label, masukan: l.masukan, tanggapan: l.tanggapan })),
  };
  const res = await fetch("/api/validasi-challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? res.statusText);
  return (body as { hasil: HasilValidasi[] }).hasil;
}

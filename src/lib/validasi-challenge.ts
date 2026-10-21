import { api } from "./data";
import { isTopRisk } from "./format";
import { buildRam, type RamRow } from "./ram";
import { labelPos } from "./keterkaitan-rkap";
import { nilaiCakupan, type CakupanTopRisk } from "./cakupan-top-risk";
import { peringkatRisiko } from "./peringkat-risiko";
import type { ChallengeLog, MitigasiAksi, RiskRegister, RkapKeuangan } from "./types";

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

const risikoRingkas = (register: RiskRegister[], aksi: MitigasiAksi[] | null, rkapAktif: RkapKeuangan | null = null) => register.filter((r) => r.risk_event).map((r, i) => ({
  no: i + 1, id: r.id, kategori: r.kategori, taksonomi: r.taksonomi_kode, risk_driver: r.risk_driver, risk_event: r.risk_event,
  deskripsi: r.deskripsi, root_cause: r.root_cause, probabilitas: r.probabilitas, deskripsi_dampak: r.deskripsi_dampak,
  nilai_dampak: r.nilai_dampak, kategori_dampak: r.kategori_dampak, top_risk: isTopRisk(r.kategori_dampak), expected_loss: r.expected_loss,
  existing_control: r.existing_control, rencana_mitigasi: r.rencana_mitigasi, kategori_mitigasi: r.kategori_mitigasi,
  parameter_ram: r.parameter_ram ?? [], sasaran_strategis: r.sasaran_strategis ?? [], dasar_penilaian: r.dasar_penilaian ?? null,
  proses_bisnis: r.proses_bisnis ?? [], pos_rkap_2027: (r.pos_rkap ?? []).map((k) => labelPos(k, rkapAktif)), program_kerja_asumsi_rkap: r.program_kerja_rkap ?? null,
  target_probabilitas: r.target_probabilitas, target_nilai_dampak: r.target_nilai_dampak,
  aksi_mitigasi: (aksi ?? []).filter((a) => a.risk_id === r.id).map(({ aksi, kategori, pic, biaya, jadwal, output, bukti }) => ({ aksi, kategori, pic, biaya, jadwal, output, bukti: bukti ?? null })),
}));

async function ramPenuh() {
  const [params, ras, pengendalian, tambahan] = await Promise.all([api.params(), api.ras(), api.pengendalian(), api.ramTambahan()]);
  return { ras, rows: buildRam(params, ras, pengendalian, tambahan) };
}
async function ram() { return ramRingkas((await ramPenuh()).rows); }

/** Isi kertas kerja yang relevan untuk lembar yang sedang dibuka. */
export async function dataLembar(path: string): Promise<Record<string, unknown>> {
  const p = path.match(/^\/parameter\/(.+)$/);
  if (p) {
    const [sheet, rows] = await Promise.all([api.param(p[1]), ram()]);
    return { parameter: sheet ? { code: sheet.code, title: sheet.title, diterapkan: sheet.diterapkan, summary: sheet.summary, inputs: sheet.inputs } : null, ram: rows.find((r) => r.kode === p[1]) ?? null };
  }
  switch (path) {
    case "/ras": {
      // RAS dinilai bersama ambang batas RAM dan mekanisme eskalasi CAT, karena arahan RAS (1b, 1c, 1e) merujuk keduanya.
      const [ras, tambahan, rows, cat] = await Promise.all([api.ras(), api.rasTambahan(), ram(), api.cat().catch(() => [])]);
      return {
        ras, ras_tambahan: tambahan,
        ram_risiko_keuangan_dan_investasi: rows.filter((r) => /Keuangan|Investasi/.test(r.kategori)),
        cat_eskalasi_aksi_korporasi: cat,
      };
    }
    case "/ram": return { ram: await ram() };
    case "/risk-register":
    case "/risiko-utama": {
      const [register, aksi, rows, sasaran, rkap, cakupan, tax] = await Promise.all([
        api.register(), api.mitigasiAksi(), ram(), api.sasaran().catch(() => []), api.rkapAktif().catch(() => null), api.cakupanTopRisk().catch((): CakupanTopRisk => ({})), api.taksonomi().catch(() => []),
      ]);
      const aspek = new Map(tax.map((t) => [t.kode, `${t.aspek ?? ""} › ${t.risiko_korporat ?? ""}`]));
      const risiko = risikoRingkas(register, aksi, rkap).map((r) => ({ ...r, aspek_taksonomi: r.taksonomi ? aspek.get(r.taksonomi) ?? null : null }));
      const no = (id: string) => register.filter((r) => r.risk_event).findIndex((r) => r.id === id) + 1;
      const penuh = await ramPenuh();
      const peringkat = {
        aturan_penetapan_risiko_utama: "Template PT DAM v.2: Tagging Top Risk otomatis Ya bila kategori dampak Moderat, Tinggi, atau Sangat Tinggi. Seluruh risiko diperingkat menurut expected loss inheren (probabilitas × nilai dampak), dikaitkan dengan batas selera sikap RAS kategorinya dan status terburuk parameter RAM tertaut; tingkat pemantauan ditetapkan dari kaitan tersebut. Ditampilkan pada lembar Risiko Utama bagian C.",
        dasar_pemeringkatan_risiko_utama: peringkatRisiko(register, penuh.ras, penuh.rows).map((p) => ({
          peringkat: p.peringkat, no: p.no, risk_event: p.r.risk_event, expected_loss_inheren: p.el, kategori_dampak: p.r.kategori_dampak,
          sikap_ras: p.sikap, batas_selera: p.batas, terhadap_selera: p.terhadapSelera, status_ram_terburuk: p.ram, risiko_utama: p.utama, pemantauan: p.pemantauan,
        })),
      };
      if (path === "/risiko-utama") {
        // Lembar Risiko Utama dinilai dari ringkasan yang ringkas agar bukti pemeringkatan tidak tenggelam di detail rencana aksi.
        return {
          ...peringkat,
          risiko_material_non_utama: peringkat.dasar_pemeringkatan_risiko_utama.filter((p) => !p.risiko_utama),
          risiko: risiko.map((r) => ({
            no: r.no, kategori: r.kategori, aspek_taksonomi: r.aspek_taksonomi, risk_event: r.risk_event, probabilitas: r.probabilitas, nilai_dampak: r.nilai_dampak,
            kategori_dampak: r.kategori_dampak, top_risk: r.top_risk, parameter_ram: r.parameter_ram, target_probabilitas: r.target_probabilitas,
            target_nilai_dampak: r.target_nilai_dampak, jumlah_aksi_mitigasi: r.aksi_mitigasi.length,
          })),
          ram: rows.map((x) => ({ kode: x.kode, kategori: x.kategori, parameter: x.parameter, diterapkan: x.diterapkan, sikap: x.sikap, status: x.status })),
          telaah_cakupan_top_risk: nilaiCakupan(register, cakupan).map((h) => ({
            topik: h.topik.label, status: h.status, risiko_penutup: h.top.map((r) => `#${no(r.id)} ${r.risk_event}`), alasan: cakupan[h.topik.id]?.alasan ?? null,
          })),
        };
      }
      return {
        ...peringkat,
        // Seluruh risiko dikirim (top_risk true/false) agar risiko material non-utama yang tetap dipantau ikut terlihat.
        risiko, ram: rows,
        sasaran_strategis_rjpp: sasaran.map((s) => ({ kode: s.kode, pilar: s.pilar, nama: s.nama, target: s.target })),
        // Telaah cakupan topik wajib Top Risks (pasar, likuiditas, jasa, investasi, Fraud, ESG, PDP/Cyber) beserta keputusan dan alasannya.
        telaah_cakupan_top_risk: nilaiCakupan(register, cakupan).map((h) => ({
          topik: h.topik.label, status: h.status, risiko_penutup: h.top.map((r) => `#${no(r.id)} ${r.risk_event}`),
          alasan: cakupan[h.topik.id]?.alasan ?? null, catatan: h.catatan,
        })),
      };
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

/** Konfirmasi manual Selesai untuk masukan yang dinilai AI "perlu dicek manual". */
export async function konfirmasiManual(id: string, bukti: string) {
  const res = await fetch("/api/validasi-challenge/konfirmasi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, bukti }) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? res.statusText);
}

/** Server yang menyimpan hasil: status Selesai hanya untuk putusan "terpenuhi". */
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

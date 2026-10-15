/**
 * Mutu isian Risk Register tanpa AI: saran Kategori Dampak dari Kriteria Dampak Acuan dan
 * pemeriksaan kualitas per baris (root cause, mitigasi, kelengkapan besaran risiko).
 */
import type { KriteriaDampak, ParameterSheet, RiskRegister } from "./types";

export const LEVEL_DAMPAK = ["Sangat Rendah", "Rendah", "Moderat", "Tinggi", "Sangat Tinggi"] as const;
const KOLOM_LEVEL = ["sangat_rendah", "rendah", "moderat", "tinggi", "sangat_tinggi"] as const;

// ---------- batas kriteria ----------
type Dimensi = "%" | "bps" | "waktu" | "berita";
const SATUAN: Record<string, { dim: Dimensi; f: number }> = {
  "%": { dim: "%", f: 1 }, bps: { dim: "bps", f: 1 }, berita: { dim: "berita", f: 1 },
  jam: { dim: "waktu", f: 1 }, hari: { dim: "waktu", f: 24 }, minggu: { dim: "waktu", f: 168 }, bulan: { dim: "waktu", f: 720 },
};
const RE_SATUAN = "(%|bps|berita|jam|hari|minggu|bulan)";

interface Rentang { lo: number; loInc: boolean; hi: number; hiInc: boolean; dim: Dimensi }

const angka = (s: string) => Number((/^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s).replace(",", "."));

/** "≤5%", "5% < x ≤ 10%", ">7 hari", "75% ≤ x < 90%", "4 jam < x ≤ 1 hari". null bila kualitatif. */
export function parseBatas(teks: string | null | undefined): Rentang | null {
  if (!teks) return null;
  const s = teks.replace(/\s+/g, " ").trim();
  const range = s.match(new RegExp(`^([\\d.,]+) ?${RE_SATUAN}? ?(<|≤) ?x ?(<|≤) ?([\\d.,]+) ?${RE_SATUAN}`));
  if (range) {
    const u2 = SATUAN[range[6]], u1 = SATUAN[range[2] ?? range[6]];
    if (!u1 || !u2 || u1.dim !== u2.dim) return null;
    return { lo: angka(range[1]) * u1.f, loInc: range[3] === "≤", hi: angka(range[5]) * u2.f, hiInc: range[4] === "≤", dim: u2.dim };
  }
  const satu = s.match(new RegExp(`^(≤|<|≥|>) ?([\\d.,]+) ?${RE_SATUAN}`));
  if (satu) {
    const u = SATUAN[satu[3]], v = angka(satu[2]) * u.f;
    const atas = satu[1] === "≤" || satu[1] === "<";
    return atas
      ? { lo: -Infinity, loInc: false, hi: v, hiInc: satu[1] === "≤", dim: u.dim }
      : { lo: v, loInc: satu[1] === "≥", hi: Infinity, hiInc: false, dim: u.dim };
  }
  return null;
}

const masuk = (x: number, r: Rentang) => (r.loInc ? x >= r.lo : x > r.lo) && (r.hiInc ? x <= r.hi : x < r.hi);

/** Kriteria yang dipilih di Risk Register disimpan sebagai "b. Nama kriteria". */
export function cariKriteria(list: KriteriaDampak[], r: Pick<RiskRegister, "kategori" | "kriteria_dampak">) {
  if (!r.kriteria_dampak) return undefined;
  return list.find((k) => k.kategori === r.kategori && `${k.kode}. ${k.kriteria}` === r.kriteria_dampak);
}

/** Label pilihan Kategori Dampak beserta batas kriteria acuan, mis. "Moderat — 3% < x ≤ 5%". */
export function labelLevel(k: KriteriaDampak | undefined) {
  return LEVEL_DAMPAK.map((l, i) => ({ value: l, label: k?.[KOLOM_LEVEL[i]] ? `${l} — ${k[KOLOM_LEVEL[i]]}` : l }));
}

/** EBITDA RKAP 2027 yang sudah diisi pada lembar 5c, 5d, atau 8a. */
export function ebitdaRkap(params: Pick<ParameterSheet, "code" | "inputs">[]): { nilai: number; sumber: string } | null {
  for (const [code, addr] of [["5c", "I53"], ["5d", "I70"], ["8a", "I133"]] as const) {
    const v = params.find((p) => p.code === code)?.inputs?.[addr];
    if (typeof v === "number" && v > 0) return { nilai: v, sumber: `lembar ${code}` };
  }
  return null;
}

export interface SaranDampak { level: (typeof LEVEL_DAMPAK)[number]; ukuran: string; sumber: string }

const fmt = (n: number, d = 2) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(n);
const RE_UKUR: Record<Dimensi, RegExp> = {
  "%": /(\d+(?:[.,]\d+)?) ?%/i, bps: /(\d+(?:[.,]\d+)?) ?bps/i, berita: /(\d+) ?berita/i,
  waktu: /(\d+(?:[.,]\d+)?) ?(jam|hari|minggu|bulan)/i,
};

/**
 * Saran Kategori Dampak dari kriteria acuan:
 * - kriteria berbasis EBITDA: Nilai Dampak ÷ EBITDA RKAP 2027;
 * - kriteria kuantitatif lain: besaran pertama bersatuan sama di Deskripsi Dampak.
 * null bila kriteria kualitatif atau besaran tidak tersedia.
 */
export function saranDampak(r: RiskRegister, k: KriteriaDampak | undefined, ebitda: { nilai: number; sumber: string } | null): SaranDampak | null {
  if (!k) return null;
  const batas = KOLOM_LEVEL.map((c) => parseBatas(k[c]));
  const dim = batas.find((b) => b)?.dim;
  if (!dim) return null;

  let x: number | null = null, ukuran = "", sumber = "";
  if (dim === "%" && /ebitda/i.test(k.perhitungan ?? "") && r.nilai_dampak != null && ebitda) {
    x = (Number(r.nilai_dampak) / ebitda.nilai) * 100;
    ukuran = `${fmt(x)}% dari EBITDA`;
    sumber = `Nilai Dampak ÷ EBITDA RKAP 2027 Rp${fmt(ebitda.nilai, 0)} (${ebitda.sumber})`;
  } else {
    const m = (r.deskripsi_dampak ?? "").match(RE_UKUR[dim]);
    if (m) {
      x = angka(m[1]) * (dim === "waktu" ? SATUAN[m[2].toLowerCase()].f : 1);
      ukuran = m[0];
      sumber = `dibaca dari Deskripsi Dampak ("${m[0]}")`;
    }
  }
  if (x == null || !Number.isFinite(x)) return null;
  const i = batas.findIndex((b) => b && masuk(x, b));
  return i < 0 ? null : { level: LEVEL_DAMPAK[i], ukuran, sumber };
}

// ---------- pemeriksaan kualitas per baris ----------
const STOP = new Set(["yang", "dan", "atau", "dari", "untuk", "dengan", "pada", "akibat", "karena", "dalam", "oleh", "terhadap", "tidak", "adanya", "serta", "secara", "atas", "agar", "bagi", "ini", "itu", "akan"]);
const kata = (s?: string | null) => new Set((s ?? "").toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? []);
/** Koefisien tumpang tindih kata: 1 = teks pendek seluruhnya termuat di teks lain. */
function mirip(a?: string | null, b?: string | null) {
  const A = kata(a), B = kata(b);
  if (A.size < 2 || B.size < 2) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

const RE_WAKTU = /\b(20\d\d|triwulan|tw ?[1-4iv]+|semester|kuartal|q[1-4]|bulan(an)?|minggu(an)?|harian|tahunan|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|setiap|berkala|paling lambat)\b/i;
const RE_PIC = /\b(divisi|bagian|unit|fungsi|direktorat|direksi|direktur|tim|manajer|manager|kepala|sekretariat|satuan|pic|sevp|gm|general manager|spi|komite|departemen|biro)\b/i;
const RE_TARGET = /\d|%|\b(seluruh|100|minimal|maksimal|paling sedikit|nol|zero)\b/i;

export interface Isu { kolom: string; pesan: string }

export function cekKualitas(r: RiskRegister, saran: SaranDampak | null): Isu[] {
  const out: Isu[] = [];
  const isi = (s?: string | null) => !!s && s.trim() !== "";

  if (isi(r.root_cause)) {
    if (kata(r.root_cause).size < 3) out.push({ kolom: "Root Cause", pesan: "Terlalu singkat. Jelaskan penyebab mendasar, bukan gejala." });
    else if (mirip(r.root_cause, `${r.risk_event ?? ""} ${r.deskripsi ?? ""}`) >= 0.8) out.push({ kolom: "Root Cause", pesan: "Mengulang Risk Event/deskripsinya. Root cause harus menjawab \"mengapa risiko ini bisa terjadi\"." });
  }
  if (isi(r.deskripsi_dampak) && isi(r.risk_event) && mirip(r.deskripsi_dampak, r.risk_event) >= 0.8) {
    out.push({ kolom: "Deskripsi Dampak", pesan: "Mengulang Risk Event. Jelaskan konsekuensinya (finansial/non-finansial) bila risiko terjadi." });
  }
  if (isi(r.rencana_mitigasi)) {
    if (isi(r.existing_control) && mirip(r.rencana_mitigasi, r.existing_control) >= 0.7) {
      out.push({ kolom: "Rencana Mitigasi", pesan: "Sama/mirip dengan Existing Control. Mitigasi harus tindakan baru untuk RKAP 2027." });
    }
    const kurang = [!RE_PIC.test(r.rencana_mitigasi!) && "PIC/fungsi", !RE_WAKTU.test(r.rencana_mitigasi!) && "waktu", !RE_TARGET.test(r.rencana_mitigasi!) && "target terukur"].filter(Boolean);
    if (kurang.length) out.push({ kolom: "Rencana Mitigasi", pesan: `Belum menyebut ${kurang.join(", ")}.` });
  }
  if ((r.probabilitas != null) !== (r.nilai_dampak != null)) {
    out.push({ kolom: "Besaran Risiko", pesan: r.probabilitas != null ? "Probabilitas terisi tetapi Nilai Dampak kosong." : "Nilai Dampak terisi tetapi Probabilitas kosong." });
  }
  if (saran && r.kategori_dampak && r.kategori_dampak !== saran.level) {
    out.push({ kolom: "Kategori Dampak", pesan: `${r.kategori_dampak} tidak sesuai kriteria acuan: ${saran.ukuran} masuk level ${saran.level}.` });
  }
  return out;
}

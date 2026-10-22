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
  "%": /(\d+(?:[.,]\d+)?) ?%/gi, bps: /(\d+(?:[.,]\d+)?) ?bps/gi, berita: /(\d+) ?berita/gi,
  waktu: /(\d+(?:[.,]\d+)?) ?(jam|hari|minggu|bulan)/gi,
};
const NAMA_DIMENSI: Record<Dimensi, string> = { "%": "persentase (%)", bps: "basis poin (bps)", berita: "jumlah berita", waktu: "durasi (jam/hari)" };
/** Kata umum pada nama kriteria yang tidak membantu menemukan besaran yang dimaksud di Deskripsi Dampak. */
const KATA_UMUM = new Set(["dampak", "penurunan", "kenaikan", "perubahan", "jumlah", "nilai"]);

/** Dimensi ukur kriteria kuantitatif dan apakah ukurannya dihitung dari EBITDA; null bila kriteria kualitatif. */
function ukurKriteria(k: KriteriaDampak) {
  const dim = KOLOM_LEVEL.map((c) => parseBatas(k[c])).find((b) => b)?.dim;
  return dim ? { dim, ebitda: dim === "%" && /ebitda/i.test(k.perhitungan ?? "") } : null;
}

/**
 * Besaran di Deskripsi Dampak yang mengukur kriteria: diutamakan angka yang didahului kata kunci nama kriteria
 * (mis. "menekan margin kotor sekitar 4,6%"), bukan angka pertama yang bisa jadi rasio lain ("2% dari beban pengolahan").
 */
function besaranDeskripsi(teks: string, dim: Dimensi, k: KriteriaDampak) {
  const semua = [...teks.matchAll(RE_UKUR[dim])];
  const kunci = [...kata(k.kriteria)].filter((w) => !KATA_UMUM.has(w));
  return semua.find((m) => kunci.some((w) => teks.slice(Math.max(0, m.index! - 60), m.index).toLowerCase().includes(w))) ?? semua[0];
}

/**
 * Saran Kategori Dampak dari kriteria acuan:
 * - kriteria berbasis EBITDA: Nilai Dampak ÷ EBITDA RKAP 2027;
 * - kriteria kuantitatif lain: besaran pertama bersatuan sama di Deskripsi Dampak.
 * null bila kriteria kualitatif atau besaran tidak tersedia.
 */
export function saranDampak(r: RiskRegister, k: KriteriaDampak | undefined, ebitda: { nilai: number; sumber: string } | null): SaranDampak | null {
  if (!k) return null;
  const batas = KOLOM_LEVEL.map((c) => parseBatas(k[c]));
  const u = ukurKriteria(k);
  if (!u) return null;
  const { dim } = u;

  let x: number | null = null, ukuran = "", sumber = "";
  if (u.ebitda && r.nilai_dampak != null && ebitda) {
    // Dibulatkan agar nilai tepat di batas (mis. 3% EBITDA) tidak terbaca 3,0000000000000004% dan naik satu level.
    x = Math.round((Number(r.nilai_dampak) / ebitda.nilai) * 100 * 1e6) / 1e6;
    ukuran = `${fmt(x)}% dari EBITDA`;
    sumber = `Nilai Dampak ÷ EBITDA RKAP 2027 Rp${fmt(ebitda.nilai, 0)} (${ebitda.sumber})`;
  } else {
    const m = besaranDeskripsi(r.deskripsi_dampak ?? "", dim, k);
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

/** Expected Loss hasil hitung bila isian menyimpang lebih dari 1% dari probabilitas × nilai dampak (selisih pembulatan diterima); selain itu null. */
export function elKeliru(r: RiskRegister): number | null {
  if (r.probabilitas == null || r.nilai_dampak == null || !(Number(r.expected_loss) > 0)) return null;
  const hitung = Number(r.probabilitas) * Number(r.nilai_dampak);
  return Math.abs(Number(r.expected_loss) - hitung) > Math.max(1000, hitung * 0.01) ? hitung : null;
}

/** Nominal rupiah pertama setelah awalan di teks, mis. "Target residual: Rp4,88 M"; tol = setengah satuan digit terakhir yang ditulis. */
function rupiahTeks(teks: string, awalan: string) {
  const m = teks.match(new RegExp(`${awalan}\\s*Rp\\s?(\\d[\\d.]*(?:,\\d+)?)\\s?(jt|juta|M|miliar)\\b`, "i"));
  if (!m) return null;
  const [bulat, des = ""] = m[1].split(",");
  const f = /^(jt|juta)$/i.test(m[2]) ? 1e6 : 1e9;
  return { nilai: Number(`${bulat.replace(/\./g, "")}.${des || "0"}`) * f, tol: 0.5 * 10 ** -des.length * f, teks: `Rp${m[1]} ${m[2]}` };
}

/**
 * Target Kategori Dampak dibandingkan kriteria acuan memakai Target Nilai Dampak. Hanya kriteria berbasis EBITDA yang bisa diuji,
 * karena besaran di Deskripsi Dampak menggambarkan kondisi inheren.
 */
export function cekKategoriTarget(r: RiskRegister, k: KriteriaDampak | undefined, ebitda: { nilai: number; sumber: string } | null): Isu | null {
  if (r.target_nilai_dampak == null || !r.target_kategori_dampak) return null;
  const s = saranDampak({ ...r, nilai_dampak: r.target_nilai_dampak, deskripsi_dampak: null }, k, ebitda);
  return s && s.level !== r.target_kategori_dampak
    ? { kolom: "Target Residual", pesan: `Target ${r.target_kategori_dampak} tidak sesuai kriteria acuan: Target Nilai Dampak Rp${fmt(Number(r.target_nilai_dampak), 0)} = ${s.ukuran}, masuk level ${s.level}. Sesuaikan nilai atau kategori targetnya.` }
    : null;
}

/** Angka di Dasar Penilaian yang tidak sama dengan kolomnya, biasanya karena kolom diubah tetapi teks tidak ikut diperbarui. */
/** Unsur dasar penilaian sesuai arahan Challenge Session 2f, ditambah probabilitas dan target residual. */
const UNSUR_DASAR: { nama: string; re: RegExp; perluTarget?: boolean }[] = [
  { nama: "data historis", re: /histor|loss event|realisasi|pernah terjadi/i },
  { nama: "proyeksi RKAP 2027", re: /rkap|proyeksi/i },
  { nama: "skenario (ringan/dasar/berat)", re: /skenario/i },
  { nama: "alasan probabilitas", re: /probabilitas|kemungkinan|frekuensi/i },
  { nama: "dasar target residual", re: /target/i, perluTarget: true },
];

const persenAtauDesimal = (angkaTeks: string, adaPersen: boolean) => {
  const n = Number(angkaTeks.replace(",", "."));
  return adaPersen || n > 1 ? n / 100 : n;
};
const fmtPersen = (p: number) => `${fmt(p * 100)}%`;

/**
 * Probabilitas yang disebut di teks dibandingkan dengan kolomnya: "probabilitas 0,25", "probabilitasnya diangka 1 %",
 * "probabilitas target tetap 20%", serta frekuensi "1 kali dalam/selama 4 tahun" (dibandingkan sebagai laju tahunan).
 */
function cekProbabilitasTeks(r: RiskRegister, teks: string): string[] {
  const out: string[] = [];
  for (const m of teks.matchAll(/probabilitas\w*\s+((?:[a-z]+\s+){0,3}?)(\d+(?:[.,]\d+)?)\s*(%?)/gi)) {
    const target = /target/i.test(m[1]);
    const kolom = target ? r.target_probabilitas : r.probabilitas;
    const p = persenAtauDesimal(m[2], m[3] === "%");
    if (kolom != null && p <= 1 && Math.abs(p - Number(kolom)) > 0.005) {
      out.push(`Menyebut ${target ? "probabilitas target" : "probabilitas"} ${fmtPersen(p)} ("${m[0].trim()}"), sedangkan kolom ${target ? "Target Probabilitas" : "Probabilitas"} ${fmtPersen(Number(kolom))}. Samakan teks dengan angka di kolom.`);
    }
  }
  const f = teks.match(/(\d+) ?kali (?:selama|dalam) (\d+) tahun/i);
  if (f && r.probabilitas != null && Number(f[2]) > 0) {
    const laju = Number(f[1]) / Number(f[2]), p = Number(r.probabilitas);
    // Selisih wajar bila probabilitas masih 2/3–1,5 kali laju historis; di luar itu perlu alasan tertulis.
    if (laju > 0 && (p / laju > 1.5 || p / laju < 2 / 3)) {
      out.push(`Menyebut frekuensi "${f[0]}" (sekitar ${fmtPersen(laju)} per tahun), sedangkan Probabilitas ${fmtPersen(p)}. Sesuaikan probabilitas atau jelaskan alasannya.`);
    }
  }
  return out;
}

function cekDasarPenilaian(r: RiskRegister): Isu[] {
  // Kolom dasar_penilaian baru ada setelah migrasi 0010; sebelum itu tidak diperiksa.
  if (!("dasar_penilaian" in r)) return [];
  const teks = r.dasar_penilaian?.trim() ?? "";
  if (!teks) return [{ kolom: "Dasar Penilaian", pesan: "Kosong. Jelaskan dasar probabilitas dan nilai dampak: data historis, proyeksi RKAP 2027, skenario, dan target residual." }];
  const beda = (t: ReturnType<typeof rupiahTeks>, v: number | null | undefined) => t && v != null && Math.abs(t.nilai - Number(v)) > t.tol * 1.01 + 1;
  const dasar = rupiahTeks(teks, "\\bdasar"), target = rupiahTeks(teks, "Target residual:?");
  const adaTarget = r.target_nilai_dampak != null || r.target_probabilitas != null;
  const kurang = UNSUR_DASAR.filter((u) => (!u.perluTarget || adaTarget) && !u.re.test(teks)).map((u) => u.nama);
  return [
    kurang.length > 0 && `Belum memuat ${kurang.join(", ")}. Susun dengan urutan Historis – Proyeksi RKAP – Skenario – Probabilitas – Target agar setiap angka dapat ditelusuri.`,
    beda(dasar, r.nilai_dampak) && `Menyebut skenario dasar ${dasar!.teks}, sedangkan Nilai Dampak Rp${fmt(Number(r.nilai_dampak), 0)}. Samakan teks dengan angka di kolom.`,
    beda(target, r.target_nilai_dampak) && `Menyebut target residual ${target!.teks}, sedangkan Target Nilai Dampak Rp${fmt(Number(r.target_nilai_dampak), 0)}. Samakan teks dengan angka di kolom.`,
    ...cekProbabilitasTeks(r, teks),
  ].filter((p): p is string => !!p).map((pesan) => ({ kolom: "Dasar Penilaian", pesan }));
}

/**
 * aksiTerstruktur: PIC dan jadwal sudah tercatat di Rencana Aksi, jadwal/PIC tidak perlu lagi tertulis di teks mitigasi.
 * kriteria: Kriteria Dampak Acuan baris ini, untuk memeriksa apakah kategori dampaknya bisa diverifikasi.
 */
export function cekKualitas(r: RiskRegister, saran: SaranDampak | null, aksiTerstruktur = false, kriteria?: KriteriaDampak): Isu[] {
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
    // Template tidak punya kolom terpisah untuk PIC/waktu/target, jadi ketiganya diharapkan tertulis di dalam uraian mitigasi.
    if (kurang.length && !aksiTerstruktur) out.push({ kolom: "Rencana Mitigasi", pesan: `Uraian mitigasi belum menyebut ${kurang.join(", ")}. Tulis di dalam teks mitigasi, mis. "Divisi Keuangan …, paling lambat TW II 2027, target 100% …".` });
  }
  if ((r.probabilitas != null) !== (r.nilai_dampak != null)) {
    out.push({ kolom: "Besaran Risiko", pesan: r.probabilitas != null ? "Probabilitas terisi tetapi Nilai Dampak kosong." : "Nilai Dampak terisi tetapi Probabilitas kosong." });
  }
  const hitungEl = elKeliru(r);
  if (hitungEl != null) {
    out.push({ kolom: "Expected Loss", pesan: `Rp${fmt(Number(r.expected_loss), 0)} tidak sama dengan probabilitas × nilai dampak = Rp${fmt(hitungEl, 0)}.` });
  }
  if (saran && r.kategori_dampak && r.kategori_dampak !== saran.level) {
    out.push({ kolom: "Kategori Dampak", pesan: `${r.kategori_dampak} tidak sesuai kriteria acuan: ${saran.ukuran} masuk level ${saran.level}.` });
  }
  // Kriteria berbasis EBITDA dihitung dari Nilai Dampak; kriteria kuantitatif lain butuh besaran di Deskripsi Dampak agar kategori bisa diuji.
  const u = kriteria && ukurKriteria(kriteria);
  if (!saran && u && !u.ebitda && r.kategori_dampak) {
    out.push({ kolom: "Kategori Dampak", pesan: `${r.kategori_dampak} belum bisa diverifikasi: kriteria "${r.kriteria_dampak}" diukur dengan ${NAMA_DIMENSI[u.dim]}${kriteria.perhitungan ? ` (${kriteria.perhitungan})` : ""}, tetapi Deskripsi Dampak belum menyebut besarannya.` });
  }
  out.push(...cekDasarPenilaian(r));
  return out;
}

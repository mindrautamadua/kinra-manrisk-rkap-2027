/**
 * Data dokumen referensi penyusunan RKAP 2027: Rencana Strategis Pengembangan Kawasan (Draft RJPP 2026-2030)
 * dan Presentasi DKMR RKAP 2027. Dokumen berlabel rahasia, jadi datanya tidak ada di repo: ringkasan terstruktur,
 * transkrip per halaman, dan PDF asli disimpan di bucket privat Supabase Storage "referensi"
 * (scripts/referensi-unggah.mjs) dan dimuat lewat /api/referensi/[nama] yang wajib login.
 * Angka disalin apa adanya dari dokumen; inkonsistensi dicatat di `peringatan`, tidak dikoreksi.
 */
export type KodeDok = "renstra" | "dkmr";
export interface HalamanRef { dok: KodeDok; hal: number; judul: string; seksi: string | null; isi: string }
export const namaDok = (k: KodeDok) => (k === "renstra" ? "Renstra/RJPP" : "DKMR 2027");
/** URL PDF asli; tambahkan `#page=N` untuk membuka halaman tertentu. */
export const urlPdf = (k: KodeDok) => `/api/referensi/${k}.pdf`;

type Peringatan = { hal?: string; isi: string };
type BarisTahun = { label: string; nilai: number[]; hal?: number };
export interface Referensi {
  dokumen: { kode: KodeDok; judul: string; file: string; halaman: number }[];
  kawasan: {
    kondisi_2025: { hal: number; item: { label: string; nilai: string; ket: string }[] };
    aspirasi_2030: { hal: number; purpose: string; evolusi: string; target_pilar: { pilar: string; target: string; hal: number }[] };
    tahun: number[];
    keuangan: { satuan: string; baris: BarisTahun[]; rasio: { label: string; nilai: string[]; hal: number }[] };
    operasional: { baris: (BarisTahun & { satuan: string })[]; historis: { hal: number; tahun: number[]; baris: BarisTahun[] } };
    capex: { satuan: string; versi: BarisTahun[]; opex: BarisTahun };
    roadmap: { tahun: number; tema: string }[];
    inisiatif: { tahun: number; pilar: string; nama: string; hal: number }[];
    peringatan: Peringatan[];
  };
  risiko_rjpp: {
    hal: number; catatan: string;
    ambang: { capacity: number; tolerance: number; appetite: number; limit: number };
    rating: { inheren: number; residual: number };
    daftar: { no: number; nama: string; inheren: number[] | null; perlakuan: string; biaya: string; program: string; target: string; hal: number }[];
  };
  dkmr: {
    ambang: { capacity: number; tolerance: number; appetite: number; limit: number; hal: number };
    jumlah: { total: number; high: number; moderate_to_high: number; moderate: number; hal: number };
    eksposur: { inheren: number; biaya_perlakuan: number; penurunan: number; residual: number; hal: number };
    top_risk_t5: { no: number; kpi: string; nama: string; inheren: string; eks_inheren: number; residual: string; eks_residual: number }[];
    risiko_t4: {
      no: number; hal: number; kategori: string; nama: string; inheren: string; residual: string; eks_inheren: number; eks_residual: number;
      peristiwa: { nama: string; hal: number; biaya: number; perlakuan: string }[];
    }[];
    parameter: { kategori: string; nama: string; satuan: string; limit: string; appetite: string; tolerance: string | null; hal: number }[];
    peringatan: Peringatan[];
  };
  lintas_dokumen: Peringatan[];
}

async function ambil<T>(nama: string): Promise<T> {
  const r = await fetch(`/api/referensi/${nama}`);
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Gagal memuat ${nama} (${r.status})`);
  return r.json();
}
export async function muatReferensi() {
  const [ref, halaman] = await Promise.all([ambil<Referensi>("referensi-strategis.json"), ambil<HalamanRef[]>("referensi-halaman.json")]);
  return { ref, halaman };
}

// ---------- padanan ke data aplikasi ----------
/**
 * Keputusan manual per risiko referensi (kunci "renstra:<no>" / "dkmr:<hal>"): id risiko Register yang mewakilinya,
 * atau status bila belum/tidak ada. Disimpan di app_settings.padanan_referensi.
 */
export type StatusPadanan = "belum_ada" | "tidak_relevan";
export type PadananReferensi = Record<string, { risk_id?: string | null; status?: StatusPadanan | null }>;

const STOP = new Set([
  "dan", "atau", "yang", "di", "ke", "dari", "dalam", "atas", "akibat", "oleh", "untuk", "pada", "dengan", "tidak", "adanya",
  "risiko", "kepada", "terhadap", "serta", "maupun", "sebagai", "perusahaan", "kawasan", "tenant",
]);
const token = (s?: string | null) =>
  new Set((s ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

/**
 * Saran awal padanan: kandidat yang berbagi minimal dua kata utuh dengan nama acuan. Nama risiko di dokumen dan
 * di Register (taksonomi) sering berbeda istilah, jadi sengaja ketat: lebih baik tanpa saran daripada saran keliru.
 */
export function saranPadanan<T>(acuan: string, list: T[], teks: (t: T) => string | null | undefined) {
  const a = token(acuan);
  let best: { item: T; n: number } | null = null;
  for (const item of list) {
    const b = token(teks(item));
    let n = 0;
    a.forEach((w) => { if (b.has(w)) n++; });
    if (n >= 2 && (!best || n > best.n)) best = { item, n };
  }
  return best?.item ?? null;
}

/** Rp miliar → teks "Rp12,50 M". */
export const miliar = (v: number | null | undefined, d = 2) =>
  v == null ? "–" : `Rp${new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)} M`;

/** Selisih relatif a terhadap b (null bila salah satu kosong). */
export const selisih = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || b === 0 ? null : (a - b) / Math.abs(b);

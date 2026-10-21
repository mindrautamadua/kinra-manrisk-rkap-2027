import type { StatusUkur } from "./types";

const idNum = (d = 0) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

export function rupiah(v: number | null | undefined, compact = false) {
  if (v == null || isNaN(Number(v))) return "–";
  const n = Number(v);
  if (compact) {
    const a = Math.abs(n);
    if (a >= 1e12) return `Rp ${idNum(2).format(n / 1e12)} T`;
    if (a >= 1e9) return `Rp ${idNum(2).format(n / 1e9)} M`;
    if (a >= 1e6) return `Rp ${idNum(1).format(n / 1e6)} jt`;
  }
  return `Rp ${idNum(0).format(n)}`;
}
export const angka = (v: number | null | undefined, d = 0) => (v == null || isNaN(Number(v)) ? "–" : idNum(d).format(Number(v)));
export const persen = (v: number | null | undefined, d = 1) => (v == null || isNaN(Number(v)) ? "–" : `${idNum(d).format(Number(v) * 100)}%`);

/** Tampilkan nilai parameter sesuai satuan (%, kali, dll). */
export function nilaiParam(v: unknown, satuan?: string | null) {
  if (v == null || v === "") return "–";
  if (typeof v !== "number") return String(v);
  if (satuan === "%") return persen(v, 2);
  if (satuan === "kali") return `${idNum(2).format(v)}×`;
  return idNum(2).format(v);
}

export const STATUS_STYLE: Record<string, { dot: string; chip: string; label: string }> = {
  Hijau: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 ring-emerald-600/20", label: "Hijau" },
  Merah: { dot: "bg-rose-600", chip: "bg-rose-50 text-rose-800 ring-rose-600/25", label: "Merah" },
};
export function statusStyle(s: StatusUkur | null | undefined) {
  s = statusBiner(s);
  return STATUS_STYLE[s ?? ""] ?? { dot: "bg-slate-300", chip: "bg-slate-50 text-slate-600 ring-slate-400/25", label: s || "–" };
}

export const DAMPAK_STYLE: Record<string, string> = {
  "Sangat Rendah": "bg-emerald-600 text-white",
  Rendah: "bg-lime-500 text-white",
  Moderat: "bg-amber-400 text-amber-950",
  Tinggi: "bg-orange-500 text-white",
  "Sangat Tinggi": "bg-rose-600 text-white",
};

export const SIKAP_STYLE: Record<string, string> = {
  "Zero Tolerance": "bg-slate-900 text-white",
  Conservative: "bg-sky-100 text-sky-900",
  Moderate: "bg-amber-100 text-amber-900",
  Aggressive: "bg-rose-100 text-rose-900",
};
const SIKAP_RANK: Record<string, number> = { "Zero Tolerance": 0, Conservative: 1, Moderate: 2, Aggressive: 3 };
/** Definisi sikap risiko menurut template PT DAM v.2 (sama dengan catatan lembar RAS), urut dari yang paling ketat. */
export const ARTI_SIKAP: Record<string, { ringkas: string; isi: string }> = {
  "Zero Tolerance": {
    ringkas: "Tidak menerima risiko maupun penyimpangan.",
    isi: "Tidak bersedia mengambil risiko dan tidak memperkenankan adanya pelanggaran atau penyimpangan serta mengutamakan keberlangsungan operasi dengan kepatuhan mutlak dan pengendalian yang ketat.",
  },
  Conservative: {
    ringkas: "Risiko rendah dan terkontrol.",
    isi: "Bersedia mengambil risiko pada tingkat yang rendah dan terkontrol dengan prioritas pada keberlangsungan usaha, perlindungan aset, dan pencapaian target yang berkelanjutan.",
  },
  Moderate: {
    ringkas: "Risiko seimbang dengan manfaat.",
    isi: "Bersedia mengambil risiko dengan tingkat risiko yang seimbang dengan manfaat atau nilai yang diharapkan sepanjang masih berada dalam kapasitas risiko perusahaan dan dijalankan sebagai bagian dari proses penciptaan nilai perusahaan.",
  },
  Aggressive: {
    ringkas: "Risiko relatif tinggi demi pertumbuhan.",
    isi: "Bersedia mengambil risiko dengan tingkat yang relatif tinggi untuk mencapai pertumbuhan, transformasi atau penciptaan nilai yang lebih besar sepanjang masih berada dalam kapasitas risiko perusahaan dan mendukung tujuan strategis yang signifikan.",
  },
};
/** Sikap entitas harus sama atau lebih konservatif dari induk. */
export function cekSikap(entitas?: string | null, induk?: string | null) {
  if (!entitas || !induk) return "";
  return SIKAP_RANK[entitas] <= SIKAP_RANK[induk] ? "Sesuai" : "Lebih agresif dari Induk";
}

/** Top risk otomatis: kategori dampak Moderat, Tinggi, atau Sangat Tinggi. */
export const isTopRisk = (k?: string | null) => k === "Moderat" || k === "Tinggi" || k === "Sangat Tinggi";

/**
 * Status pengukuran mengikuti risk threshold PTPN III yang hanya mengenal dua warna:
 * Merah hanya bila hasil sudah melewati Tolerance, selain itu (termasuk tepat di Tolerance) Hijau.
 * - makin tinggi makin buruk: > Tolerance Merah, selain itu Hijau
 * - makin rendah makin buruk: < Tolerance Merah, selain itu Hijau
 */
export function hitungStatus(hasil: unknown, limit: unknown, appetite: unknown, tolerance: unknown, arah: string | null | undefined): StatusUkur {
  if (typeof hasil !== "number") return "Data belum lengkap";
  if ([limit, appetite, tolerance].some((x) => typeof x !== "number")) return "Batas belum diisi";
  const x = Math.round(hasil * 1e10) / 1e10;
  const t = tolerance as number;
  if ((arah ?? "").includes("rendah makin buruk")) return x < t ? "Merah" : "Hijau";
  return x > t ? "Merah" : "Hijau";
}

/** Data lama yang tersimpan dari rumus empat warna bisa masih berisi Kuning/Oranye; keduanya masih dalam Tolerance sehingga dibaca Hijau. */
export const statusBiner = <T,>(s: T): T => (s === "Kuning" || s === "Oranye" ? ("Hijau" as T) : s);

/** Polaritas parameter untuk pembaca awam: "Makin rendah makin buruk" berarti target dimaksimalkan, sebaliknya diminimalkan. */
export const ARAH_PILIHAN = ["Makin tinggi makin buruk", "Makin rendah makin buruk"];
export const polaritas = (arah?: string | null) =>
  (arah ?? "").toLowerCase().includes("rendah makin buruk")
    ? { naik: true, label: "Makin tinggi makin baik", detail: "Hasil di bawah limit memburuk statusnya" }
    : { naik: false, label: "Makin rendah makin baik", detail: "Hasil di atas limit memburuk statusnya" };

/** Penjelasan tiap jenis risk threshold untuk hint di header tabel RAM dan CAT. */
export const ARTI_THRESHOLD = {
  "Risk Threshold": {
    isi: "Tiga batas berjenjang untuk menilai hasil pengukuran, dari yang paling ketat (Limit) ke yang paling longgar (Tolerance). Risk threshold adalah expected residual risk, yaitu risiko setelah mitigasi, dan wajib didukung perhitungan kemampuan entitas menyerapnya.",
    aksi: "Urutan angka mengikuti arah parameter: makin tinggi makin baik berarti Limit > Appetite > Tolerance; makin rendah makin baik berarti Limit < Appetite < Tolerance.",
  },
  Limit: {
    isi: "Batas aman pertama, yaitu batas kinerja normal yang ingin dijaga perusahaan.",
    aksi: "Batas kinerja normal; dipakai sebagai acuan pemantauan, tidak mengubah warna status.",
  },
  Appetite: {
    isi: "Batas risiko yang bersedia diambil perusahaan untuk mencapai sasarannya.",
    aksi: "Batas yang bersedia diambil; dipakai sebagai acuan pemantauan, tidak mengubah warna status.",
  },
  Tolerance: {
    isi: "Batas maksimal penyimpangan yang masih dapat ditanggung perusahaan.",
    aksi: "Masih dalam Tolerance, termasuk tepat di Tolerance: Hijau. Sudah melewati Tolerance: Merah, eskalasi dan intervensi PT DAM.",
  },
} as const;

/** Arti tiap status pengukuran, ringkas untuk legenda. */
export const ARTI_STATUS: Record<string, string> = {
  Hijau: "Dalam batas toleransi",
  Merah: "Melewati batas toleransi",
  "Data belum lengkap": "Hasil atau batas belum diisi",
};

/** Narasi status untuk pembaca awam: apa arti warnanya dan apa yang perlu dilakukan. */
export const NARASI_STATUS: Record<string, string> = {
  Hijau: "Aman. Hasil masih dalam batas toleransi yang ditetapkan.",
  Merah: "Kritis. Sudah melewati batas toleransi maksimal perusahaan. Perlu tindakan pemulihan segera.",
  "Data belum lengkap": "Status belum dapat ditentukan karena hasil pengukuran atau batasnya belum diisi.",
  "Batas belum diisi": "Status belum dapat ditentukan karena limit, appetite, atau tolerance belum diisi.",
};

/**
 * Kasus kertas kerja yang hasilnya tidak berupa satu angka tetapi tetap dibaca sudah melewati Tolerance:
 * - rasio terhadap EBITDA: EBITDA ≤ 0 membuat rasio tidak terhingga sehingga pasti melewati Tolerance;
 * - K1: Merah bila minimal satu sub-item melewati Tolerance-nya sendiri.
 */
export const ATURAN_KHUSUS: Record<string, string> = Object.fromEntries([
  ...["2a", "2b", "5a", "5b", "5c", "5d", "8a", "8b"].map((k) => [k, "EBITDA RKAP 2027 bernilai ≤ 0 sehingga rasio tidak terhingga dan pasti melewati Tolerance"]),
  ["K1", "Minimal satu sub-item sudah melewati Tolerance-nya"],
]);

/**
 * Urutan risk threshold harus mengikuti arah parameter:
 * makin tinggi makin buruk: Limit ≤ Appetite ≤ Tolerance; makin rendah makin buruk: Limit ≥ Appetite ≥ Tolerance (sama dengan uji kewajaran lembar parameter).
 * Mengembalikan pesan bila urutan salah, null bila benar atau batas belum lengkap.
 */
export function cekUrutanBatas(limit: unknown, appetite: unknown, tolerance: unknown, arah: string | null | undefined) {
  if (![limit, appetite, tolerance].every((v) => typeof v === "number")) return null;
  const [l, a, t] = [limit, appetite, tolerance] as number[];
  const naik = (arah ?? "").includes("rendah makin buruk");
  const ok = naik ? l >= a && a >= t : l <= a && a <= t;
  if (ok) return null;
  return naik
    ? "Urutan batas tidak sesuai arah: untuk parameter makin rendah makin buruk seharusnya Limit ≥ Appetite ≥ Tolerance"
    : "Urutan batas tidak sesuai arah: untuk parameter makin tinggi makin buruk seharusnya Limit ≤ Appetite ≤ Tolerance";
}

/** Kalimat penjelas kenapa sebuah parameter berstatus Merah, dibandingkan langsung dengan batas yang dilewati sesuai arah parameter. */
export function alasanStatus(status: string, hasil: unknown, limit: unknown, appetite: unknown, tolerance: unknown, satuan?: string | null, arah?: string | null, kode?: string | null) {
  if (status !== "Merah") return null;
  if (![hasil, limit, appetite, tolerance].every((v) => typeof v === "number")) return kode ? ATURAN_KHUSUS[kode] ?? null : null;
  const x = hasil as number;
  const t = tolerance as number;
  const naik = (arah ?? "").includes("rendah makin buruk");
  const lewat = naik ? x < t : x > t;
  if (!lewat) return (kode && ATURAN_KHUSUS[kode]) ?? null;
  const [h, tt] = [hasil, tolerance].map((v) => nilaiParam(v, satuan));
  return `Hasil ${h} ${naik ? "di bawah" : "di atas"} toleransi ${tt}`;
}

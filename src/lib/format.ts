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
  Kuning: { dot: "bg-amber-400", chip: "bg-amber-50 text-amber-800 ring-amber-500/30", label: "Kuning" },
  Oranye: { dot: "bg-orange-500", chip: "bg-orange-50 text-orange-800 ring-orange-600/25", label: "Oranye" },
  Merah: { dot: "bg-rose-600", chip: "bg-rose-50 text-rose-800 ring-rose-600/25", label: "Merah" },
};
export function statusStyle(s: StatusUkur | null | undefined) {
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
 * Status pengukuran sesuai kertas kerja:
 * - makin tinggi makin buruk: < Limit Hijau, < Appetite Kuning, < Tolerance Oranye, selain itu Merah
 * - makin rendah makin buruk: >= Limit Hijau, > Appetite Kuning, > Tolerance Oranye, selain itu Merah
 */
export function hitungStatus(hasil: unknown, limit: unknown, appetite: unknown, tolerance: unknown, arah: string | null | undefined): StatusUkur {
  if (typeof hasil !== "number") return "Data belum lengkap";
  if ([limit, appetite, tolerance].some((x) => typeof x !== "number")) return "Batas belum diisi";
  const x = Math.round(hasil * 1e10) / 1e10;
  const [l, a, t] = [limit, appetite, tolerance] as number[];
  if ((arah ?? "").includes("rendah makin buruk")) return x >= l ? "Hijau" : x > a ? "Kuning" : x > t ? "Oranye" : "Merah";
  return x < l ? "Hijau" : x < a ? "Kuning" : x < t ? "Oranye" : "Merah";
}

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
    aksi: "Masih dalam Limit: Hijau, cukup pemantauan rutin. Melewati Limit: minimal Kuning.",
  },
  Appetite: {
    isi: "Batas risiko yang bersedia diambil perusahaan untuk mencapai sasarannya.",
    aksi: "Melewati Limit tetapi masih dalam Appetite: Kuning, perlu tindakan perbaikan.",
  },
  Tolerance: {
    isi: "Batas maksimal penyimpangan yang masih dapat ditanggung perusahaan.",
    aksi: "Melewati Appetite tetapi masih dalam Tolerance: Oranye, eskalasi kepada PT DAM. Melampaui Tolerance: Merah, eskalasi dan intervensi PT DAM.",
  },
} as const;

/** Arti tiap status pengukuran, ringkas untuk legenda. */
export const ARTI_STATUS: Record<string, string> = {
  Hijau: "Dalam limit",
  Kuning: "Melewati limit, masih dalam appetite",
  Oranye: "Melewati appetite, masih dalam toleransi",
  Merah: "Melewati batas toleransi",
  "Data belum lengkap": "Hasil atau batas belum diisi",
};

/** Narasi status untuk pembaca awam: apa arti warnanya dan apa yang perlu dilakukan. */
export const NARASI_STATUS: Record<string, string> = {
  Hijau: "Aman. Kinerja masih dalam batas normal yang ditetapkan.",
  Kuning: "Waspada. Mulai keluar dari batas normal, tetapi masih dapat diterima perusahaan. Perlu dipantau dan dikendalikan.",
  Oranye: "Berisiko tinggi. Sudah melewati batas yang dapat diterima perusahaan, tetapi belum melewati batas toleransi. Perlu tindakan pengendalian.",
  Merah: "Kritis. Sudah melewati batas toleransi maksimal perusahaan. Perlu tindakan pemulihan segera.",
  "Data belum lengkap": "Status belum dapat ditentukan karena hasil pengukuran atau batasnya belum diisi.",
  "Batas belum diisi": "Status belum dapat ditentukan karena limit, appetite, atau tolerance belum diisi.",
};

/** Kalimat penjelas kenapa sebuah parameter berstatus Kuning/Oranye/Merah, dibandingkan langsung dengan batas yang dilewati. */
export function alasanStatus(status: string, hasil: unknown, limit: unknown, appetite: unknown, tolerance: unknown, satuan?: string | null) {
  if (![hasil, limit, appetite, tolerance].every((v) => typeof v === "number")) return null;
  const x = hasil as number;
  const [h, l, a, t] = [hasil, limit, appetite, tolerance].map((v) => nilaiParam(v, satuan));
  if (status === "Merah") return x >= (tolerance as number) ? `Hasil ${h} ≥ toleransi ${t}` : `Hasil ${h} ≤ toleransi ${t}`;
  if (status === "Oranye") return x >= (appetite as number) ? `Hasil ${h} melewati appetite ${a}, belum mencapai toleransi ${t}` : `Hasil ${h} di bawah appetite ${a}, masih di atas toleransi ${t}`;
  if (status === "Kuning") return x >= (limit as number) ? `Hasil ${h} melewati limit ${l}, masih dalam appetite ${a}` : `Hasil ${h} di bawah limit ${l}, masih di atas appetite ${a}`;
  return null;
}

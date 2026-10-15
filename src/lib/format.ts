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

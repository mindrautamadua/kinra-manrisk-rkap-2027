import { colName, expandRange, formatCell, isInputCell, parseAddr } from "./engine";
import { persen, polaritas } from "./format";
import { arahParameter, type RekapRef } from "./static";
import { ATURAN_KHUSUS, ada, num, type Get, type SevKewajaran, type TemuanKewajaran } from "./kewajaran-aturan";
import type { CellValue, SheetTemplate } from "./types";

/**
 * Uji kewajaran isian lembar parameter: aturan logika tetap (bukan AI) yang menandai isian
 * yang secara hitungan mungkin benar tetapi secara makna tidak masuk akal.
 * Aturan khusus per lembar ada di kewajaran-aturan.ts; berkas ini berisi aturan umum dan jejak hitungan.
 */
export { ATURAN_KHUSUS, type SevKewajaran, type TemuanKewajaran };

/** Aturan khusus lembar saja. */
export const cekKhusus = (code: string, get: Get) => ATURAN_KHUSUS[code]?.(get) ?? [];

// ---------- aturan umum (semua lembar) ----------

const isAngkaFmt = (nf?: string) => !!nf && /[0#]/.test(nf.replace(/"[^"]*"/g, ""));
const isPersenFmt = (nf?: string) => !!nf && nf.replace(/"[^"]*"/g, "").includes("%");
const daftar = (a: string[], n = 8) => `${a.slice(0, n).join(", ")}${a.length > n ? `, dan ${a.length - n} lainnya` : ""}`;

/**
 * Aturan yang berlaku untuk semua lembar: galat rumus, teks di sel angka, persen di atas 100%,
 * skala rupiah yang tidak sesuai judul kolom, isian "pembagi nol" yang bertentangan, dan urutan batas.
 */
/** `sudah`: sel yang sudah dilaporkan aturan khusus, tidak dilaporkan ulang oleh aturan per sel. */
export function cekUmum(t: SheetTemplate, get: Get, meta?: RekapRef, sudah = new Set<string>()): TemuanKewajaran[] {
  const out: TemuanKewajaran[] = [];
  const strip: string[] = [], teks: string[] = [], galat: string[] = [], persen100: string[] = [], juta: string[] = [], penuh: string[] = [];
  // Sel isian batas boleh di atas 100% bila parameternya rasio yang dinyatakan dalam persen (mis. 6a IRR ÷ hurdle rate = 120%).
  const selBatas = new Set(meta ? [meta.ref_limit, meta.ref_appetite, meta.ref_tolerance].flatMap((r) => (r ? [r, ...referensi(t.cells[r]?.f ?? "").map((x) => x.ref)] : [])) : []);
  for (const [a, c] of Object.entries(t.cells)) {
    const v = get(a);
    if (c.f && typeof v === "string" && /^#[A-Z/0!?]+/.test(v)) galat.push(a);
    if (!isInputCell(c) || c.bg === CONTOH_BG || sudah.has(a)) continue;
    if (isAngkaFmt(c.nf) && typeof v === "string" && v.trim() !== "") (v.trim() === "-" ? strip : teks).push(a);
    const x = num(v);
    if (x == null || x === 0) continue;
    const judul = `${headerKolom(t, get, a)} ${labelBaris(t, get, parseAddr(a).row)}`;
    if (!selBatas.has(a) && (isPersenFmt(c.nf) || /probabilitas|\(%\)|0%-100%/i.test(judul)) && Math.abs(x) > 1) persen100.push(`${a} ${formatCell(x, "0.00%")}`);
    if (/rp juta/i.test(judul) && Math.abs(x) >= 1e8) juta.push(`${a} ${formatCell(x, "#,##0")}`);
    else if (/\(rp\)/i.test(judul) && !/rp juta/i.test(judul) && Math.abs(x) < 1e4) penuh.push(`${a} ${formatCell(x, "#,##0")}`);
  }
  const sel = (a: string[]) => a.map((s) => s.split(" ")[0]);
  if (galat.length) out.push({ id: "u-galat", severity: "kritis", sel: galat, judul: `Rumus menghasilkan galat pada ${galat.length} sel`, detail: `${daftar(galat)}: ${String(get(galat[0]))}. Periksa isian yang dirujuk rumus tersebut.` });
  if (juta.length) out.push({ id: "u-juta", severity: "perhatian", sel: sel(juta), judul: `Nilai pada kolom Rp juta tampak dalam rupiah penuh (${juta.length} sel)`, detail: `${daftar(juta)}. Rp 100 juta juta = Rp 100 triliun; nilai sebesar ini kemungkinan diisi dalam rupiah penuh. Bagi dengan 1.000.000 bila demikian.` });
  if (penuh.length) out.push({ id: "u-penuh", severity: "info", sel: sel(penuh), judul: `Nilai pada kolom Rupiah penuh sangat kecil (${penuh.length} sel)`, detail: `${daftar(penuh)}. Kolom ini diisi rupiah penuh; nilai di bawah Rp 10.000 kemungkinan diisi dalam juta.` });
  if (persen100.length) out.push({ id: "u-persen", severity: "perhatian", sel: sel(persen100), judul: `Nilai persen di atas 100% (${persen100.length} sel)`, detail: `${daftar(persen100)}. Bila maksudnya 25%, ketik 25% atau 0,25; angka 25 dibaca 2.500%.` });
  if (teks.length) out.push({ id: "u-teks", severity: "perhatian", sel: teks, judul: `Teks pada sel angka (${teks.length} sel)`, detail: `${daftar(teks.map((a) => `${a} "${String(get(a)).trim().slice(0, 30)}"`))}. Nilai teks tidak ikut dihitung. Isi dengan angka tanpa tanda pemisah yang salah.` });
  if (strip.length) out.push({ id: "u-strip", severity: "info", sel: strip, judul: `Tanda "-" pada sel angka (${strip.length} sel)`, detail: `${daftar(strip, 10)}. Tanda "-" dibaca sebagai teks, bukan nol. Isi 0 bila nilainya nol, atau kosongkan bila tidak ada data.` });

  if (meta) {
    const hasil = meta.ref_hasil ? get(meta.ref_hasil) : null;
    for (const [a, c] of Object.entries(t.cells)) {
      if (!isInputCell(c) || String(get(a) ?? "").trim() !== "Ya") continue;
      if (/^pembagi bernilai nol/i.test(labelBaris(t, get, parseAddr(a).row)) && typeof hasil === "number")
        out.push({ id: "u-pembagi", severity: "perhatian", sel: [a], judul: "Konfirmasi pembagi nol berisi Ya padahal hasil terhitung", detail: `Hasil pengukuran ${formatCell(hasil, t.cells[meta.ref_hasil!]?.nf)} sudah terhitung. Pilihan Ya hanya untuk hasil Tidak terhitung karena entitas tidak memiliki eksposur; ubah menjadi Tidak atau kosongkan.` });
    }
    const [l, ap, tol] = [meta.ref_limit, meta.ref_appetite, meta.ref_tolerance].map((x) => (x ? num(get(x)) : null));
    if (l != null && ap != null && tol != null) {
      const naik = polaritas(arahParameter(meta.kode)).naik; // makin tinggi makin baik: limit ≥ appetite ≥ tolerance
      const urut = naik ? l >= ap && ap >= tol : l <= ap && ap <= tol;
      if (!urut) out.push({ id: "u-batas", severity: "kritis", sel: [meta.ref_limit!, meta.ref_appetite!, meta.ref_tolerance!], judul: "Urutan limit, appetite, dan tolerance tidak sesuai arah parameter", detail: `Limit ${persenAtau(l, t, meta.ref_limit!)}, appetite ${persenAtau(ap, t, meta.ref_appetite!)}, tolerance ${persenAtau(tol, t, meta.ref_tolerance!)}. Untuk parameter ${naik ? "makin tinggi makin baik, nilai batas harus menurun" : "makin rendah makin baik, nilai batas harus menaik"} dari limit ke tolerance, kalau tidak status tidak dapat ditentukan dengan benar.` });
    }
  }
  return out;
}
const persenAtau = (x: number, t: SheetTemplate, a: string) => formatCell(x, t.cells[a]?.nf) || persen(x, 2);

/** Seluruh uji kewajaran satu lembar (aturan khusus + umum), terurut dari yang paling berat. */
export function periksaLembar(t: SheetTemplate, get: Get, meta?: RekapRef) {
  const khusus = cekKhusus(t.code, get);
  return urutKewajaran([...khusus, ...cekUmum(t, get, meta, new Set(khusus.flatMap((k) => k.sel)))]);
}

export const SEV_KEWAJARAN: SevKewajaran[] = ["kritis", "perhatian", "info"];
export const urutKewajaran = (t: TemuanKewajaran[]) => [...t].sort((a, b) => SEV_KEWAJARAN.indexOf(a.severity) - SEV_KEWAJARAN.indexOf(b.severity));

// ---------- jejak hitungan hasil ----------

export interface Langkah { addr: string; label: string; nilai: string; rumus?: string; anak: Langkah[]; ringkas?: string }

const REF_RE = /(?<![A-Za-z!$])\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?(?![\d(A-Za-z])/g;

function referensi(f: string) {
  const bersih = f.replace(/"[^"]*"/g, "").replace(/[A-Za-z]+!\$?[A-Z]+\$?\d+/g, "");
  const out: { ref: string; range: boolean }[] = [];
  for (const m of bersih.matchAll(REF_RE)) {
    const ref = m[3] ? `${m[1]}${m[2]}:${m[3]}${m[4]}` : `${m[1]}${m[2]}`;
    if (!out.some((x) => x.ref === ref)) out.push({ ref, range: !!m[3] });
  }
  return out;
}

/** Baris contoh berwarna abu-abu tidak dipakai sebagai judul kolom. */
const CONTOH_BG = "F2F2F2";
const teksLabel = (v: CellValue) => (typeof v === "string" && v.trim() && !/^#/.test(v) ? v.trim().replace(/\s+/g, " ") : "");

function labelBaris(t: SheetTemplate, get: Get, row: number) {
  for (let c = 2; c <= 6; c++) { const s = teksLabel(get(colName(c) + row)); if (s) return s; }
  return "";
}
function headerKolom(t: SheetTemplate, get: Get, addr: string) {
  const { col, row } = parseAddr(addr);
  for (let r = row - 1; r >= Math.max(1, row - 30); r--) {
    const a = colName(col) + r, c = t.cells[a];
    if (c && !c.f && !isInputCell(c) && c.bg !== CONTOH_BG) { const s = teksLabel(get(a)); if (s) return s; }
  }
  return "";
}

/** Uraian langkah perhitungan sel hasil sampai dua tingkat rujukan, tanpa sel batas (limit/appetite/tolerance). */
export function jejakHitungan(t: SheetTemplate, get: Get, hasil: string, abaikan: string[], kedalaman = 2): Langkah {
  const skip = new Set(abaikan);
  const fmt = (a: string) => formatCell(get(a), t.cells[a]?.nf) || "(kosong)";
  const node = (a: string, d: number, label?: string): Langkah => {
    const c = t.cells[a];
    const lbl = label ?? (labelBaris(t, get, parseAddr(a).row) || headerKolom(t, get, a) || a);
    const n: Langkah = { addr: a, label: lbl, nilai: fmt(a), rumus: c?.f, anak: [] };
    if (!c?.f || d <= 0) return n;
    for (const { ref, range } of referensi(c.f)) {
      if (skip.has(ref)) continue;
      if (!range) { n.anak.push(node(ref, d - 1)); continue; }
      const sel = expandRange(ref).filter((x) => ada(get(x)));
      const angka = sel.filter((x) => num(get(x)) != null);
      const tampil = angka.length ? angka : sel; // rentang teks (mis. kriteria COUNTIFS) tetap ditampilkan isinya
      const anak = tampil.slice(0, 20).map((x) => {
        const br = labelBaris(t, get, parseAddr(x).row), hk = headerKolom(t, get, x);
        return { addr: x, label: [br, hk].filter(Boolean).join(" · ") || x, nilai: fmt(x), anak: [] } as Langkah;
      });
      n.anak.push({
        addr: ref, label: `Rentang ${ref}`, nilai: angka.length ? `${angka.length} nilai angka` : `${sel.length} sel teks`, anak,
        ringkas: tampil.length > 20 ? `${tampil.length - 20} sel lain tidak ditampilkan` : angka.length && sel.length > angka.length ? `${sel.length - angka.length} sel teks pada rentang ini tidak ditampilkan` : undefined,
      });
    }
    return n;
  };
  return node(hasil, kedalaman, "Hasil pengukuran RKAP 2027");
}

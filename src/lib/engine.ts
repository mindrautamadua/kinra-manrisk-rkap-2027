"use client";
import { HyperFormula, type CellValue as HfValue } from "hyperformula";
import type { CellValue, ParamSummary, SheetTemplate, TemplateCell } from "./types";
import { REKAP } from "./static";
import { statusBiner } from "./format";
export { REKAP, type RekapRef } from "./static";

/** Sel isian entitas pada kertas kerja berwarna kuning (FFFFCC). */
export const INPUT_BG = "FFFFCC";
export const isInputCell = (c?: TemplateCell) => !!c && c.bg === INPUT_BG && !c.f;


// ---------- alamat sel ----------
export const colNum = (s: string) => s.split("").reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
export const colName = (n: number) => {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
export const parseAddr = (a: string) => {
  const m = a.match(/^([A-Z]+)(\d+)$/)!;
  return { col: colNum(m[1]), row: +m[2] };
};
export function expandRange(ref: string): string[] {
  const out: string[] = [];
  for (const part of ref.split(/\s+/)) {
    const [a, b = a] = part.split(":");
    const p = parseAddr(a), q = parseAddr(b);
    for (let r = p.row; r <= q.row; r++) for (let c = p.col; c <= q.col; c++) out.push(colName(c) + r);
  }
  return out;
}

// ---------- template ----------
const cache = new Map<string, Promise<SheetTemplate>>();
export function loadTemplate(code: string): Promise<SheetTemplate> {
  if (!cache.has(code)) cache.set(code, fetch(`/templates/${encodeURIComponent(code)}.json`).then((r) => r.json()));
  return cache.get(code)!;
}
export const loadAllTemplates = () => Promise.all(REKAP.map((r) => loadTemplate(r.kode)));

// ---------- workbook (HyperFormula) ----------
export class Workbook {
  hf: HyperFormula;
  private ids = new Map<string, number>();

  constructor(templates: SheetTemplate[], inputs: Record<string, Record<string, CellValue>>, namaEntitas = "PT KINRA") {
    this.hf = HyperFormula.buildEmpty({ licenseKey: "gpl-v3", useArrayArithmetic: true, precisionRounding: 14 });
    const sampul = this.hf.getSheetId(this.hf.addSheet("Sampul"))!;
    this.hf.setCellContents({ sheet: sampul, row: 9, col: 4 }, namaEntitas);
    for (const t of templates) this.ids.set(t.code, this.hf.getSheetId(this.hf.addSheet(t.code))!);
    this.hf.suspendEvaluation();
    for (const t of templates) {
      const sheet = this.ids.get(t.code)!;
      const inp = inputs[t.code] ?? {};
      const rows = Array.from({ length: t.maxRow }, () => Array<HfValue | string | null>(t.maxCol).fill(null));
      for (const [a, c] of Object.entries(t.cells)) {
        const { row, col } = parseAddr(a);
        let v: CellValue | undefined = c.f ?? c.v ?? null;
        if (isInputCell(c) && a in inp) v = inp[a];
        // Tanggal yang tersimpan sebagai teks (diketik sebelum format nama bulan dikenali) dibaca ulang sebagai tanggal agar rumus durasi tidak #VALUE!.
        if (isInputCell(c) && typeof v === "string" && isDateFmt(c.nf)) v = parseInput(v, c.nf);
        // Angka yang tersimpan sebagai teks (mis. ditempel dengan pemisah ribuan) dibaca ulang agar ikut terhitung.
        else if (isInputCell(c) && typeof v === "string" && /^[\s\d.,()%Rp-]+$/i.test(v)) { const n = parseInput(v, c.nf); if (typeof n === "number") v = n; }
        rows[row - 1][col - 1] = v as HfValue;
      }
      this.hf.setSheetContent(sheet, rows as (string | number | boolean | null)[][]);
    }
    this.hf.resumeEvaluation();
  }

  get(code: string, addr: string): CellValue {
    const sheet = this.ids.get(code);
    if (sheet == null) return null;
    const { row, col } = parseAddr(addr);
    const v = this.hf.getCellValue({ sheet, row: row - 1, col: col - 1 });
    if (v && typeof v === "object") return (v as { value: string }).value; // error #REF!, #DIV/0!, ...
    return v as CellValue;
  }

  set(code: string, addr: string, value: CellValue) {
    const sheet = this.ids.get(code)!;
    const { row, col } = parseAddr(addr);
    this.hf.setCellContents({ sheet, row: row - 1, col: col - 1 }, [[value as string | number | boolean | null]]);
  }

  summary(code: string): ParamSummary {
    const r = REKAP.find((x) => x.kode === code);
    if (!r) return {};
    const g = (a: string | null) => (a ? this.get(code, a) : null);
    return { limit: g(r.ref_limit) as number, appetite: g(r.ref_appetite) as number, tolerance: g(r.ref_tolerance) as number, hasil: g(r.ref_hasil) as number | string | null, status: statusBiner(g(r.ref_status) as string) };
  }

  destroy() { this.hf.destroy(); }
}

// ---------- konversi isian pengguna ----------
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
export const serialToDate = (n: number) => new Date(EXCEL_EPOCH + Math.round(n * 86400000));
export const dateToSerial = (d: Date) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EXCEL_EPOCH) / 86400000);

const NAMA_BULAN = [
  ["jan", "januari", "january"], ["feb", "februari", "february"], ["mar", "maret", "march"], ["apr", "april"], ["mei", "may"], ["jun", "juni", "june"],
  ["jul", "juli", "july"], ["agu", "ags", "agt", "agustus", "aug", "august"], ["sep", "sept", "september"], ["okt", "oktober", "oct", "october"],
  ["nov", "november", "nop", "nopember"], ["des", "desember", "dec", "december"],
];
const bulanKe = (s: string) => NAMA_BULAN.findIndex((n) => n.includes(s.toLowerCase()));

const isDateFmt = (nf?: string) => !!nf && /(^|[^"])(d{1,4}|y{2,4})/i.test(nf.replace(/"[^"]*"/g, "")) && !/0/.test(nf);

/** Ubah teks ketikan pengguna menjadi nilai sel (angka/tanggal/teks). */
export function parseInput(raw: string, nf?: string): CellValue {
  const s = raw.trim();
  if (s === "") return null;
  if (isDateFmt(nf)) {
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) || s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) {
      const [y, mo, d] = m[1].length === 4 ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
      return dateToSerial(new Date(y, mo - 1, d));
    }
    // Nama bulan Indonesia/Inggris, lengkap atau singkat: "2 Jan 2027", "31 Ags 2027", "15 Desember 2027".
    const b = s.match(/^(\d{1,2})[\s/.-]+([a-z]+)\.?[\s/.-]+(\d{4})$/i);
    const mo = b ? bulanKe(b[2]) : -1;
    if (b && mo >= 0) return dateToSerial(new Date(+b[3], mo, +b[1]));
  }
  let t = s.replace(/\s|Rp/gi, "");
  const pct = t.endsWith("%");
  if (pct) t = t.slice(0, -1);
  if (/^\(?-?[\d.,]+\)?$/.test(t)) {
    const neg = t.startsWith("(") || t.startsWith("-");
    t = t.replace(/[()-]/g, "");
    // Format Indonesia: titik ribuan, koma desimal. Tanpa koma & satu titik -> titik dianggap desimal.
    // Lebih dari satu koma tanpa titik ("51,230,128,320") berarti koma dipakai sebagai pemisah ribuan gaya Inggris.
    if ((t.match(/,/g) || []).length > 1 && !t.includes(".")) t = t.replace(/,/g, "");
    else if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
    let n = Number(t);
    if (isNaN(n)) return s;
    if (neg) n = -n;
    if (pct) n = n / 100;
    return n;
  }
  return s;
}

// ---------- tampilan nilai sesuai number format Excel ----------
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export function formatCell(v: CellValue, nf?: string): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v !== "number") return String(v);
  if (!nf || nf === "General" || nf === "@") {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e6) / 1e6).replace(".", ",");
  }
  const section = (() => {
    const parts = nf.split(";");
    if (v < 0 && parts[1]) return { f: parts[1], abs: true };
    if (v === 0 && parts[2]) return { f: parts[2], abs: true };
    return { f: parts[0], abs: false };
  })();
  const f = section.f;
  const lit = f.match(/^"([^"]*)"$/);
  if (lit) return lit[1];
  if (isDateFmt(f)) {
    const d = serialToDate(v);
    const dd = d.getUTCDate(), mm = d.getUTCMonth(), yy = d.getUTCFullYear();
    if (/mmm/i.test(f)) return `${dd} ${BULAN[mm]} ${yy}`;
    return `${String(dd).padStart(2, "0")}/${String(mm + 1).padStart(2, "0")}/${yy}`;
  }
  const val = section.abs ? Math.abs(v) : v;
  const pct = f.includes("%");
  const decM = f.replace(/"[^"]*"/g, "").match(/0\.(0+)/);
  const dec = decM ? decM[1].length : 0;
  const grouped = f.includes("#,##") || f.includes(",0");
  const x = pct ? val * 100 : val;
  const body = new Intl.NumberFormat("id-ID", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grouped }).format(x);
  const prefix = (f.match(/^"([^"]*)"/) || [])[1] ?? "";
  const suffix = (f.match(/"([^"]*)"$/) || [])[1] ?? "";
  let out = `${prefix}${body}${pct ? "%" : ""}${suffix}`;
  if (section.abs && f.includes("(")) out = `(${out})`;
  else if (section.abs && v < 0) out = `-${out}`;
  return out;
}

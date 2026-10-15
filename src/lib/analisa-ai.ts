import { colName, formatCell, isInputCell } from "./engine";
import type { Langkah, TemuanKewajaran } from "./kewajaran";
import type { RekapRef } from "./static";
import type { CellValue, SheetTemplate } from "./types";

/** Data satu lembar parameter yang dikirim ke /api/analisa-parameter. */
export interface AnalisaRequest {
  entitas: string;
  kode: string; parameter: string; kategori: string; satuan: string; arah: string;
  identitas: string; isi: string; jejak: string;
  batas: { limit: string; appetite: string; tolerance: string };
  hasil: string; status: string;
  temuanAturan: { severity: string; judul: string; detail?: string; sel: string[] }[];
}
export type PenilaianAi = "Wajar" | "Perlu klarifikasi" | "Tidak wajar";
export interface TemuanAnalisa { severity: "kritis" | "perhatian" | "info"; judul: string; penjelasan: string; sel: string[]; saran: string }
export interface HasilAnalisa {
  penilaian: PenilaianAi; ringkasan: string; cara_hitung: string; temuan: TemuanAnalisa[];
  dampak_status: string; pertanyaan_reviewer: string[];
  model: string; waktu: string; sidik: string;
}

const MAKS_ISI = 30_000;
const potong = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s);
const bersih = (s: string) => s.replace(/\s+/g, " ").trim();

/** Sidik isian lembar untuk menandai hasil analisa yang sudah usang. */
export function sidikIsian(inputs: Record<string, CellValue>) {
  const s = JSON.stringify(Object.entries(inputs).filter(([, v]) => v != null && v !== "").sort(([a], [b]) => a.localeCompare(b)));
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Ringkas lembar menjadi teks padat untuk model: baris judul tabel ditulis sekali (HEADER),
 * baris data hanya memuat sel yang berisi, baris contoh dan bagian historis (F) dilewati.
 */
export function ringkasLembar(t: SheetTemplate, get: (a: string) => CellValue) {
  const sec = (h: string) => { for (let r = 1; r <= t.maxRow; r++) if (t.cells[`A${r}`]?.v === h) return r; return 0; };
  const fmt = (a: string) => {
    const v = get(a), nf = t.cells[a]?.nf;
    if (v === 0) return "0"; // format Excel menampilkan nol sebagai "-", mudah tertukar dengan isian teks "-"
    if (typeof v === "string" && isInputCell(t.cells[a]) && nf && /[0#]/.test(nf)) return v.trim() ? `"${bersih(v)}" (teks)` : "";
    return bersih(formatCell(v, nf));
  };
  const identitas: string[] = [];
  for (let r = 7; r < (sec("B") || 16); r++) {
    const k = fmt(`B${r}`), v = fmt(`E${r}`);
    if (k && v) identitas.push(`${k}: ${potong(v, 600)}`);
  }
  const dari = sec("C") || 25, sampai = (sec("F") || t.maxRow + 1) - 1;
  const baris: string[] = [];
  for (let r = dari; r <= sampai; r++) {
    if (String(t.cells[`B${r}`]?.v ?? "") === "Contoh") continue;
    const sel: string[] = [];
    let judul = true, isian = false;
    for (let c = 1; c <= t.maxCol; c++) {
      const a = colName(c) + r, cell = t.cells[a];
      if (!cell) continue;
      const v = fmt(a);
      if (!v) continue;
      if (cell.f || isInputCell(cell)) judul = false;
      if (isInputCell(cell)) isian = true;
      if (c === 2 && /^\d+$/.test(v)) continue; // nomor urut
      sel.push(`${a}=${potong(v)}`);
    }
    if (!sel.length) continue;
    baris.push(`${judul ? "JUDUL " : isian ? "" : "RUMUS "}r${r}: ${sel.join(" | ")}`);
  }
  let isi = baris.join("\n");
  if (isi.length > MAKS_ISI) isi = `${isi.slice(0, MAKS_ISI)}\n[... dipotong]`;
  return { identitas: identitas.join("\n"), isi };
}

export function teksJejak(n: Langkah, d = 0): string {
  const self = `${"  ".repeat(d)}${n.addr} ${n.label} = ${n.nilai}${n.rumus ? `  [${n.rumus}]` : ""}`;
  return [self, ...n.anak.map((a) => teksJejak(a, d + 1)), ...(n.ringkas ? [`${"  ".repeat(d + 1)}(${n.ringkas})`] : [])].join("\n");
}

export function buildAnalisaRequest(o: {
  t: SheetTemplate; get: (a: string) => CellValue; meta: RekapRef; entitas: string; arah: string;
  jejak: Langkah | null; temuan: TemuanKewajaran[];
}): AnalisaRequest {
  const { t, get, meta } = o;
  const fmt = (a: string | null) => (a ? formatCell(get(a), t.cells[a]?.nf) || "(kosong)" : "(tidak ada)");
  const { identitas, isi } = ringkasLembar(t, get);
  return {
    entitas: o.entitas, kode: meta.kode, parameter: meta.parameter, kategori: meta.kategori, satuan: meta.satuan, arah: o.arah,
    identitas, isi, jejak: o.jejak ? teksJejak(o.jejak) : "",
    batas: { limit: fmt(meta.ref_limit), appetite: fmt(meta.ref_appetite), tolerance: fmt(meta.ref_tolerance) },
    hasil: fmt(meta.ref_hasil), status: fmt(meta.ref_status),
    temuanAturan: o.temuan.map(({ severity, judul, detail, sel }) => ({ severity, judul, detail, sel: [...new Set(sel)].slice(0, 20) })),
  };
}

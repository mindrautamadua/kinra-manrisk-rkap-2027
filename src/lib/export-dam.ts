"use client";
import type ExcelJSNs from "exceljs";
import { addParam, newWorkbook, save, type SemuaData } from "./export";
import { hitungStatus, isTopRisk } from "./format";
import { labelPos } from "./keterkaitan-rkap";
import { buildRam, type RamRow } from "./ram";
import type { CatAksi, KategoriRisiko, MitigasiAksi, RiskRegister, SheetTemplate, TemplateCell } from "./types";

/**
 * Ekspor "Format DAM": workbook mengikuti DAM_Template_Perencanaan Manajemen Risiko RKAP 2027 PTPN Group.
 * Tata letak tiap lembar diambil dari public/templates/dam/*.json (hasil scripts/extract_dam.py);
 * lembar isian (RAS, RAM, Risk Register, Risk Driver, Kriteria Dampak, CAT) diisi data aplikasi
 * dengan gaya baris contoh template. Lembar data parameter memakai lembar 1a–U10 aplikasi.
 */

type Wb = ExcelJSNs.Workbook;
type Ws = ExcelJSNs.Worksheet;
type DamCell = TemplateCell & { va?: string; fn?: string };
interface DamSheet extends Omit<SheetTemplate, "cells"> {
  cells: Record<string, DamCell>; heights: Record<string, number>; tab: string | null; grid: boolean | null; base: DamCell | null;
}

const DIR = "/templates/dam";
const loadDam = (slug: string): Promise<DamSheet> =>
  fetch(`${DIR}/${slug}.json`).then((r) => { if (!r.ok) throw new Error(`Template DAM "${slug}" tidak ditemukan`); return r.json(); });
const loadImg = (nama: string) => fetch(`${DIR}/${nama}`).then((r) => r.arrayBuffer());

const RP = "#,##0";
const thin = { style: "thin" as const };
const addr = (row: number, col: number) => `${colName(col)}${row}`;
function colName(c: number) { let s = ""; for (; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; }
function parse(a: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(a)!;
  return { row: Number(m[2]), col: [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) };
}

// ---------- gaya & salin dari template ----------
function gaya(cell: ExcelJSNs.Cell, c: DamCell | null | undefined) {
  if (!c) return;
  if (c.bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${c.bg}` } };
  cell.font = { name: c.fn ?? "Arial", size: c.sz ?? 9, bold: !!c.b, italic: !!c.i, ...(c.fc ? { color: { argb: `FF${c.fc}` } } : {}) };
  cell.alignment = { wrapText: !!c.w, vertical: (c.va ?? "top") as "top", ...(c.ha ? { horizontal: c.ha as "left" } : {}) };
  if (c.nf) cell.numFmt = c.nf;
  if (c.bd) cell.border = { top: thin, left: thin, bottom: thin, right: thin };
}

function lembar(wb: Wb, t: DamSheet, ySplit?: number, nama = t.title) {
  const ws = wb.addWorksheet(nama, {
    properties: t.tab ? { tabColor: { argb: `FF${t.tab}` } } : {},
    views: [{ showGridLines: t.grid !== false, ...(ySplit ? { state: "frozen" as const, ySplit } : {}) }],
  });
  for (const [c, w] of Object.entries(t.widths)) ws.getColumn(c).width = w;
  return ws;
}

/** Salin baris template [dari, sampai] apa adanya (nilai, gaya, merge, tinggi). */
function salin(ws: Ws, t: DamSheet, ganti: (v: unknown) => unknown, dari = 1, sampai = t.maxRow) {
  if (t.base) for (let r = dari; r <= sampai; r++) for (let c = 1; c <= t.maxCol; c++) gaya(ws.getCell(r, c), t.base);
  for (const [a, c] of Object.entries(t.cells)) {
    const { row } = parse(a);
    if (row < dari || row > sampai) continue;
    const cell = ws.getCell(a);
    gaya(cell, c);
    if (c.f) cell.value = { formula: c.f.replace(/^=/, "") } as never;
    else if (c.v != null) cell.value = ganti(c.v) as never;
  }
  for (const m of t.merges) {
    const [p, q] = m.split(":").map(parse);
    if (p.row >= dari && q.row <= sampai) { try { ws.mergeCells(m); } catch { /* tumpang tindih diabaikan */ } }
  }
  for (const [r, h] of Object.entries(t.heights)) if (Number(r) >= dari && Number(r) <= sampai) ws.getRow(Number(r)).height = h;
}

/** Gaya satu baris contoh template dipakai untuk baris data. */
function gayaBaris(ws: Ws, t: DamSheet, src: number, dst: number, sampaiKolom = t.maxCol) {
  for (let c = 1; c <= sampaiKolom; c++) gaya(ws.getCell(dst, c), t.cells[addr(src, c)] ?? t.base);
}

function isi(ws: Ws, row: number, col: number, v: unknown, fmt?: string) {
  const cell = ws.getCell(row, col);
  cell.value = (v === undefined || v === "" ? null : v) as never;
  if (fmt) cell.numFmt = fmt;
  return cell;
}

/** Tinggi baris kira-kira dari panjang teks terpanjang terhadap lebar kolomnya. */
function pasTinggi(ws: Ws, row: number, min = 12) {
  let baris = 1;
  ws.getRow(row).eachCell((cell, col) => {
    const v = cell.value;
    if (v == null || typeof v === "object") return;
    const per = Math.max(1, Math.floor((ws.getColumn(col).width ?? 9) * 1.15));
    baris = Math.max(baris, String(v).split("\n").reduce((s, l) => s + Math.max(1, Math.ceil(l.length / per)), 0));
  });
  ws.getRow(row).height = Math.max(min, Math.min(409, baris * 11.5 + 3));
}

function merge(ws: Ws, r1: number, c1: number, r2: number, c2: number) {
  if (r2 > r1 || c2 > c1) { try { ws.mergeCells(r1, c1, r2, c2); } catch { /* sudah tergabung */ } }
}

// ---------- pemetaan kategori ----------
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");
/** Cocokkan label kategori template (Inggris atau "Risiko X (X Risk)") dengan kategori aplikasi. */
function cocokKategori(label: unknown, kategori: KategoriRisiko[]) {
  const l = norm(label);
  return kategori.find((k) => {
    const en = /\(([^)]+)\)\s*$/.exec(k.nama_en ?? "")?.[1];
    return l === norm(en) || l === norm(k.nama_en) || l.startsWith(norm(k.nama));
  })?.nama ?? null;
}

/** Baris kategori template: kolom nomor berisi angka. */
function blokKategori(t: DamSheet, kolNo: string, kolNama: string, dari: number, sampai = t.maxRow) {
  const out: { row: number; no: unknown; label: unknown }[] = [];
  for (let r = dari; r <= sampai; r++) {
    const v = t.cells[`${kolNo}${r}`]?.v;
    if (v != null && /^\d+$/.test(String(v).trim())) out.push({ row: r, no: v, label: t.cells[`${kolNama}${r}`]?.v });
  }
  return out;
}

const fmtNilai = (satuan: string) => (satuan === "%" ? "0.00%" : satuan === "kali" ? '0.00"x"' : "#,##0.00");
const STATUS_GAYA: Record<string, DamCell> = {
  Hijau: { bg: "C6EFCE", fc: "006100", b: 1 }, Merah: { bg: "FFC7CE", fc: "9C0006", b: 1 },
};
function warnaStatus(cell: ExcelJSNs.Cell, status: string) {
  const g = STATUS_GAYA[status];
  if (!g) return;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${g.bg}` } };
  cell.font = { ...cell.font, bold: true, color: { argb: `FF${g.fc}` } };
}

// ---------- lembar sampul ----------
const DISCLAIMER = [
  "Template ini disusun oleh Tim MD Risk (“MDR”) khusus untuk PT Danantara Asset Management (“DAM”) terkait RKAP 2027.",
  "Data/informasi digunakan untuk keperluan penyusunan RKAP 2027. Kerahasiaan data sebagaimana ketentuan information security yang berlaku di DAM.",
  "Template ini bersifat dinamis dan iteratif. Perubahan atas substansi template sangat dimungkinkan berdasarkan pembahasan RKAP 2027 saat sesi one-on-one meeting atau pada rapat-rapat selanjutnya.",
].join("\n\n");

function sampul(wb: Wb, t: DamSheet, ganti: (v: unknown) => unknown, logo: number, nama?: string) {
  const ws = lembar(wb, t, undefined, nama);
  salin(ws, t, ganti);
  ws.addImage(logo, { tl: { col: 1.05, row: 1.1 }, ext: { width: 200, height: 48 } });
  return ws;
}

// ---------- Risk.RAS ----------
function lembarRas(wb: Wb, t: DamSheet, d: SemuaData, ganti: (v: unknown) => unknown) {
  const ws = lembar(wb, t, 4);
  salin(ws, t, ganti, 1, 4);
  const blok = blokKategori(t, "B", "C", 5);
  let out = 5;
  blok.forEach((b, i) => {
    const akhir = (blok[i + 1]?.row ?? t.maxRow + 1) - 1;
    for (let c = 2; c <= 10; c++) { const src = t.cells[addr(b.row, c)]; const cell = ws.getCell(out, c); gaya(cell, src); cell.value = (src?.v != null ? ganti(src.v) : null) as never; }
    // Nama kategori kolom entitas mengikuti kolom PTPN III (template baris 22 kosong).
    ws.getCell(out, 8).value = (t.cells[addr(b.row, 5)]?.v ?? null) as never;
    ws.getRow(out).height = t.heights[b.row] ?? 12;
    const katApp = cocokKategori(b.label, d.kategori);
    const slot = Array.from({ length: akhir - b.row }, (_, k) => b.row + 1 + k);
    const app = d.ras.filter((r) => r.kategori === katApp);
    const pakai = new Map<number, (typeof app)[number]>();
    for (const r of app) {
      const s = slot.find((x) => !pakai.has(x) && norm(t.cells[addr(x, 6)]?.v) === norm(r.sikap_induk)) ?? slot.find((x) => !pakai.has(x));
      if (s != null) pakai.set(s, r); else { slot.push(-1 - slot.length); pakai.set(slot.at(-1)!, r); }
    }
    const mulai = out + 1;
    for (const s of slot) {
      out++;
      const contoh = s > 0 ? s : b.row + 1;
      for (let c = 2; c <= 10; c++) {
        const src = t.cells[addr(contoh, c)];
        const cell = ws.getCell(out, c);
        gaya(cell, src ?? t.cells[addr(b.row + 1, c)]);
        cell.value = (s > 0 && c <= 7 && src?.v != null ? ganti(src.v) : null) as never;
      }
      const r = pakai.get(s);
      if (r) { isi(ws, out, 8, r.pernyataan); isi(ws, out, 9, r.sikap); isi(ws, out, 10, r.rasionalisasi); }
      for (let c = 8; c <= 10; c++) { const cell = ws.getCell(out, c); cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top", horizontal: c === 9 ? "center" : "left" }; }
      pasTinggi(ws, out, 24);
    }
    if (out > mulai) for (const c of [2, 3, 4]) merge(ws, mulai, c, out, c);
    out++;
  });
  if (d.rasTambahan.length) {
    const kat = blok[0].row;
    for (let c = 2; c <= 10; c++) gaya(ws.getCell(out, c), t.cells[addr(kat, c)]);
    isi(ws, out, 2, blok.length + 1); isi(ws, out, 8, "RAS Tambahan Entitas");
    out++;
    for (const r of d.rasTambahan) {
      gayaBaris(ws, t, kat + 1, out, 10);
      const en = d.kategori.find((k) => k.nama === r.kategori)?.nama_en ?? r.kategori;
      isi(ws, out, 8, `${en ? `[${en}] ` : ""}${r.pernyataan ?? ""}`); isi(ws, out, 9, r.sikap); isi(ws, out, 10, r.rasionalisasi);
      pasTinggi(ws, out, 24);
      out++;
    }
  }
}

// ---------- Risk.RAM-form isian ----------
function lembarRam(wb: Wb, t: DamSheet, rows: RamRow[], d: SemuaData, ganti: (v: unknown) => unknown) {
  const ws = lembar(wb, t, 6);
  salin(ws, t, ganti, 1, 6);
  const blok = blokKategori(t, "B", "C", 7);
  let out = 7;
  for (const b of blok) {
    gayaBaris(ws, t, b.row, out);
    isi(ws, out, 2, b.no); isi(ws, out, 3, b.label);
    ws.getRow(out).height = 12;
    out++;
    const kat = cocokKategori(b.label, d.kategori);
    const isiKat = rows.filter((r) => r.kategori === kat);
    const urut = [...isiKat.filter((r) => r.diterapkan), ...isiKat.filter((r) => !r.diterapkan)];
    urut.forEach((r, i) => {
      gayaBaris(ws, t, b.row + 1, out);
      const src = (r.tambahan ?? r.pengendalian ?? {}) as Record<string, unknown>;
      const nf = fmtNilai(r.satuan);
      isi(ws, out, 4, String.fromCharCode(97 + i));
      isi(ws, out, 5, `${r.parameter}${r.kode ? ` (${r.kode})` : ""}`);
      isi(ws, out, 6, r.formula); isi(ws, out, 7, r.satuan); isi(ws, out, 8, r.kategoriParameter);
      [r.limit, r.appetite, r.tolerance].forEach((v, k) => isi(ws, out, 9 + k, v, typeof v === "number" ? nf : undefined));
      isi(ws, out, 12, r.sikap);
      isi(ws, out, 13, r.hasil, typeof r.hasil === "number" ? nf : undefined);
      warnaStatus(isi(ws, out, 14, r.status), r.status);
      if (r.diterapkan) {
        isi(ws, out, 15, src.inisiatif); isi(ws, out, 16, src.kebijakan); isi(ws, out, 17, src.program);
        isi(ws, out, 18, src.anggaran, typeof src.anggaran === "number" ? "#,##0.00" : undefined);
      } else {
        isi(ws, out, 15, `Penjelasan tidak diterapkan: ${r.alasanTidak || "-"}`);
        merge(ws, out, 15, out, 21);
      }
      for (let c = 5; c <= 21; c++) { const cell = ws.getCell(out, c); cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top" }; }
      pasTinggi(ws, out, 12);
      out++;
    });
    if (!urut.length) { gayaBaris(ws, t, b.row + 1, out); isi(ws, out, 5, "Tidak ada parameter pada kategori ini"); out++; }
  }
  return out;
}

// ---------- Risk Register ----------
const KOLOM_TAMBAHAN: { judul: string; lebar: number; nilai: (r: RiskRegister, a: MitigasiAksi[]) => unknown; fmt?: string }[] = [
  { judul: "Rencana Aksi Mitigasi (PIC · Jadwal · Biaya · Output)", lebar: 46, nilai: (_, a) => a.map((x, i) => `${i + 1}. ${x.aksi ?? ""}${x.pic ? ` | PIC: ${x.pic}` : ""}${x.jadwal?.length ? ` | ${x.jadwal.join(", ")}` : ""}${x.biaya ? ` | Rp${x.biaya.toLocaleString("id-ID")}` : ""}${x.output ? ` | Output: ${x.output}` : ""}`).join("\n") },
  { judul: "Dasar Penilaian Probabilitas & Dampak", lebar: 36, nilai: (r) => r.dasar_penilaian },
  { judul: "Kriteria Dampak Acuan", lebar: 28, nilai: (r) => r.kriteria_dampak },
  { judul: "Proses Bisnis", lebar: 24, nilai: (r) => (r.proses_bisnis ?? []).join("; ") },
  { judul: "Pos RKAP 2027 Terdampak", lebar: 26, nilai: (r) => (r.pos_rkap ?? []).map((k) => labelPos(k)).join("; ") },
  { judul: "Program Kerja / Asumsi RKAP 2027", lebar: 32, nilai: (r) => r.program_kerja_rkap },
  { judul: "Target Probabilitas (Residual)", lebar: 12, nilai: (r) => r.target_probabilitas, fmt: "0%" },
  { judul: "Target Nilai Dampak (Residual)", lebar: 16, nilai: (r) => r.target_nilai_dampak, fmt: RP },
  { judul: "Target Kategori Dampak (Residual)", lebar: 14, nilai: (r) => r.target_kategori_dampak },
  { judul: "Target Expected Loss (Residual)", lebar: 16, fmt: RP, nilai: (r) => (r.target_probabilitas != null && r.target_nilai_dampak != null ? Number(r.target_probabilitas) * Number(r.target_nilai_dampak) : null) },
  { judul: "Parameter RAM Terkait", lebar: 14, nilai: (r) => (r.parameter_ram ?? []).join(", ") },
  { judul: "Sasaran Strategis RJPP Terkait", lebar: 14, nilai: (r) => (r.sasaran_strategis ?? []).join(", ") },
];

function lembarRegister(wb: Wb, t: DamSheet, d: SemuaData, ganti: (v: unknown) => unknown) {
  const ws = lembar(wb, t, 5);
  salin(ws, t, ganti, 1, 6);
  // Catatan template: kolom risk register dapat ditambahkan; kolom tambahan memakai gaya kolom terakhir.
  KOLOM_TAMBAHAN.forEach((k, i) => {
    const c = t.maxCol + 1 + i;
    ws.getColumn(c).width = k.lebar;
    gaya(ws.getCell(4, c), t.cells[addr(4, t.maxCol)]); ws.getCell(4, c).value = k.judul;
    ws.getCell(4, c).alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    gaya(ws.getCell(5, c), t.cells[addr(5, t.maxCol)]);
    merge(ws, 4, c, 5, c);
    gaya(ws.getCell(6, c), t.cells[addr(6, t.maxCol)]);
  });
  isi(ws, 6, t.maxCol + 1, "kolom tambahan entitas (sesuai catatan template: kolom risk register dapat ditambahkan)");
  const lebar = t.maxCol + KOLOM_TAMBAHAN.length;
  const aksiDari = (r: RiskRegister) => (d.aksi ?? []).filter((a) => a.risk_id === r.id).sort((a, b) => a.urutan - b.urutan);
  const blok = blokKategori(t, "B", "C", 7);
  const sisa = new Set(d.register.map((r) => r.id));
  let out = 7;
  const tulisBlok = (no: unknown, label: unknown, src: number, risiko: RiskRegister[]) => {
    gayaBaris(ws, t, src, out, lebar);
    isi(ws, out, 2, no); isi(ws, out, 3, label);
    ws.getRow(out).height = 12;
    out++;
    risiko.forEach((r, i) => {
      sisa.delete(r.id);
      gayaBaris(ws, t, src + 1, out, lebar);
      const aksi = aksiDari(r);
      const biaya = aksi.reduce((s, a) => s + (a.biaya ?? 0), 0);
      isi(ws, out, 2, `${no}.${i + 1}`);
      isi(ws, out, 3, r.taksonomi_kode); isi(ws, out, 4, r.risk_driver); isi(ws, out, 5, r.risk_event); isi(ws, out, 6, r.deskripsi);
      isi(ws, out, 7, r.root_cause); isi(ws, out, 8, r.probabilitas, "0%"); isi(ws, out, 9, r.deskripsi_dampak); isi(ws, out, 10, r.nilai_dampak, RP);
      isi(ws, out, 11, r.kategori_dampak); isi(ws, out, 12, r.kategori_dampak ? (isTopRisk(r.kategori_dampak) ? "Yes" : "No") : null);
      isi(ws, out, 13, r.expected_loss, RP); isi(ws, out, 14, r.existing_control);
      isi(ws, out, 15, r.rencana_mitigasi || aksi.map((a, k) => `${k + 1}. ${a.aksi ?? ""}`).join("\n"));
      isi(ws, out, 16, r.kategori_mitigasi); isi(ws, out, 17, biaya ? biaya / 1e9 : null, "#,##0.00");
      KOLOM_TAMBAHAN.forEach((k, j) => isi(ws, out, t.maxCol + 1 + j, k.nilai(r, aksi), k.fmt));
      for (let c = 3; c <= lebar; c++) { const cell = ws.getCell(out, c); cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top" }; }
      pasTinggi(ws, out, 12);
      out++;
    });
  };
  for (const b of blok) {
    const kat = cocokKategori(b.label, d.kategori);
    tulisBlok(b.no, b.label, b.row, d.register.filter((r) => r.kategori === kat));
  }
  const lain = d.register.filter((r) => sisa.has(r.id));
  if (lain.length) tulisBlok(blok.length + 1, "Kategori lain", blok[0].row, lain);
}

// ---------- Risk Driver ----------
function lembarDriver(wb: Wb, t: DamSheet, d: SemuaData, ganti: (v: unknown) => unknown) {
  const ws = lembar(wb, t, 3);
  salin(ws, t, ganti, 1, 3);
  const blok = blokKategori(t, "B", "C", 4);
  let out = 4;
  for (const b of blok) {
    const kat = cocokKategori(b.label, d.kategori);
    const rows = d.drivers.filter((r) => r.kategori === kat);
    const mulai = out;
    (rows.length ? rows : [null]).forEach((r, i) => {
      gayaBaris(ws, t, i === 0 ? b.row : b.row + 1, out);
      if (i === 0) { isi(ws, out, 2, b.no); isi(ws, out, 3, b.label); }
      isi(ws, out, 4, r?.driver); isi(ws, out, 5, [r?.bentuk, r?.tambahan ? "Tambahan entitas" : null].filter(Boolean).join(" · "));
      pasTinggi(ws, out, 11.25);
      out++;
    });
    merge(ws, mulai, 2, out - 1, 2); merge(ws, mulai, 3, out - 1, 3);
  }
}

// ---------- Kriteria Dampak ----------
function lembarKriteria(wb: Wb, t: DamSheet, d: SemuaData, ganti: (v: unknown) => unknown) {
  const ws = lembar(wb, t, 4);
  salin(ws, t, ganti, 1, 4);
  const blok = blokKategori(t, "B", "C", 5);
  let out = 5;
  for (const b of blok) {
    gayaBaris(ws, t, b.row, out);
    isi(ws, out, 2, b.no); isi(ws, out, 3, b.label);
    out++;
    const kat = cocokKategori(b.label, d.kategori);
    for (const k of d.kriteria.filter((r) => r.kategori === kat)) {
      gayaBaris(ws, t, b.row + 1, out);
      isi(ws, out, 3, `${k.kode}.  ${k.kriteria}`); isi(ws, out, 4, k.perhitungan);
      [k.sangat_rendah, k.rendah, k.moderat, k.tinggi, k.sangat_tinggi].forEach((v, i) => isi(ws, out, 5 + i, v));
      pasTinggi(ws, out, 11.25);
      out++;
    }
  }
}

// ---------- Risk.CAT-aksikorporasi ----------
function lembarCat(wb: Wb, t: DamSheet, cat: CatAksi[], ganti: (v: unknown) => unknown) {
  const ws = lembar(wb, t);
  salin(ws, t, ganti, 1, 3);
  if (!cat.length) {
    gaya(ws.getCell(5, 2), t.cells.B5);
    isi(ws, 5, 2, "Tidak terdapat rencana aksi korporasi pada RKAP 2027.");
    return;
  }
  const head = (row: number, judul: string[]) => judul.forEach((j, i) => { gaya(ws.getCell(row, 2 + i), t.cells.B14); isi(ws, row, 2 + i, j); });
  let out = 5;
  cat.forEach((a, i) => {
    gaya(ws.getCell(out, 1), t.cells.A5); gaya(ws.getCell(out, 2), t.cells.B5);
    isi(ws, out, 1, String.fromCharCode(97 + i)); isi(ws, out, 2, `Aksi korporasi ${a.nama || a.jenis || ""}`.trim());
    out += 2;
    head(out, ["No", "Uraian", "Keterangan"]);
    ws.getRow(out).height = 15;
    out++;
    ([["Jenis aksi korporasi", a.jenis], ["Nama aksi korporasi", a.nama], ["Rencana detail", a.rencana_detail], ["Dasar kewenangan (Anggaran Dasar)", a.dasar_kewenangan], ["Rencana waktu", a.rencana_waktu]] as const)
      .forEach(([l, v], k) => {
        for (let c = 2; c <= 4; c++) gaya(ws.getCell(out, c), t.cells[addr(15, Math.min(c, 4))]);
        isi(ws, out, 2, k + 1); isi(ws, out, 3, l); isi(ws, out, 4, v);
        ws.getCell(out, 4).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
        merge(ws, out, 4, out, 10);
        pasTinggi(ws, out, 12);
        if (v && String(v).length > 60) ws.getRow(out).height = Math.min(409, Math.ceil(String(v).length / 110) * 11.5 + 4);
        out++;
      });
    out++;
    gaya(ws.getCell(out, 2), t.cells.B30); isi(ws, out, 2, t.cells.B30?.v);
    out++;
    // Kepala tabel parameter RAM aksi korporasi (template baris 31–32) + kolom status.
    for (let c = 2; c <= 10; c++) for (const [src, dst] of [[31, out], [32, out + 1]]) {
      const s = t.cells[addr(src, c)]; gaya(ws.getCell(dst, c), s ?? t.cells.G32); ws.getCell(dst, c).value = (s?.v ?? null) as never;
    }
    gaya(ws.getCell(out, 11), t.cells.J31); isi(ws, out, 11, "Status Pengukuran"); gaya(ws.getCell(out + 1, 11), t.cells.J32);
    for (const m of t.merges) {
      const [p, q] = m.split(":").map(parse);
      if (p.row === 31) merge(ws, out + p.row - 31, p.col, out + q.row - 31, q.col);
    }
    merge(ws, out, 11, out + 1, 11);
    ws.getRow(out).height = 24;
    out += 2;
    for (let c = 2; c <= 11; c++) gaya(ws.getCell(out, c), { sz: 9, bd: 1, w: 1, va: "top", ha: c === 2 ? "center" : undefined });
    const status = a.hasil == null ? "" : hitungStatus(a.hasil, a.limit_v, a.appetite_v, a.tolerance_v, a.arah || "Makin tinggi makin buruk");
    isi(ws, out, 2, 1); isi(ws, out, 3, a.parameter); isi(ws, out, 4, a.formula); isi(ws, out, 5, a.hasil, "0.00%");
    isi(ws, out, 6, a.rasionalisasi_parameter); isi(ws, out, 7, a.limit_v, "0.00%"); isi(ws, out, 8, a.appetite_v, "0.00%");
    isi(ws, out, 9, a.tolerance_v, "0.00%"); isi(ws, out, 10, a.rasionalisasi_threshold); warnaStatus(isi(ws, out, 11, status), status);
    pasTinggi(ws, out, 12);
    out += 3;
  });
}

// ---------- utama ----------
export async function exportDam(d: SemuaData) {
  const slugs = ["title", "ras-cover", "ras", "ram-cover", "ram", "register", "driver", "kriteria", "standar", "klaster", "cat-cover", "cat"] as const;
  const [tpl, logoBuf, frameBuf] = await Promise.all([Promise.all(slugs.map(loadDam)), loadImg("logo.png"), loadImg("framework.png")]);
  const T = Object.fromEntries(slugs.map((s, i) => [s, tpl[i]])) as Record<(typeof slugs)[number], DamSheet>;
  const entitas = d.sampul.nama_entitas || "PT KINRA";
  const ganti = (v: unknown) => typeof v === "string"
    ? v.replace(/\[Nama Perusahaan[^\]]*\](\s*-\s*Mohon isi nama perusahaan disini)?/gi, entitas).replace(/\(Diisi nama entitas\)/gi, entitas)
    : v;

  const wb = await newWorkbook();
  const logo = wb.addImage({ buffer: logoBuf as never, extension: "png" });
  const framework = wb.addImage({ buffer: frameBuf as never, extension: "png" });

  const title = sampul(wb, T.title, ganti, logo);
  title.getCell("B10").value = entitas;
  title.getCell("B11").value = [d.sampul.posisi_data && `Posisi data: ${d.sampul.posisi_data}`, d.sampul.tanggal_penyusunan && `Tanggal penyusunan: ${d.sampul.tanggal_penyusunan}`].filter(Boolean).join(" · ") || null;
  title.mergeCells("B17:J24");
  title.getCell("B17").value = DISCLAIMER;
  title.getCell("B17").alignment = { wrapText: true, vertical: "top" };
  title.getCell("B17").font = { name: "Arial", size: 10, color: { argb: "FFFFFFFF" } };

  const fw = wb.addWorksheet("Framework", { views: [{ showGridLines: false }] });
  fw.addImage(framework, { tl: { col: 1, row: 1 }, ext: { width: 2165, height: 1360 } });

  sampul(wb, T["ras-cover"], ganti, logo);
  lembarRas(wb, T.ras, d, ganti);
  sampul(wb, T["ram-cover"], ganti, logo);
  lembarRam(wb, T.ram, buildRam(d.params, d.ras, d.pengendalian, d.ramTambahan), d, ganti);
  lembarRegister(wb, T.register, d, ganti);
  lembarDriver(wb, T.driver, d, ganti);
  lembarKriteria(wb, T.kriteria, d, ganti);
  for (const s of ["standar", "klaster"] as const) salin(lembar(wb, T[s]), T[s], ganti);

  // Data pendukung tiap parameter: lembar 1a–U10 aplikasi (rumus hidup, hasil hitung ikut disimpan).
  // Rumusnya merujuk Sampul!$E$10, jadi disertakan lembar Sampul tersembunyi berisi nama entitas.
  const sp = wb.addWorksheet("Sampul", { state: "hidden" });
  sp.getCell("E10").value = entitas;
  const { Workbook } = await import("./engine");
  const calc = new Workbook(d.templates, Object.fromEntries(d.params.map((p) => [p.code, p.inputs])), entitas);
  for (const t of d.templates) addParam(wb, t, d.params.find((p) => p.code === t.code), (a) => calc.get(t.code, a), `Risk.RAM-data.${t.code}`);
  calc.destroy();

  sampul(wb, T["cat-cover"], ganti, logo);
  lembarCat(wb, T.cat, d.cat, ganti);

  await save(wb, `DAM - Perencanaan Manajemen Risiko RKAP 2027 - ${entitas}.xlsx`);
}

"use client";
import type ExcelJSNs from "exceljs";
import type { CatAksi, ChallengeLog, KategoriRisiko, KriteriaDampak, ParameterSheet, ProgramStrategis, Ras, RasTambahan, RiskDriver, RiskRegister, Sampul, SheetTemplate } from "./types";
import { buildRam, type RamRow } from "./ram";
import { PETUNJUK, REKAP, note } from "./static";
import { hitungStatus, isTopRisk } from "./format";

type Col = { header: string; key: string; width: number; fmt?: string };
type Wb = ExcelJSNs.Workbook;
type Row = object;

const HEAD_BG = "FF123F29";
const RP = "#,##0";

/** Tambah satu lembar tabel dengan gaya kepala tabel kertas kerja. */
function addTable(wb: Wb, sheetName: string, title: string, cols: Col[], rows: Row[], catatan?: string) {
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: catatan ? 4 : 3 }] });
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 13 };
  if (catatan) {
    ws.getCell("A2").value = catatan;
    ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF6B6F68" } };
  }
  const start = catatan ? 4 : 3;
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.getRow(start);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_BG } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  head.height = 32;
  rows.forEach((r, ri) => {
    const row = ws.getRow(start + 1 + ri);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = ((r as Record<string, unknown>)[c.key] ?? null) as never;
      if (c.fmt) cell.numFmt = c.fmt;
      cell.alignment = { wrapText: true, vertical: "top" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFDCDCD2" } } };
    });
  });
  return ws;
}

async function newWorkbook() {
  const ExcelJS = (await import("exceljs")).default;
  return new ExcelJS.Workbook();
}

async function save(wb: Wb, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function download(filename: string, sheetName: string, title: string, cols: Col[], rows: Row[]) {
  const wb = await newWorkbook();
  addTable(wb, sheetName, title, cols, rows);
  await save(wb, filename);
}

// ---------- definisi kolom per lembar ----------
const REGISTER_COLS: Col[] = [
  { header: "No", key: "no", width: 5 }, { header: "Taksonomi Risiko", key: "kategori", width: 22 }, { header: "Risk Driver", key: "risk_driver", width: 28 },
  { header: "Risk Event", key: "risk_event", width: 32 }, { header: "Deskripsi Risk Event", key: "deskripsi", width: 50 }, { header: "Root Cause", key: "root_cause", width: 40 },
  { header: "Probabilitas Kejadian (0%-100%)", key: "probabilitas", width: 14, fmt: "0%" }, { header: "Deskripsi Dampak Risiko", key: "deskripsi_dampak", width: 36 },
  { header: "Nilai Dampak Risiko (Rp)", key: "nilai_dampak", width: 20, fmt: RP }, { header: "Kriteria Dampak Acuan", key: "kriteria_dampak", width: 34 },
  { header: "Kategori Dampak Risiko", key: "kategori_dampak", width: 16 }, { header: "Tagging Top Risk", key: "tagging", width: 10 },
  { header: "Expected Loss (Rp)", key: "expected_loss", width: 20, fmt: RP }, { header: "Existing Control", key: "existing_control", width: 36 },
  { header: "Rencana Mitigasi", key: "rencana_mitigasi", width: 36 }, { header: "Kategori Mitigasi", key: "kategori_mitigasi", width: 14 },
  { header: "Parameter RAM Terkait", key: "param", width: 18 },
];
const registerRows = (rows: RiskRegister[]) => rows.map((r, i) => ({
  ...r, no: i + 1, param: (r.parameter_ram ?? []).join(", "), tagging: r.kategori_dampak ? (isTopRisk(r.kategori_dampak) ? "Ya" : "Tidak") : "",
}));

const REKAP_COLS: Col[] = [
  { header: "No", key: "no", width: 5 }, { header: "Kode", key: "kode", width: 7 }, { header: "Parameter", key: "parameter", width: 46 },
  { header: "Kategori Risiko", key: "kategori", width: 28 }, { header: "Satuan", key: "satuan", width: 10 },
  { header: "Limit", key: "limit", width: 12 }, { header: "Appetite", key: "appetite", width: 12 }, { header: "Tolerance", key: "tolerance", width: 12 },
  { header: "Hasil Pengukuran RKAP 2027", key: "hasil", width: 16 }, { header: "Status Pengukuran", key: "status", width: 18 }, { header: "Diterapkan", key: "diterapkan", width: 11 },
];
const rekapRows = (params: ParameterSheet[]) => REKAP.map((r) => {
  const p = params.find((x) => x.code === r.kode);
  return { ...r, ...(p?.summary ?? {}), diterapkan: r.grup === "Parameter Standar" ? "Ya" : p?.diterapkan };
});

const RAM_COLS: Col[] = [
  { header: "No", key: "kategoriNo", width: 5 }, { header: "Taksonomi Risiko", key: "kategori", width: 24 }, { header: "Kode", key: "kode", width: 7 },
  { header: "Parameter Pengukuran", key: "parameter", width: 40 }, { header: "Formula", key: "formula", width: 44 }, { header: "Unit Satuan", key: "satuan", width: 10 },
  { header: "Kategori Parameter", key: "kategoriParameter", width: 18 }, { header: "Limit", key: "limit", width: 11 }, { header: "Appetite", key: "appetite", width: 11 },
  { header: "Tolerance", key: "tolerance", width: 11 }, { header: "Sikap Risiko Sesuai RAS", key: "sikap", width: 18 }, { header: "Hasil Pengukuran (Risiko Inheren)", key: "hasil", width: 16 },
  { header: "Status Pengukuran", key: "status", width: 16 }, { header: "Inisiatif Strategis", key: "inisiatif", width: 30 }, { header: "Kebijakan", key: "kebijakan", width: 30 },
  { header: "Program Kerja", key: "program", width: 30 }, { header: "Anggaran (Rp miliar)", key: "anggaran", width: 14 },
];
const ramRows = (rows: RamRow[]) => rows.map((r) => {
  const src = (r.tambahan ?? r.pengendalian ?? {}) as Record<string, unknown>;
  return { ...r, inisiatif: src.inisiatif, kebijakan: src.kebijakan, program: src.program, anggaran: src.anggaran };
});

export const exportRegister = (rows: RiskRegister[]) =>
  download("Risk Register RKAP 2027 - PT KINRA.xlsx", "Risk Register", "Risk Register RKAP 2027 - PT KINRA", REGISTER_COLS, registerRows(rows));

export const exportRekap = (params: ParameterSheet[]) =>
  download("Rekap Parameter RAM RKAP 2027 - PT KINRA.xlsx", "Rekap", "Rekap Parameter RAM RKAP 2027 - PT KINRA", REKAP_COLS, rekapRows(params));

export const exportRam = (rows: RamRow[]) =>
  download("Risk Acceptance Matrix RKAP 2027 - PT KINRA.xlsx", "RAM", "Risk Acceptance Matrix RKAP 2027 - PT KINRA", RAM_COLS, ramRows(rows));

export const exportChallenge = (rows: ChallengeLog[]) =>
  download(`Notulen Challenge Session RKAP 2027 - PT KINRA.xlsx`, "Log Challenge", "Notulen Challenge Session RKAP 2027 - PT KINRA", [
    { header: "No", key: "no", width: 5 }, { header: "Waktu", key: "waktu", width: 17 }, { header: "Terkait", key: "ref_label", width: 34 },
    { header: "Masukan Challenger", key: "masukan", width: 60 }, { header: "Challenger", key: "challenger", width: 18 }, { header: "Prioritas", key: "prioritas", width: 10 },
    { header: "Tanggapan / Komitmen", key: "tanggapan", width: 48 }, { header: "PIC", key: "pic", width: 18 }, { header: "Tenggat", key: "tenggat", width: 12 },
    { header: "Status", key: "status", width: 13 },
  ], [...rows].reverse().map((r, i) => ({ ...r, no: i + 1, waktu: new Date(r.created_at).toLocaleString("id-ID") })));

// ---------- unduh seluruh kertas kerja ----------
export interface SemuaData {
  sampul: Sampul; kategori: KategoriRisiko[]; ras: Ras[]; rasTambahan: RasTambahan[]; kriteria: KriteriaDampak[]; drivers: RiskDriver[];
  register: RiskRegister[]; params: ParameterSheet[]; pengendalian: Parameters<typeof buildRam>[2]; ramTambahan: Parameters<typeof buildRam>[3];
  cat: CatAksi[]; program: ProgramStrategis[]; templates: SheetTemplate[];
}

/** Lembar Sampul. Nama entitas di E10 karena rumus lembar parameter merujuk Sampul!$E$10. */
function addSampul(wb: Wb, s: Sampul) {
  const ws = wb.addWorksheet("Sampul");
  ws.columns = [{ width: 3 }, { width: 24 }, { width: 3 }, { width: 3 }, { width: 70 }];
  ws.getCell("B6").value = "KERTAS KERJA PERENCANAAN MANAJEMEN RISIKO";
  ws.getCell("B7").value = "RENCANA KERJA DAN ANGGARAN PERUSAHAAN (RKAP) 2027";
  ws.getCell("B6").font = { bold: true, size: 16, color: { argb: "FFC00000" } };
  ws.getCell("B7").font = { bold: true, size: 12 };
  ([["Nama Entitas", s.nama_entitas], ["Posisi Data", s.posisi_data], ["Tanggal Penyusunan", s.tanggal_penyusunan], ["Versi", s.versi]] as const).forEach(([l, v], i) => {
    ws.getCell(`B${10 + i}`).value = l;
    ws.getCell(`B${10 + i}`).font = { bold: true };
    ws.getCell(`E${10 + i}`).value = v ?? null;
    ws.getCell(`E${10 + i}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFCC" } };
  });
  if (s.catatan) ws.getCell("B15").value = s.catatan;
}

/** Lembar parameter dibangun ulang dari template asli: format, rumus, dan daftar pilihan ikut, nilai hasil hitung disimpan sebagai cache. */
function addParam(wb: Wb, t: SheetTemplate, p: ParameterSheet | undefined, hitung: (addr: string) => unknown) {
  const ws = wb.addWorksheet(t.code, { properties: { tabColor: { argb: p?.diterapkan === "Tidak" ? "FFBFBFBF" : "FFC00000" } } });
  for (const [c, w] of Object.entries(t.widths)) ws.getColumn(c).width = w;
  const inp = p?.inputs ?? {};
  for (const [addr, c] of Object.entries(t.cells)) {
    const cell = ws.getCell(addr);
    if (c.f) {
      const res = hitung(addr);
      const result = typeof res === "string" && /^#[A-Z0-9/!?]+$/.test(res) ? { error: res } : res ?? undefined;
      cell.value = { formula: c.f.replace(/^=/, ""), result } as never;
    } else {
      const v = c.bg === "FFFFCC" && addr in inp ? inp[addr] : c.v;
      cell.value = (v ?? null) as never;
    }
    if (c.bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${c.bg}` } };
    cell.font = { bold: !!c.b, italic: !!c.i, size: c.sz ?? 10, ...(c.fc ? { color: { argb: `FF${c.fc}` } } : {}) };
    cell.alignment = { wrapText: !!c.w, vertical: "top", ...(c.ha ? { horizontal: c.ha as "left" } : {}) };
    if (c.nf) cell.numFmt = c.nf;
    if (c.bd) {
      const th = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
      cell.border = { top: th, left: th, bottom: th, right: th };
    }
  }
  for (const m of t.merges) { try { ws.mergeCells(m); } catch { /* rentang tumpang tindih diabaikan */ } }
  for (const v of t.validations) {
    for (const ref of v.sqref.split(/\s+/)) {
      (ws as unknown as { dataValidations: { add: (r: string, d: object) => void } }).dataValidations.add(ref, { type: "list", allowBlank: true, formulae: [v.list] });
    }
  }
}

/** Seluruh lembar kertas kerja (kecuali Executive Summary) dalam satu file, urutannya sama dengan kertas kerja Excel. */
export async function exportSemua(d: SemuaData) {
  const wb = await newWorkbook();
  const entitas = d.sampul.nama_entitas || "PT KINRA";
  const judul = (s: string) => `${s} RKAP 2027 - ${entitas}`;
  const katEn = (n: string | null) => d.kategori.find((k) => k.nama === n)?.nama_en ?? n;

  addSampul(wb, d.sampul);

  addTable(wb, "Petunjuk", "Petunjuk Pengisian", [{ header: "Lembar", key: "lembar", width: 22 }, { header: "Isi", key: "isi", width: 110 }], PETUNJUK);

  addTable(wb, "RAS", judul("Risk Appetite Statement"), [
    { header: "No", key: "no", width: 5 }, { header: "Kategori Risiko", key: "kategori", width: 30 },
    { header: "Sikap Risiko Induk", key: "sikap_induk", width: 18 }, { header: "Pernyataan Selera Risiko Induk", key: "pernyataan_induk", width: 60 },
    { header: "Sikap Risiko Entitas", key: "sikap", width: 18 }, { header: "Pernyataan Selera Risiko Entitas", key: "pernyataan", width: 60 },
    { header: "Rasionalisasi", key: "rasionalisasi", width: 50 },
  ], [...d.ras.map((r) => ({ ...r, kategori: katEn(r.kategori) })),
    ...d.rasTambahan.map((r) => ({ no: "Tambahan", kategori: katEn(r.kategori), sikap: r.sikap, pernyataan: r.pernyataan, rasionalisasi: r.rasionalisasi }))], note("RAS"));

  addTable(wb, "Kriteria Dampak", judul("Kriteria Dampak"), [
    { header: "Kategori Risiko", key: "kategori", width: 26 }, { header: "Kode", key: "kode", width: 8 }, { header: "Kriteria", key: "kriteria", width: 36 },
    { header: "Perhitungan", key: "perhitungan", width: 30 }, { header: "Sangat Rendah", key: "sangat_rendah", width: 24 }, { header: "Rendah", key: "rendah", width: 24 },
    { header: "Moderat", key: "moderat", width: 24 }, { header: "Tinggi", key: "tinggi", width: 24 }, { header: "Sangat Tinggi", key: "sangat_tinggi", width: 24 },
  ], d.kriteria, note("Kriteria Dampak"));

  addTable(wb, "Risk Driver", judul("Risk Driver"), [
    { header: "Kategori Risiko", key: "kategori", width: 30 }, { header: "Risk Driver", key: "driver", width: 40 },
    { header: "Bentuk", key: "bentuk", width: 60 }, { header: "Tambahan Entitas", key: "tambahan", width: 12 },
  ], d.drivers.map((r) => ({ ...r, tambahan: r.tambahan ? "Ya" : "" })), note("Risk Driver"));

  addTable(wb, "Risk Register", judul("Risk Register"), REGISTER_COLS, registerRows(d.register), note("Risk Register"));

  addTable(wb, "Risiko Utama", judul("Risiko Utama"), [
    { header: "No", key: "no", width: 5 }, { header: "Taksonomi Risiko", key: "kategori", width: 24 }, { header: "Risk Event", key: "risk_event", width: 34 },
    { header: "Deskripsi Risk Event", key: "deskripsi", width: 50 }, { header: "Probabilitas Kejadian", key: "probabilitas", width: 12, fmt: "0%" },
    { header: "Nilai Dampak Risiko (Rp)", key: "nilai_dampak", width: 20, fmt: RP }, { header: "Kategori Dampak Risiko", key: "kategori_dampak", width: 16 },
    { header: "Rencana Mitigasi", key: "rencana_mitigasi", width: 50 },
  ], d.register.filter((r) => isTopRisk(r.kategori_dampak)).map((r, i) => ({ ...r, no: i + 1 })), note("Risiko Utama"));

  addTable(wb, "RAM", judul("Risk Acceptance Matrix"), RAM_COLS, ramRows(buildRam(d.params, d.ras, d.pengendalian, d.ramTambahan)), note("RAM"));

  addTable(wb, "CAT", judul("Corporate Action Threshold (CAT)"), [
    { header: "No", key: "no", width: 5 }, { header: "Jenis Aksi Korporasi", key: "jenis", width: 22 }, { header: "Nama Aksi Korporasi", key: "nama", width: 30 },
    { header: "Rencana Detail", key: "rencana_detail", width: 40 }, { header: "Dasar Kewenangan (Anggaran Dasar)", key: "dasar_kewenangan", width: 30 },
    { header: "Rencana Waktu", key: "rencana_waktu", width: 16 }, { header: "Parameter Akumulasi Transaksi", key: "parameter", width: 26 },
    { header: "Formula", key: "formula", width: 30 }, { header: "Hasil Pengukuran (Risiko Inheren)", key: "hasil", width: 14, fmt: "0.00%" },
    { header: "Rasionalisasi Pemilihan Parameter", key: "rasionalisasi_parameter", width: 36 }, { header: "Limit", key: "limit_v", width: 10, fmt: "0.00%" },
    { header: "Appetite", key: "appetite_v", width: 10, fmt: "0.00%" }, { header: "Tolerance", key: "tolerance_v", width: 10, fmt: "0.00%" },
    { header: "Status", key: "status", width: 14 }, { header: "Rasionalisasi Nilai Risk Threshold", key: "rasionalisasi_threshold", width: 36 },
  ], d.cat.map((r, i) => ({ ...r, no: i + 1, status: r.hasil == null ? "" : hitungStatus(r.hasil, r.limit_v, r.appetite_v, r.tolerance_v, "Makin tinggi makin buruk") })), note("CAT"));

  addTable(wb, "Rekap", judul("Rekap Parameter RAM"), REKAP_COLS, rekapRows(d.params), note("Rekap"));

  addTable(wb, "Program Strategis", judul("Program atau Inisiatif Strategis GRCS"), [
    { header: "No", key: "no", width: 5 }, { header: "Pilar GRCS", key: "pilar", width: 16 }, { header: "Nama Program", key: "nama", width: 32 },
    { header: "Inisiatif Strategi RJPP", key: "inisiatif_rjpp", width: 30 }, { header: "Objective Scorecard", key: "objective_scorecard", width: 30 },
    { header: "Program Kerja", key: "program_kerja", width: 30 }, { header: "Pemimpin Program", key: "pemimpin", width: 22 }, { header: "Pemilik Program", key: "pemilik", width: 22 },
    { header: "Bulan Mulai", key: "bulan_mulai", width: 14 }, { header: "Bulan Selesai", key: "bulan_selesai", width: 14 }, { header: "Deskripsi Program", key: "deskripsi", width: 40 },
    { header: "Tujuan & Hasil Kerja – Kualitatif", key: "tujuan_kualitatif", width: 36 }, { header: "Tujuan & Hasil Kerja – Kuantitatif", key: "tujuan_kuantitatif", width: 36 },
    { header: "Target Program", key: "target", width: 30 }, { header: "OPEX (Rp)", key: "opex", width: 18, fmt: RP }, { header: "CAPEX (Rp)", key: "capex", width: 18, fmt: RP },
    { header: "Risiko Implementasi", key: "risiko_implementasi", width: 36 }, { header: "Mitigasi Risiko", key: "mitigasi", width: 36 },
  ], d.program.map((r, i) => ({ ...r, no: i + 1 })));

  // Lembar parameter 1a–U10: rumus tetap hidup, hasil hitung disertakan agar langsung tampil.
  const { Workbook } = await import("./engine");
  const calc = new Workbook(d.templates, Object.fromEntries(d.params.map((p) => [p.code, p.inputs])), entitas);
  for (const t of d.templates) addParam(wb, t, d.params.find((p) => p.code === t.code), (a) => calc.get(t.code, a));
  calc.destroy();

  await save(wb, `Kertas Kerja Perencanaan Manajemen Risiko RKAP 2027 - ${entitas}.xlsx`);
}

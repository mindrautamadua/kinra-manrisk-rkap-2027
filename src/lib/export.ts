"use client";
import type { ParameterSheet, RiskRegister } from "./types";
import type { RamRow } from "./ram";
import { REKAP } from "./static";
import { isTopRisk } from "./format";

type Col = { header: string; key: string; width: number; fmt?: string };

/** Unduh tabel sebagai .xlsx dengan gaya kepala tabel kertas kerja. */
async function download(filename: string, sheetName: string, title: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 3 }] });
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.getRow(3);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123F29" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  head.height = 32;
  rows.forEach((r, ri) => {
    const row = ws.getRow(4 + ri);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = (r[c.key] ?? null) as never;
      if (c.fmt) cell.numFmt = c.fmt;
      cell.alignment = { wrapText: true, vertical: "top" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFDCDCD2" } } };
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const exportRegister = (rows: RiskRegister[]) =>
  download("Risk Register RKAP 2027 - PT KINRA.xlsx", "Risk Register", "Risk Register RKAP 2027 - PT KINRA", [
    { header: "No", key: "no", width: 5 }, { header: "Taksonomi Risiko", key: "kategori", width: 22 }, { header: "Risk Driver", key: "risk_driver", width: 28 },
    { header: "Risk Event", key: "risk_event", width: 32 }, { header: "Deskripsi Risk Event", key: "deskripsi", width: 50 }, { header: "Root Cause", key: "root_cause", width: 40 },
    { header: "Probabilitas Kejadian (0%-100%)", key: "probabilitas", width: 14, fmt: "0%" }, { header: "Deskripsi Dampak Risiko", key: "deskripsi_dampak", width: 36 },
    { header: "Nilai Dampak Risiko (Rp)", key: "nilai_dampak", width: 20, fmt: "#,##0" }, { header: "Kriteria Dampak Acuan", key: "kriteria_dampak", width: 34 },
    { header: "Kategori Dampak Risiko", key: "kategori_dampak", width: 16 }, { header: "Tagging Top Risk", key: "tagging", width: 10 },
    { header: "Expected Loss (Rp)", key: "expected_loss", width: 20, fmt: "#,##0" }, { header: "Existing Control", key: "existing_control", width: 36 },
    { header: "Rencana Mitigasi", key: "rencana_mitigasi", width: 36 }, { header: "Kategori Mitigasi", key: "kategori_mitigasi", width: 14 },
  ], rows.map((r, i) => ({ ...r, no: i + 1, tagging: r.kategori_dampak ? (isTopRisk(r.kategori_dampak) ? "Ya" : "Tidak") : "" })));

export const exportRekap = (params: ParameterSheet[]) =>
  download("Rekap Parameter RAM RKAP 2027 - PT KINRA.xlsx", "Rekap", "Rekap Parameter RAM RKAP 2027 - PT KINRA", [
    { header: "No", key: "no", width: 5 }, { header: "Kode", key: "kode", width: 7 }, { header: "Parameter", key: "parameter", width: 46 },
    { header: "Kategori Risiko", key: "kategori", width: 28 }, { header: "Satuan", key: "satuan", width: 10 },
    { header: "Limit", key: "limit", width: 12 }, { header: "Appetite", key: "appetite", width: 12 }, { header: "Tolerance", key: "tolerance", width: 12 },
    { header: "Hasil Pengukuran RKAP 2027", key: "hasil", width: 16 }, { header: "Status Pengukuran", key: "status", width: 18 }, { header: "Diterapkan", key: "diterapkan", width: 11 },
  ], REKAP.map((r) => { const p = params.find((x) => x.code === r.kode); return { ...r, ...(p?.summary ?? {}), diterapkan: r.grup === "Parameter Standar" ? "Ya" : p?.diterapkan }; }));

export const exportRam = (rows: RamRow[]) =>
  download("Risk Acceptance Matrix RKAP 2027 - PT KINRA.xlsx", "RAM", "Risk Acceptance Matrix RKAP 2027 - PT KINRA", [
    { header: "No", key: "kategoriNo", width: 5 }, { header: "Taksonomi Risiko", key: "kategori", width: 24 }, { header: "Kode", key: "kode", width: 7 },
    { header: "Parameter Pengukuran", key: "parameter", width: 40 }, { header: "Formula", key: "formula", width: 44 }, { header: "Unit Satuan", key: "satuan", width: 10 },
    { header: "Kategori Parameter", key: "kategoriParameter", width: 18 }, { header: "Limit", key: "limit", width: 11 }, { header: "Appetite", key: "appetite", width: 11 },
    { header: "Tolerance", key: "tolerance", width: 11 }, { header: "Sikap Risiko Sesuai RAS", key: "sikap", width: 18 }, { header: "Hasil Pengukuran (Risiko Inheren)", key: "hasil", width: 16 },
    { header: "Status Pengukuran", key: "status", width: 16 }, { header: "Inisiatif Strategis", key: "inisiatif", width: 30 }, { header: "Kebijakan", key: "kebijakan", width: 30 },
    { header: "Program Kerja", key: "program", width: 30 }, { header: "Anggaran (Rp miliar)", key: "anggaran", width: 14 },
  ], rows.map((r) => {
    const src = r.tambahan ?? r.pengendalian ?? {};
    return { ...r, limit: r.limit, inisiatif: (src as Record<string, unknown>).inisiatif, kebijakan: (src as Record<string, unknown>).kebijakan,
      program: (src as Record<string, unknown>).program, anggaran: (src as Record<string, unknown>).anggaran };
  }));

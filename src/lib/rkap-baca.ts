/** Pembaca Kertas Kerja RKAP (Excel) tanpa ketergantungan ke browser/DB, sehingga bisa diuji di Node. */
import type ExcelJSNs from "exceljs";
import type { RkapData, RkapPos } from "./types";

/** Sheet laba rugi resmi pada Kertas Kerja RKAP (ditetapkan tim Keuangan). */
export const SHEET_LR = "BD RL_REKAP KONSOLIDASI SMNT";

export type Grup = "Pendapatan" | "Harga Pokok Penjualan" | "Beban Usaha" | "Non-Operasi" | "Laba" | "EBITDA";
export interface PosDef { kode: string; label: string; grup: Grup; cocok: RegExp; total?: boolean; segmen?: boolean }

/** Pos kunci yang diambil, dicocokkan dengan teks uraian (kolom B–D), bukan alamat sel. */
export const POS: PosDef[] = [
  { kode: "pendapatan_air", label: "Pengolahan Air Bersih", grup: "Pendapatan", cocok: /pengolahan air/, segmen: true },
  { kode: "pendapatan_limbah", label: "Pengolahan Limbah", grup: "Pendapatan", cocok: /pengolahan limbah/, segmen: true },
  { kode: "pendapatan_listrik", label: "Pengolahan Listrik", grup: "Pendapatan", cocok: /pengolahan listri/, segmen: true },
  { kode: "pendapatan_komisi", label: "Komisi Penjualan", grup: "Pendapatan", cocok: /komisi/, segmen: true },
  { kode: "pendapatan_jasa_lain", label: "Jasa Lain", grup: "Pendapatan", cocok: /^pendapatan jasa lain/, segmen: true },
  { kode: "pendapatan_tank_farm", label: "Distribusi Tank Farm", grup: "Pendapatan", cocok: /distribusi tank/, segmen: true },
  { kode: "pendapatan_smnt", label: "PT SMNT", grup: "Pendapatan", cocok: /pendapatan pt smnt/, segmen: true },
  { kode: "total_pendapatan", label: "Jumlah Seluruh Pendapatan", grup: "Pendapatan", cocok: /jumlah seluruh pendapatan/, total: true },
  { kode: "beban_pengolahan", label: "Beban Pengolahan", grup: "Harga Pokok Penjualan", cocok: /^beban pengolahan/ },
  { kode: "beban_overhead", label: "Beban Overhead", grup: "Harga Pokok Penjualan", cocok: /^beban overhead/ },
  { kode: "hpp", label: "Jumlah Harga Pokok Penjualan", grup: "Harga Pokok Penjualan", cocok: /jumlah harga pokok/, total: true },
  { kode: "beban_pemasaran", label: "Beban Pemasaran Lahan", grup: "Beban Usaha", cocok: /beban pemasaran/ },
  { kode: "beban_adm", label: "Beban Administrasi Umum", grup: "Beban Usaha", cocok: /administrasi umum/ },
  { kode: "beban_usaha", label: "Jumlah Beban Usaha", grup: "Beban Usaha", cocok: /jumlah beban usaha/, total: true },
  { kode: "beban_operasi", label: "Jumlah Seluruh Beban Operasi", grup: "Beban Usaha", cocok: /jumlah seluruh beban operasi/, total: true },
  { kode: "laba_operasional", label: "Laba Rugi Operasional", grup: "Laba", cocok: /laba rugi operasional/, total: true },
  { kode: "pendapatan_bunga", label: "Pendapatan Bunga Jasa Deposito", grup: "Non-Operasi", cocok: /pendapatan bunga jasa/ },
  { kode: "beban_pph_bank", label: "Beban PPh Bank", grup: "Non-Operasi", cocok: /beban pph bank/ },
  { kode: "pendapatan_lain", label: "Pendapatan Operasi Lain", grup: "Non-Operasi", cocok: /pendapatan operasi lain/ },
  { kode: "beban_lain", label: "Beban Operasi Lain", grup: "Non-Operasi", cocok: /beban operasi lain/ },
  { kode: "laba_sebelum_sharing", label: "Laba Rugi Sebelum Sharing Profit", grup: "Laba", cocok: /sebelum sharing/, total: true },
  { kode: "sharing_profit", label: "Sharing Profit", grup: "Laba", cocok: /^sharing profit/ },
  { kode: "laba_setelah_sharing", label: "Laba Rugi Setelah Sharing Profit", grup: "Laba", cocok: /setelah sharing/, total: true },
  { kode: "pajak", label: "Pajak Penghasilan Badan", grup: "Laba", cocok: /pajak penghasilan badan/ },
  { kode: "laba_bersih", label: "Laba Rugi Setelah Pajak", grup: "Laba", cocok: /laba rugi setelah pajak/, total: true },
  { kode: "ebitda_holding", label: "EBITDA Versi Holding", grup: "EBITDA", cocok: /ebitda versi holding/ },
  { kode: "ebitda_komite", label: "EBITDA Versi Komite Audit", grup: "EBITDA", cocok: /ebitda versi komite/ },
];
export const GRUP: Grup[] = ["Pendapatan", "Harga Pokok Penjualan", "Beban Usaha", "Laba", "Non-Operasi", "EBITDA"];
export const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];

// ---------- baca Excel ----------
type Cell = ExcelJSNs.CellValue;
function nilai(v: Cell): string | number | null {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return null;
  if (v instanceof Date) return null;
  if (typeof v === "object") {
    if ("result" in v) return nilai(v.result as Cell);       // sel rumus
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("error" in v) return null;                          // #REF!, #DIV/0!
    if ("text" in v) return String(v.text);
  }
  return null;
}
const teks = (v: Cell) => { const x = nilai(v); return typeof x === "string" ? x.replace(/\s+/g, " ").trim() : x == null ? "" : String(x); };
const angkaSel = (v: Cell) => { const x = nilai(v); return typeof x === "number" && isFinite(x) ? x : null; };

export interface HasilBaca { data: RkapData; peringatan: string[] }

/** Membaca sheet laba rugi konsolidasi: kolom dicari dari judul (Januari..Desember, Jumlah Setahun), baris dari uraian. */
export async function bacaKertasKerja(file: File): Promise<HasilBaca> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet(SHEET_LR);
  if (!ws) throw new Error(`Sheet "${SHEET_LR}" tidak ditemukan pada file ini.`);
  const peringatan: string[] = [];

  // Kolom bulan dan kolom setahun dari 10 baris judul pertama.
  const kolBulan: (number | null)[] = Array(12).fill(null);
  let kolTahun: number | null = null;
  const pembanding: { label: string; col: number }[] = [];
  for (let r = 1; r <= 10; r++) {
    const row = ws.getRow(r);
    row.eachCell((cell, c) => {
      const t = teks(cell.value).toLowerCase();
      const b = BULAN_PANJANG.indexOf(t);
      if (b >= 0 && kolBulan[b] == null) kolBulan[b] = c;
      if (/jumlah\s*setahun/.test(t) && kolTahun == null) kolTahun = c;
      // Blok pembanding: judul jenis (Realisasi/Prognosa/RKAP) dengan tahun murni di baris bawahnya.
      const jenis = t.match(/^(realisasi|prognosa|rkap)$/);
      if (jenis) {
        const th = teks(ws.getRow(r + 1).getCell(c).value);
        // Hanya dua tahun sebelum RKAP; blok lama (mis. RKAP 2021) diabaikan.
        if (/^20\d\d$/.test(th) && +th >= 2025 && +th < 2027) {
          const label = `${jenis[1] === "rkap" ? "RKAP" : jenis[1][0].toUpperCase() + jenis[1].slice(1)} ${th}`;
          if (!pembanding.some((p) => p.label === label)) pembanding.push({ label, col: c });
        }
      }
    });
  }
  const URUT = ["Realisasi", "RKAP", "Prognosa"];
  pembanding.sort((a, b) => a.label.slice(-4).localeCompare(b.label.slice(-4)) || URUT.indexOf(a.label.split(" ")[0]) - URUT.indexOf(b.label.split(" ")[0]));
  if (kolBulan.some((c) => c == null)) peringatan.push("Sebagian judul bulan (Januari–Desember) tidak ditemukan; nilai bulanan bisa kosong.");
  if (kolTahun == null) peringatan.push("Kolom \"Jumlah Setahun\" tidak ditemukan; nilai tahunan dihitung dari jumlah 12 bulan.");

  const pos: Record<string, RkapPos> = {};
  for (let r = 1; r <= Math.min(ws.rowCount, 150); r++) {
    const row = ws.getRow(r);
    const uraian = [2, 3, 4].map((c) => teks(row.getCell(c).value)).find((t) => t && isNaN(Number(t)))?.toLowerCase();
    if (!uraian) continue;
    const def = POS.find((p) => !pos[p.kode] && p.cocok.test(uraian));
    if (!def) continue;
    const bulan = kolBulan.map((c) => (c ? angkaSel(row.getCell(c).value) : null));
    const jumlahBulan = bulan.some((v) => v != null) ? bulan.reduce<number>((a, v) => a + (v ?? 0), 0) : null;
    const tahun = (kolTahun ? angkaSel(row.getCell(kolTahun).value) : null) ?? jumlahBulan;
    pos[def.kode] = {
      tahun, bulan,
      pembanding: Object.fromEntries(pembanding.map((p) => [p.label, angkaSel(row.getCell(p.col).value)])),
    };
  }
  const hilang = POS.filter((p) => !pos[p.kode]);
  if (hilang.length) peringatan.push(`Pos tidak ditemukan: ${hilang.map((p) => p.label).join(", ")}.`);
  return { data: { sheet: SHEET_LR, pembanding: pembanding.map((p) => p.label), pos }, peringatan };
}

// ---------- pemeriksaan konsistensi ----------
export interface Cek { label: string; ok: boolean; detail: string }
const fmtM = (v: number) => `Rp ${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;

export function periksa(d: RkapData): Cek[] {
  const t = (k: string) => d.pos[k]?.tahun ?? null;
  const out: Cek[] = [];
  const banding = (label: string, a: number | null, b: number | null) => {
    if (a == null || b == null) return out.push({ label, ok: false, detail: "Data tidak lengkap" });
    const selisih = a - b;
    out.push({ label, ok: Math.abs(selisih) < 1000, detail: Math.abs(selisih) < 1000 ? fmtM(a) : `Selisih ${fmtM(selisih)}` });
  };
  const sum = (ks: string[]) => ks.reduce<number | null>((a, k) => (a == null || t(k) == null ? a : a + t(k)!), 0);
  banding("Jumlah segmen = Jumlah Seluruh Pendapatan", sum(POS.filter((p) => p.segmen).map((p) => p.kode)), t("total_pendapatan"));
  banding("Beban Pengolahan + Overhead = HPP", sum(["beban_pengolahan", "beban_overhead"]), t("hpp"));
  const tp = t("total_pendapatan"), bo = t("beban_operasi");
  banding("Pendapatan − Beban Operasi = Laba Operasional", tp != null && bo != null ? tp - bo : null, t("laba_operasional"));
  const bulanTidakCocok = POS.filter((p) => {
    const x = d.pos[p.kode];
    if (!x || x.tahun == null || x.bulan.every((v) => v == null)) return false;
    return Math.abs(x.bulan.reduce<number>((a, v) => a + (v ?? 0), 0) - x.tahun) >= 1000;
  });
  out.push({
    label: "Jumlah 12 bulan = nilai setahun", ok: bulanTidakCocok.length === 0,
    detail: bulanTidakCocok.length ? `Tidak cocok: ${bulanTidakCocok.map((p) => p.label).join(", ")}` : "Semua pos cocok",
  });
  return out;
}


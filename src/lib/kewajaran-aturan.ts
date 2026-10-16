import { dateToSerial, formatCell } from "./engine";
import { persen } from "./format";
import type { CellValue } from "./types";

/**
 * Aturan uji kewajaran khusus per lembar parameter. Setiap aturan membaca nilai sel lembar
 * (isian maupun hasil rumus) dan menandai isian yang mungkin terhitung tetapi tidak masuk akal.
 */
export type SevKewajaran = "kritis" | "perhatian" | "info";
export interface TemuanKewajaran { id: string; severity: SevKewajaran; judul: string; detail?: string; sel: string[] }
export type Get = (addr: string) => CellValue;

export const num = (v: CellValue) => (typeof v === "number" && isFinite(v) ? v : null);
export const ada = (v: CellValue) => v != null && !(typeof v === "string" && v.trim() === "");
const kali = (x: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: x < 10 ? 1 : 0 }).format(x);
const rp = (x: number) => formatCell(x, "#,##0");
const teks = (v: CellValue) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const AWAL_2027 = dateToSerial(new Date(2027, 0, 1));

/** Pengumpul temuan sejenis: banyak baris bermasalah dilaporkan sebagai satu temuan. */
function pengumpul(code: string) {
  const map = new Map<string, { severity: SevKewajaran; judul: string; saran: string; item: string[]; sel: string[] }>();
  return {
    add(id: string, severity: SevKewajaran, judul: string, saran: string, item: string, sel: string[]) {
      const g = map.get(id) ?? { severity, judul, saran, item: [], sel: [] };
      g.item.push(item); g.sel.push(...sel); map.set(id, g);
    },
    out(): TemuanKewajaran[] {
      return [...map.entries()].map(([id, g]) => ({
        id: `${code}-${id}`, severity: g.severity, sel: g.sel,
        judul: g.item.length > 1 ? `${g.judul} (${g.item.length} baris)` : g.judul,
        detail: `${g.item.slice(0, 8).join("; ")}${g.item.length > 8 ? `; dan ${g.item.length - 8} lainnya` : ""}. ${g.saran}`,
      }));
    },
  };
}

/** Baris tabel yang memiliki isian pada salah satu kolom. */
function* baris(get: Get, dari: number, sampai: number, kolom: string[]) {
  for (let r = dari; r <= sampai; r++) if (kolom.some((c) => ada(get(`${c}${r}`)))) yield r;
}
const namaBaris = (get: Get, r: number, kol = "C") => teks(get(`${kol}${r}`)) || `Baris ${r}`;
const jumlah = (get: Get, r: number, kolom: string[]) => kolom.reduce((a, c) => a + (num(get(`${c}${r}`)) ?? 0), 0);
const kolomAntara = (a: string, b: string) => {
  const out: string[] = [];
  for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out.push(String.fromCharCode(c));
  return out;
};

/**
 * Pola umum "bagian tidak boleh melebihi total" per baris tabel.
 * `bagian` dijumlahkan lalu dibandingkan dengan `total` pada baris yang sama.
 */
function cekBagian(c: ReturnType<typeof pengumpul>, get: Get, o: {
  id: string; dari: number; sampai: number; bagian: string[]; total: string; nama?: string;
  judul: string; saran: string; severity?: SevKewajaran; label: (b: number, t: number) => string;
}) {
  for (const r of baris(get, o.dari, o.sampai, [...o.bagian, o.total])) {
    const t = num(get(`${o.total}${r}`));
    if (o.bagian.every((k) => num(get(`${k}${r}`)) == null)) continue;
    const b = jumlah(get, r, o.bagian);
    if (t != null && b > t + 1e-9) c.add(o.id, o.severity ?? "kritis", o.judul, o.saran, `${namaBaris(get, r, o.nama)}: ${o.label(b, t)}`, [...o.bagian, o.total].map((k) => `${k}${r}`));
  }
}

/** Skenario kerugian: pengurang (asuransi/penggantian) melebihi total potensi kerugian sehingga totalnya negatif. */
function cekPengurang(c: ReturnType<typeof pengumpul>, get: Get, dari: number, sampai: number, kerugian: string[], pengurang: string, nama: string, label: string) {
  for (const r of baris(get, dari, sampai, [...kerugian, pengurang])) {
    const k = jumlah(get, r, kerugian), p = num(get(`${pengurang}${r}`)) ?? 0;
    if (p > k && p > 0) c.add(`pengurang-${pengurang}${dari}`, "kritis", `${label} melebihi total potensi kerugian`,
      "Total potensi kerugian menjadi negatif dan mengurangi kerugian skenario lain. Batasi nilainya paling tinggi sebesar potensi kerugian.",
      `${namaBaris(get, r, nama)}: ${label.toLowerCase()} ${rp(p)} > kerugian ${rp(k)}`, [`${pengurang}${r}`, ...kerugian.map((x) => `${x}${r}`)]);
  }
}

// ---------- 1a Strategic Initiative Progress ----------
function cek1a(get: Get) {
  const c = pengumpul("1a");
  for (const r of baris(get, 31, 70, ["C", "G", "H", "I", "J", "L"])) {
    const nama = namaBaris(get, r), I = get(`I${r}`), J = get(`J${r}`), H = teks(get(`H${r}`)), L = teks(get(`L${r}`));
    const due = num(I), plan = num(J);
    if (ada(I) && (due == null || due < 1 || due > 12 || !Number.isInteger(due)))
      c.add("due", "perhatian", "Milestone Due Date bukan bulan 1–12", "Isi angka bulan 1 sampai 12. Teks seperti \"Bulan 1-12\" tidak dapat dihitung.", `${nama}: "${teks(I)}"`, [`I${r}`]);
    if (ada(J) && (plan == null || plan < 1 || plan > 13 || !Number.isInteger(plan)))
      c.add("plan", "perhatian", "Rencana Penyelesaian bukan bulan 1–13", "Isi angka bulan 1 sampai 12, atau 13 bila penyelesaian melewati 2027.", `${nama}: "${teks(J)}"`, [`J${r}`]);
    if (H === "Yes" && !ada(I)) c.add("due-kosong", "perhatian", "Critical milestone tanpa due date", "Critical milestone wajib punya bulan jatuh tempo agar ikut dihitung.", nama, [`I${r}`]);
    if (due != null && plan != null && plan > due && L === "Tidak")
      c.add("meleset", "kritis", "Rencana penyelesaian melewati due date tetapi ditandai tidak berisiko meleset",
        "Milestone yang direncanakan selesai setelah due date seharusnya berisiko meleset (Ya). Penandaan Tidak membuat hasil terlalu baik.", `${nama}: due bulan ${due}, rencana bulan ${plan}`, [`I${r}`, `J${r}`, `L${r}`]);
  }
  return c.out();
}

// ---------- 1b Penurunan Market Share ----------
function cek1b(get: Get): TemuanKewajaran[] {
  const out: TemuanKewajaran[] = [];
  const lebih26: string[] = [], lebih27: string[] = [], selLebih: string[] = [];
  const tidakSebanding: string[] = [], selTs: string[] = [];
  const monopoli: string[] = [];
  const lonjakan: string[] = [], selLonjak: string[] = [];
  const harga: string[] = [], selHarga: string[] = [];
  const terbuang: string[] = [], selBuang: string[] = [];
  const tanpaDefinisi: string[] = [], selDef: string[] = [];

  for (const r of baris(get, 30, 44, ["C", "E", "G", "H", "J", "K", "L"])) {
    const G = num(get(`G${r}`)), H = num(get(`H${r}`)), K = num(get(`K${r}`)), L = num(get(`L${r}`));
    const E = num(get(`E${r}`)), J = num(get(`J${r}`));
    const nama = namaBaris(get, r);
    if (!ada(get(`D${r}`))) { tanpaDefinisi.push(nama); selDef.push(`D${r}`); }
    const ms26 = G != null && H ? G / H : null;
    const ms27 = K != null && L ? K / L : null;

    if (ms26 == null || ms27 == null) {
      terbuang.push(`${nama} (${ms26 == null ? "market share 2026" : "market share 2027"} tidak terhitung)`);
      selBuang.push(`G${r}`, `H${r}`, `K${r}`, `L${r}`);
      continue;
    }
    if (ms26 > 1) { lebih26.push(`${nama} ${persen(ms26, 2)}`); selLebih.push(`G${r}`, `H${r}`); }
    if (ms27 > 1) { lebih27.push(`${nama} ${persen(ms27, 2)}`); selLebih.push(`K${r}`, `L${r}`); }

    const pasarSendiri27 = Math.abs(ms27 - 1) < 0.001, pasarSendiri26 = Math.abs(ms26 - 1) < 0.001;
    if (pasarSendiri27 !== pasarSendiri26) {
      tidakSebanding.push(`${nama}: 2026 ${persen(ms26, 2)} → 2027 ${persen(ms27, 2)}`);
      selTs.push(`H${r}`, `L${r}`);
    } else if (pasarSendiri27) monopoli.push(nama);
    else if (Math.abs(ms27 - ms26) > 0.2) {
      lonjakan.push(`${nama}: ${persen(ms26, 2)} → ${persen(ms27, 2)}`);
      selLonjak.push(`G${r}`, `H${r}`, `K${r}`, `L${r}`);
    }

    if (E && J && G && K) {
      const rasio = (K / J) / (G / E);
      if (rasio > 2 || rasio < 0.5) {
        harga.push(`${nama}: pendapatan per unit berubah ${kali(rasio >= 1 ? rasio : 1 / rasio)}× (${rasio >= 1 ? "naik" : "turun"})`);
        selHarga.push(`E${r}`, `G${r}`, `J${r}`, `K${r}`);
      }
    }
  }

  if (lebih26.length || lebih27.length) out.push({
    id: "1b-lebih100", severity: "kritis", sel: selLebih,
    judul: `Market share melebihi 100% pada ${lebih26.length + lebih27.length} isian`,
    detail: `${[...lebih26.map((s) => `2026 · ${s}`), ...lebih27.map((s) => `2027 · ${s}`)].join("; ")}. Revenue perusahaan tidak mungkin melebihi total penjualan pasar. Kemungkinan kolom Market Total Sales (H/L) diisi angka lain, misalnya biaya atau volume, atau pasar acuan didefinisikan terlalu sempit.`,
  });
  if (tidakSebanding.length) out.push({
    id: "1b-tidak-sebanding", severity: "kritis", sel: selTs,
    judul: `Definisi pasar 2026 dan 2027 tidak sebanding (${tidakSebanding.length} produk)`,
    detail: `${tidakSebanding.join("; ")}. Pada salah satu tahun total pasar sama dengan revenue perusahaan (market share 100%), pada tahun lain tidak. Penurunan market share yang dihasilkan bukan perubahan posisi pasar, melainkan perbedaan cara mengisi. Samakan definisi pasar acuan kedua tahun.`,
  });
  if (lonjakan.length) out.push({
    id: "1b-lonjakan", severity: "perhatian", sel: selLonjak,
    judul: `Perubahan market share lebih dari 20 poin (${lonjakan.length} produk)`,
    detail: `${lonjakan.join("; ")}. Pastikan perubahan sebesar ini didukung asumsi RKAP yang dapat dijelaskan saat challenge session.`,
  });
  if (harga.length) out.push({
    id: "1b-harga", severity: "perhatian", sel: selHarga,
    judul: `Pendapatan per unit volume berubah ekstrem (${harga.length} produk)`,
    detail: `${harga.join("; ")}. Revenue ÷ volume 2027 jauh berbeda dari 2026. Periksa satuan volume atau satuan nilai (Rp juta) pada salah satu tahun.`,
  });
  if (terbuang.length) out.push({
    id: "1b-terbuang", severity: "perhatian", sel: selBuang,
    judul: `${terbuang.length} produk tidak ikut dihitung dalam rata-rata`,
    detail: `${terbuang.join("; ")}. Total pasar kosong/nol atau berisi teks. Lengkapi angkanya, atau kosongkan baris bila produk tidak relevan.`,
  });
  if (tanpaDefinisi.length) out.push({
    id: "1b-definisi", severity: "perhatian", sel: selDef,
    judul: `Definisi pasar belum diisi (${tanpaDefinisi.length} produk)`,
    detail: `${tanpaDefinisi.join(", ")}. Pasar acuan wajib ditetapkan tertulis agar Market Total Sales 2026 dan 2027 dapat diuji kesebandingannya.`,
  });
  if (monopoli.length) out.push({
    id: "1b-monopoli", severity: "info", sel: [],
    judul: `${monopoli.length} produk memakai pasar acuan = revenue sendiri pada kedua tahun`,
    detail: `${monopoli.join(", ")}. Market share selalu 100% sehingga parameter tidak dapat mendeteksi penurunan. Wajar bila entitas pemasok tunggal di kawasan; jelaskan dasar penetapan pasar acuan pada bagian Sumber Data.`,
  });
  return out;
}

// ---------- 2a Net Open FX Position ----------
function cek2a(get: Get) {
  const c = pengumpul("2a");
  for (const r of baris(get, 30, 69, ["E", "F", "G"])) {
    const F = num(get(`F${r}`)), G = teks(get(`G${r}`)), E = teks(get(`E${r}`));
    if (F != null && F < 0 && G) c.add("tanda", "perhatian", "Nilai exposure ditulis negatif", "Arah exposure sudah ditentukan kolom Posisi (Long/Short). Nilai negatif membalik arah dua kali. Isi nilai positif.", `${namaBaris(get, r, "D")}: ${rp(F)} (${G})`, [`F${r}`]);
    if (E && !/^[A-Z]{3}$/.test(E)) c.add("kode", "perhatian", "Kode mata uang tidak baku", "Gunakan kode tiga huruf (USD, EUR, SGD) yang sama dengan tabel NOP agar nilai terjumlah.", `${namaBaris(get, r, "D")}: "${E}"`, [`E${r}`]);
  }
  for (const r of baris(get, 98, 117, ["C", "F", "I", "J"])) {
    const I = num(get(`I${r}`)), J = num(get(`J${r}`));
    if (I != null && J != null && J <= I) c.add("tenor", "kritis", "Tanggal jatuh tempo kontrak lindung nilai tidak setelah tanggal kontrak", "Periksa urutan Tanggal Kontrak dan Tanggal Jatuh Tempo.", namaBaris(get, r), [`I${r}`, `J${r}`]);
  }
  return c.out();
}

// ---------- 2b Net Debt Floating ----------
function cek2b(get: Get) {
  const c = pengumpul("2b");
  for (const r of baris(get, 31, 60, ["C", "F", "G", "H"])) {
    const nama = `${namaBaris(get, r)} ${teks(get(`D${r}`))}`.trim();
    const F = num(get(`F${r}`)), G = num(get(`G${r}`)), AB = num(get(`AB${r}`)), V = num(get(`V${r}`)), N = num(get(`N${r}`));
    if (F != null && G != null && G > F) c.add("outstanding", "kritis", "Outstanding principal melebihi original principal", "Sisa pokok tidak mungkin lebih besar dari pokok awal. Periksa mata uang atau satuan kedua kolom.", `${nama}: ${rp(G)} > ${rp(F)}`, [`F${r}`, `G${r}`]);
    if (AB != null && G != null && AB > G + (num(get(`H${r}`)) ?? 0)) c.add("hedge", "perhatian", "Hedge notional melebihi outstanding dan undrawn facility", "Nilai lindung nilai yang melebihi utangnya membuat net exposure terlalu kecil atau negatif.", `${nama}: hedge ${rp(AB)} > outstanding ${rp(G)}`, [`AB${r}`, `G${r}`]);
    if (V != null && V < AWAL_2027 && (G ?? 0) > 0) c.add("maturity", "perhatian", "Maturity date sebelum 2027 tetapi masih ada outstanding", "Utang yang jatuh tempo sebelum 2027 seharusnya sudah lunas atau direfinancing. Perbarui tanggal atau saldo.", nama, [`V${r}`, `G${r}`]);
    if (N != null && (N > 0.3 || N < 0)) c.add("bunga", "perhatian", "Suku bunga di luar kisaran wajar (0–30%)", "Bila maksudnya 6,4%, ketik 6,4% atau 0,064.", `${nama}: ${persen(N, 2)}`, [`N${r}`]);
  }
  return c.out();
}

// ---------- 3a DSCR ----------
function cek3a(get: Get) {
  const c = pengumpul("3a");
  for (const r of baris(get, 30, 59, ["C", "D", "E", "F"])) {
    const D = num(get(`D${r}`)), E = num(get(`E${r}`)), H = num(get(`H${r}`)), nama = namaBaris(get, r);
    if (D != null && E != null && D > 0 && E > D) c.add("pokok", "kritis", "Principal payment 2027 melebihi principal balance", "Pembayaran pokok setahun tidak dapat melebihi sisa pokok.", `${nama}: ${rp(E)} > ${rp(D)}`, [`D${r}`, `E${r}`]);
    if ((D ?? 0) === 0 && ((E ?? 0) > 0 || (num(get(`F${r}`)) ?? 0) > 0)) c.add("saldo-nol", "perhatian", "Ada pembayaran pokok/bunga tetapi principal balance nol atau kosong", "Isi sisa pokok pinjaman agar pembayaran dapat diuji kewajarannya.", nama, [`D${r}`]);
    if (H != null && (H > 0.3 || H < 0)) c.add("bunga", "perhatian", "Suku bunga di luar kisaran wajar (0–30%)", "Bila maksudnya 7,25%, ketik 7,25% atau 0,0725.", `${nama}: ${persen(H, 2)}`, [`H${r}`]);
    const D_ = D ?? 0, F = num(get(`F${r}`)), Hb = H;
    if (D_ > 0 && F != null && Hb != null && Hb > 0) {
      const tersirat = F / D_;
      if (tersirat > Hb * 3 || tersirat < Hb / 3) c.add("bunga-tersirat", "perhatian", "Interest payment tidak sejalan dengan saldo dan suku bunga", "Bunga setahun ÷ saldo pokok jauh berbeda dari suku bunga. Periksa satuan atau kelengkapan baris.", `${nama}: bunga ÷ saldo ${persen(tersirat, 2)} vs suku bunga ${persen(Hb, 2)}`, [`D${r}`, `F${r}`, `H${r}`]);
    }
  }
  return c.out();
}

// ---------- 3b Operating Cash Flow Ratio ----------
function cek3b(get: Get) {
  const c = pengumpul("3b");
  for (const r of baris(get, 30, 44, ["C", "D"])) {
    const C = teks(get(`C${r}`)).toLowerCase(), D = num(get(`D${r}`));
    if (D == null) continue;
    if (/pembayaran|pengeluaran|beban/.test(C) && D > 0) c.add("keluar", "perhatian", "Arus kas keluar ditulis positif", "Pembayaran mengurangi arus kas operasi dan harus ditulis negatif.", `${namaBaris(get, r)}: ${rp(D)}`, [`D${r}`]);
    if (/penerimaan|pendapatan/.test(C) && D < 0) c.add("masuk", "perhatian", "Arus kas masuk ditulis negatif", "Penerimaan menambah arus kas operasi dan harus ditulis positif.", `${namaBaris(get, r)}: ${rp(D)}`, [`D${r}`]);
  }
  for (const r of baris(get, 50, 64, ["C", "D"])) {
    const D = num(get(`D${r}`));
    if (D != null && D < 0) c.add("liabilitas", "perhatian", "Liabilitas jangka pendek bernilai negatif", "Saldo liabilitas ditulis positif. Nilai negatif memperkecil pembagi dan membesarkan rasio.", `${namaBaris(get, r)}: ${rp(D)}`, [`D${r}`]);
  }
  return c.out();
}

// ---------- 4a Counterparty Concentration ----------
function cek4a(get: Get) {
  const c = pengumpul("4a");
  for (const r of baris(get, 30, 129, ["C", "E", "G"])) {
    const E = num(get(`E${r}`)), G = num(get(`G${r}`));
    if (E != null && G != null && G > E) c.add("receivable", "perhatian", "Receivable melebihi outstanding/total tagihan", "Receivable proyeksi merupakan bagian dari total tagihan. Periksa satuan kedua kolom.", `${namaBaris(get, r)}: ${rp(G)} > ${rp(E)}`, [`E${r}`, `G${r}`]);
    if ((E ?? 0) < 0 || (G ?? 0) < 0) c.add("negatif", "perhatian", "Tagihan atau receivable bernilai negatif", "Saldo tagihan ditulis positif.", namaBaris(get, r), [`E${r}`, `G${r}`]);
  }
  return c.out();
}

// ---------- 4b Rasio Cadangan Kerugian ----------
function cek4b(get: Get) {
  const c = pengumpul("4b");
  cekBagian(c, get, { id: "cadangan", dari: 30, sampai: 129, bagian: ["G"], total: "E", judul: "Cadangan kerugian melebihi receivable", saran: "Cadangan tidak dapat lebih besar dari piutang yang dicadangkan.", label: (b, t) => `${rp(b)} > ${rp(t)}` });
  cekBagian(c, get, { id: "tertagih", dari: 30, sampai: 129, bagian: ["F"], total: "E", judul: "Proyeksi tidak tertagih melebihi receivable", saran: "Proyeksi tidak tertagih merupakan bagian dari receivable.", label: (b, t) => `${rp(b)} > ${rp(t)}` });
  for (const r of baris(get, 30, 129, ["E", "F", "G"])) {
    const F = num(get(`F${r}`)), G = num(get(`G${r}`)) ?? 0, D = teks(get(`D${r}`));
    if (F != null && F > 0 && G < F * 0.5) c.add("kurang", "perhatian", "Cadangan kerugian jauh di bawah proyeksi tidak tertagih", "Cadangan kurang dari separuh piutang yang diperkirakan tidak tertagih. Jelaskan dasar pencadangan atau sesuaikan nilainya.", `${namaBaris(get, r)}: cadangan ${rp(G)}, tidak tertagih ${rp(F)}`, [`F${r}`, `G${r}`]);
    if (D && D !== "Ya" && D !== "Tidak") c.add("grup", "info", "Kolom Entitas PTPN Group bukan Ya/Tidak", "Pilih Ya atau Tidak agar data konsolidasi terhitung.", `${namaBaris(get, r)}: "${D}"`, [`D${r}`]);
  }
  return c.out();
}

// ---------- 5a–5d, K4 Rasio kerugian skenario ----------
const cek5a = (get: Get) => { const c = pengumpul("5a"); cekPengurang(c, get, 31, 50, kolomAntara("F", "J"), "K", "C", "Insurance coverage"); return c.out(); };
const cek5b = (get: Get) => { const c = pengumpul("5b"); cekPengurang(c, get, 31, 50, kolomAntara("F", "J"), "K", "C", "Insurance coverage"); return c.out(); };
const cek5c = (get: Get) => { const c = pengumpul("5c"); cekPengurang(c, get, 31, 50, kolomAntara("G", "K"), "L", "F", "Penggantian dari pelaku"); return c.out(); };
function cek5d(get: Get) {
  const c = pengumpul("5d");
  cekPengurang(c, get, 31, 45, kolomAntara("F", "H"), "I", "C", "Insurance coverage");
  cekPengurang(c, get, 52, 66, kolomAntara("G", "L"), "M", "C", "Insurance coverage");
  cekBagian(c, get, { id: "aset", dari: 52, sampai: 66, bagian: ["K"], total: "F", severity: "perhatian", judul: "Potensi penggantian aset melebihi nilai buku aset terdampak", saran: "Biaya penggantian di atas nilai buku mungkin wajar (harga baru), tetapi perlu dijelaskan dasarnya.", label: (b, t) => `${rp(b)} > nilai buku ${rp(t)}` });
  return c.out();
}
const cekK4 = (get: Get) => { const c = pengumpul("K4"); cekPengurang(c, get, 31, 50, kolomAntara("F", "H"), "I", "C", "Insurance coverage"); return c.out(); };

// ---------- 6a Project IRR vs Hurdle Rate ----------
function cek6a(get: Get) {
  const c = pengumpul("6a");
  for (const r of baris(get, 33, 52, ["C", "E", "F", "H"])) {
    const nama = namaBaris(get, r), F = num(get(`F${r}`)), G = num(get(`G${r}`)), H = num(get(`H${r}`));
    if (F != null && (F > 1 || F < -1)) c.add("irr", "perhatian", "IRR proyek di luar kisaran wajar", "Bila maksudnya 13%, ketik 13% atau 0,13.", `${nama}: ${persen(F, 2)}`, [`F${r}`]);
    if (G != null && H != null && H < G) c.add("hurdle", "perhatian", "Hurdle rate lebih rendah dari WACC", "Hurdle rate lazimnya sama dengan atau di atas WACC. Hurdle rendah membuat proyek terlihat layak.", `${nama}: hurdle ${persen(H, 2)} < WACC ${persen(G, 2)}`, [`G${r}`, `H${r}`]);
    if (ada(get(`C${r}`)) && H == null) c.add("hurdle-kosong", "perhatian", "Hurdle rate proyek belum diisi", "Proyek tanpa hurdle rate membuat hasil Data belum lengkap.", nama, [`H${r}`]);
  }
  for (let r = 57; r <= 76; r++) {
    const D = num(get(`D${r}`)), nama = teks(get(`C${r}`)) || `Baris ${r}`;
    if (D != null && D > 0) c.add("tahun0", "perhatian", "Arus kas Tahun 0 (investasi) bernilai positif", "Investasi awal ditulis negatif agar IRR arus kas dapat dihitung.", `${nama}: ${rp(D)}`, [`D${r}`]);
    const irrKas = num(get(`AD${r}`)), irr = num(get(`F${r - 24}`));
    if (irrKas != null && irr != null && Math.abs(irrKas - irr) > 0.02) c.add("beda-irr", "perhatian", "IRR kajian berbeda dengan IRR dari arus kas", "Selisih lebih dari 2 poin. Samakan arus kas dengan kajian kelayakan atau jelaskan perbedaannya.", `${nama}: kajian ${persen(irr, 2)}, arus kas ${persen(irrKas, 2)}`, [`F${r - 24}`, `AD${r}`]);
  }
  return c.out();
}

// ---------- 6b Schedule Overrun Ratio ----------
function cek6b(get: Get) {
  const c = pengumpul("6b");
  for (const r of baris(get, 30, 49, ["C", "E", "F", "G"])) {
    const nama = namaBaris(get, r), E = num(get(`E${r}`)), F = num(get(`F${r}`)), G = num(get(`G${r}`)), H = num(get(`H${r}`));
    if (E != null && F != null && F <= E) c.add("rencana", "kritis", "Rencana penyelesaian tidak setelah tanggal mulai", "Periksa urutan tanggal; durasi rencana menjadi nol atau negatif.", nama, [`E${r}`, `F${r}`]);
    if (E != null && G != null && G <= E) c.add("perkiraan", "kritis", "Perkiraan penyelesaian tidak setelah tanggal mulai", "Periksa urutan tanggal; durasi perkiraan menjadi nol atau negatif.", nama, [`E${r}`, `G${r}`]);
    if (G != null && H != null && H < G) c.add("operasi", "perhatian", "Tanggal beroperasi sebelum perkiraan penyelesaian", "Proyek lazimnya beroperasi setelah selesai dibangun.", nama, [`G${r}`, `H${r}`]);
    if (ada(get(`C${r}`)) && (E == null || G == null)) c.add("tanggal", "perhatian", "Tanggal proyek belum lengkap", "Tanpa tanggal mulai dan perkiraan penyelesaian, proyek membuat hasil Data belum lengkap.", nama, [`E${r}`, `F${r}`, `G${r}`]);
  }
  return c.out();
}

// ---------- 7a Negative Sentiment Ratio ----------
function cek7a(get: Get) {
  const c = pengumpul("7a");
  let total = 0, perhatian = 0;
  for (const r of baris(get, 30, 79, ["C", "D", "E", "F"])) {
    const C = num(get(`C${r}`)), F = teks(get(`F${r}`)), nama = namaBaris(get, r, "D");
    if (C == null || C < 1 || C > 12 || !Number.isInteger(C)) {
      c.add("bulan", "perhatian", "Potensi waktu kejadian bukan bulan 1–12", "Baris tanpa bulan 1–12 tidak ikut dihitung.", `${nama}: "${teks(get(`C${r}`))}"`, [`C${r}`]);
      continue;
    }
    total++;
    if (F && F !== "Lainnya") perhatian++;
  }
  if (total >= 3 && perhatian === total) c.add("semua", "perhatian", "Seluruh potensi pemberitaan ditandai mendapat perhatian regulator/pemerintah/pemegang saham",
    "Hasil otomatis 100% (Merah) karena daftar hanya memuat isu yang mendapat perhatian. Bila memang demikian, jelaskan pada Penjelasan hasil; bila tidak, cantumkan juga potensi pemberitaan negatif lain (kolom perhatian dikosongkan atau Lainnya).",
    `${total} dari ${total} pemberitaan`, ["F30"]);
  return c.out();
}

// ---------- 8a Rasio Kerugian Gugatan Hukum ----------
function cek8a(get: Get) {
  const c = pengumpul("8a");
  for (const r of baris(get, 30, 129, ["C", "O", "P"])) {
    const nama = namaBaris(get, r), O = num(get(`O${r}`)), P = num(get(`P${r}`)), T = (P ?? 0) - (num(get(`R${r}`)) ?? 0) - (num(get(`S${r}`)) ?? 0);
    if (O != null && P != null && P > O) c.add("bayar", "perhatian", "Potensi pembayaran melebihi nilai tuntutan", "Potensi pembayaran lazimnya tidak melebihi tuntutan penggugat kecuali ada bunga/denda; jelaskan bila demikian.", `${nama}: ${rp(P)} > ${rp(O)}`, [`O${r}`, `P${r}`]);
    if (P != null && T < 0) c.add("negatif", "kritis", "Pengurang potensi kerugian melebihi potensi pembayaran", "Potensi kerugian perkara menjadi negatif dan mengurangi perkara lain.", `${nama}: ${rp(T)}`, [`P${r}`, `R${r}`, `S${r}`]);
    if (ada(get(`C${r}`)) && !ada(get(`E${r}`))) c.add("status", "perhatian", "Status perkara belum diisi", "Perkara tanpa status ikut dihitung sebagai perkara terbuka.", nama, [`E${r}`]);
  }
  return c.out();
}

// ---------- 8b Rasio Pelanggaran dan Denda ----------
function cek8b(get: Get) {
  const c = pengumpul("8b");
  for (const r of baris(get, 30, 59, ["C", "H", "I"])) {
    const nama = namaBaris(get, r, "F"), H = num(get(`H${r}`)), I = num(get(`I${r}`)), G = teks(get(`G${r}`));
    if (H != null && H > 0 && G !== "Telah dijatuhkan" && (I == null || I === 0)) c.add("prob", "perhatian", "Potensi denda tanpa probabilitas", "Probabilitas kosong atau 0% membuat denda tidak ikut dihitung.", nama, [`I${r}`]);
  }
  return c.out();
}

// ---------- K1 Commodity Price Sensitivity ----------
function cekK1(get: Get) {
  const c = pengumpul("K1");
  for (const r of baris(get, 30, 39, ["C", "E", "F", "G", "H"])) {
    const nama = namaBaris(get, r), E = num(get(`E${r}`)), F = num(get(`F${r}`)), G = num(get(`G${r}`)), H = num(get(`H${r}`));
    if (E != null && F != null && F >= E) c.add("dharga", "kritis", "Penurunan harga skenario sama dengan atau melebihi harga jual", "ΔHarga adalah besar penurunan, bukan harga setelah turun.", `${nama}: Δ ${rp(F)} ≥ harga ${rp(E)}`, [`E${r}`, `F${r}`]);
    if (F != null && F < 0) c.add("dneg", "perhatian", "ΔHarga ditulis negatif", "Isi besar penurunan sebagai angka positif.", nama, [`F${r}`]);
    if (G != null && H != null && H > G) c.add("ebitda", "perhatian", "EBITDA skenario lebih tinggi dari EBITDA RKAP", "Harga turun seharusnya menurunkan EBITDA. Periksa kolom EBITDA pada skenario.", `${nama}: ${rp(H)} > ${rp(G)}`, [`G${r}`, `H${r}`]);
  }
  return c.out();
}

// ---------- K2 Sensitivitas Marjin ----------
function cekK2(get: Get) {
  const c = pengumpul("K2");
  const naik = num(get("I27"));
  if (naik != null && naik <= 0) c.add("skenario", "kritis", "Kenaikan harga pupuk/BBM pada skenario nol atau negatif", "Isi persentase kenaikan harga yang dipakai pada skenario.", persen(naik, 2), ["I27"]);
  for (const r of baris(get, 32, 41, ["C", "D", "E"])) {
    const D = num(get(`D${r}`)), E = num(get(`E${r}`));
    if (D != null && E != null && E > D) c.add("marjin", "perhatian", "Marjin skenario lebih tinggi dari marjin RKAP", "Kenaikan harga input seharusnya menekan marjin.", `${namaBaris(get, r)}: ${rp(E)} > ${rp(D)}`, [`D${r}`, `E${r}`]);
  }
  return c.out();
}

// ---------- K3 Yield Realization Rate ----------
function cekK3(get: Get) {
  const c = pengumpul("K3");
  for (const r of baris(get, 30, 39, ["C", "E", "F", "H", "I"])) {
    const K = num(get(`K${r}`)), nama = namaBaris(get, r);
    if (K != null && (K > 1.5 || K < 0.5)) c.add("ekstrem", "perhatian", "Realisasi produktivitas jauh dari target (di luar 50%–150%)", "Periksa satuan luas dan produksi antara target dan proyeksi.", `${nama}: ${persen(K, 1)}`, [`E${r}`, `F${r}`, `H${r}`, `I${r}`]);
  }
  return c.out();
}

// ---------- K5 ESG Controversy ----------
function cekK5(get: Get) {
  const c = pengumpul("K5");
  const p = num(get("I27"));
  if (p != null && (p < 0 || !Number.isInteger(p))) c.add("jumlah", "perhatian", "Proyeksi jumlah insiden bukan bilangan bulat nonnegatif", "Isi jumlah kejadian (0, 1, 2, ...).", String(p), ["I27"]);
  const hist = [...baris(get, 32, 61, ["C", "D", "E"])].length;
  if (p != null && hist > 0 && p === 0) c.add("nol", "info", "Proyeksi 0 insiden padahal ada insiden 12 bulan terakhir", "Jelaskan upaya yang membuat insiden diproyeksikan tidak berulang.", `${hist} insiden historis`, ["I27"]);
  return c.out();
}

// ---------- U1–U10 ----------
const cekU1 = (get: Get) => { const c = pengumpul("U1"); cekBagian(c, get, { id: "kapasitas", dari: 32, sampai: 46, bagian: ["F"], total: "E", judul: "Kapasitas terpakai melebihi kapasitas tersedia", saran: "Take-up rate di atas 100% tidak mungkin; periksa satuan kedua kolom.", label: (b, t) => `${rp(b)} > ${rp(t)}` }); return c.out(); };
function cekU2(get: Get) {
  const c = pengumpul("U2");
  if (!ada(get("I29")) && ada(get("I30"))) c.add("basis", "perhatian", "Basis pembilang belum dipilih", "Pilih basis pembilang agar hasil memakai pendapatan yang tepat.", "I29 kosong", ["I29"]);
  for (const a of ["I30", "I31", "I32", "I33"]) { const v = num(get(a)); if (v != null && v < 0) c.add("neg", "perhatian", "Pendapatan bernilai negatif", "Isi pendapatan sebagai angka positif.", a, [a]); }
  return c.out();
}
function cekU3(get: Get) {
  const c = pengumpul("U3");
  for (const [tot, od, nama] of [["I29", "I30", "Piutang dagang"], ["I31", "I32", "Bagi hasil dan KSO"], ["I33", "I34", "Uang muka pembelian"]] as const) {
    const T = num(get(tot)), O = num(get(od));
    if (T != null && O != null && O > T) c.add("overdue", "kritis", "Nilai overdue melebihi total outstanding", "Tagihan lewat jatuh tempo merupakan bagian dari total outstanding.", `${nama}: ${rp(O)} > ${rp(T)}`, [tot, od]);
  }
  return c.out();
}
const cekU4 = (get: Get) => { const c = pengumpul("U4"); cekBagian(c, get, { id: "reject", dari: 32, sampai: 46, bagian: ["E", "F"], total: "D", judul: "Nilai reject melebihi total nilai produk", saran: "Reject internal dan reject pembeli merupakan bagian dari produk yang diperiksa.", label: (b, t) => `${rp(b)} > ${rp(t)}` }); return c.out(); };
function cekU5(get: Get) {
  const c = pengumpul("U5");
  cekBagian(c, get, { id: "downtime", dari: 32, sampai: 71, bagian: ["E"], total: "D", judul: "Unplanned downtime melebihi planned operating hours", saran: "Jam henti tak terencana merupakan bagian dari jam operasi rencana.", label: (b, t) => `${rp(b)} jam > ${rp(t)} jam` });
  for (const r of baris(get, 32, 71, ["D"])) { const D = num(get(`D${r}`)); if (D != null && D > 8784) c.add("jam", "kritis", "Planned operating hours melebihi jumlah jam setahun (8.784)", "Satu aset paling banyak beroperasi 8.760–8.784 jam per tahun. Pisahkan per aset atau periksa satuannya.", `${namaBaris(get, r)}: ${rp(D)} jam`, [`D${r}`]); }
  return c.out();
}
const cekU6 = (get: Get) => { const c = pengumpul("U6"); cekBagian(c, get, { id: "susut", dari: 34, sampai: 48, bagian: ["F"], total: "E", judul: "Losses melebihi total hasil dan persediaan", saran: "Susut merupakan bagian dari hasil/persediaan yang dikelola; periksa satuan kedua kolom.", label: (b, t) => `${rp(b)} > ${rp(t)}` }); return c.out(); };
function cekU7(get: Get) {
  const c = pengumpul("U7");
  for (const r of baris(get, 32, 41, ["C", "D", "E", "G", "H"])) {
    const nama = namaBaris(get, r), F = num(get(`F${r}`)), I = num(get(`I${r}`));
    for (const [v, a, lbl] of [[F, "F", "Cash cost per kg"], [I, "I", "Harga jual bersih per kg"]] as const)
      if (v != null && (v < 100 || v > 1e6)) c.add(`kg-${a}`, "perhatian", `${lbl} di luar kisaran wajar (Rp 100 – Rp 1 juta per kg)`, "Periksa satuan: nilai dalam Rp juta dan volume dalam kg.", `${nama}: Rp ${rp(v)}/kg`, a === "F" ? [`D${r}`, `E${r}`] : [`G${r}`, `H${r}`]);
  }
  return c.out();
}
const cekU8 = (get: Get) => { const c = pengumpul("U8"); cekBagian(c, get, { id: "izin", dari: 32, sampai: 46, bagian: ["F", "G"], total: "E", judul: "Hak/izin expired dan mendekati berakhir melebihi total", saran: "Keduanya merupakan bagian dari total luas hak atau jumlah izin wajib.", label: (b, t) => `${rp(b)} > ${rp(t)}` }); return c.out(); };
const cekU9 = (get: Get) => { const c = pengumpul("U9"); cekBagian(c, get, { id: "pemenuhan", dari: 32, sampai: 46, bagian: ["G"], total: "F", severity: "perhatian", judul: "Input terpenuhi melebihi kebutuhan", saran: "Pemenuhan di atas 100% menutupi kekurangan input lain bila dirata-rata; pastikan satuan dan periode sama.", label: (b, t) => `${rp(b)} > ${rp(t)}` }); return c.out(); };
function cekU10(get: Get) {
  const c = pengumpul("U10");
  cekBagian(c, get, { id: "okupasi", dari: 32, sampai: 131, bagian: ["E"], total: "D", judul: "Luas terokupasi melebihi total luas areal hak", saran: "Luas terokupasi merupakan bagian dari luas areal hak.", label: (b, t) => `${rp(b)} ha > ${rp(t)} ha` });
  cekBagian(c, get, { id: "baru", dari: 32, sampai: 131, bagian: ["G"], total: "E", severity: "perhatian", judul: "Okupasi baru melebihi total luas terokupasi", saran: "Okupasi baru pada bulan posisi data seharusnya sudah termasuk dalam luas terokupasi.", label: (b, t) => `${rp(b)} ha > ${rp(t)} ha` });
  return c.out();
}

export const ATURAN_KHUSUS: Record<string, (get: Get) => TemuanKewajaran[]> = {
  "1a": cek1a, "1b": cek1b, "2a": cek2a, "2b": cek2b, "3a": cek3a, "3b": cek3b, "4a": cek4a, "4b": cek4b,
  "5a": cek5a, "5b": cek5b, "5c": cek5c, "5d": cek5d, "6a": cek6a, "6b": cek6b, "7a": cek7a, "8a": cek8a, "8b": cek8b,
  K1: cekK1, K2: cekK2, K3: cekK3, K4: cekK4, K5: cekK5,
  U1: cekU1, U2: cekU2, U3: cekU3, U4: cekU4, U5: cekU5, U6: cekU6, U7: cekU7, U8: cekU8, U9: cekU9, U10: cekU10,
};

import { REKAP } from "./static";
import type { TemuanKewajaran } from "./kewajaran";
import { cekSikap, isTopRisk, nilaiParam } from "./format";
import { perluPengendalian, type RamRow } from "./ram";
import { cariKriteria, ebitdaRkap, elKeliru, saranDampak } from "./kualitas-register";
import { ringkasTarget } from "./target-risiko";
import type { CatAksi, KriteriaDampak, MitigasiAksi, ParameterSheet, Ras, RiskDriver, RiskRegister, Sampul } from "./types";

export type Severity = "kritis" | "perhatian" | "info";
export interface Temuan { id: string; severity: Severity; area: string; judul: string; detail?: string; href: string; ref?: { type: string; id: string; label: string } }
export interface Pemeriksaan { id: string; area: string; nama: string; temuan: Temuan[] }

const WAJIB_REGISTER: [keyof RiskRegister, string][] = [
  ["kategori", "Taksonomi Risiko"], ["risk_driver", "Risk Driver"], ["risk_event", "Risk Event"], ["deskripsi", "Deskripsi"],
  ["root_cause", "Root Cause"], ["probabilitas", "Probabilitas"], ["deskripsi_dampak", "Deskripsi Dampak"], ["nilai_dampak", "Nilai Dampak"],
  ["kriteria_dampak", "Kriteria Dampak Acuan"], ["kategori_dampak", "Kategori Dampak"], ["existing_control", "Existing Control"],
  ["rencana_mitigasi", "Rencana Mitigasi"], ["kategori_mitigasi", "Kategori Mitigasi"],
];
const kosong = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");
const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const nama = (r: RiskRegister, i: number) => `#${i + 1} ${r.risk_event ?? "(tanpa risk event)"}`;
const URUT_DAMPAK = ["Sangat Rendah", "Rendah", "Moderat", "Tinggi", "Sangat Tinggi"];

export interface InputKesiapan {
  sampul: Sampul; ras: Ras[]; register: RiskRegister[]; params: ParameterSheet[]; ram: RamRow[]; drivers: RiskDriver[]; cat: CatAksi[]; kriteria: KriteriaDampak[];
  /** false bila kolom parameter_ram belum ada (migrasi 0002 belum dijalankan). */
  adaKeterkaitan: boolean;
  /** Hasil uji kewajaran per kode lembar (lihat kewajaran.ts); kosong bila template belum dimuat. */
  kewajaran?: Record<string, TemuanKewajaran[]>;
  /** Rencana aksi mitigasi; null bila migrasi 0008 belum dijalankan. */
  aksi?: MitigasiAksi[] | null;
}

/** Jalankan seluruh pemeriksaan kesiapan challenge session. */
export function periksa(d: InputKesiapan): Pemeriksaan[] {
  const out: Pemeriksaan[] = [];
  const add = (id: string, area: string, n: string, temuan: Temuan[]) => out.push({ id, area, nama: n, temuan });
  const reg = d.register;
  const refR = (r: RiskRegister, i: number) => ({ type: "risiko", id: r.id, label: `Risiko ${nama(r, i)}` });
  const refP = (kode: string, label: string) => ({ type: "parameter", id: kode, label: `Parameter ${kode} – ${label}` });

  // ---------- RAM ----------
  add("ram-pengendalian", "RAM", "Parameter Merah wajib punya rencana pengendalian",
    d.ram.filter((r) => r.diterapkan && perluPengendalian(r.status)).filter((r) => {
      const src = r.tambahan ?? r.pengendalian;
      return !src || [src.inisiatif, src.kebijakan, src.program].every(kosong);
    }).map((r) => ({
      id: `peng-${r.key}`, severity: "kritis", area: "RAM",
      judul: `${r.kode || r.parameter} berstatus ${r.status} tanpa rencana pengendalian`,
      detail: `${r.parameter} · hasil ${nilaiParam(r.hasil, r.satuan)} (tolerance ${nilaiParam(r.tolerance, r.satuan)})`, href: "/ram", ref: refP(r.kode, r.parameter),
    })));

  add("ram-rasionalisasi", "RAM", "Setiap risk threshold punya rasionalisasi dan dasar perhitungan",
    d.ram.filter((r) => r.diterapkan && kosong((r.tambahan ?? r.pengendalian)?.rasionalisasi)).map((r) => ({
      id: `rasio-${r.key}`, severity: "perhatian", area: "RAM",
      judul: `${r.kode || r.parameter} belum punya rasionalisasi threshold`,
      detail: `${r.parameter} · limit ${nilaiParam(r.limit, r.satuan)}, appetite ${nilaiParam(r.appetite, r.satuan)}, tolerance ${nilaiParam(r.tolerance, r.satuan)}`, href: "/ram", ref: refP(r.kode, r.parameter),
    })));

  add("ram-belum-terukur", "Lembar Parameter", "Parameter yang diterapkan sudah terhitung",
    d.ram.filter((r) => r.diterapkan && !r.tambahan && !["Hijau", "Merah"].includes(r.status)).map((r) => ({
      id: `ukur-${r.kode}`, severity: "perhatian", area: "Lembar Parameter",
      judul: `${r.kode} ${r.parameter}: ${r.status}`, detail: `Hasil: ${nilaiParam(r.hasil, r.satuan)}. Lengkapi sel kuning bagian C atau isi konfirmasi eksposur di bagian D.`,
      href: `/parameter/${r.kode}`, ref: refP(r.kode, r.parameter),
    })));

  add("kewajaran", "Lembar Parameter", "Isian lembar parameter lolos uji kewajaran",
    Object.entries(d.kewajaran ?? {}).flatMap(([code, list]) => {
      const r = d.ram.find((x) => !x.tambahan && x.kode === code);
      if (!r?.diterapkan) return [];
      return list.filter((k) => k.severity !== "info").map((k): Temuan => ({
        id: `wajar-${code}-${k.id}`, severity: k.severity, area: "Lembar Parameter",
        judul: `${code} ${r.parameter}: ${k.judul}`, detail: k.detail, href: `/parameter/${code}`, ref: refP(r.kode, r.parameter),
      }));
    }));

  add("rekap-diterapkan", "Rekap", "Kolom Diterapkan parameter klaster & unik terisi",
    REKAP.filter((r) => r.grup !== "Parameter Standar" && !d.params.find((p) => p.code === r.kode)?.diterapkan).map((r) => ({
      id: `dit-${r.kode}`, severity: "info", area: "Rekap", judul: `${r.kode} ${r.parameter}: kolom Diterapkan belum dipilih`,
      detail: "Pilih Ya atau Tidak pada lembar Rekap.", href: "/rekap", ref: refP(r.kode, r.parameter),
    })));

  add("rekap-justifikasi", "Rekap", "Parameter tidak diterapkan disertai justifikasi",
    REKAP.filter((r) => r.grup !== "Parameter Standar").filter((r) => {
      const p = d.params.find((x) => x.code === r.kode);
      return p?.diterapkan === "Tidak" && kosong(p.alasan_tidak_diterapkan);
    }).map((r) => ({
      id: `just-${r.kode}`, severity: "perhatian", area: "Rekap", judul: `${r.kode} ${r.parameter}: tidak diterapkan tanpa justifikasi`,
      detail: "Isi dasar pertimbangan mengapa parameter tidak relevan dengan kegiatan usaha pada bagian B lembar Rekap.", href: "/rekap", ref: refP(r.kode, r.parameter),
    })));

  add("ram-tambahan", "RAM", "Parameter unik tambahan lengkap (kode, threshold, hasil)",
    d.ram.filter((r) => r.tambahan).filter((r) => [r.kode, r.limit, r.appetite, r.tolerance, r.hasil].some(kosong)).map((r) => ({
      id: `tamb-${r.key}`, severity: "perhatian", area: "RAM", judul: `Parameter unik "${r.parameter || "tanpa nama"}" belum lengkap`,
      detail: "Isi kode, limit, appetite, tolerance, dan hasil pengukuran.", href: "/ram",
    })));

  // ---------- Risk Register ----------
  add("reg-wajib", "Risk Register", "Kolom wajib Risk Register terisi",
    reg.map((r, i) => ({ r, i, miss: WAJIB_REGISTER.filter(([k]) => kosong(r[k])).map(([, l]) => l) })).filter((x) => x.miss.length).map(({ r, i, miss }) => ({
      id: `wajib-${r.id}`, severity: miss.length > 4 ? "kritis" : "perhatian", area: "Risk Register",
      judul: `${nama(r, i)}: ${miss.length} kolom kosong`, detail: miss.join(", "), href: "/risk-register", ref: refR(r, i),
    })));

  add("reg-driver", "Risk Register", "Risk driver sesuai daftar Risk Driver",
    reg.map((r, i) => ({ r, i })).filter(({ r }) => r.risk_driver && !d.drivers.some((x) => x.kategori === r.kategori && x.driver === r.risk_driver)).map(({ r, i }) => ({
      id: `drv-${r.id}`, severity: "perhatian", area: "Risk Register", judul: `${nama(r, i)}: risk driver tidak ada di daftar ${r.kategori ?? ""}`,
      detail: `"${r.risk_driver}". Pilih dari lembar Risk Driver atau tambahkan sebagai risk driver tambahan entitas.`, href: "/risk-register", ref: refR(r, i),
    })));

  const kembar: Temuan[] = [];
  reg.forEach((a, i) => reg.forEach((b, j) => {
    if (j <= i) return;
    const sama = [
      a.risk_event && norm(a.risk_event) === norm(b.risk_event) && a.kategori === b.kategori ? "risk event" : null,
      a.root_cause && norm(a.root_cause) === norm(b.root_cause) ? "root cause" : null,
      a.deskripsi_dampak && norm(a.deskripsi_dampak) === norm(b.deskripsi_dampak) ? "deskripsi dampak" : null,
      a.rencana_mitigasi && norm(a.rencana_mitigasi) === norm(b.rencana_mitigasi) ? "rencana mitigasi" : null,
      a.nilai_dampak != null && b.nilai_dampak != null && Math.abs(Number(a.nilai_dampak) - Number(b.nilai_dampak)) <= Math.max(1, Number(a.nilai_dampak) * 0.001) ? "nilai dampak" : null,
    ].filter(Boolean);
    if (sama.length >= 2) kembar.push({
      id: `kembar-${a.id}-${b.id}`, severity: "kritis", area: "Risk Register",
      judul: `${nama(a, i)} dan ${nama(b, j)} terlihat duplikat`, detail: `Sama pada: ${sama.join(", ")}. Bedakan root cause, dampak, dan mitigasinya atau gabungkan.`,
      href: "/risk-register", ref: refR(a, i),
    });
  }));
  add("reg-kembar", "Risk Register", "Tidak ada risiko duplikat / hasil salin-tempel", kembar);

  // Bila kriteria acuan dapat diukur (EBITDA atau besaran di Deskripsi Dampak), kategori dampak dibandingkan dengan kriteria;
  // selain itu dipakai uji kewajaran kasar terhadap nilai rupiah.
  const ebitda = ebitdaRkap(d.params);
  add("reg-dampak", "Risk Register", "Kategori dampak sesuai Kriteria Dampak Acuan",
    reg.map((r, i) => ({ r, i, saran: saranDampak(r, cariKriteria(d.kriteria, r), ebitda) })).filter(({ r, saran }) => r.kategori_dampak && (saran
      ? saran.level !== r.kategori_dampak
      : r.nilai_dampak != null && ((URUT_DAMPAK.indexOf(r.kategori_dampak) >= 3 && Number(r.nilai_dampak) < 100_000_000) ||
        (URUT_DAMPAK.indexOf(r.kategori_dampak) <= 1 && Number(r.nilai_dampak) >= 10_000_000_000)))).map(({ r, i, saran }) => ({
      id: `dmp-${r.id}`, severity: "perhatian", area: "Risk Register",
      judul: saran
        ? `${nama(r, i)}: ${r.kategori_dampak}, menurut kriteria acuan ${saran.level}`
        : `${nama(r, i)}: ${r.kategori_dampak} dengan nilai dampak Rp${Number(r.nilai_dampak).toLocaleString("id-ID")}`,
      detail: saran
        ? `${saran.ukuran} pada kriteria "${r.kriteria_dampak}" (${saran.sumber}).`
        : `Periksa kembali terhadap kriteria "${r.kriteria_dampak ?? "-"}" (nilai dalam rupiah penuh).`,
      href: "/risk-register", ref: refR(r, i),
    })));

  add("reg-el", "Risk Register", "Expected Loss terisi dan sama dengan probabilitas × nilai dampak", [
    ...reg.map((r, i) => ({ r, i })).filter(({ r }) => r.probabilitas != null && r.nilai_dampak != null && !Number(r.expected_loss)).map(({ r, i }): Temuan => ({
      id: `el-${r.id}`, severity: "info", area: "Risk Register", judul: `${nama(r, i)}: Expected Loss kosong/nol`,
      detail: `Perkiraan: Rp${Math.round(Number(r.probabilitas) * Number(r.nilai_dampak)).toLocaleString("id-ID")} (probabilitas × nilai dampak).`, href: "/risk-register", ref: refR(r, i),
    })),
    ...reg.map((r, i) => ({ r, i, hitung: elKeliru(r) })).filter((x) => x.hitung != null).map(({ r, i, hitung }): Temuan => ({
      id: `el-salah-${r.id}`, severity: "kritis", area: "Risk Register", judul: `${nama(r, i)}: Expected Loss salah hitung`,
      detail: `Tertulis Rp${Number(r.expected_loss).toLocaleString("id-ID")}, seharusnya Rp${Math.round(hitung!).toLocaleString("id-ID")} (probabilitas × nilai dampak).`,
      href: "/risk-register", ref: refR(r, i),
    })),
  ]);

  // Angka tidak bulat yang sama persis di beberapa risiko berbeda menandakan salin-tempel, bukan perhitungan per risiko.
  add("reg-salin-angka", "Risk Register", "Nilai dampak dan target tidak disalin antar-risiko",
    (["nilai_dampak", "target_nilai_dampak"] as const).flatMap((kol) => {
      const per = new Map<number, number[]>();
      reg.forEach((r, i) => { const v = Number(r[kol]); if (v > 0 && v % 1_000_000 !== 0) per.set(v, [...(per.get(v) ?? []), i]); });
      return [...per].filter(([, ix]) => ix.length > 1).map(([v, ix]): Temuan => ({
        id: `salin-${kol}-${v}`, severity: "perhatian", area: "Risk Register",
        judul: `${ix.map((i) => nama(reg[i], i)).join(" dan ")}: ${kol === "nilai_dampak" ? "Nilai Dampak" : "Target Nilai Dampak"} sama persis`,
        detail: `Rp${v.toLocaleString("id-ID")}. Hitung dari skenario dan mitigasi masing-masing risiko.`, href: "/risk-register", ref: refR(reg[ix[0]], ix[0]),
      }));
    }));

  // Kategori RAM bermasalah tetapi tidak ada risk event di kategorinya
  const katMasalah = Array.from(new Set(d.ram.filter((r) => r.diterapkan && r.status === "Merah").map((r) => r.kategori)));
  add("reg-cakupan", "Risk Register", "Setiap kategori dengan parameter Merah punya risk event",
    katMasalah.filter((k) => !reg.some((r) => r.kategori === k)).map((k) => ({
      id: `cak-${k}`, severity: "kritis", area: "Risk Register", judul: `${k}: parameter Merah tetapi tidak ada risiko di Risk Register`,
      detail: d.ram.filter((r) => r.kategori === k && r.status === "Merah").map((r) => `${r.kode} ${r.status}`).join(", "), href: "/risk-register",
    })));

  // ---------- Keterkaitan ----------
  if (d.adaKeterkaitan) {
    add("trace-risiko", "Keterkaitan", "Setiap risiko utama terkait parameter RAM",
      reg.map((r, i) => ({ r, i })).filter(({ r }) => isTopRisk(r.kategori_dampak) && !(r.parameter_ram ?? []).length).map(({ r, i }) => ({
        id: `trr-${r.id}`, severity: "perhatian", area: "Keterkaitan", judul: `${nama(r, i)} belum dikaitkan ke parameter RAM`,
        href: "/risk-register", ref: refR(r, i),
      })));
    add("trace-param", "Keterkaitan", "Parameter Merah ditopang risk event",
      d.ram.filter((r) => r.diterapkan && perluPengendalian(r.status) && r.kode && !reg.some((x) => (x.parameter_ram ?? []).includes(r.kode))).map((r) => ({
        id: `trp-${r.key}`, severity: "perhatian", area: "Keterkaitan", judul: `${r.kode} (${r.status}) tidak dikaitkan ke risk event mana pun`,
        detail: r.parameter, href: "/keterkaitan", ref: refP(r.kode, r.parameter),
      })));
  } else {
    add("trace-migrasi", "Keterkaitan", "Keterkaitan risiko–parameter tersedia", [{
      id: "trace-migrasi", severity: "info", area: "Keterkaitan", judul: "Kolom keterkaitan belum ada di database",
      detail: "Jalankan supabase/migrations/0002_challenge_session.sql.", href: "/keterkaitan",
    }]);
  }

  // ---------- Target residual & rencana aksi ----------
  if (d.aksi) {
    const t = reg.map((r, i) => ({ r, i, t: ringkasTarget(r, d.aksi!.filter((a) => a.risk_id === r.id), d.ras) }));
    const temuan = (kolom: string, sev: (r: RiskRegister, pesan: string) => Severity) => t.flatMap(({ r, i, t }) =>
      t.isu.filter((x) => x.kolom === kolom).map((x, j): Temuan => ({
        id: `${kolom}-${r.id}-${j}`, severity: sev(r, x.pesan), area: "Risk Register", judul: `${nama(r, i)}: ${x.pesan}`, href: "/risk-register", ref: refR(r, i),
      })));
    add("reg-target", "Risk Register", "Risiko utama punya target residual dalam selera risiko",
      temuan("Target Residual", (r, p) => (/di atas selera|lebih tinggi dari inheren/.test(p) || (isTopRisk(r.kategori_dampak) && /wajib/.test(p)) ? "kritis" : "perhatian")));
    add("reg-aksi", "Risk Register", "Rencana aksi mitigasi lengkap (PIC, biaya, jadwal, output, bukti dukung)",
      temuan("Rencana Aksi", (r) => (isTopRisk(r.kategori_dampak) ? "perhatian" : "info")));
  } else {
    add("reg-target-migrasi", "Risk Register", "Target residual & rencana aksi tersedia", [{
      id: "reg-target-migrasi", severity: "info", area: "Risk Register", judul: "Kolom target residual dan tabel rencana aksi belum ada di database",
      detail: "Jalankan supabase/migrations/0008_target_mitigasi.sql.", href: "/risk-register",
    }]);
  }

  // ---------- RAS ----------
  add("ras-sikap", "RAS", "Sikap risiko entitas tidak lebih agresif dari Induk",
    d.ras.filter((r) => r.sikap && cekSikap(r.sikap, r.sikap_induk) !== "Sesuai").map((r) => ({
      id: `sik-${r.id}`, severity: "kritis", area: "RAS", judul: `${r.kategori}: ${r.sikap} lebih agresif dari Induk (${r.sikap_induk})`, href: "/ras",
    })));
  add("ras-isi", "RAS", "Sikap, pernyataan, dan rasionalisasi RAS terisi",
    d.ras.filter((r) => [r.sikap, r.pernyataan, r.rasionalisasi].some(kosong)).map((r) => ({
      id: `rasi-${r.id}`, severity: "perhatian", area: "RAS", judul: `${r.kategori}: ${[!r.sikap && "sikap", kosong(r.pernyataan) && "pernyataan", kosong(r.rasionalisasi) && "rasionalisasi"].filter(Boolean).join(", ")} kosong`,
      href: "/ras",
    })));

  // ---------- Umum ----------
  add("sampul", "Sampul", "Identitas sampul lengkap",
    ([["posisi_data", "Posisi Data"], ["tanggal_penyusunan", "Tanggal Penyusunan"]] as const).filter(([k]) => kosong(d.sampul[k])).map(([k, l]) => ({
      id: `samp-${k}`, severity: "info", area: "Sampul", judul: `${l} belum diisi`, href: "/sampul",
    })));
  add("cat", "CAT", "Rencana aksi korporasi RKAP 2027 terdokumentasi",
    d.cat.length ? d.cat.filter((c) => [c.nama, c.parameter, c.limit_v, c.appetite_v, c.tolerance_v].some(kosong)).map((c, i) => ({
      id: `cat-${c.id}`, severity: "perhatian", area: "CAT", judul: `Aksi korporasi #${i + 1} ${c.nama ?? ""} belum lengkap`, href: "/cat",
    })) : [{ id: "cat-kosong", severity: "info", area: "CAT", judul: "Belum ada rencana aksi korporasi", detail: "Pastikan memang tidak ada aksi korporasi pada RKAP 2027, dan siapkan jawabannya.", href: "/cat" }]);

  return out;
}

export const SEV_ORDER: Severity[] = ["kritis", "perhatian", "info"];
